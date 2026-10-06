import datetime
import json
import uuid
from decimal import Decimal
import boto3
from boto3.dynamodb.conditions import Key
from boto3.dynamodb.types import TypeSerializer
from botocore.exceptions import ClientError

REGION = "ap-southeast-2"
dynamodb = boto3.resource("dynamodb", region_name=REGION)
events_table = dynamodb.Table("Nexus-Events")
bookings_table = dynamodb.Table("Nexus-Bookings")
client = boto3.client("dynamodb", region_name=REGION)
serializer = TypeSerializer()

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super().default(obj)

def response(status, body):
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Content-Type,Authorization",
                    "Access-Control-Allow-Methods": "POST,OPTIONS"},
        "body": json.dumps(body, cls=DecimalEncoder)
    }

def legacy_booking_exists(event_id, identities):
    # Preserve tickets from the previous UUID/email-based flow.
    for identity in identities:
        params = {"IndexName": "userId-index", "KeyConditionExpression": Key("userId").eq(identity)}
        while True:
            result = bookings_table.query(**params)
            if any(item.get("eventId") == event_id and item.get("status") == "CONFIRMED"
                   for item in result.get("Items", [])):
                return True
            cursor = result.get("LastEvaluatedKey")
            if not cursor:
                break
            params["ExclusiveStartKey"] = cursor
    return False

def lambda_handler(event, context):
    claims = event.get("requestContext", {}).get("authorizer", {}).get("claims", {})
    user_id = claims.get("sub")
    if not user_id:
        return response(401, {"error": "Sign in to book an event"})
    groups = claims.get("cognito:groups", [])
    if isinstance(groups, str):
        groups = [part.strip().strip('[]" ') for part in groups.split(",")]
    if "admins" in groups:
        return response(403, {"error": "Admin accounts cannot book seats"})
    if str(claims.get("email_verified", "false")).lower() != "true":
        return response(403, {"error": "Verify your account email before booking"})
    try:
        body = json.loads(event.get("body") or "{}")
        if not isinstance(body, dict):
            return response(400, {"error": "Request body must be a JSON object"})
        event_id = body.get("eventId")
        if not isinstance(event_id, str) or not event_id.strip():
            return response(400, {"error": "Missing or invalid eventId"})
        if body.get("action") not in (None, "book"):
            return response(400, {"error": "Email-code booking is no longer supported. Sign in and reserve your seat."})
        email = (claims.get("email") or "").strip().lower()
        if not email:
            return response(403, {"error": "A verified account email is required"})
        event_item = events_table.get_item(Key={"eventId": event_id}, ConsistentRead=True).get("Item")
        if not event_item:
            return response(404, {"error": "Event not found"})
        booking_id = str(uuid.uuid5(uuid.NAMESPACE_URL, json.dumps([event_id, user_id])))
        if bookings_table.get_item(Key={"bookingId": booking_id}, ConsistentRead=True).get("Item"):
            return response(409, {"error": "You already have a ticket for this event"})
        if legacy_booking_exists(event_id, [user_id, email]):
            return response(409, {"error": "You already have a ticket for this event"})
        booking = {
            "bookingId": booking_id, "eventId": event_id,
            "eventTitle": event_item.get("title", "Campus Event"), "userId": user_id,
            "userEmail": email, "attendeeName": claims.get("name") or email,
            "bookingTime": datetime.datetime.now(datetime.timezone.utc).isoformat(), "status": "CONFIRMED"
        }
        # The unique ticket and seat counter succeed or fail together.
        client.transact_write_items(TransactItems=[
            {"Update": {
                "TableName": "Nexus-Events", "Key": {"eventId": {"S": event_id}},
                "UpdateExpression": "SET seatsBooked = seatsBooked + :one",
                "ConditionExpression": "attribute_exists(eventId) AND seatsBooked < totalSeats",
                "ExpressionAttributeValues": {":one": {"N": "1"}}
            }},
            {"Put": {
                "TableName": "Nexus-Bookings",
                "Item": {key: serializer.serialize(value) for key, value in booking.items()},
                "ConditionExpression": "attribute_not_exists(bookingId)"
            }}
        ])
        # Reporting the seat count must not turn a successful reservation into a 500.
        try:
            latest = events_table.get_item(Key={"eventId": event_id}, ConsistentRead=True).get("Item", {})
            remaining = max(0, int(latest.get("totalSeats", 0)) - int(latest.get("seatsBooked", 0)))
        except Exception:
            remaining = max(0, int(event_item.get("totalSeats", 0)) - int(event_item.get("seatsBooked", 0)) - 1)
        return response(201, {"message": "Seat reserved", "booking": booking, "remainingSeats": remaining})
    except (json.JSONDecodeError, TypeError):
        return response(400, {"error": "Invalid request body"})
    except ClientError as error:
        code = error.response["Error"]["Code"]
        if code == "TransactionCanceledException":
            reasons = error.response.get("CancellationReasons", [])
            if any(reason.get("Code") == "ConditionalCheckFailed" for reason in reasons):
                return response(409, {"error": "You already booked this event or it is now fully booked"})
            return response(503, {"error": "Booking is temporarily busy. Please retry."})
        print("Booking AWS error:", code)
        return response(500, {"error": "Could not book this event"})
    except Exception as error:
        print("Booking error:", type(error).__name__)
        return response(500, {"error": "Could not book this event"})
