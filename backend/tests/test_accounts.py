"""Offline tests. AWS SDK clients are replaced before any handler is loaded."""
import concurrent.futures
import importlib.util
import json
from pathlib import Path
import sys
import threading
import types
import unittest

ROOT = Path(__file__).resolve().parents[1] / "lambdas"
class ClientError(Exception):
    def __init__(self, response, operation):
        self.response = response
        super().__init__(operation)
class Key:
    def __init__(self, name): self.name = name
    def eq(self, value): return value
class Serializer:
    def serialize(self, value): return {"S": str(value)}
class FakeAWS:
    def __init__(self):
        self.events = {"event": {"eventId": "event", "title": "Open event", "totalSeats": 10, "seatsBooked": 0}}
        self.bookings = {}
        self.lock = threading.Lock()
        self.added_groups = []
        self.calls = 0
        self.query_barrier = None
    def Table(self, name):
        aws = self
        class Table:
            def get_item(self, Key, **kwargs):
                aws.calls += 1
                data = aws.events if name == "Nexus-Events" else aws.bookings
                item = data.get(next(iter(Key.values())))
                return {"Item": dict(item)} if item else {}
            def query(self, **kwargs):
                aws.calls += 1
                rows = [dict(b) for b in aws.bookings.values() if b['userId'] == kwargs['KeyConditionExpression']]
                if aws.query_barrier and kwargs['KeyConditionExpression'].endswith('@example.com'):
                    aws.query_barrier.wait(timeout=5)
                # Two pages deliberately exercise pagination and pending exclusion.
                if 'ExclusiveStartKey' not in kwargs and len(rows) > 1:
                    return {'Items':rows[:1], 'LastEvaluatedKey':{'bookingId':'next'}}
                return {'Items':rows[1:] if 'ExclusiveStartKey' in kwargs else rows}
            def scan(self, **kwargs):
                aws.calls += 1
                return {'Items': []}
        return Table()
    def transact_write_items(self, TransactItems):
        with self.lock:
            update = TransactItems[0]['Update']
            put = TransactItems[1]['Put']
            assert 'seatsBooked < totalSeats' in update['ConditionExpression']
            assert put['ConditionExpression'] == 'attribute_not_exists(bookingId)'
            item = {k:v['S'] for k,v in put['Item'].items()}
            ev = self.events.get(update['Key']['eventId']['S'])
            if not ev or ev['seatsBooked'] >= ev['totalSeats'] or item['bookingId'] in self.bookings:
                raise ClientError({'Error':{'Code':'TransactionCanceledException'}, 'CancellationReasons':[{'Code':'ConditionalCheckFailed'}]}, 'TransactWriteItems')
            self.bookings[item['bookingId']] = item
            ev['seatsBooked'] += 1
    def admin_add_user_to_group(self, **kwargs): self.added_groups.append(kwargs)

def load(name, aws):
    boto = types.ModuleType('boto3')
    boto.resource = lambda *a, **k: aws
    boto.client = lambda *a, **k: aws
    conditions = types.ModuleType('boto3.dynamodb.conditions'); conditions.Key = Key
    dtypes = types.ModuleType('boto3.dynamodb.types'); dtypes.TypeSerializer = Serializer
    errors = types.ModuleType('botocore.exceptions'); errors.ClientError = ClientError
    config = types.ModuleType('botocore.config'); config.Config = lambda **kwargs: kwargs
    for module in (boto, conditions, dtypes, errors, config): sys.modules[module.__name__] = module
    sys.modules['boto3.dynamodb'] = types.ModuleType('boto3.dynamodb')
    sys.modules['botocore'] = types.ModuleType('botocore')
    spec = importlib.util.spec_from_file_location(name, ROOT / (name + '.py'))
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module

def event(user='visitor', groups=None, body=None):
    return {'body':json.dumps(body or {'eventId':'event'}), 'requestContext':{'authorizer':{'claims':{
        'sub':user, 'email':user+'@example.com', 'email_verified':'true', 'name':user,
        'cognito:groups':groups or []}}}}

class AccountTests(unittest.TestCase):
    def setUp(self): self.aws = FakeAWS()
    def test_unsigned_rejected_before_database(self):
        for name in ('bookEvent','getBookings','getItems','reportItem'):
            handler=load(name,self.aws)
            result=handler.lambda_handler({'headers':{'x-mock-user':'fake'}},None)
            self.assertEqual(result['statusCode'],401,name)
        self.assertEqual(self.aws.calls,0)
    def test_visitor_booking_uses_claims_not_body_identity(self):
        handler=load('bookEvent',self.aws)
        result=handler.lambda_handler(event(body={'eventId':'event','email':'victim@example.com','userId':'victim'}),None)
        self.assertEqual(result['statusCode'],201)
        ticket=json.loads(result['body'])['booking']
        self.assertEqual(ticket['userId'],'visitor'); self.assertEqual(ticket['userEmail'],'visitor@example.com')
    def test_admin_booking_rejected_before_database(self):
        handler = load('bookEvent', self.aws)
        for groups in (['admins'], ['admins', 'students'], '[admins]', '["students","admins"]', 'admins'):
            result = handler.lambda_handler(event(groups=groups), None)
            self.assertEqual(result['statusCode'], 403)
            self.assertIn('Admin accounts', json.loads(result['body'])['error'])
        self.assertEqual(self.aws.calls, 0)
        self.assertEqual(self.aws.events['event']['seatsBooked'], 0)
        self.assertEqual(self.aws.bookings, {})

    def test_student_booking_still_allowed(self):
        result = load('bookEvent', self.aws).lambda_handler(event(user='student', groups=['students']), None)
        self.assertEqual(result['statusCode'], 201)

    def test_concurrent_duplicate_only_one_seat(self):
        self.aws.query_barrier = threading.Barrier(8)
        handler=load('bookEvent',self.aws)
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            results=list(pool.map(lambda _: handler.lambda_handler(event(),None),range(8)))
        self.assertEqual(sum(x['statusCode']==201 for x in results),1)
        self.assertEqual(self.aws.events['event']['seatsBooked'],1)
        self.assertEqual(len(self.aws.bookings),1)
    def test_last_seat_is_not_overbooked(self):
        self.aws.events['event']['totalSeats']=1
        self.aws.query_barrier = threading.Barrier(8)
        handler=load('bookEvent',self.aws)
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            results=list(pool.map(lambda n:handler.lambda_handler(event(user=str(n)),None),range(8)))
        self.assertEqual(sum(x['statusCode']==201 for x in results),1)
        self.assertEqual(self.aws.events['event']['seatsBooked'],1)
        self.assertEqual(len(self.aws.bookings),1)
    def test_unverified_email_and_bad_body_rejected(self):
        handler=load('bookEvent',self.aws); request=event(); request['requestContext']['authorizer']['claims']['email_verified']='false'
        self.assertEqual(handler.lambda_handler(request,None)['statusCode'],403)
        for body in ('{', '[]', '{"eventId":42}', '{"eventId":"event","action":"request_code"}'):
            request=event();request['body']=body
            self.assertEqual(handler.lambda_handler(request,None)['statusCode'],400)
    def test_only_students_can_access_lost_found(self):
        for name in ('getItems','reportItem'):
            handler=load(name,self.aws)
            for groups in (['visitors'], ['admins'], []):
                request=event(groups=groups);request['requestContext']['authorizer']['claims']['profile']='student-requested'
                self.assertEqual(handler.lambda_handler(request,None)['statusCode'],403)
        self.assertEqual(self.aws.calls,0)
        handler=load('getItems',self.aws)
        for groups in (['students'], '[students]', '["students"]'):
            self.assertEqual(handler.lambda_handler(event(groups=groups),None)['statusCode'],200)
    def test_ticket_history_legacy_email_and_pending_exclusion(self):
        self.aws.bookings={
            'pending':{'bookingId':'pending','userId':'visitor@example.com','status':'PENDING_CONFIRMATION','authCode':'123456'},
            'legacy':{'bookingId':'legacy','userId':'visitor@example.com','status':'CONFIRMED','eventId':'old'},
            'new':{'bookingId':'new','userId':'visitor','status':'CONFIRMED','eventId':'new'},
            'other':{'bookingId':'other','userId':'someone','status':'CONFIRMED'} }
        handler=load('getBookings',self.aws)
        result=json.loads(handler.lambda_handler(event(),None)['body'])
        self.assertEqual({x['bookingId'] for x in result['bookings']},{'legacy','new'})
        self.assertTrue(all('authCode' not in x for x in result['bookings']))
    def test_legacy_booking_blocks_rebooking(self):
        self.aws.bookings={'old':{'bookingId':'old','eventId':'event','userId':'visitor@example.com','status':'CONFIRMED'}}
        self.assertEqual(load('bookEvent',self.aws).lambda_handler(event(),None)['statusCode'],409)
        self.assertEqual(self.aws.events['event']['seatsBooked'],0)
    def test_admin_mock_override_removed(self):
        request=event(groups=['visitors']);request['headers']={'x-mock-role':'admin'}
        self.assertEqual(load('createEvent',self.aws).lambda_handler(request,None)['statusCode'],403)
    def test_private_photos_are_signed_without_changing_records(self):
        signed = []
        def presign(operation, Params, ExpiresIn):
            signed.append((operation, Params, ExpiresIn))
            return 'https://private.example/photo?signature=test'
        self.aws.generate_presigned_url = presign
        handler = load('getItems', self.aws)
        records = [{'imageUrl': 'uploads/blue cap.jpg', 'title': 'Cap'}, {'title': 'No photo'}]
        handler.items_table = types.SimpleNamespace(scan=lambda **kwargs: {'Items': records})
        result = handler.lambda_handler(event(groups=['students']), None)
        self.assertEqual(result['statusCode'], 200)
        body = json.loads(result['body'])
        self.assertEqual(body['items'][0]['imageUrl'], 'https://private.example/photo?signature=test')
        self.assertNotIn('imageUrl', body['items'][1])
        self.assertEqual(records[0]['imageUrl'], 'uploads/blue cap.jpg')
        self.assertEqual(signed, [('get_object', {'Bucket': handler.BUCKET_NAME, 'Key': 'uploads/blue cap.jpg'}, 600)])
        self.assertEqual(self.aws.calls, 0)

    def test_photo_urls_only_signed_for_authorized_students_on_all_routes(self):
        signed = []
        self.aws.generate_presigned_url = lambda *a, **k: signed.append(k) or 'https://private.example/signed'
        handler = load('getItems', self.aws)
        rows = [{'imageUrl': 'uploads/photo.jpg'}]
        handler.items_table = types.SimpleNamespace(scan=lambda **kwargs: {'Items': rows}, query=lambda **kwargs: {'Items': rows})
        for groups in ([], ['visitors'], ['admins']):
            self.assertEqual(handler.lambda_handler(event(groups=groups), None)['statusCode'], 403)
        self.assertEqual(signed, [])
        class Expression:
            def eq(self, value): return self
            def __and__(self, other): return self
        handler.Key = lambda name: Expression()
        sys.modules['boto3'].dynamodb = types.SimpleNamespace(conditions=types.SimpleNamespace(Attr=lambda name: Expression()))
        for path, params in (('/items', {}), ('/items', {'type': 'lost'}), ('/items/me', {})):
            request = event(groups=['students']); request.update(path=path, queryStringParameters=params)
            result = handler.lambda_handler(request, None)
            self.assertEqual(result['statusCode'], 200)
            self.assertEqual(json.loads(result['body'])['items'][0]['imageUrl'], 'https://private.example/signed')
        self.assertEqual(len(signed), 3)

    def test_legacy_bucket_urls_are_resigned_and_other_urls_are_unchanged(self):
        keys = []
        self.aws.generate_presigned_url = lambda *a, **k: keys.append(k['Params']['Key']) or 'https://private.example/signed'
        handler = load('getItems', self.aws)
        original = [
            {'imageUrl': f'https://{handler.BUCKET_NAME}.s3.{handler.REGION}.amazonaws.com/uploads/blue%20cap.jpg'},
            {'imageUrl': 'https://other.example/photo.jpg'},
            {'imageUrl': 'outside/photo.jpg'},
        ]
        response = json.loads(handler.items_response(original)['body'])
        self.assertEqual(keys, ['uploads/blue cap.jpg'])
        self.assertEqual(response['items'][1:], original[1:])

    def test_student_request_never_auto_grants_students(self):
        handler=load('postConfirmation',self.aws)
        request={'triggerSource':'PostConfirmation_ConfirmSignUp','userPoolId':'pool','userName':'person','request':{'userAttributes':{'profile':'student-requested'}}}
        self.assertIs(handler.lambda_handler(request,None),request)
        self.assertEqual(self.aws.added_groups[0]['GroupName'],'visitors')
        handler.lambda_handler({'triggerSource':'PostConfirmation_ConfirmForgotPassword'},None)
        self.assertEqual(len(self.aws.added_groups),1)

if __name__ == '__main__': unittest.main()
