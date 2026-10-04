import json
import os
import platform
import subprocess
import sys
import time
from datetime import datetime, timezone
from urllib.parse import urlsplit

import pywinctl as pwc
import requests

# AURA_API_URL exists so the sensor can be pointed at a local backend while developing.
API_URL = os.environ.get("AURA_API_URL", "https://aura-backend-hmq3.onrender.com").rstrip("/")
DASHBOARD_URL = "https://aura-gamma-eight.vercel.app"

CONFIG_DIR = os.path.join(os.path.expanduser("~"), ".aura")
DEVICE_FILE = os.path.join(CONFIG_DIR, "device.json")
# Older versions kept a 7-day login token here. It is deleted once the sensor is paired.
LEGACY_TOKEN_FILE = os.path.join(os.path.expanduser("~"), ".aura_token")

SAMPLE_INTERVAL = 10  # seconds between samples
PAIR_ATTEMPTS = 3
PAIR_TIMEOUT = 30  # generous: a sleeping backend can take a while to answer the first request
PAIR_RETRY_DELAY = 5

EXIT_OK = 0
EXIT_PAIR_FAILED = 1
EXIT_NOT_PAIRED = 2
EXIT_REVOKED = 3


class PairingError(Exception):
    """Pairing can't succeed (bad/expired code, device limit, unreachable server)."""


# --- the device key ---------------------------------------------------------------------
# The sensor never holds your login. Pairing swaps a one-time code from the dashboard for a
# long-lived key that can only post activity, and that you can revoke from the dashboard.

def load_device_key():
    try:
        with open(DEVICE_FILE, "r") as f:
            data = json.load(f)
    except (OSError, ValueError):
        return None
    key = data.get("device_key")
    if not isinstance(key, str) or not key.startswith("adk_"):
        return None
    # A key belongs to the server that issued it. If the API address is overridden to
    # something else, don't hand the key to that server.
    if data.get("api_url") != API_URL:
        return None
    return key


def save_device_key(key):
    os.makedirs(CONFIG_DIR, mode=0o700, exist_ok=True)
    tmp = DEVICE_FILE + ".tmp"
    # Owner-only from the first byte (no moment where the file is world-readable).
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        json.dump({"device_key": key, "api_url": API_URL}, f)
    os.replace(tmp, DEVICE_FILE)


def forget_device_key():
    try:
        os.remove(DEVICE_FILE)
    except OSError:
        pass


def remove_legacy_token():
    try:
        os.remove(LEGACY_TOKEN_FILE)
    except OSError:
        pass


# --- pairing ----------------------------------------------------------------------------

def prompt_code():
    """Ask for the pairing code. Works even when the installer piped its script into the shell
    (stdin is then not the keyboard), by talking to the terminal directly."""
    message = f"Enter the pairing code from {DASHBOARD_URL} (Connect a sensor): "
    try:
        if sys.stdin is not None and sys.stdin.isatty():
            return input(message).strip()
        with open("/dev/tty", "r+") as tty:  # not available on Windows or without a terminal
            tty.write(message)
            tty.flush()
            return tty.readline().strip()
    except (EOFError, OSError):
        return None


def pair(code):
    """Exchange a one-time code for a device key. Raises PairingError."""
    payload = {
        "code": code,
        "name": platform.node() or "Unnamed device",
        "os": f"{platform.system()} {platform.release()}".strip(),
    }
    last_problem = "could not reach Aura"
    for attempt in range(1, PAIR_ATTEMPTS + 1):
        try:
            res = requests.post(f"{API_URL}/api/devices/pair", json=payload, timeout=PAIR_TIMEOUT)
        except requests.exceptions.RequestException as e:
            last_problem = f"could not reach Aura ({type(e).__name__})"
        else:
            if res.status_code == 200:
                try:
                    key = res.json().get("device_key")
                except ValueError:
                    key = None
                if key:
                    return key
                raise PairingError("Aura answered, but not with a device key. Is the app up to date?")
            if 400 <= res.status_code < 500:
                # The code is wrong/expired, or the account is at its device limit: retrying
                # the same request can't help.
                try:
                    reason = res.json().get("error")
                except ValueError:
                    reason = None
                raise PairingError(reason or f"Aura refused the request (HTTP {res.status_code}).")
            last_problem = f"Aura answered with HTTP {res.status_code}"

        if attempt < PAIR_ATTEMPTS:
            print(f"⚠️ {last_problem}. Retrying in {PAIR_RETRY_DELAY}s ({attempt}/{PAIR_ATTEMPTS})...")
            time.sleep(PAIR_RETRY_DELAY)

    raise PairingError(f"Couldn't pair: {last_problem}. Check your connection and run the command again.")


def ensure_device_key():
    """The saved key, or pair now. Returns None if there is no key and no code to pair with."""
    key = load_device_key()
    if key:
        print("✅ Device key loaded.")
        return key

    code = os.environ.get("AURA_PAIR_CODE", "").strip() or prompt_code()
    if not code:
        print("🔐 This sensor isn't paired with an account yet.")
        print(f"   Open {DASHBOARD_URL}, sign in, and copy the install command from 'Connect a sensor'.")
        print("   It contains a one-time pairing code (valid for 10 minutes).")
        return None

    print("🔗 Pairing this device...")
    key = pair(code)  # may raise PairingError
    save_device_key(key)
    remove_legacy_token()
    print("✅ Paired! This device now appears in your dashboard under 'Your devices'.")
    return key


# --- which website a browser is on ------------------------------------------------------
# A window title doesn't always name the site (a ChatGPT chat is just called "Fix Port Conflict").
# On macOS the browser itself can say which address its front tab is on. Only the HOST NAME ever
# leaves this computer ("linkedin.com"): never the path or the query, which is where private
# things live. Private/incognito windows are skipped. Without permission, or on other systems,
# this quietly returns nothing and Aura falls back to guessing from the window title.

AUTOMATION_RETRY_SECONDS = 300  # after a refusal, ask again this often (so granting it later works)
OSASCRIPT_TIMEOUT = 3

# Chromium-based browsers share one scripting vocabulary.
_CHROMIUM_SCRIPT = """if application "{app}" is running then
    tell application "{app}"
        set windowMode to ""
        try
            set windowMode to mode of front window
        end try
        return (URL of active tab of front window) & linefeed & windowMode
    end tell
end if"""

_SAFARI_SCRIPT = """if application "Safari" is running then
    tell application "Safari" to return URL of front document
end if"""

# App name as macOS reports it -> AppleScript that returns the front tab's address.
# Firefox can't be asked; it keeps using window titles.
MAC_BROWSER_SCRIPTS = {
    **{
        app: _CHROMIUM_SCRIPT.format(app=app)
        for app in ("Google Chrome", "Brave Browser", "Microsoft Edge", "Chromium", "Vivaldi", "Arc", "Opera")
    },
    "Safari": _SAFARI_SCRIPT,
}

_ask_again_after = {}  # app name -> time.monotonic() before which we don't ask (permission refused)
_hint_shown = set()


def domain_from_address(address):
    """'https://www.linkedin.com/in/someone?x=1' -> 'linkedin.com'. Only http(s) pages have one."""
    try:
        parts = urlsplit((address or "").strip())
        host = (parts.hostname or "").lower().rstrip(".")
    except ValueError:
        return None
    if parts.scheme not in ("http", "https") or not host or len(host) > 253:
        return None
    return host[4:] if host.startswith("www.") else host


def read_tab_address(app_name):
    """Address of the browser's front tab, or None (not a browser we can ask, no window, a private
    window, or macOS didn't allow it)."""
    script = MAC_BROWSER_SCRIPTS.get(app_name) if platform.system() == "Darwin" else None
    if script is None or time.monotonic() < _ask_again_after.get(app_name, 0):
        return None
    try:
        result = subprocess.run(
            ["osascript", "-e", script], capture_output=True, text=True, timeout=OSASCRIPT_TIMEOUT
        )
    except (OSError, subprocess.SubprocessError):
        return None

    if result.returncode != 0:
        if "-1743" in result.stderr:  # "Not authorized to send Apple events"
            _ask_again_after[app_name] = time.monotonic() + AUTOMATION_RETRY_SECONDS
            if app_name not in _hint_shown:
                _hint_shown.add(app_name)
                print(f"💡 macOS didn't let Aura read which website {app_name} is on, so it guesses from window titles.")
                print(f"   To fix: System Settings → Privacy & Security → Automation → turn on {app_name}")
                print("   under your terminal app (for example Terminal). Aura notices on its own within a few minutes.")
        return None

    lines = result.stdout.splitlines()
    if not lines:
        return None
    if len(lines) > 1 and lines[1].strip().lower() == "incognito":
        return None
    return lines[0].strip() or None


def get_domain(app_name):
    address = read_tab_address(app_name)
    return domain_from_address(address) if address else None


# --- noticing a missing macOS permission ------------------------------------------------
# Without Accessibility + Automation (System Events) permission for the terminal app, macOS still
# tells us WHICH app is in front but every window title comes back empty, and the sensor reports
# "Unknown". Nothing crashes, so without a message the user just sees a dashboard full of
# "Other website" and has no idea why.

UNREADABLE_AFTER = 6  # samples in a row (about a minute) before saying anything
# Apps that have no window title (or no app at all) say nothing about the permission.
NO_TITLE_APPS = {"Unknown", "Desktop", "Finder"}

PERMISSION_HELP = """⚠️  Aura can't read your window titles, so websites will show up as "Other website".
   Your Mac needs two permissions for your terminal app (for example Terminal):
     1. System Settings → Privacy & Security → Accessibility → turn on Terminal
     2. System Settings → Privacy & Security → Automation → under Terminal, turn on System Events
   Then quit Terminal completely (Cmd+Q), open it again and start the sensor again."""


class TitleCheck:
    """Says, exactly once, when window titles keep coming back unreadable."""

    def __init__(self, limit=UNREADABLE_AFTER):
        self.limit = limit
        self.streak = 0
        self.warned = False

    def unreadable(self, app_name, title):
        """True at the moment the warning should be shown."""
        if app_name in NO_TITLE_APPS:
            return False  # neither proof nor disproof; keep the streak as it is
        self.streak = self.streak + 1 if title == "Unknown" else 0
        if self.streak >= self.limit and not self.warned:
            self.warned = True
            return True
        return False


# --- sampling ---------------------------------------------------------------------------

def get_window():
    try:
        active_window = pwc.getActiveWindow()
        if active_window:
            return active_window.getAppName() or "Unknown", active_window.title or "Unknown"
        return "Desktop", "Home"
    except Exception as e:
        print(f"⚠️ Window detection error: {e}")
        return "Unknown", "Unknown"


def start_sensor(device_key):
    """Sample the active window forever. Returns an exit code (never raises on a revoked key)."""
    print(f"\n🛡️ Aura Sensor Active on {platform.system()}...")
    if platform.system() == "Darwin":
        print("ℹ️  Aura reads only the website's name from your browser (like linkedin.com, never the full address).")
        print("   If macOS asks to let your terminal control the browser, click OK. Private windows are skipped.")
    last_app = None
    title_check = TitleCheck()

    try:
        while True:
            current_app, current_title = get_window()
            if platform.system() == "Darwin" and title_check.unreadable(current_app, current_title):
                print(PERMISSION_HELP)
            payload = {
                "app_name": current_app,
                "window_title": current_title,
                "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            }
            domain = get_domain(current_app)
            if domain:
                payload["domain"] = domain

            try:
                response = requests.post(
                    f"{API_URL}/api/log-activity",
                    json=payload,
                    headers={"Authorization": f"Device {device_key}"},
                    timeout=5,
                )

                if response.status_code == 200:
                    if current_app != last_app:
                        print(f"🎯 Synced: {current_app} — {current_title}")
                        last_app = current_app
                elif response.status_code == 401:
                    # The server only says this when the key is unknown or was revoked. There is
                    # nothing to retry and nothing to log in to: stop, and make the next run pair.
                    forget_device_key()
                    print("🔒 This device was removed from your Aura account, so its key no longer works.")
                    print(f"   To connect it again, copy a fresh install command from {DASHBOARD_URL}.")
                    return EXIT_REVOKED
                else:
                    print(f"❌ Sync Failed ({response.status_code}): {response.text}")

            except requests.exceptions.ConnectionError:
                print("📡 Backend unreachable, retrying...")
            except requests.exceptions.Timeout:
                print("⏱️ Request timed out, retrying...")
            except requests.exceptions.RequestException as e:
                print(f"⚠️ Request failed ({e}), retrying...")

            time.sleep(SAMPLE_INTERVAL)

    except KeyboardInterrupt:
        print("\n🛑 Aura Sensor stopped.")
        return EXIT_OK


def main():
    try:
        key = ensure_device_key()
    except PairingError as e:
        print(f"❌ {e}")
        return EXIT_PAIR_FAILED
    except KeyboardInterrupt:
        print("\n🛑 Cancelled.")
        return EXIT_OK
    if not key:
        return EXIT_NOT_PAIRED
    return start_sensor(key)


if __name__ == "__main__":
    sys.exit(main())
