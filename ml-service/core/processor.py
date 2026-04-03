import pandas as pd
from pymongo import MongoClient
from datetime import datetime, timezone

MONGO_URI = "mongodb://localhost:27017/aura"
AURA_MAP = {
    'Code':                 'Coding (VS Code)',
    'Visual Studio Code':   'Coding (VS Code)',
    'Cursor':               'Coding (VS Code)',
    'Google Chrome':        'Research/Web',
    'Safari':               'Research/Web',
    'Firefox':              'Research/Web',
    'Spotify':              'Music/Focus',
    'Terminal':             'System Work',
    'iTerm2':               'System Work',
    'Postman':              'System Work',
    'Desktop':              'Idle',
    'Finder':               'System Work',
}

def get_collection():
    client = MongoClient(MONGO_URI)
    db = client["aura"]
    return db["activities"]  # MongoDB auto-pluralizes "Activity" → "activities"

def analyze_my_flow(limit=200):
    try:
        collection = get_collection()
        docs = list(collection.find().sort("timestamp", -1).limit(limit))

        if not docs:
            return {
                "current_app": "No Activity",
                "dominant_aura": "Idle",
                "focus_score": 0,
                "breakdown": {},
                "total_logs": 0
            }

        df = pd.DataFrame(docs)

        # Map app names to categories
        df['Category'] = df['app_name'].map(AURA_MAP).fillna('General/Other')

        # Dominant aura = most frequent category
        dominant_aura = df['Category'].mode()[0]

        # Focus score = % of time in productive apps
        focus_apps = ['Coding (VS Code)', 'System Work']
        focus_count = df[df['Category'].isin(focus_apps)].shape[0]
        focus_score = round((focus_count / len(df)) * 100, 2)

        # Current app = most recent log
        latest_app = df['app_name'].iloc[0]

        return {
            "current_app": latest_app,
            "dominant_aura": dominant_aura,
            "focus_score": focus_score,
            "breakdown": df['Category'].value_counts().to_dict(),
            "total_logs": len(df)
        }

    except Exception as e:
        print(f"❌ MongoDB Error: {e}")
        return {
            "current_app": "Error",
            "dominant_aura": "Error",
            "focus_score": 0,
            "breakdown": {},
            "total_logs": 0
        }


def get_hourly_stats():
    try:
        collection = get_collection()

        # Get today's start in UTC
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        docs = list(collection.find({"timestamp": {"$gte": today}}))

        if not docs:
            return []

        df = pd.DataFrame(docs)
        df['timestamp'] = pd.to_datetime(df['timestamp'], utc=True)
        df['Category'] = df['app_name'].map(AURA_MAP).fillna('General/Other')

        focus_apps = ['Coding (VS Code)', 'System Work']
        df['is_focus'] = df['Category'].isin(focus_apps).astype(int)

        hourly = df.set_index('timestamp').resample('h')['is_focus'].mean() * 100
        hourly = hourly.fillna(0).reset_index()

        return [
            {
                "hour": row['timestamp'].strftime('%H:00'),
                "score": round(row['is_focus'], 2)
            }
            for _, row in hourly.iterrows()
        ]

    except Exception as e:
        print(f"❌ Hourly Stats Error: {e}")
        return []


if __name__ == "__main__":
    print("🌊 Aura Engine: Analyzing your recent flow...")
    stats = analyze_my_flow()
    print(f"Current App:   {stats['current_app']}")
    print(f"Dominant Aura: {stats['dominant_aura']}")
    print(f"Focus Score:   {stats['focus_score']}%")
    print(f"Breakdown:     {stats['breakdown']}")