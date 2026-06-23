"""Admin RFQ management endpoints."""
from flask import Blueprint, jsonify, request, g
from database import get_db, next_sequence
from auth import admin_required, new_id, audit
from datetime import datetime

bp = Blueprint('admin_rfq', __name__)


@bp.get('/api/admin/rfqs')
@admin_required
def list_admin_rfqs():
    status = request.args.get('status', '')
    conn = get_db()
    try:
        q = """
            SELECT r.id, r.rfq_number, r.title, r.category, r.quantity, r.quantity_unit,
                   r.delivery_location, r.submission_deadline, r.delivery_deadline,
                   r.status, r.target_type, r.estimated_value, r.created_at,
                   u.mobile AS created_by_mobile,
                   (SELECT COUNT(*) FROM quotes WHERE rfq_id=r.id AND is_active=1) AS quote_count,
                   v.company_name AS awarded_vendor
            FROM rfqs r
            LEFT JOIN users u ON r.created_by=u.id
            LEFT JOIN vendors v ON r.awarded_to_vendor=v.id
            WHERE r.is_deleted=0
        """
        params = []
        if status:
            q += " AND r.status=?"
            params.append(status)
        q += " ORDER BY r.created_at DESC"
        rows = conn.execute(q, params).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()


@bp.post('/api/admin/rfqs')
@admin_required
def create_rfq():
    data = request.get_json(silent=True) or {}
    required = ['title', 'quantity', 'delivery_location', 'delivery_deadline', 'submission_deadline']
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({'error': f'Missing: {", ".join(missing)}'}), 400

    conn = get_db()
    try:
        now = datetime.utcnow().isoformat()
        rfq_id = new_id()
        rfq_number = next_sequence('RFQ')
        conn.execute("""
            INSERT INTO rfqs(id,rfq_number,title,description,item_specs,quantity,quantity_unit,
                delivery_location,delivery_deadline,submission_deadline,target_type,
                estimated_value,terms_conditions,category,status,created_by,
                is_deleted,created_at,updated_at)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,'draft',?,0,?,?)
        """, (rfq_id, rfq_number,
              data['title'],
              data.get('description', ''),
              data.get('item_specs', ''),
              data['quantity'],
              data.get('quantity_unit', ''),
              data['delivery_location'],
              data['delivery_deadline'],
              data['submission_deadline'],
              data.get('target_type', 'open'),
              data.get('estimated_value'),
              data.get('terms_conditions', ''),
              data.get('category', ''),
              g.user['id'], now, now))
        for vid in (data.get('targeted_vendors') or []):
            conn.execute(
                "INSERT INTO rfq_targeted_vendors(id,rfq_id,vendor_id) VALUES(?,?,?)",
                (new_id(), rfq_id, vid))
        conn.commit()
        audit(g.user['id'], 'rfq', rfq_id, 'create', None, {'rfq_number': rfq_number})
        return jsonify({'id': rfq_id, 'rfq_number': rfq_number, 'message': 'RFQ created'}), 201
    finally:
        conn.close()


@bp.get('/api/admin/rfqs/<rfq_id>')
@admin_required
def get_admin_rfq(rfq_id):
    conn = get_db()
    try:
        r = conn.execute("""
            SELECT r.*, u.mobile AS created_by_mobile,
                   v.company_name AS awarded_vendor_name
            FROM rfqs r
            LEFT JOIN users u ON r.created_by=u.id
            LEFT JOIN vendors v ON r.awarded_to_vendor=v.id
            WHERE r.id=? AND r.is_deleted=0
        """, (rfq_id,)).fetchone()
        if not r:
            return jsonify({'error': 'RFQ not found'}), 404
        rfq = dict(r)
        quotes = conn.execute("""
            SELECT q.*, v.company_name, v.contact_name, v.contact_email, v.contact_mobile, v.rating
            FROM quotes q
            JOIN vendors v ON q.vendor_id=v.id
            WHERE q.rfq_id=? AND q.is_active=1
            ORDER BY q.grand_total ASC
        """, (rfq_id,)).fetchall()
        rfq['quotes'] = [dict(q) for q in quotes]
        tvs = conn.execute("""
            SELECT tv.vendor_id, v.company_name FROM rfq_targeted_vendors tv
            JOIN vendors v ON tv.vendor_id=v.id WHERE tv.rfq_id=?
        """, (rfq_id,)).fetchall()
        rfq['targeted_vendors'] = [dict(t) for t in tvs]
        return jsonify(rfq)
    finally:
        conn.close()


@bp.put('/api/admin/rfqs/<rfq_id>')
@admin_required
def update_rfq(rfq_id):
    conn = get_db()
    try:
        r = conn.execute(
            "SELECT status FROM rfqs WHERE id=? AND is_deleted=0", (rfq_id,)
        ).fetchone()
        if not r:
            return jsonify({'error': 'Not found'}), 404
        if r['status'] != 'draft':
            return jsonify({'error': 'Only draft RFQs can be edited'}), 400
        data = request.get_json(silent=True) or {}
        now = datetime.utcnow().isoformat()
        fields = ['title', 'description', 'item_specs', 'quantity', 'quantity_unit',
                  'delivery_location', 'delivery_deadline', 'submission_deadline',
                  'target_type', 'estimated_value', 'terms_conditions', 'category']
        updates = {f: data[f] for f in fields if f in data}
        if updates:
            set_clause = ', '.join(f'{k}=?' for k in updates)
            conn.execute(
                f"UPDATE rfqs SET {set_clause}, updated_at=? WHERE id=?",
                list(updates.values()) + [now, rfq_id])
        conn.commit()
        return jsonify({'message': 'Updated'})
    finally:
        conn.close()


@bp.post('/api/admin/rfqs/<rfq_id>/publish')
@admin_required
def publish_rfq(rfq_id):
    conn = get_db()
    try:
        r = conn.execute("SELECT status FROM rfqs WHERE id=? AND is_deleted=0", (rfq_id,)).fetchone()
        if not r:
            return jsonify({'error': 'Not found'}), 404
        if r['status'] != 'draft':
            return jsonify({'error': 'Only draft RFQs can be published'}), 400
        now = datetime.utcnow().isoformat()
        conn.execute("UPDATE rfqs SET status='published', updated_at=? WHERE id=?", (now, rfq_id))
        conn.commit()
        audit(g.user['id'], 'rfq', rfq_id, 'publish', 'draft', 'published')
        return jsonify({'message': 'RFQ published'})
    finally:
        conn.close()


@bp.post('/api/admin/rfqs/<rfq_id>/close')
@admin_required
def close_rfq(rfq_id):
    conn = get_db()
    try:
        r = conn.execute("SELECT status FROM rfqs WHERE id=? AND is_deleted=0", (rfq_id,)).fetchone()
        if not r:
            return jsonify({'error': 'Not found'}), 404
        if r['status'] != 'published':
            return jsonify({'error': 'Only published RFQs can be closed'}), 400
        now = datetime.utcnow().isoformat()
        conn.execute("UPDATE rfqs SET status='closed', updated_at=? WHERE id=?", (now, rfq_id))
        conn.commit()
        audit(g.user['id'], 'rfq', rfq_id, 'close', 'published', 'closed')
        return jsonify({'message': 'RFQ closed'})
    finally:
        conn.close()


@bp.post('/api/admin/rfqs/<rfq_id>/cancel')
@admin_required
def cancel_rfq(rfq_id):
    conn = get_db()
    try:
        r = conn.execute("SELECT status FROM rfqs WHERE id=? AND is_deleted=0", (rfq_id,)).fetchone()
        if not r:
            return jsonify({'error': 'Not found'}), 404
        if r['status'] == 'awarded':
            return jsonify({'error': 'Awarded RFQs cannot be cancelled'}), 400
        now = datetime.utcnow().isoformat()
        conn.execute("UPDATE rfqs SET status='cancelled', updated_at=? WHERE id=?", (now, rfq_id))
        conn.commit()
        audit(g.user['id'], 'rfq', rfq_id, 'cancel', r['status'], 'cancelled')
        return jsonify({'message': 'RFQ cancelled'})
    finally:
        conn.close()


@bp.post('/api/admin/rfqs/<rfq_id>/award')
@admin_required
def award_rfq(rfq_id):
    data = request.get_json(silent=True) or {}
    quote_id = (data.get('quote_id') or '').strip()
    if not quote_id:
        return jsonify({'error': 'quote_id required'}), 400
    conn = get_db()
    try:
        rfq = conn.execute(
            "SELECT * FROM rfqs WHERE id=? AND status='closed' AND is_deleted=0", (rfq_id,)
        ).fetchone()
        if not rfq:
            return jsonify({'error': 'RFQ not found or not in closed status'}), 404
        quote = conn.execute(
            "SELECT * FROM quotes WHERE id=? AND rfq_id=? AND is_active=1", (quote_id, rfq_id)
        ).fetchone()
        if not quote:
            return jsonify({'error': 'Quote not found'}), 404
        now = datetime.utcnow().isoformat()
        po_number = next_sequence('PO')
        po_id = new_id()
        conn.execute("""
            INSERT INTO purchase_orders(id,po_number,rfq_id,quote_id,vendor_id,
                item_description,quantity,quantity_unit,unit_price,total_amount,
                gst_rate,gst_amount,grand_total,delivery_location,delivery_deadline,
                terms_conditions,status,created_by,is_deleted,created_at,updated_at)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'generated',?,0,?,?)
        """, (po_id, po_number, rfq_id, quote_id, quote['vendor_id'],
              rfq['title'], rfq['quantity'], rfq['quantity_unit'],
              quote['unit_price'], quote['total_amount'],
              quote['gst_rate'], quote['gst_amount'], quote['grand_total'],
              rfq['delivery_location'], rfq['delivery_deadline'],
              rfq['terms_conditions'] or '',
              g.user['id'], now, now))
        conn.execute(
            "UPDATE rfqs SET status='awarded', awarded_to_vendor=?, awarded_at=?, updated_at=? WHERE id=?",
            (quote['vendor_id'], now, now, rfq_id))
        conn.execute(
            "UPDATE quotes SET status='awarded', updated_at=? WHERE id=?", (now, quote_id))
        conn.commit()
        audit(g.user['id'], 'rfq', rfq_id, 'award', 'closed',
              {'vendor_id': quote['vendor_id'], 'po_number': po_number})
        return jsonify({'po_id': po_id, 'po_number': po_number, 'message': 'RFQ awarded, PO created'})
    finally:
        conn.close()


@bp.get('/api/admin/vendors/approved')
@admin_required
def list_approved_vendors():
    conn = get_db()
    try:
        rows = conn.execute(
            """SELECT id, company_name, contact_email FROM vendors
               WHERE status='approved' AND is_deleted=0 ORDER BY company_name"""
        ).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()
