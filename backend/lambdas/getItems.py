import json
import boto3
from boto3.dynamodb.conditions import Key
from decimal import Decimal

REGION = "ap-southeast-2"
dynamodb = boto3.resource("dynamodb", region_name=REGION)
items_table = dynamodb.Table("Nexus-Items")

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
        query_params = event.get("queryStringParameters") or {}
        item_type = query_params.get("type")  # "lost" or "found"

        path = event.get("resource") or event.get("path") or ""

        # If /items/me is requested, filter by user
        if "/me" in path:
            claims = event.get("requestContext", {}).get("authorizer", {}).get("claims", {})
            user_id = claims.get("sub") or claims.get("username")
            if not user_id:
                headers = event.get("headers") or {}
                user_id = headers.get("x-mock-user", "student-reporter")

            # Scan with filter on reportedBy
            res = items_table.scan(
                FilterExpression=boto3.dynamodb.conditions.Attr("reportedBy").eq(user_id)
            )
            return response(200, {"items": res.get("Items", []), "count": len(res.get("Items", []))})

        # If type query param given: query GSI type-status-index
        if item_type in ["lost", "found"]:
            res = items_table.query(
                IndexName="type-status-index",
                KeyConditionExpression=Key("type").eq(item_type) & Key("status").eq("open")
            )
            items = res.get("Items", [])
            return response(200, {"items": items, "count": len(items)})

        # Default: list all open items
        res = items_table.scan()
        items = res.get("Items", [])
        return response(200, {"items": items, "count": len(items)})

    except Exception as e:
        print(f"Error fetching items: {str(e)}")
        return response(500, {"error": "Failed to fetch items", "details": str(e)})
