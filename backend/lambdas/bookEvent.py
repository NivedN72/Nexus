import json
import uuid
import datetime
import os
import boto3
from botocore.exceptions import ClientError
from decimal import Decimal

REGION = "ap-southeast-2"
SNS_TOPIC_ARN = os.environ.get("SNS_TOPIC_ARN", "")

dynamodb = boto3.resource("dynamodb", region_name=REGION)
events_table = dynamodb.Table("Nexus-Events")
bookings_table = dynamodb.Table("Nexus-Bookings")
sns_client = boto3.client("sns", region_name=REGION)

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

def send_email_confirmation(email, code, event_title):
    """Sends authorization email via SNS or logs to CloudWatch"""
    subject = f"Nexus Event Pass: Your Authorization Code for {event_title}"
    body = (
        f"Hello!\n\n"
        f"You requested to book a seat for '{event_title}'.\n\n"
        f"Your 6-digit Booking Authorization Code is:\n"
        f"👉  {code}  👈\n\n"
        f"Please enter this code on the website to confirm your ticket reservation.\n"
        f"Note: Only 1 seat is permitted per email address.\n\n"
        f"— Nexus Campus Cloud Platform"
    )
    print(f"[AUTH CODE DISPATCH] Email: {email} | Code: {code} | Event: {event_title}")

    if SNS_TOPIC_ARN:
        try:
            sns_client.publish(
                TopicArn=SNS_TOPIC_ARN,
                Subject=subject,
                Message=body
            )
            print("Successfully published code to SNS topic.")
        except Exception as e:
            print(f"SNS dispatch failed: {str(e)}")

def check_existing_booking(event_id, email):
    """Enforces One Email = One Seat rule by checking Nexus-Bookings table"""
    res = bookings_table.scan(
        FilterExpression=boto3.dynamodb.conditions.Attr("eventId").eq(event_id) & 
                         boto3.dynamodb.conditions.Attr("userId").eq(email) &
                         boto3.dynamodb.conditions.Attr("status").eq("CONFIRMED")
    )
    return len(res.get("Items", [])) > 0

def lambda_handler(event, context):
    try:
        body = json.loads(event.get("body") or "{}")
        action = body.get("action", "verify_and_book")
        event_id = body.get("eventId")
        email = (body.get("email") or body.get("userId") or "").strip().lower()
        attendee_name = body.get("name", "Student").strip()
        auth_code = body.get("authCode", "").strip()

        if not event_id or not email:
            return response(400, {"error": "Missing required fields: eventId and email"})

        # Fetch event details
        ev_res = events_table.get_item(Key={"eventId": event_id})
        event_item = ev_res.get("Item")
        if not event_item:
            return response(404, {"error": f"Event '{event_id}' not found"})

        total_seats = int(event_item.get("totalSeats", 0))
        seats_booked = int(event_item.get("seatsBooked", 0))
        event_title = event_item.get("title", "Campus Event")

        # 1. Check Capacity
        if seats_booked >= total_seats:
            return response(409, {"error": "Event is fully booked! No seats available."})

        # 2. STRICT RULE: ONE EMAIL = ONE SEAT PER EVENT
        if check_existing_booking(event_id, email):
            return response(409, {
                "error": f"Booking Denied: {email} has already booked a seat for this event! Only 1 seat per email address is allowed."
            })

        # 3. ACTION: REQUEST EMAIL AUTHORIZATION CODE
        if action == "request_code":
            # Generate deterministic or random 6-digit code for this booking
            import random
            generated_code = str(random.randint(100000, 999999))

            # Store the pending code temporarily in DynamoDB as a PENDING booking record
            pending_id = f"PENDING#{event_id}#{email}"
            bookings_table.put_item(Item={
                "bookingId": pending_id,
                "eventId": event_id,
                "eventTitle": event_title,
                "userId": email,
                "attendeeName": attendee_name,
                "authCode": generated_code,
                "status": "PENDING_CONFIRMATION",
                "createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat()
            })

            send_email_confirmation(email, generated_code, event_title)

            return response(200, {
                "message": f"Authorization code sent to {email}. Please enter the 6-digit code to complete your booking.",
                "email": email,
                "eventTitle": event_title,
                # Return code for instant offline testing if SNS email isn't configured
                "devHintCode": generated_code 
            })

        # 4. ACTION: VERIFY CODE AND ATOMICALLY BOOK SEAT
        # Verify the authorization code against the pending record
        pending_id = f"PENDING#{event_id}#{email}"
        pending_res = bookings_table.get_item(Key={"bookingId": pending_id})
        pending_item = pending_res.get("Item")

        if not pending_item or pending_item.get("authCode") != auth_code:
            return response(400, {"error": "Invalid authorization code. Please check your email and try again."})

        # ATOMIC CONDITIONAL WRITE ON DYNAMODB:
        # Increment seatsBooked strictly if seatsBooked < totalSeats
        try:
            update_res = events_table.update_item(
                Key={"eventId": event_id},
                UpdateExpression="SET seatsBooked = seatsBooked + :incr",
                ConditionExpression="attribute_exists(eventId) AND seatsBooked < totalSeats",
                ExpressionAttributeValues={":incr": 1},
                ReturnValues="ALL_NEW"
            )
            updated_event = update_res.get("Attributes", {})

        except ClientError as e:
            if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
                return response(409, {"error": "Event just became fully booked! No seats remaining."})
            raise e

        # Confirm the booking record
        confirmed_booking_id = str(uuid.uuid4())
        booking_time = datetime.datetime.now(datetime.timezone.utc).isoformat()

        booking_record = {
            "bookingId": confirmed_booking_id,
            "eventId": event_id,
            "eventTitle": event_title,
            "userId": email,
            "attendeeName": attendee_name,
            "bookingTime": booking_time,
            "status": "CONFIRMED"
        }

        # Put confirmed booking and remove pending authorization code
        bookings_table.put_item(Item=booking_record)
        bookings_table.delete_item(Key={"bookingId": pending_id})

        remaining_seats = int(updated_event.get("totalSeats", 0)) - int(updated_event.get("seatsBooked", 0))

        return response(201, {
            "message": "Authorization verified! Seat successfully booked.",
            "booking": booking_record,
            "remainingSeats": remaining_seats
        })

    except Exception as e:
        print(f"Error processing booking: {str(e)}")
        return response(500, {"error": "Failed to book event", "details": str(e)})
