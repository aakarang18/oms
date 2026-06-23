from flask import Blueprint, g, request, jsonify
from database import get_db
from auth import transporter_required, audit, new_id
from datetime import datetime

bp = Blueprint('rate_cards', __name__)


@bp.get('/api/transporter/routes')
@transporter_required
def list_routes_transporter():
    conn = get_db()
    try:
        rows = conn.execute(
            'SELECT id, route_code, origin_city, origin_state, destination_city, destination_state, distance_km '
            'FROM routes WHERE is_active=1 ORDER BY route_code'
        ).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()


@bp.get('/api/transporter/rate-cards')
@transporter_required
def list_rate_cards():
    tid = g.user['entity_id']
    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT rc.*, r.route_code, r.origin_city, r.origin_state,
                   r.destination_city, r.destination_state, r.distance_km
            FROM rate_cards rc
            JOIN routes r ON rc.route_id = r.id
            WHERE rc.transporter_id=? AND rc.is_deleted=0
            ORDER BY rc.created_at DESC
        """, (tid,)).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()


@bp.post('/api/transporter/rate-cards')
@transporter_required
def submit_rate_card():
    tid = g.user['entity_id']
    data = request.get_json(silent=True) or {}

    route_id      = (data.get('route_id') or '').strip()
    vehicle_type  = (data.get('vehicle_type') or '').strip()
    valid_from    = (data.get('valid_from') or '').strip()
    valid_until   = (data.get('valid_until') or '').strip()
    rate_per_km   = data.get('rate_per_km')   or None
    rate_per_ton  = data.get('rate_per_ton')  or None
    min_charge    = data.get('minimum_charge') or None

    if not route_id or not vehicle_type or not valid_from or not valid_until:
        return jsonify({'error': 'Route, vehicle type, and validity dates are required'}), 400
    if not rate_per_km and not rate_per_ton:
        return jsonify({'error': 'At least one rate (per km or per ton) is required'}), 400

    conn = get_db()
    try:
        if not conn.execute('SELECT id FROM routes WHERE id=? AND is_active=1', (route_id,)).fetchone():
            return jsonify({'error': 'Invalid route'}), 400
        now   = datetime.utcnow().isoformat()
        rc_id = new_id()
        conn.execute("""
            INSERT INTO rate_cards(id,transporter_id,route_id,vehicle_type,rate_per_km,rate_per_ton,
                minimum_charge,valid_from,valid_until,status,created_at,updated_at)
            VALUES(?,?,?,?,?,?,?,?,?,'pending',?,?)
        """, (rc_id, tid, route_id, vehicle_type, rate_per_km, rate_per_ton, min_charge,
              valid_from, valid_until, now, now))
        conn.commit()
        audit(conn, g.user['id'], 'rate_card', rc_id, 'rate_card_submitted', None, 'pending')
        return jsonify({'ok': True, 'id': rc_id}), 201
    finally:
        conn.close()
