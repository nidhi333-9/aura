import hmac
import os

from bson import ObjectId
from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.responses import Response
from core.processor import analyze_my_flow


def require_secret(x_aura_secret: str = Header(default="")):
    """Only the Express backend, which knows ML_SHARED_SECRET, may call this service.

    Fails closed: if the secret isn't configured, every request is rejected.
    """
    expected = os.environ.get("ML_SHARED_SECRET", "")
    if not expected or not hmac.compare_digest(x_aura_secret.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Unauthorized")


def require_user_id(user_id: str = Query(None)):
    """Every query is scoped to one user; a missing/invalid id is a client error."""
    if not user_id or not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="A valid user_id is required")
    return user_id


# No CORS middleware and no public docs: this is called server-to-server by Express only.
app = FastAPI(
    dependencies=[Depends(require_secret)],
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


@app.get("/analytics")
def get_analytics(user_id: str = Depends(require_user_id)):
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
def get_trend(user_id: str = Depends(require_user_id)):
    try:
        from core.processor import get_hourly_stats
        data = get_hourly_stats(user_id=user_id)
        return data
    except Exception as e:
        print("ERROR IN HOURLY:", str(e))
        return {"error": str(e)}