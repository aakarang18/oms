"""Transporter trip endpoints."""
import os
from datetime import datetime
from flask import Blueprint, jsonify, request, g, current_app
from werkzeug.utils import secure_filename
from database import get_db
from auth import transporter_required, new_id, audit

bp = Blueprint('trips', __name__)

ALLOWED_EXT = {'pdf', 'jpg', 'jpeg', 'png'}

VALID_STATUS_TRANSITIONS = {
    'accepted': 'loaded',
    'loaded': 'in_transit',
    'in_transit': 'delivered',
}


def _allowed(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXT


@bp.get('/api/transporter/trips')
@transporter_required
def list_my_trips():
    status = request.args.get('status', '')
    conn = get_db()
    try:
        q = """
            SELECT t.*, r.origin_city, r.destination_city, r.route_code, r.distance_km
            FROM trips t
            JOIN routes r ON r.id = t.route_id
            WHERE t.transporter_id=? AND t.is_deleted=0
        """
        params = [g.user['entity_id']]
        if status:
            q += ' AND t.status=?'
            params.append(status)
        q += ' ORDER BY t.created_at DESC'
        rows = conn.execute(q, params).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()


@bp.get('/api/transporter/trips/assigned')
@transporter_required
def list_assigned_trips():
    """Trips posted/assigned to this transporter but not yet accepted."""
    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT t.*, r.origin_city, r.destination_city, r.route_code, r.distance_km
            FROM trips t
            JOIN routes r ON r.id = t.route_id
            WHERE t.transporter_id=? AND t.status='assigned' AND t.is_deleted=0
            ORDER BY t.assignment_deadline ASC
        """, (g.user['entity_id'],)).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()


@bp.post('/api/transporter/trips/<trip_id>/accept')
@transporter_required
def accept_trip(trip_id):
    vehicle_id = (request.get_json(silent=True) or {}).get('vehicle_id', '').strip()
    conn = get_db()
    try:
        trip = conn.execute(
            "SELECT * FROM trips WHERE id=? AND transporter_id=? AND is_deleted=0",
            (trip_id, g.user['entity_id'])
        ).fetchone()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404
        if trip['status'] != 'assigned':
            return jsonify({'error': 'Trip cannot be accepted in current status'}), 400

        update_fields = "status='accepted', accepted_at=?, updated_at=?"
        params = [datetime.utcnow().isoformat(), datetime.utcnow().isoformat()]

        if vehicle_id:
            v = conn.execute(
                "SELECT id FROM vehicles WHERE id=? AND transporter_id=? AND is_deleted=0",
                (vehicle_id, g.user['entity_id'])
            ).fetchone()
            if not v:
                return jsonify({'error': 'Vehicle not found'}), 404
            update_fields += ", vehicle_id=?"
            params.append(vehicle_id)

        params.append(trip_id)
        conn.execute(f"UPDATE trips SET {update_fields} WHERE id=?", params)
        conn.commit()
        audit(g.user['id'], 'trip', trip_id, 'accepted', 'assigned', 'accepted')
        return jsonify({'status': 'accepted'})
    finally:
        conn.close()


@bp.post('/api/transporter/trips/<trip_id>/decline')
@transporter_required
def decline_trip(trip_id):
    data = request.get_json(silent=True) or {}
    reason = (data.get('reason') or '').strip()
    conn = get_db()
    try:
        trip = conn.execute(
            "SELECT * FROM trips WHERE id=? AND transporter_id=? AND is_deleted=0",
            (trip_id, g.user['entity_id'])
        ).fetchone()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404
        if trip['status'] != 'assigned':
            return jsonify({'error': 'Can only decline an assigned trip'}), 400

        now = datetime.utcnow().isoformat()
        conn.execute(
            "UPDATE trips SET status='posted', transporter_id=NULL, vehicle_id=NULL, assigned_at=NULL, updated_at=? WHERE id=?",
            (now, trip_id)
        )
        conn.execute(
            "INSERT INTO trip_decline_log(id,trip_id,transporter_id,declined_at,reason) VALUES(?,?,?,?,?)",
            (new_id(), trip_id, g.user['entity_id'], now, reason or None)
        )
        conn.commit()
        audit(g.user['id'], 'trip', trip_id, 'declined', 'assigned', 'posted')
        return jsonify({'status': 'posted'})
    finally:
        conn.close()


@bp.post('/api/transporter/trips/<trip_id>/update-status')
@transporter_required
def update_trip_status(trip_id):
    data = request.get_json(silent=True) or {}
    new_status = (data.get('status') or '').strip()

    conn = get_db()
    try:
        trip = conn.execute(
            "SELECT * FROM trips WHERE id=? AND transporter_id=? AND is_deleted=0",
            (trip_id, g.user['entity_id'])
        ).fetchone()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404

        expected_next = VALID_STATUS_TRANSITIONS.get(trip['status'])
        if not expected_next or new_status != expected_next:
            return jsonify({'error': f'Cannot transition from {trip["status"]} to {new_status}'}), 400

        ts_col_map = {
            'loaded': 'loaded_at',
            'in_transit': 'in_transit_at',
            'delivered': 'delivered_at',
        }
        ts_col = ts_col_map[new_status]
        now = datetime.utcnow().isoformat()
        conn.execute(
            f"UPDATE trips SET status=?, {ts_col}=?, updated_at=? WHERE id=?",
            (new_status, now, now, trip_id)
        )
        conn.commit()
        audit(g.user['id'], 'trip', trip_id, f'status_{new_status}', trip['status'], new_status)
        return jsonify({'status': new_status})
    finally:
        conn.close()


@bp.post('/api/transporter/trips/<trip_id>/pod')
@transporter_required
def upload_pod(trip_id):
    conn = get_db()
    try:
        trip = conn.execute(
            "SELECT * FROM trips WHERE id=? AND transporter_id=? AND is_deleted=0",
            (trip_id, g.user['entity_id'])
        ).fetchone()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404
        if trip['status'] != 'delivered':
            return jsonify({'error': 'POD can only be uploaded for delivered trips'}), 400
    finally:
        conn.close()

    pod_qty = request.form.get('pod_delivered_qty')
    pod_notes = request.form.get('pod_notes', '').strip()
    file = request.files.get('file')

    if not file or not file.filename:
        return jsonify({'error': 'POD file is required'}), 400
    if not _allowed(file.filename):
        return jsonify({'error': 'Only PDF/JPG/PNG allowed'}), 400

    upload_dir = os.path.join(current_app.root_path, 'uploads', 'pod', trip_id)
    os.makedirs(upload_dir, exist_ok=True)
    filename = secure_filename(f"pod_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{file.filename}")
    file_path = os.path.join(upload_dir, filename)
    file.save(file_path)

    now = datetime.utcnow().isoformat()
    conn = get_db()
    try:
        conn.execute("""
            UPDATE trips SET status='pod_uploaded', pod_file_path=?, pod_delivered_qty=?,
                pod_notes=?, pod_uploaded_at=?, updated_at=? WHERE id=?
        """, (os.path.join('uploads', 'pod', trip_id, filename),
              float(pod_qty) if pod_qty else None,
              pod_notes or None, now, now, trip_id))
        conn.commit()
        audit(g.user['id'], 'trip', trip_id, 'pod_uploaded', 'delivered', 'pod_uploaded')
        return jsonify({'status': 'pod_uploaded'})
    finally:
        conn.close()
