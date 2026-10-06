import json
import uuid
import datetime
import boto3
from decimal import Decimal

dynamodb = boto3.resource("dynamodb", region_name="ap-southeast-2")
table = dynamodb.Table("Nexus-Events")

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
        # 1. Authorize: Verify admin privileges from Cognito claims
        claims = event.get("requestContext", {}).get("authorizer", {}).get("claims", {})
        groups = claims.get("cognito:groups", "")
        # groups can be a string or list depending on authorizer config
        is_admin = False
        if isinstance(groups, list):
            is_admin = "admins" in groups
        elif isinstance(groups, str):
            is_admin = "admins" in groups.split(",")

        # For testing without Cognito authorizer connected, allow local override if header present
        headers = event.get("headers") or {}
        if not is_admin and headers.get("x-mock-role") == "admin":
            is_admin = True

        if not is_admin:
            return response(403, {"error": "Forbidden: Only campus admins can create events"})

        # 2. Parse request body
        body = json.loads(event.get("body") or "{}")
        title = body.get("title", "").strip()
        description = body.get("description", "").strip()
        date = body.get("date", "").strip()
        venue = body.get("venue", "").strip()
        total_seats = body.get("totalSeats")

        if not title or not date or not venue or total_seats is None:
            return response(400, {"error": "Missing required fields: title, date, venue, totalSeats"})

        try:
            total_seats = int(total_seats)
            if total_seats <= 0:
                raise ValueError()
        except ValueError:
            return response(400, {"error": "totalSeats must be a positive integer"})

        user_id = claims.get("sub", claims.get("username", "admin-user"))
        event_id = str(uuid.uuid4())
        created_at = datetime.datetime.now(datetime.timezone.utc).isoformat()

        item = {
            "eventId": event_id,
            "title": title,
            "description": description,
            "date": date,
            "venue": venue,
            "totalSeats": total_seats,
            "seatsBooked": 0,
            "createdBy": user_id,
            "createdAt": created_at
        }

        table.put_item(Item=item)
        return response(201, {"message": "Event created successfully", "event": item})

    except Exception as e:
        print(f"Error creating event: {str(e)}")
        return response(500, {"error": "Failed to create event", "details": str(e)})
