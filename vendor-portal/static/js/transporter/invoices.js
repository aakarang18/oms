/* Transporter Portal — Invoices */

async function loadTransporterInvoices() {
  const el = document.getElementById('invoices-list');
  el.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
  try {
    const rows = await api('GET', '/api/transporter/invoices');
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">🧾</div><p>No invoices submitted yet</p></div>';
      return;
    }
    el.innerHTML = list.map(inv => `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--gray-100);flex-wrap:wrap">
        <div style="flex:1;min-width:180px">
          <div style="font-weight:600">${escHtml(inv.invoice_ref)}</div>
          <div style="font-size:.8rem;color:var(--gray-400)">${inv.invoice_date}${inv.trip_number ? ' · Trip: ' + escHtml(inv.trip_number) : ''}</div>
        </div>
        <div style="text-align:right;min-width:120px">
          <div style="font-weight:600">${fmtMoney(inv.grand_total)}</div>
          <div style="font-size:.8rem;color:var(--gray-400)">Taxable: ${fmtMoney(inv.taxable_amount)}</div>
        </div>
        <div style="min-width:90px;text-align:center">
          <span class="badge badge-${tInvStatusClass(inv.status)}">${inv.status}</span>
        </div>
        <button class="btn btn-sm btn-ghost" onclick="showTransporterInvoiceDetail('${inv.id}')">View</button>
      </div>
    `).join('');
  } catch(e) {
    el.innerHTML = '<div class="empty-state"><p style="color:red">Failed to load invoices</p></div>';
  }
}

function tInvStatusClass(s) {
  return {submitted:'warning', approved:'success', rejected:'danger', paid:'info'}[s] || 'default';
}

async function showTransporterInvoiceDetail(invId) {
  const inv = await api('GET', `/api/transporter/invoices/${invId}`);
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal" style="max-width:520px">
      <div class="modal-header">
        <h3>Invoice ${escHtml(inv.invoice_ref)}</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&#x2715;</button>
      </div>
      <div class="modal-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;font-size:.875rem">
          <div><span style="color:var(--gray-400)">Date</span><br>${inv.invoice_date}</div>
          <div><span style="color:var(--gray-400)">Status</span><br><span class="badge badge-${tInvStatusClass(inv.status)}">${inv.status}</span></div>
          ${inv.trip_number ? `<div><span style="color:var(--gray-400)">Trip</span><br>${escHtml(inv.trip_number)}</div>` : ''}
          ${inv.origin_city ? `<div><span style="color:var(--gray-400)">Route</span><br>${escHtml(inv.origin_city)} → ${escHtml(inv.dest_city)}</div>` : ''}
          ${inv.gstin ? `<div><span style="color:var(--gray-400)">GSTIN</span><br>${escHtml(inv.gstin)}</div>` : ''}
        </div>
        <table style="width:100%;margin-top:1rem;font-size:.875rem;border-collapse:collapse">
          <tr style="border-top:1px solid var(--gray-100)"><td style="padding:6px 0">Taxable Amount</td><td style="text-align:right">${fmtMoney(inv.taxable_amount)}</td></tr>
          ${inv.cgst_amount ? `<tr><td style="padding:6px 0;color:var(--gray-400)">CGST</td><td style="text-align:right">${fmtMoney(inv.cgst_amount)}</td></tr>` : ''}
          ${inv.sgst_amount ? `<tr><td style="padding:6px 0;color:var(--gray-400)">SGST</td><td style="text-align:right">${fmtMoney(inv.sgst_amount)}</td></tr>` : ''}
          ${inv.igst_amount ? `<tr><td style="padding:6px 0;color:var(--gray-400)">IGST</td><td style="text-align:right">${fmtMoney(inv.igst_amount)}</td></tr>` : ''}
          <tr style="border-top:1px solid var(--gray-200);font-weight:700"><td style="padding:8px 0">Grand Total</td><td style="text-align:right">${fmtMoney(inv.grand_total)}</td></tr>
        </table>
        ${inv.rejection_reason ? `<div class="alert alert-danger" style="margin-top:1rem">Rejection: ${escHtml(inv.rejection_reason)}</div>` : ''}
        ${(inv.payments||[]).length ? `
          <h4 style="margin-top:1.25rem;margin-bottom:.5rem">Payments</h4>
          ${inv.payments.map(p => `
            <div style="display:flex;justify-content:space-between;font-size:.875rem;padding:6px 0;border-bottom:1px solid var(--gray-100)">
              <span>${p.payment_date} · ${escHtml(p.payment_mode)} · UTR: ${escHtml(p.utr_number)}</span>
              <span style="font-weight:600">${fmtMoney(p.payment_amount)}</span>
            </div>
          `).join('')}
        ` : ''}
      </div>
    </div>`;
  document.body.appendChild(modal);
}

let _deliveredTrips = [];

async function openSubmitTransporterInvoiceModal() {
  try { _deliveredTrips = await api('GET', '/api/transporter/trips-for-invoice'); } catch { _deliveredTrips = []; }
  const list = Array.isArray(_deliveredTrips) ? _deliveredTrips : [];

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-submit-t-invoice';
  modal.innerHTML = `
    <div class="modal" style="max-width:540px">
      <div class="modal-header">
        <h3>Submit Invoice</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&#x2715;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Invoice Number / Reference *</label>
          <input class="form-control" id="tinv-ref" placeholder="e.g. TINV-2025-001">
        </div>
        <div class="form-group">
          <label class="form-label">Invoice Date *</label>
          <input class="form-control" type="date" id="tinv-date">
        </div>
        <div class="form-group">
          <label class="form-label">Linked Trip</label>
          <select class="form-control" id="tinv-trip">
            <option value="">— Select Trip (optional) —</option>
            ${list.map(t => `<option value="${t.id}">
              ${escHtml(t.trip_number)} — ${escHtml(t.origin_city)} → ${escHtml(t.dest_city)}${t.pod_delivered_qty ? ' (' + t.pod_delivered_qty + ' MT)' : ''}
            </option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Invoice Document Reference</label>
          <input class="form-control" id="tinv-doc-ref" placeholder="Lorry receipt / consignment note number">
        </div>
        <div class="form-group">
          <label class="form-label">GSTIN</label>
          <input class="form-control" id="tinv-gstin" placeholder="Your GSTIN (optional)">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">Taxable Amount (₹) *</label>
            <input class="form-control" type="number" id="tinv-taxable" min="0" step="0.01" placeholder="0.00" oninput="calcTInvTotal()">
          </div>
          <div class="form-group">
            <label class="form-label">CGST (₹)</label>
            <input class="form-control" type="number" id="tinv-cgst" min="0" step="0.01" value="0" oninput="calcTInvTotal()">
          </div>
          <div class="form-group">
            <label class="form-label">SGST (₹)</label>
            <input class="form-control" type="number" id="tinv-sgst" min="0" step="0.01" value="0" oninput="calcTInvTotal()">
          </div>
          <div class="form-group">
            <label class="form-label">IGST (₹)</label>
            <input class="form-control" type="number" id="tinv-igst" min="0" step="0.01" value="0" oninput="calcTInvTotal()">
          </div>
        </div>
        <div style="background:var(--gray-50);border-radius:8px;padding:12px;font-size:.875rem;display:flex;justify-content:space-between;align-items:center">
          <span>Grand Total</span>
          <span style="font-weight:700;font-size:1.1rem" id="tinv-grand-total">₹0.00</span>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button class="btn btn-primary" onclick="submitTransporterInvoice()">Submit Invoice</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function calcTInvTotal() {
  const t = parseFloat(document.getElementById('tinv-taxable')?.value) || 0;
  const c = parseFloat(document.getElementById('tinv-cgst')?.value)    || 0;
  const s = parseFloat(document.getElementById('tinv-sgst')?.value)    || 0;
  const i = parseFloat(document.getElementById('tinv-igst')?.value)    || 0;
  const el = document.getElementById('tinv-grand-total');
  if (el) el.textContent = fmtMoney(t + c + s + i);
}

async function submitTransporterInvoice() {
  const body = {
    invoice_ref:      (document.getElementById('tinv-ref')?.value || '').trim(),
    invoice_date:     (document.getElementById('tinv-date')?.value || '').trim(),
    linked_trip_id:   (document.getElementById('tinv-trip')?.value || '').trim(),
    invoice_ref_path: (document.getElementById('tinv-doc-ref')?.value || '').trim(),
    gstin:            (document.getElementById('tinv-gstin')?.value || '').trim(),
    taxable_amount:   parseFloat(document.getElementById('tinv-taxable')?.value) || 0,
    cgst_amount:      parseFloat(document.getElementById('tinv-cgst')?.value)    || 0,
    sgst_amount:      parseFloat(document.getElementById('tinv-sgst')?.value)    || 0,
    igst_amount:      parseFloat(document.getElementById('tinv-igst')?.value)    || 0,
  };

  if (!body.invoice_ref || !body.invoice_date) {
    showToast('Invoice number and date are required', 'error'); return;
  }
  if (body.taxable_amount <= 0) {
    showToast('Taxable amount must be greater than 0', 'error'); return;
  }

  try {
    await api('POST', '/api/transporter/invoices', body);
    document.getElementById('modal-submit-t-invoice')?.remove();
    showToast('Invoice submitted successfully', 'success');
    loadTransporterInvoices();
  } catch(e) {
    showToast(e.message || 'Submission failed', 'error');
  }
}

async function loadTransporterPayments() {
  const el = document.getElementById('payments-list');
  el.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
  try {
    const rows = await api('GET', '/api/transporter/invoices');
    const paid = (Array.isArray(rows) ? rows : []).filter(i => i.status === 'paid');
    if (!paid.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">💳</div><p>No payments received yet</p></div>';
      return;
    }
    el.innerHTML = paid.map(inv => `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--gray-100);flex-wrap:wrap">
        <div style="flex:1;min-width:180px">
          <div style="font-weight:600">${escHtml(inv.invoice_ref)}</div>
          <div style="font-size:.8rem;color:var(--gray-400)">${inv.invoice_date}${inv.trip_number ? ' · Trip: ' + escHtml(inv.trip_number) : ''}</div>
        </div>
        <div style="font-weight:600">${fmtMoney(inv.grand_total)}</div>
        <span class="badge badge-info">paid</span>
        <button class="btn btn-sm btn-ghost" onclick="showTransporterInvoiceDetail('${inv.id}')">View</button>
      </div>
    `).join('');
  } catch(e) {
    el.innerHTML = '<div class="empty-state"><p style="color:red">Failed to load</p></div>';
  }
}
