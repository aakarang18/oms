/* Vendor Portal — Documents section */

async function loadVendorDocuments() {
  const el = document.getElementById('documents-content');
  el.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';

  try {
    const docs = await api('GET', '/api/vendor/documents');
    if (!Array.isArray(docs) || !docs.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">📄</div><p>No documents uploaded yet. Complete the registration wizard to upload documents.</p></div>';
      return;
    }

    el.innerHTML = `
      <table class="data-table">
        <thead><tr>
          <th>Document Type</th><th>File Name</th><th>Mandatory</th>
          <th>Expiry Date</th><th>Status</th><th>Uploaded</th>
        </tr></thead>
        <tbody>${docs.map(d => {
          const label = d.doc_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          const expiry = d.expiry_date ? d.expiry_date.slice(0, 10) : '—';
          const badge = docExpiryBadge(d.expiry_status);
          return `<tr>
            <td>${escHtml(label)}</td>
            <td>${escHtml(d.file_name || '—')}</td>
            <td>${d.is_mandatory ? '<span class="badge badge-info">Required</span>' : '<span class="badge">Optional</span>'}</td>
            <td>${expiry}</td>
            <td>${badge}</td>
            <td style="font-size:.8rem;color:var(--gray-400)">${relTime(d.uploaded_at)}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
      <p style="margin-top:1rem;font-size:.85rem;color:var(--gray-500)">
        To update documents, use the Registration section. Contact support if a mandatory document has expired.
      </p>`;
  } catch (e) {
    el.innerHTML = '<div class="empty-state"><p style="color:var(--danger)">Failed to load documents.</p></div>';
    console.error('Vendor documents error', e);
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
