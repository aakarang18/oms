import sqlite3
import os

DB_PATH = os.environ.get("PORTAL_DB", "portal.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()
    c.executescript("""
-- ============================================================
-- USERS & AUTH
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    mobile          TEXT UNIQUE NOT NULL,
    email           TEXT UNIQUE,
    password_hash   TEXT,
    role            TEXT NOT NULL,
    entity_type     TEXT,
    entity_id       TEXT,
    is_active       INTEGER NOT NULL DEFAULT 1,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until    TEXT,
    last_login_at   TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS otp_tokens (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id),
    otp_hash    TEXT NOT NULL,
    purpose     TEXT NOT NULL,
    expires_at  TEXT NOT NULL,
    used        INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id),
    ip_address  TEXT,
    user_agent  TEXT,
    expires_at  TEXT NOT NULL,
    created_at  TEXT NOT NULL
);

-- ============================================================
-- VENDORS
-- ============================================================
CREATE TABLE IF NOT EXISTS vendors (
    id                      TEXT PRIMARY KEY,
    company_name            TEXT NOT NULL,
    gstin                   TEXT UNIQUE NOT NULL,
    pan_number              TEXT UNIQUE NOT NULL,
    company_type            TEXT NOT NULL,
    msme_registered         INTEGER NOT NULL DEFAULT 0,
    msme_reg_number         TEXT,
    year_established        INTEGER,
    num_employees           INTEGER,
    annual_turnover_range   TEXT,
    reg_addr_line1          TEXT,
    reg_addr_line2          TEXT,
    reg_addr_city           TEXT,
    reg_addr_state          TEXT,
    reg_addr_pin            TEXT,
    reg_addr_country        TEXT DEFAULT 'India',
    factory_addr_line1      TEXT,
    factory_addr_line2      TEXT,
    factory_addr_city       TEXT,
    factory_addr_state      TEXT,
    factory_addr_pin        TEXT,
    factory_addr_country    TEXT,
    contact_name            TEXT,
    contact_designation     TEXT,
    contact_mobile          TEXT,
    contact_email           TEXT,
    bank_account_holder     TEXT,
    bank_account_number     TEXT,
    bank_ifsc               TEXT,
    bank_name               TEXT,
    bank_account_type       TEXT,
    status                  TEXT NOT NULL DEFAULT 'draft',
    rejection_reason        TEXT,
    info_request_note       TEXT,
    approved_by             TEXT REFERENCES users(id),
    approved_at             TEXT,
    registration_step       INTEGER NOT NULL DEFAULT 1,
    draft_expires_at        TEXT,
    rating                  REAL DEFAULT 0,
    is_deleted              INTEGER NOT NULL DEFAULT 0,
    created_at              TEXT NOT NULL,
    updated_at              TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vendor_categories (
    id          TEXT PRIMARY KEY,
    vendor_id   TEXT NOT NULL REFERENCES vendors(id),
    category    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vendor_products (
    id           TEXT PRIMARY KEY,
    vendor_id    TEXT NOT NULL REFERENCES vendors(id),
    product_name TEXT NOT NULL,
    description  TEXT
);

CREATE TABLE IF NOT EXISTS vendor_documents (
    id              TEXT PRIMARY KEY,
    vendor_id       TEXT NOT NULL REFERENCES vendors(id),
    doc_type        TEXT NOT NULL,
    file_path       TEXT NOT NULL,
    file_name       TEXT NOT NULL,
    file_size_bytes INTEGER,
    is_mandatory    INTEGER NOT NULL DEFAULT 1,
    expiry_date     TEXT,
    expiry_status   TEXT DEFAULT 'ok',
    uploaded_at     TEXT NOT NULL,
    is_deleted      INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- TRANSPORTERS
-- ============================================================
CREATE TABLE IF NOT EXISTS transporters (
    id                      TEXT PRIMARY KEY,
    company_name            TEXT NOT NULL,
    gstin                   TEXT UNIQUE NOT NULL,
    pan_number              TEXT UNIQUE NOT NULL,
    company_type            TEXT NOT NULL,
    msme_registered         INTEGER NOT NULL DEFAULT 0,
    msme_reg_number         TEXT,
    year_established        INTEGER,
    num_employees           INTEGER,
    annual_turnover_range   TEXT,
    reg_addr_line1          TEXT,
    reg_addr_line2          TEXT,
    reg_addr_city           TEXT,
    reg_addr_state          TEXT,
    reg_addr_pin            TEXT,
    reg_addr_country        TEXT DEFAULT 'India',
    contact_name            TEXT,
    contact_designation     TEXT,
    contact_mobile          TEXT,
    contact_email           TEXT,
    bank_account_holder     TEXT,
    bank_account_number     TEXT,
    bank_ifsc               TEXT,
    bank_name               TEXT,
    bank_account_type       TEXT,
    status                  TEXT NOT NULL DEFAULT 'draft',
    rejection_reason        TEXT,
    info_request_note       TEXT,
    approved_by             TEXT REFERENCES users(id),
    approved_at             TEXT,
    registration_step       INTEGER NOT NULL DEFAULT 1,
    draft_expires_at        TEXT,
    rating                  REAL DEFAULT 0,
    is_deleted              INTEGER NOT NULL DEFAULT 0,
    created_at              TEXT NOT NULL,
    updated_at              TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transporter_documents (
    id              TEXT PRIMARY KEY,
    transporter_id  TEXT NOT NULL REFERENCES transporters(id),
    doc_type        TEXT NOT NULL,
    file_path       TEXT NOT NULL,
    file_name       TEXT NOT NULL,
    file_size_bytes INTEGER,
    is_mandatory    INTEGER NOT NULL DEFAULT 1,
    expiry_date     TEXT,
    expiry_status   TEXT DEFAULT 'ok',
    uploaded_at     TEXT NOT NULL,
    is_deleted      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS vehicles (
    id                      TEXT PRIMARY KEY,
    transporter_id          TEXT NOT NULL REFERENCES transporters(id),
    reg_number              TEXT UNIQUE NOT NULL,
    vehicle_type            TEXT NOT NULL,
    capacity_tons           REAL,
    year_of_manufacture     INTEGER,
    status                  TEXT NOT NULL DEFAULT 'available',
    driver_name             TEXT,
    driver_license_number   TEXT,
    driver_license_expiry   TEXT,
    is_deleted              INTEGER NOT NULL DEFAULT 0,
    created_at              TEXT NOT NULL,
    updated_at              TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vehicle_documents (
    id              TEXT PRIMARY KEY,
    vehicle_id      TEXT NOT NULL REFERENCES vehicles(id),
    doc_type        TEXT NOT NULL,
    file_path       TEXT NOT NULL,
    file_name       TEXT NOT NULL,
    file_size_bytes INTEGER,
    expiry_date     TEXT,
    expiry_status   TEXT DEFAULT 'ok',
    uploaded_at     TEXT NOT NULL,
    is_deleted      INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- RFQ & QUOTATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS rfqs (
    id                  TEXT PRIMARY KEY,
    rfq_number          TEXT UNIQUE NOT NULL,
    title               TEXT NOT NULL,
    description         TEXT,
    item_specs          TEXT,
    quantity            REAL NOT NULL,
    quantity_unit       TEXT,
    delivery_location   TEXT NOT NULL,
    delivery_deadline   TEXT NOT NULL,
    submission_deadline TEXT NOT NULL,
    target_type         TEXT NOT NULL DEFAULT 'open',
    estimated_value     REAL,
    terms_conditions    TEXT,
    status              TEXT NOT NULL DEFAULT 'draft',
    category            TEXT,
    created_by          TEXT NOT NULL REFERENCES users(id),
    awarded_to_vendor   TEXT REFERENCES vendors(id),
    awarded_at          TEXT,
    is_deleted          INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rfq_attachments (
    id          TEXT PRIMARY KEY,
    rfq_id      TEXT NOT NULL REFERENCES rfqs(id),
    file_path   TEXT NOT NULL,
    file_name   TEXT NOT NULL,
    uploaded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rfq_targeted_vendors (
    id        TEXT PRIMARY KEY,
    rfq_id    TEXT NOT NULL REFERENCES rfqs(id),
    vendor_id TEXT NOT NULL REFERENCES vendors(id)
);

CREATE TABLE IF NOT EXISTS quotes (
    id              TEXT PRIMARY KEY,
    rfq_id          TEXT NOT NULL REFERENCES rfqs(id),
    vendor_id       TEXT NOT NULL REFERENCES vendors(id),
    version         INTEGER NOT NULL DEFAULT 1,
    is_active       INTEGER NOT NULL DEFAULT 1,
    unit_price      REAL NOT NULL,
    total_amount    REAL NOT NULL,
    gst_rate        REAL NOT NULL,
    gst_amount      REAL NOT NULL,
    grand_total     REAL NOT NULL,
    lead_time_days  INTEGER NOT NULL,
    validity_date   TEXT NOT NULL,
    notes           TEXT,
    status          TEXT NOT NULL DEFAULT 'submitted',
    submitted_at    TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quote_attachments (
    id          TEXT PRIMARY KEY,
    quote_id    TEXT NOT NULL REFERENCES quotes(id),
    file_path   TEXT NOT NULL,
    file_name   TEXT NOT NULL,
    uploaded_at TEXT NOT NULL
);

-- ============================================================
-- PURCHASE ORDERS & GRN
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_orders (
    id                  TEXT PRIMARY KEY,
    po_number           TEXT UNIQUE NOT NULL,
    rfq_id              TEXT NOT NULL REFERENCES rfqs(id),
    quote_id            TEXT NOT NULL REFERENCES quotes(id),
    vendor_id           TEXT NOT NULL REFERENCES vendors(id),
    item_description    TEXT NOT NULL,
    quantity            REAL NOT NULL,
    quantity_unit       TEXT,
    unit_price          REAL NOT NULL,
    total_amount        REAL NOT NULL,
    gst_rate            REAL NOT NULL,
    gst_amount          REAL NOT NULL,
    grand_total         REAL NOT NULL,
    delivery_location   TEXT NOT NULL,
    delivery_deadline   TEXT NOT NULL,
    terms_conditions    TEXT,
    status              TEXT NOT NULL DEFAULT 'generated',
    pdf_path            TEXT,
    acknowledged_at     TEXT,
    dispatch_transport  TEXT,
    dispatch_lr_number  TEXT,
    dispatched_at       TEXT,
    created_by          TEXT NOT NULL REFERENCES users(id),
    is_deleted          INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS grns (
    id              TEXT PRIMARY KEY,
    grn_number      TEXT UNIQUE NOT NULL,
    po_id           TEXT NOT NULL REFERENCES purchase_orders(id),
    vendor_id       TEXT NOT NULL REFERENCES vendors(id),
    qty_ordered     REAL NOT NULL,
    qty_received    REAL NOT NULL,
    quality_status  TEXT NOT NULL,
    rejection_reason TEXT,
    received_by     TEXT NOT NULL REFERENCES users(id),
    received_at     TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

-- ============================================================
-- ROUTES & RATE CARDS
-- ============================================================
CREATE TABLE IF NOT EXISTS routes (
    id                  TEXT PRIMARY KEY,
    route_code          TEXT UNIQUE NOT NULL,
    origin_city         TEXT NOT NULL,
    origin_state        TEXT NOT NULL,
    destination_city    TEXT NOT NULL,
    destination_state   TEXT NOT NULL,
    distance_km         REAL,
    route_type          TEXT NOT NULL DEFAULT 'Road',
    is_active           INTEGER NOT NULL DEFAULT 1,
    created_by          TEXT NOT NULL REFERENCES users(id),
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_cards (
    id                  TEXT PRIMARY KEY,
    transporter_id      TEXT NOT NULL REFERENCES transporters(id),
    route_id            TEXT NOT NULL REFERENCES routes(id),
    vehicle_type        TEXT NOT NULL,
    rate_per_km         REAL,
    rate_per_ton        REAL,
    minimum_charge      REAL,
    valid_from          TEXT NOT NULL,
    valid_until         TEXT NOT NULL,
    justification_doc   TEXT,
    status              TEXT NOT NULL DEFAULT 'pending',
    reviewed_by         TEXT REFERENCES users(id),
    reviewed_at         TEXT,
    rejection_reason    TEXT,
    is_deleted          INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
);

-- ============================================================
-- TRIPS
-- ============================================================
CREATE TABLE IF NOT EXISTS trips (
    id                  TEXT PRIMARY KEY,
    trip_number         TEXT UNIQUE NOT NULL,
    route_id            TEXT NOT NULL REFERENCES routes(id),
    transporter_id      TEXT REFERENCES transporters(id),
    vehicle_id          TEXT REFERENCES vehicles(id),
    rate_card_id        TEXT REFERENCES rate_cards(id),
    cargo_description   TEXT,
    cargo_weight_tons   REAL,
    po_id               TEXT REFERENCES purchase_orders(id),
    status              TEXT NOT NULL DEFAULT 'posted',
    assignment_deadline TEXT,
    assigned_at         TEXT,
    accepted_at         TEXT,
    loaded_at           TEXT,
    in_transit_at       TEXT,
    delivered_at        TEXT,
    pod_file_path       TEXT,
    pod_delivered_qty   REAL,
    pod_notes           TEXT,
    pod_uploaded_at     TEXT,
    posted_by           TEXT NOT NULL REFERENCES users(id),
    is_deleted          INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trip_decline_log (
    id              TEXT PRIMARY KEY,
    trip_id         TEXT NOT NULL REFERENCES trips(id),
    transporter_id  TEXT NOT NULL REFERENCES transporters(id),
    declined_at     TEXT NOT NULL,
    reason          TEXT
);

-- ============================================================
-- INVOICES & PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
    id                  TEXT PRIMARY KEY,
    invoice_ref         TEXT NOT NULL,
    invoice_date        TEXT NOT NULL,
    party_type          TEXT NOT NULL,
    party_id            TEXT NOT NULL,
    linked_po_id        TEXT REFERENCES purchase_orders(id),
    linked_grn_id       TEXT REFERENCES grns(id),
    linked_trip_id      TEXT REFERENCES trips(id),
    invoice_pdf_path    TEXT NOT NULL,
    gstin               TEXT,
    hsn_codes           TEXT,
    line_items_json     TEXT,
    taxable_amount      REAL NOT NULL,
    cgst_amount         REAL DEFAULT 0,
    sgst_amount         REAL DEFAULT 0,
    igst_amount         REAL DEFAULT 0,
    total_gst           REAL NOT NULL,
    grand_total         REAL NOT NULL,
    status              TEXT NOT NULL DEFAULT 'submitted',
    rejection_reason    TEXT,
    reviewed_by         TEXT REFERENCES users(id),
    reviewed_at         TEXT,
    submitted_at        TEXT NOT NULL,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
    id              TEXT PRIMARY KEY,
    invoice_id      TEXT NOT NULL REFERENCES invoices(id),
    payment_amount  REAL NOT NULL,
    payment_date    TEXT NOT NULL,
    utr_number      TEXT NOT NULL,
    payment_mode    TEXT NOT NULL,
    recorded_by     TEXT NOT NULL REFERENCES users(id),
    notes           TEXT,
    created_at      TEXT NOT NULL
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id),
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    channel     TEXT NOT NULL,
    event_type  TEXT NOT NULL,
    entity_type TEXT,
    entity_id   TEXT,
    is_read     INTEGER NOT NULL DEFAULT 0,
    sent_at     TEXT,
    created_at  TEXT NOT NULL
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id            TEXT PRIMARY KEY,
    actor_user_id TEXT NOT NULL REFERENCES users(id),
    entity_type   TEXT NOT NULL,
    entity_id     TEXT NOT NULL,
    action        TEXT NOT NULL,
    before_state  TEXT,
    after_state   TEXT,
    ip_address    TEXT,
    user_agent    TEXT,
    created_at    TEXT NOT NULL
);

-- ============================================================
-- SEQUENCE COUNTERS
-- ============================================================
CREATE TABLE IF NOT EXISTS sequence_counters (
    prefix   TEXT PRIMARY KEY,
    year     INTEGER NOT NULL,
    last_seq INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_mobile         ON users(mobile);
CREATE INDEX IF NOT EXISTS idx_users_entity         ON users(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user        ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_user             ON otp_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_vendors_status       ON vendors(status);
CREATE INDEX IF NOT EXISTS idx_transporters_status  ON transporters(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_transporter ON vehicles(transporter_id);
CREATE INDEX IF NOT EXISTS idx_rfqs_status          ON rfqs(status);
CREATE INDEX IF NOT EXISTS idx_quotes_rfq           ON quotes(rfq_id, vendor_id, is_active);
CREATE INDEX IF NOT EXISTS idx_pos_vendor           ON purchase_orders(vendor_id, status);
CREATE INDEX IF NOT EXISTS idx_trips_status         ON trips(status, transporter_id);
CREATE INDEX IF NOT EXISTS idx_invoices_party       ON invoices(party_type, party_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_user   ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_audit_entity         ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor          ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_vdocs_expiry         ON vendor_documents(expiry_status, expiry_date);
CREATE INDEX IF NOT EXISTS idx_tdocs_expiry         ON transporter_documents(expiry_status, expiry_date);
CREATE INDEX IF NOT EXISTS idx_vedocs_expiry        ON vehicle_documents(expiry_status, expiry_date);
""")
    conn.commit()
    conn.close()


if __name__ == '__main__':
    init_db()
    print(f"Database initialised at {DB_PATH}")


def next_sequence(prefix: str) -> str:
    """Generate auto-incremented number like RFQ-2026-001."""
    from datetime import datetime
    year = datetime.utcnow().year
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT last_seq FROM sequence_counters WHERE prefix=? AND year=?",
            (prefix, year)
        ).fetchone()
        if row:
            seq = row["last_seq"] + 1
            conn.execute(
                "UPDATE sequence_counters SET last_seq=? WHERE prefix=? AND year=?",
                (seq, prefix, year)
            )
        else:
            seq = 1
            conn.execute(
                "INSERT INTO sequence_counters(prefix,year,last_seq) VALUES(?,?,1)",
                (prefix, year)
            )
        conn.commit()
        return f"{prefix}-{year}-{seq:03d}"
    finally:
        conn.close()
