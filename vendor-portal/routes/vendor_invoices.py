from flask import Blueprint, jsonify, g, request
from datetime import datetime
from database import get_db
from auth import vendor_required, new_id, audit

bp = Blueprint('vendor_invoices', __name__)

NOW = lambda: datetime.utcnow().isoformat()


@bp.get('/api/vendor/invoices')
@vendor_required
def list_vendor_invoices():
    vendor_id = g.user['entity_id']
    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT i.*,
                   p.po_number,
                   g.grn_number
            FROM invoices i
            LEFT JOIN purchase_orders p ON p.id = i.linked_po_id
            LEFT JOIN grns g ON g.id = i.linked_grn_id
            WHERE i.party_type='vendor' AND i.party_id=?
            ORDER BY i.submitted_at DESC
        """, (vendor_id,)).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()


@bp.get('/api/vendor/invoices/<inv_id>')
@vendor_required
def get_vendor_invoice(inv_id):
    vendor_id = g.user['entity_id']
    conn = get_db()
    try:
        row = conn.execute("""
            SELECT i.*,
                   p.po_number, p.total_value as po_value,
                   g.grn_number, g.received_qty
            FROM invoices i
            LEFT JOIN purchase_orders p ON p.id = i.linked_po_id
            LEFT JOIN grns g ON g.id = i.linked_grn_id
            WHERE i.id=? AND i.party_type='vendor' AND i.party_id=?
        """, (inv_id, vendor_id)).fetchone()
        if not row:
            return jsonify({'error': 'Not found'}), 404
        result = dict(row)
        pmts = conn.execute(
            "SELECT * FROM payments WHERE invoice_id=? ORDER BY created_at",
            (inv_id,)
        ).fetchall()
        result['payments'] = [dict(p) for p in pmts]
        return jsonify(result)
    finally:
        conn.close()


@bp.post('/api/vendor/invoices')
@vendor_required
def submit_vendor_invoice():
    vendor_id = g.user['entity_id']
    data = request.get_json(silent=True) or {}

    invoice_ref   = (data.get('invoice_ref') or '').strip()
    invoice_date  = (data.get('invoice_date') or '').strip()
    linked_po_id  = (data.get('linked_po_id') or '').strip() or None
    linked_grn_id = (data.get('linked_grn_id') or '').strip() or None
    invoice_ref_path = (data.get('invoice_ref_path') or '').strip()
    gstin         = (data.get('gstin') or '').strip() or None
    hsn_codes     = (data.get('hsn_codes') or '').strip() or None

    try:
        taxable_amount = float(data.get('taxable_amount', 0))
        cgst_amount    = float(data.get('cgst_amount', 0))
        sgst_amount    = float(data.get('sgst_amount', 0))
        igst_amount    = float(data.get('igst_amount', 0))
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid amount'}), 400

    if not invoice_ref or not invoice_date:
        return jsonify({'error': 'invoice_ref and invoice_date are required'}), 400
    if taxable_amount <= 0:
        return jsonify({'error': 'taxable_amount must be positive'}), 400

    total_gst   = cgst_amount + sgst_amount + igst_amount
    grand_total = taxable_amount + total_gst

    conn = get_db()
    try:
        if linked_po_id:
            po = conn.execute(
                "SELECT id FROM purchase_orders WHERE id=? AND vendor_id=? AND is_deleted=0",
                (linked_po_id, vendor_id)
            ).fetchone()
            if not po:
                return jsonify({'error': 'PO not found'}), 404

        if linked_grn_id:
            grn = conn.execute(
                "SELECT id FROM grns WHERE id=?", (linked_grn_id,)
            ).fetchone()
            if not grn:
                return jsonify({'error': 'GRN not found'}), 404

        inv_id = new_id()
        now = NOW()
        conn.execute("""
            INSERT INTO invoices
              (id, invoice_ref, invoice_date, party_type, party_id,
               linked_po_id, linked_grn_id, invoice_pdf_path,
               gstin, hsn_codes, taxable_amount, cgst_amount,
               sgst_amount, igst_amount, total_gst, grand_total,
               status, submitted_at, created_at, updated_at)
            VALUES (?,?,?,?,?, ?,?,?, ?,?,?,?, ?,?,?,?, ?,?,?,?)
        """, (inv_id, invoice_ref, invoice_date, 'vendor', vendor_id,
              linked_po_id, linked_grn_id, invoice_ref_path,
              gstin, hsn_codes, taxable_amount, cgst_amount,
              sgst_amount, igst_amount, total_gst, grand_total,
              'submitted', now, now, now))
        conn.commit()
        audit(g.user['id'], 'invoice', inv_id, 'submit', None, {
            'invoice_ref': invoice_ref, 'grand_total': grand_total
        })
        return jsonify({'id': inv_id, 'status': 'submitted'}), 201
    finally:
        conn.close()


@bp.get('/api/vendor/pos-for-invoice')
@vendor_required
def vendor_pos_for_invoice():
    vendor_id = g.user['entity_id']
    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT p.id, p.po_number, p.total_value,
                   g.id as grn_id, g.grn_number, g.received_qty
            FROM purchase_orders p
            LEFT JOIN grns g ON g.po_id = p.id
            WHERE p.vendor_id=? AND p.is_deleted=0
              AND p.status IN ('delivered','partial_delivered')
            ORDER BY p.created_at DESC
        """, (vendor_id,)).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()
