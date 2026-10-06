import json
import os
import boto3
from boto3.dynamodb.conditions import Key

REGION = "ap-southeast-2"
SNS_TOPIC_ARN = os.environ.get("SNS_TOPIC_ARN", "")

dynamodb = boto3.resource("dynamodb", region_name=REGION)
items_table = dynamodb.Table("Nexus-Items")
sns_client = boto3.client("sns", region_name=REGION)

def unmarshal_ddb_item(raw_ddb_dict):
    """Converts DynamoDB Stream low-level format to regular Python dict"""
    deserializer = boto3.dynamodb.types.TypeDeserializer()
    return {k: deserializer.deserialize(v) for k, v in raw_ddb_dict.items()}

def notify_match(item_a, item_b, common_tags):
    """Sends notification via SNS email if configured"""
    subject = f"Nexus Alert: Potential Match Found for Your {item_a.get('title', 'Item')}!"
    message = (
        f"Hello from Nexus Campus Platform!\n\n"
        f"Our AI auto-matching system has detected a high-probability match between two reported items.\n\n"
        f"Item 1 ({item_a.get('type').upper()}):\n"
        f"  - Title: {item_a.get('title')}\n"
        f"  - Location: {item_a.get('location')}\n"
        f"  - Reported By: {item_a.get('userEmail')}\n\n"
        f"Item 2 ({item_b.get('type').upper()}):\n"
        f"  - Title: {item_b.get('title')}\n"
        f"  - Location: {item_b.get('location')}\n"
        f"  - Reported By: {item_b.get('userEmail')}\n\n"
        f"Common AI Tags Detected by AWS Rekognition: {', '.join(common_tags)}\n\n"
        f"Please check the Nexus portal to verify and claim your item!\n"
    )

    print(f"MATCH FOUND: {item_a['itemId']} <--> {item_b['itemId']}")
    print(f"Common tags: {common_tags}")

    if SNS_TOPIC_ARN:
        try:
            sns_client.publish(
                TopicArn=SNS_TOPIC_ARN,
                Subject=subject,
                Message=message
            )
            print(f"Notification published to SNS topic {SNS_TOPIC_ARN}")
        except Exception as e:
            print(f"Error sending SNS notification: {str(e)}")
    else:
        print("SNS_TOPIC_ARN not set. Match logged to CloudWatch (configure SNS topic to enable email alerts).")

def lambda_handler(event, context):
    """Triggered by DynamoDB Streams whenever an item is added or updated with tags."""
    try:
        for record in event.get("Records", []):
            event_name = record.get("eventName")  # INSERT or MODIFY
            if event_name not in ["INSERT", "MODIFY"]:
                continue

            new_image_raw = record.get("dynamodb", {}).get("NewImage")
            if not new_image_raw:
                continue

            current_item = unmarshal_ddb_item(new_image_raw)
            current_id = current_item.get("itemId")
            current_type = current_item.get("type")
            current_tags = current_item.get("tags") or []
            current_status = current_item.get("status")

            # Only check for matches if item is open and has at least one tag
            if current_status != "open" or not current_tags:
                continue

            # Determine opposite type to search for
            target_type = "found" if current_type == "lost" else "lost"

            # Query GSI type-status-index for open candidates of opposite type
            res = items_table.query(
                IndexName="type-status-index",
                KeyConditionExpression=Key("type").eq(target_type) & Key("status").eq("open")
            )
            candidates = res.get("Items", [])

            for candidate in candidates:
                cand_id = candidate.get("itemId")
                if cand_id == current_id:
                    continue

                cand_tags = candidate.get("tags") or []
                if not cand_tags:
                    continue

                # Calculate tag intersection
                common = list(set(current_tags).intersection(set(cand_tags)))

                # If 1 or more common tags match
                if len(common) >= 1:
                    # Update both items to 'matched' to prevent duplicate notifications
                    try:
                        items_table.update_item(
                            Key={"itemId": current_id},
                            UpdateExpression="SET #s = :matched, matchedWithItemId = :candId",
                            ExpressionAttributeNames={"#s": "status"},
                            ExpressionAttributeValues={":matched": "matched", ":candId": cand_id}
                        )
                        items_table.update_item(
                            Key={"itemId": cand_id},
                            UpdateExpression="SET #s = :matched, matchedWithItemId = :curId",
                            ExpressionAttributeNames={"#s": "status"},
                            ExpressionAttributeValues={":matched": "matched", ":curId": current_id}
                        )
                    except Exception as err:
                        print(f"Error marking items as matched: {str(err)}")

                    # Trigger email notification
                    notify_match(current_item, candidate, common)
                    break

        return {"statusCode": 200, "body": "Stream processed"}

    except Exception as e:
        print(f"Error in matchItems: {str(e)}")
        raise e
