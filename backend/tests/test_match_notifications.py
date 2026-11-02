"""Offline notification tests. No AWS clients or real emails are used."""
import ast
import os
from pathlib import Path
import smtplib
import ssl
from email.message import EmailMessage
import unittest
from unittest.mock import MagicMock, patch

SOURCE = Path(__file__).resolve().parents[1] / "lambdas" / "matchItems.py"
namespace = {"os": os, "smtplib": smtplib, "ssl": ssl, "EmailMessage": EmailMessage}
node = next(n for n in ast.parse(SOURCE.read_text(encoding="utf-8")).body
            if isinstance(n, ast.FunctionDef) and n.name == "notify_match")
exec(compile(ast.Module(body=[node], type_ignores=[]), str(SOURCE), "exec"), namespace)
notify_match = namespace["notify_match"]

class MatchNotificationTests(unittest.TestCase):
    def setUp(self):
        self.lost = {"itemId": "lost-id", "type": "lost", "title": "My backpack",
                     "userEmail": "owner@example.com", "location": "Library"}
        self.found = {"itemId": "found-id", "type": "found", "title": "Found bag",
                      "userEmail": "finder@example.com", "location": "Hall"}
        self.env = patch.dict(os.environ, {"SMTP_USER": "sender@example.com", "SMTP_PASS": "test-only"}, clear=True)
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_both_receive_separate_role_specific_emails_regardless_of_order(self):
        for first, second in ((self.lost, self.found), (self.found, self.lost)):
            with patch.object(smtplib, "SMTP_SSL") as smtp:
                result = notify_match(first, second, ["bag"])
                messages = [c.args[0] for c in smtp.return_value.__enter__.return_value.send_message.call_args_list]
                self.assertEqual(result, {"sent": 2, "failed": 0})
                by_recipient = {m["To"]: m.get_content() for m in messages}
                self.assertIn("item you lost", by_recipient["owner@example.com"])
                self.assertIn("item you found", by_recipient["finder@example.com"])
                self.assertNotIn("finder@example.com", by_recipient["owner@example.com"])
                self.assertNotIn("owner@example.com", by_recipient["finder@example.com"])

    def test_failure_for_first_recipient_does_not_skip_second(self):
        working = MagicMock()
        with patch.object(smtplib, "SMTP_SSL", side_effect=[TimeoutError(), working]):
            self.assertEqual(notify_match(self.lost, self.found, ["bag"]), {"sent": 1, "failed": 1})
            self.assertEqual(working.__enter__.return_value.send_message.call_args.args[0]["To"], "finder@example.com")

    def test_same_email_only_receives_one_message(self):
        self.found["userEmail"] = "OWNER@example.com"
        with patch.object(smtplib, "SMTP_SSL") as smtp:
            self.assertEqual(notify_match(self.lost, self.found, ["bag"])["sent"], 1)
            self.assertEqual(smtp.call_count, 1)

    def test_missing_configuration_does_not_connect(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(smtplib, "SMTP_SSL") as smtp:
            self.assertTrue(notify_match(self.lost, self.found, ["bag"])["unavailable"])
            smtp.assert_not_called()

    def test_missing_or_unsafe_recipient_does_not_block_valid_recipient(self):
        for value in (None, "bad@example.com\nBcc: other@example.com"):
            self.lost["userEmail"] = value
            with patch.object(smtplib, "SMTP_SSL") as smtp:
                self.assertEqual(notify_match(self.lost, self.found, ["bag"])["sent"], 1)
                self.assertEqual(smtp.return_value.__enter__.return_value.send_message.call_args.args[0]["To"], "finder@example.com")

if __name__ == "__main__":
    unittest.main()
