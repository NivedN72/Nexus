import json
import uuid
import datetime
import os
import boto3
from decimal import Decimal

REGION = "ap-southeast-2"
# Set this to your S3 bucket name (or pass via environment variable S3_BUCKET_NAME)
BUCKET_NAME = os.environ.get("S3_BUCKET_NAME", "nexus-item-photos-nived2026")

dynamodb = boto3.resource("dynamodb", region_name=REGION)
items_table = dynamodb.Table("Nexus-Items")
s3_client = boto3.client("s3", region_name=REGION)

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
        # 1. Authenticate user from Cognito claims or fallback
        claims = event.get("requestContext", {}).get("authorizer", {}).get("claims", {})
        user_id = claims.get("sub") or claims.get("username")
        user_email = claims.get("email")

        if not user_id or not user_email:
            return response(401, {"error": "Sign in to report an item"})

        groups = claims.get("cognito:groups", [])
        if isinstance(groups, str):
            groups = [part.strip().strip('[]\" ') for part in groups.split(',')]
        if "students" not in groups:
            return response(403, {"error": "Lost & Found is available to verified students only"})

        raw_body = event.get("body") or "{}"
        if not isinstance(raw_body, str) or len(raw_body.encode("utf-8")) > 16384:
            return response(400, {"error": "Report request is too large or invalid"})
        body = json.loads(raw_body)
        if not isinstance(body, dict):
            return response(400, {"error": "Report must be a JSON object"})
        limits = {"type": 5, "title": 160, "description": 2000, "location": 200, "date": 64}
        values = {}
        for name, maximum in limits.items():
            value = body.get(name, "")
            if not isinstance(value, str) or len(value) > maximum:
                return response(400, {"error": f"Invalid or oversized field: {name}"})
            values[name] = value.strip()
        item_type = values["type"].lower()
        title, description = values["title"], values["description"]
        location, date = values["location"], values["date"]
        if item_type not in ("lost", "found"):
            return response(400, {"error": "Report type must be lost or found"})
        if not title or not location:
            return response(400, {"error": "Title and location are required"})
        file_type = body.get("fileType")
        file_size = body.get("fileSize")
        upload = None
        item_id = str(uuid.uuid4())
        s3_key = None
        if file_type is not None:
            if file_type not in ("image/jpeg", "image/png"):
                return response(400, {"error": "Please upload a JPEG or PNG image"})
            if type(file_size) is not int or not 1 <= file_size <= 5 * 1024 * 1024:
                return response(400, {"error": "Photo must be between 1 byte and 5 MB"})
            extension = "png" if file_type == "image/png" else "jpg"
            s3_key = f"uploads/{item_id}.{extension}"
            upload = s3_client.generate_presigned_post(
                Bucket=BUCKET_NAME, Key=s3_key,
                Fields={"Content-Type": file_type},
                Conditions=[{"Content-Type": file_type}, ["content-length-range", 1, 5 * 1024 * 1024]],
                ExpiresIn=600
            )
        elif file_size is not None:
            return response(400, {"error": "Photo type is required"})

        created_at = datetime.datetime.now(datetime.timezone.utc).isoformat()

        # 5. Create item in Nexus-Items table with empty tags initially
        item_record = {
            "itemId": item_id,
            "type": item_type,
            "title": title,
            "description": description,
            "location": location,
            "date": date or created_at,
            "imageUrl": s3_key,
            "uploadStatus": "pending" if upload else "none",
            "tags": [],  # Will be populated by Rekognition on upload
            "status": "open",
            "reportedBy": user_id,
            "userEmail": user_email,
            "createdAt": created_at
        }

        items_table.put_item(Item=item_record, ConditionExpression="attribute_not_exists(itemId)")

        return response(201, {
            "message": "Item report created! Please upload your photo to the pre-signed URL.",
            "item": item_record,
            "upload": upload,
            "s3Key": s3_key
        })

    except (json.JSONDecodeError, TypeError, ValueError):
        return response(400, {"error": "Invalid report request"})
    except Exception as e:
        print("reportItem failed:", type(e).__name__)
        return response(500, {"error": "Failed to report item"})
