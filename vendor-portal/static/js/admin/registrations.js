// Admin Registration Management
// Handles vendor & transporter registration review, approval, rejection

'use strict';

let _regCurrentTab = 'vendors';
let _regCurrentStatus = 'submitted';
let _regList = [];

const STATUS_FILTERS = ['submitted', 'under_review', 'approved', 'rejected', 'info_requested', 'draft'];

function initAdminRegistrations() {
  renderRegToolbar();
  loadRegistrationList();
}

function renderRegToolbar() {
  const wrap = document.getElementById('reg-toolbar');
  if (!wrap) return;
  wrap.innerHTML = `
    <div style="display:flex;gap:1rem;align-items:center;flex-wrap:wrap;">
      <div class="tab-bar">
        <button class="tab-btn ${_regCurrentTab === 'vendors' ? 'active' : ''}" onclick="switchRegTab('vendors')">Vendors</button>
        <button class="tab-btn ${_regCurrentTab === 'transporters' ? 'active' : ''}" onclick="switchRegTab('transporters')">Transporters</button>
      </div>
      <select class="form-control" style="width:180px;" onchange="switchRegStatus(this.value)">
        ${STATUS_FILTERS.map(s => `<option value="${s}" ${s === _regCurrentStatus ? 'selected' : ''}>${s.replace('_', ' ')}</option>`).join('')}
      </select>
      <button class="btn btn-outline btn-sm" onclick="loadRegistrationList()">&#8634; Refresh</button>
    </div>`;
}

async function switchRegTab(tab) {
  _regCurrentTab = tab;
  renderRegToolbar();
  await loadRegistrationList();
}

async function switchRegStatus(status) {
  _regCurrentStatus = status;
  await loadRegistrationList();
}

async function loadRegistrationList() {
  const el = document.getElementById('reg-list-body');
  if (!el) return;
  el.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--gray-500);">Loading...</td></tr>';
  try {
    const endpoint = _regCurrentTab === 'vendors'
      ? `/api/admin/vendors?status=${_regCurrentStatus}`
      : `/api/admin/transporters?status=${_regCurrentStatus}`;
    const res = await api('GET', endpoint);
    _regList = Array.isArray(res) ? res : (res.vendors || res.transporters || []);
    renderRegList(_regList);
  } catch (e) {
    el.innerHTML = `<tr><td colspan="6" class="text-danger" style="text-align:center;padding:1rem;">${escHtml(e.message || 'Failed to load')}</td></tr>`;
  }
}

function renderRegList(items) {
  const el = document.getElementById('reg-list-body');
  if (!el) return;
  if (!items.length) {
    el.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--gray-500);">No ${_regCurrentTab} with status "${_regCurrentStatus}"</td></tr>`;
    return;
  }
  el.innerHTML = items.map(item => `
    <tr>
      <td><strong>${escHtml(item.company_name || '')}</strong><br><small style="color:var(--gray-500);">${escHtml(item.gstin || '')}</small></td>
      <td>${escHtml(item.contact_person || '')}<br><small>${escHtml(item.contact_email || '')}</small></td>
      <td>${escHtml(item.city || '')}${item.state ? `, ${escHtml(item.state)}` : ''}</td>
      <td><span class="badge badge-${item.status}">${item.status.replace('_', ' ')}</span></td>
      <td>${item.submitted_at ? fmtDate(item.submitted_at) : relTime(item.created_at)}</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="openRegDetail('${item.id}')">Review</button>
      </td>
    </tr>`).join('');
}

async function openRegDetail(entityId) {
  const endpoint = _regCurrentTab === 'vendors'
    ? `/api/admin/vendors/${entityId}`
    : `/api/admin/transporters/${entityId}`;
  Loading.show();
  try {
    const data = await api('GET', endpoint);
    renderRegDetailModal(data);
  } catch (e) {
    Toast.error('Failed to load details');
  } finally {
    Loading.hide();
  }
}

function renderRegDetailModal(data) {
  const isVendor = _regCurrentTab === 'vendors';
  const entity = isVendor ? data.vendor : data.transporter;
  const docs = data.documents || [];
  const canAct = ['submitted', 'under_review', 'info_requested'].includes(entity.status);

  const docRows = docs.length
    ? docs.filter(d => !d.is_deleted).map(d => `
        <tr>
          <td>${escHtml(d.doc_type.replace(/_/g, ' '))}</td>
          <td>${d.expiry_date ? fmtDate(d.expiry_date) : '—'}</td>
          <td><span class="badge badge-${d.expiry_status || 'valid'}">${d.expiry_status || 'valid'}</span></td>
          <td><a href="/uploads/${escHtml(d.file_path)}" target="_blank" class="btn btn-ghost btn-sm">View</a></td>
        </tr>`).join('')
    : '<tr><td colspan="4" style="text-align:center;color:var(--gray-500);">No documents uploaded</td></tr>';

  const vendorExtra = isVendor ? `
    <div class="detail-section">
      <h4>Categories &amp; Products</h4>
      ${(data.categories || []).length
        ? `<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem;">${(data.categories || []).map(c => `<span class="badge badge-info">${escHtml(c.category_name)}</span>`).join('')}</div>`
        : '<p style="color:var(--gray-500);">No categories</p>'}
      ${(data.products || []).length
        ? `<table class="data-table" style="margin-top:0.5rem;"><thead><tr><th>Name</th><th>Code</th><th>UOM</th><th>HSN</th></tr></thead><tbody>${(data.products || []).map(p => `<tr><td>${escHtml(p.product_name)}</td><td>${escHtml(p.product_code || '—')}</td><td>${escHtml(p.uom || '—')}</td><td>${escHtml(p.hsn_code || '—')}</td></tr>`).join('')}</tbody></table>`
        : ''}
    </div>` : '';

  const transporterExtra = !isVendor ? `
    <div class="detail-section">
      <h4>Fleet Details</h4>
      <p>Fleet size: <strong>${entity.fleet_size || 'Not specified'}</strong></p>
      ${(data.vehicles || []).length
        ? `<table class="data-table"><thead><tr><th>Vehicle No</th><th>Type</th><th>Capacity</th><th>Status</th></tr></thead><tbody>${(data.vehicles || []).map(v => `<tr><td>${escHtml(v.vehicle_no)}</td><td>${escHtml(v.vehicle_type)}</td><td>${v.capacity_tonnes ? `${v.capacity_tonnes}T` : '—'}</td><td><span class="badge badge-${v.status}">${v.status}</span></td></tr>`).join('')}</tbody></table>`
        : '<p style="color:var(--gray-500);">No vehicles registered</p>'}
    </div>` : '';

  const html = `
    <div class="modal-header">
      <h3>${escHtml(entity.company_name)}</h3>
      <span class="badge badge-${entity.status}" style="margin-left:1rem;">${entity.status.replace('_', ' ')}</span>
    </div>
    <div class="modal-body" style="max-height:70vh;overflow-y:auto;">
      <div class="detail-grid">
        <div class="detail-section">
          <h4>Company Info</h4>
          <dl class="detail-list">
            <dt>GSTIN</dt><dd>${escHtml(entity.gstin || '—')}</dd>
            <dt>PAN</dt><dd>${escHtml(entity.pan || '—')}</dd>
            ${isVendor ? `<dt>Type</dt><dd>${escHtml(entity.vendor_type || '—')}</dd>` : `<dt>License No.</dt><dd>${escHtml(entity.transport_license_no || '—')}</dd>`}
            <dt>Contact</dt><dd>${escHtml(entity.contact_person || '—')}</dd>
            <dt>Email</dt><dd>${escHtml(entity.contact_email || '—')}</dd>
            <dt>Mobile</dt><dd>${escHtml(entity.contact_mobile || '—')}</dd>
            <dt>Address</dt><dd>${escHtml([entity.registered_address, entity.city, entity.state, entity.pin_code].filter(Boolean).join(', '))}</dd>
          </dl>
        </div>
        <div class="detail-section">
          <h4>Banking</h4>
          <dl class="detail-list">
            <dt>Account Name</dt><dd>${escHtml(entity.bank_account_name || '—')}</dd>
            <dt>Account No.</dt><dd>${escHtml(entity.bank_account_no || '—')}</dd>
            <dt>IFSC</dt><dd>${escHtml(entity.bank_ifsc || '—')}</dd>
            <dt>Bank</dt><dd>${escHtml(entity.bank_name || '—')}</dd>
            <dt>Branch</dt><dd>${escHtml(entity.bank_branch || '—')}</dd>
          </dl>
        </div>
      </div>
      ${vendorExtra}
      ${transporterExtra}
      <div class="detail-section">
        <h4>Documents</h4>
        <table class="data-table">
          <thead><tr><th>Document</th><th>Expiry</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>${docRows}</tbody>
        </table>
      </div>
      ${entity.admin_note ? `<div class="alert alert-info"><strong>Previous Note:</strong> ${escHtml(entity.admin_note)}</div>` : ''}
      ${entity.rejection_reason ? `<div class="alert alert-danger"><strong>Rejection Reason:</strong> ${escHtml(entity.rejection_reason)}</div>` : ''}
    </div>
    <div class="modal-footer" style="gap:0.75rem;flex-wrap:wrap;">
      <button class="btn btn-outline" onclick="closeModal('reg-detail-modal')">Close</button>
      ${canAct ? `
        <button class="btn btn-outline" onclick="showInfoRequestForm('${entity.id}')">Request Info</button>
        <button class="btn btn-danger" onclick="showRejectForm('${entity.id}')">Reject</button>
        <button class="btn btn-success" onclick="approveEntity('${entity.id}')">Approve</button>
      ` : ''}
    </div>`;

  let modal = document.getElementById('reg-detail-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'reg-detail-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-box" style="max-width:800px;width:95%;">${html}</div>`;
    document.body.appendChild(modal);
  } else {
    modal.querySelector('.modal-box').innerHTML = html;
  }
  openModal('reg-detail-modal');
}

async function approveEntity(entityId) {
  if (!confirm('Approve this registration? The applicant will be notified.')) return;
  const endpoint = _regCurrentTab === 'vendors'
    ? `/api/admin/vendors/${entityId}/approve`
    : `/api/admin/transporters/${entityId}/approve`;
  Loading.show();
  try {
    await api('POST', endpoint);
    Toast.success('Registration approved');
    closeModal('reg-detail-modal');
    await loadRegistrationList();
  } catch (e) {
    Toast.error(e.message || 'Approval failed');
  } finally {
    Loading.hide();
  }
}

function showRejectForm(entityId) {
  const box = document.querySelector('#reg-detail-modal .modal-box');
  const footer = box.querySelector('.modal-footer');
  footer.innerHTML = `
    <div style="width:100%;">
      <label class="form-label required" style="display:block;margin-bottom:0.5rem;">Rejection Reason</label>
      <textarea class="form-control" id="reject-reason" rows="3" placeholder="Explain why the registration is being rejected..."></textarea>
      <div style="display:flex;gap:0.75rem;margin-top:1rem;justify-content:flex-end;">
        <button class="btn btn-outline" onclick="cancelRegAction('${entityId}')">Cancel</button>
        <button class="btn btn-danger" onclick="submitRejection('${entityId}')">Confirm Rejection</button>
      </div>
    </div>`;
}

async function submitRejection(entityId) {
  const reason = document.getElementById('reject-reason').value.trim();
  if (!reason) { Toast.error('Please provide a reason'); return; }
  const endpoint = _regCurrentTab === 'vendors'
    ? `/api/admin/vendors/${entityId}/reject`
    : `/api/admin/transporters/${entityId}/reject`;
  Loading.show();
  try {
    await api('POST', endpoint, { reason });
    Toast.success('Registration rejected');
    closeModal('reg-detail-modal');
    await loadRegistrationList();
  } catch (e) {
    Toast.error(e.message || 'Action failed');
  } finally {
    Loading.hide();
  }
}

function showInfoRequestForm(entityId) {
  const box = document.querySelector('#reg-detail-modal .modal-box');
  const footer = box.querySelector('.modal-footer');
  footer.innerHTML = `
    <div style="width:100%;">
      <label class="form-label required" style="display:block;margin-bottom:0.5rem;">Message to Applicant</label>
      <textarea class="form-control" id="info-note" rows="3" placeholder="Specify what additional information or corrections are needed..."></textarea>
      <div style="display:flex;gap:0.75rem;margin-top:1rem;justify-content:flex-end;">
        <button class="btn btn-outline" onclick="cancelRegAction('${entityId}')">Cancel</button>
        <button class="btn btn-primary" onclick="submitInfoRequest('${entityId}')">Send Request</button>
      </div>
    </div>`;
}

async function submitInfoRequest(entityId) {
  const note = document.getElementById('info-note').value.trim();
  if (!note) { Toast.error('Please provide a note'); return; }
  const endpoint = _regCurrentTab === 'vendors'
    ? `/api/admin/vendors/${entityId}/request-info`
    : `/api/admin/transporters/${entityId}/request-info`;
  Loading.show();
  try {
    await api('POST', endpoint, { note });
    Toast.success('Information request sent');
    closeModal('reg-detail-modal');
    await loadRegistrationList();
  } catch (e) {
    Toast.error(e.message || 'Action failed');
  } finally {
    Loading.hide();
  }
}

function cancelRegAction(entityId) {
  openRegDetail(entityId);
}

// Compliance tab
async function initComplianceView() {
  const el = document.getElementById('compliance-status-filter');
  if (el) el.addEventListener('change', loadComplianceData);
  await loadComplianceData();
}

async function loadComplianceData() {
  const statusEl = document.getElementById('compliance-status-filter');
  const status = statusEl ? statusEl.value : 'expired';
  const el = document.getElementById('compliance-list-body');
  if (!el) return;
  el.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:1rem;color:var(--gray-500);">Loading...</td></tr>';
  try {
    const res = await api('GET', `/api/admin/compliance?status=${status}`);
    renderComplianceList(res);
  } catch (e) {
    el.innerHTML = `<tr><td colspan="6" class="text-danger" style="text-align:center;">${escHtml(e.message)}</td></tr>`;
  }
}

function renderComplianceList(data) {
  const el = document.getElementById('compliance-list-body');
  if (!el) return;
  const allDocs = [
    ...(data.vendor_docs || []).map(d => ({ ...d, _entity: 'Vendor' })),
    ...(data.transporter_docs || []).map(d => ({ ...d, _entity: 'Transporter' })),
    ...(data.vehicle_docs || []).map(d => ({ ...d, _entity: 'Vehicle' }))
  ];
  if (!allDocs.length) {
    el.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--gray-500);">No documents found</td></tr>';
    return;
  }
  el.innerHTML = allDocs.map(d => `
    <tr>
      <td><span class="badge badge-info">${d._entity}</span></td>
      <td>${escHtml(d.entity_name || '—')}</td>
      <td>${escHtml(d.doc_type.replace(/_/g, ' '))}</td>
      <td>${d.expiry_date ? fmtDate(d.expiry_date) : '—'}</td>
      <td><span class="badge badge-${d.expiry_status}">${d.expiry_status}</span></td>
      <td><a href="/uploads/${escHtml(d.file_path)}" target="_blank" class="btn btn-ghost btn-sm">View</a></td>
    </tr>`).join('');
}

// Audit log
async function initAuditLog() {
  await loadAuditLog(1);
}

let _auditPage = 1;

async function loadAuditLog(page) {
  _auditPage = page || 1;
  const entityType = document.getElementById('audit-entity-filter')?.value || '';
  const el = document.getElementById('audit-list-body');
  const pageInfo = document.getElementById('audit-page-info');
  if (!el) return;
  el.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:1rem;color:var(--gray-500);">Loading...</td></tr>';
  try {
    const qs = new URLSearchParams({ page: _auditPage });
    if (entityType) qs.set('entity_type', entityType);
    const res = await api('GET', `/api/admin/audit-log?${qs}`);
    renderAuditLog(res.logs || []);
    if (pageInfo) pageInfo.textContent = `Page ${_auditPage} of ${res.pages || 1} (${res.total || 0} records)`;
  } catch (e) {
    el.innerHTML = `<tr><td colspan="5" class="text-danger">${escHtml(e.message)}</td></tr>`;
  }
}

function renderAuditLog(logs) {
  const el = document.getElementById('audit-list-body');
  if (!el) return;
  if (!logs.length) {
    el.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--gray-500);">No audit records</td></tr>';
    return;
  }
  el.innerHTML = logs.map(log => `
    <tr>
      <td style="font-size:0.8rem;">${fmtDate(log.created_at)}</td>
      <td>${escHtml(log.mobile || log.email || log.actor_user_id || 'System')}</td>
      <td>${escHtml(log.entity_type || '—')}</td>
      <td><strong>${escHtml(log.action || '—')}</strong></td>
      <td>
        ${log.after ? `<button class="btn btn-ghost btn-sm" onclick='showAuditDetail(${JSON.stringify(log)})'>Details</button>` : '—'}
      </td>
    </tr>`).join('');
}

function showAuditDetail(log) {
  const html = `
    <div class="modal-header"><h3>Audit Detail</h3></div>
    <div class="modal-body">
      <dl class="detail-list">
        <dt>Action</dt><dd><strong>${escHtml(log.action)}</strong></dd>
        <dt>Entity</dt><dd>${escHtml(log.entity_type)} / ${escHtml(log.entity_id || '—')}</dd>
        <dt>Actor</dt><dd>${escHtml(log.mobile || log.email || log.actor_user_id || 'System')}</dd>
        <dt>Time</dt><dd>${fmtDate(log.created_at)}</dd>
      </dl>
      ${log.before ? `<div class="detail-section"><h4>Before</h4><pre style="background:var(--gray-50);padding:1rem;border-radius:6px;overflow:auto;font-size:0.8rem;">${escHtml(JSON.stringify(JSON.parse(log.before), null, 2))}</pre></div>` : ''}
      ${log.after ? `<div class="detail-section"><h4>After</h4><pre style="background:var(--gray-50);padding:1rem;border-radius:6px;overflow:auto;font-size:0.8rem;">${escHtml(JSON.stringify(JSON.parse(log.after), null, 2))}</pre></div>` : ''}
    </div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('audit-detail-modal')">Close</button></div>`;
  let modal = document.getElementById('audit-detail-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'audit-detail-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-box" style="max-width:700px;">${html}</div>`;
    document.body.appendChild(modal);
  } else {
    modal.querySelector('.modal-box').innerHTML = html;
  }
  openModal('audit-detail-modal');
}

// Admin user management (super_admin only)
async function initUserManagement() {
  await loadAdminUsers();
  const addBtn = document.getElementById('add-admin-user-btn');
  if (addBtn) addBtn.addEventListener('click', showAddAdminUserModal);
}

async function loadAdminUsers() {
  const el = document.getElementById('admin-users-body');
  if (!el) return;
  try {
    const res = await api('GET', '/api/admin/users');
    renderAdminUsers(Array.isArray(res) ? res : (res.users || []));
  } catch (e) {
    el.innerHTML = `<tr><td colspan="4" class="text-danger">${escHtml(e.message)}</td></tr>`;
  }
}

function renderAdminUsers(users) {
  const el = document.getElementById('admin-users-body');
  if (!el) return;
  if (!users.length) {
    el.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--gray-500);">No admin users found</td></tr>';
    return;
  }
  el.innerHTML = users.map(u => `
    <tr>
      <td>${escHtml(u.name || '—')}</td>
      <td>${escHtml(u.mobile)}</td>
      <td><span class="badge badge-info">${escHtml(u.role)}</span></td>
      <td><span class="badge badge-${u.is_active ? 'approved' : 'rejected'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
    </tr>`).join('');
}

function showAddAdminUserModal() {
  const html = `
    <div class="modal-header"><h3>Add Admin User</h3></div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label required">Full Name</label>
        <input class="form-control" id="new-admin-name" placeholder="Full name">
      </div>
      <div class="form-group">
        <label class="form-label required">Mobile</label>
        <input class="form-control" id="new-admin-mobile" placeholder="10-digit mobile">
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input class="form-control" id="new-admin-email" type="email" placeholder="email@company.com">
      </div>
      <div class="form-group">
        <label class="form-label required">Role</label>
        <select class="form-control" id="new-admin-role">
          <option value="procurement_admin">Procurement Admin</option>
          <option value="transport_admin">Transport Admin</option>
          <option value="finance_admin">Finance Admin</option>
          <option value="super_admin">Super Admin</option>
        </select>
      </div>
      <div id="add-admin-errors"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal('add-admin-modal')">Cancel</button>
      <button class="btn btn-primary" onclick="saveAdminUser()">Create User</button>
    </div>`;
  let modal = document.getElementById('add-admin-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'add-admin-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-box">${html}</div>`;
    document.body.appendChild(modal);
  } else {
    modal.querySelector('.modal-box').innerHTML = html;
  }
  openModal('add-admin-modal');
}

async function saveAdminUser() {
  const name = document.getElementById('new-admin-name').value.trim();
  const mobile = document.getElementById('new-admin-mobile').value.trim();
  const email = document.getElementById('new-admin-email').value.trim();
  const role = document.getElementById('new-admin-role').value;
  const errs = [];
  if (!name) errs.push('Name is required');
  if (!mobile || !validateMobile(mobile)) errs.push('Valid mobile is required');
  if (!role) errs.push('Role is required');
  const errEl = document.getElementById('add-admin-errors');
  if (errs.length) {
    errEl.innerHTML = `<div class="alert alert-danger"><ul style="margin:0;padding-left:1.2rem;">${errs.map(e => `<li>${escHtml(e)}</li>`).join('')}</ul></div>`;
    return;
  }
  errEl.innerHTML = '';
  Loading.show();
  try {
    await api('POST', '/api/admin/users', { name, mobile, email: email || null, role });
    Toast.success('Admin user created');
    closeModal('add-admin-modal');
    await loadAdminUsers();
  } catch (e) {
    errEl.innerHTML = `<div class="alert alert-danger">${escHtml(e.message || 'Failed to create user')}</div>`;
  } finally {
    Loading.hide();
  }
}
