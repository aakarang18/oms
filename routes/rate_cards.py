"""Transporter rate card endpoints + admin route master."""
from datetime import datetime
from flask import Blueprint, jsonify, request, g
from database import get_db
from auth import transporter_required, admin_required, new_id, audit

bp = Blueprint('rate_cards', __name__)


# ── Transporter: view available routes ────────────────────────────────────────

@bp.get('/api/transporter/routes')
@transporter_required
def list_routes_for_transporter():
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT * FROM routes WHERE is_active=1 ORDER BY origin_city, destination_city"
        ).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()


# ── Transporter: rate cards ────────────────────────────────────────────────────

@bp.get('/api/transporter/rate-cards')
@transporter_required
def list_my_rate_cards():
    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT rc.*, r.origin_city, r.destination_city, r.route_code
            FROM rate_cards rc
            JOIN routes r ON r.id = rc.route_id
            WHERE rc.transporter_id=? AND rc.is_deleted=0
            ORDER BY rc.created_at DESC
        """, (g.user['entity_id'],)).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()


@bp.post('/api/transporter/rate-cards')
@transporter_required
def submit_rate_card():
    data = request.get_json(silent=True) or {}
    route_id = (data.get('route_id') or '').strip()
    vehicle_type = (data.get('vehicle_type') or '').strip()
    rate_per_km = data.get('rate_per_km')
    rate_per_ton = data.get('rate_per_ton')
    minimum_charge = data.get('minimum_charge')
    valid_from = (data.get('valid_from') or '').strip()
    valid_until = (data.get('valid_until') or '').strip()

    if not route_id:
        return jsonify({'error': 'route_id is required'}), 400
    if not vehicle_type:
        return jsonify({'error': 'vehicle_type is required'}), 400
    if not valid_from or not valid_until:
        return jsonify({'error': 'valid_from and valid_until are required'}), 400

    conn = get_db()
    try:
        route = conn.execute("SELECT id FROM routes WHERE id=? AND is_active=1", (route_id,)).fetchone()
        if not route:
            return jsonify({'error': 'Route not found or inactive'}), 404

        now = datetime.utcnow().isoformat()
        rc_id = new_id()
        conn.execute("""
            INSERT INTO rate_cards(id,transporter_id,route_id,vehicle_type,rate_per_km,rate_per_ton,
                minimum_charge,valid_from,valid_until,status,created_at,updated_at)
            VALUES(?,?,?,?,?,?,?,?,?,'pending',?,?)
        """, (rc_id, g.user['entity_id'], route_id, vehicle_type,
              float(rate_per_km) if rate_per_km is not None else None,
              float(rate_per_ton) if rate_per_ton is not None else None,
              float(minimum_charge) if minimum_charge is not None else None,
              valid_from, valid_until, now, now))
        conn.commit()
        audit(g.user['id'], 'rate_card', rc_id, 'submitted', None, 'pending')
        return jsonify({'id': rc_id})
    finally:
        conn.close()


# ── Admin: route master ────────────────────────────────────────────────────────

@bp.get('/api/admin/routes')
@admin_required
def list_routes():
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT * FROM routes ORDER BY origin_city, destination_city"
        ).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()


@bp.post('/api/admin/routes')
@admin_required
def create_route():
    data = request.get_json(silent=True) or {}
    origin_city = (data.get('origin_city') or '').strip()
    origin_state = (data.get('origin_state') or '').strip()
    destination_city = (data.get('destination_city') or '').strip()
    destination_state = (data.get('destination_state') or '').strip()
    distance_km = data.get('distance_km')
    route_type = (data.get('route_type') or 'Road').strip()

    for field, val in [('origin_city', origin_city), ('origin_state', origin_state),
                        ('destination_city', destination_city), ('destination_state', destination_state)]:
        if not val:
            return jsonify({'error': f'{field} is required'}), 400

    now = datetime.utcnow().isoformat()
    route_id = new_id()
    route_code = f"{origin_city[:3].upper()}-{destination_city[:3].upper()}-{route_id[:4].upper()}"

    conn = get_db()
    try:
        conn.execute("""
            INSERT INTO routes(id,route_code,origin_city,origin_state,destination_city,destination_state,
                distance_km,route_type,is_active,created_by,created_at,updated_at)
            VALUES(?,?,?,?,?,?,?,?,1,?,?,?)
        """, (route_id, route_code, origin_city, origin_state, destination_city, destination_state,
              float(distance_km) if distance_km else None, route_type, g.user['id'], now, now))
        conn.commit()
        return jsonify({'id': route_id, 'route_code': route_code})
    finally:
        conn.close()


@bp.patch('/api/admin/routes/<route_id>/toggle')
@admin_required
def toggle_route(route_id):
    conn = get_db()
    try:
        row = conn.execute("SELECT is_active FROM routes WHERE id=?", (route_id,)).fetchone()
        if not row:
            return jsonify({'error': 'Not found'}), 404
        new_status = 0 if row['is_active'] else 1
        conn.execute("UPDATE routes SET is_active=?, updated_at=? WHERE id=?",
                     (new_status, datetime.utcnow().isoformat(), route_id))
        conn.commit()
        return jsonify({'is_active': new_status})
    finally:
        conn.close()


# ── Admin: rate card approvals ─────────────────────────────────────────────────

@bp.get('/api/admin/rate-cards')
@admin_required
def list_rate_cards_admin():
    status = request.args.get('status', 'pending')
    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT rc.*, t.company_name as transporter_name,
                   r.origin_city, r.destination_city, r.route_code
            FROM rate_cards rc
            JOIN transporters t ON t.id = rc.transporter_id
            JOIN routes r ON r.id = rc.route_id
            WHERE rc.is_deleted=0 AND rc.status=?
            ORDER BY rc.created_at DESC
        """, (status,)).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()


@bp.post('/api/admin/rate-cards/<rc_id>/approve')
@admin_required
def approve_rate_card(rc_id):
    conn = get_db()
    try:
        rc = conn.execute("SELECT * FROM rate_cards WHERE id=? AND is_deleted=0", (rc_id,)).fetchone()
        if not rc:
            return jsonify({'error': 'Not found'}), 404
        if rc['status'] != 'pending':
            return jsonify({'error': 'Rate card is not pending'}), 400
        now = datetime.utcnow().isoformat()
        conn.execute(
            "UPDATE rate_cards SET status='approved', reviewed_by=?, reviewed_at=?, updated_at=? WHERE id=?",
            (g.user['id'], now, now, rc_id))
        conn.commit()
        audit(g.user['id'], 'rate_card', rc_id, 'approved', 'pending', 'approved')
        return jsonify({'status': 'approved'})
    finally:
        conn.close()


@bp.post('/api/admin/rate-cards/<rc_id>/reject')
@admin_required
def reject_rate_card(rc_id):
    data = request.get_json(silent=True) or {}
    reason = (data.get('rejection_reason') or '').strip()
    if not reason:
        return jsonify({'error': 'rejection_reason is required'}), 400
    conn = get_db()
    try:
        rc = conn.execute("SELECT * FROM rate_cards WHERE id=? AND is_deleted=0", (rc_id,)).fetchone()
        if not rc:
            return jsonify({'error': 'Not found'}), 404
        if rc['status'] != 'pending':
            return jsonify({'error': 'Rate card is not pending'}), 400
        now = datetime.utcnow().isoformat()
        conn.execute(
            "UPDATE rate_cards SET status='rejected', rejection_reason=?, reviewed_by=?, reviewed_at=?, updated_at=? WHERE id=?",
            (reason, g.user['id'], now, now, rc_id))
        conn.commit()
        audit(g.user['id'], 'rate_card', rc_id, 'rejected', 'pending', 'rejected')
        return jsonify({'status': 'rejected'})
    finally:
        conn.close()
