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

        # Fallback for manual testing
        headers = event.get("headers") or {}
        if not user_id:
            user_id = headers.get("x-mock-user", "student-reporter")
        if not user_email:
            user_email = headers.get("x-mock-email", "student@campus.edu")

        # 2. Parse request body
        body = json.loads(event.get("body") or "{}")
        item_type = body.get("type", "").lower().strip()  # "lost" or "found"
        title = body.get("title", "").strip()
        description = body.get("description", "").strip()
        location = body.get("location", "").strip()
        date = body.get("date", "").strip()
        file_type = body.get("fileType", "image/jpeg").strip()

        if item_type not in ["lost", "found"]:
            return response(400, {"error": "Field 'type' must be either 'lost' or 'found'"})

        if not title or not location:
            return response(400, {"error": "Missing required fields: title, location"})

        # Prevent HEIC images which AWS Rekognition cannot parse
        if "heic" in file_type.lower():
            return response(400, {"error": "HEIC format is not supported by image recognition. Please upload JPEG or PNG."})

        # 3. Generate unique item ID and S3 key
        item_id = str(uuid.uuid4())
        extension = "png" if "png" in file_type else "jpg"
        s3_key = f"uploads/{item_id}.{extension}"
        bucket_to_use = os.environ.get("S3_BUCKET_NAME", BUCKET_NAME)

        # 4. Generate Pre-signed S3 PUT URL (valid for 10 minutes)
        presigned_url = s3_client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": bucket_to_use,
                "Key": s3_key,
                "ContentType": file_type
            },
            ExpiresIn=600  # 10 minutes
        )

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
            "tags": [],  # Will be populated by Rekognition on upload
            "status": "open",
            "reportedBy": user_id,
            "userEmail": user_email,
            "createdAt": created_at
        }

        items_table.put_item(Item=item_record)

        return response(201, {
            "message": "Item report created! Please upload your photo to the pre-signed URL.",
            "item": item_record,
            "uploadUrl": presigned_url,
            "s3Key": s3_key
        })

    except Exception as e:
        print(f"Error in reportItem: {str(e)}")
        return response(500, {"error": "Failed to report item", "details": str(e)})
