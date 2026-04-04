import time
import pywinctl as pwc
import requests
import platform
import os
import json
import webbrowser
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

API_URL = "https://aura-production-f392.up.railway.app"
TOKEN_FILE = os.path.join(os.path.expanduser("~"), ".aura_token")
token_received = threading.Event()
received_token = {"value": None}


class TokenHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        if "token" in params:
            token = params["token"][0]
            received_token["value"] = token
            with open(TOKEN_FILE, "w") as f:
                json.dump({"token": token}, f)

            self.send_response(200)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            self.wfile.write(b"<html><body style='font-family:sans-serif;text-align:center;padding:50px'><h2>Aura Sensor Connected!</h2><p>You can close this tab and go back to the terminal.</p></body></html>")
            token_received.set()
        else:
            self.send_response(400)
            self.end_headers()

    def log_message(self, format, *args):
        pass  # Suppress server logs


def wait_for_token():
    """Start local server to receive token from browser."""
    server = HTTPServer(("localhost", 9999), TokenHandler)
    server.timeout = 1
    print("⏳ Waiting for login...")
    while not token_received.is_set():
        server.handle_request()
    server.server_close()


def load_token():
    if os.path.exists(TOKEN_FILE):
        try:
            with open(TOKEN_FILE, "r") as f:
                return json.load(f).get("token")
        except:
            return None
    return None


def verify_token(token):
    """Check if token is still valid."""
    try:
        res = requests.get(f"{API_URL}/dashboard",
                          headers={"Authorization": f"Bearer {token}"},
                          timeout=5)
        return res.status_code == 200
    except:
        return False


def get_valid_token():
    token = load_token()

    if token and verify_token(token):
        print("✅ Token loaded successfully!")
        return token

    # Token missing or expired — open browser for login
    print("🔐 Login required. Opening browser...")
    login_url = f"https://aura-gamma-eight.vercel.app?callback=http://localhost:9999"
    webbrowser.open(login_url)

    # Wait for token from browser
    wait_for_token()
    return received_token["value"]


def get_window():
    try:
        active_window = pwc.getActiveWindow()
        if active_window:
            return active_window.getAppName() or "Unknown", active_window.title or "Unknown"
        return "Desktop", "Home"
    except Exception as e:
        print(f"⚠️ Window detection error: {e}")
        return "Unknown", "Unknown"


def start_sensor(token):
    print(f"\n🛡️ Aura Sensor Active on {platform.system()}...")
    last_app = None

    try:
        while True:
            current_app, current_title = get_window()

            payload = {
                "app_name": current_app,
                "window_title": current_title,
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S")
            }

            try:
                response = requests.post(
                    f"{API_URL}/api/log-activity",
                    json=payload,
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=5
                )

                if response.status_code == 200:
                    if current_app != last_app:
                        print(f"🎯 Synced: {current_app} — {current_title}")
                        last_app = current_app
                elif response.status_code == 401:
                    print("⚠️ Token expired! Re-authenticating...")
                    token = get_valid_token()
                else:
                    print(f"❌ Sync Failed ({response.status_code}): {response.text}")

            except requests.exceptions.ConnectionError:
                print("📡 Backend unreachable, retrying...")
            except requests.exceptions.Timeout:
                print("⏱️ Request timed out, retrying...")

            time.sleep(10)

    except KeyboardInterrupt:
        print("\n🛑 Aura Sensor stopped.")


if __name__ == "__main__":
    token = get_valid_token()
    if token:
        start_sensor(token)
    else:
        print("❌ Could not authenticate.")