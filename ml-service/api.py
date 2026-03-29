from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
import pandas as pd
import os
from fastapi.responses import Response
# Import your brain from the core folder
from core.processor import analyze_my_flow
from actions.youtube_api import get_dynamic_video
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/analytics")
def get_analytics():
    # 1. Let the processor handle the math
    stats = analyze_my_flow(limit=150)
    
    # 2. If processor returns an error message
    if isinstance(stats, str):
        return {"message": stats}

    score = stats.get("focus_score", 0)
    status = "Deep Focus" if score > 70 else "Light Work" if score > 30 else "Idle / Break"
    video_url = get_dynamic_video(status)
    # 3. Return the formatted data to your React Frontend
    try:
        return {
            "total_logs": stats.get("total_logs", 0),
            "current_app": stats.get("current_app", "Unknown"),
            "most_used": stats.get("dominant_aura", "None"),
            "focus_score": stats.get("focus_score", 0),
            "app_distribution": stats.get("breakdown", {}),
            "video_url": video_url,
            "status": status
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/dashboard")
def get_dashboard():
    # This is for your "Welcome back, Nidhi" header
    return {"name": "Nidhi", "mca_year": 2}

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(status_code=204)