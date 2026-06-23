"""
Vendor Registration — multi-step wizard API.
Steps: 1=Company Info, 2=Products/Categories, 3=Documents, 4=Banking, 5=Review/Submit
"""
import os
import re
import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify, g, current_app
from werkzeug.utils import secure_filename

from database import get_db
from auth import login_required, vendor_required, audit, new_id

bp = Blueprint("vendor_reg", __name__)

ALLOWED_EXTENSIONS = {"pdf", "jpg", "jpeg", "png"}
MAX_FILE_BYTES = 5 * 1024 * 1024  # 5 MB

MANDATORY_DOCS = [
    "gst_certificate",
    "pan_card",
    "incorporation_certificate",
    "bank_cheque",
]
OPTIONAL_DOCS = ["msme_certificate", "iso_certification", "other"]
ALL_DOC_TYPES = MANDATORY_DOCS + OPTIONAL_DOCS

INDIAN_STATES = [
    "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa",
    "Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala",
    "Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland",
    "Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura",
    "Uttar Pradesh","Uttarakhand","West Bengal","Delhi","Jammu and Kashmir",
    "Ladakh","Puducherry","Chandigarh","Dadra and Nagar Haveli and Daman and Diu",
    "Lakshadweep","Andaman and Nicobar Islands",
]


def _allowed(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def _upload_dir(vendor_id):
    base = os.path.join(current_app.root_path, "uploads", "vendor_docs", vendor_id)
    os.makedirs(base, exist_ok=True)
    return base


def _validate_gstin(v):
    return bool(re.match(r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$', (v or "").upper()))


def _validate_pan(v):
    return bool(re.match(r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$', (v or "").upper()))


def _validate_ifsc(v):
    return bool(re.match(r'^[A-Z]{4}0[A-Z0-9]{6}$', (v or "").upper()))


def _completion_pct(vendor):
    """Calculate wizard completion percentage."""
    score = 0
    checks = [
        vendor["company_name"], vendor["gstin"], vendor["pan_number"],
        vendor["company_type"], vendor["contact_name"], vendor["contact_mobile"],
        vendor["reg_addr_city"], vendor["reg_addr_state"],
    ]
    score += sum(1 for c in checks if c) * 5   # step 1 = up to 40%
    # step 2 — categories checked separately
    # step 3 — docs checked separately
    score += 20 if vendor["bank_account_number"] and vendor["bank_ifsc"] else 0
    return min(score, 100)


# ── GET profile ───────────────────────────────────────────────────────────────

@bp.get("/api/vendor/profile")
@vendor_required
def get_vendor_profile():
    vid = g.user["entity_id"]
    conn = get_db()
    try:
        vendor = conn.execute("SELECT * FROM vendors WHERE id=?", (vid,)).fetchone()
        if not vendor:
            return jsonify({"error": "Vendor not found"}), 404

        cats = conn.execute(
            "SELECT category FROM vendor_categories WHERE vendor_id=?", (vid,)
        ).fetchall()
        products = conn.execute(
            "SELECT id, product_name, description FROM vendor_products WHERE vendor_id=?", (vid,)
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
        data["completion_pct"] = _completion_pct(vendor)
        data["mandatory_docs_uploaded"] = {
            d: any(doc["doc_type"] == d for doc in data["documents"])
            for d in MANDATORY_DOCS
        }
        return jsonify(data)
    finally:
        conn.close()


# ── Step 1 — Company Info ─────────────────────────────────────────────────────

@bp.post("/api/vendor/step/1")
@vendor_required
def vendor_step1():
    vid = g.user["entity_id"]
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
        errors["pan_number"] = "Enter a valid 10-character PAN (e.g. AAAAA0000A)"
    if company_type not in ("Proprietorship","Partnership","Pvt Ltd","Ltd","LLP","Other"):
        errors["company_type"] = "Select a valid company type"
    if not (d.get("contact_name") or "").strip():
        errors["contact_name"] = "Primary contact name is required"
    if not (d.get("contact_mobile") or "").strip():
        errors["contact_mobile"] = "Contact mobile is required"
    if not (d.get("reg_addr_city") or "").strip():
        errors["reg_addr_city"] = "City is required"
    if not (d.get("reg_addr_state") or "").strip():
        errors["reg_addr_state"] = "State is required"
    if not (d.get("reg_addr_pin") or "").strip():
        errors["reg_addr_pin"] = "PIN code is required"

    if errors:
        return jsonify({"errors": errors}), 422

    conn = get_db()
    try:
        # Check GSTIN/PAN uniqueness (exclude self)
        dup_g = conn.execute(
            "SELECT id FROM vendors WHERE gstin=? AND id!=?", (gstin, vid)
        ).fetchone()
        if dup_g:
            return jsonify({"errors": {"gstin": "This GSTIN is already registered"}}), 422

        dup_p = conn.execute(
            "SELECT id FROM vendors WHERE pan_number=? AND id!=?", (pan_number, vid)
        ).fetchone()
        if dup_p:
            return jsonify({"errors": {"pan_number": "This PAN is already registered"}}), 422

        now = datetime.utcnow().isoformat()
        msme = 1 if d.get("msme_registered") else 0

        conn.execute("""
            UPDATE vendors SET
              company_name=?, gstin=?, pan_number=?, company_type=?,
              msme_registered=?, msme_reg_number=?,
              year_established=?, num_employees=?, annual_turnover_range=?,
              reg_addr_line1=?, reg_addr_line2=?, reg_addr_city=?,
              reg_addr_state=?, reg_addr_pin=?, reg_addr_country=?,
              factory_addr_line1=?, factory_addr_line2=?, factory_addr_city=?,
              factory_addr_state=?, factory_addr_pin=?,
              contact_name=?, contact_designation=?, contact_mobile=?, contact_email=?,
              registration_step=CASE WHEN registration_step<2 THEN 2 ELSE registration_step END,
              updated_at=?
            WHERE id=?
        """, (
            company_name, gstin, pan_number, company_type,
            msme, d.get("msme_reg_number") or None,
            d.get("year_established") or None, d.get("num_employees") or None,
            d.get("annual_turnover_range") or None,
            d.get("reg_addr_line1") or None, d.get("reg_addr_line2") or None,
            d.get("reg_addr_city"), d.get("reg_addr_state"), d.get("reg_addr_pin"),
            d.get("reg_addr_country") or "India",
            d.get("factory_addr_line1") or None, d.get("factory_addr_line2") or None,
            d.get("factory_addr_city") or None, d.get("factory_addr_state") or None,
            d.get("factory_addr_pin") or None,
            d.get("contact_name"), d.get("contact_designation") or None,
            d.get("contact_mobile"), d.get("contact_email") or None,
            now, vid
        ))
        conn.commit()
        audit(g.user["id"], "vendor", vid, "Saved registration step 1 (Company Info)")
        return jsonify({"message": "Step 1 saved", "next_step": 2})
    finally:
        conn.close()


# ── Step 2 — Products & Categories ───────────────────────────────────────────

@bp.post("/api/vendor/step/2")
@vendor_required
def vendor_step2():
    vid = g.user["entity_id"]
    d = request.get_json(silent=True) or {}

    valid_cats = {"Chemicals","Raw Materials","Packaging","Lubricants","Spare Parts","Services","Other"}
    categories = [c for c in (d.get("categories") or []) if c in valid_cats]
    products   = d.get("products") or []

    if not categories:
        return jsonify({"errors": {"categories": "Select at least one product category"}}), 422

    conn = get_db()
    try:
        now = datetime.utcnow().isoformat()
        conn.execute("DELETE FROM vendor_categories WHERE vendor_id=?", (vid,))
        for cat in categories:
            conn.execute(
                "INSERT INTO vendor_categories(id,vendor_id,category) VALUES(?,?,?)",
                (new_id(), vid, cat)
            )

        conn.execute("DELETE FROM vendor_products WHERE vendor_id=?", (vid,))
        for p in products[:50]:
            name = (p.get("product_name") or "").strip()
            if name:
                conn.execute(
                    "INSERT INTO vendor_products(id,vendor_id,product_name,description) VALUES(?,?,?,?)",
                    (new_id(), vid, name, (p.get("description") or "").strip() or None)
                )

        conn.execute("""
            UPDATE vendors SET
              registration_step=CASE WHEN registration_step<3 THEN 3 ELSE registration_step END,
              updated_at=? WHERE id=?
        """, (now, vid))
        conn.commit()
        audit(g.user["id"], "vendor", vid, "Saved registration step 2 (Categories)")
        return jsonify({"message": "Step 2 saved", "next_step": 3})
    finally:
        conn.close()


# ── Step 3 — Document Upload ──────────────────────────────────────────────────

@bp.post("/api/vendor/step/3/upload")
@vendor_required
def vendor_upload_doc():
    vid = g.user["entity_id"]
    doc_type = (request.form.get("doc_type") or "").strip()

    if doc_type not in ALL_DOC_TYPES:
        return jsonify({"error": "Invalid document type"}), 400

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    f = request.files["file"]
    if not f.filename or not _allowed(f.filename):
        return jsonify({"error": "Only PDF, JPG, PNG files are allowed"}), 400

    f.seek(0, 2)
    size = f.tell()
    f.seek(0)
    if size > MAX_FILE_BYTES:
        return jsonify({"error": "File exceeds 5 MB limit"}), 400

    safe_name = secure_filename(f.filename)
    ext        = safe_name.rsplit(".", 1)[-1].lower()
    stored_name = f"{doc_type}_{uuid.uuid4().hex[:8]}.{ext}"
    upload_dir  = _upload_dir(vid)
    stored_path = os.path.join(upload_dir, stored_name)
    f.save(stored_path)

    relative_path = os.path.join("uploads", "vendor_docs", vid, stored_name)
    expiry_date   = (request.form.get("expiry_date") or "").strip() or None

    conn = get_db()
    try:
        now = datetime.utcnow().isoformat()
        # Remove previous upload of same type
        old = conn.execute(
            "SELECT file_path FROM vendor_documents WHERE vendor_id=? AND doc_type=? AND is_deleted=0",
            (vid, doc_type)
        ).fetchone()
        if old:
            conn.execute(
                "UPDATE vendor_documents SET is_deleted=1 WHERE vendor_id=? AND doc_type=? AND is_deleted=0",
                (vid, doc_type)
            )
            try:
                old_full = os.path.join(current_app.root_path, old["file_path"])
                if os.path.exists(old_full):
                    os.remove(old_full)
            except Exception:
                pass

        doc_id = new_id()
        is_mandatory = 1 if doc_type in MANDATORY_DOCS else 0
        conn.execute("""
            INSERT INTO vendor_documents
              (id,vendor_id,doc_type,file_path,file_name,file_size_bytes,
               is_mandatory,expiry_date,expiry_status,uploaded_at,is_deleted)
            VALUES(?,?,?,?,?,?,?,?,'ok',?,0)
        """, (doc_id, vid, doc_type, relative_path, safe_name, size,
              is_mandatory, expiry_date, now))

        # Advance step
        conn.execute("""
            UPDATE vendors SET
              registration_step=CASE WHEN registration_step<4 THEN 4 ELSE registration_step END,
              updated_at=? WHERE id=?
        """, (now, vid))
        conn.commit()
        return jsonify({
            "message": "Document uploaded",
            "doc_id": doc_id,
            "doc_type": doc_type,
            "file_name": safe_name,
            "file_size_bytes": size,
        })
    finally:
        conn.close()


@bp.delete("/api/vendor/document/<doc_id>")
@vendor_required
def vendor_delete_doc(doc_id):
    vid = g.user["entity_id"]
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT * FROM vendor_documents WHERE id=? AND vendor_id=? AND is_deleted=0",
            (doc_id, vid)
        ).fetchone()
        if not row:
            return jsonify({"error": "Document not found"}), 404

        conn.execute("UPDATE vendor_documents SET is_deleted=1 WHERE id=?", (doc_id,))
        conn.commit()
        try:
            full = os.path.join(current_app.root_path, row["file_path"])
            if os.path.exists(full):
                os.remove(full)
        except Exception:
            pass
        return jsonify({"message": "Document removed"})
    finally:
        conn.close()


@bp.post("/api/vendor/step/3/complete")
@vendor_required
def vendor_step3_complete():
    """Mark step 3 as done after checking mandatory docs."""
    vid = g.user["entity_id"]
    conn = get_db()
    try:
        uploaded = {
            r["doc_type"] for r in conn.execute(
                "SELECT doc_type FROM vendor_documents WHERE vendor_id=? AND is_deleted=0", (vid,)
            ).fetchall()
        }
        missing = [d for d in MANDATORY_DOCS if d not in uploaded]
        if missing:
            labels = {
                "gst_certificate": "GST Registration Certificate",
                "pan_card": "PAN Card",
                "incorporation_certificate": "Company Incorporation Certificate",
                "bank_cheque": "Bank Cancelled Cheque",
            }
            return jsonify({
                "errors": {
                    "documents": f"Missing mandatory documents: {', '.join(labels.get(m,m) for m in missing)}"
                }
            }), 422

        now = datetime.utcnow().isoformat()
        conn.execute("""
            UPDATE vendors SET
              registration_step=CASE WHEN registration_step<4 THEN 4 ELSE registration_step END,
              updated_at=? WHERE id=?
        """, (now, vid))
        conn.commit()
        return jsonify({"message": "Step 3 complete", "next_step": 4})
    finally:
        conn.close()


# ── Step 4 — Banking Details ──────────────────────────────────────────────────

@bp.post("/api/vendor/step/4")
@vendor_required
def vendor_step4():
    vid = g.user["entity_id"]
    d = request.get_json(silent=True) or {}
    errors = {}

    holder  = (d.get("bank_account_holder") or "").strip()
    acc_no  = (d.get("bank_account_number") or "").strip()
    ifsc    = (d.get("bank_ifsc") or "").strip().upper()
    bank    = (d.get("bank_name") or "").strip()
    acc_type= (d.get("bank_account_type") or "").strip()

    if not holder:  errors["bank_account_holder"]  = "Account holder name is required"
    if not acc_no:  errors["bank_account_number"]  = "Account number is required"
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
            UPDATE vendors SET
              bank_account_holder=?, bank_account_number=?, bank_ifsc=?,
              bank_name=?, bank_account_type=?,
              registration_step=CASE WHEN registration_step<5 THEN 5 ELSE registration_step END,
              updated_at=? WHERE id=?
        """, (holder, acc_no, ifsc, bank or None, acc_type, now, vid))
        conn.commit()
        audit(g.user["id"], "vendor", vid, "Saved registration step 4 (Banking)")
        return jsonify({"message": "Step 4 saved", "next_step": 5})
    finally:
        conn.close()


# ── Step 5 — Submit ───────────────────────────────────────────────────────────

@bp.post("/api/vendor/submit")
@vendor_required
def vendor_submit():
    vid = g.user["entity_id"]
    conn = get_db()
    try:
        vendor = conn.execute("SELECT * FROM vendors WHERE id=?", (vid,)).fetchone()
        if not vendor:
            return jsonify({"error": "Vendor not found"}), 404

        if vendor["status"] == "submitted":
            return jsonify({"message": "Already submitted"}), 200

        errors = {}
        if not vendor["company_name"]:     errors["step1"] = "Complete company information"
        if not vendor["gstin"]:            errors["step1"] = "Complete company information"
        if not vendor["bank_ifsc"]:        errors["step4"] = "Complete banking details"

        uploaded = {
            r["doc_type"] for r in conn.execute(
                "SELECT doc_type FROM vendor_documents WHERE vendor_id=? AND is_deleted=0", (vid,)
            ).fetchall()
        }
        missing = [d for d in MANDATORY_DOCS if d not in uploaded]
        if missing:
            errors["step3"] = "Upload all mandatory documents"

        cats = conn.execute(
            "SELECT COUNT(*) as n FROM vendor_categories WHERE vendor_id=?", (vid,)
        ).fetchone()["n"]
        if cats == 0:
            errors["step2"] = "Select at least one product category"

        if errors:
            return jsonify({"errors": errors}), 422

        now = datetime.utcnow().isoformat()
        conn.execute("""
            UPDATE vendors SET status='submitted', registration_step=5, updated_at=?
            WHERE id=?
        """, (now, vid))
        conn.commit()

        audit(g.user["id"], "vendor", vid, "Submitted registration for review",
              after={"status": "submitted"})

        # Notify all admin users
        admins = conn.execute(
            "SELECT id, email FROM users WHERE entity_type='admin' AND is_active=1"
        ).fetchall()
        for adm in admins:
            conn.execute("""
                INSERT INTO notifications(id,user_id,title,body,channel,event_type,
                  entity_type,entity_id,is_read,created_at)
                VALUES(?,?,?,?,'in_app','registration_submitted','vendor',?,0,?)
            """, (new_id(), adm["id"],
                  f"New Vendor Registration — {vendor['company_name']}",
                  f"{vendor['company_name']} has submitted their vendor registration and is awaiting review.",
                  vid, now))
        conn.commit()

        from email_service import send_email
        for adm in admins:
            if adm["email"]:
                send_email(adm["email"],
                    f"New Vendor Registration — {vendor['company_name']}",
                    f"<p>{vendor['company_name']} has submitted a vendor registration. Please review in the Admin Portal.</p>")

        return jsonify({"message": "Registration submitted successfully. We'll review and respond within 2-3 business days."})
    finally:
        conn.close()


# ── Vendor update info after info_requested ───────────────────────────────────

@bp.post("/api/vendor/resubmit")
@vendor_required
def vendor_resubmit():
    vid = g.user["entity_id"]
    conn = get_db()
    try:
        vendor = conn.execute("SELECT status FROM vendors WHERE id=?", (vid,)).fetchone()
        if not vendor or vendor["status"] != "info_requested":
            return jsonify({"error": "Resubmission only allowed when info is requested"}), 400

        now = datetime.utcnow().isoformat()
        conn.execute(
            "UPDATE vendors SET status='submitted', info_request_note=NULL, updated_at=? WHERE id=?",
            (now, vid)
        )
        conn.commit()
        audit(g.user["id"], "vendor", vid, "Resubmitted registration after info request")
        return jsonify({"message": "Resubmitted for review"})
    finally:
        conn.close()


# ── Vendor Documents list ─────────────────────────────────────────────────────

@bp.get("/api/vendor/documents")
@vendor_required
def vendor_documents():
    vid = g.user["entity_id"]
    conn = get_db()
    try:
        docs = conn.execute(
            """SELECT id, doc_type, file_name, file_size_bytes, is_mandatory,
                      expiry_date, expiry_status, uploaded_at
               FROM vendor_documents WHERE vendor_id=? AND is_deleted=0
               ORDER BY uploaded_at DESC""",
            (vid,)
        ).fetchall()
        return jsonify([dict(r) for r in docs])
    finally:
        conn.close()
