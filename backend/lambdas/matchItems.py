import json
import os
import smtplib
import ssl
from email.message import EmailMessage
import boto3
from boto3.dynamodb.conditions import Key
from boto3.dynamodb.types import TypeDeserializer, TypeSerializer
from botocore.exceptions import ClientError

REGION = "ap-southeast-2"

dynamodb = boto3.resource("dynamodb", region_name=REGION)
items_table = dynamodb.Table("Nexus-Items")
transaction_client = boto3.client("dynamodb", region_name=REGION)
serializer = TypeSerializer()

def unmarshal_ddb_item(raw_ddb_dict):
    """Converts DynamoDB Stream low-level format to regular Python dict"""
    deserializer = TypeDeserializer()
    return {k: deserializer.deserialize(v) for k, v in raw_ddb_dict.items()}

def notify_match(item_a, item_b, common_tags):
    """Email each reporter directly, independently of SNS topic subscriptions."""
    sender = os.environ.get("SMTP_USER", "").strip()
    password = os.environ.get("SMTP_PASS", "")
    if not sender or not password:
        print("Match email unavailable: SMTP configuration missing")
        return {"sent": 0, "failed": 0, "unavailable": True}

    recipients = {}
    for item in (item_a, item_b):
        address = str(item.get("userEmail") or "").strip()
        if "@" in address and not any(c in address for c in "\r\n"):
            recipients.setdefault(address.casefold(), (address, item))
    result = {"sent": 0, "failed": 0}
    for address, own_item in recipients.values():
        other_item = item_b if own_item is item_a else item_a
        try:
            message = EmailMessage()
            message["From"] = sender
            message["To"] = address
            message["Subject"] = "Nexus: a possible Lost & Found match"
            action = ("A found report may match the item you lost."
                      if own_item.get("type") == "lost" else
                      "A lost report may match the item you found.")
            message.set_content(
                action + "\n\n"
                + f"Your report: {own_item.get('title', 'Untitled item')}\n"
                + f"Your report ID: {own_item.get('itemId', '')}\n\n"
                + f"Possible matching report: {other_item.get('title', 'Untitled item')}\n"
                + f"Location: {other_item.get('location', 'Not specified')}\n"
                + f"Matching report ID: {other_item.get('itemId', '')}\n"
                + f"Shared photo tags: {', '.join(sorted(common_tags))}\n\n"
                + "This is a possible match, not a confirmed identification. "
                + "Please sign in to Nexus and check Lost & Found to confirm.\n"
                + "https://production.d28l11brr2ks0t.amplifyapp.com\n"
            )
            with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=3,
                                  context=ssl.create_default_context()) as server:
                server.login(sender, password)
                server.send_message(message)
            result["sent"] += 1
        except Exception as error:
            # One failed recipient must not prevent notifying the other reporter.
            print("Match email failed:", type(error).__name__)
            result["failed"] += 1
    print("Match email results:", result)
    return result


def match_item(item_id):
    # Stream images can be stale. Conditions below arbitrate against current state.
    current = items_table.get_item(Key={"itemId": item_id}, ConsistentRead=True).get("Item")
    if not current or current.get("status") != "open" or current.get("type") not in ("lost", "found"):
        return False
    tags = current.get("tags")
    if not isinstance(tags, list) or not tags or not all(isinstance(tag, str) for tag in tags):
        return False
    opposite = "found" if current["type"] == "lost" else "lost"
    params = {"IndexName": "type-status-index",
              "KeyConditionExpression": Key("type").eq(opposite) & Key("status").eq("open")}
    while True:
        page = items_table.query(**params)
        for candidate in page.get("Items", []):
            if (candidate.get("itemId") == item_id or candidate.get("type") != opposite
                    or candidate.get("status") != "open"):
                continue
            candidate_tags = candidate.get("tags")
            if not isinstance(candidate_tags, list) or not all(isinstance(tag, str) for tag in candidate_tags):
                continue
            common = sorted(set(tags).intersection(candidate_tags))
            if not common:
                continue
            updates = []
            for item, partner in ((current, candidate), (candidate, current)):
                values = {":open": "open", ":matched": "matched", ":partner": partner["itemId"],
                          ":type": item["type"], ":tags": item["tags"]}
                updates.append({"Update": {
                    "TableName": "Nexus-Items", "Key": {"itemId": {"S": item["itemId"]}},
                    "UpdateExpression": "SET #s = :matched, matchedWithItemId = :partner",
                    "ConditionExpression": ("attribute_exists(itemId) AND #s = :open AND #t = :type "
                                            "AND tags = :tags AND attribute_not_exists(matchedWithItemId)"),
                    "ExpressionAttributeNames": {"#s": "status", "#t": "type"},
                    "ExpressionAttributeValues": {key: serializer.serialize(value) for key, value in values.items()}
                }})
            try:
                transaction_client.transact_write_items(TransactItems=updates)
            except ClientError as error:
                if (error.response.get("Error", {}).get("Code") == "TransactionCanceledException"
                        and any(reason.get("Code") == "ConditionalCheckFailed"
                                for reason in error.response.get("CancellationReasons", []))):
                    # Another execution claimed either report. Never notify for a failed claim.
                    continue
                raise
            notify_match(current, candidate, common)
            return True
        cursor = page.get("LastEvaluatedKey")
        if not cursor:
            return False
        params["ExclusiveStartKey"] = cursor


def lambda_handler(event, context):
    """Process only tagged reports; failed records retry through the stream mapping."""
    for record in event.get("Records", []):
        if record.get("eventName") not in ("INSERT", "MODIFY"):
            continue
        image = record.get("dynamodb", {}).get("NewImage")
        if not image:
            continue
        item = unmarshal_ddb_item(image)
        if item.get("itemId") and item.get("status") == "open" and item.get("tags"):
            match_item(item["itemId"])
    return {"statusCode": 200, "body": "Stream processed"}
