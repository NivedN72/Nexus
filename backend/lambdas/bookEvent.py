import json
import uuid
import datetime
import boto3
from botocore.exceptions import ClientError
from decimal import Decimal

dynamodb = boto3.resource("dynamodb", region_name="ap-southeast-2")
events_table = dynamodb.Table("Nexus-Events")
bookings_table = dynamodb.Table("Nexus-Bookings")

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super(DecimalEncoder, self).default(obj)

def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
            "Access-Control-Allow-Methods": "POST,OPTIONS"
        },
        "body": json.dumps(body, cls=DecimalEncoder)
    }

def lambda_handler(event, context):
    try:
        # 1. Identify student from Cognito claims
        claims = event.get("requestContext", {}).get("authorizer", {}).get("claims", {})
        user_id = claims.get("sub") or claims.get("email")

        # Mock fallback for direct Lambda test events in AWS Console
        if not user_id:
            headers = event.get("headers") or {}
            user_id = headers.get("x-mock-user", "student-user-01")

        # 2. Parse request body
        body = json.loads(event.get("body") or "{}")
        event_id = body.get("eventId")
        if not event_id:
            return response(400, {"error": "Missing required field: eventId"})

        # 3. ATOMIC CONDITIONAL WRITE:
        # Increment seatsBooked strictly if seatsBooked < totalSeats.
        # This prevents overbooking without any table locking or read-then-write race conditions.
        try:
            update_res = events_table.update_item(
                Key={"eventId": event_id},
                UpdateExpression="SET seatsBooked = seatsBooked + :incr",
                ConditionExpression="attribute_exists(eventId) AND seatsBooked < totalSeats",
                ExpressionAttributeValues={":incr": 1},
                ReturnValues="ALL_NEW"
            )
            updated_event = update_res.get("Attributes", {})
            event_title = updated_event.get("title", "Campus Event")

        except ClientError as e:
            error_code = e.response["Error"]["Code"]
            if error_code == "ConditionalCheckFailedException":
                # Check if event exists to give accurate error message
                check = events_table.get_item(Key={"eventId": event_id})
                if "Item" not in check:
                    return response(404, {"error": f"Event '{event_id}' not found"})
                return response(409, {
                    "error": "Booking failed: Event is fully booked! No seats available.",
                    "totalSeats": check["Item"].get("totalSeats"),
                    "seatsBooked": check["Item"].get("seatsBooked")
                })
            raise e

        # 4. Record the confirmed booking
        booking_id = str(uuid.uuid4())
        booking_time = datetime.datetime.now(datetime.timezone.utc).isoformat()

        booking_record = {
            "bookingId": booking_id,
            "userId": user_id,
            "eventId": event_id,
            "eventTitle": event_title,
            "bookingTime": booking_time,
            "status": "CONFIRMED"
        }

        bookings_table.put_item(Item=booking_record)

        return response(201, {
            "message": "Seat successfully booked!",
            "booking": booking_record,
            "remainingSeats": int(updated_event.get("totalSeats", 0)) - int(updated_event.get("seatsBooked", 0))
        })

    except Exception as e:
        print(f"Error processing booking: {str(e)}")
        return response(500, {"error": "Failed to book event", "details": str(e)})
