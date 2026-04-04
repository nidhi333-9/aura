import time
import pywinctl as pwc
import requests
import platform

API_URL = "http://localhost:8080/api/log-activity" 
USER_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5Yzc4OTVmZmUwY2Q1NTZhMzJjZjE4ZCIsImlhdCI6MTc3NTI4NDk2OCwiZXhwIjoxNzc1ODg5NzY4fQ.Xd8Nmw4EcevEpxBNUnACYiMTC6O8uLlz8DK9AeyZfrI"

def get_window():
    """Returns (app_name, window_title) of the currently active window."""
    try:
        active_window = pwc.getActiveWindow()
        if active_window:
            app_name = active_window.getAppName() or "Unknown"
            title = active_window.title or "Unknown"
            return app_name, title
        return "Desktop", "Home"
    except Exception as e:
        print(f"⚠️ Window detection error: {e}")
        return "Unknown", "Unknown"


def start_sensor():
    print(f"🛡️ Aura Sensor Active on {platform.system()}...")
    last_app = None

    try:
        while True:
            current_app, current_title = get_window()  # ✅ Unpack both values

            payload = {
                "app_name": current_app,
                "window_title": current_title,          # ✅ Real title, not hardcoded
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S")
            }

            try:
                response = requests.post(
                    API_URL,
                    json=payload,
                    headers={"Authorization": f"Bearer {USER_TOKEN}"},
                    timeout=5
                )

                if response.status_code == 200:
                    if current_app != last_app:
                        print(f"🎯 Synced: {current_app} — {current_title}")
                        last_app = current_app
                else:
                    print(f"❌ Sync Failed (Status: {response.status_code}): {response.text}")

            except requests.exceptions.ConnectionError:
                print("📡 Connection Error: Is your backend server running?")
            except requests.exceptions.Timeout:
                print("⏱️ Request timed out.")

            time.sleep(10)

    except KeyboardInterrupt:
        print("\n🛑 Aura Sensor stopped by user.")


if __name__ == "__main__":
    start_sensor()