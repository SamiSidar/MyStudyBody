from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Models ──────────────────────────────────────────────
class UserRegister(BaseModel):
    username: str
    email: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: str
    username: str
    email: str


class StudySession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    subject: str
    duration_minutes: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StudySessionCreate(BaseModel):
    subject: str
    duration_minutes: int


class ErrorScan(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    subject: str
    topic: str
    notes: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ErrorScanCreate(BaseModel):
    subject: str
    topic: str
    notes: str = ""


@api_router.post("/auth/register", response_model=UserResponse)
async def register_user(body: UserRegister):
    existing = await db.users.find_one({"email": body.email})
    if existing:
        raise HTTPException(status_code=400, detail="This email is already registered")
    existing_username = await db.users.find_one({"username": body.username})
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already taken")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "username": body.username,
        "email": body.email,
        "password_hash": pwd_context.hash(body.password),
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(user_doc)
    return UserResponse(id=user_id, username=body.username, email=body.email)


@api_router.post("/auth/login", response_model=UserResponse)
async def login_user(body: UserLogin):
    user_doc = await db.users.find_one({"email": body.email})
    if not user_doc or not pwd_context.verify(body.password, user_doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return UserResponse(id=user_doc["id"], username=user_doc["username"], email=user_doc["email"])


# ── Routes ──────────────────────────────────────────────
@api_router.get("/")
async def root():
    return {"message": "MyStudyBody API v1"}


@api_router.post("/sessions", response_model=StudySession)
async def create_session(body: StudySessionCreate):
    session = StudySession(**body.dict())
    await db.study_sessions.insert_one(session.dict())
    return session


@api_router.get("/sessions", response_model=List[StudySession])
async def get_sessions():
    docs = await db.study_sessions.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs


@api_router.get("/stats/weekly")
async def get_weekly_stats():
    """Hours studied per day (Mon–Sun) for the current ISO week."""
    now = datetime.now(timezone.utc)
    week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    docs = await db.study_sessions.find({"created_at": {"$gte": week_start}}, {"_id": 0}).to_list(1000)
    daily_mins = [0] * 7
    for d in docs:
        ts = d.get("created_at")
        if isinstance(ts, datetime):
            idx = ts.weekday()
            if 0 <= idx <= 6:
                daily_mins[idx] += d.get("duration_minutes", 0)
    daily_hours = [round(m / 60, 1) for m in daily_mins]
    return {"daily_hours": daily_hours, "total_hours": round(sum(daily_mins) / 60, 1)}


@api_router.post("/errors", response_model=ErrorScan)
async def create_error(body: ErrorScanCreate):
    err = ErrorScan(**body.dict())
    await db.error_scans.insert_one(err.dict())
    return err


@api_router.get("/errors", response_model=List[ErrorScan])
async def get_errors():
    docs = await db.error_scans.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs


@api_router.get("/stats/errors")
async def get_error_stats():
    """Error count per subject with unique topics."""
    docs = await db.error_scans.find({}, {"_id": 0}).to_list(1000)
    stats: dict = {}
    for d in docs:
        subj = d["subject"]
        if subj not in stats:
            stats[subj] = {"subject": subj, "errors": 0, "topics": []}
        stats[subj]["errors"] += 1
        if d["topic"] not in stats[subj]["topics"]:
            stats[subj]["topics"].append(d["topic"])
    return sorted(stats.values(), key=lambda x: x["errors"], reverse=True)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
