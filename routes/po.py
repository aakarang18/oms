from flask import Blueprint, jsonify, g, request
from datetime import datetime
from database import get_db
from auth import vendor_required, audit, new_id

bp = Blueprint('po', __name__)


@bp.get('/api/vendor/pos')
@vendor_required
def list_vendor_pos():
    vendor_id = g.user['entity_id']
    status_filter = request.args.get('status', '')
    conn = get_db()
    try:
        q = """
            SELECT p.*, r.rfq_number
            FROM purchase_orders p
            JOIN rfqs r ON r.id = p.rfq_id
            WHERE p.vendor_id=? AND p.is_deleted=0
        """
        params = [vendor_id]
        if status_filter:
            q += ' AND p.status=?'
            params.append(status_filter)
        q += ' ORDER BY p.created_at DESC'
        rows = conn.execute(q, params).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()


@bp.get('/api/vendor/pos/<po_id>')
@vendor_required
def get_vendor_po(po_id):
    vendor_id = g.user['entity_id']
    conn = get_db()
    try:
        po = conn.execute("""
            SELECT p.*, r.rfq_number, r.title as rfq_title
            FROM purchase_orders p
            JOIN rfqs r ON r.id = p.rfq_id
            WHERE p.id=? AND p.vendor_id=? AND p.is_deleted=0
        """, (po_id, vendor_id)).fetchone()
        if not po:
            return jsonify({'error': 'Not found'}), 404
        result = dict(po)
        # Attach GRN if exists
        grn = conn.execute(
            "SELECT * FROM grns WHERE po_id=?", (po_id,)
        ).fetchone()
        result['grn'] = dict(grn) if grn else None
        return jsonify(result)
    finally:
        conn.close()


@bp.post('/api/vendor/pos/<po_id>/acknowledge')
@vendor_required
def acknowledge_po(po_id):
    vendor_id = g.user['entity_id']
    conn = get_db()
    try:
        po = conn.execute(
            "SELECT status FROM purchase_orders WHERE id=? AND vendor_id=? AND is_deleted=0",
            (po_id, vendor_id)
        ).fetchone()
        if not po:
            return jsonify({'error': 'Not found'}), 404
        if po['status'] != 'generated':
            return jsonify({'error': f'PO is already {po["status"]}'}), 400
        now = datetime.utcnow().isoformat()
        conn.execute(
            "UPDATE purchase_orders SET status='acknowledged', acknowledged_at=?, updated_at=? WHERE id=?",
            (now, now, po_id)
        )
        conn.commit()
        audit(g.user['id'], 'po', po_id, 'acknowledge', 'generated', 'acknowledged')
        return jsonify({'message': 'PO acknowledged'})
    finally:
        conn.close()


@bp.post('/api/vendor/pos/<po_id>/dispatch')
@vendor_required
def dispatch_po(po_id):
    vendor_id = g.user['entity_id']
    data = request.get_json(silent=True) or {}
    transport = (data.get('dispatch_transport') or '').strip()
    lr_number = (data.get('dispatch_lr_number') or '').strip()
    dispatch_date = (data.get('dispatched_at') or '').strip()
    notes = (data.get('dispatch_notes') or '').strip()

    if not transport:
        return jsonify({'error': 'Transporter / vehicle details are required'}), 400
    if not dispatch_date:
        return jsonify({'error': 'Dispatch date is required'}), 400

    conn = get_db()
    try:
        po = conn.execute(
            "SELECT status FROM purchase_orders WHERE id=? AND vendor_id=? AND is_deleted=0",
            (po_id, vendor_id)
        ).fetchone()
        if not po:
            return jsonify({'error': 'Not found'}), 404
        if po['status'] not in ('acknowledged', 'dispatched'):
            return jsonify({'error': 'PO must be acknowledged before marking as dispatched'}), 400
        now = datetime.utcnow().isoformat()
        conn.execute("""
            UPDATE purchase_orders
            SET status='dispatched', dispatch_transport=?, dispatch_lr_number=?,
                dispatched_at=?, dispatch_notes=?, updated_at=?
            WHERE id=?
        """, (transport, lr_number or None, dispatch_date, notes or None, now, po_id))
        conn.commit()
        audit(g.user['id'], 'po', po_id, 'dispatch', po['status'], 'dispatched')
        return jsonify({'message': 'Dispatch details updated'})
    finally:
        conn.close()
