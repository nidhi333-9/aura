"""Tests for the sensor's website detection. Run from this folder:  python -m unittest test_sensor -v

No browser is involved: `osascript` is replaced by a fake that returns what a browser would.
"""
import subprocess
import unittest
from unittest import mock

import sensor


def fake_run(stdout="", stderr="", returncode=0):
    return mock.Mock(return_value=subprocess.CompletedProcess(["osascript"], returncode, stdout, stderr))


class DomainFromAddress(unittest.TestCase):
    def test_keeps_only_the_host_name(self):
        cases = {
            "https://www.linkedin.com/in/someone?tab=1#top": "linkedin.com",
            "http://example.org/a/b/c?token=secret": "example.org",
            "https://docs.google.com/document/d/abc/edit": "docs.google.com",
            "https://user:password@example.com:8443/x": "example.com",
            "https://Example.COM./": "example.com",
            "http://localhost:5173/dashboard": "localhost",
            "http://192.168.0.10:8080/": "192.168.0.10",
        }
        for address, expected in cases.items():
            with self.subTest(address=address):
                self.assertEqual(sensor.domain_from_address(address), expected)

    def test_nothing_private_survives(self):
        host = sensor.domain_from_address("https://example.com/reset?token=abc123&email=me@x.com#frag")
        for secret in ("abc123", "token", "me@x.com", "frag", "reset", "/"):
            self.assertNotIn(secret, host)

    def test_pages_without_a_site_have_no_domain(self):
        for address in (
            "chrome://newtab/",
            "about:blank",
            "file:///Users/me/secret.pdf",
            "view-source:https://example.com",
            "javascript:alert(1)",
            "https://",
            "",
            None,
            "   ",
            "http://[::1",  # malformed: must not raise
        ):
            with self.subTest(address=address):
                self.assertIsNone(sensor.domain_from_address(address))


class ReadTabAddress(unittest.TestCase):
    def setUp(self):
        sensor._ask_again_after.clear()
        sensor._hint_shown.clear()
        darwin = mock.patch.object(sensor.platform, "system", return_value="Darwin")
        darwin.start()
        self.addCleanup(darwin.stop)

    def test_reads_the_front_tab_of_a_chromium_browser(self):
        run = fake_run("https://github.com/nidhi333-9/aura\nnormal\n")
        with mock.patch.object(sensor.subprocess, "run", run):
            self.assertEqual(sensor.get_domain("Google Chrome"), "github.com")
        script = run.call_args.args[0][2]
        self.assertIn('application "Google Chrome"', script)

    def test_each_browser_is_asked_by_its_own_name(self):
        for app in ("Brave Browser", "Microsoft Edge", "Arc"):
            run = fake_run("https://example.com/\nnormal\n")
            with mock.patch.object(sensor.subprocess, "run", run):
                sensor.get_domain(app)
            self.assertIn(f'application "{app}"', run.call_args.args[0][2])

    def test_safari_returns_a_single_line(self):
        with mock.patch.object(sensor.subprocess, "run", fake_run("https://www.reddit.com/r/python\n")):
            self.assertEqual(sensor.get_domain("Safari"), "reddit.com")

    def test_private_windows_are_skipped(self):
        with mock.patch.object(sensor.subprocess, "run", fake_run("https://example.com/\nincognito\n")):
            self.assertIsNone(sensor.get_domain("Google Chrome"))

    def test_apps_that_are_not_scriptable_browsers_are_never_asked(self):
        run = fake_run("https://example.com/\nnormal\n")
        with mock.patch.object(sensor.subprocess, "run", run):
            for app in ("Firefox", "Terminal", "Code", "Unknown", "chrome.exe"):
                self.assertIsNone(sensor.get_domain(app))
        run.assert_not_called()

    def test_other_systems_are_never_asked(self):
        run = fake_run("https://example.com/\nnormal\n")
        with mock.patch.object(sensor.platform, "system", return_value="Windows"), mock.patch.object(
            sensor.subprocess, "run", run
        ):
            self.assertIsNone(sensor.get_domain("Google Chrome"))
        run.assert_not_called()

    def test_a_browser_with_no_window_or_not_running_gives_nothing(self):
        for result in (
            fake_run(stdout=""),  # not running: the script prints nothing
            fake_run(stderr="execution error: Can't get window 1. (-1728)", returncode=1),
        ):
            with mock.patch.object(sensor.subprocess, "run", result):
                self.assertIsNone(sensor.get_domain("Google Chrome"))

    def test_osascript_failing_to_start_or_hanging_gives_nothing(self):
        for error in (OSError("no osascript"), subprocess.TimeoutExpired("osascript", 3)):
            with mock.patch.object(sensor.subprocess, "run", mock.Mock(side_effect=error)):
                self.assertIsNone(sensor.get_domain("Google Chrome"))

    def test_refused_permission_explains_itself_once_and_backs_off(self):
        refused = fake_run(stderr="Not authorized to send Apple events to Google Chrome. (-1743)", returncode=1)
        with mock.patch.object(sensor.subprocess, "run", refused), mock.patch("builtins.print") as printed:
            self.assertIsNone(sensor.get_domain("Google Chrome"))
            self.assertIsNone(sensor.get_domain("Google Chrome"))
            self.assertIsNone(sensor.get_domain("Google Chrome"))
        self.assertEqual(refused.call_count, 1, "must not hammer a refusing browser every sample")
        self.assertTrue(any("Automation" in str(c.args[0]) for c in printed.call_args_list))
        explanations = [c for c in printed.call_args_list if "didn't let Aura" in str(c.args[0])]
        self.assertEqual(len(explanations), 1, "the hint must be shown once")

    def test_it_asks_again_later_so_granting_permission_later_works(self):
        refused = fake_run(stderr="(-1743)", returncode=1)
        allowed = fake_run("https://example.com/\nnormal\n")
        with mock.patch("builtins.print"):
            with mock.patch.object(sensor.subprocess, "run", refused):
                self.assertIsNone(sensor.get_domain("Google Chrome"))
            later = sensor.time.monotonic() + sensor.AUTOMATION_RETRY_SECONDS + 1
            with mock.patch.object(sensor.time, "monotonic", return_value=later), mock.patch.object(
                sensor.subprocess, "run", allowed
            ):
                self.assertEqual(sensor.get_domain("Google Chrome"), "example.com")


class Scripts(unittest.TestCase):
    def test_every_script_names_a_real_form(self):
        # The names must match what macOS reports for the app, or `tell application` fails.
        self.assertEqual(
            set(sensor.MAC_BROWSER_SCRIPTS),
            {"Google Chrome", "Brave Browser", "Microsoft Edge", "Chromium", "Vivaldi", "Arc", "Opera", "Safari"},
        )
        for app, script in sensor.MAC_BROWSER_SCRIPTS.items():
            self.assertIn("is running", script, f"{app}: must not launch a browser that isn't running")


if __name__ == "__main__":
    unittest.main()
