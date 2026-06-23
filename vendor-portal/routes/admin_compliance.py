"""
Admin Compliance — document expiry dashboard across vendors, transporters, vehicles.
"""
from flask import Blueprint, request, jsonify

from database import get_db
from auth import admin_required

bp = Blueprint("admin_compliance", __name__)


@bp.get("/api/admin/compliance")
@admin_required
def get_compliance():
    status = request.args.get("status", "expired")  # expired | expiring_soon | valid

    if status == "expired":
        statuses = ("expired",)
    elif status == "expiring_soon":
        statuses = ("expiring_30", "expiring_15", "expiring_7")
    else:
        statuses = ("ok",)

    placeholders = ",".join("?" * len(statuses))

    with get_db() as conn:
        vendor_docs = conn.execute(
            f"""SELECT vd.id, 'vendor' AS entity_type,
                       v.company_name AS entity_name, v.id AS entity_id,
                       vd.doc_type, vd.file_name, vd.expiry_date, vd.expiry_status,
                       vd.is_mandatory
                FROM vendor_documents vd
                JOIN vendors v ON v.id = vd.vendor_id
                WHERE vd.is_deleted=0 AND vd.expiry_status IN ({placeholders})
                ORDER BY vd.expiry_date ASC NULLS LAST""",
            statuses,
        ).fetchall()

        trans_docs = conn.execute(
            f"""SELECT td.id, 'transporter' AS entity_type,
                       t.company_name AS entity_name, t.id AS entity_id,
                       td.doc_type, td.file_name, td.expiry_date, td.expiry_status,
                       1 AS is_mandatory
                FROM transporter_documents td
                JOIN transporters t ON t.id = td.transporter_id
                WHERE td.is_deleted=0 AND td.expiry_status IN ({placeholders})
                ORDER BY td.expiry_date ASC NULLS LAST""",
            statuses,
        ).fetchall()

        vehicle_docs = conn.execute(
            f"""SELECT vhd.id, 'vehicle' AS entity_type,
                       COALESCE(t.company_name,'') || ' / ' || vh.registration_number AS entity_name,
                       vh.id AS entity_id,
                       vhd.doc_type, vhd.file_name, vhd.expiry_date, vhd.expiry_status,
                       1 AS is_mandatory
                FROM vehicle_documents vhd
                JOIN vehicles vh ON vh.id = vhd.vehicle_id
                JOIN transporters t ON t.id = vh.transporter_id
                WHERE vhd.is_deleted=0 AND vhd.expiry_status IN ({placeholders})
                ORDER BY vhd.expiry_date ASC NULLS LAST""",
            statuses,
        ).fetchall()

    rows = [dict(r) for r in vendor_docs + trans_docs + vehicle_docs]
    rows.sort(key=lambda r: (r["expiry_date"] or "9999-99-99"))
    return jsonify(rows)
