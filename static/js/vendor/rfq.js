'use strict';

let _rfqList = [];
let _rfqDetail = null;

// ── Open RFQs ────────────────────────────────────────────────────────

async function loadVendorRFQs() {
  const wrap = document.getElementById('rfq-list-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
  try {
    const res = await api('GET', '/api/vendor/rfqs');
    _rfqList = Array.isArray(res) ? res : [];
    renderVendorRFQList(_rfqList);
  } catch(e) {
    wrap.innerHTML = '<div class="empty-state"><p style="color:var(--danger)">Failed to load RFQs</p></div>';
  }
}

function renderVendorRFQList(rfqs) {
  const wrap = document.getElementById('rfq-list-wrap');
  if (!rfqs.length) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>No open RFQs available at this time.</p></div>';
    return;
  }
  const now = new Date();
  wrap.innerHTML = rfqs.map(r => {
    const deadline = new Date(r.submission_deadline);
    const daysLeft = Math.ceil((deadline - now) / 86400000);
    const urgency = daysLeft <= 2 ? 'danger' : daysLeft <= 5 ? 'warning' : '';
    const hasQuote = !!r.my_quote_id;
    return `
      <div class="card" style="margin-bottom:1rem;">
        <div class="card-body">
          <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:0.5rem;">
            <div>
              <div style="font-size:0.8rem;color:var(--gray-500);margin-bottom:0.25rem;">${escHtml(r.rfq_number)}</div>
              <div style="font-weight:600;font-size:1rem;">${escHtml(r.title)}</div>
              ${r.category ? `<div style="font-size:0.82rem;color:var(--gray-500);margin-top:0.2rem;">${escHtml(r.category)}</div>` : ''}
            </div>
            <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
              ${hasQuote ? '<span class="badge badge-success">Quote Submitted</span>' : '<span class="badge badge-info">Open</span>'}
              ${r.target_type === 'targeted' ? '<span class="badge badge-warning">Invited</span>' : ''}
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:0.75rem;margin-top:1rem;">
            <div>
              <div style="font-size:0.75rem;color:var(--gray-500);">Quantity</div>
              <div style="font-size:0.875rem;font-weight:500;">${fmtNum(r.quantity)} ${escHtml(r.quantity_unit || '')}</div>
            </div>
            <div>
              <div style="font-size:0.75rem;color:var(--gray-500);">Delivery Location</div>
              <div style="font-size:0.875rem;">${escHtml(r.delivery_location)}</div>
            </div>
            <div>
              <div style="font-size:0.75rem;color:var(--gray-500);">Submission Deadline</div>
              <div style="font-size:0.875rem;${urgency ? `color:var(--${urgency});font-weight:600` : ''}">${fmtDate(r.submission_deadline)}</div>
              ${urgency ? `<div style="font-size:0.75rem;color:var(--${urgency});">${daysLeft <= 0 ? 'Deadline passed' : `${daysLeft}d left`}</div>` : ''}
            </div>
            ${hasQuote ? `<div>
              <div style="font-size:0.75rem;color:var(--gray-500);">My Quote</div>
              <div style="font-size:0.875rem;font-weight:600;color:var(--primary)">${fmtMoney(r.my_quote_total)}</div>
            </div>` : ''}
          </div>
          <div style="margin-top:0.75rem;text-align:right;">
            <button class="btn btn-primary btn-sm" onclick="showVendorRFQDetail('${r.id}')">
              ${hasQuote ? 'View / Update Quote' : 'Submit Quote →'}
            </button>
          </div>
        </div>
      </div>`;
  }).join('');
}

async function showVendorRFQDetail(rfqId) {
  let modal = document.getElementById('rfq-detail-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'rfq-detail-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = '<div class="modal-box" style="max-width:680px;"><div id="rfq-detail-body"></div></div>';
    document.body.appendChild(modal);
  }
  document.getElementById('rfq-detail-body').innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
  openModal('rfq-detail-modal');
  try {
    const rfq = await api('GET', `/api/vendor/rfqs/${rfqId}`);
    _rfqDetail = rfq;
    renderRFQDetailModal(rfq);
  } catch(e) {
    document.getElementById('rfq-detail-body').innerHTML = `
      <div class="card-body">
        <p style="color:var(--danger)">${escHtml(e.message)}</p>
        <button class="btn btn-outline" onclick="closeModal('rfq-detail-modal')">Close</button>
      </div>`;
  }
}

function renderRFQDetailModal(rfq) {
  const deadlinePassed = new Date().toISOString() > rfq.submission_deadline;
  document.getElementById('rfq-detail-body').innerHTML = `
    <div class="modal-header">
      <h3>${escHtml(rfq.title)}</h3>
      <button class="modal-close" onclick="closeModal('rfq-detail-modal')">×</button>
    </div>
    <div class="modal-body">
      <div style="font-size:0.8rem;color:var(--gray-500);margin-bottom:1rem;">${escHtml(rfq.rfq_number)}</div>
      <div class="detail-grid">
        <div>
          <div style="font-size:0.75rem;color:var(--gray-500);">Quantity</div>
          <div>${fmtNum(rfq.quantity)} ${escHtml(rfq.quantity_unit || '')}</div>
        </div>
        <div>
          <div style="font-size:0.75rem;color:var(--gray-500);">Category</div>
          <div>${escHtml(rfq.category || '—')}</div>
        </div>
        <div>
          <div style="font-size:0.75rem;color:var(--gray-500);">Delivery Location</div>
          <div>${escHtml(rfq.delivery_location)}</div>
        </div>
        <div>
          <div style="font-size:0.75rem;color:var(--gray-500);">Delivery Deadline</div>
          <div>${fmtDate(rfq.delivery_deadline)}</div>
        </div>
        <div>
          <div style="font-size:0.75rem;color:var(--gray-500);">Submission Deadline</div>
          <div style="${deadlinePassed ? 'color:var(--danger);font-weight:600' : ''}">${fmtDate(rfq.submission_deadline)}</div>
        </div>
        <div>
          <div style="font-size:0.75rem;color:var(--gray-500);">Scope</div>
          <div>${rfq.target_type === 'open' ? 'Open to all vendors' : 'Targeted'}</div>
        </div>
      </div>
      ${rfq.description ? `<div style="margin-top:1rem;"><div style="font-size:0.75rem;color:var(--gray-500);margin-bottom:0.3rem;">Description</div><p style="margin:0;color:var(--gray-700);font-size:0.875rem">${escHtml(rfq.description)}</p></div>` : ''}
      ${rfq.item_specs ? `<div style="margin-top:1rem;"><div style="font-size:0.75rem;color:var(--gray-500);margin-bottom:0.3rem;">Item Specifications</div><pre style="font-size:0.82rem;background:var(--gray-50);padding:0.75rem;border-radius:6px;white-space:pre-wrap;margin:0">${escHtml(rfq.item_specs)}</pre></div>` : ''}
      ${rfq.terms_conditions ? `<div style="margin-top:1rem;"><div style="font-size:0.75rem;color:var(--gray-500);margin-bottom:0.3rem;">Terms & Conditions</div><p style="margin:0;font-size:0.82rem;color:var(--gray-600)">${escHtml(rfq.terms_conditions)}</p></div>` : ''}
      <hr style="margin:1.5rem 0;border:none;border-top:1px solid var(--border)">
      ${rfq.my_quote ? renderExistingQuoteSummary(rfq.my_quote) : ''}
      ${deadlinePassed
        ? '<div class="alert alert-danger">Submission deadline has passed. No new quotes can be submitted.</div>'
        : renderQuoteForm(rfq)}
    </div>`;
}

function renderExistingQuoteSummary(q) {
  return `
    <div style="background:var(--gray-50);border-radius:8px;padding:1rem;margin-bottom:1rem;">
      <div style="font-weight:600;margin-bottom:0.75rem;">Your Current Quote (v${q.version}) — ${statusBadge(q.status)}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.75rem;font-size:0.875rem;">
        <div><div style="color:var(--gray-500);font-size:0.75rem">Unit Price</div>${fmtMoney(q.unit_price)}</div>
        <div><div style="color:var(--gray-500);font-size:0.75rem">Base Total</div>${fmtMoney(q.total_amount)}</div>
        <div><div style="color:var(--gray-500);font-size:0.75rem">Grand Total</div><strong>${fmtMoney(q.grand_total)}</strong></div>
        <div><div style="color:var(--gray-500);font-size:0.75rem">GST Rate</div>${q.gst_rate}%</div>
        <div><div style="color:var(--gray-500);font-size:0.75rem">Lead Time</div>${q.lead_time_days} days</div>
        <div><div style="color:var(--gray-500);font-size:0.75rem">Valid Until</div>${fmtDate(q.validity_date)}</div>
      </div>
      ${q.notes ? `<div style="margin-top:0.5rem;font-size:0.82rem;color:var(--gray-600)"><em>${escHtml(q.notes)}</em></div>` : ''}
    </div>
    <div style="font-weight:600;margin-bottom:0.75rem;">Revise Quote</div>`;
}

function renderQuoteForm(rfq) {
  const q = rfq.my_quote || {};
  return `
    <div class="form-grid-2">
      <div class="form-group">
        <label class="form-label required">Unit Price (₹)</label>
        <input class="form-control" type="number" id="q-unit-price" value="${q.unit_price || ''}"
          placeholder="Price per unit" step="0.01" min="0" oninput="calcQuoteTotals()">
      </div>
      <div class="form-group">
        <label class="form-label required">GST Rate (%)</label>
        <select class="form-control" id="q-gst-rate" onchange="calcQuoteTotals()">
          ${[0, 5, 12, 18, 28].map(r => `<option value="${r}" ${(q.gst_rate || 18) == r ? 'selected' : ''}>${r}%</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label required">Lead Time (days)</label>
        <input class="form-control" type="number" id="q-lead-time" value="${q.lead_time_days || ''}"
          placeholder="Delivery lead time" min="1">
      </div>
      <div class="form-group">
        <label class="form-label required">Quote Valid Until</label>
        <input class="form-control" type="date" id="q-validity" value="${q.validity_date || ''}">
      </div>
    </div>
    <div id="q-totals-preview" style="background:var(--gray-50);padding:0.75rem 1rem;border-radius:8px;margin-bottom:1rem;font-size:0.875rem;display:none">
      <div style="display:flex;gap:2rem;flex-wrap:wrap;">
        <div>Base Total: <strong id="q-preview-total">—</strong></div>
        <div>GST: <strong id="q-preview-gst">—</strong></div>
        <div>Grand Total: <strong id="q-preview-grand" style="color:var(--primary)">—</strong></div>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Notes / Remarks</label>
      <textarea class="form-control" id="q-notes" rows="2" placeholder="Any additional information...">${escHtml(q.notes || '')}</textarea>
    </div>
    <div id="rfq-quote-errors"></div>
    <div style="display:flex;gap:0.75rem;justify-content:flex-end;margin-top:1rem;">
      <button class="btn btn-outline" onclick="closeModal('rfq-detail-modal')">Cancel</button>
      <button class="btn btn-primary" onclick="submitVendorQuote('${rfq.id}')">
        ${q.id ? 'Update Quote' : 'Submit Quote'}
      </button>
    </div>`;
}

function calcQuoteTotals() {
  if (!_rfqDetail) return;
  const unitPrice = parseFloat(document.getElementById('q-unit-price')?.value) || 0;
  const gstRate   = parseFloat(document.getElementById('q-gst-rate')?.value) || 0;
  const preview   = document.getElementById('q-totals-preview');
  if (!unitPrice || !preview) return;
  const total = unitPrice * _rfqDetail.quantity;
  const gst   = total * gstRate / 100;
  document.getElementById('q-preview-total').textContent = fmtMoney(total);
  document.getElementById('q-preview-gst').textContent   = fmtMoney(gst);
  document.getElementById('q-preview-grand').textContent = fmtMoney(total + gst);
  preview.style.display = 'block';
}

async function submitVendorQuote(rfqId) {
  const errs = [];
  const unitPrice = parseFloat(document.getElementById('q-unit-price').value);
  const gstRate   = parseFloat(document.getElementById('q-gst-rate').value);
  const leadTime  = parseInt(document.getElementById('q-lead-time').value);
  const validity  = document.getElementById('q-validity').value;
  const notes     = document.getElementById('q-notes').value.trim();

  if (!unitPrice || unitPrice <= 0) errs.push('Unit price is required and must be > 0');
  if (!leadTime || leadTime < 1)    errs.push('Lead time is required');
  if (!validity)                    errs.push('Quote validity date is required');
  else if (validity <= new Date().toISOString().split('T')[0])
    errs.push('Validity date must be in the future');

  if (errs.length) {
    document.getElementById('rfq-quote-errors').innerHTML =
      `<div class="alert alert-danger"><ul style="margin:0;padding-left:1.2rem">${errs.map(e => `<li>${escHtml(e)}</li>`).join('')}</ul></div>`;
    return;
  }
  Loading.show();
  try {
    await api('POST', `/api/vendor/rfqs/${rfqId}/quote`,
      { unit_price: unitPrice, gst_rate: gstRate, lead_time_days: leadTime, validity_date: validity, notes });
    Toast.success('Quote submitted successfully');
    closeModal('rfq-detail-modal');
    await loadVendorRFQs();
  } catch(e) {
    Toast.error(e.message || 'Failed to submit quote');
  } finally {
    Loading.hide();
  }
}

// ── My Quotes ─────────────────────────────────────────────────────────

async function loadVendorQuotes() {
  const wrap = document.getElementById('quotes-list-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
  try {
    const res = await api('GET', '/api/vendor/quotes');
    renderVendorQuotesList(Array.isArray(res) ? res : []);
  } catch(e) {
    wrap.innerHTML = '<div class="empty-state"><p style="color:var(--danger)">Failed to load quotes</p></div>';
  }
}

function renderVendorQuotesList(quotes) {
  const wrap = document.getElementById('quotes-list-wrap');
  if (!quotes.length) {
    wrap.innerHTML = `<div class="empty-state">
      <div class="empty-icon">💬</div>
      <p>No quotes submitted yet.</p>
      <button class="btn btn-primary btn-sm" onclick="showSection('section-rfqs');setActiveNav('section-rfqs');loadVendorRFQs()">Browse Open RFQs →</button>
    </div>`;
    return;
  }
  wrap.innerHTML = `<div style="overflow-x:auto"><table class="data-table">
    <thead><tr>
      <th>RFQ</th><th>Unit Price</th><th>Grand Total</th><th>Lead Time</th><th>Valid Until</th><th>Status</th><th>Submitted</th>
    </tr></thead>
    <tbody>${quotes.map(q => `
      <tr>
        <td>
          <div style="font-weight:500;">${escHtml(q.rfq_number)}</div>
          <div style="font-size:0.82rem;color:var(--gray-500)">${escHtml(q.title)}</div>
          <div style="margin-top:0.2rem">${statusBadge(q.rfq_status)}</div>
        </td>
        <td>${fmtMoney(q.unit_price)}</td>
        <td>
          <div style="font-weight:600">${fmtMoney(q.grand_total)}</div>
          <div style="font-size:0.75rem;color:var(--gray-500)">incl. ${q.gst_rate}% GST</div>
        </td>
        <td>${q.lead_time_days} days</td>
        <td style="font-size:0.82rem">${fmtDate(q.validity_date)}</td>
        <td>${statusBadge(q.status)}</td>
        <td style="font-size:0.8rem">${fmtDate(q.submitted_at)}</td>
      </tr>`).join('')}
    </tbody>
  </table></div>`;
}
