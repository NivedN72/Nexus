import json
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
            "Access-Control-Allow-Methods": "GET,OPTIONS"
        },
        "body": json.dumps(body, cls=DecimalEncoder)
    }

def lambda_handler(event, context):
    try:
        # Check if single event requested: /events/{id}
        path_params = event.get("pathParameters") or {}
        event_id = path_params.get("id")

        if event_id:
            res = table.get_item(Key={"eventId": event_id})
            item = res.get("Item")
            if not item:
                return response(404, {"error": f"Event '{event_id}' not found"})
            return response(200, item)

        # Otherwise list all events: GET /events
        res = table.scan()
        items = res.get("Items", [])
        return response(200, {"events": items, "count": len(items)})

    except Exception as e:
        print(f"Error fetching events: {str(e)}")
        return response(500, {"error": "Failed to retrieve events", "details": str(e)})
