'use strict';

let _adminPOs = {};

// ── PO List ───────────────────────────────────────────────────────────

async function initAdminPOs() {
  await Promise.all([
    loadAdminPOTab('generated'),
    loadAdminPOTab('acknowledged'),
    loadAdminPOTab('dispatched'),
    loadAdminPOTab('grn_received'),
  ]);
  document.querySelectorAll('#section-pos .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabMap = {
        'po-generated': 'generated',
        'po-acknowledged': 'acknowledged',
        'po-dispatched': 'dispatched',
        'po-grn': 'grn_received',
      };
      const status = tabMap[btn.dataset.tab];
      if (status) loadAdminPOTab(status);
    });
  });
}

async function loadAdminPOTab(status) {
  const tabKey = status === 'grn_received' ? 'po-grn' : `po-${status}`;
  const el = document.getElementById(`${tabKey}-list`);
  if (!el) return;
  try {
    const res = await api('GET', `/api/admin/pos?status=${status}`);
    _adminPOs[status] = Array.isArray(res) ? res : [];
    renderAdminPOTab(status, _adminPOs[status]);
  } catch(e) {
    el.innerHTML = '<div class="empty-state"><p style="color:var(--danger)">Failed to load</p></div>';
  }
}

function renderAdminPOTab(status, pos) {
  const tabKey = status === 'grn_received' ? 'po-grn' : `po-${status}`;
  const el = document.getElementById(`${tabKey}-list`);
  if (!el) return;
  if (!pos.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📦</div><p>No ${status.replace('_', ' ')} POs</p></div>`;
    return;
  }
  el.innerHTML = pos.map(p => `
    <div class="card" style="margin-bottom:0.75rem;">
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:0.5rem;">
          <div>
            <div style="font-size:0.8rem;color:var(--gray-500)">${escHtml(p.po_number)} · ${escHtml(p.rfq_number)}</div>
            <div style="font-weight:600;">${escHtml(p.item_description)}</div>
            <div style="font-size:0.82rem;color:var(--gray-500);margin-top:0.15rem;">${escHtml(p.vendor_name)}</div>
          </div>
          <div style="display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap;">
            ${statusBadge(p.status)}
            ${p.grn_number ? `<span class="badge badge-success">${escHtml(p.grn_number)}</span>` : ''}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:0.5rem;margin-top:0.75rem;font-size:0.82rem;">
          <div><span style="color:var(--gray-500)">Qty: </span>${fmtNum(p.quantity)} ${escHtml(p.quantity_unit || '')}</div>
          <div><span style="color:var(--gray-500)">Value: </span>${fmtMoney(p.grand_total)}</div>
          <div><span style="color:var(--gray-500)">Delivery By: </span>${fmtDate(p.delivery_deadline)}</div>
          ${p.dispatched_at ? `<div><span style="color:var(--gray-500)">Dispatched: </span>${fmtDate(p.dispatched_at)}</div>` : ''}
        </div>
        <div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:0.75rem;flex-wrap:wrap;">
          <button class="btn btn-outline btn-sm" onclick="showAdminPODetail('${p.id}')">View Details</button>
          ${p.status === 'acknowledged' ? `<button class="btn btn-primary btn-sm" onclick="openDispatchModal('${p.id}','${escHtml(p.po_number)}')">Mark Dispatched</button>` : ''}
          ${p.status === 'dispatched' ? `<button class="btn btn-primary btn-sm" onclick="openGRNModal('${p.id}','${escHtml(p.po_number)}',${p.quantity})">Record GRN</button>` : ''}
        </div>
      </div>
    </div>`).join('');
}

// ── PO Detail Modal ───────────────────────────────────────────────────

async function showAdminPODetail(poId) {
  let modal = document.getElementById('admin-po-detail-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'admin-po-detail-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = '<div class="modal-box" style="max-width:700px;"><div id="admin-po-detail-body"></div></div>';
    document.body.appendChild(modal);
  }
  document.getElementById('admin-po-detail-body').innerHTML =
    '<div class="empty-state"><div class="spinner"></div></div>';
  openModal('admin-po-detail-modal');
  try {
    const po = await api('GET', `/api/admin/pos/${poId}`);
    renderAdminPODetailModal(po);
  } catch(e) {
    document.getElementById('admin-po-detail-body').innerHTML =
      `<div class="card-body"><p style="color:var(--danger)">${escHtml(e.message)}</p>
       <button class="btn btn-outline" onclick="closeModal('admin-po-detail-modal')">Close</button></div>`;
  }
}

function renderAdminPODetailModal(po) {
  const body = document.getElementById('admin-po-detail-body');
  body.innerHTML = `
    <div class="modal-header">
      <h3>${escHtml(po.po_number)}</h3>
      <button class="modal-close" onclick="closeModal('admin-po-detail-modal')">×</button>
    </div>
    <div class="modal-body">
      <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:1rem;flex-wrap:wrap;">
        <span style="font-size:0.85rem;color:var(--gray-500)">${escHtml(po.rfq_number)}</span>
        ${statusBadge(po.status)}
      </div>
      <div class="detail-grid">
        <div><div style="font-size:0.75rem;color:var(--gray-500)">Vendor</div><div style="font-weight:600">${escHtml(po.vendor_name)}</div></div>
        <div><div style="font-size:0.75rem;color:var(--gray-500)">Contact</div><div>${escHtml(po.vendor_contact || '—')}</div></div>
        <div><div style="font-size:0.75rem;color:var(--gray-500)">Email</div><div style="font-size:0.85rem">${escHtml(po.vendor_email || '—')}</div></div>
        <div><div style="font-size:0.75rem;color:var(--gray-500)">Mobile</div><div>${escHtml(po.vendor_mobile || '—')}</div></div>
        <div><div style="font-size:0.75rem;color:var(--gray-500)">Item</div><div>${escHtml(po.item_description)}</div></div>
        <div><div style="font-size:0.75rem;color:var(--gray-500)">Quantity</div><div>${fmtNum(po.quantity)} ${escHtml(po.quantity_unit || '')}</div></div>
        <div><div style="font-size:0.75rem;color:var(--gray-500)">Unit Price</div><div>${fmtMoney(po.unit_price)}</div></div>
        <div><div style="font-size:0.75rem;color:var(--gray-500)">GST (${po.gst_rate}%)</div><div>${fmtMoney(po.gst_amount)}</div></div>
        <div><div style="font-size:0.75rem;color:var(--gray-500)">Grand Total</div><div style="font-weight:600">${fmtMoney(po.grand_total)}</div></div>
        <div><div style="font-size:0.75rem;color:var(--gray-500)">Delivery Location</div><div>${escHtml(po.delivery_location)}</div></div>
        <div><div style="font-size:0.75rem;color:var(--gray-500)">Delivery Deadline</div><div>${fmtDate(po.delivery_deadline)}</div></div>
        ${po.acknowledged_at ? `<div><div style="font-size:0.75rem;color:var(--gray-500)">Acknowledged</div><div>${fmtDate(po.acknowledged_at)}</div></div>` : ''}
        ${po.dispatched_at   ? `<div><div style="font-size:0.75rem;color:var(--gray-500)">Dispatched</div><div>${fmtDate(po.dispatched_at)}</div></div>` : ''}
        ${po.dispatch_transport  ? `<div><div style="font-size:0.75rem;color:var(--gray-500)">Transport</div><div>${escHtml(po.dispatch_transport)}</div></div>` : ''}
        ${po.dispatch_lr_number  ? `<div><div style="font-size:0.75rem;color:var(--gray-500)">LR No.</div><div>${escHtml(po.dispatch_lr_number)}</div></div>` : ''}
      </div>
      ${po.grn ? renderAdminGRNSummary(po.grn) : ''}
      <div style="display:flex;gap:0.75rem;justify-content:flex-end;margin-top:1.5rem;flex-wrap:wrap;">
        <button class="btn btn-outline" onclick="closeModal('admin-po-detail-modal')">Close</button>
        ${po.status === 'acknowledged'
          ? `<button class="btn btn-primary" onclick="openDispatchModal('${po.id}','${escHtml(po.po_number)}')">Mark Dispatched</button>`
          : ''}
        ${po.status === 'dispatched'
          ? `<button class="btn btn-primary" onclick="openGRNModal('${po.id}','${escHtml(po.po_number)}',${po.quantity})">Record GRN</button>`
          : ''}
      </div>
    </div>`;
}

function renderAdminGRNSummary(grn) {
  return `
    <div style="margin-top:1.25rem;background:var(--gray-50);border-radius:8px;padding:1rem;">
      <div style="font-weight:600;margin-bottom:0.75rem;">GRN — ${escHtml(grn.grn_number)}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.75rem;font-size:0.875rem;">
        <div><div style="color:var(--gray-500);font-size:0.75rem">Qty Ordered</div>${fmtNum(grn.qty_ordered)}</div>
        <div><div style="color:var(--gray-500);font-size:0.75rem">Qty Received</div><strong>${fmtNum(grn.qty_received)}</strong></div>
        <div><div style="color:var(--gray-500);font-size:0.75rem">Quality</div>${statusBadge(grn.quality_status)}</div>
      </div>
      ${grn.rejection_reason ? `<div style="margin-top:0.5rem;font-size:0.82rem;color:var(--danger)">⚠ ${escHtml(grn.rejection_reason)}</div>` : ''}
      <div style="font-size:0.75rem;color:var(--gray-400);margin-top:0.5rem">Received: ${fmtDate(grn.received_at)}</div>
    </div>`;
}

// ── Dispatch Modal ────────────────────────────────────────────────────

function openDispatchModal(poId, poNumber) {
  let modal = document.getElementById('dispatch-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'dispatch-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }
  const today = new Date().toISOString().split('T')[0];
  modal.innerHTML = `<div class="modal-box" style="max-width:480px;">
    <div class="modal-header">
      <h3>Record Dispatch — ${escHtml(poNumber)}</h3>
      <button class="modal-close" onclick="closeModal('dispatch-modal')">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label required">Transport / Carrier</label>
        <input class="form-control" id="disp-transport" placeholder="e.g. Speed Logistics">
      </div>
      <div class="form-group">
        <label class="form-label">LR Number</label>
        <input class="form-control" id="disp-lr" placeholder="Lorry Receipt Number">
      </div>
      <div class="form-group">
        <label class="form-label required">Dispatch Date</label>
        <input class="form-control" type="date" id="disp-date" value="${today}">
      </div>
      <div id="disp-errors"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal('dispatch-modal')">Cancel</button>
      <button class="btn btn-primary" onclick="submitDispatch('${poId}')">Mark as Dispatched</button>
    </div>
  </div>`;
  openModal('dispatch-modal');
}

async function submitDispatch(poId) {
  const transport = document.getElementById('disp-transport').value.trim();
  const date = document.getElementById('disp-date').value;
  if (!transport) {
    document.getElementById('disp-errors').innerHTML =
      '<div class="alert alert-danger">Transport / carrier is required</div>';
    return;
  }
  if (!date) {
    document.getElementById('disp-errors').innerHTML =
      '<div class="alert alert-danger">Dispatch date is required</div>';
    return;
  }
  Loading.show();
  try {
    await api('POST', `/api/admin/pos/${poId}/dispatch`, {
      dispatch_transport: transport,
      dispatch_lr_number: document.getElementById('disp-lr').value.trim() || null,
      dispatched_at: date,
    });
    Toast.success('PO marked as dispatched');
    closeModal('dispatch-modal');
    closeModal('admin-po-detail-modal');
    await initAdminPOs();
  } catch(e) {
    document.getElementById('disp-errors').innerHTML =
      `<div class="alert alert-danger">${escHtml(e.message)}</div>`;
  } finally {
    Loading.hide();
  }
}

// ── GRN Modal ─────────────────────────────────────────────────────────

function openGRNModal(poId, poNumber, qtyOrdered) {
  let modal = document.getElementById('grn-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'grn-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }
  const today = new Date().toISOString().split('T')[0];
  modal.innerHTML = `<div class="modal-box" style="max-width:520px;">
    <div class="modal-header">
      <h3>Record GRN — ${escHtml(poNumber)}</h3>
      <button class="modal-close" onclick="closeModal('grn-modal')">×</button>
    </div>
    <div class="modal-body">
      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label">Qty Ordered</label>
          <input class="form-control" type="number" value="${qtyOrdered}" disabled>
        </div>
        <div class="form-group">
          <label class="form-label required">Qty Received</label>
          <input class="form-control" type="number" id="grn-qty" value="${qtyOrdered}" step="0.01" min="0">
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label required">Quality Status</label>
          <select class="form-control" id="grn-quality" onchange="toggleGRNRejection()">
            <option value="accepted">Accepted — Full quantity, good quality</option>
            <option value="partial">Partial — Some quantity / quality issues</option>
            <option value="rejected">Rejected — Not acceptable</option>
          </select>
        </div>
        <div class="form-group" style="grid-column:1/-1;display:none" id="grn-rejection-wrap">
          <label class="form-label">Rejection / Issue Notes</label>
          <textarea class="form-control" id="grn-rejection" rows="2" placeholder="Describe quality issues or shortages..."></textarea>
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label required">Date Received</label>
          <input class="form-control" type="date" id="grn-date" value="${today}">
        </div>
      </div>
      <div id="grn-errors"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal('grn-modal')">Cancel</button>
      <button class="btn btn-primary" onclick="submitGRN('${poId}')">Save GRN</button>
    </div>
  </div>`;
  openModal('grn-modal');
}

function toggleGRNRejection() {
  const status = document.getElementById('grn-quality')?.value;
  const wrap   = document.getElementById('grn-rejection-wrap');
  if (wrap) wrap.style.display = status !== 'accepted' ? 'block' : 'none';
}

async function submitGRN(poId) {
  const qty     = parseFloat(document.getElementById('grn-qty').value);
  const quality = document.getElementById('grn-quality').value;
  const reason  = document.getElementById('grn-rejection')?.value.trim();
  const date    = document.getElementById('grn-date').value;

  if (!qty || qty < 0) {
    document.getElementById('grn-errors').innerHTML =
      '<div class="alert alert-danger">Qty received must be ≥ 0</div>';
    return;
  }
  if (!date) {
    document.getElementById('grn-errors').innerHTML =
      '<div class="alert alert-danger">Received date is required</div>';
    return;
  }
  Loading.show();
  try {
    const res = await api('POST', `/api/admin/pos/${poId}/grn`, {
      qty_received: qty,
      quality_status: quality,
      rejection_reason: reason,
      received_at: date,
    });
    Toast.success(`GRN ${res.grn_number} recorded`);
    closeModal('grn-modal');
    closeModal('admin-po-detail-modal');
    await initAdminPOs();
  } catch(e) {
    document.getElementById('grn-errors').innerHTML =
      `<div class="alert alert-danger">${escHtml(e.message)}</div>`;
  } finally {
    Loading.hide();
  }
}
