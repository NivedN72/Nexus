import json
import boto3
from boto3.dynamodb.conditions import Key
from decimal import Decimal

dynamodb = boto3.resource("dynamodb", region_name="ap-southeast-2")
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
            "Access-Control-Allow-Methods": "GET,OPTIONS"
        },
        "body": json.dumps(body, cls=DecimalEncoder)
    }

def lambda_handler(event, context):
    try:
        claims = event.get("requestContext", {}).get("authorizer", {}).get("claims", {})
        user_id = claims.get("sub")
        email = (claims.get("email") or "").strip().lower()
        verified_email = str(claims.get("email_verified", "false")).lower() == "true"
        if not user_id:
            return response(401, {"error": "Sign in to view your bookings"})

        # Include legacy Cognito-sub tickets and public bookings for a verified email.
        user_ids = [user_id]
        if email and verified_email and email != user_id:
            user_ids.append(email)
        tickets = {}
        for identity in user_ids:
            params = {
                "IndexName": "userId-index",
                "KeyConditionExpression": Key("userId").eq(identity)
            }
            while True:
                res = bookings_table.query(**params)
                for item in res.get("Items", []):
                    if item.get("status") == "CONFIRMED":
                        tickets[item["bookingId"]] = item
                cursor = res.get("LastEvaluatedKey")
                if not cursor:
                    break
                params["ExclusiveStartKey"] = cursor
        items = sorted(tickets.values(), key=lambda item: item.get("bookingTime", ""), reverse=True)
        return response(200, {"bookings": items, "count": len(items)})

    except Exception as e:
        print(f"Error fetching user bookings: {str(e)}")
        return response(500, {"error": "Failed to fetch bookings", "details": str(e)})
