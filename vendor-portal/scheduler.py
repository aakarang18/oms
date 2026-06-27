"""
APScheduler jobs for document expiry checks and trip timeout enforcement.
Runs daily at 00:30 IST (19:00 UTC previous day).
"""
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz

_scheduler = None


def start_scheduler(app):
    global _scheduler
    _scheduler = BackgroundScheduler(timezone=pytz.utc)

    _scheduler.add_job(
        func=lambda: _run_in_context(app, check_document_expiry),
        trigger=CronTrigger(hour=19, minute=0, timezone=pytz.utc),
        id="doc_expiry_check",
        replace_existing=True,
    )

    _scheduler.add_job(
        func=lambda: _run_in_context(app, check_trip_timeouts),
        trigger=CronTrigger(minute=5, timezone=pytz.utc),
        id="trip_timeout_check",
        replace_existing=True,
    )

    _scheduler.start()
    return _scheduler


def _run_in_context(app, fn):
    with app.app_context():
        fn()


def check_document_expiry():
    from database import get_db
    from datetime import datetime, timedelta
    import uuid

    now = datetime.utcnow().date()
    thresholds = {
        30: "expiring_30",
        15: "expiring_15",
        7:  "expiring_7",
        0:  "expired",
    }

    doc_tables = [
        ("vendor_documents",      "vendor_id",      "vendors"),
        ("transporter_documents", "transporter_id",  "transporters"),
        ("vehicle_documents",     "vehicle_id",      "vehicles"),
    ]

    conn = get_db()
    try:
        for table, fk_col, parent_table in doc_tables:
            rows = conn.execute(
                f"SELECT id, {fk_col}, doc_type, expiry_date FROM {table} "
                f"WHERE expiry_date IS NOT NULL AND is_deleted=0"
            ).fetchall()

            for row in rows:
                expiry = datetime.strptime(row["expiry_date"], "%Y-%m-%d").date()
                days_left = (expiry - now).days

                new_status = "ok"
                for threshold, status in thresholds.items():
                    if days_left <= threshold:
                        new_status = status
                        break

                conn.execute(
                    f"UPDATE {table} SET expiry_status=? WHERE id=?",
                    (new_status, row["id"])
                )

                if new_status != "ok":
                    _queue_expiry_notification(conn, table, row, days_left, new_status)

        conn.execute("""
            UPDATE vehicles SET status='compliance_hold'
            WHERE id IN (
                SELECT vehicle_id FROM vehicle_documents
                WHERE expiry_status='expired' AND is_deleted=0
            ) AND status='available'
        """)

        conn.commit()
        print(f"[Scheduler] Document expiry check completed at {datetime.utcnow()}")
    finally:
        conn.close()


def _queue_expiry_notification(conn, table, row, days_left, status):
    import uuid
    from datetime import datetime

    if days_left == 0:
        title = "Document Expired"
        body = f"Your {row['doc_type'].replace('_', ' ').title()} has expired."
    else:
        title = f"Document Expiring in {days_left} Days"
        body = (f"Your {row['doc_type'].replace('_', ' ').title()} "
                f"expires in {days_left} day(s). Please renew it.")

    if days_left not in (30, 15, 7, 0):
        return

    now = datetime.utcnow().isoformat()

    if table == "vendor_documents":
        users = conn.execute(
            "SELECT id FROM users WHERE entity_type='vendor' AND entity_id=?",
            (row["vendor_id"],)
        ).fetchall()
    elif table == "transporter_documents":
        users = conn.execute(
            "SELECT id FROM users WHERE entity_type='transporter' AND entity_id=?",
            (row["transporter_id"],)
        ).fetchall()
    else:
        v = conn.execute(
            "SELECT transporter_id FROM vehicles WHERE id=?", (row["vehicle_id"],)
        ).fetchone()
        if not v:
            return
        users = conn.execute(
            "SELECT id FROM users WHERE entity_type='transporter' AND entity_id=?",
            (v["transporter_id"],)
        ).fetchall()

    for u in users:
        conn.execute(
            """INSERT INTO notifications(id,user_id,title,body,channel,
               event_type,entity_type,entity_id,is_read,created_at)
               VALUES(?,?,?,?,'in_app','document_expiry',?,?,0,?)""",
            (str(uuid.uuid4()), u["id"], title, body,
             table, row["id"], now)
        )


def check_trip_timeouts():
    from database import get_db
    from datetime import datetime

    conn = get_db()
    try:
        now = datetime.utcnow().isoformat()
        expired = conn.execute(
            """SELECT id FROM trips
               WHERE status='assigned'
               AND assignment_deadline IS NOT NULL
               AND assignment_deadline < ?""",
            (now,)
        ).fetchall()

        for trip in expired:
            conn.execute(
                """UPDATE trips SET status='posted', transporter_id=NULL,
                   vehicle_id=NULL, rate_card_id=NULL, assigned_at=NULL,
                   assignment_deadline=NULL, updated_at=?
                   WHERE id=?""",
                (now, trip["id"])
            )

        if expired:
            conn.commit()
            print(f"[Scheduler] Reset {len(expired)} timed-out trip assignments")
    finally:
        conn.close()
