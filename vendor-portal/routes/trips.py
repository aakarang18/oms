from flask import Blueprint, g, request, jsonify
from database import get_db
from auth import transporter_required, audit, new_id
from datetime import datetime

bp = Blueprint('trips', __name__)


@bp.get('/api/transporter/trips')
@transporter_required
def list_transporter_trips():
    tid = g.user['entity_id']
    status = request.args.get('status')
    conn = get_db()
    try:
        q = """
            SELECT t.*, r.origin_city, r.origin_state, r.destination_city, r.destination_state,
                   r.route_code, r.distance_km
            FROM trips t
            JOIN routes r ON t.route_id = r.id
            WHERE t.transporter_id = ? AND t.is_deleted = 0
        """
        params = [tid]
        if status:
            statuses = status.split(',')
            placeholders = ','.join('?' for _ in statuses)
            q += f' AND t.status IN ({placeholders})'
            params.extend(statuses)
        q += ' ORDER BY t.created_at DESC'
        rows = conn.execute(q, params).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()


@bp.get('/api/transporter/trips/<trip_id>')
@transporter_required
def get_transporter_trip(trip_id):
    tid = g.user['entity_id']
    conn = get_db()
    try:
        trip = conn.execute("""
            SELECT t.*, r.origin_city, r.origin_state, r.destination_city, r.destination_state,
                   r.route_code, r.distance_km, r.route_type,
                   v.reg_number, v.vehicle_type, v.driver_name, v.capacity_tons
            FROM trips t
            JOIN routes r ON t.route_id = r.id
            LEFT JOIN vehicles v ON t.vehicle_id = v.id
            WHERE t.id = ? AND t.transporter_id = ? AND t.is_deleted = 0
        """, (trip_id, tid)).fetchone()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404
        return jsonify(dict(trip))
    finally:
        conn.close()


@bp.post('/api/transporter/trips/<trip_id>/accept')
@transporter_required
def accept_trip(trip_id):
    return _advance_trip(trip_id, 'assigned', 'accepted', 'accepted_at', 'trip_accepted')


@bp.post('/api/transporter/trips/<trip_id>/decline')
@transporter_required
def decline_trip(trip_id):
    tid = g.user['entity_id']
    data = request.get_json(silent=True) or {}
    reason = (data.get('reason') or '').strip()
    conn = get_db()
    try:
        trip = conn.execute(
            'SELECT * FROM trips WHERE id=? AND transporter_id=? AND is_deleted=0',
            (trip_id, tid)
        ).fetchone()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404
        if trip['status'] != 'assigned':
            return jsonify({'error': 'Can only decline assigned trips'}), 400
        now = datetime.utcnow().isoformat()
        conn.execute(
            'INSERT INTO trip_decline_log(id,trip_id,transporter_id,declined_at,reason) VALUES(?,?,?,?,?)',
            (new_id(), trip_id, tid, now, reason)
        )
        conn.execute(
            "UPDATE trips SET status='posted', transporter_id=NULL, vehicle_id=NULL, "
            "rate_card_id=NULL, assigned_at=NULL, updated_at=? WHERE id=?",
            (now, trip_id)
        )
        conn.commit()
        audit(conn, g.user['id'], 'trip', trip_id, 'trip_declined', 'assigned', 'posted')
        return jsonify({'ok': True})
    finally:
        conn.close()


@bp.post('/api/transporter/trips/<trip_id>/loaded')
@transporter_required
def mark_loaded(trip_id):
    return _advance_trip(trip_id, 'accepted', 'loaded', 'loaded_at', 'trip_loaded')


@bp.post('/api/transporter/trips/<trip_id>/in-transit')
@transporter_required
def mark_in_transit(trip_id):
    return _advance_trip(trip_id, 'loaded', 'in_transit', 'in_transit_at', 'trip_in_transit')


@bp.post('/api/transporter/trips/<trip_id>/delivered')
@transporter_required
def mark_delivered(trip_id):
    tid = g.user['entity_id']
    data = request.get_json(silent=True) or {}
    pod_qty   = data.get('pod_delivered_qty')
    pod_notes = (data.get('pod_notes') or '').strip() or None
    pod_ref   = (data.get('pod_ref') or '').strip() or None
    conn = get_db()
    try:
        trip = conn.execute(
            'SELECT * FROM trips WHERE id=? AND transporter_id=? AND is_deleted=0',
            (trip_id, tid)
        ).fetchone()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404
        if trip['status'] != 'in_transit':
            return jsonify({'error': f'Cannot mark delivered from status: {trip["status"]}'}), 400
        now = datetime.utcnow().isoformat()
        conn.execute(
            """UPDATE trips SET status='delivered', delivered_at=?,
               pod_file_path=?, pod_delivered_qty=?, pod_notes=?, pod_uploaded_at=?, updated_at=?
               WHERE id=?""",
            (now, pod_ref, pod_qty, pod_notes, now, now, trip_id)
        )
        conn.commit()
        audit(conn, g.user['id'], 'trip', trip_id, 'trip_delivered', 'in_transit', 'delivered')
        return jsonify({'ok': True, 'status': 'delivered'})
    finally:
        conn.close()


def _advance_trip(trip_id, from_status, to_status, ts_field, action):
    tid = g.user['entity_id']
    conn = get_db()
    try:
        trip = conn.execute(
            'SELECT * FROM trips WHERE id=? AND transporter_id=? AND is_deleted=0',
            (trip_id, tid)
        ).fetchone()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404
        if trip['status'] != from_status:
            return jsonify({'error': f'Cannot advance from status: {trip["status"]}'}), 400
        now = datetime.utcnow().isoformat()
        conn.execute(
            f'UPDATE trips SET status=?, {ts_field}=?, updated_at=? WHERE id=?',
            (to_status, now, now, trip_id)
        )
        conn.commit()
        audit(conn, g.user['id'], 'trip', trip_id, action, from_status, to_status)
        return jsonify({'ok': True, 'status': to_status})
    finally:
        conn.close()
