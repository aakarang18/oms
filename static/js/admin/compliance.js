/* Admin — Compliance Dashboard */

let _compliancePage = 1;

function initComplianceView() {
  _compliancePage = 1;
  loadComplianceData();
}

async function loadComplianceData(page) {
  if (page !== undefined) _compliancePage = page;
  const status = document.getElementById('compliance-status-filter').value;
  const tbody = document.getElementById('compliance-list-body');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem"><div class="spinner"></div></td></tr>';

  try {
    const res = await api('GET', `/api/admin/compliance?status=${encodeURIComponent(status)}&page=${_compliancePage}`);

    // Support both paginated {rows, total, page, total_pages} and legacy plain array
    const rows = Array.isArray(res) ? res : (res.rows || []);
    const total = Array.isArray(res) ? rows.length : (res.total || rows.length);
    const totalPages = Array.isArray(res) ? 1 : (res.total_pages || 1);

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--gray-500)">No documents found for this filter.</td></tr>';
      renderCompliancePagination(0, 0, 1);
      return;
    }

    tbody.innerHTML = rows.map(r => {
      const badge = complianceBadge(r.expiry_status);
      const typeLabel = { vendor: 'Vendor', transporter: 'Transporter', vehicle: 'Vehicle' }[r.entity_type] || r.entity_type;
      const docLabel = r.doc_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const expiry = r.expiry_date ? r.expiry_date.slice(0, 10) : '—';
      return `<tr>
        <td><span class="badge badge-info">${typeLabel}</span></td>
        <td>${escHtml(r.entity_name)}</td>
        <td>${escHtml(docLabel)}</td>
        <td>${expiry}</td>
        <td>${badge}</td>
        <td>${r.file_name ? `<span style="font-size:.8rem;color:var(--gray-500)">${escHtml(r.file_name)}</span>` : '—'}</td>
      </tr>`;
    }).join('');

    renderCompliancePagination(total, _compliancePage, totalPages);
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--danger)">Failed to load compliance data.</td></tr>';
    console.error('Compliance load error', e);
  }
}

function renderCompliancePagination(total, page, totalPages) {
  let wrap = document.getElementById('compliance-pagination');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'compliance-pagination';
    wrap.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:0.75rem 1rem;font-size:0.85rem;color:var(--gray-500);';
    const table = document.querySelector('#section-compliance .card');
    if (table) table.after(wrap);
  }
  if (totalPages <= 1) {
    wrap.innerHTML = `<span>${total} record${total !== 1 ? 's' : ''}</span>`;
    return;
  }
  wrap.innerHTML = `
    <span>${total} records · Page ${page} of ${totalPages}</span>
    <div style="display:flex;gap:0.5rem;">
      <button class="btn btn-outline btn-sm" onclick="loadComplianceData(${page - 1})" ${page <= 1 ? 'disabled' : ''}>← Prev</button>
      <button class="btn btn-outline btn-sm" onclick="loadComplianceData(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>Next →</button>
    </div>`;
}

function complianceBadge(status) {
  const map = {
    expired:      '<span class="badge badge-danger">Expired</span>',
    expiring_7:   '<span class="badge badge-danger">Expiring in 7d</span>',
    expiring_15:  '<span class="badge badge-warning">Expiring in 15d</span>',
    expiring_30:  '<span class="badge badge-warning">Expiring in 30d</span>',
    ok:           '<span class="badge badge-success">Valid</span>',
  };
  return map[status] || `<span class="badge">${status}</span>`;
}
