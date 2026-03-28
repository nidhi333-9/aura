import pandas as pd 
import sqlite3

# 1. The Translation Dictionary

AURA_MAP = {
  'Electron' : 'Coding (VS Code)',
  'Google Chrome' : 'Research/Web',
  'Spotify': 'Music/Focus',
  'Terminal': 'System Work',
  'Desktop': 'Idle'
}

def analyze_my_flow():
  conn = sqlite3.connect('aura.db')
  df = pd.read_sql_query("SELECT app_name, count(*) as frequency FROM activity_logs GROUP BY app_name", conn)
  conn.close()

  # Map the names to categories
  df['Category'] = df['app_name'].map(AURA_MAP).fillna('Other')
  return df

if __name__ == "__main__":
  print("Aura is analyzing your categories...")
  summary = analyze_my_flow()
  print(summary)