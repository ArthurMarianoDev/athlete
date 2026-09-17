import os
import uuid
import logging
import math
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import jwt
import bcrypt
import httpx
from fastapi import FastAPI, APIRouter, Header, HTTPException, Depends, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
EMERGENT_AUTH_URL = os.environ["EMERGENT_AUTH_URL"]
JWT_ALGO = "HS256"

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def make_jwt(user_id: str) -> str:
    payload = {"user_id": user_id, "iat": int(now_utc().timestamp())}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def public_user(u: dict) -> dict:
    return {
        "user_id": u["user_id"],
        "name": u.get("name") or "Athlete",
        "email": u.get("email"),
        "picture": u.get("picture"),
        "created_at": u.get("created_at"),
    }


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class RegisterBody(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class SessionBody(BaseModel):
    session_id: str


class RoutePoint(BaseModel):
    latitude: float
    longitude: float
    t: Optional[int] = None  # ms offset from start


class ActivityBody(BaseModel):
    type: str  # run | cycle | walk
    zone_id: Optional[str] = None
    distance_m: float
    duration_s: int
    avg_pace_s_per_km: Optional[float] = None
    avg_speed_kmh: Optional[float] = None
    calories: Optional[float] = None
    route: List[RoutePoint] = []
    started_at: Optional[str] = None


class ZoneBody(BaseModel):
    name: str
    latitude: float
    longitude: float
    radius_m: int = 3000


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------
async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1].strip()

    # 1) Try JWT (email/password)
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        user = await db.users.find_one({"user_id": payload["user_id"]}, {"_id": 0})
        if user:
            return user
    except jwt.PyJWTError:
        pass

    # 2) Try session token (Google)
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if session:
        exp = session.get("expires_at")
        if isinstance(exp, str):
            exp = datetime.fromisoformat(exp)
        if exp and exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp and exp < now_utc():
            raise HTTPException(status_code=401, detail="Session expired")
        user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
        if user:
            return user

    raise HTTPException(status_code=401, detail="Invalid token")


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api_router.post("/auth/register")
async def register(body: RegisterBody):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")
    user = {
        "user_id": new_id("user"),
        "name": body.name.strip() or "Athlete",
        "email": body.email.lower(),
        "password_hash": hash_password(body.password),
        "picture": None,
        "provider": "email",
        "created_at": now_utc().isoformat(),
    }
    await db.users.insert_one(user)
    token = make_jwt(user["user_id"])
    return {"token": token, "user": public_user(user)}


@api_router.post("/auth/login")
async def login(body: LoginBody):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not user.get("password_hash") or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    token = make_jwt(user["user_id"])
    return {"token": token, "user": public_user(user)}


@api_router.post("/auth/session")
async def google_session(body: SessionBody):
    async with httpx.AsyncClient(timeout=15) as http:
        resp = await http.get(EMERGENT_AUTH_URL, headers={"X-Session-ID": body.session_id})
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Sessão inválida")
    data = resp.json()
    email = (data.get("email") or "").lower()
    if not email:
        raise HTTPException(status_code=401, detail="Sessão inválida")

    user = await db.users.find_one({"email": email})
    if not user:
        user = {
            "user_id": new_id("user"),
            "name": data.get("name") or "Athlete",
            "email": email,
            "password_hash": None,
            "picture": data.get("picture"),
            "provider": "google",
            "created_at": now_utc().isoformat(),
        }
        await db.users.insert_one(user)
    else:
        # keep picture/name fresh
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"picture": data.get("picture") or user.get("picture"),
                      "name": user.get("name") or data.get("name")}},
        )
        user = await db.users.find_one({"user_id": user["user_id"]})

    session_token = data.get("session_token") or new_id("sess")
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user["user_id"],
        "created_at": now_utc().isoformat(),
        "expires_at": (now_utc() + timedelta(days=7)).isoformat(),
    })
    return {"token": session_token, "user": public_user(user)}


@api_router.get("/auth/me")
async def me(current=Depends(get_current_user)):
    return {"user": public_user(current)}


# ---------------------------------------------------------------------------
# Zones
# ---------------------------------------------------------------------------
@api_router.get("/zones")
async def list_zones(lat: Optional[float] = Query(None), lng: Optional[float] = Query(None),
                     current=Depends(get_current_user)):
    zones = await db.zones.find({"deleted_at": None}, {"_id": 0}).to_list(500)
    result = []
    for z in zones:
        participants = await db.activities.distinct(
            "user_id", {"zone_id": z["zone_id"], "deleted_at": None}
        )
        activity_count = await db.activities.count_documents(
            {"zone_id": z["zone_id"], "deleted_at": None}
        )
        dist = None
        if lat is not None and lng is not None:
            dist = round(haversine_m(lat, lng, z["latitude"], z["longitude"]))
        result.append({
            **z,
            "participant_count": len(participants),
            "activity_count": activity_count,
            "distance_m": dist,
        })
    if lat is not None and lng is not None:
        result.sort(key=lambda x: (x["distance_m"] is None, x["distance_m"] or 0))
    return {"zones": result}


@api_router.post("/zones")
async def create_zone(body: ZoneBody, current=Depends(get_current_user)):
    zone = {
        "zone_id": new_id("zone"),
        "name": body.name.strip(),
        "latitude": body.latitude,
        "longitude": body.longitude,
        "radius_m": body.radius_m,
        "type": "auto",
        "owner_id": current["user_id"],
        "created_at": now_utc().isoformat(),
        "deleted_at": None,
    }
    await db.zones.insert_one(zone)
    zone.pop("_id", None)
    return {"zone": {**zone, "participant_count": 0, "activity_count": 0, "distance_m": 0}}


@api_router.get("/zones/{zone_id}")
async def get_zone(zone_id: str, current=Depends(get_current_user)):
    z = await db.zones.find_one({"zone_id": zone_id, "deleted_at": None}, {"_id": 0})
    if not z:
        raise HTTPException(status_code=404, detail="Zona não encontrada")
    participants = await db.activities.distinct("user_id", {"zone_id": zone_id, "deleted_at": None})
    activity_count = await db.activities.count_documents({"zone_id": zone_id, "deleted_at": None})
    return {"zone": {**z, "participant_count": len(participants), "activity_count": activity_count}}


@api_router.get("/zones/{zone_id}/leaderboard")
async def zone_leaderboard(zone_id: str, metric: str = Query("distance"),
                           type: Optional[str] = Query(None),
                           current=Depends(get_current_user)):
    match = {"zone_id": zone_id, "deleted_at": None}
    if type:
        match["type"] = type
    acts = await db.activities.find(match, {"_id": 0}).to_list(5000)

    agg: dict = {}
    for a in acts:
        uid = a["user_id"]
        if uid not in agg:
            agg[uid] = {
                "user_id": uid,
                "total_distance_m": 0.0,
                "total_duration_s": 0,
                "activity_count": 0,
                "best_pace_s_per_km": None,
            }
        e = agg[uid]
        e["total_distance_m"] += a.get("distance_m", 0) or 0
        e["total_duration_s"] += a.get("duration_s", 0) or 0
        e["activity_count"] += 1
        pace = a.get("avg_pace_s_per_km")
        if pace and pace > 0 and a.get("distance_m", 0) >= 300:
            if e["best_pace_s_per_km"] is None or pace < e["best_pace_s_per_km"]:
                e["best_pace_s_per_km"] = pace

    entries = list(agg.values())
    # attach user info
    for e in entries:
        u = await db.users.find_one({"user_id": e["user_id"]}, {"_id": 0})
        e["name"] = (u or {}).get("name", "Athlete")
        e["picture"] = (u or {}).get("picture")

    if metric == "pace":
        rated = [e for e in entries if e["best_pace_s_per_km"] is not None]
        rated.sort(key=lambda x: x["best_pace_s_per_km"])
        entries = rated
    else:
        entries.sort(key=lambda x: x["total_distance_m"], reverse=True)

    for i, e in enumerate(entries):
        e["rank"] = i + 1
        e["is_current_user"] = e["user_id"] == current["user_id"]

    me_entry = next((e for e in entries if e["is_current_user"]), None)
    return {"metric": metric, "entries": entries, "me": me_entry}


# ---------------------------------------------------------------------------
# Activities
# ---------------------------------------------------------------------------
@api_router.post("/activities")
async def create_activity(body: ActivityBody, current=Depends(get_current_user)):
    act = {
        "activity_id": new_id("act"),
        "user_id": current["user_id"],
        "type": body.type,
        "zone_id": body.zone_id,
        "distance_m": body.distance_m,
        "duration_s": body.duration_s,
        "avg_pace_s_per_km": body.avg_pace_s_per_km,
        "avg_speed_kmh": body.avg_speed_kmh,
        "calories": body.calories,
        "route": [p.dict() for p in body.route],
        "started_at": body.started_at or now_utc().isoformat(),
        "created_at": now_utc().isoformat(),
        "deleted_at": None,
    }
    await db.activities.insert_one(act)
    act.pop("_id", None)
    return {"activity": act}


@api_router.get("/activities")
async def list_activities(scope: str = Query("me"), zone_id: Optional[str] = Query(None),
                          current=Depends(get_current_user)):
    query: dict = {"deleted_at": None}
    if scope == "me":
        query["user_id"] = current["user_id"]
    if zone_id:
        query["zone_id"] = zone_id
    acts = await db.activities.find(query, {"_id": 0}).sort("created_at", -1).to_list(300)
    # attach author names for feed
    cache: dict = {}
    for a in acts:
        uid = a["user_id"]
        if uid not in cache:
            u = await db.users.find_one({"user_id": uid}, {"_id": 0})
            cache[uid] = (u or {}).get("name", "Athlete")
        a["author_name"] = cache[uid]
    return {"activities": acts}


@api_router.get("/activities/{activity_id}")
async def get_activity(activity_id: str, current=Depends(get_current_user)):
    a = await db.activities.find_one({"activity_id": activity_id, "deleted_at": None}, {"_id": 0})
    if not a:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")
    u = await db.users.find_one({"user_id": a["user_id"]}, {"_id": 0})
    a["author_name"] = (u or {}).get("name", "Athlete")
    zone = None
    if a.get("zone_id"):
        zone = await db.zones.find_one({"zone_id": a["zone_id"]}, {"_id": 0})
    a["zone"] = zone
    return {"activity": a}


@api_router.delete("/activities/{activity_id}")
async def delete_activity(activity_id: str, current=Depends(get_current_user)):
    a = await db.activities.find_one({"activity_id": activity_id})
    if not a or a["user_id"] != current["user_id"]:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")
    await db.activities.update_one({"activity_id": activity_id}, {"$set": {"deleted_at": now_utc().isoformat()}})
    return {"ok": True}


@api_router.get("/profile/stats")
async def profile_stats(current=Depends(get_current_user)):
    acts = await db.activities.find(
        {"user_id": current["user_id"], "deleted_at": None}, {"_id": 0}
    ).to_list(5000)
    total_distance = sum(a.get("distance_m", 0) or 0 for a in acts)
    total_duration = sum(a.get("duration_s", 0) or 0 for a in acts)
    by_type: dict = {}
    for a in acts:
        by_type[a["type"]] = by_type.get(a["type"], 0) + (a.get("distance_m", 0) or 0)
    return {
        "user": public_user(current),
        "total_distance_m": total_distance,
        "total_duration_s": total_duration,
        "activity_count": len(acts),
        "by_type": by_type,
    }


# ---------------------------------------------------------------------------
# Startup: indexes + seed zones
# ---------------------------------------------------------------------------
SEED_ZONES = [
    {"name": "Parque Ibirapuera", "latitude": -23.5874, "longitude": -46.6576, "radius_m": 3000},
    {"name": "Orla da Lagoa", "latitude": -22.9737, "longitude": -43.2088, "radius_m": 4000},
    {"name": "Parque Barigui", "latitude": -25.4211, "longitude": -49.3100, "radius_m": 3500},
    {"name": "Orla de Boa Viagem", "latitude": -8.1200, "longitude": -34.9000, "radius_m": 5000},
    {"name": "Parque da Cidade", "latitude": -15.7960, "longitude": -47.8990, "radius_m": 4000},
]


@app.on_event("startup")
async def startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("user_id", unique=True)
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
        await db.zones.create_index("zone_id", unique=True)
        await db.activities.create_index("activity_id", unique=True)
        await db.activities.create_index("zone_id")
    except Exception as e:
        logger.warning(f"index creation: {e}")

    for z in SEED_ZONES:
        existing = await db.zones.find_one({"name": z["name"], "type": "predefined"})
        if not existing:
            await db.zones.insert_one({
                "zone_id": new_id("zone"),
                "name": z["name"],
                "latitude": z["latitude"],
                "longitude": z["longitude"],
                "radius_m": z["radius_m"],
                "type": "predefined",
                "owner_id": None,
                "created_at": now_utc().isoformat(),
                "deleted_at": None,
            })


@api_router.get("/")
async def root():
    return {"message": "ZoneTrack API"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
