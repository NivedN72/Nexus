import datetime
import os
import urllib.parse
import boto3
from botocore.exceptions import ClientError

REGION = "ap-southeast-2"
BUCKET_NAME = os.environ.get("S3_BUCKET_NAME", "nexus-item-photos-nived2026")
MAX_PHOTO_BYTES = 5 * 1024 * 1024
rekognition = boto3.client("rekognition", region_name=REGION)
s3_client = boto3.client("s3", region_name=REGION)
dynamodb = boto3.resource("dynamodb", region_name=REGION)
items_table = dynamodb.Table("Nexus-Items")


def process_photo(bucket, key):
    if bucket != BUCKET_NAME or not key.startswith("uploads/") or key.count("/") != 1:
        return
    extension = key.rsplit(".", 1)[-1].lower()
    if extension not in ("jpg", "jpeg", "png"):
        return
    item_id = key.split("/")[-1].rsplit(".", 1)[0]
    item = items_table.get_item(Key={"itemId": item_id}, ConsistentRead=True).get("Item")
    if not item or item.get("status") != "open" or item.get("imageUrl") != key:
        return
    # Lock analysis to the inspected object. Replaced files must not inherit its validation.
    head = s3_client.head_object(Bucket=bucket, Key=key)
    etag = head["ETag"]
    if item.get("processedETag") == etag:
        return
    expected_type = "image/png" if extension == "png" else "image/jpeg"
    valid = (0 < head.get("ContentLength", 0) <= MAX_PHOTO_BYTES
             and head.get("ContentType") == expected_type)
    if valid:
        obj = s3_client.get_object(Bucket=bucket, Key=key, Range="bytes=0-11", IfMatch=etag)
        try:
            prefix = obj["Body"].read(12)
        finally:
            obj["Body"].close()
        valid = (prefix.startswith(b"\x89PNG\r\n\x1a\n") if extension == "png"
                 else prefix.startswith(b"\xff\xd8\xff"))
    labels = None
    if valid:
        image = {"Bucket": bucket, "Name": key}
        if head.get("VersionId"):
            image["Version"] = head["VersionId"]
        try:
            result = rekognition.detect_labels(Image={"S3Object": image}, MaxLabels=10, MinConfidence=70.0)
            labels = [label["Name"].lower() for label in result.get("Labels", [])]
        except ClientError as error:
            if error.response.get("Error", {}).get("Code") not in ("InvalidImageFormatException", "ImageTooLargeException"):
                raise
            valid = False
    # Recheck non-versioned objects after analysis. No tags are accepted for changed files.
    if s3_client.head_object(Bucket=bucket, Key=key)["ETag"] != etag:
        return
    values = {":open": "open", ":key": key, ":etag": etag,
              ":state": "ready" if valid else "rejected",
              ":time": datetime.datetime.now(datetime.timezone.utc).isoformat()}
    expression = "SET uploadStatus = :state, processedETag = :etag, updatedAt = :time"
    if valid:
        expression += ", tags = :tags"
        values[":tags"] = labels
    try:
        items_table.update_item(
            Key={"itemId": item_id}, UpdateExpression=expression,
            ConditionExpression=("attribute_exists(itemId) AND #s = :open AND imageUrl = :key "
                                 "AND (attribute_not_exists(processedETag) OR processedETag <> :etag)"),
            ExpressionAttributeNames={"#s": "status"}, ExpressionAttributeValues=values)
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
            raise


def lambda_handler(event, context):
    for record in event.get("Records", []):
        obj = record["s3"]
        process_photo(obj["bucket"]["name"], urllib.parse.unquote_plus(obj["object"]["key"]))
    return {"statusCode": 200, "body": "Image processed"}
