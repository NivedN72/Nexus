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
        user_id = claims.get("sub") or claims.get("email")

        if not user_id:
            headers = event.get("headers") or {}
            user_id = headers.get("x-mock-user", "student-user-01")

        res = bookings_table.query(
            IndexName="userId-index",
            KeyConditionExpression=Key("userId").eq(user_id)
        )

        items = res.get("Items", [])
        return response(200, {"bookings": items, "count": len(items)})

    except Exception as e:
        print(f"Error fetching user bookings: {str(e)}")
        return response(500, {"error": "Failed to fetch bookings", "details": str(e)})
