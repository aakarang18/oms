"""
Email notifications via Flask-Mail.
In dev mode (no MAIL_SERVER set), prints to console.
"""
import os
from flask_mail import Mail, Message

mail = Mail()
DEV_MODE = not os.environ.get("MAIL_SERVER", "")


def init_mail(app):
    app.config.setdefault("MAIL_SERVER",   os.environ.get("MAIL_SERVER", "localhost"))
    app.config.setdefault("MAIL_PORT",     int(os.environ.get("MAIL_PORT", 587)))
    app.config.setdefault("MAIL_USE_TLS",  os.environ.get("MAIL_USE_TLS", "true").lower() == "true")
    app.config.setdefault("MAIL_USERNAME", os.environ.get("MAIL_USERNAME", ""))
    app.config.setdefault("MAIL_PASSWORD", os.environ.get("MAIL_PASSWORD", ""))
    app.config.setdefault("MAIL_DEFAULT_SENDER",
                          os.environ.get("MAIL_FROM", "noreply@amaralum.com"))
    mail.init_app(app)


def send_email(to: str | list, subject: str, body_html: str, body_text: str = ""):
    if DEV_MODE:
        recipients = to if isinstance(to, list) else [to]
        print(f"[EMAIL DEV] To: {recipients}\nSubject: {subject}\n{body_text or body_html}\n")
        return True
    try:
        recipients = to if isinstance(to, list) else [to]
        msg = Message(subject, recipients=recipients,
                      html=body_html, body=body_text)
        mail.send(msg)
        return True
    except Exception as e:
        print(f"[EMAIL ERROR] {e}")
        return False


# ─── Email templates ──────────────────────────────────────────────────────────────────────────

def _base(title: str, body: str) -> str:
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;
                border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <div style="background:#1e3a5f;padding:24px 32px">
        <h2 style="color:#fff;margin:0;font-size:20px">Amar Alum & Allied Chemicals</h2>
        <p style="color:#93c5fd;margin:4px 0 0;font-size:13px">Vendor & Transporter Portal</p>
      </div>
      <div style="padding:32px">
        <h3 style="color:#1e3a5f;margin-top:0">{title}</h3>
        {body}
      </div>
      <div style="background:#f9fafb;padding:16px 32px;font-size:12px;color:#6b7280;
                  border-top:1px solid #e5e7eb">
        This is an automated message. Please do not reply directly to this email.
      </div>
    </div>"""


def email_otp(otp: str) -> tuple[str, str]:
    subject = "Your OTP — Amar Alum Portal"
    html = _base("One-Time Password", f"""
        <p>Your OTP for the Amar Alum Vendor & Transporter Portal is:</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;
                    color:#1e3a5f;margin:24px 0;text-align:center">{otp}</div>
        <p style="color:#6b7280;font-size:13px">
          This OTP is valid for <strong>10 minutes</strong>.
          Do not share it with anyone.</p>
    """)
    return subject, html


def email_registration_approved(company_name: str, portal_url: str) -> tuple[str, str]:
    subject = f"Registration Approved — {company_name}"
    html = _base("Welcome to Amar Alum Portal!", f"""
        <p>Congratulations! Your registration for <strong>{company_name}</strong>
           has been approved.</p>
        <p>You can now log in to the portal and start using all features.</p>
        <div style="text-align:center;margin:32px 0">
          <a href="{portal_url}"
             style="background:#1e3a5f;color:#fff;padding:12px 32px;
                    border-radius:6px;text-decoration:none;font-weight:bold">
            Access Portal
          </a>
        </div>
    """)
    return subject, html


def email_registration_rejected(company_name: str, reason: str) -> tuple[str, str]:
    subject = f"Registration Update — {company_name}"
    html = _base("Registration Status Update", f"""
        <p>We regret to inform you that the registration for
           <strong>{company_name}</strong> could not be approved at this time.</p>
        <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:16px;margin:16px 0">
          <strong>Reason:</strong> {reason}
        </div>
        <p>If you believe this is an error, please contact us at
           <a href="mailto:procurement@amaralum.com">procurement@amaralum.com</a>.</p>
    """)
    return subject, html


def email_payment_recorded(company_name: str, amount: float,
                            utr: str, inv_ref: str) -> tuple[str, str]:
    subject = f"Payment Processed — ₹{amount:,.2f} | {inv_ref}"
    html = _base("Payment Confirmation", f"""
        <p>A payment has been processed for <strong>{company_name}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;color:#6b7280">Invoice Ref</td>
              <td style="padding:8px;font-weight:bold">{inv_ref}</td></tr>
          <tr style="background:#f9fafb">
              <td style="padding:8px;color:#6b7280">Amount</td>
              <td style="padding:8px;font-weight:bold">₹{amount:,.2f}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">UTR Number</td>
              <td style="padding:8px;font-weight:bold">{utr}</td></tr>
        </table>
        <p style="color:#6b7280;font-size:13px">
          Please allow 1-2 business days for the amount to reflect in your account.</p>
    """)
    return subject, html
