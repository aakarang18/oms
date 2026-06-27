from flask import Blueprint, jsonify, g, request
from datetime import datetime
from database import get_db
from auth import transporter_required, new_id, audit

bp = Blueprint('transporter_invoices', __name__)

NOW = lambda: datetime.utcnow().isoformat()


@bp.get('/api/transporter/invoices')
@transporter_required
def list_transporter_invoices():
    trans_id = g.user['entity_id']
    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT i.*,
                   t.trip_number,
                   r.origin_city, r.destination_city as dest_city
            FROM invoices i
            LEFT JOIN trips t ON t.id = i.linked_trip_id
            LEFT JOIN routes r ON r.id = t.route_id
            WHERE i.party_type='transporter' AND i.party_id=?
            ORDER BY i.submitted_at DESC
        """, (trans_id,)).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()


@bp.get('/api/transporter/invoices/<inv_id>')
@transporter_required
def get_transporter_invoice(inv_id):
    trans_id = g.user['entity_id']
    conn = get_db()
    try:
        row = conn.execute("""
            SELECT i.*,
                   t.trip_number, t.pod_delivered_qty,
                   r.origin_city, r.origin_state,
                   r.destination_city as dest_city, r.destination_state as dest_state
            FROM invoices i
            LEFT JOIN trips t ON t.id = i.linked_trip_id
            LEFT JOIN routes r ON r.id = t.route_id
            WHERE i.id=? AND i.party_type='transporter' AND i.party_id=?
        """, (inv_id, trans_id)).fetchone()
        if not row:
            return jsonify({'error': 'Not found'}), 404
        result = dict(row)
        pmts = conn.execute(
            "SELECT * FROM payments WHERE invoice_id=? ORDER BY created_at",
            (inv_id,)
        ).fetchall()
        result['payments'] = [dict(p) for p in pmts]
        return jsonify(result)
    finally:
        conn.close()


@bp.post('/api/transporter/invoices')
@transporter_required
def submit_transporter_invoice():
    trans_id = g.user['entity_id']
    data = request.get_json(silent=True) or {}

    invoice_ref      = (data.get('invoice_ref') or '').strip()
    invoice_date     = (data.get('invoice_date') or '').strip()
    linked_trip_id   = (data.get('linked_trip_id') or '').strip() or None
    invoice_ref_path = (data.get('invoice_ref_path') or '').strip()
    gstin            = (data.get('gstin') or '').strip() or None
    hsn_codes        = (data.get('hsn_codes') or '').strip() or None

    try:
        taxable_amount = float(data.get('taxable_amount', 0))
        cgst_amount    = float(data.get('cgst_amount', 0))
        sgst_amount    = float(data.get('sgst_amount', 0))
        igst_amount    = float(data.get('igst_amount', 0))
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid amount'}), 400

    if not invoice_ref or not invoice_date:
        return jsonify({'error': 'invoice_ref and invoice_date are required'}), 400
    if taxable_amount <= 0:
        return jsonify({'error': 'taxable_amount must be positive'}), 400

    total_gst   = cgst_amount + sgst_amount + igst_amount
    grand_total = taxable_amount + total_gst

    conn = get_db()
    try:
        if linked_trip_id:
            trip = conn.execute(
                "SELECT id FROM trips WHERE id=? AND transporter_id=?",
                (linked_trip_id, trans_id)
            ).fetchone()
            if not trip:
                return jsonify({'error': 'Trip not found'}), 404

        inv_id = new_id()
        now = NOW()
        conn.execute("""
            INSERT INTO invoices
              (id, invoice_ref, invoice_date, party_type, party_id,
               linked_trip_id, invoice_pdf_path,
               gstin, hsn_codes, taxable_amount, cgst_amount,
               sgst_amount, igst_amount, total_gst, grand_total,
               status, submitted_at, created_at, updated_at)
            VALUES (?,?,?,?,?, ?,?, ?,?,?,?, ?,?,?,?, ?,?,?,?)
        """, (inv_id, invoice_ref, invoice_date, 'transporter', trans_id,
              linked_trip_id, invoice_ref_path,
              gstin, hsn_codes, taxable_amount, cgst_amount,
              sgst_amount, igst_amount, total_gst, grand_total,
              'submitted', now, now, now))
        conn.commit()
        audit(g.user['id'], 'invoice', inv_id, 'submit', None, {
            'invoice_ref': invoice_ref, 'grand_total': grand_total
        })
        return jsonify({'id': inv_id, 'status': 'submitted'}), 201
    finally:
        conn.close()


@bp.get('/api/transporter/trips-for-invoice')
@transporter_required
def trips_for_invoice():
    """Return delivered trips that don't have an approved invoice yet."""
    trans_id = g.user['entity_id']
    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT t.id, t.trip_number,
                   t.origin_city, t.origin_state,
                   t.dest_city, t.dest_state,
                   t.pod_delivered_qty
            FROM trips t
            WHERE t.transporter_id=? AND t.status='delivered'
              AND NOT EXISTS (
                SELECT 1 FROM invoices i
                WHERE i.linked_trip_id=t.id
                  AND i.party_type='transporter'
                  AND i.status IN ('submitted','approved')
              )
            ORDER BY t.updated_at DESC
        """, (trans_id,)).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()
