"""
Transporter Registration API — similar to vendor but different docs + fleet.
"""
import os
import re
import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify, g, current_app
from werkzeug.utils import secure_filename

from database import get_db
from auth import vendor_required, transporter_required, audit, new_id

bp = Blueprint("transporter_reg", __name__)

ALLOWED_EXTENSIONS = {"pdf", "jpg", "jpeg", "png"}
MAX_FILE_BYTES = 5 * 1024 * 1024

MANDATORY_DOCS = ["transport_license", "pan_card", "gst_certificate", "bank_cheque"]
OPTIONAL_DOCS  = ["other"]
ALL_DOC_TYPES  = MANDATORY_DOCS + OPTIONAL_DOCS

VEHICLE_TYPES = ("Open", "Closed", "Tanker", "Trailer", "LCV", "HCV")

VEHICLE_DOC_TYPES = ("rc_book", "insurance", "fitness", "pollution", "other")
MANDATORY_VEHICLE_DOCS = ("rc_book", "insurance", "fitness", "pollution")


def _allowed(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def _upload_dir(tid):
    base = os.path.join(current_app.root_path, "uploads", "transporter_docs", tid)
    os.makedirs(base, exist_ok=True)
    return base


def _vehicle_upload_dir(vid):
    base = os.path.join(current_app.root_path, "uploads", "vehicle_docs", vid)
    os.makedirs(base, exist_ok=True)
    return base


def _validate_gstin(v):
    return bool(re.match(r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$', (v or "").upper()))


def _validate_pan(v):
    return bool(re.match(r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$', (v or "").upper()))


def _validate_ifsc(v):
    return bool(re.match(r'^[A-Z]{4}0[A-Z0-9]{6}$', (v or "").upper()))


# ── GET profile ───────────────────────────────────────────────────────────────

@bp.get("/api/transporter/profile")
@transporter_required
def get_transporter_profile():
    tid = g.user["entity_id"]
    conn = get_db()
    try:
        t = conn.execute("SELECT * FROM transporters WHERE id=?", (tid,)).fetchone()
        if not t:
            return jsonify({"error": "Transporter not found"}), 404

        docs = conn.execute(
            """SELECT id, doc_type, file_name, file_size_bytes, is_mandatory,
                      expiry_date, expiry_status, uploaded_at
               FROM transporter_documents WHERE transporter_id=? AND is_deleted=0""",
            (tid,)
        ).fetchall()

        vehicles = conn.execute(
            "SELECT * FROM vehicles WHERE transporter_id=? AND is_deleted=0", (tid,)
        ).fetchall()

        vehicle_list = []
        for v in vehicles:
            vdocs = conn.execute(
                "SELECT id, doc_type, file_name, expiry_date, expiry_status FROM vehicle_documents WHERE vehicle_id=? AND is_deleted=0",
                (v["id"],)
            ).fetchall()
            vd = dict(v)
            vd["documents"] = [dict(d) for d in vdocs]
            vehicle_list.append(vd)

        data = dict(t)
        data["documents"] = [dict(r) for r in docs]
        data["vehicles"]  = vehicle_list
        data["mandatory_docs_uploaded"] = {
            d: any(doc["doc_type"] == d for doc in data["documents"])
            for d in MANDATORY_DOCS
        }
        return jsonify(data)
    finally:
        conn.close()


# ── Step 1 — Company Info ─────────────────────────────────────────────────────

@bp.post("/api/transporter/step/1")
@transporter_required
def transporter_step1():
    tid = g.user["entity_id"]
    d = request.get_json(silent=True) or {}
    errors = {}

    company_name = (d.get("company_name") or "").strip()
    gstin        = (d.get("gstin") or "").strip().upper()
    pan_number   = (d.get("pan_number") or "").strip().upper()
    company_type = (d.get("company_type") or "").strip()

    if not company_name:
        errors["company_name"] = "Company name is required"
    if not gstin or not _validate_gstin(gstin):
        errors["gstin"] = "Enter a valid 15-character GSTIN"
    if not pan_number or not _validate_pan(pan_number):
        errors["pan_number"] = "Enter a valid 10-character PAN"
    if company_type not in ("Proprietorship","Partnership","Pvt Ltd","Ltd","LLP","Other"):
        errors["company_type"] = "Select a valid company type"
    if not (d.get("contact_name") or "").strip():
        errors["contact_name"] = "Contact name is required"
    if not (d.get("contact_mobile") or "").strip():
        errors["contact_mobile"] = "Contact mobile is required"
    if not (d.get("reg_addr_city") or "").strip():
        errors["reg_addr_city"] = "City is required"
    if not (d.get("reg_addr_state") or "").strip():
        errors["reg_addr_state"] = "State is required"

    if errors:
        return jsonify({"errors": errors}), 422

    conn = get_db()
    try:
        dup_g = conn.execute(
            "SELECT id FROM transporters WHERE gstin=? AND id!=?", (gstin, tid)
        ).fetchone()
        if dup_g:
            return jsonify({"errors": {"gstin": "This GSTIN is already registered"}}), 422

        dup_p = conn.execute(
            "SELECT id FROM transporters WHERE pan_number=? AND id!=?", (pan_number, tid)
        ).fetchone()
        if dup_p:
            return jsonify({"errors": {"pan_number": "This PAN is already registered"}}), 422

        now = datetime.utcnow().isoformat()
        conn.execute("""
            UPDATE transporters SET
              company_name=?, gstin=?, pan_number=?, company_type=?,
              msme_registered=?, msme_reg_number=?,
              year_established=?, num_employees=?, annual_turnover_range=?,
              reg_addr_line1=?, reg_addr_line2=?, reg_addr_city=?,
              reg_addr_state=?, reg_addr_pin=?, reg_addr_country=?,
              contact_name=?, contact_designation=?, contact_mobile=?, contact_email=?,
              registration_step=CASE WHEN registration_step<2 THEN 2 ELSE registration_step END,
              updated_at=?
            WHERE id=?
        """, (
            company_name, gstin, pan_number, company_type,
            1 if d.get("msme_registered") else 0, d.get("msme_reg_number") or None,
            d.get("year_established") or None, d.get("num_employees") or None,
            d.get("annual_turnover_range") or None,
            d.get("reg_addr_line1") or None, d.get("reg_addr_line2") or None,
            d.get("reg_addr_city"), d.get("reg_addr_state"),
            d.get("reg_addr_pin") or None, d.get("reg_addr_country") or "India",
            d.get("contact_name"), d.get("contact_designation") or None,
            d.get("contact_mobile"), d.get("contact_email") or None,
            now, tid
        ))
        conn.commit()
        audit(g.user["id"], "transporter", tid, "Saved registration step 1")
        return jsonify({"message": "Step 1 saved", "next_step": 2})
    finally:
        conn.close()


# ── Step 2 — Document Upload ──────────────────────────────────────────────────

@bp.post("/api/transporter/step/2/upload")
@transporter_required
def transporter_upload_doc():
    tid = g.user["entity_id"]
    doc_type = (request.form.get("doc_type") or "").strip()

    if doc_type not in ALL_DOC_TYPES:
        return jsonify({"error": "Invalid document type"}), 400
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    f = request.files["file"]
    if not f.filename or not _allowed(f.filename):
        return jsonify({"error": "Only PDF, JPG, PNG files are allowed"}), 400

    f.seek(0, 2); size = f.tell(); f.seek(0)
    if size > MAX_FILE_BYTES:
        return jsonify({"error": "File exceeds 5 MB limit"}), 400

    safe_name   = secure_filename(f.filename)
    ext         = safe_name.rsplit(".", 1)[-1].lower()
    stored_name = f"{doc_type}_{uuid.uuid4().hex[:8]}.{ext}"
    upload_dir  = _upload_dir(tid)
    f.save(os.path.join(upload_dir, stored_name))
    rel_path    = os.path.join("uploads", "transporter_docs", tid, stored_name)
    expiry_date = (request.form.get("expiry_date") or "").strip() or None

    conn = get_db()
    try:
        now = datetime.utcnow().isoformat()
        conn.execute(
            "UPDATE transporter_documents SET is_deleted=1 WHERE transporter_id=? AND doc_type=? AND is_deleted=0",
            (tid, doc_type)
        )
        doc_id = new_id()
        conn.execute("""
            INSERT INTO transporter_documents
              (id,transporter_id,doc_type,file_path,file_name,file_size_bytes,
               is_mandatory,expiry_date,expiry_status,uploaded_at,is_deleted)
            VALUES(?,?,?,?,?,?,?,?,'ok',?,0)
        """, (doc_id, tid, doc_type, rel_path, safe_name, size,
              1 if doc_type in MANDATORY_DOCS else 0, expiry_date, now))

        conn.execute("""
            UPDATE transporters SET
              registration_step=CASE WHEN registration_step<3 THEN 3 ELSE registration_step END,
              updated_at=? WHERE id=?
        """, (now, tid))
        conn.commit()
        return jsonify({"message": "Document uploaded", "doc_id": doc_id,
                        "doc_type": doc_type, "file_name": safe_name})
    finally:
        conn.close()


@bp.delete("/api/transporter/document/<doc_id>")
@transporter_required
def transporter_delete_doc(doc_id):
    tid = g.user["entity_id"]
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT * FROM transporter_documents WHERE id=? AND transporter_id=? AND is_deleted=0",
            (doc_id, tid)
        ).fetchone()
        if not row:
            return jsonify({"error": "Not found"}), 404
        conn.execute("UPDATE transporter_documents SET is_deleted=1 WHERE id=?", (doc_id,))
        conn.commit()
        return jsonify({"ok": True})
    finally:
        conn.close()


@bp.post("/api/transporter/step/2/complete")
@transporter_required
def transporter_step2_complete():
    tid = g.user["entity_id"]
    conn = get_db()
    try:
        uploaded = {
            r["doc_type"] for r in conn.execute(
                "SELECT doc_type FROM transporter_documents WHERE transporter_id=? AND is_deleted=0", (tid,)
            ).fetchall()
        }
        missing = [d for d in MANDATORY_DOCS if d not in uploaded]
        if missing:
            labels = {
                "transport_license": "Transport License",
                "pan_card": "PAN Card",
                "gst_certificate": "GST Certificate",
                "bank_cheque": "Bank Cancelled Cheque",
            }
            return jsonify({
                "errors": {"documents": f"Missing: {', '.join(labels.get(m,m) for m in missing)}"}
            }), 422

        now = datetime.utcnow().isoformat()
        conn.execute("""
            UPDATE transporters SET
              registration_step=CASE WHEN registration_step<3 THEN 3 ELSE registration_step END,
              updated_at=? WHERE id=?
        """, (now, tid))
        conn.commit()
        return jsonify({"message": "Step 2 complete", "next_step": 3})
    finally:
        conn.close()


# ── Step 3 — Banking Details ──────────────────────────────────────────────────

@bp.post("/api/transporter/step/3")
@transporter_required
def transporter_step3():
    tid = g.user["entity_id"]
    d = request.get_json(silent=True) or {}
    errors = {}

    holder  = (d.get("bank_account_holder") or "").strip()
    acc_no  = (d.get("bank_account_number") or "").strip()
    ifsc    = (d.get("bank_ifsc") or "").strip().upper()
    acc_type= (d.get("bank_account_type") or "").strip()

    if not holder:  errors["bank_account_holder"] = "Required"
    if not acc_no:  errors["bank_account_number"] = "Required"
    if not ifsc or not _validate_ifsc(ifsc):
        errors["bank_ifsc"] = "Enter a valid 11-character IFSC code"
    if acc_type not in ("Current", "Savings"):
        errors["bank_account_type"] = "Select Current or Savings"

    if errors:
        return jsonify({"errors": errors}), 422

    conn = get_db()
    try:
        now = datetime.utcnow().isoformat()
        conn.execute("""
            UPDATE transporters SET
              bank_account_holder=?, bank_account_number=?, bank_ifsc=?,
              bank_name=?, bank_account_type=?,
              registration_step=CASE WHEN registration_step<4 THEN 4 ELSE registration_step END,
              updated_at=? WHERE id=?
        """, (holder, acc_no, ifsc, d.get("bank_name") or None, acc_type, now, tid))
        conn.commit()
        audit(g.user["id"], "transporter", tid, "Saved registration step 3 (Banking)")
        return jsonify({"message": "Step 3 saved", "next_step": 4})
    finally:
        conn.close()


# ── Step 4 — Submit ───────────────────────────────────────────────────────────

@bp.post("/api/transporter/submit")
@transporter_required
def transporter_submit():
    tid = g.user["entity_id"]
    conn = get_db()
    try:
        t = conn.execute("SELECT * FROM transporters WHERE id=?", (tid,)).fetchone()
        if not t:
            return jsonify({"error": "Not found"}), 404
        if t["status"] == "submitted":
            return jsonify({"message": "Already submitted"}), 200

        errors = {}
        if not t["company_name"]: errors["step1"] = "Complete company information"
        if not t["bank_ifsc"]:    errors["step3"] = "Complete banking details"

        uploaded = {r["doc_type"] for r in conn.execute(
            "SELECT doc_type FROM transporter_documents WHERE transporter_id=? AND is_deleted=0", (tid,)
        ).fetchall()}
        missing = [d for d in MANDATORY_DOCS if d not in uploaded]
        if missing:
            errors["step2"] = "Upload all mandatory documents"

        if errors:
            return jsonify({"errors": errors}), 422

        now = datetime.utcnow().isoformat()
        conn.execute(
            "UPDATE transporters SET status='submitted', registration_step=4, updated_at=? WHERE id=?",
            (now, tid)
        )
        conn.commit()
        audit(g.user["id"], "transporter", tid, "Submitted registration",
              after={"status": "submitted"})

        admins = conn.execute(
            "SELECT id, email FROM users WHERE entity_type='admin' AND is_active=1"
        ).fetchall()
        for adm in admins:
            conn.execute("""
                INSERT INTO notifications(id,user_id,title,body,channel,event_type,
                  entity_type,entity_id,is_read,created_at)
                VALUES(?,?,?,?,'in_app','registration_submitted','transporter',?,0,?)
            """, (new_id(), adm["id"],
                  f"New Transporter Registration — {t['company_name']}",
                  f"{t['company_name']} has submitted their transporter registration.",
                  tid, now))
        conn.commit()
        return jsonify({"message": "Registration submitted. We'll review within 2-3 business days."})
    finally:
        conn.close()


@bp.post("/api/transporter/resubmit")
@transporter_required
def transporter_resubmit():
    tid = g.user["entity_id"]
    conn = get_db()
    try:
        t = conn.execute("SELECT status FROM transporters WHERE id=?", (tid,)).fetchone()
        if not t or t["status"] != "info_requested":
            return jsonify({"error": "Resubmission only allowed when info is requested"}), 400
        now = datetime.utcnow().isoformat()
        conn.execute(
            "UPDATE transporters SET status='submitted', info_request_note=NULL, updated_at=? WHERE id=?",
            (now, tid)
        )
        conn.commit()
        return jsonify({"message": "Resubmitted for review"})
    finally:
        conn.close()


# ── Vehicle Management (after approval) ───────────────────────────────────────

@bp.post("/api/transporter/vehicles")
@transporter_required
def add_vehicle():
    tid = g.user["entity_id"]
    conn = get_db()
    try:
        t = conn.execute("SELECT status FROM transporters WHERE id=?", (tid,)).fetchone()
        if not t or t["status"] != "approved":
            return jsonify({"error": "Vehicle registration requires an approved account"}), 403

        d = request.get_json(silent=True) or {}
        errors = {}

        reg_no = (d.get("reg_number") or "").strip().upper()
        vtype  = (d.get("vehicle_type") or "").strip()

        if not reg_no:
            errors["reg_number"] = "Registration number is required"
        elif conn.execute("SELECT id FROM vehicles WHERE reg_number=?", (reg_no,)).fetchone():
            errors["reg_number"] = "This vehicle is already registered"

        if vtype not in VEHICLE_TYPES:
            errors["vehicle_type"] = "Select a valid vehicle type"

        if errors:
            return jsonify({"errors": errors}), 422

        now = datetime.utcnow().isoformat()
        vid = new_id()
        conn.execute("""
            INSERT INTO vehicles(id,transporter_id,reg_number,vehicle_type,
              capacity_tons,year_of_manufacture,status,
              driver_name,driver_license_number,driver_license_expiry,
              is_deleted,created_at,updated_at)
            VALUES(?,?,?,?,?,?,'available',?,?,?,0,?,?)
        """, (vid, tid, reg_no, vtype,
              d.get("capacity_tons") or None, d.get("year_of_manufacture") or None,
              d.get("driver_name") or None, d.get("driver_license_number") or None,
              d.get("driver_license_expiry") or None,
              now, now))
        conn.commit()
        audit(g.user["id"], "vehicle", vid, f"Added vehicle {reg_no}")
        return jsonify({"message": "Vehicle added", "vehicle_id": vid}), 201
    finally:
        conn.close()


@bp.post("/api/transporter/vehicles/<vid>/documents")
@transporter_required
def upload_vehicle_doc(vid):
    tid = g.user["entity_id"]
    conn = get_db()
    try:
        v = conn.execute(
            "SELECT * FROM vehicles WHERE id=? AND transporter_id=? AND is_deleted=0",
            (vid, tid)
        ).fetchone()
        if not v:
            return jsonify({"error": "Vehicle not found"}), 404

        doc_type = (request.form.get("doc_type") or "").strip()
        if doc_type not in VEHICLE_DOC_TYPES:
            return jsonify({"error": "Invalid document type"}), 400

        if "file" not in request.files:
            return jsonify({"error": "No file provided"}), 400

        f = request.files["file"]
        if not f.filename or not _allowed(f.filename):
            return jsonify({"error": "Only PDF, JPG, PNG allowed"}), 400

        f.seek(0, 2); size = f.tell(); f.seek(0)
        if size > MAX_FILE_BYTES:
            return jsonify({"error": "File exceeds 5 MB"}), 400

        safe_name   = secure_filename(f.filename)
        ext         = safe_name.rsplit(".", 1)[-1].lower()
        stored_name = f"{doc_type}_{uuid.uuid4().hex[:8]}.{ext}"
        upload_dir  = _vehicle_upload_dir(vid)
        f.save(os.path.join(upload_dir, stored_name))
        rel_path    = os.path.join("uploads", "vehicle_docs", vid, stored_name)
        expiry_date = (request.form.get("expiry_date") or "").strip() or None

        now = datetime.utcnow().isoformat()
        conn.execute(
            "UPDATE vehicle_documents SET is_deleted=1 WHERE vehicle_id=? AND doc_type=? AND is_deleted=0",
            (vid, doc_type)
        )
        doc_id = new_id()
        conn.execute("""
            INSERT INTO vehicle_documents
              (id,vehicle_id,doc_type,file_path,file_name,file_size_bytes,
               expiry_date,expiry_status,uploaded_at,is_deleted)
            VALUES(?,?,?,?,?,?,?,'ok',?,0)
        """, (doc_id, vid, doc_type, rel_path, safe_name, size, expiry_date, now))
        conn.commit()
        return jsonify({"message": "Vehicle document uploaded", "doc_id": doc_id})
    finally:
        conn.close()


@bp.get("/api/transporter/vehicles")
@transporter_required
def list_vehicles():
    tid = g.user["entity_id"]
    conn = get_db()
    try:
        vehicles = conn.execute(
            "SELECT * FROM vehicles WHERE transporter_id=? AND is_deleted=0 ORDER BY created_at DESC",
            (tid,)
        ).fetchall()
        result = []
        for v in vehicles:
            docs = conn.execute(
                "SELECT id, doc_type, file_name, expiry_date, expiry_status FROM vehicle_documents WHERE vehicle_id=? AND is_deleted=0",
                (v["id"],)
            ).fetchall()
            vd = dict(v)
            vd["documents"] = [dict(d) for d in docs]
            result.append(vd)
        return jsonify(result)
    finally:
        conn.close()


# ── Transporter Documents list ────────────────────────────────────────────────

@bp.get("/api/transporter/documents")
@transporter_required
def transporter_documents():
    tid = g.user["entity_id"]
    conn = get_db()
    try:
        docs = conn.execute(
            """SELECT id, doc_type, file_name, file_size_bytes,
                      expiry_date, expiry_status, uploaded_at
               FROM transporter_documents WHERE transporter_id=? AND is_deleted=0
               ORDER BY uploaded_at DESC""",
            (tid,)
        ).fetchall()
        vehicle_rows = conn.execute(
            """SELECT vhd.id, vhd.doc_type, vhd.file_name, vhd.file_size_bytes,
                      vhd.expiry_date, vhd.expiry_status, vhd.uploaded_at,
                      vh.reg_number
               FROM vehicle_documents vhd
               JOIN vehicles vh ON vh.id = vhd.vehicle_id
               WHERE vh.transporter_id=? AND vhd.is_deleted=0
               ORDER BY vh.reg_number, vhd.uploaded_at DESC""",
            (tid,)
        ).fetchall()
        return jsonify({
            "company_docs": [dict(r) for r in docs],
            "vehicle_docs": [dict(r) for r in vehicle_rows],
        })
    finally:
        conn.close()
