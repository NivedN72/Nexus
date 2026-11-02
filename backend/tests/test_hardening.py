"""Offline security and concurrency cases. All AWS and mail operations are mocked."""
import concurrent.futures
import copy
import io
import json
import threading
import types
import unittest
from unittest.mock import MagicMock, patch
from test_accounts import ClientError, FakeAWS, event, load


class ApiHardeningTests(unittest.TestCase):
    def setUp(self):
        self.aws = FakeAWS()

    def test_booking_rejects_past_missing_invalid_and_timezone_free_dates(self):
        handler = load("bookEvent", self.aws)
        for date in ("2000-01-01T00:00:00Z", None, "invalid", "2099-01-01T00:00:00"):
            self.aws.events["event"]["date"] = date
            self.assertEqual(handler.lambda_handler(event(), None)["statusCode"], 409)
        self.assertFalse(self.aws.bookings)
        self.assertEqual(self.aws.events["event"]["seatsBooked"], 0)

    def test_booking_accepts_equivalent_timezone_offset(self):
        self.aws.events["event"]["date"] = "2099-01-01T05:30:00+05:30"
        self.assertEqual(load("bookEvent", self.aws).lambda_handler(event(), None)["statusCode"], 201)

    def test_date_edited_during_reservation_prevents_stale_booking(self):
        handler = load("bookEvent", self.aws)
        def change_date(*_):
            self.aws.events["event"]["date"] = "2000-01-01T00:00:00Z"
            return False
        handler.legacy_booking_exists = change_date
        self.assertEqual(handler.lambda_handler(event(), None)["statusCode"], 409)
        self.assertFalse(self.aws.bookings)

    def test_event_expiring_during_legacy_lookup_is_rejected(self):
        import datetime
        handler = load("bookEvent", self.aws)
        self.aws.events["event"]["date"] = "2099-01-01T00:00:00Z"
        clock = types.SimpleNamespace(datetime=types.SimpleNamespace(
            fromisoformat=datetime.datetime.fromisoformat,
            now=MagicMock(side_effect=[datetime.datetime(2098, 12, 31, tzinfo=datetime.timezone.utc),
                                       datetime.datetime(2098, 12, 31, tzinfo=datetime.timezone.utc),
                                       datetime.datetime(2099, 1, 1, tzinfo=datetime.timezone.utc)])),
            timezone=datetime.timezone)
        with patch.object(handler, "datetime", clock):
            self.assertEqual(handler.lambda_handler(event(), None)["statusCode"], 409)
        self.assertFalse(self.aws.bookings)

    def test_gallery_excludes_private_and_future_internal_fields(self):
        handler = load("getItems", self.aws)
        row = {"itemId": "item", "title": "Bag", "tags": ["bag"], "status": "open",
               "userEmail": "private@example.com", "reportedBy": "private-sub", "internalSecret": "private"}
        handler.items_table = types.SimpleNamespace(scan=lambda **_: {"Items": [row]})
        result = json.loads(handler.lambda_handler(event(groups=["students"]), None)["body"])
        self.assertEqual(result["items"], [{k: row[k] for k in ("itemId", "title", "tags", "status")}])

    def test_pending_or_rejected_photos_never_get_signed(self):
        handler = load("getItems", self.aws)
        handler.s3_client = MagicMock()
        rows = [{"imageUrl": "uploads/photo.jpg", "uploadStatus": status} for status in ("pending", "rejected", "none")]
        result = json.loads(handler.items_response(rows)["body"])
        self.assertTrue(all("imageUrl" not in item for item in result["items"]))
        handler.s3_client.generate_presigned_url.assert_not_called()

    def test_provider_exception_details_are_not_returned(self):
        for name in ("getEvents", "getItems", "getBookings", "createEvent", "reportItem"):
            handler = load(name, self.aws)
            failure = MagicMock()
            for operation in ("scan", "query", "put_item", "generate_presigned_post"):
                getattr(failure, operation).side_effect = RuntimeError("PRIVATE_PROVIDER_MESSAGE")
            request = event(groups=["admins", "students"], body={"type": "lost", "title": "Bag", "location": "Hall", "venue": "Hall", "date": "2099-01-01T00:00:00Z", "totalSeats": 10})
            handler.table = failure
            handler.items_table = failure
            handler.bookings_table = failure
            handler.s3_client = failure
            result = handler.lambda_handler(request, None)
            self.assertEqual(result["statusCode"], 500, name)
            self.assertNotIn("PRIVATE_PROVIDER_MESSAGE", result["body"])
            self.assertNotIn("details", json.loads(result["body"]))

    def report_handler(self):
        handler = load("reportItem", self.aws)
        handler.items_table = MagicMock()
        handler.s3_client = MagicMock()
        handler.s3_client.generate_presigned_post.return_value = {"url": "https://bucket.example", "fields": {"key": "photo"}}
        return handler

    def test_upload_policy_enforces_type_and_maximum_bytes(self):
        handler = self.report_handler()
        for kind in ("image/jpeg", "image/png"):
            result = handler.lambda_handler(event(groups=["students"], body={"type": "lost", "title": "Bag", "location": "Hall", "fileType": kind, "fileSize": 123}), None)
            self.assertEqual(result["statusCode"], 201)
            policy = handler.s3_client.generate_presigned_post.call_args.kwargs
            self.assertIn(["content-length-range", 1, 5 * 1024 * 1024], policy["Conditions"])
            self.assertIn({"Content-Type": kind}, policy["Conditions"])
            self.assertEqual(policy["Fields"]["Content-Type"], kind)
            self.assertEqual(json.loads(result["body"])["item"]["uploadStatus"], "pending")

    def test_invalid_reports_do_not_write_or_issue_upload_permissions(self):
        handler = self.report_handler()
        base = {"type": "lost", "title": "Bag", "location": "Hall", "fileType": "image/jpeg", "fileSize": 123}
        bad = [{"fileType": "image/svg+xml"}, {"fileType": "text/html"}, {"fileType": "image/heic"},
               {"fileSize": 5242881}, {"fileSize": 0}, {"fileSize": True}, {"fileSize": "123"},
               {"fileSize": None}, {"title": []}, {"title": "x" * 161}, {"location": "x" * 201},
               {"description": "x" * 2001}, {"type": "other"}]
        for change in bad:
            self.assertEqual(handler.lambda_handler(event(groups=["students"], body={**base, **change}), None)["statusCode"], 400)
        for raw in ("[]", "{", "null", "x" * 16385):
            request = event(groups=["students"]); request["body"] = raw
            self.assertEqual(handler.lambda_handler(request, None)["statusCode"], 400)
        handler.items_table.put_item.assert_not_called()
        handler.s3_client.generate_presigned_post.assert_not_called()

    def test_report_without_photo_still_works(self):
        handler = self.report_handler()
        result = handler.lambda_handler(event(groups=["students"], body={"type": "found", "title": "Keys", "location": "Hall"}), None)
        self.assertEqual(result["statusCode"], 201)
        self.assertIsNone(json.loads(result["body"])["upload"])
        handler.s3_client.generate_presigned_post.assert_not_called()

    def test_admin_event_inputs_are_validated(self):
        handler = load("createEvent", self.aws); handler.table = MagicMock()
        base = {"title": "Event", "venue": "Hall", "date": "2099-01-01T05:30:00+05:30", "totalSeats": 10}
        for change in ({"date": "2000-01-01T00:00:00Z"}, {"date": "invalid"}, {"date": "2099-01-01"},
                       {"totalSeats": True}, {"totalSeats": 1.5}, {"totalSeats": 100001}, {"title": []}):
            self.assertEqual(handler.lambda_handler(event(groups=["admins"], body={**base, **change}), None)["statusCode"], 400)
        handler.table.put_item.assert_not_called()
        result = handler.lambda_handler(event(groups=["admins"], body=base), None)
        self.assertEqual(result["statusCode"], 201)
        self.assertEqual(json.loads(result["body"])["event"]["date"], "2099-01-01T00:00:00+00:00")


class MatchingStore:
    def __init__(self):
        self.rows = {name: {"itemId": name, "type": kind, "status": "open", "tags": ["bag"]}
                     for name, kind in (("lost-a", "lost"), ("lost-b", "lost"), ("found", "found"))}
        self.lock = threading.Lock()
        self.barrier = None
        self.failure = None

    def get_item(self, Key, **_):
        with self.lock:
            return {"Item": copy.deepcopy(self.rows.get(Key["itemId"]))}

    def query(self, **_):
        with self.lock:
            rows = copy.deepcopy(list(self.rows.values()))
        if self.barrier:
            self.barrier.wait(timeout=5)
        return {"Items": rows}

    def transact_write_items(self, TransactItems):
        with self.lock:
            if self.failure:
                raise self.failure
            for operation in TransactItems:
                update = operation["Update"]
                self_id = update["Key"]["itemId"]["S"]
                row = self.rows.get(self_id)
                values = update["ExpressionAttributeValues"]
                stale = row and (row["type"] != values[":type"]["S"] or str(row["tags"]) != values[":tags"]["S"])
                if not row or stale or row["status"] != "open" or "matchedWithItemId" in row:
                    raise ClientError({"Error": {"Code": "TransactionCanceledException"}, "CancellationReasons": [{"Code": "ConditionalCheckFailed"}]}, "TransactWriteItems")
                assert "tags = :tags" in update["ConditionExpression"]
                assert "attribute_not_exists(matchedWithItemId)" in update["ConditionExpression"]
            for operation in TransactItems:
                update = operation["Update"]
                row = self.rows[update["Key"]["itemId"]["S"]]
                row.update(status="matched", matchedWithItemId=update["ExpressionAttributeValues"][":partner"]["S"])


class MatchingTests(unittest.TestCase):
    def setUp(self):
        self.handler = load("matchItems", FakeAWS())
        self.store = MatchingStore()
        self.handler.items_table = self.store
        self.handler.transaction_client = self.store
        self.handler.notify_match = MagicMock()
        class Expression:
            def eq(self, value): return self
            def __and__(self, other): return self
        self.handler.Key = lambda _: Expression()

    def test_concurrent_matches_claim_candidate_once_and_cross_link_consistently(self):
        self.store.barrier = threading.Barrier(2)
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(self.handler.match_item, ["lost-a", "lost-b"]))
        self.assertEqual(results.count(True), 1)
        partner = self.store.rows["found"]["matchedWithItemId"]
        self.assertEqual(self.store.rows[partner]["matchedWithItemId"], "found")
        self.assertEqual(sum(row["status"] == "matched" for row in self.store.rows.values()), 2)
        self.handler.notify_match.assert_called_once()

    def test_replayed_record_does_not_send_another_notification(self):
        self.assertTrue(self.handler.match_item("lost-a"))
        self.assertFalse(self.handler.match_item("lost-a"))
        self.handler.notify_match.assert_called_once()

    def test_failed_transaction_changes_neither_report_and_never_notifies(self):
        before = copy.deepcopy(self.store.rows)
        self.store.failure = ClientError({"Error": {"Code": "ProvisionedThroughputExceededException"}}, "TransactWriteItems")
        with self.assertRaises(ClientError): self.handler.match_item("lost-a")
        self.assertEqual(self.store.rows, before)
        self.handler.notify_match.assert_not_called()

    def test_deleted_candidate_cannot_be_recreated_by_a_stale_index(self):
        rows = copy.deepcopy(list(self.store.rows.values()))
        del self.store.rows["found"]
        self.store.query = lambda **_: {"Items": rows}
        self.assertFalse(self.handler.match_item("lost-a"))
        self.assertNotIn("found", self.store.rows)
        self.handler.notify_match.assert_not_called()

    def test_changed_tags_cannot_be_matched_from_stale_index_data(self):
        stale = copy.deepcopy(self.store.rows["found"])
        def query(**_):
            self.store.rows["found"]["tags"] = ["bottle"]
            return {"Items": [stale]}
        self.store.query = query
        self.assertFalse(self.handler.match_item("lost-a"))
        self.assertTrue(all(row["status"] == "open" for row in self.store.rows.values()))
        self.handler.notify_match.assert_not_called()

    def test_matching_continues_to_next_candidate_page(self):
        self.store.query = MagicMock(side_effect=[{"Items": [], "LastEvaluatedKey": {"itemId": "cursor"}}, {"Items": [self.store.rows["found"]]}])
        self.assertTrue(self.handler.match_item("lost-a"))
        self.assertEqual(self.store.query.call_args.kwargs["ExclusiveStartKey"], {"itemId": "cursor"})


class PhotoProcessingTests(unittest.TestCase):
    def setUp(self):
        self.handler = load("onImageUpload", FakeAWS())
        self.handler.items_table = MagicMock()
        self.handler.items_table.get_item.return_value = {"Item": {"itemId": "item", "status": "open", "imageUrl": "uploads/item.jpg"}}
        self.handler.s3_client = MagicMock()
        self.handler.s3_client.head_object.return_value = {"ContentLength": 123, "ContentType": "image/jpeg", "ETag": "one"}
        self.handler.s3_client.get_object.side_effect = lambda **_: {"Body": io.BytesIO(b"\xff\xd8\xffimage")}
        self.handler.rekognition = MagicMock()
        self.handler.rekognition.detect_labels.return_value = {"Labels": [{"Name": "Bag"}]}

    def process(self):
        self.handler.process_photo(self.handler.BUCKET_NAME, "uploads/item.jpg")

    def test_valid_image_gets_tags_with_conditional_existing_report_update(self):
        self.process()
        update = self.handler.items_table.update_item.call_args.kwargs
        self.assertEqual(update["ExpressionAttributeValues"][":tags"], ["bag"])
        self.assertEqual(update["ExpressionAttributeValues"][":state"], "ready")
        self.assertIn("attribute_exists(itemId)", update["ConditionExpression"])
        self.handler.rekognition.detect_labels.assert_called_once()

    def test_size_type_and_signature_failures_skip_recognition_and_reject_photo(self):
        for override, prefix in (({"ContentLength": 5242881}, b""), ({"ContentType": "text/html"}, b""), ({}, b"<html>")):
            with self.subTest(override=override):
                self.setUp()
                self.handler.s3_client.head_object.return_value.update(override)
                self.handler.s3_client.get_object.return_value = {"Body": io.BytesIO(prefix)}
                self.handler.s3_client.get_object.side_effect = None
                self.process()
                self.handler.rekognition.detect_labels.assert_not_called()
                self.assertEqual(self.handler.items_table.update_item.call_args.kwargs["ExpressionAttributeValues"][":state"], "rejected")

    def test_missing_matched_and_duplicate_reports_are_ignored(self):
        for item in (None, {"status": "matched"}, {"status": "open", "imageUrl": "uploads/item.jpg", "processedETag": "one"}):
            self.handler.items_table.get_item.return_value = {"Item": item}
            self.process()
        self.handler.rekognition.detect_labels.assert_not_called()
        self.handler.items_table.update_item.assert_not_called()

    def test_changed_object_does_not_commit_tags(self):
        self.handler.s3_client.head_object.side_effect = [self.handler.s3_client.head_object.return_value, {"ETag": "replacement"}]
        self.process()
        self.handler.items_table.update_item.assert_not_called()

    def test_recognition_rejecting_invalid_bytes_does_not_retry_forever(self):
        self.handler.rekognition.detect_labels.side_effect = ClientError({"Error": {"Code": "InvalidImageFormatException"}}, "DetectLabels")
        self.process()
        self.assertEqual(self.handler.items_table.update_item.call_args.kwargs["ExpressionAttributeValues"][":state"], "rejected")

    def test_unknown_bucket_and_paths_do_not_touch_aws(self):
        self.handler.process_photo("other-bucket", "uploads/item.jpg")
        self.handler.process_photo(self.handler.BUCKET_NAME, "elsewhere/item.jpg")
        self.handler.process_photo(self.handler.BUCKET_NAME, "uploads/sub/item.jpg")
        self.handler.items_table.get_item.assert_not_called()


if __name__ == "__main__":
    unittest.main()
