"""Amar Alum Vendor & Transporter Portal — Main Flask Application
Port: 5002  (separate from main ERP)
"""
import os
import uuid
from datetime import datetime
from flask import (Flask, render_template, request, jsonify,
                   redirect, url_for, make_response, g, abort)
from dotenv import load_dotenv

load_dotenv()

from database import init_db, get_db
from auth import (
    create_otp, validate_otp, create_session, destroy_session,
    load_session, record_failed_attempt, clear_failed_attempts,
    is_locked, login_required, admin_required, vendor_required,
    transporter_required, roles_required, audit, new_id, ROLE_PORTAL
)
from email_service import init_mail, send_email, email_otp
from sms_service import send_otp as send_otp_sms
from routes.vendor_reg import bp as vendor_reg_bp
from routes.transporter_reg import bp as transporter_reg_bp
from routes.admin_reg import bp as admin_reg_bp
from routes.rfq import bp as rfq_bp
from routes.admin_rfq import bp as admin_rfq_bp
from routes.po import bp as po_bp
from routes.admin_po import bp as admin_po_bp
from routes.trips import bp as trips_bp
from routes.rate_cards import bp as rate_cards_bp
from routes.fleet import bp as fleet_bp
from routes.admin_trips import bp as admin_trips_bp
from routes.vendor_invoices import bp as vendor_invoices_bp
from routes.transporter_invoices import bp as transporter_invoices_bp
from routes.admin_invoices import bp as admin_invoices_bp

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", os.urandom(32))
app.config["MAX_CONTENT_LENGTH"] = 6 * 1024 * 1024  # 6 MB max upload

# ─── Init ──────────────────────────────────────────────────────────────────────────────
ini_db = init_db
init_db()
init_mail(app)

app.register_blueprint(vendor_reg_bp)
app.register_blueprint(transporter_reg_bp)
app.register_blueprint(admin_reg_bp)
app.register_blueprint(rfq_bp)
app.register_blueprint(admin_rfq_bp)
app.register_blueprint(po_bp)
app.register_blueprint(admin_po_bp)
app.register_blueprint(trips_bp)
app.register_blueprint(rate_cards_bp)
app.register_blueprint(fleet_bp)
app.register_blueprint(admin_trips_bp)
app.register_blueprint(vendor_invoices_bp)
app.register_blueprint(transporter_invoices_bp)
app.register_blueprint(admin_invoices_bp)

# Start scheduler only in main process (not reloader child)
if os.environ.get("WERKZEUG_RUN_MAIN") != "false":
    try:
        from scheduler import start_scheduler
        start_scheduler(app)
    except Exception as e:
        print(f"[Scheduler] Failed to start: {e}")


# ─── Auth API ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/auth/request-otp")
def api_request_otp():
    data = request.get_json(silent=True) or {}
    mobile = (data.get("mobile") or "").strip()
    if not mobile or len(mobile) < 10:
        return jsonify({"error": "Valid mobile number required"}), 400

    conn = get_db()
    try:
        user = conn.execute(
            "SELECT * FROM users WHERE mobile=?", (mobile,)
        ).fetchone()
    finally:
        conn.close()

    if not user:
        return jsonify({"error": "Mobile number not registered"}), 404

    if not user["is_active"]:
        return jsonify({"error": "Account is inactive"}), 403

    if is_locked(user):
        return jsonify({"error": "Account temporarily locked. Try again in 15 minutes."}), 429

    otp = create_otp(user["id"], "login")

    sent_sms = send_otp_sms(mobile, otp)
    if user["email"]:
        subj, html = email_otp(otp)
        send_email(user["email"], subj, html)

    return jsonify({
        "message": "OTP sent",
        "dev_otp": otp if os.environ.get("FLASK_ENV") == "development" else None
    })


@app.post("/api/auth/verify-otp")
def api_verify_otp():
    data = request.get_json(silent=True) or {}
    mobile = (data.get("mobile") or "").strip()
    otp    = (data.get("otp") or "").strip()

    if not mobile or not otp:
        return jsonify({"error": "Mobile and OTP are required"}), 400

    conn = get_db()
    try:
        user = conn.execute(
            "SELECT * FROM users WHERE mobile=?", (mobile,)
        ).fetchone()
    finally:
        conn.close()

    if not user:
        return jsonify({"error": "Mobile number not registered"}), 404

    if is_locked(user):
        return jsonify({"error": "Account temporarily locked"}), 429

    ok, err = validate_otp(user["id"], otp, "login")
    if not ok:
        record_failed_attempt(user["id"])
        return jsonify({"error": err}), 401

    clear_failed_attempts(user["id"])
    token = create_session(user["id"])

    portal = ROLE_PORTAL.get(user["role"], "vendor")
    redirect_url = f"/{portal}"

    resp = make_response(jsonify({
        "message": "Login successful",
        "redirect": redirect_url,
        "role": user["role"],
        "portal": portal
    }))
    resp.set_cookie(
        "portal_session", token,
        httponly=True, samesite="Lax",
        max_age=1800
    )
    return resp


@app.post("/api/auth/logout")
def api_logout():
    token = request.cookies.get("portal_session")
    if token:
        destroy_session(token)
    resp = make_response(jsonify({"message": "Logged out"}))
    resp.delete_cookie("portal_session")
    return resp


@app.get("/api/auth/me")
@login_required
def api_me():
    u = g.user
    name = None
    conn = get_db()
    try:
        if u["entity_type"] == "vendor" and u["entity_id"]:
            row = conn.execute(
                "SELECT contact_name FROM vendors WHERE id=?", (u["entity_id"],)
            ).fetchone()
            if row:
                name = row["contact_name"]
        elif u["entity_type"] == "transporter" and u["entity_id"]:
            row = conn.execute(
                "SELECT contact_name FROM transporters WHERE id=?", (u["entity_id"],)
            ).fetchone()
            if row:
                name = row["contact_name"]
    finally:
        conn.close()
    return jsonify({
        "id":          u["id"],
        "mobile":      u["mobile"],
        "email":       u["email"],
        "name":        name,
        "role":        u["role"],
        "entity_type": u["entity_type"],
        "entity_id":   u["entity_id"],
    })


# ─── Portal Shell Routes ─────────────────────────────────────────────────────────────────────

@app.get("/")
def landing():
    token = request.cookies.get("portal_session")
    user = load_session(token)
    if user:
        portal = ROLE_PORTAL.get(user["role"], "vendor")
        return redirect(f"/{portal}")
    return render_template("landing.html")


@app.get("/vendor")
@vendor_required
def vendor_portal():
    return render_template("vendor.html", user=g.user)


@app.get("/transporter")
@transporter_required
def transporter_portal():
    return render_template("transporter.html", user=g.user)


@app.get("/admin")
@admin_required
def admin_portal():
    return render_template("admin.html", user=g.user)


# ─── Vendor Registration (pre-auth flow) ────────────────────────────────────────────────

@app.post("/api/register/vendor/init")
def api_vendor_register_init():
    data = request.get_json(silent=True) or {}
    mobile = (data.get("mobile") or "").strip()
    email  = (data.get("email") or "").strip() or None

    if not mobile or len(mobile) < 10:
        return jsonify({"error": "Valid mobile number required"}), 400

    conn = get_db()
    try:
        existing = conn.execute(
            "SELECT id FROM users WHERE mobile=?", (mobile,)
        ).fetchone()
        if existing:
            return jsonify({"error": "Mobile already registered"}), 409

        now = datetime.utcnow().isoformat()
        vendor_id = new_id()
        user_id   = new_id()

        from datetime import timedelta
        draft_expires = (datetime.utcnow() + timedelta(days=30)).isoformat()

        conn.execute(
            """INSERT INTO vendors(id,company_name,gstin,pan_number,company_type,
               status,registration_step,draft_expires_at,created_at,updated_at)
               VALUES(?,'','','','',
               'draft',1,?,?,?)""",
            (vendor_id, draft_expires, now, now)
        )
        conn.execute(
            """INSERT INTO users(id,mobile,email,role,entity_type,entity_id,
               is_active,created_at,updated_at)
               VALUES(?,?,?,'vendor_admin','vendor',?,0,?,?)""",
            (user_id, mobile, email, vendor_id, now, now)
        )
        conn.commit()

        otp = create_otp(user_id, "registration")
        send_otp_sms(mobile, otp)
        if email:
            subj, html = email_otp(otp)
            send_email(email, subj, html)

        return jsonify({
            "message": "OTP sent for verification",
            "user_id": user_id,
            "vendor_id": vendor_id,
            "dev_otp": otp if os.environ.get("FLASK_ENV") == "development" else None
        }), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.post("/api/register/vendor/verify-otp")
def api_vendor_verify_otp():
    data = request.get_json(silent=True) or {}
    user_id = (data.get("user_id") or "").strip()
    otp     = (data.get("otp") or "").strip()

    ok, err = validate_otp(user_id, otp, "registration")
    if not ok:
        return jsonify({"error": err}), 401

    conn = get_db()
    try:
        conn.execute("UPDATE users SET is_active=1 WHERE id=?", (user_id,))
        conn.commit()
    finally:
        conn.close()

    token = create_session(user_id)
    resp = make_response(jsonify({"message": "Verified", "next_step": 1}))
    resp.set_cookie("portal_session", token, httponly=True,
                    samesite="Lax", max_age=7200)
    return resp


@app.post("/api/register/transporter/init")
def api_transporter_register_init():
    data = request.get_json(silent=True) or {}
    mobile = (data.get("mobile") or "").strip()
    email  = (data.get("email") or "").strip() or None

    if not mobile or len(mobile) < 10:
        return jsonify({"error": "Valid mobile number required"}), 400

    conn = get_db()
    try:
        existing = conn.execute(
            "SELECT id FROM users WHERE mobile=?", (mobile,)
        ).fetchone()
        if existing:
            return jsonify({"error": "Mobile already registered"}), 409

        now = datetime.utcnow().isoformat()
        from datetime import timedelta
        transporter_id = new_id()
        user_id        = new_id()
        draft_expires  = (datetime.utcnow() + timedelta(days=30)).isoformat()

        conn.execute(
            """INSERT INTO transporters(id,company_name,gstin,pan_number,company_type,
               status,registration_step,draft_expires_at,created_at,updated_at)
               VALUES(?,'','','','','draft',1,?,?,?)""",
            (transporter_id, draft_expires, now, now)
        )
        conn.execute(
            """INSERT INTO users(id,mobile,email,role,entity_type,entity_id,
               is_active,created_at,updated_at)
               VALUES(?,?,?,'transporter_admin','transporter',?,0,?,?)""",
            (user_id, mobile, email, transporter_id, now, now)
        )
        conn.commit()

        otp = create_otp(user_id, "registration")
        send_otp_sms(mobile, otp)
        if email:
            subj, html = email_otp(otp)
            send_email(email, subj, html)

        return jsonify({
            "message": "OTP sent",
            "user_id": user_id,
            "transporter_id": transporter_id,
            "dev_otp": otp if os.environ.get("FLASK_ENV") == "development" else None
        }), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.post("/api/register/transporter/verify-otp")
def api_transporter_verify_otp():
    data = request.get_json(silent=True) or {}
    user_id = (data.get("user_id") or "").strip()
    otp     = (data.get("otp") or "").strip()

    ok, err = validate_otp(user_id, otp, "registration")
    if not ok:
        return jsonify({"error": err}), 401

    conn = get_db()
    try:
        conn.execute("UPDATE users SET is_active=1 WHERE id=?", (user_id,))
        conn.commit()
    finally:
        conn.close()

    token = create_session(user_id)
    resp = make_response(jsonify({"message": "Verified", "next_step": 1}))
    resp.set_cookie("portal_session", token, httponly=True,
                    samesite="Lax", max_age=7200)
    return resp


# ─── Notification API ──────────────────────────────────────────────────────────────────────────

@app.get("/api/notifications")
@login_required
def api_notifications():
    conn = get_db()
    try:
        rows = conn.execute(
            """SELECT id, title, body, event_type, entity_type, entity_id,
                      is_read, created_at
               FROM notifications
               WHERE user_id=? AND channel='in_app'
               ORDER BY created_at DESC LIMIT 50""",
            (g.user["id"],)
        ).fetchall()
        unread = conn.execute(
            "SELECT COUNT(*) as n FROM notifications WHERE user_id=? AND is_read=0",
            (g.user["id"],)
        ).fetchone()["n"]
        return jsonify({
            "notifications": [dict(r) for r in rows],
            "unread_count": unread
        })
    finally:
        conn.close()


@app.post("/api/notifications/<nid>/read")
@login_required
def api_mark_read(nid):
    conn = get_db()
    try:
        conn.execute(
            "UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?",
            (nid, g.user["id"])
        )
        conn.commit()
    finally:
        conn.close()
    return jsonify({"ok": True})


@app.post("/api/notifications/read-all")
@login_required
def api_mark_all_read():
    conn = get_db()
    try:
        conn.execute(
            "UPDATE notifications SET is_read=1 WHERE user_id=? AND is_read=0",
            (g.user["id"],)
        )
        conn.commit()
    finally:
        conn.close()
    return jsonify({"ok": True})


# ─── Admin: seed super_admin ─────────────────────────────────────────────────────────────────

@app.post("/api/setup/admin")
def api_setup_admin():
    conn = get_db()
    try:
        existing = conn.execute(
            "SELECT id FROM users WHERE role='super_admin' LIMIT 1"
        ).fetchone()
        if existing:
            return jsonify({"error": "Admin already exists"}), 409

        data = request.get_json(silent=True) or {}
        mobile = (data.get("mobile") or "").strip()
        email  = (data.get("email") or "").strip() or None

        if not mobile:
            return jsonify({"error": "Mobile required"}), 400

        now = datetime.utcnow().isoformat()
        uid = new_id()
        conn.execute(
            """INSERT INTO users(id,mobile,email,role,entity_type,
               is_active,created_at,updated_at)
               VALUES(?,?,?,'super_admin','admin',1,?,?)""",
            (uid, mobile, email, now, now)
        )
        conn.commit()
        return jsonify({"message": "Super admin created", "user_id": uid}), 201
    finally:
        conn.close()


# ─── Dashboard APIs ──────────────────────────────────────────────────────────────────────────

@app.get("/api/vendor/dashboard")
@vendor_required
def api_vendor_dashboard():
    vendor_id = g.user["entity_id"]
    conn = get_db()
    try:
        now = datetime.utcnow().isoformat()
        month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0).isoformat()

        open_rfqs = conn.execute(
            """SELECT COUNT(*) as n FROM rfqs r
               WHERE r.status='published'
               AND r.submission_deadline > ?
               AND (r.target_type='open'
                    OR EXISTS(SELECT 1 FROM rfq_targeted_vendors
                              WHERE rfq_id=r.id AND vendor_id=?))""",
            (now, vendor_id)
        ).fetchone()["n"]

        active_quotes = conn.execute(
            "SELECT COUNT(*) as n FROM quotes WHERE vendor_id=? AND is_active=1 AND status='submitted'",
            (vendor_id,)
        ).fetchone()["n"]

        pending_ack = conn.execute(
            "SELECT COUNT(*) as n FROM purchase_orders WHERE vendor_id=? AND status='generated'",
            (vendor_id,)
        ).fetchone()["n"]

        pending_inv = conn.execute(
            "SELECT COUNT(*) as n FROM invoices WHERE party_type='vendor' AND party_id=? AND status='submitted'",
            (vendor_id,)
        ).fetchone()["n"]

        payments_month = conn.execute(
            """SELECT COALESCE(SUM(p.payment_amount),0) as total
               FROM payments p JOIN invoices i ON p.invoice_id=i.id
               WHERE i.party_type='vendor' AND i.party_id=? AND p.created_at>=?""",
            (vendor_id, month_start)
        ).fetchone()["total"]

        docs_expiring = conn.execute(
            """SELECT COUNT(*) as n FROM vendor_documents
               WHERE vendor_id=? AND expiry_status IN ('expiring_7','expiring_15','expiring_30','expired')
               AND is_deleted=0""",
            (vendor_id,)
        ).fetchone()["n"]

        vendor = conn.execute("SELECT status FROM vendors WHERE id=?", (vendor_id,)).fetchone()

        notifs = conn.execute(
            """SELECT title as message, event_type as type, created_at as time
               FROM notifications WHERE user_id=? AND channel='in_app'
               ORDER BY created_at DESC LIMIT 10""",
            (g.user["id"],)
        ).fetchall()

        return jsonify({
            "open_rfqs":           open_rfqs,
            "active_quotes":       active_quotes,
            "pending_ack":         pending_ack,
            "pending_invoices":    pending_inv,
            "payments_month":      payments_month,
            "docs_expiring":       docs_expiring,
            "registration_status": vendor["status"] if vendor else None,
            "recent_activity":     [dict(r) for r in notifs],
        })
    finally:
        conn.close()


@app.get("/api/transporter/dashboard")
@transporter_required
def api_transporter_dashboard():
    tid = g.user["entity_id"]
    conn = get_db()
    try:
        month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0).isoformat()

        pending_assign = conn.execute(
            "SELECT COUNT(*) as n FROM trips WHERE transporter_id=? AND status='assigned'", (tid,)
        ).fetchone()["n"]

        active_trips = conn.execute(
            """SELECT COUNT(*) as n FROM trips WHERE transporter_id=?
               AND status IN ('accepted','loaded','in_transit')""", (tid,)
        ).fetchone()["n"]

        pod_pending = conn.execute(
            "SELECT COUNT(*) as n FROM trips WHERE transporter_id=? AND status='delivered'", (tid,)
        ).fetchone()["n"]

        inv_pending = conn.execute(
            "SELECT COUNT(*) as n FROM invoices WHERE party_type='transporter' AND party_id=? AND status='submitted'",
            (tid,)
        ).fetchone()["n"]

        payments_month = conn.execute(
            """SELECT COALESCE(SUM(p.payment_amount),0) as total
               FROM payments p JOIN invoices i ON p.invoice_id=i.id
               WHERE i.party_type='transporter' AND i.party_id=? AND p.created_at>=?""",
            (tid, month_start)
        ).fetchone()["total"]

        compliance_alerts = conn.execute(
            """SELECT COUNT(*) as n FROM vehicle_documents vd
               JOIN vehicles v ON vd.vehicle_id=v.id
               WHERE v.transporter_id=? AND vd.expiry_status IN ('expired','expiring_7','expiring_15')
               AND vd.is_deleted=0""",
            (tid,)
        ).fetchone()["n"]

        tr = conn.execute("SELECT status FROM transporters WHERE id=?", (tid,)).fetchone()

        notifs = conn.execute(
            """SELECT title as message, event_type as type, created_at as time
               FROM notifications WHERE user_id=? AND channel='in_app'
               ORDER BY created_at DESC LIMIT 10""",
            (g.user["id"],)
        ).fetchall()

        return jsonify({
            "pending_assignments": pending_assign,
            "active_trips":        active_trips,
            "pod_pending":         pod_pending,
            "invoice_pending":     inv_pending,
            "payments_month":      payments_month,
            "compliance_alerts":   compliance_alerts,
            "registration_status": tr["status"] if tr else None,
            "recent_activity":     [dict(r) for r in notifs],
        })
    finally:
        conn.close()


@app.get("/api/admin/dashboard")
@admin_required
def api_admin_dashboard():
    conn = get_db()
    try:
        pending_reg = conn.execute(
            """SELECT COUNT(*) as n FROM (
               SELECT id FROM vendors WHERE status IN ('submitted','under_review','info_requested')
               UNION ALL
               SELECT id FROM transporters WHERE status IN ('submitted','under_review','info_requested')
            )"""
        ).fetchone()["n"]

        open_rfqs = conn.execute(
            "SELECT COUNT(*) as n FROM rfqs WHERE status='published'"
        ).fetchone()["n"]

        quotes_eval = conn.execute(
            """SELECT COUNT(DISTINCT rfq_id) as n FROM quotes
               WHERE status='submitted' AND is_active=1
               AND rfq_id IN (SELECT id FROM rfqs WHERE status='closed')"""
        ).fetchone()["n"]

        pos_grn = conn.execute(
            "SELECT COUNT(*) as n FROM purchase_orders WHERE status IN ('acknowledged','dispatched')"
        ).fetchone()["n"]

        inv_review = conn.execute(
            "SELECT COUNT(*) as n FROM invoices WHERE status='submitted'"
        ).fetchone()["n"]

        compliance = conn.execute(
            """SELECT COUNT(*) as n FROM (
               SELECT id FROM vendor_documents WHERE expiry_status IN ('expired','expiring_7') AND is_deleted=0
               UNION ALL
               SELECT id FROM transporter_documents WHERE expiry_status IN ('expired','expiring_7') AND is_deleted=0
               UNION ALL
               SELECT id FROM vehicle_documents WHERE expiry_status IN ('expired','expiring_7') AND is_deleted=0
            )"""
        ).fetchone()["n"]

        recent = conn.execute(
            """SELECT al.action as message, al.entity_type as type, al.created_at as time
               FROM audit_logs al ORDER BY al.created_at DESC LIMIT 15"""
        ).fetchall()

        return jsonify({
            "pending_registrations": pending_reg,
            "open_rfqs":             open_rfqs,
            "quotes_awaiting_eval":  quotes_eval,
            "pos_awaiting_grn":      pos_grn,
            "invoices_under_review": inv_review,
            "compliance_alerts":     compliance,
            "recent_activity":       [dict(r) for r in recent],
        })
    finally:
        conn.close()


# ─── Error Handlers ───────────────────────────────────────────────────────────────────────────

@app.errorhandler(403)
def forbidden(e):
    if request.is_json:
        return jsonify({"error": "Forbidden"}), 403
    return render_template("error.html", code=403,
                           message="You don't have permission to access this page."), 403


@app.errorhandler(404)
def not_found(e):
    if request.is_json:
        return jsonify({"error": "Not found"}), 404
    return render_template("error.html", code=404,
                           message="Page not found."), 404


@app.errorhandler(500)
def server_error(e):
    if request.is_json:
        return jsonify({"error": "Internal server error"}), 500
    return render_template("error.html", code=500,
                           message="Something went wrong. Please try again."), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5002))
    debug = os.environ.get("FLASK_ENV") == "development"
    app.run(host="0.0.0.0", port=port, debug=debug)
