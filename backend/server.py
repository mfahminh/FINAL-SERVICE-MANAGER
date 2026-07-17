from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import asyncio
import logging
import secrets
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

# ---------- Setup ----------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ['JWT_SECRET']

app = FastAPI(title="Service HP Manager API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("service-hp")

# ---------- Helpers ----------
def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(p: str, h: str) -> bool:
    return bcrypt.checkpw(p.encode("utf-8"), h.encode("utf-8"))

def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {"sub": user_id, "email": email, "role": role,
               "exp": datetime.now(timezone.utc) + timedelta(hours=8), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def gen_id() -> str:
    return str(uuid.uuid4())

def clean_doc(d: dict) -> dict:
    if d and "_id" in d:
        d.pop("_id", None)
    return d

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_roles(*roles):
    async def checker(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Forbidden: insufficient role")
        return user
    return checker

async def audit(user: dict, action: str, entity: str, entity_id: str = "", details: dict = None, ip: str = ""):
    await db.audit_logs.insert_one({
        "id": gen_id(),
        "user_id": user.get("id"),
        "user_name": user.get("name"),
        "user_role": user.get("role"),
        "action": action,
        "entity": entity,
        "entity_id": entity_id,
        "details": details or {},
        "ip": ip,
        "created_at": now_iso(),
    })

# ---------- Models ----------
Role = Literal["owner", "admin", "teknisi", "kasir"]

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class ForgotIn(BaseModel):
    email: EmailStr

class ResetIn(BaseModel):
    token: str
    new_password: str

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: Role
    phone: Optional[str] = ""

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[Role] = None
    phone: Optional[str] = None
    password: Optional[str] = None

class CustomerIn(BaseModel):
    name: str
    phone: str
    whatsapp: Optional[str] = ""
    address: Optional[str] = ""
    email: Optional[str] = ""
    notes: Optional[str] = ""

class SparepartIn(BaseModel):
    category: str
    code: str
    name: str
    brand: Optional[str] = ""
    cost_price: float = 0
    sell_price: float = 0
    stock: int = 0
    min_stock: int = 1
    supplier_id: Optional[str] = ""
    location: Optional[str] = ""
    photo: Optional[str] = ""

class SupplierIn(BaseModel):
    name: str
    address: Optional[str] = ""
    whatsapp: Optional[str] = ""
    email: Optional[str] = ""
    pic: Optional[str] = ""

class ServiceItem(BaseModel):
    sparepart_id: str
    name: str
    qty: int
    price: float

class ServiceFeeUpdate(BaseModel):
    service_fee: float

class ServiceCreate(BaseModel):
    customer_id: str
    brand: str
    model: str
    imei1: Optional[str] = ""
    imei2: Optional[str] = ""
    color: Optional[str] = ""
    accessories: List[str] = []
    complaint: str
    device_password: Optional[str] = ""
    pattern: Optional[str] = ""
    pin: Optional[str] = ""
    estimated_cost: float = 0
    dp: float = 0
    photos: List[str] = []

class DiagnoseIn(BaseModel):
    diagnosis: str
    damage: str
    action: str
    estimated_cost: float
    estimated_days: int
    internal_notes: Optional[str] = ""
    photos: List[str] = []

class StatusUpdate(BaseModel):
    status: str
    note: Optional[str] = ""
    sparepart_action: Optional[Literal["return", "charge"]] = None

class PaymentIn(BaseModel):
    service_id: str
    amount: float
    method: Literal["cash", "transfer", "qris", "ewallet"]
    type: Literal["dp", "pelunasan", "full"]
    note: Optional[str] = ""

class PickupIn(BaseModel):
    unit_ok: bool
    paid: bool
    warranty_explained: bool
    signature: Optional[str] = ""
    photo: Optional[str] = ""
    warranty_days: int = 30

class QCItem(BaseModel):
    key: str
    name: str
    ok: bool
    note: Optional[str] = ""

class QCCheckIn(BaseModel):
    items: List[QCItem]
    overall_note: Optional[str] = ""

class PurchaseItem(BaseModel):
    sparepart_id: str
    name: str
    qty: int
    price: float

class PurchaseIn(BaseModel):
    supplier_id: str
    items: List[PurchaseItem]
    note: Optional[str] = ""

class PurchaseUpdate(BaseModel):
    supplier_id: Optional[str] = None
    items: Optional[List[PurchaseItem]] = None
    note: Optional[str] = None

# --- Direct Sale (POS) ---
class DirectSaleItem(BaseModel):
    sparepart_id: str
    name: str
    qty: int
    price: float  # harga jual satuan (bisa diedit di kasir)

class DirectSaleIn(BaseModel):
    items: List[DirectSaleItem]
    customer_name: Optional[str] = "Pelanggan Umum"
    customer_phone: Optional[str] = ""
    method: str = "cash"  # cash, transfer, qris
    paid: float = 0
    discount: float = 0
    note: Optional[str] = ""

class SettingsIn(BaseModel):
    shop_name: Optional[str] = None
    app_name: Optional[str] = None
    address: Optional[str] = None
    whatsapp: Optional[str] = None
    instagram: Optional[str] = None
    facebook: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    tax_percent: Optional[float] = None
    default_service_fee: Optional[float] = None
    logo: Optional[str] = None
    logo_login: Optional[str] = None
    favicon: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    footer_text: Optional[str] = None
    label_size: Optional[str] = None
    invoice_template: Optional[str] = None
    wa_template: Optional[str] = None
    # Custom print headers (nota, label, qr)
    print_header_title: Optional[str] = None
    print_header_subtitle: Optional[str] = None
    print_header_address: Optional[str] = None
    print_header_phone: Optional[str] = None
    print_footer_text: Optional[str] = None
    label_header_title: Optional[str] = None
    label_footer_text: Optional[str] = None
    qr_header_title: Optional[str] = None
    qr_footer_text: Optional[str] = None
    # WhatsApp (Fonnte)
    wa_provider: Optional[str] = None  # "fonnte" | "mock"
    fonnte_token: Optional[str] = None
    fonnte_country_code: Optional[str] = None  # default "62"
    wa_notif_on_create: Optional[bool] = None
    wa_notif_on_diagnose: Optional[bool] = None
    wa_notif_on_ready: Optional[bool] = None
    wa_notif_on_pickup: Optional[bool] = None
    wa_template_create: Optional[str] = None
    wa_template_diagnose: Optional[str] = None
    wa_template_ready: Optional[str] = None
    wa_template_pickup: Optional[str] = None

SERVICE_STATUSES = [
    "Menunggu Teknisi", "Menunggu Diagnosa", "Sedang Diagnosa", "Menunggu Persetujuan",
    "Menunggu Sparepart", "Sedang Dikerjakan", "Quality Control",
    "Selesai", "Sudah Diambil", "Dibatalkan"
]

# ---------- Cookie helpers ----------
def set_auth_cookie(response: Response, token: str):
    response.set_cookie(key="access_token", value=token, httponly=True, secure=True,
                       samesite="none", max_age=28800, path="/")

def clear_auth_cookie(response: Response):
    response.delete_cookie("access_token", path="/")

# ---------- AUTH ----------
@api.post("/auth/login")
async def login(data: LoginIn, request: Request, response: Response):
    email = data.email.lower()
    ip = request.client.host if request.client else ""
    key = f"{ip}:{email}"
    attempts = await db.login_attempts.find_one({"identifier": key})
    if attempts and attempts.get("count", 0) >= 5:
        last = datetime.fromisoformat(attempts["last_at"])
        if datetime.now(timezone.utc) - last < timedelta(minutes=15):
            raise HTTPException(status_code=429, detail="Terlalu banyak percobaan. Coba lagi nanti.")
        await db.login_attempts.delete_one({"identifier": key})

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": key},
            {"$inc": {"count": 1}, "$set": {"last_at": now_iso()}},
            upsert=True
        )
        raise HTTPException(status_code=401, detail="Email atau password salah")

    await db.login_attempts.delete_one({"identifier": key})
    token = create_access_token(user["id"], user["email"], user["role"])
    set_auth_cookie(response, token)
    user.pop("password_hash", None)
    user.pop("_id", None)
    await audit(user, "login", "auth", user["id"], {}, ip)
    return {"user": user, "token": token}

@api.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    clear_auth_cookie(response)
    await audit(user, "logout", "auth", user["id"])
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

@api.post("/auth/forgot-password")
async def forgot(data: ForgotIn):
    user = await db.users.find_one({"email": data.email.lower()})
    if user:
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "token": token, "user_id": user["id"],
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
            "used": False
        })
        logger.info(f"Password reset link: /reset-password?token={token}")
    return {"message": "Jika email terdaftar, link reset telah dikirim."}

@api.post("/auth/reset-password")
async def reset_password(data: ResetIn):
    rec = await db.password_reset_tokens.find_one({"token": data.token, "used": False})
    if not rec:
        raise HTTPException(status_code=400, detail="Token tidak valid")
    exp = rec["expires_at"]
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > exp:
        raise HTTPException(status_code=400, detail="Token kadaluwarsa")
    await db.users.update_one({"id": rec["user_id"]},
                              {"$set": {"password_hash": hash_password(data.new_password)}})
    await db.password_reset_tokens.update_one({"token": data.token}, {"$set": {"used": True}})
    return {"ok": True}

# ---------- USERS (admin/owner) ----------
@api.get("/users")
async def list_users(user: dict = Depends(require_roles("owner", "admin"))):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users

@api.post("/users")
async def create_user(data: UserCreate, request: Request, user: dict = Depends(require_roles("owner"))):
    if await db.users.find_one({"email": data.email.lower()}):
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    new_user = {
        "id": gen_id(), "email": data.email.lower(), "password_hash": hash_password(data.password),
        "name": data.name, "role": data.role, "phone": data.phone or "",
        "active": True, "created_at": now_iso()
    }
    await db.users.insert_one(new_user)
    new_user.pop("password_hash"); new_user.pop("_id", None)
    await audit(user, "create", "user", new_user["id"], {"email": new_user["email"]})
    return new_user

@api.patch("/users/{user_id}")
async def update_user(user_id: str, data: UserUpdate, user: dict = Depends(require_roles("owner"))):
    upd = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    if "password" in upd:
        upd["password_hash"] = hash_password(upd.pop("password"))
    if upd:
        await db.users.update_one({"id": user_id}, {"$set": upd})
    await audit(user, "update", "user", user_id, upd)
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return u

@api.delete("/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(require_roles("owner"))):
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Tidak bisa menghapus diri sendiri")
    await db.users.delete_one({"id": user_id})
    await audit(user, "delete", "user", user_id)
    return {"ok": True}

# ---------- CUSTOMERS ----------
@api.get("/customers")
async def list_customers(q: str = "", user: dict = Depends(get_current_user)):
    query = {}
    if q:
        query = {"$or": [{"name": {"$regex": q, "$options": "i"}},
                         {"phone": {"$regex": q, "$options": "i"}}]}
    items = await db.customers.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

@api.post("/customers")
async def create_customer(data: CustomerIn, user: dict = Depends(get_current_user)):
    doc = {**data.model_dump(), "id": gen_id(), "created_at": now_iso()}
    await db.customers.insert_one(doc)
    doc.pop("_id", None)
    await audit(user, "create", "customer", doc["id"], {"name": doc["name"]})
    return doc

@api.get("/customers/{cid}")
async def get_customer(cid: str, user: dict = Depends(get_current_user)):
    c = await db.customers.find_one({"id": cid}, {"_id": 0})
    if not c: raise HTTPException(404)
    services = await db.services.find({"customer_id": cid}, {"_id": 0}).sort("created_at", -1).to_list(100)
    c["services"] = services
    return c

@api.patch("/customers/{cid}")
async def update_customer(cid: str, data: CustomerIn, user: dict = Depends(get_current_user)):
    await db.customers.update_one({"id": cid}, {"$set": data.model_dump()})
    await audit(user, "update", "customer", cid)
    return await db.customers.find_one({"id": cid}, {"_id": 0})

@api.delete("/customers/{cid}")
async def delete_customer(cid: str, user: dict = Depends(require_roles("owner", "admin"))):
    await db.customers.delete_one({"id": cid})
    await audit(user, "delete", "customer", cid)
    return {"ok": True}

# ---------- SERVICES ----------
async def next_service_number() -> str:
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    count = await db.services.count_documents({"service_number": {"$regex": f"^SV{today}"}})
    return f"SV{today}{(count + 1):04d}"

@api.get("/services")
async def list_services(status: Optional[str] = None, q: str = "",
                       user: dict = Depends(get_current_user)):
    query = {}
    if status: query["status"] = status
    if q:
        query["$or"] = [
            {"service_number": {"$regex": q, "$options": "i"}},
            {"imei1": {"$regex": q, "$options": "i"}},
            {"customer_name": {"$regex": q, "$options": "i"}},
            {"customer_phone": {"$regex": q, "$options": "i"}},
        ]
    items = await db.services.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

@api.post("/services")
async def create_service(data: ServiceCreate, user: dict = Depends(require_roles("owner", "admin", "kasir"))):
    customer = await db.customers.find_one({"id": data.customer_id}, {"_id": 0})
    if not customer: raise HTTPException(400, "Pelanggan tidak ditemukan")
    svc = {
        **data.model_dump(),
        "id": gen_id(),
        "service_number": await next_service_number(),
        "customer_name": customer["name"],
        "customer_phone": customer["phone"],
        "status": "Menunggu Teknisi",
        "assigned_technician_id": None,
        "assigned_technician_name": None,
        "assigned_at": None,
        "diagnosis": None,
        "items_used": [],
        "total_paid": 0,
        "service_fee": data.estimated_cost,
        "final_cost": data.estimated_cost,
        "warranty_days": 0,
        "warranty_until": None,
        "profit": 0,
        "sparepart_cost": 0,
        "created_by": user["id"],
        "created_at": now_iso(),
        "status_history": [{
            "status": "Menunggu Teknisi",
            "note": "Service diterima, menunggu teknisi",
            "by": user["name"],
            "at": now_iso()
        }],
    }
    await db.services.insert_one(svc)
    svc.pop("_id", None)
    await audit(user, "create", "service", svc["id"], {"service_number": svc["service_number"]})
    asyncio.create_task(notify_service("create", svc["id"]))
    return svc

@api.get("/services/{sid}")
async def get_service(sid: str, user: dict = Depends(get_current_user)):
    s = await db.services.find_one({"id": sid}, {"_id": 0})
    if not s: raise HTTPException(404)
    s["payments"] = await db.payments.find({"service_id": sid}, {"_id": 0}).to_list(50)
    return s

@api.patch("/services/{sid}/status")
async def update_status(sid: str, data: StatusUpdate, user: dict = Depends(require_roles("owner", "admin"))):
    if data.status not in SERVICE_STATUSES:
        raise HTTPException(400, "Status tidak valid")
    s = await db.services.find_one({"id": sid})
    if not s: raise HTTPException(404)
    history = s.get("status_history", [])
    history.append({"status": data.status, "note": data.note or "", "by": user["name"], "at": now_iso()})
    update = {"status": data.status, "status_history": history, "updated_at": now_iso()}

    # If cancelled, handle sparepart choice
    if data.status == "Dibatalkan":
        used_items = s.get("items_used", [])
        if used_items and not data.sparepart_action:
            raise HTTPException(400, "Pilih tindakan untuk sparepart yang sudah dipakai: return atau charge")
        if used_items and data.sparepart_action == "return":
            for it in used_items:
                await db.spareparts.update_one({"id": it["sparepart_id"]},
                                              {"$inc": {"stock": it["qty"]}})
                await db.inventory_history.insert_one({
                    "id": gen_id(), "sparepart_id": it["sparepart_id"], "type": "in",
                    "qty": it["qty"], "ref": s.get("service_number", sid),
                    "note": f"Stok dikembalikan (cancel oleh {user['name']})", "at": now_iso()
                })
            # Sparepart dikembalikan → tagihan hanya biaya jasa
            service_fee = s.get("service_fee", s.get("estimated_cost", 0) or 0)
            update["items_used"] = []
            update["final_cost"] = service_fee
            update["sparepart_cost"] = 0
            update["profit"] = service_fee
            update["cancel_reason"] = data.note or ""
            update["cancel_sparepart_action"] = "return"
        elif used_items and data.sparepart_action == "charge":
            # Sparepart dibebankan ke pelanggan → tetap catat pengurangan stok yang sudah terjadi,
            # final_cost tetap = service_fee + sparepart terpakai (sudah tercatat)
            update["cancel_reason"] = data.note or ""
            update["cancel_sparepart_action"] = "charge"
        else:
            # No items used
            update["cancel_reason"] = data.note or ""
            update["cancel_sparepart_action"] = "none"
    await db.services.update_one({"id": sid}, {"$set": update})
    await audit(user, "status_update", "service", sid, {"status": data.status})
    return await db.services.find_one({"id": sid}, {"_id": 0})

@api.post("/services/{sid}/diagnose")
async def diagnose(sid: str, data: DiagnoseIn, user: dict = Depends(require_roles("teknisi", "owner", "admin"))):
    s = await db.services.find_one({"id": sid})
    if not s: raise HTTPException(404)
    if s.get("status") in ("Dibatalkan", "Sudah Diambil"):
        raise HTTPException(400, f"Service {s.get('status').lower()}, tidak dapat diubah")
    diag = {**data.model_dump(), "by": user["name"], "at": now_iso()}
    history = s.get("status_history", [])
    history.append({"status": "Menunggu Persetujuan", "note": "Diagnosa selesai", "by": user["name"], "at": now_iso()})
    await db.services.update_one({"id": sid}, {"$set": {
        "diagnosis": diag,
        "estimated_cost": data.estimated_cost,
        "service_fee": data.estimated_cost,
        "final_cost": data.estimated_cost + sum((it.get("price", 0) * it.get("qty", 0)) for it in s.get("items_used", [])),
        "status": "Menunggu Persetujuan",
        "status_history": history
    }})
    await audit(user, "diagnose", "service", sid)
    asyncio.create_task(notify_service("diagnose", sid))
    return await db.services.find_one({"id": sid}, {"_id": 0})

@api.post("/services/{sid}/use-sparepart")
async def use_sparepart(sid: str, item: ServiceItem, user: dict = Depends(get_current_user)):
    s_check = await db.services.find_one({"id": sid})
    if not s_check: raise HTTPException(404, "Service tidak ditemukan")
    if s_check.get("status") in ("Dibatalkan", "Sudah Diambil"):
        raise HTTPException(400, f"Service {s_check.get('status').lower()}, tidak dapat menambah sparepart")
    sp = await db.spareparts.find_one({"id": item.sparepart_id})
    if not sp: raise HTTPException(404, "Sparepart tidak ditemukan")
    if sp["stock"] < item.qty:
        raise HTTPException(400, "Stok tidak mencukupi")
    await db.spareparts.update_one({"id": item.sparepart_id}, {"$inc": {"stock": -item.qty}})
    await db.inventory_history.insert_one({
        "id": gen_id(), "sparepart_id": item.sparepart_id, "type": "out",
        "qty": item.qty, "ref": sid, "note": "Digunakan untuk service", "at": now_iso()
    })
    s = await db.services.find_one({"id": sid})
    items = s.get("items_used", [])
    new_item = {**item.model_dump(), "id": gen_id(), "used_by": user["name"], "used_at": now_iso()}
    items.append(new_item)
    sp_cost = 0
    for it in items:
        sp_doc = await db.spareparts.find_one({"id": it["sparepart_id"]}, {"cost_price": 1})
        if sp_doc: sp_cost += sp_doc.get("cost_price", 0) * it.get("qty", 0)
    service_fee = s.get("service_fee", s.get("estimated_cost", 0) or 0)
    final = service_fee + sum(it.get("price", 0) * it.get("qty", 0) for it in items)
    profit = final - sp_cost
    await db.services.update_one({"id": sid}, {"$set": {"items_used": items, "final_cost": final, "sparepart_cost": sp_cost, "profit": profit}})
    await audit(user, "use_sparepart", "service", sid, item.model_dump())
    return await db.services.find_one({"id": sid}, {"_id": 0})

@api.delete("/services/{sid}/items/{item_id}")
async def cancel_sparepart(sid: str, item_id: str, user: dict = Depends(require_roles("teknisi", "admin", "owner"))):
    s = await db.services.find_one({"id": sid})
    if not s: raise HTTPException(404, "Service tidak ditemukan")
    items = s.get("items_used", [])
    target = next((it for it in items if it.get("id") == item_id), None)
    if not target:
        raise HTTPException(404, "Item tidak ditemukan")
    if s.get("status") == "Sudah Diambil":
        raise HTTPException(400, "Service sudah selesai diambil, tidak dapat membatalkan sparepart")
    # Restore stock
    await db.spareparts.update_one({"id": target["sparepart_id"]}, {"$inc": {"stock": target["qty"]}})
    await db.inventory_history.insert_one({
        "id": gen_id(), "sparepart_id": target["sparepart_id"], "type": "in",
        "qty": target["qty"], "ref": s.get("service_number", sid),
        "note": f"Pembatalan penggunaan sparepart oleh {user['name']}", "at": now_iso()
    })
    new_items = [it for it in items if it.get("id") != item_id]
    sp_cost = 0
    for it in new_items:
        sp_doc = await db.spareparts.find_one({"id": it["sparepart_id"]}, {"cost_price": 1})
        if sp_doc: sp_cost += sp_doc.get("cost_price", 0) * it.get("qty", 0)
    service_fee = s.get("service_fee", s.get("estimated_cost", 0) or 0)
    final = service_fee + sum(it.get("price", 0) * it.get("qty", 0) for it in new_items)
    profit = final - sp_cost
    await db.services.update_one({"id": sid}, {"$set": {
        "items_used": new_items, "final_cost": final,
        "sparepart_cost": sp_cost, "profit": profit
    }})
    await audit(user, "cancel_sparepart", "service", sid, {"item_id": item_id, "name": target.get("name")})
    return await db.services.find_one({"id": sid}, {"_id": 0})

@api.patch("/services/{sid}/service-fee")
async def update_service_fee(sid: str, data: ServiceFeeUpdate, user: dict = Depends(require_roles("admin", "owner"))):
    s = await db.services.find_one({"id": sid})
    if not s: raise HTTPException(404, "Service tidak ditemukan")
    if data.service_fee < 0:
        raise HTTPException(400, "Biaya jasa tidak boleh negatif")
    items = s.get("items_used", [])
    final = data.service_fee + sum(it.get("price", 0) * it.get("qty", 0) for it in items)
    sp_cost = s.get("sparepart_cost", 0) or 0
    profit = final - sp_cost
    await db.services.update_one({"id": sid}, {"$set": {
        "service_fee": data.service_fee,
        "estimated_cost": data.service_fee,
        "final_cost": final,
        "profit": profit,
        "updated_at": now_iso(),
    }})
    await audit(user, "update_service_fee", "service", sid, {"service_fee": data.service_fee})
    return await db.services.find_one({"id": sid}, {"_id": 0})

@api.post("/services/{sid}/pickup")
async def pickup(sid: str, data: PickupIn, user: dict = Depends(require_roles("kasir", "admin", "owner"))):
    s = await db.services.find_one({"id": sid})
    if not s: raise HTTPException(404)
    if s.get("status") != "Selesai":
        raise HTTPException(400, "Service harus lulus QC (status Selesai) sebelum diambil")
    if not (data.unit_ok and data.paid and data.warranty_explained):
        raise HTTPException(400, "Checklist belum lengkap")
    warranty_until = (datetime.now(timezone.utc) + timedelta(days=data.warranty_days)).isoformat()
    history = s.get("status_history", [])
    history.append({"status": "Sudah Diambil", "note": "Unit diambil pelanggan", "by": user["name"], "at": now_iso()})
    await db.services.update_one({"id": sid}, {"$set": {
        "status": "Sudah Diambil",
        "warranty_days": data.warranty_days,
        "warranty_until": warranty_until,
        "pickup": {**data.model_dump(), "by": user["name"], "at": now_iso()},
        "status_history": history
    }})
    await audit(user, "pickup", "service", sid)
    asyncio.create_task(notify_service("pickup", sid))
    return await db.services.find_one({"id": sid}, {"_id": 0})

# ---------- QC (Quality Control) ----------
@api.post("/services/{sid}/finish-work")
async def finish_work(sid: str, user: dict = Depends(require_roles("teknisi", "owner", "admin"))):
    s = await db.services.find_one({"id": sid})
    if not s: raise HTTPException(404, "Service tidak ditemukan")
    if s.get("status") == "Dibatalkan":
        raise HTTPException(400, "Service sudah dibatalkan")
    allowed_from = {"Sedang Diagnosa", "Menunggu Persetujuan", "Menunggu Sparepart", "Sedang Dikerjakan"}
    if s.get("status") not in allowed_from:
        raise HTTPException(400, f"Tidak dapat menyelesaikan pekerjaan dari status '{s.get('status')}'")
    # Only assigned technician or admin/owner
    if user["role"] == "teknisi":
        tech = await db.technicians.find_one({"user_id": user["id"]})
        if not tech or s.get("assigned_technician_id") != tech.get("id"):
            raise HTTPException(403, "Anda bukan teknisi yang ditugaskan untuk service ini")
    history = s.get("status_history", [])
    history.append({"status": "Quality Control", "note": "Selesai dikerjakan, menunggu QC", "by": user["name"], "at": now_iso()})
    await db.services.update_one({"id": sid}, {"$set": {
        "status": "Quality Control",
        "finished_at": now_iso(),
        "qc_failed": False,
        "status_history": history
    }})
    await audit(user, "finish_work", "service", sid)
    return await db.services.find_one({"id": sid}, {"_id": 0})

@api.get("/qc-queue")
async def qc_queue(user: dict = Depends(require_roles("owner", "admin"))):
    items = await db.services.find({"status": "Quality Control"}, {"_id": 0}).sort("finished_at", 1).to_list(500)
    return items

@api.post("/services/{sid}/qc")
async def submit_qc(sid: str, data: QCCheckIn, user: dict = Depends(require_roles("owner", "admin"))):
    s = await db.services.find_one({"id": sid})
    if not s: raise HTTPException(404, "Service tidak ditemukan")
    if s.get("status") != "Quality Control":
        raise HTTPException(400, "Service tidak berada dalam antrian QC")
    if not data.items:
        raise HTTPException(400, "Checklist QC tidak boleh kosong")

    items_dump = [it.model_dump() for it in data.items]
    all_ok = all(it["ok"] for it in items_dump)
    failed_items = [it for it in items_dump if not it["ok"]]

    qc_result = {
        "items": items_dump,
        "overall_note": data.overall_note or "",
        "by": user["name"],
        "at": now_iso(),
        "passed": all_ok,
        "failed_items": [it["name"] for it in failed_items],
    }
    qc_history = s.get("qc_history", [])
    qc_history.append(qc_result)

    history = s.get("status_history", [])
    if all_ok:
        history.append({"status": "Selesai", "note": "QC PASS - siap diambil", "by": user["name"], "at": now_iso()})
        update = {
            "status": "Selesai",
            "qc_result": qc_result,
            "qc_history": qc_history,
            "qc_passed": True,
            "qc_failed": False,
            "status_history": history,
        }
    else:
        note = f"QC FAIL: {', '.join([it['name'] for it in failed_items])}. Kembali ke teknisi."
        history.append({"status": "Sedang Dikerjakan", "note": note, "by": user["name"], "at": now_iso()})
        update = {
            "status": "Sedang Dikerjakan",
            "qc_result": qc_result,
            "qc_history": qc_history,
            "qc_passed": False,
            "qc_failed": True,
            "status_history": history,
        }
    await db.services.update_one({"id": sid}, {"$set": update})
    await audit(user, "qc", "service", sid, {"passed": all_ok, "failed_count": len(failed_items)})
    if all_ok:
        asyncio.create_task(notify_service("ready", sid))
    return await db.services.find_one({"id": sid}, {"_id": 0})

# Public tracking
@api.get("/track/{service_number}")
async def track(service_number: str):
    s = await db.services.find_one({"service_number": service_number}, {"_id": 0})
    if not s: raise HTTPException(404)
    return {
        "service_number": s["service_number"],
        "status": s["status"],
        "brand": s["brand"], "model": s["model"],
        "customer_name": s["customer_name"],
        "created_at": s["created_at"],
        "status_history": s.get("status_history", []),
        "final_cost": s.get("final_cost", 0),
        "diagnosis": (s.get("diagnosis") or {}).get("diagnosis"),
    }

# ---------- PAYMENTS ----------
@api.get("/payments")
async def list_payments(user: dict = Depends(get_current_user)):
    items = await db.payments.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

@api.post("/payments")
async def create_payment(data: PaymentIn, user: dict = Depends(require_roles("kasir", "admin", "owner"))):
    s = await db.services.find_one({"id": data.service_id})
    if not s: raise HTTPException(404, "Service tidak ditemukan")
    if s.get("status") == "Dibatalkan":
        raise HTTPException(400, "Service dibatalkan, tidak dapat mencatat pembayaran baru")
    pay = {**data.model_dump(), "id": gen_id(), "service_number": s["service_number"],
           "customer_name": s["customer_name"], "by": user["name"], "created_at": now_iso()}
    await db.payments.insert_one(pay)
    pay.pop("_id", None)
    total_paid = s.get("total_paid", 0) + data.amount
    await db.services.update_one({"id": data.service_id}, {"$set": {"total_paid": total_paid}})
    await audit(user, "payment", "service", data.service_id, {"amount": data.amount})
    return pay

# ---------- TECHNICIANS / JOB ASSIGNMENT / FINANCIAL ----------
class SparepartCategoryIn(BaseModel):
    name: str

@api.get("/sparepart-categories")
async def list_categories(user: dict = Depends(get_current_user)):
    return await db.sparepart_categories.find({}, {"_id": 0}).to_list(200)

@api.post("/sparepart-categories")
async def create_category(data: SparepartCategoryIn, user: dict = Depends(require_roles("owner", "admin"))):
    doc = {"id": gen_id(), "name": data.name, "created_at": now_iso()}
    await db.sparepart_categories.insert_one(doc)
    doc.pop("_id", None); return doc

@api.delete("/sparepart-categories/{cid}")
async def delete_category(cid: str, user: dict = Depends(require_roles("owner", "admin"))):
    await db.sparepart_categories.delete_one({"id": cid}); return {"ok": True}

# ---------- USER CHANGE REQUESTS (admin -> owner approval) ----------
class UserChangeRequestIn(BaseModel):
    action: Literal["create", "update", "delete"]
    target_user_id: Optional[str] = None
    payload: Optional[dict] = None

@api.get("/user-change-requests")
async def list_user_change_requests(status: Optional[str] = None, user: dict = Depends(require_roles("owner", "admin"))):
    query = {}
    if status:
        query["status"] = status
    elif user["role"] == "owner":
        query["status"] = "pending"
    else:
        query["requested_by_id"] = user["id"]
    items = await db.user_change_requests.find(query, {"_id": 0}).sort("requested_at", -1).to_list(500)
    return items

@api.post("/user-change-requests")
async def create_user_change_request(data: UserChangeRequestIn, user: dict = Depends(require_roles("admin"))):
    payload = data.payload or {}
    # Basic validation per action
    if data.action == "create":
        if not payload.get("email") or not payload.get("password") or not payload.get("name") or not payload.get("role"):
            raise HTTPException(status_code=400, detail="Field email/password/name/role wajib untuk create")
        if payload.get("role") == "owner":
            raise HTTPException(status_code=400, detail="Admin tidak boleh request membuat user owner")
    elif data.action in ("update", "delete"):
        if not data.target_user_id:
            raise HTTPException(status_code=400, detail="target_user_id wajib")
    doc = {
        "id": gen_id(),
        "action": data.action,
        "target_user_id": data.target_user_id,
        "payload": payload,
        "status": "pending",
        "requested_by_id": user["id"],
        "requested_by": user["name"],
        "requested_at": now_iso(),
        "decided_by": None,
        "decided_at": None,
        "decision_note": None,
    }
    await db.user_change_requests.insert_one(doc)
    doc.pop("_id", None)
    await audit(user, "request", "user_change_request", doc["id"], {"action": data.action, "target": data.target_user_id})
    return doc

class DecisionIn(BaseModel):
    note: Optional[str] = ""

@api.post("/user-change-requests/{req_id}/approve")
async def approve_user_change_request(req_id: str, body: Optional[DecisionIn] = None, user: dict = Depends(require_roles("owner"))):
    note = (body.note if body else "") or ""
    req = await db.user_change_requests.find_one({"id": req_id})
    if not req:
        raise HTTPException(status_code=404, detail="Request tidak ditemukan")
    if req.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Request sudah diproses")
    payload = req.get("payload") or {}
    action = req["action"]
    # Apply the change
    if action == "create":
        if await db.users.find_one({"email": payload["email"].lower()}):
            raise HTTPException(status_code=400, detail="Email sudah terdaftar")
        new_user = {
            "id": gen_id(),
            "email": payload["email"].lower(),
            "password_hash": hash_password(payload["password"]),
            "name": payload["name"],
            "role": payload["role"],
            "phone": payload.get("phone", ""),
            "active": True,
            "created_at": now_iso(),
        }
        await db.users.insert_one(new_user)
        await audit(user, "create", "user", new_user["id"], {"email": new_user["email"], "via_request": req_id})
    elif action == "update":
        upd = {k: v for k, v in payload.items() if v is not None and k != "email"}
        if "password" in upd:
            upd["password_hash"] = hash_password(upd.pop("password"))
        if upd:
            await db.users.update_one({"id": req["target_user_id"]}, {"$set": upd})
        await audit(user, "update", "user", req["target_user_id"], {"via_request": req_id})
    elif action == "delete":
        if req["target_user_id"] == user["id"]:
            raise HTTPException(status_code=400, detail="Tidak bisa menghapus diri sendiri")
        await db.users.delete_one({"id": req["target_user_id"]})
        await audit(user, "delete", "user", req["target_user_id"], {"via_request": req_id})
    await db.user_change_requests.update_one(
        {"id": req_id},
        {"$set": {"status": "approved", "decided_by": user["name"], "decided_at": now_iso(), "decision_note": note}},
    )
    updated = await db.user_change_requests.find_one({"id": req_id}, {"_id": 0})
    return updated

@api.post("/user-change-requests/{req_id}/reject")
async def reject_user_change_request(req_id: str, body: Optional[DecisionIn] = None, user: dict = Depends(require_roles("owner"))):
    note = (body.note if body else "") or ""
    req = await db.user_change_requests.find_one({"id": req_id})
    if not req:
        raise HTTPException(status_code=404, detail="Request tidak ditemukan")
    if req.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Request sudah diproses")
    await db.user_change_requests.update_one(
        {"id": req_id},
        {"$set": {"status": "rejected", "decided_by": user["name"], "decided_at": now_iso(), "decision_note": note}},
    )
    await audit(user, "reject", "user_change_request", req_id)
    return await db.user_change_requests.find_one({"id": req_id}, {"_id": 0})

class TechnicianIn(BaseModel):
    user_id: Optional[str] = ""
    name: str
    phone: Optional[str] = ""
    address: Optional[str] = ""
    joined_at: Optional[str] = ""
    active: bool = True
    specialization: Optional[str] = ""
    commission_percent: float = 0
    photo: Optional[str] = ""

class AssignIn(BaseModel):
    technician_id: str

@api.get("/technicians")
async def list_technicians(user: dict = Depends(get_current_user)):
    return await db.technicians.find({}, {"_id": 0}).to_list(500)

@api.post("/technicians")
async def create_technician(data: TechnicianIn, user: dict = Depends(require_roles("owner", "admin"))):
    doc = {**data.model_dump(), "id": gen_id(), "created_at": now_iso()}
    await db.technicians.insert_one(doc)
    doc.pop("_id", None)
    await audit(user, "create", "technician", doc["id"], {"name": doc["name"]})
    return doc

@api.patch("/technicians/{tid}")
async def update_technician(tid: str, data: TechnicianIn, user: dict = Depends(require_roles("owner", "admin"))):
    await db.technicians.update_one({"id": tid}, {"$set": data.model_dump()})
    await audit(user, "update", "technician", tid)
    return await db.technicians.find_one({"id": tid}, {"_id": 0})

@api.delete("/technicians/{tid}")
async def delete_technician(tid: str, user: dict = Depends(require_roles("owner", "admin"))):
    await db.technicians.delete_one({"id": tid})
    await audit(user, "delete", "technician", tid)
    return {"ok": True}

@api.get("/my-jobs")
async def my_jobs(period: str = "all", user: dict = Depends(get_current_user)):
    tech = await db.technicians.find_one({"user_id": user["id"]})
    if not tech: return []
    q = {"assigned_technician_id": tech["id"]}
    now = datetime.now(timezone.utc)
    if period == "today":
        q["assigned_at"] = {"$regex": f"^{now.strftime('%Y-%m-%d')}"}
    elif period == "week":
        q["assigned_at"] = {"$gte": (now - timedelta(days=7)).isoformat()}
    elif period == "month":
        q["assigned_at"] = {"$regex": f"^{now.strftime('%Y-%m')}"}
    items = await db.services.find(q, {"_id": 0}).sort("assigned_at", -1).to_list(500)
    pct = tech.get("commission_percent", 0) / 100
    for it in items:
        # Komisi teknisi = persen komisi × biaya jasa (service_fee)
        service_fee = it.get("service_fee", it.get("estimated_cost", 0) or 0) or 0
        # Hanya service yang sudah selesai/diambil yang menghasilkan komisi
        is_paid_out = it.get("status") in ("Selesai", "Sudah Diambil")
        it["commission"] = round(service_fee * pct) if is_paid_out else 0
    return items

@api.post("/services/{sid}/claim")
async def claim_job(sid: str, user: dict = Depends(require_roles("teknisi", "owner", "admin"))):
    s = await db.services.find_one({"id": sid})
    if not s: raise HTTPException(404)
    if s.get("status") == "Dibatalkan":
        raise HTTPException(400, "Service sudah dibatalkan, tidak dapat diambil")
    if s.get("status") == "Sudah Diambil":
        raise HTTPException(400, "Service sudah selesai diambil pelanggan")
    if s.get("assigned_technician_id"):
        raise HTTPException(400, "Service sudah dikerjakan teknisi lain")
    tech = await db.technicians.find_one({"user_id": user["id"]})
    if not tech:
        tech = {"id": gen_id(), "user_id": user["id"], "name": user["name"], "phone": user.get("phone", ""),
                "active": True, "commission_percent": 10, "created_at": now_iso()}
        await db.technicians.insert_one(tech)
    history = s.get("status_history", [])
    history.append({"status": "Sedang Dikerjakan", "note": f"Diambil oleh {tech['name']}", "by": user["name"], "at": now_iso()})
    await db.services.update_one({"id": sid}, {"$set": {
        "assigned_technician_id": tech["id"], "assigned_technician_name": tech["name"],
        "assigned_at": now_iso(), "status": "Sedang Dikerjakan", "status_history": history
    }})
    await audit(user, "claim", "service", sid, {"technician": tech["name"]})
    return await db.services.find_one({"id": sid}, {"_id": 0})

@api.post("/services/{sid}/assign")
async def assign_technician(sid: str, data: AssignIn, user: dict = Depends(require_roles("owner", "admin"))):
    s = await db.services.find_one({"id": sid})
    if not s: raise HTTPException(404)
    if s.get("status") == "Dibatalkan":
        raise HTTPException(400, "Service sudah dibatalkan, tidak dapat di-assign")
    tech = await db.technicians.find_one({"id": data.technician_id})
    if not tech: raise HTTPException(400, "Teknisi tidak ditemukan")
    prev = s.get("assigned_technician_name")
    new_status = s["status"] if s["status"] != "Menunggu Teknisi" else "Sedang Dikerjakan"
    history = s.get("status_history", [])
    history.append({"status": new_status,
                    "note": f"Di-assign ke {tech['name']}" + (f" (dari {prev})" if prev else ""),
                    "by": user["name"], "at": now_iso()})
    await db.services.update_one({"id": sid}, {"$set": {
        "assigned_technician_id": tech["id"], "assigned_technician_name": tech["name"],
        "assigned_at": now_iso(), "status": new_status, "status_history": history
    }})
    await audit(user, "assign_technician", "service", sid, {"technician": tech["name"], "previous": prev})
    return await db.services.find_one({"id": sid}, {"_id": 0})

@api.get("/reports/financial")
async def financial_report(start: Optional[str] = None, end: Optional[str] = None, user: dict = Depends(require_roles("owner", "admin"))):
    if not start: start = datetime.now(timezone.utc).strftime("%Y-%m-01")
    if not end: end = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    end_dt = end + "T23:59:59"
    pays = await db.payments.find({"created_at": {"$gte": start, "$lte": end_dt}}, {"_id": 0}).to_list(10000)
    svcs = await db.services.find({"created_at": {"$gte": start, "$lte": end_dt}}, {"_id": 0}).to_list(10000)
    omzet = sum(p["amount"] for p in pays)
    laba = sum(s.get("profit", 0) or 0 for s in svcs if s.get("status") in ["Selesai", "Sudah Diambil"])
    modal = sum(s.get("sparepart_cost", 0) or 0 for s in svcs)
    dp_total = sum(p["amount"] for p in pays if p.get("type") == "dp")
    piutang = sum(max(0, (s.get("final_cost", 0) - s.get("total_paid", 0))) for s in svcs if s.get("status") != "Dibatalkan")
    belum_diambil = await db.services.count_documents({"status": "Selesai"})
    return {"omzet": omzet, "laba": laba, "modal_sparepart": modal,
            "total_dp": dp_total, "piutang": piutang,
            "service_count": len(svcs), "belum_diambil": belum_diambil}

@api.get("/reports/technicians")
async def report_technicians(user: dict = Depends(require_roles("owner", "admin"))):
    techs = await db.technicians.find({}, {"_id": 0}).to_list(500)
    result = []
    for t in techs:
        svcs = await db.services.find({"assigned_technician_id": t["id"]}, {"_id": 0}).to_list(2000)
        done = [s for s in svcs if s.get("status") in ["Selesai", "Sudah Diambil"]]
        cancelled = [s for s in svcs if s.get("status") == "Dibatalkan"]
        pct = t.get("commission_percent", 0) / 100
        total_fee = sum(s.get("service_fee", s.get("estimated_cost", 0) or 0) or 0 for s in done)
        total_profit = sum(s.get("profit", 0) or 0 for s in done)
        result.append({
            "id": t["id"], "name": t["name"],
            "commission_percent": t.get("commission_percent", 0),
            "total_jobs": len(svcs), "completed": len(done), "cancelled": len(cancelled),
            "total_service_fee": total_fee,
            "total_profit": total_profit,
            "commission": round(total_fee * pct),
        })
    result.sort(key=lambda x: x["commission"], reverse=True)
    return result

# --- Laba Teknisi report (with date filter) ---
@api.get("/reports/technicians-profit")
async def report_technicians_profit(start: Optional[str] = None, end: Optional[str] = None, technician_id: Optional[str] = None, user: dict = Depends(require_roles("owner", "admin"))):
    if not start: start = datetime.now(timezone.utc).strftime("%Y-%m-01")
    if not end: end = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    end_dt = end + "T23:59:59"
    techs = await db.technicians.find({}, {"_id": 0}).to_list(500)
    if technician_id:
        techs = [t for t in techs if t["id"] == technician_id]
    result = []
    for t in techs:
        svcs = await db.services.find({
            "assigned_technician_id": t["id"],
            "status": {"$in": ["Selesai", "Sudah Diambil"]},
            "created_at": {"$gte": start, "$lte": end_dt},
        }, {"_id": 0}).to_list(2000)
        pct = t.get("commission_percent", 0) / 100
        detail = []
        total_fee = 0
        total_commission = 0
        for s in svcs:
            fee = s.get("service_fee", s.get("estimated_cost", 0) or 0) or 0
            comm = round(fee * pct)
            total_fee += fee
            total_commission += comm
            detail.append({
                "service_id": s["id"],
                "service_number": s.get("service_number"),
                "customer_name": s.get("customer_name"),
                "brand": s.get("brand"),
                "model": s.get("model"),
                "created_at": s.get("created_at"),
                "final_cost": s.get("final_cost", 0) or 0,
                "service_fee": fee,
                "commission": comm,
            })
        result.append({
            "id": t["id"],
            "name": t["name"],
            "commission_percent": t.get("commission_percent", 0),
            "job_count": len(svcs),
            "total_service_fee": total_fee,
            "total_commission": total_commission,
            "services": detail,
        })
    result.sort(key=lambda x: x["total_commission"], reverse=True)
    return {"start": start, "end": end, "technicians": result}

# --- Slip Gaji Teknisi ---
@api.get("/reports/technician/{tid}/slip")
async def technician_salary_slip(tid: str, start: str, end: str, user: dict = Depends(require_roles("owner", "admin"))):
    tech = await db.technicians.find_one({"id": tid}, {"_id": 0})
    if not tech: raise HTTPException(404, "Teknisi tidak ditemukan")
    end_dt = end + "T23:59:59"
    svcs = await db.services.find({
        "assigned_technician_id": tid,
        "status": {"$in": ["Selesai", "Sudah Diambil"]},
        "created_at": {"$gte": start, "$lte": end_dt},
    }, {"_id": 0}).sort("created_at", 1).to_list(2000)
    pct = tech.get("commission_percent", 0) / 100
    detail = []
    total_fee = 0
    total_commission = 0
    for s in svcs:
        fee = s.get("service_fee", s.get("estimated_cost", 0) or 0) or 0
        comm = round(fee * pct)
        total_fee += fee
        total_commission += comm
        detail.append({
            "service_number": s.get("service_number"),
            "date": s.get("created_at"),
            "customer_name": s.get("customer_name"),
            "brand_model": f"{s.get('brand','')} {s.get('model','')}".strip(),
            "service_fee": fee,
            "commission": comm,
        })
    settings = await db.settings.find_one({}, {"_id": 0}) or {}
    return {
        "technician": {"id": tech["id"], "name": tech["name"], "commission_percent": tech.get("commission_percent", 0)},
        "period": {"start": start, "end": end},
        "shop": {"name": settings.get("shop_name") or settings.get("app_name") or "Service HP Manager",
                 "address": settings.get("shop_address", ""), "phone": settings.get("shop_phone", "")},
        "services": detail,
        "job_count": len(svcs),
        "total_service_fee": total_fee,
        "total_commission": total_commission,
        "generated_at": now_iso(),
        "generated_by": user["name"],
    }


# ---------- SPAREPARTS ----------
@api.get("/spareparts")
async def list_spareparts(q: str = "", low_stock: bool = False, user: dict = Depends(get_current_user)):
    query = {}
    if q:
        query["$or"] = [{"name": {"$regex": q, "$options": "i"}},
                       {"code": {"$regex": q, "$options": "i"}}]
    items = await db.spareparts.find(query, {"_id": 0}).sort("name", 1).to_list(1000)
    if low_stock:
        items = [i for i in items if i.get("stock", 0) <= i.get("min_stock", 0)]
    return items

@api.post("/spareparts")
async def create_sparepart(data: SparepartIn, user: dict = Depends(require_roles("owner", "admin"))):
    doc = {**data.model_dump(), "id": gen_id(), "created_at": now_iso()}
    await db.spareparts.insert_one(doc)
    doc.pop("_id", None)
    await audit(user, "create", "sparepart", doc["id"], {"name": doc["name"]})
    return doc

@api.patch("/spareparts/{spid}")
async def update_sparepart(spid: str, data: SparepartIn, user: dict = Depends(require_roles("owner", "admin"))):
    await db.spareparts.update_one({"id": spid}, {"$set": data.model_dump()})
    await audit(user, "update", "sparepart", spid)
    return await db.spareparts.find_one({"id": spid}, {"_id": 0})

@api.delete("/spareparts/{spid}")
async def delete_sparepart(spid: str, user: dict = Depends(require_roles("owner", "admin"))):
    await db.spareparts.delete_one({"id": spid})
    await audit(user, "delete", "sparepart", spid)
    return {"ok": True}

@api.get("/spareparts/{spid}/history")
async def sparepart_history(spid: str, user: dict = Depends(get_current_user)):
    hist = await db.inventory_history.find({"sparepart_id": spid}, {"_id": 0}).sort("at", -1).to_list(200)
    return hist

# ---------- SUPPLIERS ----------
@api.get("/suppliers")
async def list_suppliers(user: dict = Depends(get_current_user)):
    return await db.suppliers.find({}, {"_id": 0}).to_list(500)

@api.post("/suppliers")
async def create_supplier(data: SupplierIn, user: dict = Depends(require_roles("owner", "admin"))):
    doc = {**data.model_dump(), "id": gen_id(), "created_at": now_iso()}
    await db.suppliers.insert_one(doc)
    doc.pop("_id", None)
    await audit(user, "create", "supplier", doc["id"])
    return doc

@api.patch("/suppliers/{sid}")
async def update_supplier(sid: str, data: SupplierIn, user: dict = Depends(require_roles("owner", "admin"))):
    await db.suppliers.update_one({"id": sid}, {"$set": data.model_dump()})
    return await db.suppliers.find_one({"id": sid}, {"_id": 0})

@api.delete("/suppliers/{sid}")
async def delete_supplier(sid: str, user: dict = Depends(require_roles("owner", "admin"))):
    await db.suppliers.delete_one({"id": sid})
    return {"ok": True}

# ---------- PURCHASES ----------
@api.get("/purchases")
async def list_purchases(user: dict = Depends(get_current_user)):
    return await db.purchases.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)

@api.post("/purchases")
async def create_purchase(data: PurchaseIn, user: dict = Depends(require_roles("owner", "admin"))):
    sup = await db.suppliers.find_one({"id": data.supplier_id})
    if not sup: raise HTTPException(400, "Supplier tidak ditemukan")
    total = sum(i.qty * i.price for i in data.items)
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    count = await db.purchases.count_documents({"purchase_number": {"$regex": f"^PO{today}"}})
    doc = {
        "id": gen_id(),
        "purchase_number": f"PO{today}{(count + 1):03d}",
        "supplier_id": data.supplier_id,
        "supplier_name": sup["name"],
        "items": [i.model_dump() for i in data.items],
        "total": total,
        "note": data.note,
        "status": "received",
        "created_by": user["name"],
        "created_at": now_iso(),
    }
    await db.purchases.insert_one(doc)
    for it in data.items:
        await db.spareparts.update_one({"id": it.sparepart_id}, {"$inc": {"stock": it.qty}})
        await db.inventory_history.insert_one({
            "id": gen_id(), "sparepart_id": it.sparepart_id, "type": "in",
            "qty": it.qty, "ref": doc["purchase_number"], "note": "Pembelian", "at": now_iso()
        })
    doc.pop("_id", None)
    await audit(user, "create", "purchase", doc["id"], {"total": total})
    return doc

@api.get("/purchases/{pid}")
async def get_purchase(pid: str, user: dict = Depends(require_roles("owner", "admin"))):
    p = await db.purchases.find_one({"id": pid}, {"_id": 0})
    if not p: raise HTTPException(404, "Purchase tidak ditemukan")
    return p

@api.patch("/purchases/{pid}")
async def update_purchase(pid: str, data: PurchaseUpdate, user: dict = Depends(require_roles("owner", "admin"))):
    p = await db.purchases.find_one({"id": pid})
    if not p: raise HTTPException(404, "Purchase tidak ditemukan")
    upd = {}
    old_items = p.get("items", [])
    new_items = old_items
    if data.items is not None:
        new_items = [i.model_dump() for i in data.items]
        # Reverse old stock, apply new stock
        for it in old_items:
            await db.spareparts.update_one({"id": it["sparepart_id"]}, {"$inc": {"stock": -it.get("qty", 0)}})
            await db.inventory_history.insert_one({
                "id": gen_id(), "sparepart_id": it["sparepart_id"], "type": "out",
                "qty": it.get("qty", 0), "ref": p.get("purchase_number"),
                "note": f"Edit pembelian (reverse) oleh {user['name']}", "at": now_iso()
            })
        for it in new_items:
            await db.spareparts.update_one({"id": it["sparepart_id"]}, {"$inc": {"stock": it["qty"]}})
            await db.inventory_history.insert_one({
                "id": gen_id(), "sparepart_id": it["sparepart_id"], "type": "in",
                "qty": it["qty"], "ref": p.get("purchase_number"),
                "note": f"Edit pembelian oleh {user['name']}", "at": now_iso()
            })
        upd["items"] = new_items
        upd["total"] = sum(i["qty"] * i["price"] for i in new_items)
    if data.supplier_id is not None:
        sup = await db.suppliers.find_one({"id": data.supplier_id})
        if not sup: raise HTTPException(400, "Supplier tidak ditemukan")
        upd["supplier_id"] = data.supplier_id
        upd["supplier_name"] = sup["name"]
    if data.note is not None:
        upd["note"] = data.note
    upd["updated_at"] = now_iso()
    upd["updated_by"] = user["name"]
    await db.purchases.update_one({"id": pid}, {"$set": upd})
    await audit(user, "update", "purchase", pid, {"changes": list(upd.keys())})
    return await db.purchases.find_one({"id": pid}, {"_id": 0})

@api.delete("/purchases/{pid}")
async def delete_purchase(pid: str, user: dict = Depends(require_roles("owner"))):
    p = await db.purchases.find_one({"id": pid})
    if not p: raise HTTPException(404, "Purchase tidak ditemukan")
    # Reverse stock
    for it in p.get("items", []):
        await db.spareparts.update_one({"id": it["sparepart_id"]}, {"$inc": {"stock": -it.get("qty", 0)}})
        await db.inventory_history.insert_one({
            "id": gen_id(), "sparepart_id": it["sparepart_id"], "type": "out",
            "qty": it.get("qty", 0), "ref": p.get("purchase_number"),
            "note": f"Hapus pembelian oleh {user['name']}", "at": now_iso()
        })
    await db.purchases.delete_one({"id": pid})
    await audit(user, "delete", "purchase", pid)
    return {"ok": True}

# ---------- DIRECT SALES (POS Sparepart) ----------
@api.get("/direct-sales")
async def list_direct_sales(start: Optional[str] = None, end: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    if start and end:
        q["created_at"] = {"$gte": start, "$lte": end + "T23:59:59"}
    return await db.direct_sales.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)

@api.get("/direct-sales/{sid}")
async def get_direct_sale(sid: str, user: dict = Depends(get_current_user)):
    d = await db.direct_sales.find_one({"id": sid}, {"_id": 0})
    if not d: raise HTTPException(404)
    return d

@api.post("/direct-sales")
async def create_direct_sale(data: DirectSaleIn, user: dict = Depends(require_roles("owner", "admin", "kasir"))):
    if not data.items:
        raise HTTPException(400, "Item tidak boleh kosong")
    # Validate stock & compute
    subtotal = 0
    sp_cost_total = 0
    resolved_items = []
    for it in data.items:
        sp = await db.spareparts.find_one({"id": it.sparepart_id})
        if not sp: raise HTTPException(400, f"Sparepart {it.name} tidak ditemukan")
        if sp["stock"] < it.qty:
            raise HTTPException(400, f"Stok {sp['name']} tidak mencukupi (stok: {sp['stock']}, diminta: {it.qty})")
        cost = sp.get("cost_price", 0) * it.qty
        line = it.qty * it.price
        subtotal += line
        sp_cost_total += cost
        resolved_items.append({**it.model_dump(), "cost_price": sp.get("cost_price", 0)})
    total = max(0, subtotal - (data.discount or 0))
    profit = total - sp_cost_total
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    count = await db.direct_sales.count_documents({"sale_number": {"$regex": f"^DS{today}"}})
    sale_number = f"DS{today}{(count + 1):03d}"
    doc = {
        "id": gen_id(),
        "sale_number": sale_number,
        "items": resolved_items,
        "subtotal": subtotal,
        "discount": data.discount or 0,
        "total": total,
        "sparepart_cost": sp_cost_total,
        "profit": profit,
        "method": data.method,
        "paid": data.paid or total,
        "customer_name": data.customer_name or "Pelanggan Umum",
        "customer_phone": data.customer_phone or "",
        "note": data.note or "",
        "cashier_id": user["id"],
        "cashier_name": user["name"],
        "created_at": now_iso(),
        "status": "paid",
    }
    await db.direct_sales.insert_one(doc)
    # Reduce stock & inventory history
    for it in resolved_items:
        await db.spareparts.update_one({"id": it["sparepart_id"]}, {"$inc": {"stock": -it["qty"]}})
        await db.inventory_history.insert_one({
            "id": gen_id(), "sparepart_id": it["sparepart_id"], "type": "out",
            "qty": it["qty"], "ref": sale_number, "note": "Direct sale", "at": now_iso()
        })
    doc.pop("_id", None)
    await audit(user, "create", "direct_sale", doc["id"], {"total": total, "items": len(resolved_items)})
    return doc

@api.post("/direct-sales/{sid}/refund")
async def refund_direct_sale(sid: str, user: dict = Depends(require_roles("owner", "admin"))):
    d = await db.direct_sales.find_one({"id": sid})
    if not d: raise HTTPException(404, "Sale tidak ditemukan")
    if d.get("status") == "refunded":
        raise HTTPException(400, "Sudah di-refund sebelumnya")
    for it in d.get("items", []):
        await db.spareparts.update_one({"id": it["sparepart_id"]}, {"$inc": {"stock": it["qty"]}})
        await db.inventory_history.insert_one({
            "id": gen_id(), "sparepart_id": it["sparepart_id"], "type": "in",
            "qty": it["qty"], "ref": d.get("sale_number", sid),
            "note": f"Refund direct sale oleh {user['name']}", "at": now_iso()
        })
    await db.direct_sales.update_one({"id": sid}, {"$set": {
        "status": "refunded",
        "refunded_at": now_iso(),
        "refunded_by": user["name"],
    }})
    await audit(user, "refund", "direct_sale", sid)
    return await db.direct_sales.find_one({"id": sid}, {"_id": 0})

# ---------- DASHBOARD ----------
@api.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    month = datetime.now(timezone.utc).strftime("%Y-%m")

    services_today = await db.services.count_documents({"created_at": {"$regex": f"^{today}"}})
    in_progress = await db.services.count_documents({"status": {"$in": ["Sedang Diagnosa", "Sedang Dikerjakan", "Quality Control", "Menunggu Sparepart", "Menunggu Persetujuan"]}})
    done = await db.services.count_documents({"status": "Selesai"})
    not_picked = await db.services.count_documents({"status": "Selesai"})

    payments_today = await db.payments.find({"created_at": {"$regex": f"^{today}"}}, {"_id": 0}).to_list(1000)
    revenue_today = sum(p["amount"] for p in payments_today)
    payments_month = await db.payments.find({"created_at": {"$regex": f"^{month}"}}, {"_id": 0}).to_list(5000)
    revenue_month = sum(p["amount"] for p in payments_month)

    # Profit stats
    today_svcs = await db.services.find({"created_at": {"$regex": f"^{today}"}}, {"_id": 0}).to_list(2000)
    month_svcs = await db.services.find({"created_at": {"$regex": f"^{month}"}}, {"_id": 0}).to_list(5000)
    profit_today = sum(s.get("profit", 0) or 0 for s in today_svcs if s.get("status") in ["Selesai", "Sudah Diambil"])
    profit_month = sum(s.get("profit", 0) or 0 for s in month_svcs if s.get("status") in ["Selesai", "Sudah Diambil"])

    # Top technicians (by profit)
    techs = await db.technicians.find({}, {"_id": 0}).to_list(100)
    top_techs = []
    for t in techs:
        ts = await db.services.find({"assigned_technician_id": t["id"], "status": {"$in": ["Selesai", "Sudah Diambil"]}}, {"_id": 0}).to_list(1000)
        top_techs.append({"name": t["name"], "jobs": len(ts), "profit": sum(s.get("profit", 0) or 0 for s in ts)})
    top_techs.sort(key=lambda x: x["profit"], reverse=True)
    top_techs = top_techs[:5]

    low_stock = await db.spareparts.find({}, {"_id": 0}).to_list(1000)
    low_stock_count = sum(1 for s in low_stock if s.get("stock", 0) <= s.get("min_stock", 0))

    # Revenue chart last 7 days
    chart_revenue = []
    for i in range(6, -1, -1):
        d = (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d")
        pays = await db.payments.find({"created_at": {"$regex": f"^{d}"}}, {"_id": 0}).to_list(1000)
        chart_revenue.append({"date": d[5:], "total": sum(p["amount"] for p in pays)})

    # Service chart last 7 days
    chart_services = []
    for i in range(6, -1, -1):
        d = (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d")
        c = await db.services.count_documents({"created_at": {"$regex": f"^{d}"}})
        chart_services.append({"date": d[5:], "count": c})

    recent_services = await db.services.find({}, {"_id": 0}).sort("created_at", -1).to_list(8)
    recent_activity = await db.audit_logs.find({}, {"_id": 0}).sort("created_at", -1).to_list(10)

    return {
        "services_today": services_today,
        "in_progress": in_progress,
        "done": done,
        "not_picked": not_picked,
        "revenue_today": revenue_today,
        "revenue_month": revenue_month,
        "profit_today": profit_today,
        "profit_month": profit_month,
        "top_technicians": top_techs,
        "low_stock_count": low_stock_count,
        "chart_revenue": chart_revenue,
        "chart_services": chart_services,
        "recent_services": recent_services,
        "recent_activity": recent_activity,
    }

# ---------- REPORTS ----------
@api.get("/reports/revenue")
async def report_revenue(start: str, end: str, group: str = "item", user: dict = Depends(require_roles("owner", "admin"))):
    """group = 'item' (per transaksi), 'day' (per hari), 'month' (per bulan)"""
    items = await db.payments.find({"created_at": {"$gte": start, "$lte": end + "T23:59:59"}}, {"_id": 0}).sort("created_at", 1).to_list(10000)
    total = sum(i["amount"] for i in items)
    if group == "day":
        buckets = {}
        for p in items:
            k = (p.get("created_at") or "")[:10]
            buckets.setdefault(k, {"period": k, "count": 0, "amount": 0})
            buckets[k]["count"] += 1
            buckets[k]["amount"] += p["amount"]
        return {"items": sorted(buckets.values(), key=lambda x: x["period"]), "total": total, "group": "day"}
    if group == "month":
        buckets = {}
        for p in items:
            k = (p.get("created_at") or "")[:7]
            buckets.setdefault(k, {"period": k, "count": 0, "amount": 0})
            buckets[k]["count"] += 1
            buckets[k]["amount"] += p["amount"]
        return {"items": sorted(buckets.values(), key=lambda x: x["period"]), "total": total, "group": "month"}
    return {"items": items, "total": total, "group": "item"}

@api.get("/reports/services")
async def report_services(start: str, end: str, group: str = "item", user: dict = Depends(require_roles("owner", "admin"))):
    items = await db.services.find({"created_at": {"$gte": start, "$lte": end + "T23:59:59"}}, {"_id": 0}).sort("created_at", 1).to_list(10000)
    if group == "day":
        buckets = {}
        for s in items:
            k = (s.get("created_at") or "")[:10]
            buckets.setdefault(k, {"period": k, "count": 0, "revenue": 0})
            buckets[k]["count"] += 1
            if s.get("status") in ("Selesai", "Sudah Diambil"):
                buckets[k]["revenue"] += s.get("final_cost", 0) or 0
        return {"items": sorted(buckets.values(), key=lambda x: x["period"]), "count": len(items), "group": "day"}
    if group == "month":
        buckets = {}
        for s in items:
            k = (s.get("created_at") or "")[:7]
            buckets.setdefault(k, {"period": k, "count": 0, "revenue": 0})
            buckets[k]["count"] += 1
            if s.get("status") in ("Selesai", "Sudah Diambil"):
                buckets[k]["revenue"] += s.get("final_cost", 0) or 0
        return {"items": sorted(buckets.values(), key=lambda x: x["period"]), "count": len(items), "group": "month"}
    return {"items": items, "count": len(items), "group": "item"}

@api.get("/reports/spareparts")
async def report_spareparts(user: dict = Depends(get_current_user)):
    items = await db.spareparts.find({}, {"_id": 0}).to_list(2000)
    return items

# --- Laporan Pembelian ---
@api.get("/reports/purchases")
async def report_purchases(start: str, end: str, group: str = "item", user: dict = Depends(require_roles("owner", "admin"))):
    q = {"created_at": {"$gte": start, "$lte": end + "T23:59:59"}}
    purchases = await db.purchases.find(q, {"_id": 0}).sort("created_at", 1).to_list(5000)
    total = sum(p.get("total", 0) or 0 for p in purchases)
    if group == "day":
        buckets = {}
        for p in purchases:
            k = (p.get("created_at") or "")[:10]
            buckets.setdefault(k, {"period": k, "count": 0, "amount": 0})
            buckets[k]["count"] += 1
            buckets[k]["amount"] += p.get("total", 0) or 0
        return {"items": sorted(buckets.values(), key=lambda x: x["period"]), "total": total, "group": "day"}
    if group == "month":
        buckets = {}
        for p in purchases:
            k = (p.get("created_at") or "")[:7]
            buckets.setdefault(k, {"period": k, "count": 0, "amount": 0})
            buckets[k]["count"] += 1
            buckets[k]["amount"] += p.get("total", 0) or 0
        return {"items": sorted(buckets.values(), key=lambda x: x["period"]), "total": total, "group": "month"}
    return {"items": purchases, "total": total, "group": "item"}

# --- Laporan Penjualan Sparepart (source=service|direct|all) ---
@api.get("/reports/sparepart-sales")
async def report_sparepart_sales(start: str, end: str, source: str = "all", group: str = "item", user: dict = Depends(require_roles("owner", "admin"))):
    """
    source:
      - service: dari sparepart yg dipakai di service (items_used)
      - direct: dari direct sales (POS)
      - all: gabungan
    """
    end_dt = end + "T23:59:59"
    entries: List[dict] = []
    if source in ("service", "all"):
        svcs = await db.services.find({
            "created_at": {"$gte": start, "$lte": end_dt},
            "items_used.0": {"$exists": True},
        }, {"_id": 0}).to_list(10000)
        for s in svcs:
            for it in s.get("items_used", []):
                entries.append({
                    "date": s.get("created_at"),
                    "source": "service",
                    "ref": s.get("service_number"),
                    "customer_name": s.get("customer_name"),
                    "sparepart_id": it.get("sparepart_id"),
                    "name": it.get("name"),
                    "qty": it.get("qty", 0),
                    "price": it.get("price", 0),
                    "subtotal": it.get("price", 0) * it.get("qty", 0),
                })
    if source in ("direct", "all"):
        sales = await db.direct_sales.find({
            "created_at": {"$gte": start, "$lte": end_dt},
            "status": {"$ne": "refunded"},
        }, {"_id": 0}).to_list(10000)
        for d in sales:
            for it in d.get("items", []):
                entries.append({
                    "date": d.get("created_at"),
                    "source": "direct",
                    "ref": d.get("sale_number"),
                    "customer_name": d.get("customer_name"),
                    "sparepart_id": it.get("sparepart_id"),
                    "name": it.get("name"),
                    "qty": it.get("qty", 0),
                    "price": it.get("price", 0),
                    "subtotal": it.get("price", 0) * it.get("qty", 0),
                })
    entries.sort(key=lambda x: x["date"] or "")
    total_qty = sum(e["qty"] for e in entries)
    total_amount = sum(e["subtotal"] for e in entries)

    if group == "day":
        buckets = {}
        for e in entries:
            k = (e.get("date") or "")[:10]
            buckets.setdefault(k, {"period": k, "qty": 0, "amount": 0})
            buckets[k]["qty"] += e["qty"]
            buckets[k]["amount"] += e["subtotal"]
        return {"items": sorted(buckets.values(), key=lambda x: x["period"]), "total_qty": total_qty, "total_amount": total_amount, "group": "day", "source": source}
    if group == "month":
        buckets = {}
        for e in entries:
            k = (e.get("date") or "")[:7]
            buckets.setdefault(k, {"period": k, "qty": 0, "amount": 0})
            buckets[k]["qty"] += e["qty"]
            buckets[k]["amount"] += e["subtotal"]
        return {"items": sorted(buckets.values(), key=lambda x: x["period"]), "total_qty": total_qty, "total_amount": total_amount, "group": "month", "source": source}
    if group == "sparepart":
        buckets = {}
        for e in entries:
            k = e["sparepart_id"]
            buckets.setdefault(k, {"sparepart_id": k, "name": e["name"], "qty": 0, "amount": 0})
            buckets[k]["qty"] += e["qty"]
            buckets[k]["amount"] += e["subtotal"]
        return {"items": sorted(buckets.values(), key=lambda x: x["amount"], reverse=True), "total_qty": total_qty, "total_amount": total_amount, "group": "sparepart", "source": source}
    return {"items": entries, "total_qty": total_qty, "total_amount": total_amount, "group": "item", "source": source}

# ---------- REPORT EXPORTS (Excel / PDF) ----------
def _fmt_idr(n):
    try:
        return f"Rp {int(round(n or 0)):,}".replace(",", ".")
    except Exception:
        return f"Rp {n}"

def _build_xlsx(title: str, headers: List[str], rows: List[List], totals: Optional[dict] = None, meta: Optional[dict] = None) -> bytes:
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from io import BytesIO
    wb = Workbook()
    ws = wb.active
    ws.title = title[:30]
    thin = Side(style="thin", color="CCCCCC")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    ws.append([title])
    ws["A1"].font = Font(bold=True, size=14)
    row = 2
    if meta:
        for k, v in meta.items():
            ws.append([f"{k}", str(v)])
            row += 1
    ws.append([])
    row += 1
    header_row = row
    ws.append(headers)
    for cell in ws[header_row]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="EA580C")
        cell.alignment = Alignment(horizontal="center")
        cell.border = border
    for r in rows:
        ws.append(r)
    for r_idx in range(header_row + 1, header_row + 1 + len(rows)):
        for cell in ws[r_idx]:
            cell.border = border
    if totals:
        ws.append([])
        for k, v in totals.items():
            ws.append([k, v])
            ws.cell(ws.max_row, 1).font = Font(bold=True)
            ws.cell(ws.max_row, 2).font = Font(bold=True)
    for i, _ in enumerate(headers, 1):
        ws.column_dimensions[chr(64 + i)].width = 20
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _build_pdf(title: str, headers: List[str], rows: List[List], totals: Optional[dict] = None, meta: Optional[dict] = None) -> bytes:
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from io import BytesIO
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), leftMargin=15 * mm, rightMargin=15 * mm, topMargin=15 * mm, bottomMargin=15 * mm)
    styles = getSampleStyleSheet()
    story = []
    story.append(Paragraph(f"<b>{title}</b>", ParagraphStyle("t", parent=styles["Title"], fontSize=16, textColor=colors.HexColor("#EA580C"))))
    if meta:
        for k, v in meta.items():
            story.append(Paragraph(f"<b>{k}:</b> {v}", styles["Normal"]))
    story.append(Spacer(1, 8))
    data = [headers] + [[str(c) if c is not None else "" for c in r] for r in rows]
    t = Table(data, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EA580C")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CCCCCC")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FFF7ED")]),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t)
    if totals:
        story.append(Spacer(1, 10))
        for k, v in totals.items():
            story.append(Paragraph(f"<b>{k}:</b> {v}", styles["Normal"]))
    doc.build(story)
    return buf.getvalue()


def _stream_file(content: bytes, filename: str, media_type: str):
    from fastapi.responses import Response
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api.get("/reports/export")
async def export_report(
    type: str,
    format: str = "xlsx",
    start: Optional[str] = None,
    end: Optional[str] = None,
    group: str = "item",
    technician_id: Optional[str] = None,
    user: dict = Depends(require_roles("owner", "admin")),
):
    """
    type: revenue | services | spareparts | technicians | technicians-profit | financial | salary-slip
    format: xlsx | pdf
    """
    if not start: start = datetime.now(timezone.utc).strftime("%Y-%m-01")
    if not end: end = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    end_dt = end + "T23:59:59"
    meta = {"Periode": f"{start} s/d {end}"}
    title = ""
    headers: List[str] = []
    rows: List[List] = []
    totals: dict = {}

    if type == "revenue":
        pays = await db.payments.find({"created_at": {"$gte": start, "$lte": end_dt}}, {"_id": 0}).sort("created_at", 1).to_list(10000)
        total = sum(p["amount"] for p in pays)
        title = f"Laporan Pendapatan ({group})"
        meta["Grouping"] = {"item": "Per Transaksi", "day": "Per Hari", "month": "Per Bulan"}.get(group, group)
        if group == "day":
            headers = ["Tanggal", "Jumlah Transaksi", "Total (Rp)"]
            buckets = {}
            for p in pays:
                k = (p.get("created_at") or "")[:10]
                buckets.setdefault(k, [0, 0])
                buckets[k][0] += 1
                buckets[k][1] += p["amount"]
            for k in sorted(buckets):
                rows.append([k, buckets[k][0], _fmt_idr(buckets[k][1])])
        elif group == "month":
            headers = ["Bulan", "Jumlah Transaksi", "Total (Rp)"]
            buckets = {}
            for p in pays:
                k = (p.get("created_at") or "")[:7]
                buckets.setdefault(k, [0, 0])
                buckets[k][0] += 1
                buckets[k][1] += p["amount"]
            for k in sorted(buckets):
                rows.append([k, buckets[k][0], _fmt_idr(buckets[k][1])])
        else:
            headers = ["Tanggal", "No Service", "Pelanggan", "Metode", "Tipe", "Jumlah (Rp)"]
            for p in pays:
                rows.append([(p.get("created_at") or "")[:16].replace("T", " "), p.get("service_number", ""), p.get("customer_name", ""), p.get("method", ""), p.get("type", ""), _fmt_idr(p.get("amount", 0))])
        totals = {"Total Pendapatan": _fmt_idr(total)}

    elif type == "services":
        svcs = await db.services.find({"created_at": {"$gte": start, "$lte": end_dt}}, {"_id": 0}).sort("created_at", 1).to_list(10000)
        title = f"Laporan Service ({group})"
        meta["Grouping"] = {"item": "Per Service", "day": "Per Hari", "month": "Per Bulan"}.get(group, group)
        if group == "day":
            headers = ["Tanggal", "Jumlah Service", "Pendapatan (Rp)"]
            buckets = {}
            for s in svcs:
                k = (s.get("created_at") or "")[:10]
                buckets.setdefault(k, [0, 0])
                buckets[k][0] += 1
                if s.get("status") in ("Selesai", "Sudah Diambil"):
                    buckets[k][1] += s.get("final_cost", 0) or 0
            for k in sorted(buckets):
                rows.append([k, buckets[k][0], _fmt_idr(buckets[k][1])])
        elif group == "month":
            headers = ["Bulan", "Jumlah Service", "Pendapatan (Rp)"]
            buckets = {}
            for s in svcs:
                k = (s.get("created_at") or "")[:7]
                buckets.setdefault(k, [0, 0])
                buckets[k][0] += 1
                if s.get("status") in ("Selesai", "Sudah Diambil"):
                    buckets[k][1] += s.get("final_cost", 0) or 0
            for k in sorted(buckets):
                rows.append([k, buckets[k][0], _fmt_idr(buckets[k][1])])
        else:
            headers = ["Tanggal", "No Service", "Pelanggan", "Device", "Status", "Biaya Jasa", "Total (Rp)"]
            for s in svcs:
                rows.append([
                    (s.get("created_at") or "")[:16].replace("T", " "),
                    s.get("service_number", ""), s.get("customer_name", ""),
                    f"{s.get('brand','')} {s.get('model','')}".strip(),
                    s.get("status", ""),
                    _fmt_idr(s.get("service_fee") or s.get("estimated_cost") or 0),
                    _fmt_idr(s.get("final_cost", 0)),
                ])
        totals = {"Jumlah Service": len(svcs)}

    elif type == "spareparts":
        items = await db.spareparts.find({}, {"_id": 0}).to_list(2000)
        title = "Laporan Sparepart & Stok"
        headers = ["Kode", "Nama", "Stok", "Min Stok", "Modal", "Harga Jual"]
        for p in items:
            rows.append([p.get("code", ""), p.get("name", ""), p.get("stock", 0), p.get("min_stock", 0), _fmt_idr(p.get("cost_price", 0)), _fmt_idr(p.get("sell_price", 0))])
        totals = {"Total SKU": len(items)}
        meta.pop("Periode", None)

    elif type == "technicians-profit":
        # reuse endpoint logic
        techs = await db.technicians.find({}, {"_id": 0}).to_list(500)
        if technician_id:
            techs = [t for t in techs if t["id"] == technician_id]
        title = "Laporan Laba Teknisi"
        headers = ["Teknisi", "% Komisi", "Jumlah Job", "Total Biaya Jasa", "Total Komisi"]
        grand_fee = 0
        grand_comm = 0
        for t in techs:
            svcs = await db.services.find({
                "assigned_technician_id": t["id"],
                "status": {"$in": ["Selesai", "Sudah Diambil"]},
                "created_at": {"$gte": start, "$lte": end_dt},
            }, {"_id": 0}).to_list(2000)
            pct = t.get("commission_percent", 0) / 100
            total_fee = sum(s.get("service_fee", s.get("estimated_cost", 0) or 0) or 0 for s in svcs)
            comm = round(total_fee * pct)
            grand_fee += total_fee
            grand_comm += comm
            rows.append([t["name"], f"{t.get('commission_percent',0)}%", len(svcs), _fmt_idr(total_fee), _fmt_idr(comm)])
        totals = {"Total Biaya Jasa": _fmt_idr(grand_fee), "Total Komisi": _fmt_idr(grand_comm)}

    elif type == "salary-slip":
        if not technician_id:
            raise HTTPException(400, "technician_id wajib diisi untuk slip gaji")
        tech = await db.technicians.find_one({"id": technician_id}, {"_id": 0})
        if not tech: raise HTTPException(404, "Teknisi tidak ditemukan")
        pct = tech.get("commission_percent", 0) / 100
        svcs = await db.services.find({
            "assigned_technician_id": technician_id,
            "status": {"$in": ["Selesai", "Sudah Diambil"]},
            "created_at": {"$gte": start, "$lte": end_dt},
        }, {"_id": 0}).sort("created_at", 1).to_list(2000)
        title = f"Slip Gaji Teknisi — {tech['name']}"
        meta["Teknisi"] = tech["name"]
        meta["Persen Komisi"] = f"{tech.get('commission_percent',0)}%"
        headers = ["Tanggal", "No Service", "Pelanggan", "Device", "Biaya Jasa", "Komisi"]
        total_fee = 0
        total_comm = 0
        for s in svcs:
            fee = s.get("service_fee", s.get("estimated_cost", 0) or 0) or 0
            comm = round(fee * pct)
            total_fee += fee
            total_comm += comm
            rows.append([
                (s.get("created_at") or "")[:10],
                s.get("service_number", ""),
                s.get("customer_name", ""),
                f"{s.get('brand','')} {s.get('model','')}".strip(),
                _fmt_idr(fee), _fmt_idr(comm),
            ])
        totals = {
            "Jumlah Job": len(svcs),
            "Total Biaya Jasa": _fmt_idr(total_fee),
            "TOTAL KOMISI (GAJI)": _fmt_idr(total_comm),
        }

    elif type == "financial":
        pays = await db.payments.find({"created_at": {"$gte": start, "$lte": end_dt}}, {"_id": 0}).to_list(10000)
        svcs = await db.services.find({"created_at": {"$gte": start, "$lte": end_dt}}, {"_id": 0}).to_list(10000)
        omzet = sum(p["amount"] for p in pays)
        laba = sum(s.get("profit", 0) or 0 for s in svcs if s.get("status") in ["Selesai", "Sudah Diambil"])
        modal = sum(s.get("sparepart_cost", 0) or 0 for s in svcs)
        title = "Laporan Keuangan"
        headers = ["Metrik", "Nilai"]
        rows = [
            ["Omzet (Total Pembayaran)", _fmt_idr(omzet)],
            ["Modal Sparepart", _fmt_idr(modal)],
            ["Laba Bruto", _fmt_idr(laba)],
            ["Jumlah Service", len(svcs)],
        ]

    elif type == "purchases":
        purchases = await db.purchases.find({"created_at": {"$gte": start, "$lte": end_dt}}, {"_id": 0}).sort("created_at", 1).to_list(5000)
        total = sum(p.get("total", 0) or 0 for p in purchases)
        title = f"Laporan Pembelian ({group})"
        meta["Grouping"] = {"item": "Per PO", "day": "Per Hari", "month": "Per Bulan"}.get(group, group)
        if group == "day":
            headers = ["Tanggal", "Jumlah PO", "Total"]
            buckets = {}
            for p in purchases:
                k = (p.get("created_at") or "")[:10]
                buckets.setdefault(k, [0, 0])
                buckets[k][0] += 1
                buckets[k][1] += p.get("total", 0) or 0
            for k in sorted(buckets):
                rows.append([k, buckets[k][0], _fmt_idr(buckets[k][1])])
        elif group == "month":
            headers = ["Bulan", "Jumlah PO", "Total"]
            buckets = {}
            for p in purchases:
                k = (p.get("created_at") or "")[:7]
                buckets.setdefault(k, [0, 0])
                buckets[k][0] += 1
                buckets[k][1] += p.get("total", 0) or 0
            for k in sorted(buckets):
                rows.append([k, buckets[k][0], _fmt_idr(buckets[k][1])])
        else:
            headers = ["Tanggal", "No PO", "Supplier", "Jml Item", "Total"]
            for p in purchases:
                rows.append([(p.get("created_at") or "")[:16].replace("T", " "), p.get("purchase_number", ""), p.get("supplier_name", ""), sum(i.get("qty", 0) for i in p.get("items", [])), _fmt_idr(p.get("total", 0))])
        totals = {"Total Pembelian": _fmt_idr(total)}

    elif type == "sparepart-sales":
        source = (start and "all") or "all"
        # Use same collector logic
        entries = []
        if True:
            svcs = await db.services.find({
                "created_at": {"$gte": start, "$lte": end_dt},
                "items_used.0": {"$exists": True},
            }, {"_id": 0}).to_list(10000)
            for s in svcs:
                for it in s.get("items_used", []):
                    entries.append({
                        "date": s.get("created_at"), "source": "service",
                        "ref": s.get("service_number"), "customer_name": s.get("customer_name"),
                        "name": it.get("name"), "qty": it.get("qty", 0),
                        "price": it.get("price", 0), "subtotal": it.get("price", 0) * it.get("qty", 0),
                    })
            sales = await db.direct_sales.find({
                "created_at": {"$gte": start, "$lte": end_dt},
                "status": {"$ne": "refunded"},
            }, {"_id": 0}).to_list(10000)
            for d in sales:
                for it in d.get("items", []):
                    entries.append({
                        "date": d.get("created_at"), "source": "direct",
                        "ref": d.get("sale_number"), "customer_name": d.get("customer_name"),
                        "name": it.get("name"), "qty": it.get("qty", 0),
                        "price": it.get("price", 0), "subtotal": it.get("price", 0) * it.get("qty", 0),
                    })
        entries.sort(key=lambda x: x["date"] or "")
        total_qty = sum(e["qty"] for e in entries)
        total_amount = sum(e["subtotal"] for e in entries)
        title = "Laporan Penjualan Sparepart"
        if group == "sparepart":
            headers = ["Sparepart", "Total Qty", "Total (Rp)"]
            buckets = {}
            for e in entries:
                k = e["name"]
                buckets.setdefault(k, [0, 0])
                buckets[k][0] += e["qty"]
                buckets[k][1] += e["subtotal"]
            for k in sorted(buckets, key=lambda n: buckets[n][1], reverse=True):
                rows.append([k, buckets[k][0], _fmt_idr(buckets[k][1])])
        elif group == "day":
            headers = ["Tanggal", "Qty", "Total"]
            buckets = {}
            for e in entries:
                k = (e["date"] or "")[:10]
                buckets.setdefault(k, [0, 0])
                buckets[k][0] += e["qty"]
                buckets[k][1] += e["subtotal"]
            for k in sorted(buckets):
                rows.append([k, buckets[k][0], _fmt_idr(buckets[k][1])])
        elif group == "month":
            headers = ["Bulan", "Qty", "Total"]
            buckets = {}
            for e in entries:
                k = (e["date"] or "")[:7]
                buckets.setdefault(k, [0, 0])
                buckets[k][0] += e["qty"]
                buckets[k][1] += e["subtotal"]
            for k in sorted(buckets):
                rows.append([k, buckets[k][0], _fmt_idr(buckets[k][1])])
        else:
            headers = ["Tanggal", "Sumber", "Ref", "Pelanggan", "Sparepart", "Qty", "Harga", "Subtotal"]
            for e in entries:
                rows.append([
                    (e["date"] or "")[:10],
                    "Service" if e["source"] == "service" else "Direct",
                    e["ref"], e["customer_name"], e["name"], e["qty"],
                    _fmt_idr(e["price"]), _fmt_idr(e["subtotal"]),
                ])
        totals = {"Total Qty": total_qty, "Total Penjualan": _fmt_idr(total_amount)}
    else:
        raise HTTPException(400, "Tipe laporan tidak dikenal")

    filename_base = f"{type}_{start}_{end}"
    if format == "pdf":
        content = _build_pdf(title, headers, rows, totals, meta)
        return _stream_file(content, f"{filename_base}.pdf", "application/pdf")
    else:
        content = _build_xlsx(title, headers, rows, totals, meta)
        return _stream_file(content, f"{filename_base}.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

# ---------- AUDIT LOGS ----------
@api.get("/audit-logs")
async def audit_logs(user: dict = Depends(require_roles("owner", "admin"))):
    logs = await db.audit_logs.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return logs

# ---------- SETTINGS ----------
@api.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    defaults = {"id": "main", "shop_name": "Service HP Manager", "app_name": "Service HP Manager",
                "address": "", "whatsapp": "", "instagram": "", "facebook": "", "email": "", "website": "",
                "tax_percent": 0, "default_service_fee": 0,
                "logo": "", "logo_login": "", "favicon": "",
                "primary_color": "#ea7c1f", "secondary_color": "#1e293b",
                "footer_text": "© 2026 Service HP Manager", "label_size": "58mm",
                "invoice_template": "", "wa_template": "",
                "print_header_title": "", "print_header_subtitle": "",
                "print_header_address": "", "print_header_phone": "",
                "print_footer_text": "Terima kasih telah menggunakan layanan kami.",
                "label_header_title": "", "label_footer_text": "",
                "qr_header_title": "", "qr_footer_text": ""}
    s = await db.settings.find_one({"id": "main"}, {"_id": 0})
    if not s:
        await db.settings.insert_one(defaults)
        return defaults
    # merge defaults for missing keys
    merged = {**defaults, **s}
    return merged

@api.patch("/settings")
async def update_settings(data: SettingsIn, user: dict = Depends(require_roles("owner", "admin"))):
    upd = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    await db.settings.update_one({"id": "main"}, {"$set": upd}, upsert=True)
    await audit(user, "update", "settings", "main")
    return await db.settings.find_one({"id": "main"}, {"_id": 0})

# ---------- ADMIN: RESET DATABASE ----------
class ResetDBIn(BaseModel):
    confirm_text: str  # Harus "RESET DATABASE"
    keep_users: bool = True
    keep_settings: bool = True

@api.post("/admin/reset-database")
async def reset_database(data: ResetDBIn, user: dict = Depends(require_roles("owner"))):
    if data.confirm_text != "RESET DATABASE":
        raise HTTPException(400, "Konfirmasi salah. Ketik 'RESET DATABASE' dengan tepat.")
    # Collections yang selalu di-wipe
    to_wipe = [
        "services", "customers", "spareparts", "suppliers", "purchases",
        "payments", "direct_sales", "inventory_history", "audit_logs",
        "technicians", "wa_logs", "user_change_requests", "sparepart_categories",
    ]
    counts = {}
    for c in to_wipe:
        r = await db[c].delete_many({})
        counts[c] = r.deleted_count
    if not data.keep_users:
        # jangan hapus user owner yang sedang login
        r = await db.users.delete_many({"id": {"$ne": user["id"]}})
        counts["users"] = r.deleted_count
    if not data.keep_settings:
        r = await db.settings.delete_many({})
        counts["settings"] = r.deleted_count
    # Re-seed defaults
    await seed()
    await audit(user, "reset_database", "system", "main", counts)
    logger.warning(f"[RESET DB] by {user['name']} - counts: {counts}")
    return {"ok": True, "deleted_counts": counts, "message": "Database telah di-reset. Data default sudah dibuat ulang."}

# ---------- GLOBAL SEARCH ----------
@api.get("/search")
async def global_search(q: str, user: dict = Depends(get_current_user)):
    if not q: return {"customers": [], "services": []}
    rx = {"$regex": q, "$options": "i"}
    customers = await db.customers.find({"$or": [{"name": rx}, {"phone": rx}]}, {"_id": 0}).limit(10).to_list(10)
    services = await db.services.find({"$or": [
        {"service_number": rx}, {"imei1": rx}, {"customer_name": rx}, {"customer_phone": rx}
    ]}, {"_id": 0}).limit(10).to_list(10)
    return {"customers": customers, "services": services}

# ---------- WHATSAPP (Fonnte with mock fallback) ----------
import httpx

DEFAULT_WA_TEMPLATES = {
    "create": (
        "Halo *{customer_name}*,\n\n"
        "Terima kasih telah mempercayakan servis di *{shop_name}*.\n\n"
        "Nomor Service: *{service_number}*\n"
        "Device: {brand} {model}\n"
        "Keluhan: {complaint}\n"
        "Estimasi Biaya: Rp {estimated_cost}\n\n"
        "Lacak status: {tracking_url}\n\n"
        "Terima kasih 🙏"
    ),
    "diagnose": (
        "Halo *{customer_name}*,\n\n"
        "Diagnosa untuk device *{brand} {model}* (No. {service_number}) sudah selesai.\n\n"
        "Diagnosa: {diagnosis}\n"
        "Kerusakan: {damage}\n"
        "Tindakan: {action}\n"
        "Total Biaya: *Rp {estimated_cost}*\n"
        "Estimasi Selesai: {estimated_days} hari\n\n"
        "Mohon konfirmasi persetujuan perbaikan.\n"
        "Lacak: {tracking_url}"
    ),
    "ready": (
        "Halo *{customer_name}*,\n\n"
        "Kabar baik! Device *{brand} {model}* (No. {service_number}) sudah *SELESAI* dan siap diambil.\n\n"
        "Total Biaya: *Rp {final_cost}*\n"
        "Sudah Dibayar: Rp {total_paid}\n"
        "Sisa: Rp {remaining}\n\n"
        "Silakan datang ke *{shop_name}* untuk mengambil unit Anda.\n"
        "Jam operasional: 09:00 - 20:00\n\n"
        "Lacak: {tracking_url}"
    ),
    "pickup": (
        "Halo *{customer_name}*,\n\n"
        "Terima kasih telah mengambil device *{brand} {model}* (No. {service_number}).\n\n"
        "Garansi: *{warranty_days} hari*\n"
        "Berlaku hingga: {warranty_until}\n\n"
        "Simpan nota ini untuk klaim garansi. Semoga puas dengan pelayanan kami! ⭐\n"
        "- {shop_name}"
    ),
}

def _fmt_rp(n) -> str:
    try:
        return f"{int(n or 0):,}".replace(",", ".")
    except Exception:
        return str(n or 0)

async def render_wa_template(kind: str, service: dict, extra: dict = None) -> str:
    settings = await db.settings.find_one({"id": "main"}, {"_id": 0}) or {}
    tpl = settings.get(f"wa_template_{kind}") or DEFAULT_WA_TEMPLATES.get(kind, "")
    shop_name = settings.get("shop_name") or settings.get("app_name") or "Service HP Manager"
    diag = service.get("diagnosis") or {}
    final_cost = service.get("final_cost", 0) or 0
    total_paid = service.get("total_paid", 0) or 0
    ctx = {
        "customer_name": service.get("customer_name", "Pelanggan"),
        "shop_name": shop_name,
        "service_number": service.get("service_number", ""),
        "brand": service.get("brand", ""),
        "model": service.get("model", ""),
        "complaint": service.get("complaint", ""),
        "estimated_cost": _fmt_rp(service.get("estimated_cost", 0)),
        "final_cost": _fmt_rp(final_cost),
        "total_paid": _fmt_rp(total_paid),
        "remaining": _fmt_rp(max(0, final_cost - total_paid)),
        "diagnosis": diag.get("diagnosis", "-"),
        "damage": diag.get("damage", "-"),
        "action": diag.get("action", "-"),
        "estimated_days": diag.get("estimated_days", "-"),
        "warranty_days": service.get("warranty_days", 0),
        "warranty_until": (service.get("warranty_until") or "")[:10],
        "tracking_url": f"{os.environ.get('PUBLIC_APP_URL', '')}/track/{service.get('service_number', '')}",
    }
    if extra:
        ctx.update(extra)
    try:
        return tpl.format(**ctx)
    except KeyError:
        # Fallback: substitusi manual (biar tidak crash bila field custom)
        out = tpl
        for k, v in ctx.items():
            out = out.replace("{" + k + "}", str(v))
        return out

async def send_fonnte(phone: str, message: str) -> dict:
    """Kirim WA via Fonnte. Return dict {ok, provider, result|error}."""
    settings = await db.settings.find_one({"id": "main"}, {"_id": 0}) or {}
    token = settings.get("fonnte_token") or ""
    country = settings.get("fonnte_country_code") or "62"
    provider = (settings.get("wa_provider") or "").lower()
    if not phone:
        return {"ok": False, "provider": "none", "error": "phone kosong"}
    if provider != "fonnte" or not token or token in ("YOUR_FONNTE_TOKEN", "placeholder"):
        logger.info(f"[WA MOCK] -> {phone} | {message[:80]}")
        return {"ok": True, "provider": "mock", "result": {"info": "mock (token/provider belum di-set)"}}
    url = "https://api.fonnte.com/send"
    headers = {"Authorization": token}
    data = {"target": phone, "message": message, "countryCode": country}
    try:
        async with httpx.AsyncClient(timeout=15) as cli:
            r = await cli.post(url, headers=headers, data=data)
            try:
                payload = r.json()
            except Exception:
                payload = {"raw": r.text}
            ok = bool(payload.get("status", False)) if isinstance(payload, dict) else False
            return {"ok": ok, "provider": "fonnte", "status_code": r.status_code, "result": payload}
    except Exception as e:
        logger.exception("Fonnte send failed")
        return {"ok": False, "provider": "fonnte", "error": str(e)}

async def notify_service(kind: str, service_id: str, extra: dict = None):
    """Kirim notifikasi WA sesuai kind (create/diagnose/ready/pickup). Cek toggle Settings."""
    try:
        settings = await db.settings.find_one({"id": "main"}, {"_id": 0}) or {}
        toggle_key = f"wa_notif_on_{kind}"
        if not settings.get(toggle_key, True):
            return {"skipped": True, "reason": f"{toggle_key}=false"}
        service = await db.services.find_one({"id": service_id}, {"_id": 0})
        if not service:
            return {"skipped": True, "reason": "service not found"}
        phone = service.get("customer_phone") or ""
        if not phone:
            return {"skipped": True, "reason": "no phone"}
        message = await render_wa_template(kind, service, extra=extra)
        result = await send_fonnte(phone, message)
        await db.wa_logs.insert_one({
            "id": gen_id(),
            "kind": kind,
            "service_id": service_id,
            "service_number": service.get("service_number"),
            "phone": phone,
            "message": message,
            "provider": result.get("provider"),
            "ok": result.get("ok", False),
            "response": result,
            "sent_at": now_iso(),
        })
        return result
    except Exception as e:
        logger.exception(f"notify_service({kind}) failed")
        return {"ok": False, "error": str(e)}

class WhatsappSendIn(BaseModel):
    phone: str
    message: str
    service_id: Optional[str] = ""

@api.post("/whatsapp/send")
async def whatsapp_send(payload: WhatsappSendIn, user: dict = Depends(get_current_user)):
    """Manual WA send (dari halaman service detail atau tools)."""
    result = await send_fonnte(payload.phone, payload.message)
    await db.wa_logs.insert_one({
        "id": gen_id(), "kind": "manual",
        "service_id": payload.service_id or "", "phone": payload.phone,
        "message": payload.message, "provider": result.get("provider"),
        "ok": result.get("ok", False), "response": result,
        "sent_at": now_iso(), "by": user["name"],
    })
    return result

class WATestIn(BaseModel):
    phone: str
    message: Optional[str] = "Tes koneksi Fonnte dari Service HP Manager ✅"

@api.post("/whatsapp/test")
async def whatsapp_test(payload: WATestIn, user: dict = Depends(require_roles("owner", "admin"))):
    """Test koneksi Fonnte dengan mengirim pesan singkat."""
    result = await send_fonnte(payload.phone, payload.message)
    return result

@api.get("/whatsapp/logs")
async def whatsapp_logs(service_id: Optional[str] = None, limit: int = 100,
                       user: dict = Depends(require_roles("owner", "admin"))):
    q = {}
    if service_id:
        q["service_id"] = service_id
    items = await db.wa_logs.find(q, {"_id": 0}).sort("sent_at", -1).to_list(limit)
    return items

# ---------- Seed ----------
async def seed():
    await db.users.create_index("email", unique=True)
    await db.services.create_index("service_number", unique=True)
    await db.customers.create_index("phone")
    await db.spareparts.create_index("code")

    default_users = [
        ("owner@servicehp.id", "owner123", "Pak Budi", "owner"),
        ("admin@servicehp.id", "admin123", "Sari Admin", "admin"),
        ("teknisi@servicehp.id", "teknisi123", "Andi Teknisi", "teknisi"),
        ("kasir@servicehp.id", "kasir123", "Rina Kasir", "kasir"),
    ]
    for email, pwd, name, role in default_users:
        existing = await db.users.find_one({"email": email})
        if not existing:
            await db.users.insert_one({
                "id": gen_id(), "email": email, "password_hash": hash_password(pwd),
                "name": name, "role": role, "phone": "", "active": True, "created_at": now_iso()
            })

    if await db.customers.count_documents({}) == 0:
        cust_data = [
            {"name": "Pak Hendra", "phone": "081234567890", "whatsapp": "081234567890", "address": "Jl. Merdeka 10", "email": "", "notes": ""},
            {"name": "Bu Linda", "phone": "082345678901", "whatsapp": "082345678901", "address": "Jl. Sudirman 5", "email": "", "notes": ""},
            {"name": "Mas Tono", "phone": "083456789012", "whatsapp": "083456789012", "address": "Jl. Gatot 22", "email": "", "notes": ""},
        ]
        for c in cust_data:
            await db.customers.insert_one({**c, "id": gen_id(), "created_at": now_iso()})

    if await db.spareparts.count_documents({}) == 0:
        sp_data = [
            {"category": "LCD", "code": "LCD-IP12", "name": "LCD iPhone 12", "brand": "Apple", "cost_price": 800000, "sell_price": 1200000, "stock": 5, "min_stock": 2},
            {"category": "LCD", "code": "LCD-S22", "name": "LCD Samsung S22", "brand": "Samsung", "cost_price": 900000, "sell_price": 1300000, "stock": 3, "min_stock": 2},
            {"category": "Baterai", "code": "BAT-IP12", "name": "Baterai iPhone 12", "brand": "Apple", "cost_price": 250000, "sell_price": 450000, "stock": 1, "min_stock": 3},
            {"category": "Charger", "code": "CHG-USBC", "name": "Charger USB-C 25W", "brand": "Generic", "cost_price": 50000, "sell_price": 100000, "stock": 20, "min_stock": 5},
            {"category": "Speaker", "code": "SPK-IP11", "name": "Speaker iPhone 11", "brand": "Apple", "cost_price": 80000, "sell_price": 150000, "stock": 8, "min_stock": 2},
        ]
        for s in sp_data:
            await db.spareparts.insert_one({**s, "id": gen_id(), "supplier_id": "", "location": "", "photo": "", "created_at": now_iso()})

    if await db.suppliers.count_documents({}) == 0:
        await db.suppliers.insert_one({
            "id": gen_id(), "name": "Sparepart Mart Jakarta", "address": "Glodok",
            "whatsapp": "08111111111", "email": "", "pic": "Pak Anto", "created_at": now_iso()
        })

    if not await db.settings.find_one({"id": "main"}):
        await db.settings.insert_one({
            "id": "main", "shop_name": "Service HP Manager", "app_name": "Service HP Manager",
            "address": "Jl. Servis No. 1",
            "whatsapp": "081200000000", "instagram": "@servicehp", "facebook": "Service HP",
            "email": "", "website": "",
            "tax_percent": 0, "default_service_fee": 50000,
            "logo": "", "logo_login": "", "favicon": "",
            "primary_color": "#ea7c1f", "secondary_color": "#1e293b",
            "footer_text": "© 2026 Service HP Manager",
            "label_size": "58mm",
            "invoice_template": "", "wa_template": "",
            "wa_provider": "mock",
            "fonnte_token": "",
            "fonnte_country_code": "62",
            "wa_notif_on_create": True,
            "wa_notif_on_diagnose": True,
            "wa_notif_on_ready": True,
            "wa_notif_on_pickup": True,
            "wa_template_create": DEFAULT_WA_TEMPLATES["create"],
            "wa_template_diagnose": DEFAULT_WA_TEMPLATES["diagnose"],
            "wa_template_ready": DEFAULT_WA_TEMPLATES["ready"],
            "wa_template_pickup": DEFAULT_WA_TEMPLATES["pickup"],
        })

    # Backfill: pastikan settings punya field WA (untuk instalasi lama)
    _s = await db.settings.find_one({"id": "main"}) or {}
    _wa_defaults = {
        "wa_provider": _s.get("wa_provider") or "mock",
        "fonnte_token": _s.get("fonnte_token") or "",
        "fonnte_country_code": _s.get("fonnte_country_code") or "62",
        "wa_notif_on_create": _s.get("wa_notif_on_create", True),
        "wa_notif_on_diagnose": _s.get("wa_notif_on_diagnose", True),
        "wa_notif_on_ready": _s.get("wa_notif_on_ready", True),
        "wa_notif_on_pickup": _s.get("wa_notif_on_pickup", True),
        "wa_template_create": _s.get("wa_template_create") or DEFAULT_WA_TEMPLATES["create"],
        "wa_template_diagnose": _s.get("wa_template_diagnose") or DEFAULT_WA_TEMPLATES["diagnose"],
        "wa_template_ready": _s.get("wa_template_ready") or DEFAULT_WA_TEMPLATES["ready"],
        "wa_template_pickup": _s.get("wa_template_pickup") or DEFAULT_WA_TEMPLATES["pickup"],
    }
    await db.settings.update_one({"id": "main"}, {"$set": _wa_defaults}, upsert=True)

    # Seed default technicians (link to existing teknisi user)
    if await db.technicians.count_documents({}) == 0:
        tek_user = await db.users.find_one({"role": "teknisi"})
        if tek_user:
            await db.technicians.insert_one({
                "id": gen_id(), "user_id": tek_user["id"], "name": tek_user["name"],
                "phone": "", "address": "", "joined_at": now_iso(),
                "active": True, "specialization": "Hardware", "commission_percent": 10,
                "photo": "", "created_at": now_iso()
            })

@app.on_event("startup")
async def startup():
    await seed()
    logger.info("Service HP Manager API started")

@app.on_event("shutdown")
async def shutdown():
    client.close()

# Mount router
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)
