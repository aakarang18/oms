/* Transporter Portal — Company Profile & Banking sections */

async function loadTransporterProfile() {
  const el = document.getElementById('profile-content');
  el.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';

  try {
    const p = await api('GET', '/api/transporter/profile');

    const badge = document.getElementById('profile-status-badge');
    if (badge) badge.innerHTML = statusBadge(p.status || 'pending');

    el.innerHTML = `
      <div class="card" style="margin-bottom:1.5rem">
        <div class="card-header"><h3>Company Information</h3></div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:1rem">
            ${tProfileField('Company Name',    p.company_name)}
            ${tProfileField('GSTIN',           p.gstin)}
            ${tProfileField('PAN',             p.pan_number)}
            ${tProfileField('Address',         [p.address_line1, p.address_line2, p.city, p.state, p.pincode].filter(Boolean).join(', '))}
            ${tProfileField('Contact Person',  p.contact_name)}
            ${tProfileField('Designation',     p.contact_designation)}
            ${tProfileField('Mobile',          p.contact_mobile)}
            ${tProfileField('Email',           p.contact_email)}
            ${tProfileField('Fleet Size',      p.fleet_size ? p.fleet_size + ' vehicles' : null)}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>Registration Status</h3></div>
        <div class="card-body">
          <div style="display:flex;align-items:center;gap:1rem">
            <div>${statusBadge(p.status || 'pending')}</div>
            <div style="font-size:.875rem;color:var(--gray-500)">${tStatusNote(p.status)}</div>
          </div>
          ${p.rejection_reason ? `<div class="alert alert-danger" style="margin-top:1rem">
            <strong>Rejection Reason:</strong> ${escHtml(p.rejection_reason)}
          </div>` : ''}
        </div>
      </div>`;
  } catch (e) {
    el.innerHTML = '<div class="empty-state"><p style="color:var(--danger)">Failed to load profile.</p></div>';
    console.error('Transporter profile error', e);
  }
}

function tProfileField(label, value) {
  return `
    <div>
      <div style="font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--gray-400);margin-bottom:2px">${label}</div>
      <div style="font-size:.9rem;color:var(--gray-800)">${escHtml(value || '—')}</div>
    </div>`;
}

function tStatusNote(status) {
  const notes = {
    pending:        'Your application is queued for review.',
    under_review:   'Our team is currently reviewing your application.',
    info_requested: 'Additional information has been requested. Please check email.',
    approved:       'Your account is fully approved. All features are available.',
    rejected:       'Your application was not approved. See rejection reason below.',
  };
  return notes[status] || '';
}

// ── Banking Details ────────────────────────────────────────────────────────────────

async function loadTransporterBanking() {
  const el = document.getElementById('banking-content');
  el.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';

  try {
    const p = await api('GET', '/api/transporter/profile');
    const hasBanking = p.bank_account_number;

    el.innerHTML = `
      <div class="card">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
          <h3>Bank Account Details</h3>
          <button class="btn btn-sm btn-primary" onclick="openTransporterBankingModal()">
            ${hasBanking ? 'Update Banking' : 'Add Banking Details'}
          </button>
        </div>
        <div class="card-body">
          ${hasBanking ? `
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem">
            ${tProfileField('Account Holder',   p.bank_account_holder)}
            ${tProfileField('Account Type',     p.bank_account_type)}
            ${tProfileField('Account Number',   tMaskAccNo(p.bank_account_number))}
            ${tProfileField('IFSC Code',        p.bank_ifsc)}
            ${tProfileField('Bank Name',        p.bank_name)}
          </div>` : `
          <div class="empty-state">
            <div class="empty-icon">🏦</div>
            <p>No banking details saved. Add your bank account to receive payments.</p>
          </div>`}
        </div>
      </div>

      <!-- Edit Banking Modal -->
      <div class="modal-overlay" id="modal-transporter-banking">
        <div class="modal" style="max-width:480px">
          <div class="modal-header">
            <h3>Banking Details</h3>
            <button class="modal-close">&#x2715;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Account Holder Name <span class="required">*</span></label>
              <input type="text" id="tb-holder" value="${escHtml(p.bank_account_holder || '')}">
            </div>
            <div class="form-group">
              <label>Account Type <span class="required">*</span></label>
              <select id="tb-type">
                <option value="">Select…</option>
                <option value="Current" ${p.bank_account_type==='Current'?'selected':''}>Current</option>
                <option value="Savings" ${p.bank_account_type==='Savings'?'selected':''}>Savings</option>
              </select>
            </div>
            <div class="form-group">
              <label>Account Number <span class="required">*</span></label>
              <input type="text" id="tb-accno" value="${escHtml(p.bank_account_number || '')}" inputmode="numeric">
            </div>
            <div class="form-group">
              <label>IFSC Code <span class="required">*</span></label>
              <input type="text" id="tb-ifsc" value="${escHtml(p.bank_ifsc || '')}" maxlength="11" style="text-transform:uppercase" placeholder="SBIN0001234">
            </div>
            <div class="form-group">
              <label>Bank Name</label>
              <input type="text" id="tb-bank" value="${escHtml(p.bank_name || '')}" placeholder="Optional">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="closeModal('modal-transporter-banking')">Cancel</button>
            <button class="btn btn-primary" onclick="saveTransporterBanking()">Save</button>
          </div>
        </div>
      </div>`;
  } catch (e) {
    el.innerHTML = '<div class="empty-state"><p style="color:var(--danger)">Failed to load banking details.</p></div>';
    console.error('Transporter banking error', e);
  }
}

function openTransporterBankingModal() {
  openModal('modal-transporter-banking');
}

async function saveTransporterBanking() {
  const body = {
    bank_account_holder: document.getElementById('tb-holder').value.trim(),
    bank_account_type:   document.getElementById('tb-type').value,
    bank_account_number: document.getElementById('tb-accno').value.trim(),
    bank_ifsc:           document.getElementById('tb-ifsc').value.trim().toUpperCase(),
    bank_name:           document.getElementById('tb-bank').value.trim(),
  };
  try {
    await api('POST', '/api/transporter/step/3', body);
    Toast.success('Banking details saved.');
    closeModal('modal-transporter-banking');
    loadTransporterBanking();
  } catch (e) {
    Toast.error(e.data?.errors ? Object.values(e.data.errors).join(' ') : 'Failed to save.');
  }
}

function tMaskAccNo(n) {
  if (!n) return '—';
  return n.length > 4 ? '•'.repeat(n.length - 4) + n.slice(-4) : n;
}
