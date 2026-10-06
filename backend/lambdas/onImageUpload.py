import json
import urllib.parse
import datetime
import boto3

REGION = "ap-southeast-2"
rekognition = boto3.client("rekognition", region_name=REGION)
dynamodb = boto3.resource("dynamodb", region_name=REGION)
items_table = dynamodb.Table("Nexus-Items")

def lambda_handler(event, context):
    """Triggered by S3 when a student uploads an item photo.
    Calls AWS Rekognition to detect labels and saves tags back to DynamoDB."""
    try:
        # Loop through S3 event records (usually 1)
        for record in event.get("Records", []):
            bucket_name = record["s3"]["bucket"]["name"]
            raw_key = record["s3"]["object"]["key"]
            # S3 keys in events are URL-encoded (e.g. spaces become +)
            s3_key = urllib.parse.unquote_plus(raw_key)

            # Skip folder creation markers (e.g. "uploads/") or non-image files
            if s3_key.endswith("/") or not any(s3_key.lower().endswith(ext) for ext in [".jpg", ".jpeg", ".png"]):
                print(f"Skipping non-image / directory marker: {s3_key}")
                continue

            print(f"Processing uploaded photo: s3://{bucket_name}/{s3_key}")

            # Extract itemId from s3 key: "uploads/<itemId>.<ext>"
            filename = s3_key.split("/")[-1]
            item_id = filename.rsplit(".", 1)[0]

            # Call AWS Rekognition DetectLabels API
            rekog_response = rekognition.detect_labels(
                Image={
                    "S3Object": {
                        "Bucket": bucket_name,
                        "Name": s3_key
                    }
                },
                MaxLabels=10,
                MinConfidence=70.0
            )

            # Extract detected label names in lowercase
            detected_labels = [label["Name"].lower() for label in rekog_response.get("Labels", [])]
            print(f"Rekognition detected tags for {item_id}: {detected_labels}")

            now = datetime.datetime.now(datetime.timezone.utc).isoformat()

            # Update DynamoDB item with detected tags
            # This write will automatically trigger DynamoDB Streams -> matchItems Lambda!
            items_table.update_item(
                Key={"itemId": item_id},
                UpdateExpression="SET tags = :tags, updatedAt = :updatedAt",
                ExpressionAttributeValues={
                    ":tags": detected_labels,
                    ":updatedAt": now
                }
            )

            print(f"Successfully tagged item {item_id} in DynamoDB.")

        return {"statusCode": 200, "body": "Image processed successfully"}

    except Exception as e:
        print(f"Error in onImageUpload: {str(e)}")
        raise e
