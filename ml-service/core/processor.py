import pandas as pd 
import sqlite3
import os

# Updated Map with more common macOS process names
AURA_MAP = {
    'Code': 'Coding (VS Code)',
    'Visual Studio Code': 'Coding (VS Code)',
    'Google Chrome': 'Research/Web',
    'Safari': 'Research/Web',
    'Spotify': 'Music/Focus',
    'Terminal': 'System Work',
    'iTerm2': 'System Work',
    'Desktop': 'Idle',
    'Finder': 'System Work'
}

DB_PATH = "/Users/techynidhi/Projects/aura/ml-service/data/aura.db"

def analyze_my_flow(limit=200):
    """Analyzes the most recent logs to determine current 'Aura'."""
    if not os.path.exists(DB_PATH):
        return "No Database Found"

    conn = sqlite3.connect(DB_PATH)
    # Logic: Only pull the most RECENT logs for a 'Live' feel
    query = f"SELECT app_name, timestamp FROM activity_logs ORDER BY timestamp DESC LIMIT {limit}"
    df = pd.read_sql_query(query, conn)
    conn.close()

    if df.empty:
        return {
            "current_app": "No Activity",
            "dominant_aura": "Idle",
            "focus_score": 0,
            "breakdown": {},
            "total_logs": 0
        }

    # 1. Apply the Mapping
    df['Category'] = df['app_name'].map(AURA_MAP).fillna('General/Other')

    # 2. Calculate the "Dominant Aura" (What you've been doing most lately)
    dominant_aura = df['Category'].mode()[0]
    
    # 3. Calculate Focus Percentage
    focus_apps = ['Coding (VS Code)', 'System Work']
    focus_count = df[df['Category'].isin(focus_apps)].shape[0]
    focus_percent = (focus_count / len(df)) * 100
    latest_app = df['app_name'].iloc[0] 
    
    return {
        "current_app" : latest_app,
        "dominant_aura": dominant_aura,
        "focus_score": round(focus_percent, 2),
        "breakdown": df['Category'].value_counts().to_dict(),
        "total_logs": len(df)
    }

if __name__ == "__main__":
    print("🌊 Aura Engine: Analyzing your recent flow...")
    stats = analyze_my_flow()
    print(f"Current State: {stats['dominant_aura']}")
    print(f"Focus Score: {stats['focus_score']}%")
    print("Full Breakdown:", stats['breakdown'])