import subprocess
import time
import sqlite3
import os
import datetime



BASE_DIR = os.path.dirname(os.path.dirname(__file__))

DB_PATH = os.path.join(BASE_DIR, 'ml-service', 'data', 'aura.db')
# DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data/aura.db')

print("DB PATH:", DB_PATH)
print("Exists:", os.path.exists(DB_PATH))
def get_window():
    cmd = "osascript -e 'tell application \"System Events\" to get name of first application process whose frontmost is true'"
    try:
        return subprocess.check_output(cmd, shell=True, text=True).strip()
    except:
        return "Desktop"

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

last_app = None

print("🛡️ Aura Core Active...")

try:
    while True:
        app = get_window()
        
        cursor.execute(
            "INSERT INTO activity_logs (app_name, window_title, timestamp) VALUES (?, ?, ?)",
            (app, "Active Session", datetime.datetime.now().isoformat())
        )
        conn.commit()
        if app != last_app:
            print(f"🎯 Switched to: {app}")
            last_app = app
        
        time.sleep(10) # Log every 10 seconds

except KeyboardInterrupt:
    print("\n🛑 Aura stopped.")
    conn.close()