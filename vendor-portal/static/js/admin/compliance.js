/* Admin — Compliance Dashboard */

function initComplianceView() {
  loadComplianceData();
}

async function loadComplianceData() {
  const status = document.getElementById('compliance-status-filter').value;
  const tbody = document.getElementById('compliance-list-body');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem"><div class="spinner"></div></td></tr>';

  try {
    const rows = await api('GET', `/api/admin/compliance?status=${encodeURIComponent(status)}`);
    if (!Array.isArray(rows) || !rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--gray-500)">No documents found for this filter.</td></tr>';
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
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--danger)">Failed to load compliance data.</td></tr>';
    console.error('Compliance load error', e);
  }
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
