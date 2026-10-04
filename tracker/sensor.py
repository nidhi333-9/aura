import json
import os
import platform
import sys
import time
from datetime import datetime, timezone

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
    last_app = None

    try:
        while True:
            current_app, current_title = get_window()
            payload = {
                "app_name": current_app,
                "window_title": current_title,
                "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            }

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
