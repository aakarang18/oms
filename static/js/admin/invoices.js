/* Admin Portal — Invoice Review & Payment Recording */

let _approvedInvoices = [];

// ── INVOICE REVIEW ───────────────────────────────────────────────────────────

async function initAdminInvoices() {
  const el = document.getElementById('admin-invoices-list');
  el.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';

  // Inject filter bar if not already present
  if (!document.getElementById('inv-filter-bar')) {
    const bar = document.createElement('div');
    bar.id = 'inv-filter-bar';
    bar.style.cssText = 'display:flex;gap:12px;margin-bottom:1rem;flex-wrap:wrap';
    bar.innerHTML = `
      <select class="form-control" id="inv-status-filter" style="width:160px" onchange="initAdminInvoices()">
        <option value="submitted">Submitted</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
        <option value="paid">Paid</option>
        <option value="">All</option>
      </select>
      <select class="form-control" id="inv-type-filter" style="width:160px" onchange="initAdminInvoices()">
        <option value="">All Parties</option>
        <option value="vendor">Vendor</option>
        <option value="transporter">Transporter</option>
      </select>
    `;
    el.parentElement.insertBefore(bar, el.parentElement.querySelector('.card'));
  }

  const status = document.getElementById('inv-status-filter')?.value ?? 'submitted';
  const party  = document.getElementById('inv-type-filter')?.value  ?? '';

  try {
    const rows = await api('GET', `/api/admin/invoices?status=${encodeURIComponent(status)}&party_type=${encodeURIComponent(party)}`);
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">🧾</div><p>No invoices found</p></div>';
      return;
    }
    el.innerHTML = list.map(inv => `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--gray-100);flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <div style="font-weight:600">${escHtml(inv.invoice_ref)}</div>
          <div style="font-size:.8rem;color:var(--gray-400)">
            ${escHtml(inv.party_name || inv.party_id)} · ${inv.party_type}
            ${inv.po_number ? ' · PO: ' + escHtml(inv.po_number) : ''}
            ${inv.trip_number ? ' · Trip: ' + escHtml(inv.trip_number) : ''}
          </div>
          <div style="font-size:.75rem;color:var(--gray-300)">${inv.submitted_at?.slice(0,10)}</div>
        </div>
        <div style="text-align:right;min-width:110px">
          <div style="font-weight:600">${fmtMoney(inv.grand_total)}</div>
          <div style="font-size:.8rem;color:var(--gray-400)">Taxable: ${fmtMoney(inv.taxable_amount)}</div>
        </div>
        <span class="badge badge-${aInvStatusClass(inv.status)}">${inv.status}</span>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm btn-ghost" onclick="showAdminInvoiceDetail('${inv.id}')">View</button>
          ${inv.status === 'submitted' ? `
            <button class="btn btn-sm btn-success" onclick="approveInvoice('${inv.id}')">Approve</button>
            <button class="btn btn-sm btn-danger" onclick="openRejectInvoiceModal('${inv.id}')">Reject</button>
          ` : ''}
        </div>
      </div>
    `).join('');
  } catch(e) {
    el.innerHTML = '<div class="empty-state"><p style="color:red">Failed to load invoices</p></div>';
  }
}

function aInvStatusClass(s) {
  return {submitted:'warning', approved:'success', rejected:'danger', paid:'info'}[s] || 'default';
}

async function showAdminInvoiceDetail(invId) {
  const inv = await api('GET', `/api/admin/invoices/${invId}`);
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal" style="max-width:580px">
      <div class="modal-header">
        <h3>Invoice ${escHtml(inv.invoice_ref)}</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;font-size:.875rem">
          <div><span style="color:var(--gray-400)">Party</span><br>${escHtml(inv.party_name || inv.party_id)} (${inv.party_type})</div>
          <div><span style="color:var(--gray-400)">Status</span><br><span class="badge badge-${aInvStatusClass(inv.status)}">${inv.status}</span></div>
          <div><span style="color:var(--gray-400)">Invoice Date</span><br>${inv.invoice_date}</div>
          <div><span style="color:var(--gray-400)">Submitted</span><br>${inv.submitted_at?.slice(0,10)}</div>
          ${inv.po_number ? `<div><span style="color:var(--gray-400)">PO</span><br>${escHtml(inv.po_number)}</div>` : ''}
          ${inv.grn_number ? `<div><span style="color:var(--gray-400)">GRN</span><br>${escHtml(inv.grn_number)}</div>` : ''}
          ${inv.trip_number ? `<div><span style="color:var(--gray-400)">Trip</span><br>${escHtml(inv.trip_number)}</div>` : ''}
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
      <div class="modal-footer">
        ${inv.status === 'submitted' ? `
          <button class="btn btn-danger" onclick="openRejectInvoiceModal('${inv.id}');this.closest('.modal-overlay').remove()">Reject</button>
          <button class="btn btn-success" onclick="approveInvoice('${inv.id}');this.closest('.modal-overlay').remove()">Approve</button>
        ` : ''}
        <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Close</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function approveInvoice(invId) {
  try {
    await api('POST', `/api/admin/invoices/${invId}/review`, {action: 'approved'});
    showToast('Invoice approved', 'success');
    initAdminInvoices();
  } catch(e) {
    showToast(e.message || 'Failed to approve', 'error');
  }
}

function openRejectInvoiceModal(invId) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-reject-invoice';
  modal.innerHTML = `
    <div class="modal" style="max-width:420px">
      <div class="modal-header">
        <h3>Reject Invoice</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Rejection Reason *</label>
          <textarea class="form-control" id="inv-reject-reason" rows="3" placeholder="Explain why this invoice is being rejected…"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button class="btn btn-danger" onclick="submitInvoiceReject('${invId}')">Reject</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function submitInvoiceReject(invId) {
  const reason = (document.getElementById('inv-reject-reason')?.value || '').trim();
  if (!reason) { showToast('Reason is required', 'error'); return; }
  try {
    await api('POST', `/api/admin/invoices/${invId}/review`, {action: 'rejected', reason});
    document.getElementById('modal-reject-invoice')?.remove();
    showToast('Invoice rejected', 'success');
    initAdminInvoices();
  } catch(e) {
    showToast(e.message || 'Failed to reject', 'error');
  }
}

// ── PAYMENT RECORDING ────────────────────────────────────────────────────────

async function initAdminPayments() {
  const el = document.getElementById('admin-payments-list');
  el.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
  try {
    const rows = await api('GET', '/api/admin/payments');
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">💳</div><p>No payments recorded yet</p></div>';
      return;
    }
    el.innerHTML = list.map(p => `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--gray-100);flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <div style="font-weight:600">${escHtml(p.invoice_ref)}</div>
          <div style="font-size:.8rem;color:var(--gray-400)">${escHtml(p.party_name || p.party_id)} · ${p.party_type} · UTR: ${escHtml(p.utr_number)}</div>
          <div style="font-size:.75rem;color:var(--gray-300)">${p.payment_date} · ${escHtml(p.payment_mode)}</div>
        </div>
        <div style="font-weight:600">${fmtMoney(p.payment_amount)}</div>
        <span class="badge badge-success">paid</span>
      </div>
    `).join('');
  } catch(e) {
    el.innerHTML = '<div class="empty-state"><p style="color:red">Failed to load payments</p></div>';
  }
}

async function openRecordPaymentModal() {
  try { _approvedInvoices = await api('GET', '/api/admin/invoices-approved'); } catch { _approvedInvoices = []; }
  const list = Array.isArray(_approvedInvoices) ? _approvedInvoices : [];

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-record-payment';
  modal.innerHTML = `
    <div class="modal" style="max-width:480px">
      <div class="modal-header">
        <h3>Record Payment</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Invoice *</label>
          <select class="form-control" id="pay-invoice-id" onchange="prefillPayAmount()">
            <option value="">— Select approved invoice —</option>
            ${list.map(inv => `<option value="${inv.id}" data-amount="${inv.grand_total}">
              ${escHtml(inv.invoice_ref)} · ${escHtml(inv.party_name || inv.party_id)} · ${fmtMoney(inv.grand_total)}
            </option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Payment Amount (₹) *</label>
          <input class="form-control" type="number" id="pay-amount" min="0" step="0.01" placeholder="0.00">
        </div>
        <div class="form-group">
          <label class="form-label">Payment Date *</label>
          <input class="form-control" type="date" id="pay-date">
        </div>
        <div class="form-group">
          <label class="form-label">UTR / Reference Number *</label>
          <input class="form-control" id="pay-utr" placeholder="e.g. HDFC0000123456789">
        </div>
        <div class="form-group">
          <label class="form-label">Payment Mode *</label>
          <select class="form-control" id="pay-mode">
            <option value="NEFT">NEFT</option>
            <option value="RTGS">RTGS</option>
            <option value="IMPS">IMPS</option>
            <option value="Cheque">Cheque</option>
            <option value="Cash">Cash</option>
            <option value="UPI">UPI</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Notes</label>
          <input class="form-control" id="pay-notes" placeholder="Optional notes">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button class="btn btn-primary" onclick="submitPayment()">Record Payment</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  // Set today as default date
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('pay-date').value = today;
}

function prefillPayAmount() {
  const sel = document.getElementById('pay-invoice-id');
  const opt = sel?.options[sel.selectedIndex];
  const amt = opt?.dataset.amount;
  if (amt) document.getElementById('pay-amount').value = parseFloat(amt).toFixed(2);
}

async function submitPayment() {
  const body = {
    invoice_id:     (document.getElementById('pay-invoice-id')?.value || '').trim(),
    payment_amount: parseFloat(document.getElementById('pay-amount')?.value) || 0,
    payment_date:   (document.getElementById('pay-date')?.value || '').trim(),
    utr_number:     (document.getElementById('pay-utr')?.value || '').trim(),
    payment_mode:   (document.getElementById('pay-mode')?.value || '').trim(),
    notes:          (document.getElementById('pay-notes')?.value || '').trim(),
  };

  if (!body.invoice_id) { showToast('Select an invoice', 'error'); return; }
  if (body.payment_amount <= 0) { showToast('Enter a valid amount', 'error'); return; }
  if (!body.payment_date) { showToast('Payment date is required', 'error'); return; }
  if (!body.utr_number) { showToast('UTR number is required', 'error'); return; }

  try {
    await api('POST', '/api/admin/payments', body);
    document.getElementById('modal-record-payment')?.remove();
    showToast('Payment recorded successfully', 'success');
    initAdminPayments();
  } catch(e) {
    showToast(e.message || 'Failed to record payment', 'error');
  }
}
