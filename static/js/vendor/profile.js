/* Vendor Portal — Company Profile & Banking sections */

async function loadVendorProfile() {
  const el = document.getElementById('profile-content');
  el.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';

  try {
    const p = await api('GET', '/api/vendor/profile');

    const badge = document.getElementById('profile-status-badge');
    if (badge) badge.innerHTML = statusBadge(p.status || 'pending');

    const categories = (p.categories || []).join(', ') || '—';
    const products   = (p.products   || []).map(r => escHtml(r.product_name)).join(', ') || '—';

    el.innerHTML = `
      <div class="card" style="margin-bottom:1.5rem">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
          <h3>Company Information</h3>
          ${p.status === 'approved' ? `<button class="btn btn-sm btn-outline" onclick="openEditProfileModal()">Edit</button>` : ''}
        </div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:1rem">
            ${profileField('Company Name',     p.company_name)}
            ${profileField('Company Type',     p.company_type)}
            ${profileField('GSTIN',            p.gstin)}
            ${profileField('PAN',              p.pan_number)}
            ${profileField('Address',          [p.address_line1, p.address_line2, p.city, p.state, p.pincode].filter(Boolean).join(', '))}
            ${profileField('Contact Person',   p.contact_name)}
            ${profileField('Designation',      p.contact_designation)}
            ${profileField('Mobile',           p.contact_mobile)}
            ${profileField('Email',            p.contact_email)}
            ${profileField('Supply Categories',categories)}
            ${profileField('Products / Services', products)}
            ${profileField('Registration Step', (p.registration_step || 1) + ' / 5')}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>Registration Status</h3></div>
        <div class="card-body">
          <div style="display:flex;align-items:center;gap:1rem">
            <div>${statusBadge(p.status || 'pending')}</div>
            <div style="font-size:.875rem;color:var(--gray-500)">
              ${statusNote(p.status)}
            </div>
          </div>
          ${p.rejection_reason ? `<div class="alert alert-danger" style="margin-top:1rem">
            <strong>Rejection Reason:</strong> ${escHtml(p.rejection_reason)}
          </div>` : ''}
        </div>
      </div>`;
  } catch (e) {
    el.innerHTML = '<div class="empty-state"><p style="color:var(--danger)">Failed to load profile.</p></div>';
    console.error('Vendor profile error', e);
  }
}

function profileField(label, value) {
  return `
    <div>
      <div style="font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--gray-400);margin-bottom:2px">${label}</div>
      <div style="font-size:.9rem;color:var(--gray-800)">${escHtml(value || '—')}</div>
    </div>`;
}

function statusNote(status) {
  const notes = {
    pending:        'Your application is queued for review.',
    under_review:   'Our team is currently reviewing your application.',
    info_requested: 'Additional information has been requested. Please check email.',
    approved:       'Your account is fully approved. All features are available.',
    rejected:       'Your application was not approved. See rejection reason below.',
  };
  return notes[status] || '';
}

// ── Banking Details ───────────────────────────────────────────────────────────

async function loadVendorBanking() {
  const el = document.getElementById('banking-content');
  el.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';

  try {
    const p = await api('GET', '/api/vendor/profile');
    const hasBanking = p.bank_account_number;

    el.innerHTML = `
      <div class="card">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
          <h3>Bank Account Details</h3>
          <button class="btn btn-sm btn-primary" onclick="openEditBankingModal()">
            ${hasBanking ? 'Update Banking' : 'Add Banking Details'}
          </button>
        </div>
        <div class="card-body">
          ${hasBanking ? `
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem">
            ${profileField('Account Holder',   p.bank_account_holder)}
            ${profileField('Account Type',     p.bank_account_type)}
            ${profileField('Account Number',   maskAccNo(p.bank_account_number))}
            ${profileField('IFSC Code',        p.bank_ifsc)}
            ${profileField('Bank Name',        p.bank_name)}
          </div>` : `
          <div class="empty-state">
            <div class="empty-icon">🏦</div>
            <p>No banking details saved. Add your bank account to receive payments.</p>
          </div>`}
        </div>
      </div>

      <!-- Edit Banking Modal -->
      <div class="modal-overlay" id="modal-edit-banking">
        <div class="modal" style="max-width:480px">
          <div class="modal-header">
            <h3>Banking Details</h3>
            <button class="modal-close">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Account Holder Name <span class="required">*</span></label>
              <input type="text" id="be-holder" value="${escHtml(p.bank_account_holder || '')}">
            </div>
            <div class="form-group">
              <label>Account Type <span class="required">*</span></label>
              <select id="be-type">
                <option value="">Select…</option>
                <option value="Current"  ${p.bank_account_type==='Current' ?'selected':''}>Current</option>
                <option value="Savings"  ${p.bank_account_type==='Savings' ?'selected':''}>Savings</option>
              </select>
            </div>
            <div class="form-group">
              <label>Account Number <span class="required">*</span></label>
              <input type="text" id="be-accno" value="${escHtml(p.bank_account_number || '')}" inputmode="numeric">
            </div>
            <div class="form-group">
              <label>IFSC Code <span class="required">*</span></label>
              <input type="text" id="be-ifsc" value="${escHtml(p.bank_ifsc || '')}" maxlength="11" style="text-transform:uppercase" placeholder="SBIN0001234">
            </div>
            <div class="form-group">
              <label>Bank Name</label>
              <input type="text" id="be-bank" value="${escHtml(p.bank_name || '')}" placeholder="Optional">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="closeModal('modal-edit-banking')">Cancel</button>
            <button class="btn btn-primary" onclick="saveVendorBanking()">Save</button>
          </div>
        </div>
      </div>`;
  } catch (e) {
    el.innerHTML = '<div class="empty-state"><p style="color:var(--danger)">Failed to load banking details.</p></div>';
    console.error('Vendor banking error', e);
  }
}

function openEditBankingModal() {
  openModal('modal-edit-banking');
}

async function saveVendorBanking() {
  const body = {
    bank_account_holder: document.getElementById('be-holder').value.trim(),
    bank_account_type:   document.getElementById('be-type').value,
    bank_account_number: document.getElementById('be-accno').value.trim(),
    bank_ifsc:           document.getElementById('be-ifsc').value.trim().toUpperCase(),
    bank_name:           document.getElementById('be-bank').value.trim(),
  };
  try {
    await api('POST', '/api/vendor/step/4', body);
    Toast.success('Banking details saved.');
    closeModal('modal-edit-banking');
    loadVendorBanking();
  } catch (e) {
    Toast.error(e.data?.errors ? Object.values(e.data.errors).join(' ') : 'Failed to save.');
  }
}

function maskAccNo(n) {
  if (!n) return '—';
  return n.length > 4 ? '•'.repeat(n.length - 4) + n.slice(-4) : n;
}
