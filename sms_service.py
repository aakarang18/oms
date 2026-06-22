"""
SMS / OTP delivery via MSG91 (or console fallback in dev mode).
Set MSG91_AUTH_KEY in .env to enable real SMS.
"""
import os
import requests

AUTH_KEY = os.environ.get("MSG91_AUTH_KEY", "")
SENDER_ID = os.environ.get("MSG91_SENDER_ID", "AMARAL")
TEMPLATE_ID = os.environ.get("MSG91_TEMPLATE_ID", "")
DEV_MODE = not AUTH_KEY


def send_otp(mobile: str, otp: str) -> bool:
    """Send OTP via MSG91. Returns True on success."""
    if DEV_MODE:
        print(f"[SMS DEV] OTP for {mobile}: {otp}")
        return True

    mobile = mobile.lstrip("+")
    if not mobile.startswith("91"):
        mobile = "91" + mobile

    url = "https://api.msg91.com/api/v5/otp"
    payload = {
        "template_id": TEMPLATE_ID,
        "mobile":      mobile,
        "authkey":     AUTH_KEY,
        "otp":         otp,
    }
    try:
        resp = requests.post(url, json=payload, timeout=10)
        data = resp.json()
        return data.get("type") == "success"
    except Exception as e:
        print(f"[SMS ERROR] {e}")
        return False


def send_sms(mobile: str, message: str) -> bool:
    """Send plain SMS."""
    if DEV_MODE:
        print(f"[SMS DEV] To {mobile}: {message}")
        return True

    mobile = mobile.lstrip("+")
    if not mobile.startswith("91"):
        mobile = "91" + mobile

    url = "https://api.msg91.com/api/sendhttp.php"
    params = {
        "authkey":  AUTH_KEY,
        "mobiles":  mobile,
        "message":  message,
        "sender":   SENDER_ID,
        "route":    "4",
        "country":  "91",
    }
    try:
        resp = requests.get(url, params=params, timeout=10)
        return resp.status_code == 200
    except Exception as e:
        print(f"[SMS ERROR] {e}")
        return False
