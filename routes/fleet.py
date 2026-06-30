"""Transporter fleet — vehicle detail endpoint (list/add/docs are in transporter_reg)."""
from flask import Blueprint, jsonify, g
from database import get_db
from auth import transporter_required

bp = Blueprint('fleet', __name__)


@bp.get('/api/transporter/vehicles/<vehicle_id>')
@transporter_required
def get_vehicle_detail(vehicle_id):
    tid = g.user['entity_id']
    conn = get_db()
    try:
        v = conn.execute(
            "SELECT * FROM vehicles WHERE id=? AND transporter_id=? AND is_deleted=0",
            (vehicle_id, tid)
        ).fetchone()
        if not v:
            return jsonify({'error': 'Not found'}), 404
        result = dict(v)
        docs = conn.execute(
            "SELECT * FROM vehicle_documents WHERE vehicle_id=? AND is_deleted=0",
            (vehicle_id,)
        ).fetchall()
        result['documents'] = [dict(d) for d in docs]
        return jsonify(result)
    finally:
        conn.close()
