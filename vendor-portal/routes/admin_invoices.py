from flask import Blueprint, jsonify, g, request
from datetime import datetime
from database import get_db
from auth import admin_required, new_id, audit

bp = Blueprint('admin_invoices', __name__)

NOW = lambda: datetime.utcnow().isoformat()


@bp.get('/api/admin/invoices')
@admin_required
def list_admin_invoices():
    status_filter = request.args.get('status', '')
    party_filter  = request.args.get('party_type', '')
    conn = get_db()
    try:
        q = """
            SELECT i.*,
                   COALESCE(v.company_name, tr.company_name) as party_name,
                   p.po_number,
                   g.grn_number,
                   t.trip_number
            FROM invoices i
            LEFT JOIN vendors v       ON v.id = i.party_id AND i.party_type = 'vendor'
            LEFT JOIN transporters tr ON tr.id = i.party_id AND i.party_type = 'transporter'
            LEFT JOIN purchase_orders p ON p.id = i.linked_po_id
            LEFT JOIN grns g ON g.id = i.linked_grn_id
            LEFT JOIN trips t ON t.id = i.linked_trip_id
            WHERE 1=1
        """
        params = []
        if status_filter:
            q += ' AND i.status=?'
            params.append(status_filter)
        if party_filter:
            q += ' AND i.party_type=?'
            params.append(party_filter)
        q += ' ORDER BY i.submitted_at DESC'
        rows = conn.execute(q, params).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()


@bp.get('/api/admin/invoices/<inv_id>')
@admin_required
def get_admin_invoice(inv_id):
    conn = get_db()
    try:
        row = conn.execute("""
            SELECT i.*,
                   COALESCE(v.company_name, tr.company_name) as party_name,
                   COALESCE(v.contact_email, tr.contact_email) as party_email,
                   p.po_number, p.grand_total as po_value,
                   g.grn_number, g.qty_received as received_qty,
                   t.trip_number,
                   r.origin_city, r.destination_city as dest_city
            FROM invoices i
            LEFT JOIN vendors v       ON v.id = i.party_id AND i.party_type = 'vendor'
            LEFT JOIN transporters tr ON tr.id = i.party_id AND i.party_type = 'transporter'
            LEFT JOIN purchase_orders p ON p.id = i.linked_po_id
            LEFT JOIN grns g ON g.id = i.linked_grn_id
            LEFT JOIN trips t ON t.id = i.linked_trip_id
            LEFT JOIN routes r ON r.id = t.route_id
            WHERE i.id=?
        """, (inv_id,)).fetchone()
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


@bp.post('/api/admin/invoices/<inv_id>/review')
@admin_required
def review_invoice(inv_id):
    data   = request.get_json(silent=True) or {}
    action = (data.get('action') or '').strip()
    reason = (data.get('reason') or '').strip()

    if action not in ('approved', 'rejected'):
        return jsonify({'error': 'action must be approved or rejected'}), 400
    if action == 'rejected' and not reason:
        return jsonify({'error': 'reason required for rejection'}), 400

    conn = get_db()
    try:
        inv = conn.execute("SELECT * FROM invoices WHERE id=?", (inv_id,)).fetchone()
        if not inv:
            return jsonify({'error': 'Not found'}), 404
        if inv['status'] != 'submitted':
            return jsonify({'error': f'Invoice is already {inv["status"]}'}), 409

        now = NOW()
        conn.execute("""
            UPDATE invoices
            SET status=?, rejection_reason=?, reviewed_by=?, reviewed_at=?, updated_at=?
            WHERE id=?
        """, (action, reason if action == 'rejected' else None,
               g.user['id'], now, now, inv_id))
        conn.commit()
        audit(g.user['id'], 'invoice', inv_id, action,
              'submitted', action)
        return jsonify({'id': inv_id, 'status': action})
    finally:
        conn.close()


@bp.get('/api/admin/payments')
@admin_required
def list_admin_payments():
    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT pay.*,
                   i.invoice_ref, i.grand_total, i.party_type, i.party_id,
                   COALESCE(v.company_name, tr.company_name) as party_name
            FROM payments pay
            JOIN invoices i ON i.id = pay.invoice_id
            LEFT JOIN vendors v       ON v.id = i.party_id AND i.party_type = 'vendor'
            LEFT JOIN transporters tr ON tr.id = i.party_id AND i.party_type = 'transporter'
            ORDER BY pay.created_at DESC
        """).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()


@bp.post('/api/admin/payments')
@admin_required
def record_payment():
    data = request.get_json(silent=True) or {}

    invoice_id   = (data.get('invoice_id') or '').strip()
    utr_number   = (data.get('utr_number') or '').strip()
    payment_mode = (data.get('payment_mode') or '').strip()
    payment_date = (data.get('payment_date') or '').strip()
    notes        = (data.get('notes') or '').strip() or None

    try:
        payment_amount = float(data.get('payment_amount', 0))
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid amount'}), 400

    if not invoice_id or not utr_number or not payment_mode or not payment_date:
        return jsonify({'error': 'invoice_id, utr_number, payment_mode, payment_date required'}), 400
    if payment_amount <= 0:
        return jsonify({'error': 'payment_amount must be positive'}), 400

    conn = get_db()
    try:
        inv = conn.execute(
            "SELECT * FROM invoices WHERE id=? AND status='approved'", (invoice_id,)
        ).fetchone()
        if not inv:
            return jsonify({'error': 'Approved invoice not found'}), 404

        pay_id = new_id()
        now = NOW()
        conn.execute("""
            INSERT INTO payments
              (id, invoice_id, payment_amount, payment_date,
               utr_number, payment_mode, recorded_by, notes, created_at)
            VALUES (?,?,?,?, ?,?,?,?,?)
        """, (pay_id, invoice_id, payment_amount, payment_date,
               utr_number, payment_mode, g.user['id'], notes, now))
        # Mark invoice as paid
        conn.execute(
            "UPDATE invoices SET status='paid', updated_at=? WHERE id=?",
            (now, invoice_id)
        )
        conn.commit()
        audit(g.user['id'], 'payment', pay_id, 'record', None, {
            'invoice_id': invoice_id, 'utr_number': utr_number,
            'payment_amount': payment_amount
        })
        return jsonify({'id': pay_id, 'invoice_id': invoice_id, 'status': 'paid'}), 201
    finally:
        conn.close()


@bp.get('/api/admin/invoices-approved')
@admin_required
def list_approved_invoices():
    """Return approved (unpaid) invoices for payment recording dropdown."""
    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT i.id, i.invoice_ref, i.grand_total,
                   i.party_type, i.party_id,
                   COALESCE(v.company_name, tr.company_name) as party_name
            FROM invoices i
            LEFT JOIN vendors v       ON v.id = i.party_id AND i.party_type = 'vendor'
            LEFT JOIN transporters tr ON tr.id = i.party_id AND i.party_type = 'transporter'
            WHERE i.status='approved'
            ORDER BY i.reviewed_at DESC
        """).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()
