from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from core.processor import analyze_my_flow

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/analytics")
def get_analytics(user_id: str = Query(None)):
    stats = analyze_my_flow(limit=150, user_id=user_id)

    if isinstance(stats, str):
        return {"message": stats}

    score = stats.get("focus_score", 0)
    status = "Deep Focus" if score > 70 else "Light Work" if score > 30 else "Idle / Break"
    try:
        return {
            "total_logs": stats.get("total_logs", 0),
            "current_app": stats.get("current_app", "Unknown"),
            "most_used": stats.get("dominant_aura", "None"),
            "focus_score": stats.get("focus_score", 0),
            "app_distribution": stats.get("breakdown", {}),
            "top_sites": stats.get("top_sites", {}),
            "status": status
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/dashboard")
def get_dashboard():
    return {"name": "Nidhi", "mca_year": 2}

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(status_code=204)

@app.get("/hourly-trend")
def get_trend(user_id: str = Query(None)):
    try:
        from core.processor import get_hourly_stats
        data = get_hourly_stats(user_id=user_id)
        return data
    except Exception as e:
        print("ERROR IN HOURLY:", str(e))
        return {"error": str(e)}