import json
import os
from urllib.parse import urlparse, unquote
from botocore.config import Config
import boto3
from boto3.dynamodb.conditions import Key
from decimal import Decimal

REGION = "ap-southeast-2"
dynamodb = boto3.resource("dynamodb", region_name=REGION)
items_table = dynamodb.Table("Nexus-Items")
BUCKET_NAME = os.environ.get("S3_BUCKET_NAME", "nexus-item-photos-nived2026")
s3_client = boto3.client("s3", region_name=REGION, config=Config(signature_version="s3v4"))

def items_response(items):
    # Sign response copies only: DynamoDB keeps the permanent object keys.
    result = []
    for item in items:
        photo = dict(item)
        key = photo.get("imageUrl")
        if isinstance(key, str) and key.startswith("https://"):
            parsed = urlparse(key)
            if parsed.hostname in (f"{BUCKET_NAME}.s3.{REGION}.amazonaws.com", f"{BUCKET_NAME}.s3.amazonaws.com"):
                key = unquote(parsed.path.lstrip("/"))
        if isinstance(key, str) and key.startswith("uploads/"):
            photo["imageUrl"] = s3_client.generate_presigned_url(
                "get_object", Params={"Bucket": BUCKET_NAME, "Key": key}, ExpiresIn=600
            )
        result.append(photo)
    return response(200, {"items": result, "count": len(result)})

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
        user_id = claims.get("sub") or claims.get("username")
        if not user_id:
            return response(401, {"error": "Sign in to view lost and found items"})

        groups = claims.get("cognito:groups", [])
        if isinstance(groups, str):
            groups = [part.strip().strip('[]\" ') for part in groups.split(',')]
        if "students" not in groups:
            return response(403, {"error": "Lost & Found is available to verified students only"})

        query_params = event.get("queryStringParameters") or {}
        item_type = query_params.get("type")  # "lost" or "found"

        path = event.get("resource") or event.get("path") or ""

        # If /items/me is requested, filter by user
        if "/me" in path:
            # Scan with filter on reportedBy
            res = items_table.scan(
                FilterExpression=boto3.dynamodb.conditions.Attr("reportedBy").eq(user_id)
            )
            return items_response(res.get("Items", []))

        # If type query param given: query GSI type-status-index
        if item_type in ["lost", "found"]:
            res = items_table.query(
                IndexName="type-status-index",
                KeyConditionExpression=Key("type").eq(item_type) & Key("status").eq("open")
            )
            items = res.get("Items", [])
            return items_response(items)

        # Default: list all open items
        res = items_table.scan()
        items = res.get("Items", [])
        return items_response(items)

    except Exception as e:
        print(f"Error fetching items: {str(e)}")
        return response(500, {"error": "Failed to fetch items", "details": str(e)})
