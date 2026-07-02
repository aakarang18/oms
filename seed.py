"""
Seed script — populates portal.db with sample data for end-to-end testing.

Run from the vendor-portal directory:
    python seed.py               # seed into portal.db
    python seed.py --wipe        # drop all data first, then seed

After running, log into each portal with the session tokens printed at the end,
by pasting them as the cookie value for `portal_session` in your browser DevTools,
OR just visit the /dev-login/<token> helper URL printed below (only works if Flask
is running).

NO real files are created for uploaded docs — the DB rows reference a placeholder
path. The portal will show filenames but download links will 404; that's expected.
"""
import sys
import uuid
import sqlite3
import os
from datetime import datetime, timedelta, timezone

DB_PATH = os.environ.get("PORTAL_DB") or os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "portal.db"
)

WIPE = "--wipe" in sys.argv

NOW = datetime.now(timezone.utc)
Y = NOW.year


def uid():
    return str(uuid.uuid4())


def ts(delta_days=0):
    return (NOW + timedelta(days=delta_days)).isoformat()


def seq(prefix, n, y=None):
    return f"{prefix}-{y or Y}-{n:03d}"


# ─────────────────────────────────────────────────────────────────────────────
# Connection
# ─────────────────────────────────────────────────────────────────────────────

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
conn.execute("PRAGMA journal_mode=WAL")
conn.execute("PRAGMA foreign_keys=ON")

if WIPE:
    print("Wiping existing data …")
    for tbl in [
        "audit_logs", "notifications", "payments", "invoices",
        "trip_decline_log", "trips", "rate_cards", "routes",
        "grns", "purchase_orders", "quote_attachments", "quotes",
        "rfq_targeted_vendors", "rfq_attachments", "rfqs",
        "vehicle_documents", "vehicles", "transporter_documents",
        "vendor_documents", "vendor_products", "vendor_categories",
        "otp_tokens", "sessions", "transporters", "vendors", "users",
        "sequence_counters",
    ]:
        conn.execute(f"DELETE FROM {tbl}")
    conn.commit()
    print("  done.\n")

# ─────────────────────────────────────────────────────────────────────────────
# IDs — fixed so we can reference them across tables
# ─────────────────────────────────────────────────────────────────────────────

# Users
U_ADMIN     = uid()
U_VENDOR1   = uid()
U_VENDOR2   = uid()
U_TRANS1    = uid()
U_TRANS2    = uid()

# Vendors
V1 = uid()
V2 = uid()

# Transporters
T1 = uid()
T2 = uid()

# Vehicles
VH1 = uid()
VH2 = uid()

# Routes
R1 = uid()
R2 = uid()

# Rate cards
RC1 = uid()
RC2 = uid()

# RFQs
RFQ1 = uid()
RFQ2 = uid()
RFQ3 = uid()

# Quotes
Q1 = uid()
Q2 = uid()
Q3 = uid()

# POs
PO1  = uid()
PO2  = uid()
GRN1 = uid()

# Trips
TR1 = uid()
TR2 = uid()
TR3 = uid()

# Invoices
INV1 = uid()
INV2 = uid()
INV3 = uid()

# Sessions (fixed tokens — use these as cookie values)
SES_ADMIN   = "seed-session-admin-0001"
SES_VENDOR1 = "seed-session-vendor-0001"
SES_VENDOR2 = "seed-session-vendor-0002"
SES_TRANS1  = "seed-session-trans-0001"
SES_TRANS2  = "seed-session-trans-0002"

FAR_FUTURE = (NOW + timedelta(days=365)).isoformat()


# ─────────────────────────────────────────────────────────────────────────────
# 1. USERS
# ─────────────────────────────────────────────────────────────────────────────

users = [
    # id, mobile, email, role, entity_type, entity_id
    (U_ADMIN,   "9000000001", "admin@amaralum.com",     "super_admin",       'admin',      None),
    (U_VENDOR1, "9000000002", "admin@krishnachem.com",  "vendor_admin",      "vendor",     V1),
    (U_VENDOR2, "9000000003", "admin@shivashakti.com",  "vendor_admin",      "vendor",     V2),
    (U_TRANS1,  "9000000004", "admin@speedlogistics.com","transporter_admin","transporter", T1),
    (U_TRANS2,  "9000000005", "admin@bharatfreight.com", "transporter_admin","transporter", T2),
]

for u in users:
    uid_, mobile, email, role, etype, eid = u
    existing = conn.execute("SELECT id FROM users WHERE mobile=?", (mobile,)).fetchone()
    if not existing:
        conn.execute(
            """INSERT INTO users(id,mobile,email,role,entity_type,entity_id,
               is_active,failed_attempts,created_at,updated_at)
               VALUES(?,?,?,?,?,?,1,0,?,?)""",
            (uid_, mobile, email, role, etype, eid, ts(), ts())
        )

conn.commit()
print(f"  Users: {len(users)} inserted / already present")

# Re-resolve IDs from DB so downstream FK refs use the actual stored UUIDs
# (generated IDs above may differ from what's already in an existing db)
def _uid_for_mobile(mobile):
    row = conn.execute("SELECT id FROM users WHERE mobile=?", (mobile,)).fetchone()
    return row["id"] if row else None

U_ADMIN   = _uid_for_mobile("9000000001") or U_ADMIN
U_VENDOR1 = _uid_for_mobile("9000000002") or U_VENDOR1
U_VENDOR2 = _uid_for_mobile("9000000003") or U_VENDOR2
U_TRANS1  = _uid_for_mobile("9000000004") or U_TRANS1
U_TRANS2  = _uid_for_mobile("9000000005") or U_TRANS2


# ─────────────────────────────────────────────────────────────────────────────
# 2. SESSIONS (fixed tokens for easy login)
# ─────────────────────────────────────────────────────────────────────────────

sessions = [
    (SES_ADMIN,   U_ADMIN),
    (SES_VENDOR1, U_VENDOR1),
    (SES_VENDOR2, U_VENDOR2),
    (SES_TRANS1,  U_TRANS1),
    (SES_TRANS2,  U_TRANS2),
]

for tok, uid_ in sessions:
    conn.execute("DELETE FROM sessions WHERE id=? OR user_id=?", (tok, uid_))
    conn.execute(
        """INSERT INTO sessions(id,user_id,ip_address,user_agent,expires_at,created_at)
           VALUES(?,?,'127.0.0.1','seed-script',?,?)""",
        (tok, uid_, FAR_FUTURE, ts())
    )

conn.commit()
print(f"  Sessions: {len(sessions)} created")


# ─────────────────────────────────────────────────────────────────────────────
# 3. VENDORS
# ─────────────────────────────────────────────────────────────────────────────

vendors = [
    {
        "id": V1, "company_name": "Krishna Chemicals Ltd",
        "gstin": "27AAACK1234A1Z5", "pan_number": "AAACK1234A",
        "company_type": "Private Limited",
        "reg_addr_line1": "Plot 12, MIDC Tarapur",
        "reg_addr_city": "Boisar", "reg_addr_state": "Maharashtra", "reg_addr_pin": "401506",
        "contact_name": "Rajesh Krishnamurthy", "contact_designation": "Director",
        "contact_mobile": "9000000002", "contact_email": "admin@krishnachem.com",
        "bank_account_holder": "Krishna Chemicals Ltd",
        "bank_account_number": "9876543210001", "bank_ifsc": "SBIN0001234",
        "bank_name": "State Bank of India", "bank_account_type": "Current",
        "status": "approved", "registration_step": 5,
        "approved_by": U_ADMIN, "approved_at": ts(-30),
    },
    {
        "id": V2, "company_name": "Shiva Shakti Enterprises",
        "gstin": "29AAASS5678B1Z3", "pan_number": "AAASS5678B",
        "company_type": "Partnership",
        "reg_addr_line1": "45 Industrial Area, Phase 2",
        "reg_addr_city": "Hubli", "reg_addr_state": "Karnataka", "reg_addr_pin": "580031",
        "contact_name": "Suresh Patil", "contact_designation": "Managing Partner",
        "contact_mobile": "9000000003", "contact_email": "admin@shivashakti.com",
        "bank_account_holder": "Shiva Shakti Enterprises",
        "bank_account_number": "1234567890002", "bank_ifsc": "HDFC0002345",
        "bank_name": "HDFC Bank", "bank_account_type": "Current",
        "status": "under_review", "registration_step": 4,
    },
]

for v in vendors:
    existing = conn.execute("SELECT id FROM vendors WHERE gstin=?", (v["gstin"],)).fetchone()
    if not existing:
        conn.execute(
            """INSERT INTO vendors(id,company_name,gstin,pan_number,company_type,
               reg_addr_line1,reg_addr_city,reg_addr_state,reg_addr_pin,
               contact_name,contact_designation,contact_mobile,contact_email,
               bank_account_holder,bank_account_number,bank_ifsc,bank_name,bank_account_type,
               status,registration_step,approved_by,approved_at,
               is_deleted,created_at,updated_at)
               VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)""",
            (
                v["id"], v["company_name"], v["gstin"], v["pan_number"], v["company_type"],
                v["reg_addr_line1"], v["reg_addr_city"], v["reg_addr_state"], v["reg_addr_pin"],
                v["contact_name"], v["contact_designation"], v["contact_mobile"], v["contact_email"],
                v.get("bank_account_holder"), v.get("bank_account_number"),
                v.get("bank_ifsc"), v.get("bank_name"), v.get("bank_account_type"),
                v["status"], v["registration_step"],
                v.get("approved_by"), v.get("approved_at"),
                ts(), ts(),
            )
        )

# Re-resolve vendor IDs now so sub-table inserts below use the correct FK
def _uid_for_gstin_v(gstin):
    row = conn.execute("SELECT id FROM vendors WHERE gstin=?", (gstin,)).fetchone()
    return row["id"] if row else None

V1 = _uid_for_gstin_v("27AAACK1234A1Z5") or V1
V2 = _uid_for_gstin_v("29AAASS5678B1Z3") or V2

# Vendor categories
for vid, cats in [(V1, ["Chemicals", "Raw Materials"]), (V2, ["Chemicals"])]:
    for cat in cats:
        if not conn.execute("SELECT id FROM vendor_categories WHERE vendor_id=? AND category=?", (vid, cat)).fetchone():
            conn.execute("INSERT INTO vendor_categories(id,vendor_id,category) VALUES(?,?,?)", (uid(), vid, cat))

# Vendor products
for vid, prods in [
    (V1, [("Aluminium Sulphate", "Industrial grade 99% purity"), ("Ferric Chloride", "Anhydrous grade")]),
    (V2, [("Sulphuric Acid", "98% concentrated"), ("Caustic Soda Flakes", "Food grade")]),
]:
    for name, desc in prods:
        if not conn.execute("SELECT id FROM vendor_products WHERE vendor_id=? AND product_name=?", (vid, name)).fetchone():
            conn.execute("INSERT INTO vendor_products(id,vendor_id,product_name,description) VALUES(?,?,?,?)", (uid(), vid, name, desc))

# Vendor documents
for vid, docs in [
    (V1, [
        ("gst_certificate",          "GST_Certificate_KC.pdf",       1, ts(90),  "ok"),
        ("pan_card",                 "PAN_Card_KC.pdf",              1, None,    "ok"),
        ("incorporation_certificate","Inc_Certificate_KC.pdf",       1, None,    "ok"),
        ("bank_cheque",              "Cancelled_Cheque_KC.pdf",      1, None,    "ok"),
        ("msme_certificate",         "MSME_Certificate_KC.pdf",      0, ts(180), "ok"),
    ]),
    (V2, [
        ("gst_certificate",          "GST_Cert_SS.pdf",             1, ts(-5),  "expired"),
        ("pan_card",                 "PAN_SS.pdf",                  1, None,    "ok"),
    ]),
]:
    for doc_type, fname, mandatory, expiry, estatus in docs:
        if not conn.execute("SELECT id FROM vendor_documents WHERE vendor_id=? AND doc_type=?", (vid, doc_type)).fetchone():
            conn.execute(
                """INSERT INTO vendor_documents(id,vendor_id,doc_type,file_path,file_name,
                   file_size_bytes,is_mandatory,expiry_date,expiry_status,uploaded_at,is_deleted)
                   VALUES(?,?,?,?,?,?,?,?,?,?,0)""",
                (uid(), vid, doc_type, f"uploads/vendor/{vid}/{fname}", fname,
                 102400, mandatory, expiry, estatus, ts(-60))
            )

conn.commit()
print(f"  Vendors: {len(vendors)} inserted / already present")


# ─────────────────────────────────────────────────────────────────────────────
# 4. TRANSPORTERS
# ─────────────────────────────────────────────────────────────────────────────

transporters = [
    {
        "id": T1, "company_name": "Speed Logistics Pvt Ltd",
        "gstin": "27AABCS1234C1Z4", "pan_number": "AABCS1234C",
        "company_type": "Private Limited",
        "reg_addr_line1": "Survey 45, Bhiwandi",
        "reg_addr_city": "Bhiwandi", "reg_addr_state": "Maharashtra", "reg_addr_pin": "421302",
        "contact_name": "Mahesh Thakur", "contact_designation": "Operations Manager",
        "contact_mobile": "9000000004", "contact_email": "admin@speedlogistics.com",
        "bank_account_holder": "Speed Logistics Pvt Ltd",
        "bank_account_number": "5678901234003", "bank_ifsc": "ICIC0003456",
        "bank_name": "ICICI Bank", "bank_account_type": "Current",
        "status": "approved", "registration_step": 4,
        "approved_by": U_ADMIN, "approved_at": ts(-45),
    },
    {
        "id": T2, "company_name": "Bharat Freight Services",
        "gstin": "24AABCB5678D1Z2", "pan_number": "AABCB5678D",
        "company_type": "Proprietorship",
        "reg_addr_line1": "NH-8, Vapi Industrial Estate",
        "reg_addr_city": "Vapi", "reg_addr_state": "Gujarat", "reg_addr_pin": "396195",
        "contact_name": "Dinesh Patel", "contact_designation": "Proprietor",
        "contact_mobile": "9000000005", "contact_email": "admin@bharatfreight.com",
        "status": "pending", "registration_step": 2,
    },
]

for t in transporters:
    existing = conn.execute("SELECT id FROM transporters WHERE gstin=?", (t["gstin"],)).fetchone()
    if not existing:
        conn.execute(
            """INSERT INTO transporters(id,company_name,gstin,pan_number,company_type,
               reg_addr_line1,reg_addr_city,reg_addr_state,reg_addr_pin,
               contact_name,contact_designation,contact_mobile,contact_email,
               bank_account_holder,bank_account_number,bank_ifsc,bank_name,bank_account_type,
               status,registration_step,approved_by,approved_at,
               is_deleted,created_at,updated_at)
               VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)""",
            (
                t["id"], t["company_name"], t["gstin"], t["pan_number"], t["company_type"],
                t["reg_addr_line1"], t["reg_addr_city"], t["reg_addr_state"], t["reg_addr_pin"],
                t["contact_name"], t["contact_designation"], t["contact_mobile"], t["contact_email"],
                t.get("bank_account_holder"), t.get("bank_account_number"),
                t.get("bank_ifsc"), t.get("bank_name"), t.get("bank_account_type"),
                t["status"], t["registration_step"],
                t.get("approved_by"), t.get("approved_at"),
                ts(), ts(),
            )
        )

# Re-resolve transporter IDs now so sub-table inserts below use the correct FK
def _uid_for_gstin_t(gstin):
    row = conn.execute("SELECT id FROM transporters WHERE gstin=?", (gstin,)).fetchone()
    return row["id"] if row else None

T1 = _uid_for_gstin_t("27AABCS1234C1Z4") or T1
T2 = _uid_for_gstin_t("24AABCB5678D1Z2") or T2

# Transporter documents
for tid, docs in [
    (T1, [
        ("gst_certificate",  "GST_Speed.pdf",    1, ts(200), "ok"),
        ("pan_card",         "PAN_Speed.pdf",    1, None,    "ok"),
        ("bank_cheque",      "Cheque_Speed.pdf", 1, None,    "ok"),
    ]),
    (T2, [
        ("gst_certificate",  "GST_Bharat.pdf",   1, ts(10),  "expiring_15"),
    ]),
]:
    for doc_type, fname, mandatory, expiry, estatus in docs:
        if not conn.execute("SELECT id FROM transporter_documents WHERE transporter_id=? AND doc_type=?", (tid, doc_type)).fetchone():
            conn.execute(
                """INSERT INTO transporter_documents(id,transporter_id,doc_type,file_path,file_name,
                   file_size_bytes,is_mandatory,expiry_date,expiry_status,uploaded_at,is_deleted)
                   VALUES(?,?,?,?,?,?,?,?,?,?,0)""",
                (uid(), tid, doc_type, f"uploads/transporter/{tid}/{fname}", fname,
                 81920, mandatory, expiry, estatus, ts(-30))
            )

conn.commit()
print(f"  Transporters: {len(transporters)} inserted / already present")


# ─────────────────────────────────────────────────────────────────────────────
# 5. VEHICLES
# ─────────────────────────────────────────────────────────────────────────────

vehicles_data = [
    (VH1, T1, "MH04AA1234", "20 ft Container", 10.0, 2020, "available", "Ramesh Kumar", "MH0420200012345", ts(300)),
    (VH2, T1, "MH04BB5678", "32 ft SXL",       20.0, 2019, "in_transit","Sunil Sharma",  "MH0420190067890", ts(200)),
]

for v in vehicles_data:
    vid, tid, reg, vtype, cap, yr, status, driver, dlno, dlexp = v
    if not conn.execute("SELECT id FROM vehicles WHERE reg_number=?", (reg,)).fetchone():
        conn.execute(
            """INSERT INTO vehicles(id,transporter_id,reg_number,vehicle_type,capacity_tons,
               year_of_manufacture,status,driver_name,driver_license_number,driver_license_expiry,
               is_deleted,created_at,updated_at)
               VALUES(?,?,?,?,?,?,?,?,?,?,0,?,?)""",
            (vid, tid, reg, vtype, cap, yr, status, driver, dlno, dlexp, ts(), ts())
        )

# Re-resolve vehicle IDs from DB
def _uid_for_reg(reg):
    row = conn.execute("SELECT id FROM vehicles WHERE reg_number=?", (reg,)).fetchone()
    return row["id"] if row else None

VH1 = _uid_for_reg("MH04AA1234") or VH1
VH2 = _uid_for_reg("MH04BB5678") or VH2

# Vehicle documents
for vid, docs in [
    (VH1, [
        ("rc_book",          "RC_MH04AA1234.pdf",      ts(Y - 2000 + 15, ), "ok"),
        ("insurance",        "Insurance_MH04AA1234.pdf", ts(180),           "ok"),
        ("fitness_cert",     "Fitness_MH04AA1234.pdf",  ts(7),              "expiring_7"),
        ("pollution_cert",   "PUC_MH04AA1234.pdf",      ts(-2),             "expired"),
    ]),
    (VH2, [
        ("rc_book",          "RC_MH04BB5678.pdf",       ts(300),            "ok"),
        ("insurance",        "Insurance_MH04BB5678.pdf", ts(60),            "ok"),
    ]),
]:
    for doc_type, fname, expiry, estatus in docs:
        if not conn.execute("SELECT id FROM vehicle_documents WHERE vehicle_id=? AND doc_type=?", (vid, doc_type)).fetchone():
            conn.execute(
                """INSERT INTO vehicle_documents(id,vehicle_id,doc_type,file_path,file_name,
                   file_size_bytes,expiry_date,expiry_status,uploaded_at,is_deleted)
                   VALUES(?,?,?,?,?,?,?,?,?,0)""",
                (uid(), vid, doc_type, f"uploads/vehicle/{vid}/{fname}", fname,
                 51200, expiry, estatus, ts(-20))
            )

conn.commit()
print(f"  Vehicles: {len(vehicles_data)} inserted")


# ─────────────────────────────────────────────────────────────────────────────
# 6. ROUTES
# ─────────────────────────────────────────────────────────────────────────────

routes_data = [
    (R1, "RT-MUM-AHM", "Mumbai", "Maharashtra", "Ahmedabad", "Gujarat",    537.0),
    (R2, "RT-MUM-HYD", "Mumbai", "Maharashtra", "Hyderabad",  "Telangana", 712.0),
]

for r in routes_data:
    rid, code, oc, os_, dc, ds, dist = r
    if not conn.execute("SELECT id FROM routes WHERE route_code=?", (code,)).fetchone():
        conn.execute(
            """INSERT INTO routes(id,route_code,origin_city,origin_state,destination_city,
               destination_state,distance_km,route_type,is_active,created_by,created_at,updated_at)
               VALUES(?,?,?,?,?,?,?,'Road',1,?,?,?)""",
            (rid, code, oc, os_, dc, ds, dist, U_ADMIN, ts(), ts())
        )

conn.commit()
print(f"  Routes: {len(routes_data)} inserted")

# Re-resolve route IDs from DB
def _uid_for_route(code):
    row = conn.execute("SELECT id FROM routes WHERE route_code=?", (code,)).fetchone()
    return row["id"] if row else None

R1 = _uid_for_route("RT-MUM-AHM") or R1
R2 = _uid_for_route("RT-MUM-HYD") or R2


# ─────────────────────────────────────────────────────────────────────────────
# 7. RATE CARDS
# ─────────────────────────────────────────────────────────────────────────────

if not conn.execute("SELECT id FROM rate_cards WHERE id=?", (RC1,)).fetchone():
    conn.execute(
        """INSERT INTO rate_cards(id,transporter_id,route_id,vehicle_type,
           rate_per_km,rate_per_ton,minimum_charge,valid_from,valid_until,
           status,reviewed_by,reviewed_at,is_deleted,created_at,updated_at)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)""",
        (RC1, T1, R1, "20 ft Container", 35.0, 850.0, 5000.0,
         ts(-90), ts(90), "approved", U_ADMIN, ts(-85), ts(), ts())
    )

if not conn.execute("SELECT id FROM rate_cards WHERE id=?", (RC2,)).fetchone():
    conn.execute(
        """INSERT INTO rate_cards(id,transporter_id,route_id,vehicle_type,
           rate_per_km,rate_per_ton,minimum_charge,valid_from,valid_until,
           status,is_deleted,created_at,updated_at)
           VALUES(?,?,?,?,?,?,?,?,?,'pending',0,?,?)""",
        (RC2, T2, R2, "32 ft SXL", 42.0, 950.0, 6000.0,
         ts(-5), ts(180), ts(-5), ts())
    )

conn.commit()
print("  Rate cards: 2 inserted")


# ─────────────────────────────────────────────────────────────────────────────
# 8. RFQs
# ─────────────────────────────────────────────────────────────────────────────

# Sequence counters
for prefix, seq_n in [("RFQ", 3), ("PO", 2), ("GRN", 1), ("TRIP", 3)]:
    conn.execute(
        "INSERT OR REPLACE INTO sequence_counters(prefix,year,last_seq) VALUES(?,?,?)",
        (prefix, Y, seq_n)
    )

rfqs_data = [
    # id, number, title, qty, unit, location, deadline, sub_deadline, status, category
    (RFQ1, seq("RFQ", 1), "Aluminium Sulphate — 500 MT",
     500.0, "MT", "Tarapur Plant, Maharashtra", ts(30), ts(10),
     "published", "Chemicals"),
    (RFQ2, seq("RFQ", 2), "Caustic Soda Flakes — 200 MT",
     200.0, "MT", "Hubli Warehouse, Karnataka", ts(20), ts(5),
     "awarded", "Chemicals"),
    (RFQ3, seq("RFQ", 3), "Ferric Chloride — 100 MT",
     100.0, "MT", "Bhiwandi Depot, Maharashtra", ts(15), ts(3),
     "published", "Chemicals"),
]

for r in rfqs_data:
    rid, rnum, title, qty, unit, loc, ddl, sdl, status, cat = r
    if not conn.execute("SELECT id FROM rfqs WHERE rfq_number=?", (rnum,)).fetchone():
        conn.execute(
            """INSERT INTO rfqs(id,rfq_number,title,description,quantity,quantity_unit,
               delivery_location,delivery_deadline,submission_deadline,target_type,
               estimated_value,status,category,created_by,
               awarded_to_vendor,awarded_at,is_deleted,created_at,updated_at)
               VALUES(?,?,?,?,?,?,?,?,?,'open',?,?,?,?,?,?,0,?,?)""",
            (rid, rnum, title, f"Please quote your best price for {title}.",
             qty, unit, loc, ddl, sdl,
             qty * 8000,  # estimated
             status, cat, U_ADMIN,
             V1 if status == "awarded" else None,
             ts(-5) if status == "awarded" else None,
             ts(-15), ts())
        )

conn.commit()
print(f"  RFQs: {len(rfqs_data)} inserted")

# Re-resolve RFQ IDs from DB
def _uid_for_rfq(num):
    row = conn.execute("SELECT id FROM rfqs WHERE rfq_number=?", (num,)).fetchone()
    return row["id"] if row else None

RFQ1 = _uid_for_rfq(seq("RFQ", 1)) or RFQ1
RFQ2 = _uid_for_rfq(seq("RFQ", 2)) or RFQ2
RFQ3 = _uid_for_rfq(seq("RFQ", 3)) or RFQ3


# ─────────────────────────────────────────────────────────────────────────────
# 9. QUOTES
# ─────────────────────────────────────────────────────────────────────────────

quotes_data = [
    # id, rfq_id, vendor_id, unit_price, qty, gst%, status
    (Q1, RFQ1, V1, 9200.0,  500.0, 18.0, "submitted"),
    (Q2, RFQ1, V2, 9500.0,  500.0, 18.0, "submitted"),
    (Q3, RFQ2, V1, 8800.0,  200.0, 18.0, "awarded"),
]

for q in quotes_data:
    qid, rfq_id, vendor_id, unit_price, qty, gst_rate, status = q
    if not conn.execute("SELECT id FROM quotes WHERE id=?", (qid,)).fetchone():
        taxable   = unit_price * qty
        gst_amt   = round(taxable * gst_rate / 100, 2)
        grand     = taxable + gst_amt
        conn.execute(
            """INSERT INTO quotes(id,rfq_id,vendor_id,version,is_active,
               unit_price,total_amount,gst_rate,gst_amount,grand_total,
               lead_time_days,validity_date,notes,status,submitted_at,updated_at)
               VALUES(?,?,?,1,1,?,?,?,?,?,?,?,?,?,?,?)""",
            (qid, rfq_id, vendor_id, unit_price, taxable, gst_rate, gst_amt, grand,
             21, ts(30), "Standard terms and conditions apply.",
             status, ts(-10), ts())
        )

conn.commit()
print(f"  Quotes: {len(quotes_data)} inserted")


# ─────────────────────────────────────────────────────────────────────────────
# 10. PURCHASE ORDERS
# ─────────────────────────────────────────────────────────────────────────────

pos_data = [
    # id, po_number, rfq_id, quote_id, vendor_id, status
    (PO1, seq("PO", 1), RFQ2, Q3, V1, "grn_received",  "Caustic Soda Flakes",  200.0, "MT", 8800.0, 18.0),
    (PO2, seq("PO", 2), RFQ1, Q1, V1, "generated",     "Aluminium Sulphate",   500.0, "MT", 9200.0, 18.0),
]

for p in pos_data:
    pid, pnum, rfq_id, quote_id, vendor_id, status, item, qty, unit, unit_price, gst_rate = p
    if not conn.execute("SELECT id FROM purchase_orders WHERE po_number=?", (pnum,)).fetchone():
        taxable = unit_price * qty
        gst_amt = round(taxable * gst_rate / 100, 2)
        grand   = taxable + gst_amt
        conn.execute(
            """INSERT INTO purchase_orders(id,po_number,rfq_id,quote_id,vendor_id,
               item_description,quantity,quantity_unit,unit_price,total_amount,
               gst_rate,gst_amount,grand_total,delivery_location,delivery_deadline,
               status,created_by,is_deleted,created_at,updated_at)
               VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)""",
            (pid, pnum, rfq_id, quote_id, vendor_id,
             item, qty, unit, unit_price, taxable, gst_rate, gst_amt, grand,
             "Tarapur Plant, Maharashtra", ts(30),
             status, U_ADMIN, ts(-5), ts())
        )

conn.commit()
print(f"  Purchase Orders: {len(pos_data)} inserted")

# Re-resolve PO IDs from DB
def _uid_for_po(num):
    row = conn.execute("SELECT id FROM purchase_orders WHERE po_number=?", (num,)).fetchone()
    return row["id"] if row else None

PO1 = _uid_for_po(seq("PO", 1)) or PO1
PO2 = _uid_for_po(seq("PO", 2)) or PO2


# ─────────────────────────────────────────────────────────────────────────────
# 10b. GRN  (goods receipt for PO1)
# ─────────────────────────────────────────────────────────────────────────────

if not conn.execute("SELECT id FROM grns WHERE grn_number=?", (seq("GRN", 1),)).fetchone():
    conn.execute(
        """INSERT INTO grns(id,grn_number,po_id,vendor_id,qty_ordered,qty_received,
           quality_status,rejection_reason,received_by,received_at,created_at,updated_at)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""",
        (GRN1, seq("GRN", 1), PO1, V1, 200.0, 195.0,
         "partial", "5 MT damaged in transit",
         U_ADMIN, ts(-3), ts(-3), ts(-3))
    )
    conn.commit()
print("  GRNs: 1 inserted")

# Re-resolve GRN ID from DB
_grn_row = conn.execute("SELECT id FROM grns WHERE grn_number=?", (seq("GRN", 1),)).fetchone()
GRN1 = _grn_row["id"] if _grn_row else GRN1


# ─────────────────────────────────────────────────────────────────────────────
# 11. TRIPS  (various lifecycle stages)
# ─────────────────────────────────────────────────────────────────────────────

trips_data = [
    # id, number, status, transporter_id, vehicle_id
    (TR1, seq("TRIP", 1), "assigned",  T1,   None, "Aluminium Sulphate 10MT",   10.0),
    (TR2, seq("TRIP", 2), "in_transit",T1,   VH2,  "Caustic Soda 8MT",          8.0),
    (TR3, seq("TRIP", 3), "delivered", T1,   VH1,  "Ferric Chloride 5MT",       5.0),
]

for t in trips_data:
    tid, tnum, status, trans_id, veh_id, cargo, weight = t
    if not conn.execute("SELECT id FROM trips WHERE trip_number=?", (tnum,)).fetchone():
        now_iso = ts()
        conn.execute(
            """INSERT INTO trips(id,trip_number,route_id,transporter_id,vehicle_id,
               rate_card_id,cargo_description,cargo_weight_tons,status,
               assignment_deadline,assigned_at,accepted_at,in_transit_at,
               delivered_at,pod_uploaded_at,
               posted_by,is_deleted,created_at,updated_at)
               VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)""",
            (tid, tnum, R1, trans_id, veh_id,
             RC1, cargo, weight, status,
             ts(1),
             ts(-2) if status in ("in_transit","delivered","pod_uploaded") else None,
             ts(-2) if status in ("in_transit","delivered","pod_uploaded") else None,
             ts(-1) if status in ("in_transit","delivered","pod_uploaded") else None,
             ts(0)  if status in ("delivered","pod_uploaded") else None,
             ts(0)  if status == "pod_uploaded" else None,
             U_ADMIN, ts(-3), ts())
        )

conn.commit()
print(f"  Trips: {len(trips_data)} inserted")

# Re-resolve trip IDs from DB
def _uid_for_trip(num):
    row = conn.execute("SELECT id FROM trips WHERE trip_number=?", (num,)).fetchone()
    return row["id"] if row else None

TR1 = _uid_for_trip(seq("TRIP", 1)) or TR1
TR2 = _uid_for_trip(seq("TRIP", 2)) or TR2
TR3 = _uid_for_trip(seq("TRIP", 3)) or TR3


# ─────────────────────────────────────────────────────────────────────────────
# 12. INVOICES
# ─────────────────────────────────────────────────────────────────────────────

invoices_data = [
    # id, ref, party_type, party_id, linked_po/trip, taxable, gst, status
    (INV1, "KC/2026/INV/001", "vendor",      V1, PO1, None, None,  1760000.0, 316800.0, "approved"),
    (INV2, "KC/2026/INV/002", "vendor",      V1, PO2, None, None,   460000.0,  82800.0, "submitted"),
    (INV3, "SL/2026/INV/001", "transporter", T1, None, None, TR2,    18700.0,   3366.0, "submitted"),
]

for inv in invoices_data:
    iid, ref, ptype, party_id, po_id, grn_id, trip_id, taxable, total_gst, status = inv
    if not conn.execute("SELECT id FROM invoices WHERE id=?", (iid,)).fetchone():
        conn.execute(
            """INSERT INTO invoices(id,invoice_ref,invoice_date,party_type,party_id,
               linked_po_id,linked_grn_id,linked_trip_id,
               invoice_pdf_path,gstin,taxable_amount,cgst_amount,sgst_amount,igst_amount,
               total_gst,grand_total,status,submitted_at,created_at,updated_at)
               VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (iid, ref, ts(-3).split("T")[0], ptype, party_id,
             po_id, grn_id, trip_id,
             f"uploads/invoices/{iid}/invoice.pdf",
             "27AAACK1234A1Z5" if ptype == "vendor" else "27AABCS1234C1Z4",
             taxable,
             round(total_gst / 2, 2),   # CGST
             round(total_gst / 2, 2),   # SGST
             0.0,                        # IGST
             total_gst,
             taxable + total_gst,
             status,
             ts(-3), ts(), ts())
        )

conn.commit()
print(f"  Invoices: {len(invoices_data)} inserted")


# ─────────────────────────────────────────────────────────────────────────────
# 13. PAYMENT (for approved invoice)
# ─────────────────────────────────────────────────────────────────────────────

pay_id = uid()
if not conn.execute("SELECT id FROM payments WHERE invoice_id=?", (INV1,)).fetchone():
    conn.execute(
        """INSERT INTO payments(id,invoice_id,payment_amount,payment_date,
           utr_number,payment_mode,recorded_by,notes,created_at)
           VALUES(?,?,?,?,?,?,?,?,?)""",
        (pay_id, INV1, 2076800.0, ts(-1).split("T")[0],
         "UTR2026062500001", "NEFT", U_ADMIN,
         f"Full payment against PO-{Y}-001", ts())
    )
    conn.commit()
    print("  Payments: 1 inserted")

# Update invoice to paid
conn.execute("UPDATE invoices SET status='paid' WHERE id=?", (INV1,))
conn.commit()


# ─────────────────────────────────────────────────────────────────────────────
# 14. NOTIFICATIONS (sample)
# ─────────────────────────────────────────────────────────────────────────────

notifs = [
    (U_VENDOR1, "PO Acknowledged",     "Your PO-2026-001 has been acknowledged successfully.", "po",       "vendor"),
    (U_VENDOR1, "Payment Received",    "Payment of ₹20,76,800 credited for invoice KC/2026/INV/001.", "payment", "vendor"),
    (U_TRANS1,  "Trip Assigned",       f"Trip TRIP-{Y}-001 has been assigned to you. Please accept within 4 hours.", "trip", "transporter"),
    (U_ADMIN,   "New Registration",    "Bharat Freight Services has submitted registration for review.", "registration", "admin"),
    (U_ADMIN,   "Invoice Submitted",   "Vendor invoice KC/2026/INV/002 submitted for approval.", "invoice", "admin"),
]

for uid_, title, body, event, channel in notifs:
    if not conn.execute("SELECT id FROM notifications WHERE user_id=? AND title=?", (uid_, title)).fetchone():
        conn.execute(
            """INSERT INTO notifications(id,user_id,title,body,channel,event_type,
               is_read,sent_at,created_at) VALUES(?,?,?,?,?,?,0,?,?)""",
            (uid(), uid_, title, body, channel, event, ts(-1), ts())
        )

conn.commit()
print(f"  Notifications: {len(notifs)} inserted")


# ─────────────────────────────────────────────────────────────────────────────
# 15. AUDIT LOGS (sample admin actions)
# ─────────────────────────────────────────────────────────────────────────────

import json as _json

audit_entries = [
    (uid(), U_ADMIN, 'vendor',      V1,   'approved', _json.dumps({"status": "submitted"}),  _json.dumps({"status": "approved"}),  ts(-30)),
    (uid(), U_ADMIN, 'transporter', T1,   'approved', _json.dumps({"status": "submitted"}),  _json.dumps({"status": "approved"}),  ts(-45)),
    (uid(), U_ADMIN, 'rfq',         RFQ2, 'awarded',  _json.dumps({"status": "published"}),  _json.dumps({"status": "awarded"}),   ts(-5)),
    (uid(), U_ADMIN, 'invoice',     INV1, 'approved', _json.dumps({"status": "submitted"}),  _json.dumps({"status": "approved"}),  ts(-2)),
]

for aid, actor, etype, eid, action, before_, after_, created in audit_entries:
    if not conn.execute("SELECT id FROM audit_logs WHERE id=?", (aid,)).fetchone():
        conn.execute(
            """INSERT INTO audit_logs(id,actor_user_id,entity_type,entity_id,
               action,before_state,after_state,created_at)
               VALUES(?,?,?,?,?,?,?,?)""",
            (aid, actor, etype, eid, action, before_, after_, created)
        )

conn.commit()
print(f"  Audit logs: {len(audit_entries)} inserted")


# ─────────────────────────────────────────────────────────────────────────────
# Done
# ─────────────────────────────────────────────────────────────────────────────

print()
print("=" * 60)
print("SEED COMPLETE — Login tokens (set as 'portal_session' cookie)")
print("=" * 60)
print()
print(f"  Super Admin    → token: {SES_ADMIN}")
print(f"    URL:  http://localhost:5000/admin")
print()
print(f"  Vendor 1 (Krishna Chemicals — APPROVED)")
print(f"           → token: {SES_VENDOR1}")
print(f"    URL:  http://localhost:5000/vendor")
print()
print(f"  Vendor 2 (Shiva Shakti — UNDER REVIEW)")
print(f"           → token: {SES_VENDOR2}")
print(f"    URL:  http://localhost:5000/vendor")
print()
print(f"  Transporter 1 (Speed Logistics — APPROVED)")
print(f"           → token: {SES_TRANS1}")
print(f"    URL:  http://localhost:5000/transporter")
print()
print(f"  Transporter 2 (Bharat Freight — PENDING)")
print(f"           → token: {SES_TRANS2}")
print(f"    URL:  http://localhost:5000/transporter")
print()
print("To set the session cookie in Chrome DevTools:")
print("  1. Open DevTools → Application → Cookies → localhost")
print("  2. Add cookie: Name=portal_session  Value=<token above>")
print("  3. Reload the page")
print()

conn.close()
