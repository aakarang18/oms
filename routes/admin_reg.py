"""
Admin — Registration Review & Approval Workflow
"""
from datetime import datetime
from flask import Blueprint, request, jsonify, g

from database import get_db
from auth import admin_required, roles_required, audit, new_id
from email_service import send_email, email_registration_approved, email_registration_rejected
from sms_service import send_sms

bp = Blueprint("admin_reg", __name__)

PROCUREMENT_ROLES = ("super_admin", "procurement_admin")
TRANSPORT_ROLES   = ("super_admin", "transport_admin")


def _procurement_required(f):
    return roles_required(*PROCUREMENT_ROLES)(f)


def _transport_required(f):
    return roles_required(*TRANSPORT_ROLES)(f)


# ── Vendor list ───────────────────────────────────────────────────────────────

@bp.get("/api/admin/vendors")
@admin_required
def list_vendors():
    status = request.args.get("status", "submitted")
    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT v.id, v.company_name, v.gstin, v.pan_number, v.company_type,
                   v.contact_name, v.contact_mobile, v.contact_email,
                   v.reg_addr_city, v.reg_addr_state, v.status,
                   v.msme_registered, v.rating, v.created_at, v.updated_at,
                   v.approved_at, v.rejection_reason, v.info_request_note,
                   (SELECT COUNT(*) FROM vendor_documents WHERE vendor_id=v.id AND is_deleted=0) as doc_count
            FROM vendors v
            WHERE v.status=? AND v.is_deleted=0
            ORDER BY v.updated_at DESC
        """, (status,)).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()


@bp.get("/api/admin/vendors/<vid>")
@admin_required
def vendor_detail(vid):
    conn = get_db()
    try:
        vendor = conn.execute("SELECT * FROM vendors WHERE id=?", (vid,)).fetchone()
        if not vendor:
            return jsonify({"error": "Not found"}), 404

        cats = conn.execute(
            "SELECT category FROM vendor_categories WHERE vendor_id=?", (vid,)
        ).fetchall()
        products = conn.execute(
            "SELECT product_name, description FROM vendor_products WHERE vendor_id=?", (vid,)
        ).fetchall()
        docs = conn.execute(
            """SELECT id, doc_type, file_name, file_size_bytes, is_mandatory,
                      expiry_date, expiry_status, uploaded_at
               FROM vendor_documents WHERE vendor_id=? AND is_deleted=0""",
            (vid,)
        ).fetchall()

        data = dict(vendor)
        data["categories"] = [r["category"] for r in cats]
        data["products"]   = [dict(r) for r in products]
        data["documents"]  = [dict(r) for r in docs]
        return jsonify(data)
    finally:
        conn.close()


@bp.post("/api/admin/vendors/<vid>/approve")
@_procurement_required
def approve_vendor(vid):
    conn = get_db()
    try:
        vendor = conn.execute(
            "SELECT * FROM vendors WHERE id=? AND is_deleted=0", (vid,)
        ).fetchone()
        if not vendor:
            return jsonify({"error": "Not found"}), 404
        if vendor["status"] not in ("submitted", "under_review", "info_requested"):
            return jsonify({"error": f"Cannot approve a vendor with status '{vendor['status']}'"}), 400

        now = datetime.utcnow().isoformat()
        conn.execute("""
            UPDATE vendors SET status='approved', approved_by=?, approved_at=?,
              rejection_reason=NULL, info_request_note=NULL, updated_at=?
            WHERE id=?
        """, (g.user["id"], now, now, vid))

        # Activate vendor users
        conn.execute(
            "UPDATE users SET is_active=1 WHERE entity_type='vendor' AND entity_id=?", (vid,)
        )
        conn.commit()

        audit(g.user["id"], "vendor", vid, "Approved vendor registration",
              before={"status": vendor["status"]}, after={"status": "approved"})

        # Notify vendor users
        users = conn.execute(
            "SELECT id, mobile, email FROM users WHERE entity_type='vendor' AND entity_id=?", (vid,)
        ).fetchall()
        _notify_entity(conn, users, vid, "vendor",
                       "Registration Approved 🎉",
                       f"Your registration for {vendor['company_name']} has been approved. You can now access all portal features.",
                       "registration_approved", now)

        portal_url = request.host_url.rstrip("/") + "/vendor"
        for u in users:
            if u["email"]:
                subj, html = email_registration_approved(vendor["company_name"], portal_url)
                send_email(u["email"], subj, html)
            if u["mobile"]:
                send_sms(u["mobile"],
                    f"Congratulations! Your vendor registration with Amar Alum has been approved. Login at {portal_url}")

        return jsonify({"message": f"{vendor['company_name']} approved"})
    finally:
        conn.close()


@bp.post("/api/admin/vendors/<vid>/reject")
@_procurement_required
def reject_vendor(vid):
    d = request.get_json(silent=True) or {}
    reason = (d.get("reason") or "").strip()
    if not reason:
        return jsonify({"error": "Rejection reason is required"}), 400

    conn = get_db()
    try:
        vendor = conn.execute("SELECT * FROM vendors WHERE id=?", (vid,)).fetchone()
        if not vendor:
            return jsonify({"error": "Not found"}), 404

        now = datetime.utcnow().isoformat()
        conn.execute("""
            UPDATE vendors SET status='rejected', rejection_reason=?,
              info_request_note=NULL, updated_at=? WHERE id=?
        """, (reason, now, vid))
        conn.commit()

        audit(g.user["id"], "vendor", vid, "Rejected vendor registration",
              before={"status": vendor["status"]},
              after={"status": "rejected", "reason": reason})

        users = conn.execute(
            "SELECT id, mobile, email FROM users WHERE entity_type='vendor' AND entity_id=?", (vid,)
        ).fetchall()
        _notify_entity(conn, users, vid, "vendor",
                       "Registration Update",
                       f"Your registration for {vendor['company_name']} was not approved. Reason: {reason}",
                       "registration_rejected", now)

        for u in users:
            if u["email"]:
                subj, html = email_registration_rejected(vendor["company_name"], reason)
                send_email(u["email"], subj, html)
            if u["mobile"]:
                send_sms(u["mobile"],
                    f"Amar Alum: Your vendor registration could not be approved. Please check your email for details.")

        return jsonify({"message": "Vendor rejected"})
    finally:
        conn.close()


@bp.post("/api/admin/vendors/<vid>/request-info")
@_procurement_required
def request_vendor_info(vid):
    d = request.get_json(silent=True) or {}
    note = (d.get("note") or "").strip()
    if not note:
        return jsonify({"error": "Please provide a note explaining what information is needed"}), 400

    conn = get_db()
    try:
        vendor = conn.execute("SELECT * FROM vendors WHERE id=?", (vid,)).fetchone()
        if not vendor:
            return jsonify({"error": "Not found"}), 404

        now = datetime.utcnow().isoformat()
        conn.execute("""
            UPDATE vendors SET status='info_requested', info_request_note=?,
              rejection_reason=NULL, updated_at=? WHERE id=?
        """, (note, now, vid))
        conn.commit()

        audit(g.user["id"], "vendor", vid, "Requested additional information",
              after={"note": note})

        users = conn.execute(
            "SELECT id, mobile, email FROM users WHERE entity_type='vendor' AND entity_id=?", (vid,)
        ).fetchall()
        _notify_entity(conn, users, vid, "vendor",
                       "Additional Information Required",
                       f"Amar Alum requires additional information for your registration: {note}",
                       "info_requested", now)

        for u in users:
            if u["email"]:
                send_email(u["email"],
                    f"Action Required — {vendor['company_name']} Registration",
                    f"<p>Additional information is required for your registration:</p><blockquote>{note}</blockquote><p>Please log in to the portal and update your registration.</p>")
            if u["mobile"]:
                send_sms(u["mobile"],
                    f"Amar Alum: Action required for your vendor registration. Please check your email and update the portal.")

        return jsonify({"message": "Information request sent to vendor"})
    finally:
        conn.close()


# ── Transporter list / detail / actions ───────────────────────────────────────

@bp.get("/api/admin/transporters")
@admin_required
def list_transporters():
    status = request.args.get("status", "submitted")
    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT t.id, t.company_name, t.gstin, t.pan_number, t.company_type,
                   t.contact_name, t.contact_mobile, t.contact_email,
                   t.reg_addr_city, t.reg_addr_state, t.status,
                   t.rating, t.created_at, t.updated_at,
                   (SELECT COUNT(*) FROM vehicles WHERE transporter_id=t.id AND is_deleted=0) as vehicle_count,
                   (SELECT COUNT(*) FROM transporter_documents WHERE transporter_id=t.id AND is_deleted=0) as doc_count
            FROM transporters t
            WHERE t.status=? AND t.is_deleted=0
            ORDER BY t.updated_at DESC
        """, (status,)).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()


@bp.get("/api/admin/transporters/<tid>")
@admin_required
def transporter_detail(tid):
    conn = get_db()
    try:
        t = conn.execute("SELECT * FROM transporters WHERE id=?", (tid,)).fetchone()
        if not t:
            return jsonify({"error": "Not found"}), 404

        docs = conn.execute(
            """SELECT id, doc_type, file_name, is_mandatory, expiry_date, expiry_status, uploaded_at
               FROM transporter_documents WHERE transporter_id=? AND is_deleted=0""",
            (tid,)
        ).fetchall()
        vehicles = conn.execute(
            "SELECT * FROM vehicles WHERE transporter_id=? AND is_deleted=0", (tid,)
        ).fetchall()
        veh_list = []
        for v in vehicles:
            vdocs = conn.execute(
                "SELECT doc_type, file_name, expiry_date, expiry_status FROM vehicle_documents WHERE vehicle_id=? AND is_deleted=0",
                (v["id"],)
            ).fetchall()
            vd = dict(v)
            vd["documents"] = [dict(d) for d in vdocs]
            veh_list.append(vd)

        data = dict(t)
        data["documents"] = [dict(r) for r in docs]
        data["vehicles"]  = veh_list
        return jsonify(data)
    finally:
        conn.close()


@bp.post("/api/admin/transporters/<tid>/approve")
@_transport_required
def approve_transporter(tid):
    conn = get_db()
    try:
        t = conn.execute("SELECT * FROM transporters WHERE id=?", (tid,)).fetchone()
        if not t:
            return jsonify({"error": "Not found"}), 404
        if t["status"] not in ("submitted", "under_review", "info_requested"):
            return jsonify({"error": f"Cannot approve: status is '{t['status']}'"}), 400

        now = datetime.utcnow().isoformat()
        conn.execute("""
            UPDATE transporters SET status='approved', approved_by=?, approved_at=?,
              rejection_reason=NULL, info_request_note=NULL, updated_at=? WHERE id=?
        """, (g.user["id"], now, now, tid))
        conn.execute(
            "UPDATE users SET is_active=1 WHERE entity_type='transporter' AND entity_id=?", (tid,)
        )
        conn.commit()

        audit(g.user["id"], "transporter", tid, "Approved transporter registration",
              before={"status": t["status"]}, after={"status": "approved"})

        users = conn.execute(
            "SELECT id, mobile, email FROM users WHERE entity_type='transporter' AND entity_id=?", (tid,)
        ).fetchall()
        portal_url = request.host_url.rstrip("/") + "/transporter"
        _notify_entity(conn, users, tid, "transporter",
                       "Registration Approved 🎉",
                       f"Your registration for {t['company_name']} has been approved!",
                       "registration_approved", now)

        for u in users:
            if u["email"]:
                subj, html = email_registration_approved(t["company_name"], portal_url)
                send_email(u["email"], subj, html)
            if u["mobile"]:
                send_sms(u["mobile"],
                    f"Amar Alum: Your transporter registration is approved. Login: {portal_url}")

        return jsonify({"message": f"{t['company_name']} approved"})
    finally:
        conn.close()


@bp.post("/api/admin/transporters/<tid>/reject")
@_transport_required
def reject_transporter(tid):
    d = request.get_json(silent=True) or {}
    reason = (d.get("reason") or "").strip()
    if not reason:
        return jsonify({"error": "Rejection reason required"}), 400

    conn = get_db()
    try:
        t = conn.execute("SELECT * FROM transporters WHERE id=?", (tid,)).fetchone()
        if not t:
            return jsonify({"error": "Not found"}), 404

        now = datetime.utcnow().isoformat()
        conn.execute("""
            UPDATE transporters SET status='rejected', rejection_reason=?,
              info_request_note=NULL, updated_at=? WHERE id=?
        """, (reason, now, tid))
        conn.commit()

        audit(g.user["id"], "transporter", tid, "Rejected transporter registration",
              after={"reason": reason})

        users = conn.execute(
            "SELECT id, mobile, email FROM users WHERE entity_type='transporter' AND entity_id=?", (tid,)
        ).fetchall()
        _notify_entity(conn, users, tid, "transporter",
                       "Registration Update",
                       f"Your registration for {t['company_name']} was not approved. Reason: {reason}",
                       "registration_rejected", now)
        for u in users:
            if u["email"]:
                subj, html = email_registration_rejected(t["company_name"], reason)
                send_email(u["email"], subj, html)

        return jsonify({"message": "Transporter rejected"})
    finally:
        conn.close()


@bp.post("/api/admin/transporters/<tid>/request-info")
@_transport_required
def request_transporter_info(tid):
    d = request.get_json(silent=True) or {}
    note = (d.get("note") or "").strip()
    if not note:
        return jsonify({"error": "Note is required"}), 400

    conn = get_db()
    try:
        t = conn.execute("SELECT * FROM transporters WHERE id=?", (tid,)).fetchone()
        if not t:
            return jsonify({"error": "Not found"}), 404

        now = datetime.utcnow().isoformat()
        conn.execute("""
            UPDATE transporters SET status='info_requested', info_request_note=?,
              rejection_reason=NULL, updated_at=? WHERE id=?
        """, (note, now, tid))
        conn.commit()
        audit(g.user["id"], "transporter", tid, "Requested additional info")

        users = conn.execute(
            "SELECT id, mobile, email FROM users WHERE entity_type='transporter' AND entity_id=?", (tid,)
        ).fetchall()
        _notify_entity(conn, users, tid, "transporter",
                       "Additional Information Required",
                       f"Additional info required for your registration: {note}",
                       "info_requested", now)

        return jsonify({"message": "Information request sent"})
    finally:
        conn.close()


# ── Compliance dashboard ───────────────────────────────────────────────────────

@bp.get("/api/admin/compliance")
@admin_required
def compliance_dashboard():
    status_filter = request.args.get("status", "expired")
    conn = get_db()
    try:
        vendor_docs = conn.execute("""
            SELECT vd.id, vd.doc_type, vd.file_name, vd.expiry_date, vd.expiry_status,
                   v.company_name, v.id as entity_id, 'vendor' as entity_type
            FROM vendor_documents vd JOIN vendors v ON vd.vendor_id=v.id
            WHERE vd.expiry_status=? AND vd.is_deleted=0
            ORDER BY vd.expiry_date
        """, (status_filter,)).fetchall()

        trans_docs = conn.execute("""
            SELECT td.id, td.doc_type, td.file_name, td.expiry_date, td.expiry_status,
                   t.company_name, t.id as entity_id, 'transporter' as entity_type
            FROM transporter_documents td JOIN transporters t ON td.transporter_id=t.id
            WHERE td.expiry_status=? AND td.is_deleted=0
            ORDER BY td.expiry_date
        """, (status_filter,)).fetchall()

        veh_docs = conn.execute("""
            SELECT vd.id, vd.doc_type, vd.file_name, vd.expiry_date, vd.expiry_status,
                   v.reg_number as company_name, t.company_name as transporter_name,
                   v.id as entity_id, 'vehicle' as entity_type
            FROM vehicle_documents vd
            JOIN vehicles v ON vd.vehicle_id=v.id
            JOIN transporters t ON v.transporter_id=t.id
            WHERE vd.expiry_status=? AND vd.is_deleted=0
            ORDER BY vd.expiry_date
        """, (status_filter,)).fetchall()

        return jsonify({
            "vendor_documents":       [dict(r) for r in vendor_docs],
            "transporter_documents":  [dict(r) for r in trans_docs],
            "vehicle_documents":      [dict(r) for r in veh_docs],
        })
    finally:
        conn.close()


# ── Audit log ─────────────────────────────────────────────────────────────────

@bp.get("/api/admin/audit-log")
@admin_required
def audit_log():
    page     = max(1, int(request.args.get("page", 1)))
    per_page = 50
    offset   = (page - 1) * per_page
    entity_type = request.args.get("entity_type")
    actor_id    = request.args.get("actor_id")

    conn = get_db()
    try:
        where, params = [], []
        if entity_type:
            where.append("al.entity_type=?"); params.append(entity_type)
        if actor_id:
            where.append("al.actor_user_id=?"); params.append(actor_id)

        clause = ("WHERE " + " AND ".join(where)) if where else ""
        rows = conn.execute(f"""
            SELECT al.*, u.mobile, u.email, u.role
            FROM audit_logs al
            JOIN users u ON al.actor_user_id=u.id
            {clause}
            ORDER BY al.created_at DESC
            LIMIT ? OFFSET ?
        """, params + [per_page, offset]).fetchall()

        total = conn.execute(
            f"SELECT COUNT(*) as n FROM audit_logs al {clause}", params
        ).fetchone()["n"]

        return jsonify({
            "logs":     [dict(r) for r in rows],
            "total":    total,
            "page":     page,
            "per_page": per_page,
        })
    finally:
        conn.close()


# ── Admin user management ─────────────────────────────────────────────────────

@bp.get("/api/admin/users")
@roles_required("super_admin")
def list_admin_users():
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT id, mobile, email, role, is_active, last_login_at, created_at FROM users WHERE entity_type='admin' ORDER BY created_at"
        ).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()


@bp.post("/api/admin/users")
@roles_required("super_admin")
def create_admin_user():
    d = request.get_json(silent=True) or {}
    mobile = (d.get("mobile") or "").strip()
    email  = (d.get("email") or "").strip() or None
    role   = (d.get("role") or "").strip()

    valid_roles = ("super_admin","procurement_admin","transport_admin","finance_admin")
    if not mobile:
        return jsonify({"error": "Mobile required"}), 400
    if role not in valid_roles:
        return jsonify({"error": f"Role must be one of: {', '.join(valid_roles)}"}), 400

    conn = get_db()
    try:
        if conn.execute("SELECT id FROM users WHERE mobile=?", (mobile,)).fetchone():
            return jsonify({"error": "Mobile already registered"}), 409

        now = datetime.utcnow().isoformat()
        uid = new_id()
        conn.execute("""
            INSERT INTO users(id,mobile,email,role,entity_type,is_active,created_at,updated_at)
            VALUES(?,?,?,?,'admin',1,?,?)
        """, (uid, mobile, email, role, now, now))
        conn.commit()
        audit(g.user["id"], "user", uid, f"Created admin user with role {role}")
        return jsonify({"message": "Admin user created", "user_id": uid}), 201
    finally:
        conn.close()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _notify_entity(conn, users, entity_id, entity_type, title, body, event_type, now):
    for u in users:
        conn.execute("""
            INSERT INTO notifications(id,user_id,title,body,channel,event_type,
              entity_type,entity_id,is_read,created_at)
            VALUES(?,?,?,?,'in_app',?,?,?,0,?)
        """, (new_id(), u["id"], title, body, event_type, entity_type, entity_id, now))
    conn.commit()
