import datetime
import json
import os
import smtplib
import ssl
from email.message import EmailMessage
from html import escape
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

def send_booking_confirmation(booking, event_item, context):
    """Send only after the booking transaction commits; never roll back a ticket for email."""
    sender = os.environ.get("SMTP_USER", "").strip()
    password = os.environ.get("SMTP_PASS", "")
    if not sender or not password:
        print("Booking confirmation email unavailable: SMTP configuration missing")
        return {"status": "unavailable"}
    # Leave room to return the confirmed ticket if the mail server is slow.
    if context and context.get_remaining_time_in_millis() < 15000:
        print("Booking confirmation email unavailable: insufficient Lambda time remaining")
        return {"status": "unavailable"}
    try:
        date = str(event_item.get("date") or "To be announced")
        try:
            parsed = datetime.datetime.fromisoformat(date.replace("Z", "+00:00"))
            if parsed.tzinfo:
                date = parsed.astimezone(datetime.timezone.utc).strftime("%d %b %Y, %H:%M UTC")
        except ValueError:
            pass
        details = [
            ("Event", booking["eventTitle"]),
            ("Date and time", date),
            ("Venue", str(event_item.get("venue") or "To be announced")),
            ("Attendee", booking["attendeeName"]),
            ("Booking ID", booking["bookingId"]),
            ("Status", "Confirmed"),
        ]
        message = EmailMessage()
        message["From"] = sender
        message["To"] = booking["userEmail"]
        message["Subject"] = "Your Nexus booking is confirmed"
        message.set_content("Your seat is confirmed.\n\n" + "\n".join(
            f"{label}: {value}" for label, value in details
        ) + "\n\nYour ticket is also available in My Bookings. No verification code is needed.")
        rows = "".join(
            f'<tr><td style="padding:10px 12px;color:#50565d;vertical-align:top">{escape(label)}</td>'
            f'<td style="padding:10px 12px;overflow-wrap:anywhere">{escape(str(value))}</td></tr>'
            for label, value in details
        )
        message.add_alternative(
            '<!doctype html><html><body style="margin:0;background:#eef0f5;color:#242426;font-family:Arial,sans-serif">'
            '<div style="max-width:580px;margin:32px auto;background:#fff;padding:32px;border-radius:16px">'
            '<span style="background:#d1ff5f;padding:8px 12px;border-radius:8px;font-weight:bold">Nexus</span>'
            '<h1 style="font-size:28px;margin-top:28px">Your seat is confirmed.</h1>'
            '<p>Here are the details of your campus booking.</p>'
            f'<table style="width:100%;border-collapse:collapse;font-size:14px">{rows}</table>'
            '<p style="font-size:14px;margin-top:24px">Your ticket is also available in My Bookings. '
            'No verification code is needed.</p></div></body></html>', subtype="html"
        )
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=3, context=ssl.create_default_context()) as server:
            server.login(sender, password)
            server.send_message(message)
        return {"status": "sent"}
    except Exception as error:
        # Do not log passwords, recipient addresses, or mail server responses.
        print("Booking confirmation email failed:", type(error).__name__)
        return {"status": "failed"}


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
        try:
            event_date = event_item.get("date")
            start = datetime.datetime.fromisoformat(event_date.replace("Z", "+00:00"))
            if start.tzinfo is None:
                raise ValueError("Timezone required")
        except (AttributeError, TypeError, ValueError):
            return response(409, {"error": "This event has no valid booking date"})
        if start <= datetime.datetime.now(datetime.timezone.utc):
            return response(409, {"error": "This event has passed. Bookings are closed."})
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
        # Recheck after legacy lookups; a date edit invalidates the transaction.
        if start <= datetime.datetime.now(datetime.timezone.utc):
            return response(409, {"error": "This event has passed. Bookings are closed."})
        # The unique ticket and seat counter succeed or fail together.
        client.transact_write_items(TransactItems=[
            {"Update": {
                "TableName": "Nexus-Events", "Key": {"eventId": {"S": event_id}},
                "UpdateExpression": "SET seatsBooked = seatsBooked + :one",
                "ConditionExpression": "attribute_exists(eventId) AND seatsBooked < totalSeats AND #date = :eventDate",
                "ExpressionAttributeNames": {"#date": "date"},
                "ExpressionAttributeValues": {":one": {"N": "1"}, ":eventDate": {"S": event_date}}
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
        confirmation_email = send_booking_confirmation(booking, event_item, context)
        return response(201, {"message": "Seat reserved", "booking": booking, "remainingSeats": remaining,
                              "confirmationEmail": confirmation_email})
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
