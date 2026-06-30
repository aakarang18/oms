'use strict';

let _adminRFQs = {};
let _adminRFQDetail = null;
let _approvedVendors = [];

// ── RFQ List ──────────────────────────────────────────────────────────

async function initAdminRFQs() {
  // Load all tabs in parallel
  await Promise.all(['draft', 'published', 'closed', 'awarded'].map(s => loadAdminRFQTab(s)));
  // Wire tab clicks to reload
  document.querySelectorAll('#section-rfqs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabMap = {'rfq-draft':'draft','rfq-published':'published','rfq-closed':'closed','rfq-awarded':'awarded'};
      const status = tabMap[btn.dataset.tab];
      if (status) loadAdminRFQTab(status);
    });
  });
}

async function loadAdminRFQTab(status) {
  const tabId = `rfq-${status}-list`;
  const el = document.getElementById(tabId);
  if (!el) return;
  try {
    const res = await api('GET', `/api/admin/rfqs?status=${status}`);
    _adminRFQs[status] = Array.isArray(res) ? res : [];
    renderAdminRFQTab(status, _adminRFQs[status]);
  } catch(e) {
    el.innerHTML = '<div class="empty-state"><p style="color:var(--danger)">Failed to load</p></div>';
  }
}

function renderAdminRFQTab(status, rfqs) {
  const el = document.getElementById(`rfq-${status}-list`);
  if (!el) return;
  if (!rfqs.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>No ${status} RFQs</p></div>`;
    return;
  }
  el.innerHTML = rfqs.map(r => `
    <div class="card" style="margin-bottom:0.75rem;">
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:0.5rem;">
          <div>
            <div style="font-size:0.8rem;color:var(--gray-500)">${escHtml(r.rfq_number)}</div>
            <div style="font-weight:600;">${escHtml(r.title)}</div>
            ${r.category ? `<div style="font-size:0.82rem;color:var(--gray-500)">${escHtml(r.category)}</div>` : ''}
          </div>
          <div style="display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap;">
            ${statusBadge(r.status)}
            <span class="badge badge-info">${r.quote_count} quote${r.quote_count !== 1 ? 's' : ''}</span>
            ${r.target_type === 'targeted' ? '<span class="badge badge-warning">Targeted</span>' : ''}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:0.5rem;margin-top:0.75rem;font-size:0.82rem;">
          <div><span style="color:var(--gray-500)">Qty: </span>${fmtNum(r.quantity)} ${escHtml(r.quantity_unit || '')}</div>
          <div><span style="color:var(--gray-500)">Location: </span>${escHtml(r.delivery_location)}</div>
          <div><span style="color:var(--gray-500)">Sub. Deadline: </span>${fmtDate(r.submission_deadline)}</div>
          ${r.estimated_value ? `<div><span style="color:var(--gray-500)">Est. Value: </span>${fmtMoney(r.estimated_value)}</div>` : ''}
          ${r.awarded_vendor ? `<div><span style="color:var(--gray-500)">Awarded: </span><strong>${escHtml(r.awarded_vendor)}</strong></div>` : ''}
        </div>
        <div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:0.75rem;flex-wrap:wrap;">
          <button class="btn btn-outline btn-sm" onclick="showAdminRFQDetail('${r.id}')">View Details</button>
          ${r.status === 'draft'     ? `<button class="btn btn-primary btn-sm" onclick="publishRFQ('${r.id}')">Publish</button>` : ''}
          ${r.status === 'published' ? `<button class="btn btn-outline btn-sm" onclick="closeRFQ('${r.id}')">Close Submissions</button>` : ''}
          ${r.status === 'closed'    ? `<button class="btn btn-success btn-sm" onclick="showAdminRFQDetail('${r.id}')">Evaluate & Award</button>` : ''}
          ${r.status !== 'awarded'   ? `<button class="btn btn-ghost btn-sm" onclick="cancelRFQ('${r.id}')">Cancel</button>` : ''}
        </div>
      </div>
    </div>`).join('');
}

// ── RFQ Detail Modal ─────────────────────────────────────────────────

async function showAdminRFQDetail(rfqId) {
  let modal = document.getElementById('admin-rfq-detail-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'admin-rfq-detail-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = '<div class="modal-box" style="max-width:800px;"><div id="admin-rfq-detail-body"></div></div>';
    document.body.appendChild(modal);
  }
  document.getElementById('admin-rfq-detail-body').innerHTML =
    '<div class="empty-state"><div class="spinner"></div></div>';
  openModal('admin-rfq-detail-modal');
  try {
    const rfq = await api('GET', `/api/admin/rfqs/${rfqId}`);
    _adminRFQDetail = rfq;
    renderAdminRFQDetailModal(rfq);
  } catch(e) {
    document.getElementById('admin-rfq-detail-body').innerHTML = `
      <div class="card-body">
        <p style="color:var(--danger)">${escHtml(e.message)}</p>
        <button class="btn btn-outline" onclick="closeModal('admin-rfq-detail-modal')">Close</button>
      </div>`;
  }
}

function renderAdminRFQDetailModal(rfq) {
  const body = document.getElementById('admin-rfq-detail-body');
  body.innerHTML = `
    <div class="modal-header">
      <h3>${escHtml(rfq.title)}</h3>
      <button class="modal-close" onclick="closeModal('admin-rfq-detail-modal')">×</button>
    </div>
    <div class="modal-body">
      <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:1rem;flex-wrap:wrap;">
        <span style="font-size:0.85rem;color:var(--gray-500)">${escHtml(rfq.rfq_number)}</span>
        ${statusBadge(rfq.status)}
        <span class="badge badge-info">${rfq.quotes.length} quote${rfq.quotes.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="detail-grid">
        <div>
          <div style="font-size:0.75rem;color:var(--gray-500)">Quantity</div>
          <div>${fmtNum(rfq.quantity)} ${escHtml(rfq.quantity_unit || '')}</div>
        </div>
        <div>
          <div style="font-size:0.75rem;color:var(--gray-500)">Category</div>
          <div>${escHtml(rfq.category || '—')}</div>
        </div>
        <div>
          <div style="font-size:0.75rem;color:var(--gray-500)">Delivery Location</div>
          <div>${escHtml(rfq.delivery_location)}</div>
        </div>
        <div>
          <div style="font-size:0.75rem;color:var(--gray-500)">Delivery Deadline</div>
          <div>${fmtDate(rfq.delivery_deadline)}</div>
        </div>
        <div>
          <div style="font-size:0.75rem;color:var(--gray-500)">Submission Deadline</div>
          <div>${fmtDate(rfq.submission_deadline)}</div>
        </div>
        <div>
          <div style="font-size:0.75rem;color:var(--gray-500)">Target Type</div>
          <div>${rfq.target_type === 'open' ? 'Open' : 'Targeted'}</div>
        </div>
        ${rfq.estimated_value ? `<div>
          <div style="font-size:0.75rem;color:var(--gray-500)">Estimated Value</div>
          <div>${fmtMoney(rfq.estimated_value)}</div>
        </div>` : ''}
        ${rfq.awarded_vendor_name ? `<div>
          <div style="font-size:0.75rem;color:var(--gray-500)">Awarded To</div>
          <div style="font-weight:600">${escHtml(rfq.awarded_vendor_name)}</div>
        </div>` : ''}
      </div>
      ${rfq.description ? `<div style="margin-top:1rem"><div style="font-size:0.75rem;color:var(--gray-500);margin-bottom:0.3rem">Description</div><p style="margin:0;color:var(--gray-700);font-size:0.875rem">${escHtml(rfq.description)}</p></div>` : ''}
      ${rfq.item_specs   ? `<div style="margin-top:1rem"><div style="font-size:0.75rem;color:var(--gray-500);margin-bottom:0.3rem">Specifications</div><pre style="font-size:0.82rem;background:var(--gray-50);padding:0.75rem;border-radius:6px;white-space:pre-wrap;margin:0">${escHtml(rfq.item_specs)}</pre></div>` : ''}

      ${rfq.quotes.length
        ? `<h4 style="margin:1.5rem 0 0.75rem;">Quote Comparison <span style="font-weight:400;font-size:0.82rem;color:var(--gray-500)">(lowest price first)</span></h4>
           ${renderQuoteComparisonTable(rfq)}`
        : '<div class="alert alert-info" style="margin-top:1rem;">No quotes submitted yet.</div>'}

      <div style="display:flex;gap:0.75rem;justify-content:flex-end;margin-top:1.5rem;flex-wrap:wrap;">
        <button class="btn btn-outline" onclick="closeModal('admin-rfq-detail-modal')">Close</button>
        ${rfq.status === 'draft'     ? `<button class="btn btn-primary" onclick="publishRFQ('${rfq.id}')">Publish RFQ</button>` : ''}
        ${rfq.status === 'published' ? `<button class="btn btn-warning" onclick="closeRFQ('${rfq.id}')">Close Submissions</button>` : ''}
        ${rfq.status !== 'awarded'   ? `<button class="btn btn-ghost" onclick="cancelRFQ('${rfq.id}')">Cancel RFQ</button>` : ''}
      </div>
    </div>`;
}

function renderQuoteComparisonTable(rfq) {
  const canAward = rfq.status === 'closed';
  const lowestTotal = rfq.quotes.length ? Math.min(...rfq.quotes.map(q => q.grand_total)) : null;
  return `<div style="overflow-x:auto"><table class="data-table">
    <thead><tr>
      <th>Vendor</th><th>Unit Price</th><th>Base Total</th><th>GST</th>
      <th>Grand Total</th><th>Lead Time</th><th>Valid Until</th><th>Rating</th>
      ${canAward ? '<th>Action</th>' : ''}
    </tr></thead>
    <tbody>${rfq.quotes.map(q => {
      const isLowest = q.grand_total === lowestTotal;
      return `<tr style="${isLowest ? 'background:var(--gray-50)' : ''}">
        <td>
          <div style="font-weight:${isLowest ? '600' : '400'}">${escHtml(q.company_name)}${isLowest ? ' 🏆' : ''}</div>
          <div style="font-size:0.75rem;color:var(--gray-500)">${escHtml(q.contact_name || '')} · v${q.version}</div>
          ${q.notes ? `<div style="font-size:0.75rem;font-style:italic;margin-top:2px;color:var(--gray-600)">${escHtml(q.notes)}</div>` : ''}
        </td>
        <td>${fmtMoney(q.unit_price)}</td>
        <td>${fmtMoney(q.total_amount)}</td>
        <td>${q.gst_rate}%</td>
        <td style="font-weight:600">${fmtMoney(q.grand_total)}</td>
        <td>${q.lead_time_days}d</td>
        <td style="font-size:0.82rem">${fmtDate(q.validity_date)}</td>
        <td>${q.rating ? '★'.repeat(Math.round(q.rating)) + ` (${q.rating})` : '—'}</td>
        ${canAward ? `<td><button class="btn btn-success btn-sm" onclick="awardRFQ('${rfq.id}','${q.id}','${escHtml(q.company_name)}')">Award</button></td>` : ''}
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

// ── RFQ Actions ───────────────────────────────────────────────────────

async function publishRFQ(rfqId) {
  if (!confirm('Publish this RFQ to vendors?')) return;
  Loading.show();
  try {
    await api('POST', `/api/admin/rfqs/${rfqId}/publish`);
    Toast.success('RFQ published');
    closeModal('admin-rfq-detail-modal');
    await initAdminRFQs();
  } catch(e) { Toast.error(e.message); }
  finally { Loading.hide(); }
}

async function closeRFQ(rfqId) {
  if (!confirm('Close submissions for this RFQ? Vendors will no longer be able to submit quotes.')) return;
  Loading.show();
  try {
    await api('POST', `/api/admin/rfqs/${rfqId}/close`);
    Toast.success('Submissions closed');
    closeModal('admin-rfq-detail-modal');
    await initAdminRFQs();
  } catch(e) { Toast.error(e.message); }
  finally { Loading.hide(); }
}

async function cancelRFQ(rfqId) {
  if (!confirm('Cancel this RFQ? This cannot be undone.')) return;
  Loading.show();
  try {
    await api('POST', `/api/admin/rfqs/${rfqId}/cancel`);
    Toast.success('RFQ cancelled');
    closeModal('admin-rfq-detail-modal');
    await initAdminRFQs();
  } catch(e) { Toast.error(e.message); }
  finally { Loading.hide(); }
}

async function awardRFQ(rfqId, quoteId, vendorName) {
  if (!confirm(`Award this RFQ to ${vendorName}?\n\nA Purchase Order will be created automatically.`)) return;
  Loading.show();
  try {
    const res = await api('POST', `/api/admin/rfqs/${rfqId}/award`, { quote_id: quoteId });
    Toast.success(`RFQ awarded! PO ${res.po_number} created.`, 6000);
    closeModal('admin-rfq-detail-modal');
    await initAdminRFQs();
  } catch(e) { Toast.error(e.message); }
  finally { Loading.hide(); }
}

// ── Quote Comparison ──────────────────────────────────────────────────

async function initQuoteComparison() {
  const el = document.getElementById('quote-compare-list');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--gray-500);">Loading...</div>';
  try {
    const [closed, awarded] = await Promise.all([
      api('GET', '/api/admin/rfqs?status=closed').catch(() => []),
      api('GET', '/api/admin/rfqs?status=awarded').catch(() => []),
    ]);
    const rfqs = [...(Array.isArray(closed) ? closed : []), ...(Array.isArray(awarded) ? awarded : [])];
    if (!rfqs.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">💬</div><p>No closed or awarded RFQs to compare</p></div>';
      return;
    }
    el.innerHTML = rfqs.map(r => `
      <div class="card" style="margin-bottom:0.75rem;">
        <div class="card-body" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
          <div>
            <div style="font-size:0.8rem;color:var(--gray-500)">${escHtml(r.rfq_number)}</div>
            <div style="font-weight:600;">${escHtml(r.title)}</div>
            <div style="font-size:0.82rem;color:var(--gray-500)">${r.quote_count != null ? `${r.quote_count} quote(s)` : ''}</div>
          </div>
          <div style="display:flex;gap:0.5rem;align-items:center;">
            ${statusBadge(r.status)}
            <button class="btn btn-primary btn-sm" onclick="showAdminRFQDetail('${r.id}')">Compare Quotes</button>
          </div>
        </div>
      </div>`).join('');
  } catch(e) {
    el.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">${escHtml(e.message)}</p></div>`;
  }
}

// ── Create RFQ Modal ──────────────────────────────────────────────────

async function openCreateRFQModal() {
  try {
    const vs = await api('GET', '/api/admin/vendors/approved');
    _approvedVendors = Array.isArray(vs) ? vs : [];
  } catch { _approvedVendors = []; }

  let modal = document.getElementById('modal-create-rfq');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-create-rfq';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `<div class="modal-box" style="max-width:700px;">
    <div class="modal-header">
      <h3>Create New RFQ</h3>
      <button class="modal-close" onclick="closeModal('modal-create-rfq')">×</button>
    </div>
    <div class="modal-body">
      <div class="form-grid-2">
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label required">Title / Item Description</label>
          <input class="form-control" id="rfq-title" placeholder="e.g. Aluminium Ingots — Grade A">
        </div>
        <div class="form-group">
          <label class="form-label required">Quantity</label>
          <input class="form-control" type="number" id="rfq-qty" placeholder="e.g. 1000" step="0.01" min="0">
        </div>
        <div class="form-group">
          <label class="form-label">Unit</label>
          <input class="form-control" id="rfq-unit" placeholder="MT / KG / PCS">
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label required">Delivery Location</label>
          <input class="form-control" id="rfq-location" placeholder="City, Plant / Warehouse">
        </div>
        <div class="form-group">
          <label class="form-label required">Submission Deadline</label>
          <input class="form-control" type="datetime-local" id="rfq-sub-deadline">
        </div>
        <div class="form-group">
          <label class="form-label required">Delivery Deadline</label>
          <input class="form-control" type="date" id="rfq-del-deadline">
        </div>
        <div class="form-group">
          <label class="form-label">Category</label>
          <input class="form-control" id="rfq-category" placeholder="Aluminium / Chemicals / etc.">
        </div>
        <div class="form-group">
          <label class="form-label">Estimated Value (₹)</label>
          <input class="form-control" type="number" id="rfq-est-value" placeholder="Optional" step="0.01">
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Item Specifications</label>
          <textarea class="form-control" id="rfq-specs" rows="3" placeholder="Technical specs, grade, purity..."></textarea>
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Terms & Conditions</label>
          <textarea class="form-control" id="rfq-terms" rows="2" placeholder="Payment terms, delivery conditions..."></textarea>
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Vendor Scope</label>
          <div style="display:flex;gap:1.5rem;margin-top:0.25rem;">
            <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;font-size:0.9rem;">
              <input type="radio" name="rfq-target" value="open" checked> Open to all approved vendors
            </label>
            <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;font-size:0.9rem;">
              <input type="radio" name="rfq-target" value="targeted" onchange="toggleRFQTargeted(this.value==='targeted')"> Targeted (invite specific vendors)
            </label>
          </div>
        </div>
        <div id="targeted-vendors-wrap" style="grid-column:1/-1;display:none;">
          <label class="form-label">Select Vendors</label>
          <div style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;padding:0.5rem;">
            ${_approvedVendors.length
              ? _approvedVendors.map(v => `
                <label style="display:flex;align-items:center;gap:0.5rem;padding:0.35rem;cursor:pointer;font-size:0.875rem;">
                  <input type="checkbox" name="target-vendor" value="${v.id}">
                  ${escHtml(v.company_name)}
                  ${v.contact_email ? `<span style="color:var(--gray-400);font-size:0.75rem">(${escHtml(v.contact_email)})</span>` : ''}
                </label>`).join('')
              : '<p style="color:var(--gray-500);font-size:0.875rem;padding:0.5rem;margin:0">No approved vendors available</p>'}
          </div>
        </div>
      </div>
      <div id="create-rfq-errors"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal('modal-create-rfq')">Cancel</button>
      <button class="btn btn-primary" onclick="saveAdminRFQ()">Create RFQ</button>
    </div>
  </div>`;
  openModal('modal-create-rfq');
  document.querySelectorAll('input[name="rfq-target"]').forEach(r => {
    r.addEventListener('change', () => toggleRFQTargeted(r.value === 'targeted'));
  });
}

function toggleRFQTargeted(show) {
  const wrap = document.getElementById('targeted-vendors-wrap');
  if (wrap) wrap.style.display = show ? 'block' : 'none';
}

async function saveAdminRFQ() {
  const errs = [];
  const title    = document.getElementById('rfq-title').value.trim();
  const qty      = parseFloat(document.getElementById('rfq-qty').value);
  const location = document.getElementById('rfq-location').value.trim();
  const subDl    = document.getElementById('rfq-sub-deadline').value;
  const delDl    = document.getElementById('rfq-del-deadline').value;

  if (!title)         errs.push('Title is required');
  if (!qty || qty<=0) errs.push('Quantity must be > 0');
  if (!location)      errs.push('Delivery location is required');
  if (!subDl)         errs.push('Submission deadline is required');
  if (!delDl)         errs.push('Delivery deadline is required');

  if (errs.length) {
    document.getElementById('create-rfq-errors').innerHTML =
      `<div class="alert alert-danger"><ul style="margin:0;padding-left:1.2rem">${errs.map(e => `<li>${escHtml(e)}</li>`).join('')}</ul></div>`;
    return;
  }

  const targetType = document.querySelector('input[name="rfq-target"]:checked')?.value || 'open';
  const targetedVendors = targetType === 'targeted'
    ? [...document.querySelectorAll('input[name="target-vendor"]:checked')].map(el => el.value)
    : [];

  const payload = {
    title,
    quantity: qty,
    quantity_unit:     document.getElementById('rfq-unit').value.trim(),
    delivery_location: location,
    submission_deadline: subDl.replace('T', ' '),
    delivery_deadline:   delDl,
    category:          document.getElementById('rfq-category').value.trim(),
    estimated_value:   parseFloat(document.getElementById('rfq-est-value').value) || null,
    item_specs:        document.getElementById('rfq-specs').value.trim(),
    terms_conditions:  document.getElementById('rfq-terms').value.trim(),
    target_type:       targetType,
    targeted_vendors:  targetedVendors,
  };

  Loading.show();
  try {
    const res = await api('POST', '/api/admin/rfqs', payload);
    Toast.success(`RFQ ${res.rfq_number} created`);
    closeModal('modal-create-rfq');
    await initAdminRFQs();
  } catch(e) {
    document.getElementById('create-rfq-errors').innerHTML =
      `<div class="alert alert-danger">${escHtml(e.message)}</div>`;
  } finally {
    Loading.hide();
  }
}
