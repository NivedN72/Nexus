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
            is_admin = "admins" in [part.strip().strip('[]\" ') for part in groups.split(",")]

        if not is_admin:
            return response(403, {"error": "Forbidden: Only campus admins can create events"})

        # 2. Parse request body
        body = json.loads(event.get("body") or "{}")
        if not isinstance(body, dict):
            return response(400, {"error": "Event must be a JSON object"})
        fields = {}
        for name, maximum in {"title": 160, "description": 4000, "date": 64, "venue": 200}.items():
            value = body.get(name, "")
            if not isinstance(value, str) or len(value) > maximum:
                return response(400, {"error": f"Invalid or oversized field: {name}"})
            fields[name] = value.strip()
        title, description, venue = fields["title"], fields["description"], fields["venue"]
        if not title or not venue:
            return response(400, {"error": "Title and venue are required"})
        try:
            start = datetime.datetime.fromisoformat(fields["date"].replace("Z", "+00:00"))
            if start.tzinfo is None or start <= datetime.datetime.now(datetime.timezone.utc):
                raise ValueError()
            date = start.astimezone(datetime.timezone.utc).isoformat()
        except ValueError:
            return response(400, {"error": "Choose a valid future date with a timezone"})
        total_seats = body.get("totalSeats")
        if type(total_seats) is not int or not 1 <= total_seats <= 100000:
            return response(400, {"error": "totalSeats must be an integer between 1 and 100000"})

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

    except (json.JSONDecodeError, TypeError, ValueError):
        return response(400, {"error": "Invalid event request"})
    except Exception as e:
        print("createEvent failed:", type(e).__name__)
        return response(500, {"error": "Failed to create event"})
