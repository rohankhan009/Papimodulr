from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.responses import PlainTextResponse
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import asyncio
import logging
import uuid
import html
import bcrypt
import jwt
import httpx
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
DEVICE_SECRET = os.environ.get('DEVICE_SECRET', '')

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ---------------- Helpers ----------------
def now_iso():
    return datetime.now(timezone.utc).isoformat()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_admin(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:] if auth_header.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def format_telegram_message(sender: str, body: str) -> str:
    return f"<b>{html.escape(sender)}</b>\n{html.escape(body)}"


async def send_telegram(token: str, chat_id: str, text: str) -> int:
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.post(url, json=payload)
    data = r.json()
    if not data.get("ok"):
        raise Exception(data.get("description", "Telegram API error"))
    return data["result"]["message_id"]


# ---------------- Models ----------------
class LoginInput(BaseModel):
    email: str
    password: str


class ClientCreate(BaseModel):
    key: str
    name: str
    bot_token: str
    chat_id: str
    active: bool = True
    default_sender: Optional[str] = None


class ClientUpdate(BaseModel):
    key: Optional[str] = None
    name: Optional[str] = None
    bot_token: Optional[str] = None
    chat_id: Optional[str] = None
    active: Optional[bool] = None
    default_sender: Optional[str] = None


class InjectInput(BaseModel):
    client_key: str
    sender_id: str
    body: str


# ---------------- Auth routes ----------------
@api_router.post("/auth/login")
async def login(data: LoginInput):
    email = data.email.strip().lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Galat email ya password")
    token = create_token(user["id"], user["email"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "name": user.get("name", "Admin")}}


@api_router.get("/auth/me")
async def me(admin: dict = Depends(get_current_admin)):
    return admin


# ---------------- Public routes ----------------
@api_router.get("/clients/public")
async def public_clients():
    clients = await db.clients.find({"active": True}, {"_id": 0, "bot_token": 0, "chat_id": 0}).to_list(500)
    return clients


@api_router.post("/inject")
async def inject(data: InjectInput):
    key = data.client_key.strip()
    clientdoc = await db.clients.find_one({"key": {"$regex": f"^{key}$", "$options": "i"}}, {"_id": 0})
    if not clientdoc:
        raise HTTPException(status_code=404, detail=f"Client key '{key}' nahi mila")
    if not clientdoc.get("active", True):
        raise HTTPException(status_code=400, detail="Ye client inactive hai")

    text = format_telegram_message(data.sender_id, data.body)
    log = {
        "id": str(uuid.uuid4()),
        "client_key": clientdoc["key"],
        "client_name": clientdoc["name"],
        "sender_id": data.sender_id,
        "body": data.body,
        "direction": "web_to_telegram",
        "timestamp": now_iso(),
        "status": "pending",
        "telegram_message_id": None,
        "error": None,
    }
    try:
        msg_id = await send_telegram(clientdoc["bot_token"], clientdoc["chat_id"], text)
        log["status"] = "delivered"
        log["telegram_message_id"] = msg_id
    except Exception as e:
        log["status"] = "failed"
        log["error"] = str(e)
    await db.logs.insert_one({**log})

    # Queue for on-device SMS injection (phone daemon pulls this)
    one_line_body = " ".join(data.body.splitlines())
    await db.pending_injects.insert_one({
        "id": str(uuid.uuid4()),
        "client_key": clientdoc["key"],
        "sender_id": data.sender_id,
        "body": one_line_body,
        "status": "queued",
        "created_at": now_iso(),
        "source": "web",
    })

    if log["status"] == "failed":
        return {"status": "failed", "detail": f"Telegram par bhejne me error: {log['error']}", "log": log}
    return {"status": "delivered", "log": log}


@api_router.get("/device/pull", response_class=PlainTextResponse)
async def device_pull(key: str, secret: str, max: int = 20):
    if not DEVICE_SECRET or secret != DEVICE_SECRET:
        raise HTTPException(status_code=403, detail="Invalid device secret")
    items = await db.pending_injects.find(
        {"client_key": {"$regex": f"^{key}$", "$options": "i"}, "status": "queued"},
        {"_id": 0},
    ).sort("created_at", 1).to_list(max)
    if not items:
        return ""
    ids = [it["id"] for it in items]
    await db.pending_injects.update_many(
        {"id": {"$in": ids}},
        {"$set": {"status": "delivered", "delivered_at": now_iso()}},
    )
    # One record per line: sender|body  (matches the phone SmsBroadcaster format)
    lines = [f"{it['sender_id']}|{it['body']}" for it in items]
    return "\n".join(lines)


@api_router.get("/logs")
async def public_logs(client_key: Optional[str] = None, limit: int = 50):
    q = {}
    if client_key:
        q["client_key"] = {"$regex": f"^{client_key}$", "$options": "i"}
    logs = await db.logs.find(q, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return logs


# ---------------- Admin routes ----------------
@api_router.get("/admin/clients")
async def admin_list_clients(admin: dict = Depends(get_current_admin)):
    return await db.clients.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api_router.post("/admin/clients")
async def admin_create_client(data: ClientCreate, admin: dict = Depends(get_current_admin)):
    existing = await db.clients.find_one({"key": {"$regex": f"^{data.key.strip()}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="Ye key pehle se maujood hai")
    doc = {
        "id": str(uuid.uuid4()),
        "key": data.key.strip(),
        "name": data.name.strip(),
        "bot_token": data.bot_token.strip(),
        "chat_id": data.chat_id.strip(),
        "active": data.active,
        "default_sender": (data.default_sender.strip() if data.default_sender else None),
        "created_at": now_iso(),
    }
    await db.clients.insert_one({**doc})
    return doc


@api_router.put("/admin/clients/{client_id}")
async def admin_update_client(client_id: str, data: ClientUpdate, admin: dict = Depends(get_current_admin)):
    update = {k: (v.strip() if isinstance(v, str) else v) for k, v in data.model_dump(exclude_none=True).items()}
    if not update:
        raise HTTPException(status_code=400, detail="Kuch update karne ko nahi hai")
    result = await db.clients.update_one({"id": client_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Client nahi mila")
    return await db.clients.find_one({"id": client_id}, {"_id": 0})


@api_router.delete("/admin/clients/{client_id}")
async def admin_delete_client(client_id: str, admin: dict = Depends(get_current_admin)):
    result = await db.clients.delete_one({"id": client_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Client nahi mila")
    return {"status": "deleted"}


@api_router.post("/admin/clients/{client_id}/test")
async def admin_test_client(client_id: str, admin: dict = Depends(get_current_admin)):
    c = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Client nahi mila")
    try:
        text = format_telegram_message("PAPIATMA MODULE", "Test connection successful ✅")
        msg_id = await send_telegram(c["bot_token"], c["chat_id"], text)
        return {"status": "ok", "message_id": msg_id}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@api_router.get("/admin/logs")
async def admin_logs(admin: dict = Depends(get_current_admin), limit: int = 300):
    return await db.logs.find({}, {"_id": 0}).sort("timestamp", -1).to_list(limit)


@api_router.get("/admin/stats")
async def admin_stats(admin: dict = Depends(get_current_admin)):
    total_clients = await db.clients.count_documents({})
    active_clients = await db.clients.count_documents({"active": True})
    total_sent = await db.logs.count_documents({})
    delivered = await db.logs.count_documents({"status": "delivered"})
    failed = await db.logs.count_documents({"status": "failed"})
    success_rate = round((delivered / total_sent) * 100, 1) if total_sent else 0
    return {
        "total_clients": total_clients,
        "active_clients": active_clients,
        "total_sent": total_sent,
        "delivered": delivered,
        "failed": failed,
        "success_rate": success_rate,
    }


# ---------------- Telegram -> SMS polling ----------------
async def tg_get_updates(token: str, offset):
    url = f"https://api.telegram.org/bot{token}/getUpdates"
    params = {"timeout": 0, "limit": 20}
    if offset is not None:
        params["offset"] = offset
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.get(url, params=params)
    return r.json()


def parse_sender_body(text: str, default_sender: str):
    text = text.strip()
    if "|" in text:
        s, b = text.split("|", 1)
        return (s.strip() or default_sender), b.strip()
    if "\n" in text:
        first, rest = text.split("\n", 1)
        return (first.strip() or default_sender), rest.strip()
    return default_sender, text


async def queue_inject(clientdoc: dict, sender_id: str, body: str, source: str):
    one_line_body = " ".join((body or "").splitlines())
    await db.pending_injects.insert_one({
        "id": str(uuid.uuid4()),
        "client_key": clientdoc["key"],
        "sender_id": sender_id,
        "body": one_line_body,
        "status": "queued",
        "created_at": now_iso(),
        "source": source,
    })
    await db.logs.insert_one({
        "id": str(uuid.uuid4()),
        "client_key": clientdoc["key"],
        "client_name": clientdoc["name"],
        "sender_id": sender_id,
        "body": one_line_body,
        "direction": source,
        "timestamp": now_iso(),
        "status": "queued",
        "telegram_message_id": None,
        "error": None,
    })


async def poll_client_telegram(clientdoc: dict):
    state = await db.tg_state.find_one({"client_id": clientdoc["id"]})
    offset = state["offset"] if state else None
    data = await tg_get_updates(clientdoc["bot_token"], offset)
    if not data.get("ok"):
        return
    updates = data.get("result", [])
    if not updates:
        return
    initializing = state is None  # pehli baar: purana backlog inject mat karo
    last_offset = offset
    for upd in updates:
        last_offset = upd["update_id"] + 1
        if initializing:
            continue
        msg = upd.get("message") or upd.get("channel_post") or upd.get("edited_message")
        if not msg:
            continue
        text = msg.get("text") or msg.get("caption")
        if not text:
            continue
        chat = msg.get("chat", {})
        # security: sirf isi client ke configured chat_id se aaye message accept karo
        if str(chat.get("id")) != str(clientdoc.get("chat_id")):
            continue
        default_sender = clientdoc.get("default_sender") or clientdoc.get("name") or "SMS"
        sender_id, body = parse_sender_body(text, default_sender)
        if not body:
            continue
        await queue_inject(clientdoc, sender_id, body, "telegram_to_sms")
    await db.tg_state.update_one(
        {"client_id": clientdoc["id"]},
        {"$set": {"offset": last_offset, "updated_at": now_iso()}},
        upsert=True,
    )


async def telegram_poll_loop():
    await asyncio.sleep(5)
    logger.info("Telegram->SMS poll loop started")
    while True:
        try:
            clients = await db.clients.find({"active": True}, {"_id": 0}).to_list(500)
            for c in clients:
                if not c.get("bot_token") or not c.get("chat_id"):
                    continue
                try:
                    await poll_client_telegram(c)
                except Exception as e:
                    logger.warning(f"tg poll error for {c.get('key')}: {e}")
        except Exception as e:
            logger.warning(f"tg poll loop error: {e}")
        await asyncio.sleep(3)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.clients.create_index("key")
    await db.pending_injects.create_index("client_key")
    await db.tg_state.create_index("client_id", unique=True)
    await db.users.create_index("email", unique=True)
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@teleinject.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "admin",
            "created_at": now_iso(),
        })
        logger.info("Admin seeded")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
        logger.info("Admin password updated")
    asyncio.create_task(telegram_poll_loop())


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
