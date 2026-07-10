"""
OTP generation, session management, and RBAC helpers.
"""
import os
import uuid
import random
import bcrypt
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import request, jsonify, session as flask_session, g
from database import get_db

SESSION_TIMEOUT_MINUTES = 30
OTP_EXPIRY_MINUTES = 10
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15

# Role → allowed portals
ROLE_PORTAL = {
    "super_admin":        "admin",
    "procurement_admin":  "admin",
    "transport_admin":    "admin",
    "finance_admin":      "admin",
    "vendor_admin":       "vendor",
    "vendor_user":        "vendor",
    "transporter_admin":  "transporter",
    "transporter_user":   "transporter",
}

ADMIN_ROLES = {"super_admin", "procurement_admin", "transport_admin", "finance_admin"}


# ─── OTP ──────────────────────────────────────────────────────────────────────

def generate_otp() -> str:
    # FIXED_OTP overrides random generation — for testing while DLT registration is pending
    fixed = os.environ.get("FIXED_OTP", "").strip()
    if fixed:
        return fixed
    return f"{random.SystemRandom().randint(100000, 999999)}"


def hash_otp(otp: str) -> str:
    return bcrypt.hashpw(otp.encode(), bcrypt.gensalt()).decode()


def verify_otp_hash(otp: str, hashed: str) -> bool:
    return bcrypt.checkpw(otp.encode(), hashed.encode())


def create_otp(user_id: str, purpose: str) -> str:
    """Create a new OTP record, invalidate previous ones, return plaintext OTP."""
    otp = generate_otp()
    now = _utcnow()
    expires = _utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)
    conn = get_db()
    try:
        # Invalidate any previous unused OTPs for this user+purpose
        conn.execute(
            "UPDATE otp_tokens SET used=1 WHERE user_id=? AND purpose=? AND used=0",
            (user_id, purpose)
        )
        conn.execute(
            """INSERT INTO otp_tokens(id,user_id,otp_hash,purpose,expires_at,used,created_at)
               VALUES(?,?,?,?,?,0,?)""",
            (str(uuid.uuid4()), user_id, hash_otp(otp), purpose,
             expires.isoformat(), now.isoformat())
        )
        conn.commit()
    finally:
        conn.close()
    return otp


def validate_otp(user_id: str, otp: str, purpose: str) -> tuple[bool, str]:
    """Returns (success, error_message)."""
    conn = get_db()
    try:
        row = conn.execute(
            """SELECT id, otp_hash, expires_at, used
               FROM otp_tokens
               WHERE user_id=? AND purpose=? AND used=0
               ORDER BY created_at DESC LIMIT 1""",
            (user_id, purpose)
        ).fetchone()

        if not row:
            return False, "No pending OTP found"

        if _utcnow() > datetime.fromisoformat(row["expires_at"]):
            return False, "OTP has expired"

        if not verify_otp_hash(otp, row["otp_hash"]):
            return False, "Invalid OTP"

        conn.execute("UPDATE otp_tokens SET used=1 WHERE id=?", (row["id"],))
        conn.commit()
        return True, ""
    finally:
        conn.close()


# ─── SESSION ──────────────────────────────────────────────────────────────────

def create_session(user_id: str) -> str:
    """Delete existing sessions for user, create new one, return session token."""
    token = str(uuid.uuid4())
    now = _utcnow()
    expires = now + timedelta(minutes=SESSION_TIMEOUT_MINUTES)
    conn = get_db()
    try:
        # Single active session per user
        conn.execute("DELETE FROM sessions WHERE user_id=?", (user_id,))
        conn.execute(
            """INSERT INTO sessions(id,user_id,ip_address,user_agent,expires_at,created_at)
               VALUES(?,?,?,?,?,?)""",
            (token, user_id,
             request.remote_addr, request.headers.get("User-Agent", ""),
             expires.isoformat(), now.isoformat())
        )
        conn.execute(
            "UPDATE users SET last_login_at=? WHERE id=?",
            (now.isoformat(), user_id)
        )
        conn.commit()
    finally:
        conn.close()
    return token


def load_session(token: str):
    """Return user row if session is valid and not expired, else None.
    Rolls the expiry forward on each valid access."""
    if not token:
        return None
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT * FROM sessions WHERE id=?", (token,)
        ).fetchone()
        if not row:
            return None
        if _utcnow() > datetime.fromisoformat(row["expires_at"]):
            conn.execute("DELETE FROM sessions WHERE id=?", (token,))
            conn.commit()
            return None
        # Roll expiry
        new_expiry = (_utcnow() + timedelta(minutes=SESSION_TIMEOUT_MINUTES)).isoformat()
        conn.execute("UPDATE sessions SET expires_at=? WHERE id=?", (new_expiry, token))
        user = conn.execute(
            "SELECT * FROM users WHERE id=? AND is_active=1", (row["user_id"],)
        ).fetchone()
        conn.commit()
        return user
    finally:
        conn.close()


def destroy_session(token: str):
    conn = get_db()
    try:
        conn.execute("DELETE FROM sessions WHERE id=?", (token,))
        conn.commit()
    finally:
        conn.close()


# ─── LOCKOUT ──────────────────────────────────────────────────────────────────

def record_failed_attempt(user_id: str):
    conn = get_db()
    try:
        conn.execute(
            "UPDATE users SET failed_attempts = failed_attempts + 1 WHERE id=?",
            (user_id,)
        )
        row = conn.execute(
            "SELECT failed_attempts FROM users WHERE id=?", (user_id,)
        ).fetchone()
        if row and row["failed_attempts"] >= MAX_FAILED_ATTEMPTS:
            locked_until = (_utcnow() + timedelta(minutes=LOCKOUT_MINUTES)).isoformat()
            conn.execute(
                "UPDATE users SET locked_until=? WHERE id=?", (locked_until, user_id)
            )
        conn.commit()
    finally:
        conn.close()


def clear_failed_attempts(user_id: str):
    conn = get_db()
    try:
        conn.execute(
            "UPDATE users SET failed_attempts=0, locked_until=NULL WHERE id=?",
            (user_id,)
        )
        conn.commit()
    finally:
        conn.close()


def is_locked(user) -> bool:
    if not user["locked_until"]:
        return False
    return _utcnow() < datetime.fromisoformat(user["locked_until"])


# ─── DECORATORS ───────────────────────────────────────────────────────────────

def _get_token():
    return (request.cookies.get("portal_session")
            or request.headers.get("X-Session-Token"))


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = _get_token()
        user = load_session(token)
        if not user:
            if request.is_json:
                return jsonify({"error": "Authentication required"}), 401
            from flask import redirect, url_for
            return redirect("/")
        g.user = dict(user)
        return f(*args, **kwargs)
    return decorated


def roles_required(*roles):
    def decorator(f):
        @wraps(f)
        @login_required
        def decorated(*args, **kwargs):
            if g.user["role"] not in roles:
                if request.is_json:
                    return jsonify({"error": "Forbidden"}), 403
                from flask import abort
                abort(403)
            return f(*args, **kwargs)
        return decorated
    return decorator


def admin_required(f):
    return roles_required(*ADMIN_ROLES)(f)


def vendor_required(f):
    return roles_required("vendor_admin", "vendor_user")(f)


def transporter_required(f):
    return roles_required("transporter_admin", "transporter_user")(f)


# ─── AUDIT ────────────────────────────────────────────────────────────────────

def audit(actor_id: str, entity_type: str, entity_id: str, action: str,
          before=None, after=None):
    import json
    conn = get_db()
    try:
        conn.execute(
            """INSERT INTO audit_logs
               (id,actor_user_id,entity_type,entity_id,action,
                before_state,after_state,ip_address,user_agent,created_at)
               VALUES(?,?,?,?,?,?,?,?,?,?)""",
            (str(uuid.uuid4()), actor_id, entity_type, entity_id, action,
             json.dumps(before) if before else None,
             json.dumps(after) if after else None,
             request.remote_addr if request else None,
             request.headers.get("User-Agent") if request else None,
             _utcnow().isoformat())
        )
        conn.commit()
    finally:
        conn.close()


# ─── HELPERS ──────────────────────────────────────────────────────────────────

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid.uuid4())
