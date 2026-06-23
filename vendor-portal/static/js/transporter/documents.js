/* Transporter Portal — Documents section */

async function loadTransporterDocuments() {
  const el = document.getElementById('documents-content');
  el.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';

  try {
    const res = await api('GET', '/api/transporter/documents');
    const companyDocs = Array.isArray(res.company_docs) ? res.company_docs : [];
    const vehicleDocs = Array.isArray(res.vehicle_docs) ? res.vehicle_docs : [];

    if (!companyDocs.length && !vehicleDocs.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">📄</div><p>No documents uploaded yet.</p></div>';
      return;
    }

    const renderTable = (docs, showVehicle) => `
      <table class="data-table">
        <thead><tr>
          ${showVehicle ? '<th>Vehicle</th>' : ''}
          <th>Document Type</th><th>File Name</th>
          <th>Expiry Date</th><th>Status</th><th>Uploaded</th>
        </tr></thead>
        <tbody>${docs.map(d => {
          const label = d.doc_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          const expiry = d.expiry_date ? d.expiry_date.slice(0, 10) : '—';
          return `<tr>
            ${showVehicle ? `<td style="font-size:.85rem">${escHtml(d.registration_number || '—')}</td>` : ''}
            <td>${escHtml(label)}</td>
            <td>${escHtml(d.file_name || '—')}</td>
            <td>${expiry}</td>
            <td>${docExpiryBadge(d.expiry_status)}</td>
            <td style="font-size:.8rem;color:var(--gray-400)">${relTime(d.uploaded_at)}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;

    let html = '';
    if (companyDocs.length) {
      html += '<h3 style="margin-bottom:.75rem">Company Documents</h3>' + renderTable(companyDocs, false);
    }
    if (vehicleDocs.length) {
      html += '<h3 style="margin:1.5rem 0 .75rem">Vehicle Documents</h3>' + renderTable(vehicleDocs, true);
    }
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = '<div class="empty-state"><p style="color:var(--danger)">Failed to load documents.</p></div>';
    console.error('Transporter documents error', e);
  }
}

function docExpiryBadge(status) {
  const map = {
    expired:     '<span class="badge badge-danger">Expired</span>',
    expiring_7:  '<span class="badge badge-danger">Expiring Soon</span>',
    expiring_15: '<span class="badge badge-warning">Expiring in 15d</span>',
    expiring_30: '<span class="badge badge-warning">Expiring in 30d</span>',
    ok:          '<span class="badge badge-success">Valid</span>',
  };
  return map[status] || '<span class="badge badge-success">Valid</span>';
}
