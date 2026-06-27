"""Admin trip management endpoints."""
from datetime import datetime
from flask import Blueprint, jsonify, request, g
from database import get_db, next_sequence
from auth import admin_required, new_id, audit

bp = Blueprint('admin_trips', __name__)


@bp.get('/api/admin/trips')
@admin_required
def list_admin_trips():
    status = request.args.get('status', '')
    conn = get_db()
    try:
        q = """
            SELECT t.*, r.origin_city, r.destination_city, r.route_code,
                   tr.company_name as transporter_name,
                   v.reg_number as vehicle_reg
            FROM trips t
            JOIN routes r ON r.id = t.route_id
            LEFT JOIN transporters tr ON tr.id = t.transporter_id
            LEFT JOIN vehicles v ON v.id = t.vehicle_id
            WHERE t.is_deleted=0
        """
        params = []
        if status:
            q += ' AND t.status=?'
            params.append(status)
        q += ' ORDER BY t.created_at DESC'
        rows = conn.execute(q, params).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()


@bp.post('/api/admin/trips')
@admin_required
def post_trip():
    data = request.get_json(silent=True) or {}
    route_id = (data.get('route_id') or '').strip()
    cargo_description = (data.get('cargo_description') or '').strip()
    cargo_weight_tons = data.get('cargo_weight_tons')
    po_id = (data.get('po_id') or '').strip() or None
    assignment_deadline = (data.get('assignment_deadline') or '').strip() or None

    if not route_id:
        return jsonify({'error': 'route_id is required'}), 400

    conn = get_db()
    try:
        route = conn.execute("SELECT id FROM routes WHERE id=? AND is_active=1", (route_id,)).fetchone()
        if not route:
            return jsonify({'error': 'Route not found or inactive'}), 404

        trip_number = next_sequence('TRP')
        now = datetime.utcnow().isoformat()
        trip_id = new_id()
        conn.execute("""
            INSERT INTO trips(id,trip_number,route_id,cargo_description,cargo_weight_tons,po_id,
                status,assignment_deadline,posted_by,created_at,updated_at)
            VALUES(?,?,?,?,?,?,'posted',?,?,?,?)
        """, (trip_id, trip_number, route_id, cargo_description or None,
              float(cargo_weight_tons) if cargo_weight_tons else None,
              po_id, assignment_deadline, g.user['id'], now, now))
        conn.commit()
        audit(g.user['id'], 'trip', trip_id, 'posted', None, 'posted')
        return jsonify({'id': trip_id, 'trip_number': trip_number})
    finally:
        conn.close()


@bp.post('/api/admin/trips/<trip_id>/assign')
@admin_required
def assign_trip(trip_id):
    data = request.get_json(silent=True) or {}
    transporter_id = (data.get('transporter_id') or '').strip()
    if not transporter_id:
        return jsonify({'error': 'transporter_id is required'}), 400

    conn = get_db()
    try:
        trip = conn.execute(
            "SELECT * FROM trips WHERE id=? AND is_deleted=0", (trip_id,)
        ).fetchone()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404
        if trip['status'] not in ('posted',):
            return jsonify({'error': 'Trip can only be assigned when posted'}), 400

        t = conn.execute(
            "SELECT id FROM transporters WHERE id=? AND status='approved' AND is_deleted=0",
            (transporter_id,)
        ).fetchone()
        if not t:
            return jsonify({'error': 'Transporter not found or not approved'}), 404

        now = datetime.utcnow().isoformat()
        conn.execute(
            "UPDATE trips SET status='assigned', transporter_id=?, assigned_at=?, updated_at=? WHERE id=?",
            (transporter_id, now, now, trip_id)
        )
        conn.commit()
        audit(g.user['id'], 'trip', trip_id, 'assigned', 'posted', 'assigned')
        return jsonify({'status': 'assigned'})
    finally:
        conn.close()


@bp.post('/api/admin/trips/<trip_id>/approve-pod')
@admin_required
def approve_pod(trip_id):
    conn = get_db()
    try:
        trip = conn.execute(
            "SELECT * FROM trips WHERE id=? AND is_deleted=0", (trip_id,)
        ).fetchone()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404
        if trip['status'] != 'pod_uploaded':
            return jsonify({'error': 'POD not yet uploaded'}), 400

        now = datetime.utcnow().isoformat()
        conn.execute(
            "UPDATE trips SET status='completed', updated_at=? WHERE id=?",
            (now, trip_id)
        )
        conn.commit()
        audit(g.user['id'], 'trip', trip_id, 'pod_approved', 'pod_uploaded', 'completed')
        return jsonify({'status': 'completed'})
    finally:
        conn.close()
