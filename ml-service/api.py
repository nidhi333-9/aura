from fastapi import FastAPI
import sqlite3
import pandas as pd
import os

app = FastAPI()

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
BASE_DIR = os.path.dirname(__file__)
DB_PATH = "/Users/techynidhi/Projects/aura/ml-service/data/aura.db"


def get_data():
    conn = sqlite3.connect(DB_PATH)
    df = pd.read_sql_query(
        "SELECT * FROM activity_logs ORDER BY timestamp DESC",
        conn
    )
    conn.close()
    return df


@app.get("/analytics")
def get_analytics():
    try:
        data = get_data()

        if data.empty:
            return {"message": "No data"}

        data['timestamp'] = pd.to_datetime(data['timestamp'], errors='coerce')

        focus_apps = ["Code", "VS Code", "PyCharm"]
        focus_count = data[data['app_name'].isin(focus_apps)].shape[0]
        focus_score = (focus_count / len(data)) * 100

        app_dist = data['app_name'].value_counts().to_dict()

        data['hour'] = data['timestamp'].dt.hour
        hourly = data.groupby('hour').size().to_dict()

        return {
            "total_logs": len(data),
            "current_app": data['app_name'].iloc[0],
            "most_used": data['app_name'].mode()[0],
            "focus_score": round(focus_score, 2),
            "app_distribution": app_dist,
            "hourly_activity": hourly
        }

    except Exception as e:
        print("🔥 FASTAPI ERROR:", str(e))
        return {"error": str(e)}