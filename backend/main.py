"""
The Book — FastAPI backend
Firebase project : the-book-mcd
Database         : Cloud Firestore
Auth             : Firebase Authentication (ID token in Authorization: Bearer header)
"""

import os
from datetime import datetime, date, timezone
from typing import Optional
from functools import wraps

from dotenv import load_dotenv
load_dotenv()

import firebase_admin
from firebase_admin import credentials, auth, firestore

from fastapi import FastAPI, HTTPException, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# ── Firebase init ──────────────────────────────────────────────────────────────
_project = os.getenv("FIREBASE_PROJECT_ID", "the-book-mcd")

if not firebase_admin._apps:
    # Option 1: full JSON blob in env var (Render, Railway, etc.)
    _creds_json = os.getenv("GOOGLE_CREDENTIALS_JSON", "")
    # Option 2: path to a key file (local dev)
    _sa_env  = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
    _sa_path = _sa_env if (os.path.isabs(_sa_env) and os.path.exists(_sa_env)) else \
               os.path.join(os.path.dirname(os.path.abspath(__file__)), "serviceAccountKey.json")

    if _creds_json:
        import json as _json
        cred = credentials.Certificate(_json.loads(_creds_json))
        firebase_admin.initialize_app(cred, {"projectId": _project})
    elif os.path.exists(_sa_path):
        cred = credentials.Certificate(_sa_path)
        firebase_admin.initialize_app(cred, {"projectId": _project})
    else:
        # On GCP (Cloud Run) the default service account is used automatically
        firebase_admin.initialize_app(options={"projectId": _project})

_db_name = os.getenv("FIRESTORE_DATABASE", "thebook")
db = firestore.client(database=_db_name)

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(title="The Book API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://the-book-mcd.web.app",
        "https://the-book-mcd.firebaseapp.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Auth helpers ───────────────────────────────────────────────────────────────
class TokenData:
    def __init__(self, uid: str, role: str, email: str):
        self.uid   = uid
        self.role  = role
        self.email = email

def _verify_token(authorization: str = Header(...)) -> TokenData:
    """Verify Firebase ID token from Authorization: Bearer <token>"""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = authorization[7:]
    try:
        decoded = auth.verify_id_token(token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
    role  = decoded.get("role", "user")
    email = decoded.get("email", "")
    return TokenData(uid=decoded["uid"], role=role, email=email)

def require_staff(token: TokenData = Depends(_verify_token)) -> TokenData:
    if token.role not in ("staff", "admin"):
        raise HTTPException(status_code=403, detail="Staff or admin access required")
    return token

def require_admin(token: TokenData = Depends(_verify_token)) -> TokenData:
    if token.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return token

# ── Utility ────────────────────────────────────────────────────────────────────
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def _build_confirmation(reservation_date: str, count: int) -> str:
    safe_date = (reservation_date or date.today().isoformat()).replace("-", "")
    return f"TB-{safe_date}-{count + 1:03d}"

def _log(action: str, detail: str, actor: str = ""):
    db.collection("activity").add({
        "timestamp": _now_iso(),
        "action":    action,
        "detail":    detail,
        "actor":     actor,
    })

def _doc_to_dict(doc) -> dict:
    d = doc.to_dict()
    d["id"] = doc.id
    return d

# ── Pydantic models ────────────────────────────────────────────────────────────
class ReservationIn(BaseModel):
    reservationDate:        str
    startTime:              str
    durationMinutes:        int         = 60
    rideType:               str         = "Group"
    firstName:              str
    lastName:               str
    phoneNumber:            str         = ""
    adultCount:             int         = 1
    childCount:             int         = 0
    childAges:              str         = ""
    depositAmount:          float       = 0.0
    cardType:               str         = ""
    cardLast4:              str         = ""
    specialRequests:        str         = ""
    notes:                  str         = ""
    guideCount:             int         = 1
    bookedToCapacity:       bool        = False
    textConfirmationStatus: str         = "Pending"
    followUpStatus:         str         = "Pending"
    attendanceStatus:       Optional[str] = None   # None | checked-in | no-show

class AppointmentIn(BaseModel):
    title:           str
    owner:           str         = ""
    appointmentDate: str
    startTime:       str
    endTime:         str         = ""
    notes:           str         = ""

class DailyCapacityIn(BaseModel):
    maxRiders: int
    notes:     str = ""

class UserRoleIn(BaseModel):
    uid:  str
    role: str   # admin | staff | user

# ══════════════════════════════════════════════════════════════════════════════
# RESERVATIONS
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/reservations")
def get_reservations(token: TokenData = Depends(require_staff)):
    docs = (
        db.collection("reservations")
          .order_by("reservationDate")
          .order_by("startTime")
          .stream()
    )
    return [_doc_to_dict(d) for d in docs]


@app.post("/api/reservations", status_code=201)
def create_reservation(body: ReservationIn, token: TokenData = Depends(require_staff)):
    count = len(db.collection("reservations")
                  .where("reservationDate", "==", body.reservationDate)
                  .stream().__class__ and
                list(db.collection("reservations").stream()))
    # Count all docs for sequential number
    all_docs = list(db.collection("reservations").stream())
    conf_num = _build_confirmation(body.reservationDate, len(all_docs))

    data = body.model_dump()
    data["confirmationNumber"] = conf_num
    data["totalRiders"]        = body.adultCount + body.childCount
    data["createdAt"]          = _now_iso()
    data["updatedAt"]          = _now_iso()
    data["createdBy"]          = token.uid

    _, ref = db.collection("reservations").add(data)
    _log("Reservation created",
         f"{conf_num} — {body.firstName} {body.lastName} on {body.reservationDate} at {body.startTime}",
         token.email)

    data["id"] = ref.id
    return data


@app.put("/api/reservations/{doc_id}")
def update_reservation(doc_id: str, body: ReservationIn, token: TokenData = Depends(require_staff)):
    ref = db.collection("reservations").document(doc_id)
    snap = ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Reservation not found")

    data = body.model_dump()
    data["totalRiders"] = body.adultCount + body.childCount
    data["updatedAt"]   = _now_iso()
    data["updatedBy"]   = token.uid

    ref.update(data)
    existing = snap.to_dict()
    _log("Reservation updated",
         f"{existing.get('confirmationNumber', doc_id)} — {body.firstName} {body.lastName} on {body.reservationDate}",
         token.email)
    return {"status": "updated", "id": doc_id}


@app.patch("/api/reservations/{doc_id}/attendance")
async def update_attendance(doc_id: str, request: Request, token: TokenData = Depends(require_staff)):
    body = await request.json()
    status = body.get("attendanceStatus")
    if status not in (None, "checked-in", "no-show"):
        raise HTTPException(status_code=400, detail="Invalid attendanceStatus")
    ref = db.collection("reservations").document(doc_id)
    snap = ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Reservation not found")
    d = snap.to_dict()
    ref.update({"attendanceStatus": status, "updatedAt": _now_iso(), "updatedBy": token.uid})
    guest = f"{d.get('firstName', '')} {d.get('lastName', '')}".strip()
    conf  = d.get('confirmationNumber', doc_id)
    _log("Attendance updated", f"{conf} — {guest} → {status}", token.email)
    return {"status": "updated", "attendanceStatus": status}


@app.delete("/api/reservations/{doc_id}")
def delete_reservation(doc_id: str, token: TokenData = Depends(require_admin)):
    ref = db.collection("reservations").document(doc_id)
    snap = ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Reservation not found")
    d = snap.to_dict()
    ref.delete()
    _log("Reservation deleted",
         f"{d.get('confirmationNumber', doc_id)} — {d.get('firstName', '')} {d.get('lastName', '')}",
         token.email)
    return {"status": "deleted"}

# ══════════════════════════════════════════════════════════════════════════════
# APPOINTMENTS
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/appointments")
def get_appointments(token: TokenData = Depends(require_staff)):
    docs = (
        db.collection("appointments")
          .order_by("appointmentDate")
          .order_by("startTime")
          .stream()
    )
    return [_doc_to_dict(d) for d in docs]


@app.post("/api/appointments", status_code=201)
def create_appointment(body: AppointmentIn, token: TokenData = Depends(require_staff)):
    data = body.model_dump()
    data["createdAt"] = _now_iso()
    data["createdBy"] = token.uid
    _, ref = db.collection("appointments").add(data)
    _log("Appointment added",
         f"{body.title} — {body.owner} at {body.startTime} on {body.appointmentDate}",
         token.email)
    data["id"] = ref.id
    return data


@app.put("/api/appointments/{doc_id}")
def update_appointment(doc_id: str, body: AppointmentIn, token: TokenData = Depends(require_staff)):
    ref = db.collection("appointments").document(doc_id)
    if not ref.get().exists:
        raise HTTPException(status_code=404, detail="Appointment not found")
    data = body.model_dump()
    data["updatedAt"] = _now_iso()
    ref.update(data)
    _log("Appointment updated",
         f"{body.title} — {body.owner} at {body.startTime}", token.email)
    return {"status": "updated", "id": doc_id}


@app.delete("/api/appointments/{doc_id}")
def delete_appointment(doc_id: str, token: TokenData = Depends(require_staff)):
    ref = db.collection("appointments").document(doc_id)
    snap = ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Appointment not found")
    title = snap.to_dict().get("title", doc_id)
    ref.delete()
    _log("Appointment deleted", title, token.email)
    return {"status": "deleted"}

# ══════════════════════════════════════════════════════════════════════════════
# ACTIVITY LOG
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/activity")
def get_activity(token: TokenData = Depends(require_staff)):
    docs = (
        db.collection("activity")
          .order_by("timestamp", direction=firestore.Query.DESCENDING)
          .limit(200)
          .stream()
    )
    return [_doc_to_dict(d) for d in docs]

# ══════════════════════════════════════════════════════════════════════════════
# DAILY CAPACITY
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/capacity/{date_str}")
def get_capacity(date_str: str, token: TokenData = Depends(require_staff)):
    snap = db.collection("dailyCapacity").document(date_str).get()
    if snap.exists:
        return snap.to_dict()
    # Fall back to global setting
    settings = db.collection("settings").document("global").get()
    default_cap = settings.to_dict().get("defaultCapacity", 20) if settings.exists else 20
    return {"maxRiders": default_cap, "notes": ""}


@app.put("/api/capacity/{date_str}")
def set_capacity(date_str: str, body: DailyCapacityIn, token: TokenData = Depends(require_admin)):
    db.collection("dailyCapacity").document(date_str).set(body.model_dump())
    _log("Capacity updated", f"{date_str} → {body.maxRiders} riders", token.email)
    return {"status": "updated", "date": date_str, **body.model_dump()}

# ══════════════════════════════════════════════════════════════════════════════
# SETTINGS
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/settings")
def get_settings(token: TokenData = Depends(require_staff)):
    snap = db.collection("settings").document("global").get()
    if snap.exists:
        return snap.to_dict()
    return {"defaultCapacity": 20, "businessName": "The Book", "rideTypes": ["Group", "Private", "Kids"]}


@app.put("/api/settings")
async def update_settings(request: Request, token: TokenData = Depends(require_admin)):
    body = await request.json()
    db.collection("settings").document("global").set(body, merge=True)
    _log("Settings updated", str(list(body.keys())), token.email)
    return {"status": "updated"}

# ══════════════════════════════════════════════════════════════════════════════
# USER MANAGEMENT  (admin only)
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/users")
def list_users(token: TokenData = Depends(require_admin)):
    docs = db.collection("users").stream()
    result = []
    for d in docs:
        row = _doc_to_dict(d)
        # Enrich with live disabled status from Firebase Auth
        try:
            rec = auth.get_user(d.id)
            row["disabled"] = rec.disabled
        except Exception:
            row["disabled"] = False
        result.append(row)
    return result


class UidIn(BaseModel):
    uid: str


@app.post("/api/users/disable")
def disable_user(body: UidIn, token: TokenData = Depends(require_admin)):
    if body.uid == token.uid:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
    auth.update_user(body.uid, disabled=True)
    db.collection("users").document(body.uid).set({"disabled": True}, merge=True)
    _log("User deactivated", body.uid, token.email)
    return {"status": "disabled"}


@app.post("/api/users/enable")
def enable_user(body: UidIn, token: TokenData = Depends(require_admin)):
    auth.update_user(body.uid, disabled=False)
    db.collection("users").document(body.uid).set({"disabled": False}, merge=True)
    _log("User activated", body.uid, token.email)
    return {"status": "enabled"}


@app.post("/api/users/reset-password")
def reset_user_password(body: UidIn, token: TokenData = Depends(require_admin)):
    try:
        user_rec = auth.get_user(body.uid)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))
    link = auth.generate_password_reset_link(user_rec.email)
    _log("Password reset link generated", user_rec.email, token.email)
    return {"link": link, "email": user_rec.email}


@app.post("/api/users/role")
def set_user_role(body: UserRoleIn, token: TokenData = Depends(require_admin)):
    if body.role not in ("admin", "staff", "user"):
        raise HTTPException(status_code=400, detail="role must be admin | staff | user")
    # Set Firebase Custom Claim
    auth.set_custom_user_claims(body.uid, {"role": body.role})
    # Mirror in Firestore for display
    db.collection("users").document(body.uid).set({"role": body.role}, merge=True)
    _log("Role updated", f"{body.uid} → {body.role}", token.email)
    return {"status": "updated"}


@app.post("/api/users/create")
def create_user_stub(token: TokenData = Depends(require_admin)):
    raise HTTPException(status_code=410, detail="Use /api/users/invite instead")


@app.post("/api/users/invite")
async def invite_user(request: Request, token: TokenData = Depends(require_admin)):
    body = await request.json()
    email    = body.get("email")
    role     = body.get("role", "staff")
    password = body.get("password", "ChangeMe123!")

    if not email:
        raise HTTPException(status_code=400, detail="email required")
    if role not in ("admin", "staff", "user"):
        raise HTTPException(status_code=400, detail="Invalid role")

    try:
        user_record = auth.create_user(email=email, password=password)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    auth.set_custom_user_claims(user_record.uid, {"role": role})
    db.collection("users").document(user_record.uid).set({
        "email":     email,
        "role":      role,
        "createdAt": _now_iso(),
        "createdBy": token.uid,
    })
    _log("User invited", f"{email} as {role}", token.email)
    return {"status": "created", "uid": user_record.uid, "email": email, "role": role}


# ── Health check ───────────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {"status": "ok", "project": _project}
