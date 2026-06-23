"""
Amar Alum Vendor & Transporter Portal — Main Flask Application
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

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", os.urandom(32))
app.config["MAX_CONTENT_LENGTH"] = 6 * 1024 * 1024  # 6 MB max upload

# ─── Init ───────────────────────────────────────────────────────────────────────────────
init_db()
init_mail(app)

app.register_blueprint(vendor_reg_bp)
app.register_blueprint(transporter_reg_bp)
app.register_blueprint(admin_reg_bp)
app.register_blueprint(rfq_bp)
app.register_blueprint(admin_rfq_bp)
app.register_blueprint(po_bp)
app.register_blueprint(admin_po_bp)

# Start scheduler only in main process (not reloader child)
if os.environ.get("WERKZEUG_RUN_MAIN") != "false":
    try:
        from scheduler import start_scheduler
        start_scheduler(app)
    except Exception as e:
        print(f"[Scheduler] Failed to start: {e}")
