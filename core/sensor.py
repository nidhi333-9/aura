import subprocess
import time

def get_window():
    # The fix: Added 'name' back into the command
    cmd = "osascript -e 'tell application \"System Events\" to get name of first application process whose frontmost is true'"
    try:
        return subprocess.check_output(cmd, shell=True, text=True).strip()
    except Exception as e:
        return "Desktop"

print("Aura is now sensing... Press Ctrl+C to stop.")

while True:
  current_app = get_window()
  print(f"Current Flow: {current_app}")
  time.sleep(5)
  