'use strict';

// ── Purchase Orders ───────────────────────────────────────────────────

async function loadVendorPOs() {
  const activeEl = document.getElementById('pos-active-list');
  const allEl    = document.getElementById('pos-all-list');
  if (!activeEl && !allEl) return;
  if (activeEl) activeEl.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
  if (allEl)    allEl.innerHTML    = '<div class="empty-state"><div class="spinner"></div></div>';
  try {
    const res = await api('GET', '/api/vendor/pos');
    const pos = Array.isArray(res) ? res : [];
    const active = pos.filter(p => !['grn_received', 'cancelled'].includes(p.status));
    renderVendorPOList('pos-active-list', active, true);
    renderVendorPOList('pos-all-list', pos, false);
  } catch(e) {
    if (activeEl) activeEl.innerHTML = '<div class="empty-state"><p style="color:var(--danger)">Failed to load POs</p></div>';
  }
}

function renderVendorPOList(containerId, pos, activeTab) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!pos.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📦</div><p>${activeTab ? 'No active POs' : 'No POs yet'}</p></div>`;
    return;
  }
  el.innerHTML = pos.map(p => {
    const needsAck  = p.status === 'generated';
    const needsDisp = p.status === 'acknowledged';
    return `
    <div class="card" style="margin-bottom:0.75rem;">
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:0.5rem;">
          <div>
            <div style="font-size:0.8rem;color:var(--gray-500)">${escHtml(p.po_number)} · ${escHtml(p.rfq_number)}</div>
            <div style="font-weight:600;margin-top:0.15rem;">${escHtml(p.item_description)}</div>
          </div>
          <div>${statusBadge(p.status)}</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:0.5rem;margin-top:0.75rem;font-size:0.82rem;">
          <div><span style="color:var(--gray-500)">Qty: </span>${fmtNum(p.quantity)} ${escHtml(p.quantity_unit || '')}</div>
          <div><span style="color:var(--gray-500)">Grand Total: </span><strong>${fmtMoney(p.grand_total)}</strong></div>
          <div><span style="color:var(--gray-500)">Delivery By: </span>${fmtDate(p.delivery_deadline)}</div>
          <div><span style="color:var(--gray-500)">Deliver To: </span>${escHtml(p.delivery_location)}</div>
          ${p.dispatched_at ? `<div><span style="color:var(--gray-500)">Dispatched: </span>${fmtDate(p.dispatched_at)}</div>` : ''}
          ${p.dispatch_lr_number ? `<div><span style="color:var(--gray-500)">LR No.: </span>${escHtml(p.dispatch_lr_number)}</div>` : ''}
        </div>
        <div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:0.75rem;flex-wrap:wrap;">
          <button class="btn btn-outline btn-sm" onclick="showVendorPODetail('${p.id}')">View Details</button>
          ${needsAck  ? `<button class="btn btn-primary btn-sm" onclick="acknowledgeVendorPO('${p.id}')">Acknowledge PO</button>` : ''}
          ${needsDisp ? `<button class="btn btn-success btn-sm" onclick="openDispatchModal('${p.id}')">Update Dispatch</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

async function showVendorPODetail(poId) {
  let modal = document.getElementById('vendor-po-detail-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'vendor-po-detail-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = '<div class="modal-box" style="max-width:660px;"><div id="vendor-po-detail-body"></div></div>';
    document.body.appendChild(modal);
  }
  document.getElementById('vendor-po-detail-body').innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
  openModal('vendor-po-detail-modal');
  try {
    const po = await api('GET', `/api/vendor/pos/${poId}`);
    renderVendorPODetailModal(po);
  } catch(e) {
    document.getElementById('vendor-po-detail-body').innerHTML =
      `<div class="card-body"><p style="color:var(--danger)">${escHtml(e.message)}</p>
       <button class="btn btn-outline" onclick="closeModal('vendor-po-detail-modal')">Close</button></div>`;
  }
}

function renderVendorPODetailModal(po) {
  const needsAck  = po.status === 'generated';
  const needsDisp = po.status === 'acknowledged';
  document.getElementById('vendor-po-detail-body').innerHTML = `
    <div class="modal-header">
      <h3>${escHtml(po.po_number)}</h3>
      <button class="modal-close" onclick="closeModal('vendor-po-detail-modal')">×</button>
    </div>
    <div class="modal-body">
      <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:1rem;">
        <span style="font-size:0.85rem;color:var(--gray-500)">${escHtml(po.rfq_number)}</span>
        ${statusBadge(po.status)}
      </div>
      <div class="detail-grid">
        <div><div style="font-size:0.75rem;color:var(--gray-500)">Item</div><div>${escHtml(po.item_description)}</div></div>
        <div><div style="font-size:0.75rem;color:var(--gray-500)">Quantity</div><div>${fmtNum(po.quantity)} ${escHtml(po.quantity_unit || '')}</div></div>
        <div><div style="font-size:0.75rem;color:var(--gray-500)">Unit Price</div><div>${fmtMoney(po.unit_price)}</div></div>
        <div><div style="font-size:0.75rem;color:var(--gray-500)">GST (${po.gst_rate}%)</div><div>${fmtMoney(po.gst_amount)}</div></div>
        <div><div style="font-size:0.75rem;color:var(--gray-500)">Grand Total</div><div style="font-weight:600">${fmtMoney(po.grand_total)}</div></div>
        <div><div style="font-size:0.75rem;color:var(--gray-500)">Delivery Location</div><div>${escHtml(po.delivery_location)}</div></div>
        <div><div style="font-size:0.75rem;color:var(--gray-500)">Delivery Deadline</div><div>${fmtDate(po.delivery_deadline)}</div></div>
        ${po.acknowledged_at ? `<div><div style="font-size:0.75rem;color:var(--gray-500)">Acknowledged</div><div>${fmtDate(po.acknowledged_at)}</div></div>` : ''}
        ${po.dispatched_at   ? `<div><div style="font-size:0.75rem;color:var(--gray-500)">Dispatched</div><div>${fmtDate(po.dispatched_at)}</div></div>` : ''}
        ${po.dispatch_transport ? `<div><div style="font-size:0.75rem;color:var(--gray-500)">Transport</div><div>${escHtml(po.dispatch_transport)}</div></div>` : ''}
        ${po.dispatch_lr_number ? `<div><div style="font-size:0.75rem;color:var(--gray-500)">LR No.</div><div>${escHtml(po.dispatch_lr_number)}</div></div>` : ''}
        ${po.dispatch_notes ? `<div style="grid-column:1/-1"><div style="font-size:0.75rem;color:var(--gray-500)">Dispatch Notes</div><div>${escHtml(po.dispatch_notes)}</div></div>` : ''}
      </div>
      ${po.terms_conditions ? `<div style="margin-top:1rem"><div style="font-size:0.75rem;color:var(--gray-500);margin-bottom:0.3rem">Terms & Conditions</div><p style="font-size:0.82rem;margin:0;color:var(--gray-600)">${escHtml(po.terms_conditions)}</p></div>` : ''}
      ${po.grn ? renderGRNSummary(po.grn) : ''}
      <div style="display:flex;gap:0.75rem;justify-content:flex-end;margin-top:1.5rem;flex-wrap:wrap;">
        <button class="btn btn-outline" onclick="closeModal('vendor-po-detail-modal')">Close</button>
        ${needsAck  ? `<button class="btn btn-primary" onclick="acknowledgeVendorPO('${po.id}')">Acknowledge PO</button>` : ''}
        ${needsDisp ? `<button class="btn btn-success" onclick="openDispatchModal('${po.id}')">Update Dispatch Info</button>` : ''}
      </div>
    </div>`;
}

function renderGRNSummary(grn) {
  return `
    <div style="margin-top:1rem;background:var(--gray-50);border-radius:8px;padding:1rem;">
      <div style="font-weight:600;margin-bottom:0.75rem;">GRN — ${escHtml(grn.grn_number)}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.75rem;font-size:0.875rem;">
        <div><div style="color:var(--gray-500);font-size:0.75rem">Qty Ordered</div>${fmtNum(grn.qty_ordered)}</div>
        <div><div style="color:var(--gray-500);font-size:0.75rem">Qty Received</div>${fmtNum(grn.qty_received)}</div>
        <div><div style="color:var(--gray-500);font-size:0.75rem">Quality</div>${statusBadge(grn.quality_status)}</div>
      </div>
      ${grn.rejection_reason ? `<div style="margin-top:0.5rem;font-size:0.82rem;color:var(--danger)">${escHtml(grn.rejection_reason)}</div>` : ''}
    </div>`;
}

async function acknowledgeVendorPO(poId) {
  if (!confirm('Acknowledge this Purchase Order? This confirms you have received and accepted the PO terms.')) return;
  Loading.show();
  try {
    await api('POST', `/api/vendor/pos/${poId}/acknowledge`);
    Toast.success('PO acknowledged successfully');
    closeModal('vendor-po-detail-modal');
    await loadVendorPOs();
  } catch(e) {
    Toast.error(e.message || 'Failed to acknowledge');
  } finally {
    Loading.hide();
  }
}

function openDispatchModal(poId) {
  let modal = document.getElementById('dispatch-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'dispatch-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }
  const today = new Date().toISOString().split('T')[0];
  modal.innerHTML = `<div class="modal-box" style="max-width:500px;">
    <div class="modal-header">
      <h3>Update Dispatch Details</h3>
      <button class="modal-close" onclick="closeModal('dispatch-modal')">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label required">Transporter / Vehicle Details</label>
        <input class="form-control" id="disp-transport" placeholder="e.g. ABC Transport, Vehicle MH01AB1234">
      </div>
      <div class="form-group">
        <label class="form-label">LR / Docket Number</label>
        <input class="form-control" id="disp-lr" placeholder="Lorry receipt number">
      </div>
      <div class="form-group">
        <label class="form-label required">Dispatch Date</label>
        <input class="form-control" type="date" id="disp-date" value="${today}">
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-control" id="disp-notes" rows="2" placeholder="Any additional dispatch notes..."></textarea>
      </div>
      <div id="dispatch-errors"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal('dispatch-modal')">Cancel</button>
      <button class="btn btn-success" onclick="submitDispatch('${poId}')">Save Dispatch Info</button>
    </div>
  </div>`;
  openModal('dispatch-modal');
}

async function submitDispatch(poId) {
  const transport = document.getElementById('disp-transport').value.trim();
  const lr        = document.getElementById('disp-lr').value.trim();
  const date      = document.getElementById('disp-date').value;
  if (!transport) {
    document.getElementById('dispatch-errors').innerHTML =
      '<div class="alert alert-danger">Transporter / vehicle details are required</div>';
    return;
  }
  if (!date) {
    document.getElementById('dispatch-errors').innerHTML =
      '<div class="alert alert-danger">Dispatch date is required</div>';
    return;
  }
  const notes = document.getElementById('disp-notes').value.trim();
  Loading.show();
  try {
    await api('POST', `/api/vendor/pos/${poId}/dispatch`,
      { dispatch_transport: transport, dispatch_lr_number: lr, dispatched_at: date, dispatch_notes: notes || null });
    Toast.success('Dispatch details saved');
    closeModal('dispatch-modal');
    closeModal('vendor-po-detail-modal');
    await loadVendorPOs();
  } catch(e) {
    Toast.error(e.message || 'Failed to save dispatch info');
  } finally {
    Loading.hide();
  }
}
