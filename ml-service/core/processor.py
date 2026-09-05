import pandas as pd
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime, timezone
import os

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/aura")

BROWSER_APPS = ["Google Chrome", "Safari", "Firefox", "Brave", "Microsoft Edge"]

DESKTOP_SITE_MAP = {
    'Visual Studio Code': ('VS Code', 'Productive'),
    'Code':               ('VS Code', 'Productive'),
    'Cursor':             ('Cursor', 'Productive'),
    'Terminal':           ('Terminal', 'Productive'),
    'iTerm2':             ('Terminal', 'Productive'),
    'Postman':            ('Postman', 'Productive'),
    'IntelliJ':           ('IntelliJ', 'Productive'),
    'PyCharm':            ('PyCharm', 'Productive'),
    'Spotify':            ('Spotify', 'Neutral'),
    'Finder':             ('Finder', 'Neutral'),
    'Desktop':            ('Idle', 'Idle'),
    'Unknown':            ('Idle', 'Idle'),
}

WEBSITE_MAP = [
    ('chatgpt',           'ChatGPT',         'Productive'),
    ('claude.ai',         'Claude',          'Productive'),
    ('github',            'GitHub',          'Productive'),
    ('stackoverflow',     'Stack Overflow',  'Productive'),
    ('leetcode',          'LeetCode',        'Productive'),
    ('geeksforgeeks',     'GeeksforGeeks',   'Productive'),
    ('hackerrank',        'HackerRank',      'Productive'),
    ('codeforces',        'Codeforces',      'Productive'),
    ('coursera',          'Coursera',        'Productive'),
    ('udemy',             'Udemy',           'Productive'),
    ('w3schools',         'W3Schools',       'Productive'),
    ('developer.mozilla', 'MDN Docs',        'Productive'),
    ('notion',            'Notion',          'Productive'),
    ('hotstar',           'Hotstar',         'Distraction'),
    ('netflix',           'Netflix',         'Distraction'),
    ('prime video',       'Prime Video',     'Distraction'),
    ('instagram',         'Instagram',       'Distraction'),
    ('facebook',          'Facebook',        'Distraction'),
    ('twitter',           'Twitter/X',       'Distraction'),
    ('reddit',            'Reddit',          'Distraction'),
    ('youtube',           'YouTube',         'Distraction'),
]


def get_collection():
    client = MongoClient(MONGO_URI)
    db = client.get_default_database()
    return db["activities"]


def _user_filter(user_id=None):
    if not user_id:
        return {}
    try:
        return {"user": ObjectId(user_id)}
    except Exception:
        return {}


def classify_activity(app_name, window_title=""):
    title = (window_title or "").lower()

    if app_name in BROWSER_APPS:
        for keyword, site_name, category in WEBSITE_MAP:
            if keyword in title:
                return site_name, category
        return "Other website", "Neutral"

    if app_name in DESKTOP_SITE_MAP:
        return DESKTOP_SITE_MAP[app_name]

    return app_name, "Neutral"


def analyze_my_flow(limit=50, user_id=None):
    try:
        collection = get_collection()
        query = _user_filter(user_id)
        docs = list(collection.find(query).sort("timestamp", -1).limit(limit))
        docs = [d for d in docs if d.get('app_name') not in ['Desktop', 'Unknown']]
        if not docs:
            return {
                "current_app": "No Activity", "dominant_aura": "Idle",
                "focus_score": 0, "breakdown": {}, "top_sites": {}, "total_logs": 0
            }

        df = pd.DataFrame(docs)
        classified = df.apply(lambda r: classify_activity(r['app_name'], r.get('window_title', '')), axis=1)
        df['site'] = classified.apply(lambda p: p[0])
        df['Category'] = classified.apply(lambda p: p[1])

        dominant_aura = df['Category'].mode()[0]
        focus_score = round(((df['Category'] == 'Productive').sum() / len(df)) * 100, 2)

        return {
            "current_app": df['site'].iloc[0],
            "dominant_aura": dominant_aura,
            "focus_score": focus_score,
            "breakdown": df['Category'].value_counts().to_dict(),
            "top_sites": df['site'].value_counts().head(10).to_dict(),
            "total_logs": len(df)
        }

    except Exception as e:
        print(f"❌ MongoDB Error: {e}")
        return {
            "current_app": "Error", "dominant_aura": "Error",
            "focus_score": 0, "breakdown": {}, "top_sites": {}, "total_logs": 0
        }


def get_hourly_stats(user_id=None):
    try:
        collection = get_collection()
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        query = _user_filter(user_id)
        query["timestamp"] = {"$gte": today}
        docs = list(collection.find(query))
        docs = [d for d in docs if d.get('app_name') not in ['Desktop', 'Unknown']]
        if not docs:
            return []

        df = pd.DataFrame(docs)
        df['timestamp'] = pd.to_datetime(df['timestamp'], utc=True)
        classified = df.apply(lambda r: classify_activity(r['app_name'], r.get('window_title', '')), axis=1)
        df['Category'] = classified.apply(lambda p: p[1])
        df['is_focus'] = (df['Category'] == 'Productive').astype(int)

        hourly = df.set_index('timestamp').resample('h')['is_focus'].mean() * 100
        hourly = hourly.fillna(0).reset_index()

        return [{"hour": r['timestamp'].strftime('%H:00'), "score": round(r['is_focus'], 2)} for _, r in hourly.iterrows()]

    except Exception as e:
        print(f"❌ Hourly Stats Error: {e}")
        return []