"""Vendor-facing RFQ and Quotation endpoints."""
from flask import Blueprint, jsonify, request, g
from database import get_db
from auth import vendor_required, new_id, audit
from datetime import datetime

bp = Blueprint('rfq', __name__)


@bp.get('/api/vendor/rfqs')
@vendor_required
def list_vendor_rfqs():
    vendor_id = g.user['entity_id']
    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT r.id, r.rfq_number, r.title, r.description, r.quantity, r.quantity_unit,
                   r.delivery_location, r.delivery_deadline, r.submission_deadline,
                   r.category, r.status, r.target_type, r.created_at,
                   (SELECT q.id FROM quotes q
                    WHERE q.rfq_id=r.id AND q.vendor_id=? AND q.is_active=1 LIMIT 1) AS my_quote_id,
                   (SELECT q.status FROM quotes q
                    WHERE q.rfq_id=r.id AND q.vendor_id=? AND q.is_active=1 LIMIT 1) AS my_quote_status,
                   (SELECT q.grand_total FROM quotes q
                    WHERE q.rfq_id=r.id AND q.vendor_id=? AND q.is_active=1 LIMIT 1) AS my_quote_total
            FROM rfqs r
            WHERE r.status='published' AND r.is_deleted=0
              AND (r.target_type='open'
                   OR EXISTS(SELECT 1 FROM rfq_targeted_vendors
                             WHERE rfq_id=r.id AND vendor_id=?))
            ORDER BY r.submission_deadline ASC
        """, (vendor_id, vendor_id, vendor_id, vendor_id)).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()


@bp.get('/api/vendor/rfqs/<rfq_id>')
@vendor_required
def get_vendor_rfq(rfq_id):
    vendor_id = g.user['entity_id']
    conn = get_db()
    try:
        r = conn.execute("""
            SELECT r.*,
                   (SELECT q.id FROM quotes q
                    WHERE q.rfq_id=r.id AND q.vendor_id=? AND q.is_active=1 LIMIT 1) AS my_quote_id
            FROM rfqs r WHERE r.id=? AND r.is_deleted=0
        """, (vendor_id, rfq_id)).fetchone()
        if not r:
            return jsonify({'error': 'RFQ not found'}), 404
        rfq = dict(r)
        if rfq['status'] != 'published':
            return jsonify({'error': 'RFQ is not open for submission'}), 403
        if rfq['target_type'] == 'targeted':
            tv = conn.execute(
                'SELECT 1 FROM rfq_targeted_vendors WHERE rfq_id=? AND vendor_id=?',
                (rfq_id, vendor_id)).fetchone()
            if not tv:
                return jsonify({'error': 'You are not invited to this RFQ'}), 403
        if rfq['my_quote_id']:
            q = conn.execute('SELECT * FROM quotes WHERE id=?', (rfq['my_quote_id'],)).fetchone()
            rfq['my_quote'] = dict(q) if q else None
        else:
            rfq['my_quote'] = None
        return jsonify(rfq)
    finally:
        conn.close()


@bp.post('/api/vendor/rfqs/<rfq_id>/quote')
@vendor_required
def submit_quote(rfq_id):
    vendor_id = g.user['entity_id']
    data = request.get_json(silent=True) or {}
    unit_price = data.get('unit_price')
    gst_rate   = float(data.get('gst_rate', 18))
    lead_time  = data.get('lead_time_days')
    validity   = (data.get('validity_date') or '').strip()
    notes      = (data.get('notes') or '').strip()

    if unit_price is None or not lead_time or not validity:
        return jsonify({'error': 'unit_price, lead_time_days and validity_date are required'}), 400

    conn = get_db()
    try:
        rfq = conn.execute(
            "SELECT * FROM rfqs WHERE id=? AND status='published' AND is_deleted=0", (rfq_id,)
        ).fetchone()
        if not rfq:
            return jsonify({'error': 'RFQ not found or not open'}), 404
        now = datetime.utcnow().isoformat()
        if now > rfq['submission_deadline']:
            return jsonify({'error': 'Submission deadline has passed'}), 400

        total_amount = float(unit_price) * float(rfq['quantity'])
        gst_amount   = round(total_amount * gst_rate / 100, 2)
        grand_total  = round(total_amount + gst_amount, 2)

        existing = conn.execute(
            'SELECT id, version FROM quotes WHERE rfq_id=? AND vendor_id=? AND is_active=1',
            (rfq_id, vendor_id)).fetchone()
        version = (existing['version'] + 1) if existing else 1
        if existing:
            conn.execute('UPDATE quotes SET is_active=0 WHERE id=?', (existing['id'],))

        qid = new_id()
        conn.execute("""
            INSERT INTO quotes(id,rfq_id,vendor_id,version,is_active,unit_price,total_amount,
                gst_rate,gst_amount,grand_total,lead_time_days,validity_date,notes,
                status,submitted_at,updated_at)
            VALUES(?,?,?,?,1,?,?,?,?,?,?,?,?,'submitted',?,?)
        """, (qid, rfq_id, vendor_id, version, unit_price, total_amount,
              gst_rate, gst_amount, grand_total, lead_time, validity, notes, now, now))
        conn.commit()
        audit(g.user['id'], 'quote', qid, 'submit', None,
              {'rfq_id': rfq_id, 'grand_total': grand_total})
        return jsonify({'id': qid, 'grand_total': grand_total, 'message': 'Quote submitted'})
    finally:
        conn.close()


@bp.get('/api/vendor/quotes')
@vendor_required
def list_vendor_quotes():
    vendor_id = g.user['entity_id']
    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT q.id, q.rfq_id, q.version, q.unit_price, q.total_amount,
                   q.gst_rate, q.gst_amount, q.grand_total, q.lead_time_days,
                   q.validity_date, q.notes, q.status, q.submitted_at,
                   r.rfq_number, r.title, r.quantity, r.quantity_unit,
                   r.status AS rfq_status, r.delivery_deadline
            FROM quotes q
            JOIN rfqs r ON q.rfq_id=r.id
            WHERE q.vendor_id=? AND q.is_active=1
            ORDER BY q.submitted_at DESC
        """, (vendor_id,)).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()
