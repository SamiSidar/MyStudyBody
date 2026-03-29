from fastapi import FastAPI, APIRouter, HTTPException, Header
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
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
    image_base64: str = ""
    question_summary: str = ""
    ai_insight: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ErrorScanCreate(BaseModel):
    subject: str
    topic: str
    notes: str = ""
    image_base64: str = ""
    question_summary: str = ""
    ai_insight: str = ""


class ExamQuestionResult(BaseModel):
    question_id: str
    understood: bool


class ExamResultsCreate(BaseModel):
    results: List[ExamQuestionResult]


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


import base64 as b64lib

IMAGES_DIR = Path("/app/backend/images")
IMAGES_DIR.mkdir(exist_ok=True)


@api_router.post("/errors", response_model=ErrorScan)
async def create_error(body: ErrorScanCreate, x_user_id: Optional[str] = Header(default=None)):
    uid = require_user(x_user_id)
    err = ErrorScan(user_id=uid, **body.dict())

    # Save image to disk if provided, store URL instead of base64
    if body.image_base64:
        try:
            img_data = b64lib.b64decode(body.image_base64)
            img_path = IMAGES_DIR / f"{err.id}.jpg"
            img_path.write_bytes(img_data)
            err.image_base64 = f"/api/images/{err.id}.jpg"  # store URL, not raw base64
            logger.info(f"Image saved: {img_path} ({len(img_data)} bytes)")
        except Exception as e:
            logger.error(f"Image save error: {e}")
            err.image_base64 = ""

    doc = err.dict()
    await db.error_scans.insert_one(doc)
    return err


@api_router.get("/images/{image_id}")
async def serve_image(image_id: str):
    """Serve a stored question image."""
    img_path = IMAGES_DIR / image_id
    if not img_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(str(img_path), media_type="image/jpeg")


@api_router.get("/errors", response_model=List[ErrorScan])
async def get_errors(x_user_id: Optional[str] = Header(default=None)):
    uid = require_user(x_user_id)
    docs = await db.error_scans.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs


@api_router.get("/user/settings")
async def get_user_settings(x_user_id: Optional[str] = Header(default=None)):
    """Kullanıcı ayarları: haftalık hedef, bildirim tercihi."""
    uid = require_user(x_user_id)
    settings = await db.user_settings.find_one({"user_id": uid}, {"_id": 0}) or {}
    return {
        "weekly_goal_hours": settings.get("weekly_goal_hours"),
        "notifications_disabled": settings.get("notifications_disabled", False),
    }


@api_router.put("/user/settings")
async def update_user_settings(
    payload: Dict[str, Any],
    x_user_id: Optional[str] = Header(default=None),
):
    """Haftalık hedef ve bildirim ayarı kaydet."""
    uid = require_user(x_user_id)
    allowed = {k: v for k, v in payload.items() if k in ("weekly_goal_hours", "notifications_disabled")}
    await db.user_settings.update_one(
        {"user_id": uid},
        {"$set": {**allowed, "user_id": uid, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"status": "ok"}


@api_router.get("/stats/performance")
async def get_performance_stats(x_user_id: Optional[str] = Header(default=None)):
    """
    Haftalık Hedef %, Verimlilik %, Odak Skoru hesapla.

    Verimlilik = ort(sınav_anladım_oranı, hata_takip_oranı)
    Odak Skoru = ortalama_oturum_süresi → harf notu
                 + bildirimler kapalıysa %10 bonus
    """
    uid = require_user(x_user_id)

    def parse_dt(s) -> datetime:
        if isinstance(s, datetime):
            return s if s.tzinfo else s.replace(tzinfo=timezone.utc)
        return datetime.fromisoformat(str(s).replace("Z", "+00:00"))

    # ── 1. Kullanıcı ayarları
    settings = await db.user_settings.find_one({"user_id": uid}, {"_id": 0}) or {}
    weekly_goal: Optional[int] = settings.get("weekly_goal_hours")
    notifs_disabled: bool = settings.get("notifications_disabled", False)

    # ── 2. Bu haftanın çalışma saatleri
    week_start = datetime.now(timezone.utc) - timedelta(days=7)
    all_sessions = await db.study_sessions.find({"user_id": uid}, {"_id": 0}).to_list(2000)
    weekly_sessions = [
        s for s in all_sessions
        if parse_dt(s.get("created_at", "2000-01-01T00:00:00Z")) > week_start
    ]
    weekly_hours = round(sum(s.get("duration_minutes", 0) for s in weekly_sessions) / 60, 1)

    # ── 3. Haftalık Hedef %
    goal_pct: Optional[int] = None
    if weekly_goal and weekly_goal > 0:
        goal_pct = min(100, round(weekly_hours / weekly_goal * 100))

    # ── 4. Verimlilik
    # A) Sınav "Anladım" oranı
    exam_results = await db.exam_results.find({"user_id": uid}, {"_id": 0}).to_list(2000)
    exam_score: Optional[int] = None
    if exam_results:
        anladim = sum(1 for r in exam_results if r.get("understood"))
        exam_score = round(anladim / len(exam_results) * 100)

    # B) Hata takip oranı: hata tarihinden SONRA aynı dersten oturum açmış mı?
    errors = await db.error_scans.find({"user_id": uid}, {"_id": 0}).to_list(2000)
    follow_score: Optional[int] = None
    if errors:
        follow_count = 0
        for err in errors:
            err_time = parse_dt(err.get("created_at", "2000-01-01T00:00:00Z"))
            subj = err.get("subject", "")
            if any(
                s.get("subject") == subj
                and parse_dt(s.get("created_at", "2000-01-01T00:00:00Z")) > err_time
                for s in all_sessions
            ):
                follow_count += 1
        follow_score = round(follow_count / len(errors) * 100)

    components = [c for c in [exam_score, follow_score] if c is not None]
    efficiency_pct: Optional[int] = round(sum(components) / len(components)) if components else None

    # ── 5. Odak Skoru
    focus_grade: Optional[str] = None
    if all_sessions:
        avg_min = sum(s.get("duration_minutes", 0) for s in all_sessions) / len(all_sessions)
        effective = avg_min * 1.1 if notifs_disabled else avg_min  # bildirim bonusu
        if effective >= 50:
            focus_grade = "A+"
        elif effective >= 40:
            focus_grade = "A"
        elif effective >= 25:
            focus_grade = "B+"
        elif effective >= 15:
            focus_grade = "B"
        else:
            focus_grade = "C"

    return {
        "weekly_goal_hours": weekly_goal,
        "weekly_hours": weekly_hours,
        "weekly_goal_pct": goal_pct,
        "efficiency_pct": efficiency_pct,
        "focus_grade": focus_grade,
        "notifications_disabled": notifs_disabled,
    }


@api_router.get("/stats/subjects")
async def get_subject_stats(x_user_id: Optional[str] = Header(default=None)):
    """Total study time per subject (all-time), plus overall totals."""
    uid = require_user(x_user_id)
    docs = await db.study_sessions.find({"user_id": uid}, {"_id": 0}).to_list(1000)
    stats: Dict[str, int] = {}
    for d in docs:
        subj = d.get("subject", "Unknown")
        stats[subj] = stats.get(subj, 0) + d.get("duration_minutes", 0)
    total_minutes = sum(stats.values())
    subject_list = [
        {"subject": s, "total_minutes": m, "total_hours": round(m / 60, 1)}
        for s, m in sorted(stats.items(), key=lambda x: -x[1])
    ]
    return {
        "subjects": subject_list,
        "total_minutes": total_minutes,
        "total_hours": round(total_minutes / 60, 1),
        "session_count": len(docs),
    }


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


# ── Exam Endpoints ────────────────────────────────────────────────────

@api_router.get("/exam/questions")
async def get_exam_questions(
    time_filter: str = "month",
    subject: str = "all",
    x_user_id: Optional[str] = Header(default=None)
):
    """Return questions filtered by time range and subject for practice exam."""
    uid = require_user(x_user_id)
    query: Dict[str, Any] = {"user_id": uid}

    now = datetime.now(timezone.utc)
    if time_filter == "week":
        cutoff = now - timedelta(days=7)
    elif time_filter == "month":
        cutoff = now - timedelta(days=30)
    elif time_filter == "year":
        cutoff = now - timedelta(days=365)
    else:
        cutoff = None

    if cutoff:
        query["created_at"] = {"$gte": cutoff}
    if subject != "all":
        query["subject"] = subject

    docs = await db.error_scans.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    # Shuffle for variety
    import random
    random.shuffle(docs)
    return docs


@api_router.post("/exam/results")
async def save_exam_results(body: ExamResultsCreate, x_user_id: Optional[str] = Header(default=None)):
    """Save per-question understood/hard results for a completed exam."""
    uid = require_user(x_user_id)
    reviewed_at = datetime.now(timezone.utc)
    for r in body.results:
        await db.error_scans.update_one(
            {"id": r.question_id, "user_id": uid},
            {"$set": {
                "last_review": {
                    "understood": r.understood,
                    "reviewed_at": reviewed_at
                }
            }}
        )
    return {"success": True, "count": len(body.results)}


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
