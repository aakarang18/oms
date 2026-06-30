/* Vendor Portal — Invoices */

async function loadVendorInvoices() {
  const el = document.getElementById('invoices-list');
  el.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
  try {
    const rows = await api('GET', '/api/vendor/invoices');
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">🧾</div><p>No invoices submitted yet</p></div>';
      return;
    }
    el.innerHTML = list.map(inv => `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--gray-100);flex-wrap:wrap">
        <div style="flex:1;min-width:180px">
          <div style="font-weight:600">${escHtml(inv.invoice_ref)}</div>
          <div style="font-size:.8rem;color:var(--gray-400)">${inv.invoice_date}${inv.po_number ? ' · PO: ' + escHtml(inv.po_number) : ''}${inv.grn_number ? ' · GRN: ' + escHtml(inv.grn_number) : ''}</div>
        </div>
        <div style="text-align:right;min-width:120px">
          <div style="font-weight:600">${fmtMoney(inv.grand_total)}</div>
          <div style="font-size:.8rem;color:var(--gray-400)">Taxable: ${fmtMoney(inv.taxable_amount)}</div>
        </div>
        <div style="min-width:90px;text-align:center">
          <span class="badge badge-${invStatusClass(inv.status)}">${inv.status}</span>
        </div>
        <button class="btn btn-sm btn-ghost" onclick="showVendorInvoiceDetail('${inv.id}')">View</button>
      </div>
    `).join('');
  } catch(e) {
    el.innerHTML = '<div class="empty-state"><p style="color:red">Failed to load invoices</p></div>';
  }
}

function invStatusClass(s) {
  return {submitted:'warning', approved:'success', rejected:'danger', paid:'info'}[s] || 'default';
}

async function showVendorInvoiceDetail(invId) {
  const inv = await api('GET', `/api/vendor/invoices/${invId}`);
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal" style="max-width:560px">
      <div class="modal-header">
        <h3>Invoice ${escHtml(inv.invoice_ref)}</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div class="detail-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;font-size:.875rem">
          <div><span style="color:var(--gray-400)">Date</span><br>${inv.invoice_date}</div>
          <div><span style="color:var(--gray-400)">Status</span><br><span class="badge badge-${invStatusClass(inv.status)}">${inv.status}</span></div>
          ${inv.po_number ? `<div><span style="color:var(--gray-400)">PO</span><br>${escHtml(inv.po_number)}</div>` : ''}
          ${inv.grn_number ? `<div><span style="color:var(--gray-400)">GRN</span><br>${escHtml(inv.grn_number)}</div>` : ''}
          ${inv.gstin ? `<div><span style="color:var(--gray-400)">GSTIN</span><br>${escHtml(inv.gstin)}</div>` : ''}
          ${inv.hsn_codes ? `<div><span style="color:var(--gray-400)">HSN</span><br>${escHtml(inv.hsn_codes)}</div>` : ''}
        </div>
        ${(() => {
          let items = [];
          try { items = JSON.parse(inv.line_items_json || '[]'); } catch {}
          if (!items.length) return '';
          return `<div style="margin-top:1rem;overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:.8rem">
              <thead><tr style="border-bottom:2px solid var(--gray-200)">
                <th style="text-align:left;padding:4px">Description</th>
                <th style="padding:4px">HSN</th>
                <th style="text-align:right;padding:4px">Qty</th>
                <th style="padding:4px">Unit</th>
                <th style="text-align:right;padding:4px">Rate</th>
                <th style="text-align:right;padding:4px">Amount</th>
              </tr></thead>
              <tbody>${items.map(it => `<tr style="border-bottom:1px solid var(--gray-100)">
                <td style="padding:4px">${escHtml(it.description||'')}</td>
                <td style="padding:4px;color:var(--gray-400)">${escHtml(it.hsn_code||'')}</td>
                <td style="padding:4px;text-align:right">${fmtNum(it.quantity)}</td>
                <td style="padding:4px;color:var(--gray-400)">${escHtml(it.unit||'')}</td>
                <td style="padding:4px;text-align:right">${fmtMoney(it.rate)}</td>
                <td style="padding:4px;text-align:right;font-weight:600">${fmtMoney(it.amount)}</td>
              </tr>`).join('')}</tbody>
            </table>
          </div>`;
        })()}
        <table style="width:100%;margin-top:1rem;font-size:.875rem;border-collapse:collapse">
          <tr style="border-top:1px solid var(--gray-100)"><td style="padding:6px 0">Taxable Amount</td><td style="text-align:right">${fmtMoney(inv.taxable_amount)}</td></tr>
          ${inv.cgst_amount ? `<tr><td style="padding:6px 0;color:var(--gray-400)">CGST</td><td style="text-align:right">${fmtMoney(inv.cgst_amount)}</td></tr>` : ''}
          ${inv.sgst_amount ? `<tr><td style="padding:6px 0;color:var(--gray-400)">SGST</td><td style="text-align:right">${fmtMoney(inv.sgst_amount)}</td></tr>` : ''}
          ${inv.igst_amount ? `<tr><td style="padding:6px 0;color:var(--gray-400)">IGST</td><td style="text-align:right">${fmtMoney(inv.igst_amount)}</td></tr>` : ''}
          <tr style="border-top:1px solid var(--gray-200);font-weight:700"><td style="padding:8px 0">Grand Total</td><td style="text-align:right">${fmtMoney(inv.grand_total)}</td></tr>
        </table>
        ${inv.rejection_reason ? `<div class="alert alert-danger" style="margin-top:1rem">Rejection reason: ${escHtml(inv.rejection_reason)}</div>` : ''}
        ${inv.invoice_ref_path || inv.invoice_pdf_path ? `<div style="margin-top:.75rem;font-size:.8rem;color:var(--gray-400)">Invoice ref: ${escHtml(inv.invoice_pdf_path || '')}</div>` : ''}
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

async function openSubmitInvoiceModal() {
  let pos = [];
  try { pos = await api('GET', '/api/vendor/pos-for-invoice'); } catch {}

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-submit-invoice';
  modal.innerHTML = `
    <div class="modal" style="max-width:720px">
      <div class="modal-header">
        <h3>Submit Invoice</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">Invoice Number *</label>
            <input class="form-control" id="inv-ref" placeholder="e.g. INV-2026-00847">
          </div>
          <div class="form-group">
            <label class="form-label">Invoice Date *</label>
            <input class="form-control" type="date" id="inv-date">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Linked PO / GRN</label>
          <select class="form-control" id="inv-po">
            <option value="">— Select PO (optional) —</option>
            ${pos.map(p => `<option value="${p.id}" data-grn="${p.grn_id||''}">
              ${escHtml(p.po_number)}${p.grn_number ? ' / GRN: ' + escHtml(p.grn_number) : ''} — ${fmtMoney(p.po_value)}
            </option>`).join('')}
          </select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">Invoice Doc Ref</label>
            <input class="form-control" id="inv-pdf-ref" placeholder="Document / LR reference">
          </div>
          <div class="form-group">
            <label class="form-label">GSTIN</label>
            <input class="form-control" id="inv-gstin" placeholder="Your GSTIN (optional)">
          </div>
        </div>

        <h4 style="margin:1rem 0 .5rem">Line Items</h4>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:.8rem" id="inv-line-items-table">
            <thead>
              <tr style="border-bottom:2px solid var(--gray-200)">
                <th style="text-align:left;padding:4px 6px;min-width:160px">Description</th>
                <th style="text-align:left;padding:4px 6px;width:90px">HSN Code</th>
                <th style="text-align:right;padding:4px 6px;width:70px">Qty</th>
                <th style="text-align:left;padding:4px 6px;width:60px">Unit</th>
                <th style="text-align:right;padding:4px 6px;width:90px">Rate (₹)</th>
                <th style="text-align:right;padding:4px 6px;width:90px">Amount (₹)</th>
                <th style="width:32px"></th>
              </tr>
            </thead>
            <tbody id="inv-line-items-body"></tbody>
          </table>
        </div>
        <button class="btn btn-sm btn-ghost" style="margin-top:.5rem" onclick="addInvLineItem()">+ Add Item</button>

        <div style="margin-top:1rem;border-top:1px solid var(--gray-200);padding-top:1rem">
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:.875rem;margin-bottom:.5rem">
            <span style="color:var(--gray-400)">Taxable Amount</span>
            <span id="inv-taxable-display" style="font-weight:600">₹0.00</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:.75rem">
            <div class="form-group" style="margin:0">
              <label class="form-label" style="font-size:.75rem">CGST (₹)</label>
              <input class="form-control" type="number" id="inv-cgst" min="0" step="0.01" value="0" oninput="calcInvTotal()">
            </div>
            <div class="form-group" style="margin:0">
              <label class="form-label" style="font-size:.75rem">SGST (₹)</label>
              <input class="form-control" type="number" id="inv-sgst" min="0" step="0.01" value="0" oninput="calcInvTotal()">
            </div>
            <div class="form-group" style="margin:0">
              <label class="form-label" style="font-size:.75rem">IGST (₹)</label>
              <input class="form-control" type="number" id="inv-igst" min="0" step="0.01" value="0" oninput="calcInvTotal()">
            </div>
          </div>
          <div style="background:var(--gray-50);border-radius:8px;padding:12px;display:flex;justify-content:space-between;align-items:center">
            <span style="font-weight:600">Grand Total</span>
            <span style="font-weight:700;font-size:1.15rem" id="inv-grand-total">₹0.00</span>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button class="btn btn-primary" onclick="submitVendorInvoice()">Submit Invoice</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  addInvLineItem();
}

function addInvLineItem() {
  const tbody = document.getElementById('inv-line-items-body');
  if (!tbody) return;
  const idx = tbody.rows.length;
  const tr = document.createElement('tr');
  tr.dataset.idx = idx;
  tr.innerHTML = `
    <td style="padding:4px 2px"><input class="form-control" style="font-size:.8rem" placeholder="Description" oninput="calcInvTotal()"></td>
    <td style="padding:4px 2px"><input class="form-control" style="font-size:.8rem" placeholder="28332400" oninput="calcInvTotal()"></td>
    <td style="padding:4px 2px"><input class="form-control" style="font-size:.8rem;text-align:right" type="number" min="0" step="0.001" placeholder="0" oninput="recalcLineAmt(this)"></td>
    <td style="padding:4px 2px"><input class="form-control" style="font-size:.8rem" placeholder="MT"></td>
    <td style="padding:4px 2px"><input class="form-control" style="font-size:.8rem;text-align:right" type="number" min="0" step="0.01" placeholder="0.00" oninput="recalcLineAmt(this)"></td>
    <td style="padding:4px 2px"><input class="form-control" style="font-size:.8rem;text-align:right;background:var(--gray-50)" type="number" min="0" step="0.01" placeholder="0.00" readonly></td>
    <td style="padding:4px 2px;text-align:center"><button class="btn btn-sm" style="padding:2px 6px;color:var(--danger)" onclick="removeInvLineItem(this)" title="Remove">✕</button></td>
  `;
  tbody.appendChild(tr);
}

function recalcLineAmt(input) {
  const tr = input.closest('tr');
  const qty  = parseFloat(tr.cells[2].querySelector('input').value) || 0;
  const rate = parseFloat(tr.cells[4].querySelector('input').value) || 0;
  tr.cells[5].querySelector('input').value = (qty * rate).toFixed(2);
  calcInvTotal();
}

function removeInvLineItem(btn) {
  btn.closest('tr').remove();
  calcInvTotal();
}

function calcInvTotal() {
  let taxable = 0;
  const tbody = document.getElementById('inv-line-items-body');
  if (tbody) {
    for (const tr of tbody.rows) {
      taxable += parseFloat(tr.cells[5].querySelector('input').value) || 0;
    }
  }
  const c = parseFloat(document.getElementById('inv-cgst')?.value) || 0;
  const s = parseFloat(document.getElementById('inv-sgst')?.value) || 0;
  const i = parseFloat(document.getElementById('inv-igst')?.value) || 0;
  const taxEl = document.getElementById('inv-taxable-display');
  const totEl = document.getElementById('inv-grand-total');
  if (taxEl) taxEl.textContent = fmtMoney(taxable);
  if (totEl) totEl.textContent = fmtMoney(taxable + c + s + i);
}

async function submitVendorInvoice() {
  const poSel       = document.getElementById('inv-po');
  const linkedPoId  = poSel?.value || '';
  const linkedGrnId = poSel?.options[poSel.selectedIndex]?.dataset.grn || '';

  const tbody = document.getElementById('inv-line-items-body');
  const line_items = [];
  if (tbody) {
    for (const tr of tbody.rows) {
      const description = tr.cells[0].querySelector('input').value.trim();
      const hsn_code    = tr.cells[1].querySelector('input').value.trim();
      const quantity    = parseFloat(tr.cells[2].querySelector('input').value) || 0;
      const unit        = tr.cells[3].querySelector('input').value.trim();
      const rate        = parseFloat(tr.cells[4].querySelector('input').value) || 0;
      const amount      = parseFloat(tr.cells[5].querySelector('input').value) || 0;
      if (description || amount) line_items.push({ description, hsn_code, quantity, unit, rate, amount });
    }
  }

  const body = {
    invoice_ref:      (document.getElementById('inv-ref')?.value || '').trim(),
    invoice_date:     (document.getElementById('inv-date')?.value || '').trim(),
    linked_po_id:     linkedPoId,
    linked_grn_id:    linkedGrnId,
    invoice_ref_path: (document.getElementById('inv-pdf-ref')?.value || '').trim(),
    gstin:            (document.getElementById('inv-gstin')?.value || '').trim(),
    line_items,
    cgst_amount:      parseFloat(document.getElementById('inv-cgst')?.value) || 0,
    sgst_amount:      parseFloat(document.getElementById('inv-sgst')?.value) || 0,
    igst_amount:      parseFloat(document.getElementById('inv-igst')?.value) || 0,
  };

  if (!body.invoice_ref || !body.invoice_date) {
    showToast('Invoice number and date are required', 'error'); return;
  }
  if (!body.line_items.length) {
    showToast('Add at least one line item', 'error'); return;
  }

  try {
    await api('POST', '/api/vendor/invoices', body);
    document.getElementById('modal-submit-invoice')?.remove();
    showToast('Invoice submitted successfully', 'success');
    loadVendorInvoices();
  } catch(e) {
    showToast(e.message || 'Submission failed', 'error');
  }
}

async function loadVendorPayments() {
  const el = document.getElementById('payments-list');
  el.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
  try {
    const rows = await api('GET', '/api/vendor/invoices');
    const paid = (Array.isArray(rows) ? rows : []).filter(i => i.status === 'paid');
    if (!paid.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">💳</div><p>No payments received yet</p></div>';
      return;
    }
    el.innerHTML = paid.map(inv => `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--gray-100);flex-wrap:wrap">
        <div style="flex:1;min-width:180px">
          <div style="font-weight:600">${escHtml(inv.invoice_ref)}</div>
          <div style="font-size:.8rem;color:var(--gray-400)">${inv.invoice_date}${inv.po_number ? ' · PO: ' + escHtml(inv.po_number) : ''}</div>
        </div>
        <div style="font-weight:600">${fmtMoney(inv.grand_total)}</div>
        <span class="badge badge-info">paid</span>
        <button class="btn btn-sm btn-ghost" onclick="showVendorInvoiceDetail('${inv.id}')">View</button>
      </div>
    `).join('');
  } catch(e) {
    el.innerHTML = '<div class="empty-state"><p style="color:red">Failed to load</p></div>';
  }
}
