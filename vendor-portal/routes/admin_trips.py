from flask import Blueprint, g, request, jsonify
from database import get_db, next_sequence
from auth import admin_required, audit, new_id
from datetime import datetime

bp = Blueprint('admin_trips', __name__)


# ── Routes ────────────────────────────────────────────────────────────────────

@bp.get('/api/admin/routes')
@admin_required
def list_admin_routes():
    conn = get_db()
    try:
        rows = conn.execute('SELECT * FROM routes ORDER BY created_at DESC').fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()


@bp.post('/api/admin/routes')
@admin_required
def create_route():
    data = request.get_json(silent=True) or {}
    origin_city       = (data.get('origin_city') or '').strip()
    origin_state      = (data.get('origin_state') or '').strip()
    destination_city  = (data.get('destination_city') or '').strip()
    destination_state = (data.get('destination_state') or '').strip()
    distance_km       = data.get('distance_km') or None
    route_type        = (data.get('route_type') or 'Road').strip()

    if not origin_city or not origin_state or not destination_city or not destination_state:
        return jsonify({'error': 'Origin and destination (city + state) are required'}), 400

    conn = get_db()
    try:
        route_code = next_sequence('ROUTE')
        now = datetime.utcnow().isoformat()
        rid = new_id()
        conn.execute("""
            INSERT INTO routes(id,route_code,origin_city,origin_state,destination_city,destination_state,
                distance_km,route_type,is_active,created_by,created_at,updated_at)
            VALUES(?,?,?,?,?,?,?,?,1,?,?,?)
        """, (rid, route_code, origin_city, origin_state, destination_city, destination_state,
              distance_km, route_type, g.user['id'], now, now))
        conn.commit()
        audit(conn, g.user['id'], 'route', rid, 'route_created', None, route_code)
        return jsonify({'ok': True, 'id': rid, 'route_code': route_code}), 201
    finally:
        conn.close()


# ── Rate Card Approvals ───────────────────────────────────────────────────────

@bp.get('/api/admin/rate-cards')
@admin_required
def list_admin_rate_cards():
    status = request.args.get('status', 'pending')
    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT rc.*, t.company_name as transporter_name,
                   r.route_code, r.origin_city, r.origin_state,
                   r.destination_city, r.destination_state, r.distance_km
            FROM rate_cards rc
            JOIN transporters t ON rc.transporter_id = t.id
            JOIN routes r ON rc.route_id = r.id
            WHERE rc.is_deleted=0 AND rc.status=?
            ORDER BY rc.created_at DESC
        """, (status,)).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()


@bp.post('/api/admin/rate-cards/<rc_id>/review')
@admin_required
def review_rate_card(rc_id):
    data   = request.get_json(silent=True) or {}
    action = (data.get('action') or '').strip()
    reason = (data.get('reason') or '').strip()

    if action not in ('approved', 'rejected'):
        return jsonify({'error': 'action must be approved or rejected'}), 400
    if action == 'rejected' and not reason:
        return jsonify({'error': 'Rejection reason required'}), 400

    conn = get_db()
    try:
        rc = conn.execute('SELECT * FROM rate_cards WHERE id=? AND is_deleted=0', (rc_id,)).fetchone()
        if not rc:
            return jsonify({'error': 'Rate card not found'}), 404
        if rc['status'] != 'pending':
            return jsonify({'error': 'Rate card is not pending'}), 400
        now = datetime.utcnow().isoformat()
        conn.execute("""
            UPDATE rate_cards SET status=?, reviewed_by=?, reviewed_at=?,
                rejection_reason=?, updated_at=?
            WHERE id=?
        """, (action, g.user['id'], now,
              reason if action == 'rejected' else None, now, rc_id))
        conn.commit()
        audit(conn, g.user['id'], 'rate_card', rc_id, f'rate_card_{action}', 'pending', action)
        return jsonify({'ok': True, 'status': action})
    finally:
        conn.close()


# ── Trips ─────────────────────────────────────────────────────────────────────

@bp.get('/api/admin/trips')
@admin_required
def list_admin_trips():
    status = request.args.get('status')
    conn = get_db()
    try:
        q = """
            SELECT t.*, r.route_code, r.origin_city, r.origin_state,
                   r.destination_city, r.destination_state,
                   tr.company_name as transporter_name,
                   v.reg_number, v.vehicle_type
            FROM trips t
            JOIN routes r ON t.route_id = r.id
            LEFT JOIN transporters tr ON t.transporter_id = tr.id
            LEFT JOIN vehicles v ON t.vehicle_id = v.id
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


@bp.get('/api/admin/trips/<trip_id>')
@admin_required
def get_admin_trip(trip_id):
    conn = get_db()
    try:
        trip = conn.execute("""
            SELECT t.*, r.route_code, r.origin_city, r.origin_state,
                   r.destination_city, r.destination_state, r.distance_km, r.route_type,
                   tr.company_name as transporter_name,
                   tr.contact_name as transporter_contact,
                   tr.contact_mobile as transporter_mobile,
                   v.reg_number, v.vehicle_type, v.driver_name, v.capacity_tons
            FROM trips t
            JOIN routes r ON t.route_id = r.id
            LEFT JOIN transporters tr ON t.transporter_id = tr.id
            LEFT JOIN vehicles v ON t.vehicle_id = v.id
            WHERE t.id=? AND t.is_deleted=0
        """, (trip_id,)).fetchone()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404
        return jsonify(dict(trip))
    finally:
        conn.close()


@bp.post('/api/admin/trips')
@admin_required
def post_trip():
    data = request.get_json(silent=True) or {}
    route_id            = (data.get('route_id') or '').strip()
    cargo_description   = (data.get('cargo_description') or '').strip()
    cargo_weight_tons   = data.get('cargo_weight_tons') or None
    assignment_deadline = (data.get('assignment_deadline') or '').strip() or None
    po_id               = (data.get('po_id') or '').strip() or None

    if not route_id or not cargo_description:
        return jsonify({'error': 'Route and cargo description are required'}), 400

    conn = get_db()
    try:
        if not conn.execute('SELECT id FROM routes WHERE id=? AND is_active=1', (route_id,)).fetchone():
            return jsonify({'error': 'Invalid route'}), 400
        trip_number = next_sequence('TRIP')
        now = datetime.utcnow().isoformat()
        tid = new_id()
        conn.execute("""
            INSERT INTO trips(id,trip_number,route_id,cargo_description,cargo_weight_tons,po_id,
                assignment_deadline,status,posted_by,created_at,updated_at)
            VALUES(?,?,?,?,?,?,?,'posted',?,?,?)
        """, (tid, trip_number, route_id, cargo_description, cargo_weight_tons,
              po_id, assignment_deadline, g.user['id'], now, now))
        conn.commit()
        audit(conn, g.user['id'], 'trip', tid, 'trip_posted', None, 'posted')
        return jsonify({'ok': True, 'id': tid, 'trip_number': trip_number}), 201
    finally:
        conn.close()


@bp.post('/api/admin/trips/<trip_id>/assign')
@admin_required
def assign_trip(trip_id):
    data           = request.get_json(silent=True) or {}
    transporter_id = (data.get('transporter_id') or '').strip()
    vehicle_id     = (data.get('vehicle_id') or '').strip()
    rate_card_id   = (data.get('rate_card_id') or '').strip() or None

    if not transporter_id or not vehicle_id:
        return jsonify({'error': 'Transporter and vehicle are required'}), 400

    conn = get_db()
    try:
        trip = conn.execute('SELECT * FROM trips WHERE id=? AND is_deleted=0', (trip_id,)).fetchone()
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404
        if trip['status'] != 'posted':
            return jsonify({'error': 'Can only assign trips in posted status'}), 400
        if not conn.execute(
            "SELECT id FROM transporters WHERE id=? AND status='approved'", (transporter_id,)
        ).fetchone():
            return jsonify({'error': 'Invalid or unapproved transporter'}), 400
        if not conn.execute(
            'SELECT id FROM vehicles WHERE id=? AND transporter_id=? AND is_deleted=0',
            (vehicle_id, transporter_id)
        ).fetchone():
            return jsonify({'error': 'Vehicle not found for this transporter'}), 400
        now = datetime.utcnow().isoformat()
        conn.execute("""
            UPDATE trips SET transporter_id=?, vehicle_id=?, rate_card_id=?,
                status='assigned', assigned_at=?, updated_at=?
            WHERE id=?
        """, (transporter_id, vehicle_id, rate_card_id, now, now, trip_id))
        conn.commit()
        audit(conn, g.user['id'], 'trip', trip_id, 'trip_assigned', 'posted', 'assigned')
        return jsonify({'ok': True, 'status': 'assigned'})
    finally:
        conn.close()


# ── Transporter lookup for assignment ─────────────────────────────────────────

@bp.get('/api/admin/transporters')
@admin_required
def list_admin_transporters():
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT id, company_name, contact_name, contact_mobile "
            "FROM transporters WHERE status='approved' AND is_deleted=0 ORDER BY company_name"
        ).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()


@bp.get('/api/admin/transporters/<transporter_id>/vehicles')
@admin_required
def list_transporter_vehicles_admin(transporter_id):
    conn = get_db()
    try:
        rows = conn.execute(
            'SELECT id, reg_number, vehicle_type, capacity_tons, driver_name, status '
            'FROM vehicles WHERE transporter_id=? AND is_deleted=0',
            (transporter_id,)
        ).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()
