from flask import Blueprint, g, request, jsonify
from database import get_db
from auth import transporter_required, audit, new_id
from datetime import datetime

bp = Blueprint('fleet', __name__)


@bp.get('/api/transporter/vehicles')
@transporter_required
def list_vehicles():
    tid = g.user['entity_id']
    conn = get_db()
    try:
        rows = conn.execute(
            'SELECT * FROM vehicles WHERE transporter_id=? AND is_deleted=0 ORDER BY created_at DESC',
            (tid,)
        ).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()


@bp.post('/api/transporter/vehicles')
@transporter_required
def add_vehicle():
    tid = g.user['entity_id']
    data = request.get_json(silent=True) or {}

    reg_number            = (data.get('reg_number') or '').strip().upper()
    vehicle_type          = (data.get('vehicle_type') or '').strip()
    capacity_tons         = data.get('capacity_tons') or None
    year_of_manufacture   = data.get('year_of_manufacture') or None
    driver_name           = (data.get('driver_name') or '').strip() or None
    driver_license_number = (data.get('driver_license_number') or '').strip() or None
    driver_license_expiry = (data.get('driver_license_expiry') or '').strip() or None

    if not reg_number or not vehicle_type:
        return jsonify({'error': 'Registration number and vehicle type are required'}), 400

    conn = get_db()
    try:
        if conn.execute('SELECT id FROM vehicles WHERE reg_number=?', (reg_number,)).fetchone():
            return jsonify({'error': 'Vehicle with this registration already exists'}), 409
        now = datetime.utcnow().isoformat()
        vid = new_id()
        conn.execute("""
            INSERT INTO vehicles(id,transporter_id,reg_number,vehicle_type,capacity_tons,
                year_of_manufacture,driver_name,driver_license_number,driver_license_expiry,
                status,created_at,updated_at)
            VALUES(?,?,?,?,?,?,?,?,?,'available',?,?)
        """, (vid, tid, reg_number, vehicle_type, capacity_tons, year_of_manufacture,
              driver_name, driver_license_number, driver_license_expiry, now, now))
        conn.commit()
        audit(conn, g.user['id'], 'vehicle', vid, 'vehicle_added', None, 'available')
        return jsonify({'ok': True, 'id': vid}), 201
    finally:
        conn.close()


@bp.put('/api/transporter/vehicles/<vehicle_id>')
@transporter_required
def update_vehicle(vehicle_id):
    tid = g.user['entity_id']
    data = request.get_json(silent=True) or {}
    conn = get_db()
    try:
        v = conn.execute(
            'SELECT * FROM vehicles WHERE id=? AND transporter_id=? AND is_deleted=0',
            (vehicle_id, tid)
        ).fetchone()
        if not v:
            return jsonify({'error': 'Vehicle not found'}), 404
        now = datetime.utcnow().isoformat()
        conn.execute("""
            UPDATE vehicles SET
                driver_name=?, driver_license_number=?, driver_license_expiry=?,
                capacity_tons=?, status=?, updated_at=?
            WHERE id=?
        """, (
            data.get('driver_name') or v['driver_name'],
            data.get('driver_license_number') or v['driver_license_number'],
            data.get('driver_license_expiry') or v['driver_license_expiry'],
            data.get('capacity_tons') or v['capacity_tons'],
            data.get('status') or v['status'],
            now, vehicle_id
        ))
        conn.commit()
        audit(conn, g.user['id'], 'vehicle', vehicle_id, 'vehicle_updated', None, None)
        return jsonify({'ok': True})
    finally:
        conn.close()
