from flask import Blueprint, jsonify, g, request
from datetime import datetime
from database import get_db, next_sequence
from auth import admin_required, audit, new_id

bp = Blueprint('admin_po', __name__)


@bp.get('/api/admin/pos')
@admin_required
def list_admin_pos():
    status_filter = request.args.get('status', '')
    conn = get_db()
    try:
        q = """
            SELECT p.*, r.rfq_number, v.company_name as vendor_name,
                   (SELECT grn_number FROM grns WHERE po_id=p.id LIMIT 1) as grn_number
            FROM purchase_orders p
            JOIN rfqs r ON r.id = p.rfq_id
            JOIN vendors v ON v.id = p.vendor_id
            WHERE p.is_deleted=0
        """
        params = []
        if status_filter:
            q += ' AND p.status=?'
            params.append(status_filter)
        q += ' ORDER BY p.created_at DESC'
        rows = conn.execute(q, params).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()


@bp.get('/api/admin/pos/<po_id>')
@admin_required
def get_admin_po(po_id):
    conn = get_db()
    try:
        po = conn.execute("""
            SELECT p.*, r.rfq_number, r.title as rfq_title,
                   v.company_name as vendor_name,
                   v.contact_name as vendor_contact,
                   v.contact_email as vendor_email,
                   v.contact_mobile as vendor_mobile
            FROM purchase_orders p
            JOIN rfqs r ON r.id = p.rfq_id
            JOIN vendors v ON v.id = p.vendor_id
            WHERE p.id=? AND p.is_deleted=0
        """, (po_id,)).fetchone()
        if not po:
            return jsonify({'error': 'Not found'}), 404
        result = dict(po)
        grn = conn.execute("SELECT * FROM grns WHERE po_id=?", (po_id,)).fetchone()
        result['grn'] = dict(grn) if grn else None
        return jsonify(result)
    finally:
        conn.close()


@bp.post('/api/admin/pos/<po_id>/dispatch')
@admin_required
def dispatch_po(po_id):
    data = request.get_json(silent=True) or {}
    dispatch_transport = (data.get('dispatch_transport') or '').strip()
    dispatch_lr_number = (data.get('dispatch_lr_number') or '').strip()
    dispatched_at = (data.get('dispatched_at') or '').strip()
    dispatch_notes = (data.get('dispatch_notes') or '').strip()

    if not dispatch_transport:
        return jsonify({'error': 'dispatch_transport is required'}), 400
    if not dispatched_at:
        return jsonify({'error': 'dispatched_at is required'}), 400

    conn = get_db()
    try:
        po = conn.execute(
            "SELECT * FROM purchase_orders WHERE id=? AND is_deleted=0", (po_id,)
        ).fetchone()
        if not po:
            return jsonify({'error': 'PO not found'}), 404
        if po['status'] != 'acknowledged':
            return jsonify({'error': 'PO must be acknowledged before marking as dispatched'}), 400

        now = datetime.utcnow().isoformat()
        conn.execute("""
            UPDATE purchase_orders SET status='dispatched', dispatch_transport=?,
                dispatch_lr_number=?, dispatched_at=?, dispatch_notes=?, updated_at=? WHERE id=?
        """, (dispatch_transport, dispatch_lr_number or None, dispatched_at,
              dispatch_notes or None, now, po_id))
        conn.commit()
        audit(g.user['id'], 'po', po_id, 'dispatched', 'acknowledged', 'dispatched')
        return jsonify({'status': 'dispatched'})
    finally:
        conn.close()


@bp.post('/api/admin/pos/<po_id>/grn')
@admin_required
def record_grn(po_id):
    data = request.get_json(silent=True) or {}
    qty_received   = data.get('qty_received')
    quality_status = (data.get('quality_status') or '').strip()
    rejection_reason = (data.get('rejection_reason') or '').strip()
    received_at    = (data.get('received_at') or '').strip()

    if qty_received is None:
        return jsonify({'error': 'qty_received is required'}), 400
    if quality_status not in ('accepted', 'partial', 'rejected'):
        return jsonify({'error': 'quality_status must be accepted / partial / rejected'}), 400
    if not received_at:
        return jsonify({'error': 'received_at date is required'}), 400

    conn = get_db()
    try:
        po = conn.execute(
            "SELECT * FROM purchase_orders WHERE id=? AND is_deleted=0", (po_id,)
        ).fetchone()
        if not po:
            return jsonify({'error': 'PO not found'}), 404
        if po['status'] == 'grn_received':
            return jsonify({'error': 'GRN already recorded for this PO'}), 400
        if po['status'] not in ('acknowledged', 'dispatched'):
            return jsonify({'error': 'PO must be acknowledged or dispatched before GRN'}), 400

        existing = conn.execute("SELECT id FROM grns WHERE po_id=?", (po_id,)).fetchone()
        if existing:
            return jsonify({'error': 'GRN already exists for this PO'}), 400

        grn_number = next_sequence('GRN')
        now = datetime.utcnow().isoformat()
        grn_id = new_id()
        conn.execute("""
            INSERT INTO grns(id,grn_number,po_id,vendor_id,qty_ordered,qty_received,
                quality_status,rejection_reason,received_by,received_at,created_at,updated_at)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
        """, (grn_id, grn_number, po_id, po['vendor_id'], po['quantity'],
              float(qty_received), quality_status,
              rejection_reason if quality_status != 'accepted' else None,
              g.user['id'], received_at, now, now))
        conn.execute(
            "UPDATE purchase_orders SET status='grn_received', updated_at=? WHERE id=?",
            (now, po_id)
        )
        conn.commit()
        audit(g.user['id'], 'po', po_id, 'grn', po['status'], 'grn_received')
        return jsonify({'grn_number': grn_number, 'grn_id': grn_id})
    finally:
        conn.close()


@bp.get('/api/admin/grns')
@admin_required
def list_admin_grns():
    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT g.*, p.po_number, v.company_name as vendor_name
            FROM grns g
            JOIN purchase_orders p ON p.id = g.po_id
            JOIN vendors v ON v.id = g.vendor_id
            ORDER BY g.created_at DESC
        """).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()
