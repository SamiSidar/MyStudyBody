from fastapi import FastAPI, APIRouter, HTTPException, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

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
    user_id: str
    subject: str
    duration_minutes: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StudySessionCreate(BaseModel):
    subject: str
    duration_minutes: int


class ErrorScan(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
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


def require_user(x_user_id: Optional[str]) -> str:
    """Raise 401 if user header is missing."""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Authentication required. Send X-User-ID header.")
    return x_user_id


@api_router.post("/sessions", response_model=StudySession)
async def create_session(body: StudySessionCreate, x_user_id: Optional[str] = Header(default=None)):
    uid = require_user(x_user_id)
    session = StudySession(user_id=uid, **body.dict())
    await db.study_sessions.insert_one(session.dict())
    return session


@api_router.get("/sessions", response_model=List[StudySession])
async def get_sessions(x_user_id: Optional[str] = Header(default=None)):
    uid = require_user(x_user_id)
    docs = await db.study_sessions.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs


@api_router.get("/stats/weekly")
async def get_weekly_stats(x_user_id: Optional[str] = Header(default=None)):
    """Hours studied per day (Mon–Sun) for the current ISO week, filtered by user."""
    uid = require_user(x_user_id)
    now = datetime.now(timezone.utc)
    week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    docs = await db.study_sessions.find(
        {"user_id": uid, "created_at": {"$gte": week_start}}, {"_id": 0}
    ).to_list(1000)
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
async def create_error(body: ErrorScanCreate, x_user_id: Optional[str] = Header(default=None)):
    uid = require_user(x_user_id)
    err = ErrorScan(user_id=uid, **body.dict())
    await db.error_scans.insert_one(err.dict())
    return err


@api_router.get("/errors", response_model=List[ErrorScan])
async def get_errors(x_user_id: Optional[str] = Header(default=None)):
    uid = require_user(x_user_id)
    docs = await db.error_scans.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs


@api_router.get("/stats/errors")
async def get_error_stats(x_user_id: Optional[str] = Header(default=None)):
    """Error count per subject with unique topics, filtered by user."""
    uid = require_user(x_user_id)
    docs = await db.error_scans.find({"user_id": uid}, {"_id": 0}).to_list(1000)
    stats: dict = {}
    for d in docs:
        subj = d["subject"]
        if subj not in stats:
            stats[subj] = {"subject": subj, "errors": 0, "topics": []}
        stats[subj]["errors"] += 1
        if d["topic"] not in stats[subj]["topics"]:
            stats[subj]["topics"].append(d["topic"])
    return sorted(stats.values(), key=lambda x: x["errors"], reverse=True)


# ── AI Endpoints ──────────────────────────────────────────────────────

class ClassifyErrorRequest(BaseModel):
    notes: str
    subject_hint: str = ""
    topic_hint: str = ""


class AnalyzeImageRequest(BaseModel):
    image_base64: str  # Pure base64, no data URL prefix


def parse_json_response(response: str) -> dict:
    """Safely parse JSON from LLM response, handling markdown code blocks."""
    clean = response.strip()
    if "```" in clean:
        parts = clean.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            try:
                return json.loads(part)
            except Exception:
                continue
    return json.loads(clean)


@api_router.post("/ai/analyze-image")
async def ai_analyze_image(body: AnalyzeImageRequest):
    """
    Use Gemini Vision to read a question photo and auto-classify it.
    Returns subject, topic, question_summary, and a Turkish insight.
    """
    if not EMERGENT_LLM_KEY:
        return {
            "subject": "Math",
            "topic": "Genel",
            "question_summary": "Goruntu analiz edilemedi.",
            "insight": "AI servisi yapılandırılmamış."
        }

    try:
        from emergentintegrations.llm.chat import ImageContent

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=str(uuid.uuid4()),
            system_message=(
                "Sen Türk lise öğrencilerine yardım eden bir yapay zeka asistanısın. "
                "Öğrencinin yanlış yaptığı sorunun fotoğrafını analiz edip derse ve konuya göre sınıflandır. "
                "Yalnızca geçerli JSON döndür, başka hiçbir şey yazma."
            )
        ).with_model("gemini", "gemini-2.5-flash")

        available_subjects = [
            "Math", "Physics", "Chemistry", "Biology",
            "History", "Geography", "Turkish", "English", "Philosophy"
        ]

        prompt = f"""Bu fotoğrafta bir öğrencinin yanlış yaptığı bir sınav sorusu var.

Fotoğraftaki soruyu dikkatlice incele:
1. Hangi derse ait olduğunu belirle
2. Sorunun hangi konudan geldiğini belirle
3. Soruyu kısaca özetle (maksimum 1 cümle)
4. Bu tür sorularda sık yapılan hatayı Türkçe açıkla

Kullanılabilir dersler: {', '.join(available_subjects)}

YALNIZCA şu JSON formatında yanıt ver:
{{
  "subject": "dersin adı (yukarıdaki listeden)",
  "topic": "sorunun konusu (örn: Türevler, Kuvvet-İvme, Osmanlı Tarihi)",
  "question_summary": "soruyu 1 cümlede özetle",
  "insight": "bu konuda dikkat edilmesi gereken nokta (Türkçe, 1-2 cümle)"
}}"""

        msg = UserMessage(
            text=prompt,
            file_contents=[ImageContent(image_base64=body.image_base64)]
        )
        response = await chat.send_message(msg)
        result = parse_json_response(response)

        # Validate subject
        if result.get("subject") not in available_subjects:
            result["subject"] = "Math"

        return result

    except Exception as e:
        logger.error(f"AI analyze image error: {e}")
        return {
            "subject": "Math",
            "topic": "Genel",
            "question_summary": "Soru analiz edilemedi.",
            "insight": "Fotoğraf işlenemedi, lütfen notlarınızı manuel olarak girin."
        }


@api_router.post("/ai/classify-error")
async def ai_classify_error(body: ClassifyErrorRequest):
    """Use Gemini to classify an error into subject and topic based on user notes."""
    if not EMERGENT_LLM_KEY:
        return {"subject": body.subject_hint or "Math", "topic": body.topic_hint or "General", "insight": "AI servisi yapılandırılmamış."}

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=str(uuid.uuid4()),
            system_message=(
                "You are a study assistant for Turkish high school students. "
                "Classify academic errors into subjects and topics. "
                "Return valid JSON only, no extra text or markdown."
            )
        ).with_model("gemini", "gemini-2.5-flash")

        available_subjects = ["Math", "Physics", "Chemistry", "Biology", "History", "Geography", "Turkish", "English", "Philosophy"]
        subject_hint_text = f"Current subject hint: {body.subject_hint}" if body.subject_hint else ""
        topic_hint_text = f"Current topic hint: {body.topic_hint}" if body.topic_hint else ""

        prompt = f"""A student made an error. Based on their notes, classify the error.

Student notes: "{body.notes}"
{subject_hint_text}
{topic_hint_text}

Available subjects: {', '.join(available_subjects)}

Return ONLY this JSON:
{{
  "subject": "subject name from the available list",
  "topic": "specific academic topic within that subject",
  "insight": "one sentence in Turkish about this type of error and how to avoid it"
}}"""

        msg = UserMessage(text=prompt)
        response = await chat.send_message(msg)
        result = parse_json_response(response)
        # Validate subject is from allowed list
        if result.get("subject") not in available_subjects:
            result["subject"] = body.subject_hint or "Math"
        return result
    except Exception as e:
        logger.error(f"AI classify error: {e}")
        return {
            "subject": body.subject_hint or "Math",
            "topic": body.topic_hint or "General",
            "insight": "Hata sınıflandırılamadı, lütfen manuel olarak seçin."
        }


@api_router.get("/ai/study-report")
async def ai_study_report(x_user_id: Optional[str] = Header(default=None)):
    """Generate a personalized AI study report based on user's errors and sessions."""
    uid = require_user(x_user_id)

    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI servisi yapılandırılmamış.")

    # Fetch data
    errors = await db.error_scans.find({"user_id": uid}, {"_id": 0}).to_list(1000)
    sessions = await db.study_sessions.find({"user_id": uid}, {"_id": 0}).to_list(1000)

    if not errors and not sessions:
        return {
            "weak_subjects": [],
            "recommendations": [],
            "insights": ["Henüz yeterli veri yok. Hata kaydetmeye ve çalışma oturumları oluşturmaya başlayın."],
            "topic_breakdown": []
        }

    # Aggregate error data by subject → topic
    error_agg: Dict[str, Any] = {}
    for err in errors:
        subj = err.get("subject", "Unknown")
        topic = err.get("topic", "Unknown")
        if subj not in error_agg:
            error_agg[subj] = {"total": 0, "topics": {}}
        error_agg[subj]["total"] += 1
        error_agg[subj]["topics"][topic] = error_agg[subj]["topics"].get(topic, 0) + 1

    # Aggregate session data
    session_agg: Dict[str, int] = {}
    for sess in sessions:
        subj = sess.get("subject", "Unknown")
        session_agg[subj] = session_agg.get(subj, 0) + sess.get("duration_minutes", 0)

    # Build summary
    error_summary = []
    for subj, data in sorted(error_agg.items(), key=lambda x: -x[1]["total"]):
        topic_list = sorted(data["topics"].items(), key=lambda x: -x[1])
        error_summary.append({
            "subject": subj,
            "total_errors": data["total"],
            "topics": [{"topic": t, "count": c} for t, c in topic_list],
            "study_minutes": session_agg.get(subj, 0)
        })

    session_summary = [
        {"subject": s, "total_minutes": m, "total_hours": round(m / 60, 1)}
        for s, m in sorted(session_agg.items(), key=lambda x: -x[1])
    ]

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=str(uuid.uuid4()),
            system_message=(
                "You are a study advisor for a Turkish high school student. "
                "Analyze error patterns and study time to create personalized recommendations. "
                "Always respond in Turkish. Return valid JSON only."
            )
        ).with_model("gemini", "gemini-2.5-flash")

        prompt = f"""Bir Türk lise öğrencisinin çalışma verileri:

HATA ANALİZİ (ders > konu > hata sayısı):
{json.dumps(error_summary, ensure_ascii=False)}

ÇALIŞMA SÜRELERİ:
{json.dumps(session_summary, ensure_ascii=False)}

Bu verilere dayanarak kapsamlı bir analiz yap. Şunları göz önünde bulundur:
- Hangi ders ve konularda en çok hata yapılıyor?
- Çalışılan süre ile yapılan hata oranı nasıl?
- Çalışma süresi az ama hata çok olan konular öncelikli

Yanıtı YALNIZCA şu JSON formatında ver:
{{
  "weak_subjects": [
    {{
      "subject": "ders adı",
      "topic": "en çok hata yapılan konu",
      "error_count": hata_sayısı,
      "study_minutes": çalışma_dakikası,
      "priority": "high veya medium veya low",
      "reason": "kısa Türkçe açıklama"
    }}
  ],
  "recommendations": [
    {{
      "subject": "ders adı",
      "topic": "konu adı",
      "task": "yapılacak görev (Türkçe)",
      "reason": "neden bu öncelikli (Türkçe)",
      "priority": "high veya medium veya low"
    }}
  ],
  "topic_breakdown": [
    {{
      "subject": "ders",
      "topic": "konu",
      "error_count": sayı
    }}
  ],
  "insights": ["İçgörü 1 (Türkçe)", "İçgörü 2 (Türkçe)", "İçgörü 3 (Türkçe)"]
}}"""

        msg = UserMessage(text=prompt)
        response = await chat.send_message(msg)
        result = parse_json_response(response)
        return result

    except Exception as e:
        logger.error(f"AI study report error: {e}")
        # Fallback from raw data
        weak = sorted(error_agg.items(), key=lambda x: -x[1]["total"])
        recs = []
        for subj, data in weak[:4]:
            top_topic = max(data["topics"].items(), key=lambda x: x[1])[0] if data["topics"] else subj
            recs.append({
                "subject": subj,
                "topic": top_topic,
                "task": f"{top_topic} konusunu tekrar et",
                "reason": f"{data['total']} hata yapıldı",
                "priority": "high" if data["total"] >= 5 else "medium"
            })
        topic_bd = []
        for subj, data in weak:
            for t, c in data["topics"].items():
                topic_bd.append({"subject": subj, "topic": t, "error_count": c})
        return {
            "weak_subjects": [
                {
                    "subject": s,
                    "topic": list(d["topics"].keys())[0] if d["topics"] else s,
                    "error_count": d["total"],
                    "study_minutes": session_agg.get(s, 0),
                    "priority": "high" if d["total"] >= 5 else "medium",
                    "reason": f"{d['total']} hata kaydedildi"
                }
                for s, d in weak[:5]
            ],
            "recommendations": recs,
            "topic_breakdown": topic_bd,
            "insights": ["Verileriniz analiz edildi. Hata oranı yüksek konulara öncelik verin."]
        }


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
