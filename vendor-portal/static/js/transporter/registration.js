// Transporter Registration Wizard
// 3 steps: Company Info → Documents → Banking

'use strict';

let _tProfile = null;
const T_MANDATORY_DOCS = ['transport_license', 'pan_card', 'gst_certificate', 'bank_cheque'];
const T_DOC_LABELS = {
  transport_license: 'Transport License',
  pan_card: 'PAN Card',
  gst_certificate: 'GST Certificate',
  bank_cheque: 'Cancelled Cheque',
  other: 'Other Document'
};

async function initTransporterRegistration() {
  try {
    const res = await api('GET', '/api/transporter/profile');
    _tProfile = res;
    const status = res.status;
    if (status === 'draft' || status === 'info_requested') {
      if (status === 'info_requested') showTInfoRequestedState(res.admin_note);
      else renderTWizard(res.registration_step || 1);
    } else if (status === 'submitted' || status === 'under_review') {
      showTSubmittedState();
    } else if (status === 'approved') {
      showMainPortal();
    } else if (status === 'rejected') {
      showTRejectedState(res.rejection_reason);
    } else {
      renderTWizard(1);
    }
  } catch (e) {
    document.getElementById('reg-wizard-wrap').innerHTML =
      `<div class="card" style="text-align:center;padding:2rem;"><p class="text-danger">Failed to load profile. Please refresh.</p></div>`;
  }
}

function showMainPortal() {
  document.getElementById('reg-wizard-wrap').style.display = 'none';
  const mp = document.getElementById('main-portal-wrap');
  if (mp) mp.style.display = '';
}

function showTSubmittedState() {
  document.getElementById('reg-wizard-wrap').innerHTML = `
    <div class="card" style="text-align:center;padding:3rem 2rem;max-width:560px;margin:2rem auto;">
      <div style="font-size:3rem;margin-bottom:1rem;">⏳</div>
      <h2>Registration Submitted</h2>
      <p style="color:var(--gray-600);margin:1rem 0;">Your application is under review. We'll notify you once a decision is made.</p>
      <div class="badge badge-pending" style="font-size:0.9rem;padding:0.5rem 1rem;">Under Review</div>
    </div>`;
}

function showTInfoRequestedState(note) {
  document.getElementById('reg-wizard-wrap').innerHTML = `
    <div class="card" style="max-width:600px;margin:2rem auto;">
      <h2 style="color:var(--warning);">Additional Information Required</h2>
      <div class="alert alert-warning" style="margin:1rem 0;">${escHtml(note || 'Please review and update your application.')}</div>
      <button class="btn btn-primary" onclick="resumeTWizard()">Update Application</button>
    </div>`;
}

function resumeTWizard() {
  renderTWizard(_tProfile.registration_step || 1);
}

function showTRejectedState(reason) {
  document.getElementById('reg-wizard-wrap').innerHTML = `
    <div class="card" style="max-width:560px;margin:2rem auto;text-align:center;padding:3rem 2rem;">
      <div style="font-size:3rem;margin-bottom:1rem;">❌</div>
      <h2 style="color:var(--danger);">Registration Rejected</h2>
      <div class="alert alert-danger" style="margin:1rem 0;text-align:left;">${escHtml(reason || 'Your application was not approved.')}</div>
      <p style="color:var(--gray-600);">Please contact support for further assistance.</p>
    </div>`;
}

function tv(field) {
  if (!_tProfile) return '';
  const v = _tProfile[field];
  return v == null ? '' : v;
}

function renderTWizard(step) {
  step = parseInt(step) || 1;
  const steps = ['Company Info', 'Documents', 'Banking'];
  const wrap = document.getElementById('reg-wizard-wrap');
  wrap.innerHTML = `
    <div style="max-width:760px;margin:0 auto;">
      ${renderTProgressBar(step, steps)}
      <div class="card" id="t-step-card" style="margin-top:1.5rem;">
        ${renderTStep(step)}
        <div class="form-actions" style="margin-top:2rem;display:flex;gap:1rem;justify-content:flex-end;">
          ${step > 1 ? `<button class="btn btn-outline" onclick="goToTStep(${step - 1})">← Back</button>` : ''}
          ${step < 3
            ? `<button class="btn btn-primary" onclick="submitTStep(${step})">Save & Continue →</button>`
            : `<button class="btn btn-primary" onclick="tFinalSubmit()">Submit Application</button>`
          }
        </div>
      </div>
    </div>`;
  attachTStepHandlers(step);
}

function renderTProgressBar(step, steps) {
  const pct = Math.round(((step - 1) / (steps.length - 1)) * 100);
  const dots = steps.map((label, i) => {
    const n = i + 1;
    const cls = n < step ? 'completed' : n === step ? 'active' : '';
    return `<div class="wizard-step-dot ${cls}" title="${label}">
      <div class="dot">${n < step ? '✓' : n}</div>
      <div class="dot-label">${label}</div>
    </div>`;
  }).join('<div class="wizard-connector"></div>');
  return `
    <div class="wizard-progress">
      <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
      <div class="wizard-dots">${dots}</div>
    </div>`;
}

function renderTStep(step) {
  if (step === 1) return renderTStep1();
  if (step === 2) return renderTStep2();
  if (step === 3) return renderTStep3();
  return '';
}

function renderTStep1() {
  return `
    <h3 style="margin-bottom:1.5rem;">Step 1: Company Information</h3>
    <div class="form-grid-2">
      <div class="form-group">
        <label class="form-label required">Company Name</label>
        <input class="form-control" id="t-company-name" value="${escHtml(tv('company_name'))}" placeholder="Legal company name">
      </div>
      <div class="form-group">
        <label class="form-label required">Trade Name</label>
        <input class="form-control" id="t-trade-name" value="${escHtml(tv('trade_name'))}" placeholder="Trade / DBA name">
      </div>
      <div class="form-group">
        <label class="form-label required">GSTIN</label>
        <input class="form-control" id="t-gstin" value="${escHtml(tv('gstin'))}" placeholder="22AAAAA0000A1Z5" maxlength="15">
      </div>
      <div class="form-group">
        <label class="form-label required">PAN</label>
        <input class="form-control" id="t-pan" value="${escHtml(tv('pan'))}" placeholder="AAAAA0000A" maxlength="10" style="text-transform:uppercase">
      </div>
      <div class="form-group">
        <label class="form-label required">Transport License No.</label>
        <input class="form-control" id="t-license-no" value="${escHtml(tv('transport_license_no'))}" placeholder="License number">
      </div>
      <div class="form-group">
        <label class="form-label">License Expiry</label>
        <input class="form-control" type="date" id="t-license-expiry" value="${escHtml(tv('license_expiry'))}">
      </div>
      <div class="form-group">
        <label class="form-label required">Contact Person</label>
        <input class="form-control" id="t-contact-person" value="${escHtml(tv('contact_person'))}" placeholder="Primary contact name">
      </div>
      <div class="form-group">
        <label class="form-label required">Contact Email</label>
        <input class="form-control" type="email" id="t-contact-email" value="${escHtml(tv('contact_email'))}" placeholder="contact@company.com">
      </div>
      <div class="form-group">
        <label class="form-label required">Contact Mobile</label>
        <input class="form-control" id="t-contact-mobile" value="${escHtml(tv('contact_mobile'))}" placeholder="10-digit mobile">
      </div>
      <div class="form-group">
        <label class="form-label">Website</label>
        <input class="form-control" id="t-website" value="${escHtml(tv('website'))}" placeholder="https://...">
      </div>
    </div>
    <div class="form-group" style="margin-top:0.5rem;">
      <label class="form-label required">Registered Address</label>
      <textarea class="form-control" id="t-address" rows="2" placeholder="Full registered address">${escHtml(tv('registered_address'))}</textarea>
    </div>
    <div class="form-grid-3">
      <div class="form-group">
        <label class="form-label required">City</label>
        <input class="form-control" id="t-city" value="${escHtml(tv('city'))}" placeholder="City">
      </div>
      <div class="form-group">
        <label class="form-label required">State</label>
        <input class="form-control" id="t-state" value="${escHtml(tv('state'))}" placeholder="State">
      </div>
      <div class="form-group">
        <label class="form-label required">PIN Code</label>
        <input class="form-control" id="t-pin" value="${escHtml(tv('pin_code'))}" placeholder="6-digit PIN" maxlength="6">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Fleet Size (approx.)</label>
      <input class="form-control" type="number" id="t-fleet-size" value="${escHtml(tv('fleet_size'))}" placeholder="Number of vehicles" min="0">
    </div>
    <div id="t-step1-errors"></div>`;
}

function renderTStep2() {
  const docs = (_tProfile && _tProfile.documents) || [];
  const rows = T_MANDATORY_DOCS.map(dt => tDocRow(dt, docs.find(d => d.doc_type === dt && !d.is_deleted))).join('');
  return `
    <h3 style="margin-bottom:1.5rem;">Step 2: Documents</h3>
    <p style="color:var(--gray-600);margin-bottom:1.5rem;">Upload clear copies of each required document (PDF, JPG, PNG — max 5 MB each).</p>
    <div id="t-doc-list">${rows}</div>
    <div id="t-step2-errors" style="margin-top:1rem;"></div>`;
}

function tDocRow(docType, existing) {
  const label = T_DOC_LABELS[docType] || docType;
  const mandatory = T_MANDATORY_DOCS.includes(docType);
  const hasFile = existing && existing.id;
  return `
    <div class="doc-upload-row" id="t-docrow-${docType}" style="display:flex;align-items:center;gap:1rem;padding:1rem;border:1px solid var(--border);border-radius:8px;margin-bottom:0.75rem;">
      <div style="flex:1;">
        <div style="font-weight:500;">${label}${mandatory ? ' <span style="color:var(--danger)">*</span>' : ''}</div>
        ${hasFile ? `<div style="font-size:0.82rem;color:var(--success);margin-top:0.25rem;">✓ Uploaded${existing.expiry_date ? ` · Expires ${fmtDate(existing.expiry_date)}` : ''}</div>` : '<div style="font-size:0.82rem;color:var(--gray-500);margin-top:0.25rem;">Not uploaded</div>'}
      </div>
      <div>
        ${hasFile ? `
          <input type="date" id="t-doc-expiry-${docType}" class="form-control form-control-sm" placeholder="Expiry (optional)" value="${existing.expiry_date || ''}" style="margin-bottom:0.5rem;width:150px;">
          <label class="btn btn-outline btn-sm" style="cursor:pointer;margin-right:0.5rem;">
            Replace <input type="file" accept=".pdf,.jpg,.jpeg,.png" style="display:none" onchange="handleTDocUpload(this,'${docType}')">
          </label>
          <button class="btn btn-danger btn-sm" onclick="deleteTDoc('${docType}','${existing.id}')">Remove</button>
        ` : `
          <input type="date" id="t-doc-expiry-${docType}" class="form-control form-control-sm" placeholder="Expiry (optional)" style="margin-bottom:0.5rem;width:150px;">
          <label class="btn btn-primary btn-sm" style="cursor:pointer;">
            Upload <input type="file" accept=".pdf,.jpg,.jpeg,.png" style="display:none" onchange="handleTDocUpload(this,'${docType}')">
          </label>
        `}
      </div>
    </div>`;
}

async function handleTDocUpload(input, docType) {
  if (!input.files[0]) return;
  const file = input.files[0];
  if (file.size > 5 * 1024 * 1024) { Toast.error('File must be under 5 MB'); return; }
  const expiryEl = document.getElementById(`t-doc-expiry-${docType}`);
  const fd = new FormData();
  fd.append('doc_type', docType);
  fd.append('file', file);
  if (expiryEl && expiryEl.value) fd.append('expiry_date', expiryEl.value);
  Loading.show();
  try {
    const res = await fetch('/api/transporter/step/2/upload', { method: 'POST', body: fd, credentials: 'same-origin' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    Toast.success('Document uploaded');
    await refreshTProfile();
    reRenderTDocList();
  } catch (e) {
    Toast.error(e.message);
  } finally {
    Loading.hide();
  }
}

async function deleteTDoc(docType, docId) {
  if (!confirm('Remove this document?')) return;
  Loading.show();
  try {
    const res = await api('DELETE', `/api/transporter/document/${docId}`);
    Toast.success('Document removed');
    await refreshTProfile();
    reRenderTDocList();
  } catch (e) {
    Toast.error(e.message || 'Failed to remove');
  } finally {
    Loading.hide();
  }
}

async function refreshTProfile() {
  _tProfile = await api('GET', '/api/transporter/profile');
}

function reRenderTDocList() {
  const docs = (_tProfile && _tProfile.documents) || [];
  const rows = T_MANDATORY_DOCS.map(dt => tDocRow(dt, docs.find(d => d.doc_type === dt && !d.is_deleted))).join('');
  const el = document.getElementById('t-doc-list');
  if (el) el.innerHTML = rows;
}

function renderTStep3() {
  return `
    <h3 style="margin-bottom:1.5rem;">Step 3: Banking Details</h3>
    <div class="form-grid-2">
      <div class="form-group">
        <label class="form-label required">Account Holder Name</label>
        <input class="form-control" id="t-acc-name" value="${escHtml(tv('bank_account_name'))}" placeholder="As per bank records">
      </div>
      <div class="form-group">
        <label class="form-label required">Account Number</label>
        <input class="form-control" id="t-acc-no" value="${escHtml(tv('bank_account_no'))}" placeholder="Account number">
      </div>
      <div class="form-group">
        <label class="form-label required">IFSC Code</label>
        <input class="form-control" id="t-ifsc" value="${escHtml(tv('bank_ifsc'))}" placeholder="e.g. HDFC0001234" maxlength="11">
      </div>
      <div class="form-group">
        <label class="form-label required">Bank Name</label>
        <input class="form-control" id="t-bank-name" value="${escHtml(tv('bank_name'))}" placeholder="Bank name">
      </div>
      <div class="form-group">
        <label class="form-label">Branch</label>
        <input class="form-control" id="t-branch" value="${escHtml(tv('bank_branch'))}" placeholder="Branch name">
      </div>
    </div>
    <div id="t-step3-errors" style="margin-top:1rem;"></div>`;
}

function attachTStepHandlers(step) {
  ['t-gstin', 't-pan', 't-ifsc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => { el.value = el.value.toUpperCase(); });
  });
}

function renderTFieldErrors(errors, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!errors || !errors.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="alert alert-danger"><ul style="margin:0;padding-left:1.2rem;">${errors.map(e => `<li>${escHtml(e)}</li>`).join('')}</ul></div>`;
}

async function submitTStep(step) {
  if (step === 1) await saveTStep1();
  else if (step === 2) await saveTStep2();
}

async function saveTStep1() {
  const errs = [];
  const gst = document.getElementById('t-gstin').value.trim().toUpperCase();
  const pan = document.getElementById('t-pan').value.trim().toUpperCase();
  const mobile = document.getElementById('t-contact-mobile').value.trim();
  if (!document.getElementById('t-company-name').value.trim()) errs.push('Company name is required');
  if (!document.getElementById('t-trade-name').value.trim()) errs.push('Trade name is required');
  if (!gst) errs.push('GSTIN is required');
  else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gst)) errs.push('Invalid GSTIN format');
  if (!pan) errs.push('PAN is required');
  else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)) errs.push('Invalid PAN format');
  if (!document.getElementById('t-license-no').value.trim()) errs.push('Transport License No. is required');
  if (!document.getElementById('t-contact-person').value.trim()) errs.push('Contact person is required');
  if (!document.getElementById('t-contact-email').value.trim()) errs.push('Contact email is required');
  if (!mobile) errs.push('Contact mobile is required');
  else if (!validateMobile(mobile)) errs.push('Invalid mobile number');
  if (!document.getElementById('t-address').value.trim()) errs.push('Registered address is required');
  if (!document.getElementById('t-city').value.trim()) errs.push('City is required');
  if (!document.getElementById('t-state').value.trim()) errs.push('State is required');
  const pin = document.getElementById('t-pin').value.trim();
  if (!pin) errs.push('PIN code is required');
  else if (!/^\d{6}$/.test(pin)) errs.push('PIN code must be 6 digits');
  if (errs.length) { renderTFieldErrors(errs, 't-step1-errors'); return; }
  renderTFieldErrors([], 't-step1-errors');
  const payload = {
    company_name: document.getElementById('t-company-name').value.trim(),
    trade_name: document.getElementById('t-trade-name').value.trim(),
    gstin: gst,
    pan: pan,
    transport_license_no: document.getElementById('t-license-no').value.trim(),
    license_expiry: document.getElementById('t-license-expiry').value || null,
    contact_person: document.getElementById('t-contact-person').value.trim(),
    contact_email: document.getElementById('t-contact-email').value.trim(),
    contact_mobile: mobile,
    website: document.getElementById('t-website').value.trim() || null,
    registered_address: document.getElementById('t-address').value.trim(),
    city: document.getElementById('t-city').value.trim(),
    state: document.getElementById('t-state').value.trim(),
    pin_code: pin,
    fleet_size: parseInt(document.getElementById('t-fleet-size').value) || null
  };
  Loading.show();
  try {
    const res = await api('POST', '/api/transporter/step/1', payload);
    _tProfile = { ..._tProfile, ...payload, registration_step: Math.max(_tProfile.registration_step || 1, 2) };
    Toast.success('Company info saved');
    renderTWizard(2);
  } catch (e) {
    Toast.error(e.message || 'Save failed');
  } finally {
    Loading.hide();
  }
}

async function saveTStep2() {
  Loading.show();
  try {
    const res = await api('POST', '/api/transporter/step/2/complete');
    await refreshTProfile();
    Toast.success('Documents saved');
    renderTWizard(3);
  } catch (e) {
    const missing = (e.data && e.data.missing) || [];
    const errs = missing.length ? missing.map(d => `${T_DOC_LABELS[d] || d} is required`) : [e.message || 'Upload all required documents'];
    renderTFieldErrors(errs, 't-step2-errors');
    Toast.error('Please upload all required documents');
  } finally {
    Loading.hide();
  }
}

async function tFinalSubmit() {
  const errs = [];
  const accName = document.getElementById('t-acc-name').value.trim();
  const accNo = document.getElementById('t-acc-no').value.trim();
  const ifsc = document.getElementById('t-ifsc').value.trim().toUpperCase();
  const bankName = document.getElementById('t-bank-name').value.trim();
  if (!accName) errs.push('Account holder name is required');
  if (!accNo) errs.push('Account number is required');
  if (!ifsc) errs.push('IFSC code is required');
  else if (!validateIFSC(ifsc)) errs.push('Invalid IFSC code format');
  if (!bankName) errs.push('Bank name is required');
  if (errs.length) { renderTFieldErrors(errs, 't-step3-errors'); return; }
  const payload = {
    bank_account_name: accName,
    bank_account_no: accNo,
    bank_ifsc: ifsc,
    bank_name: bankName,
    bank_branch: document.getElementById('t-branch').value.trim() || null
  };
  Loading.show();
  try {
    await api('POST', '/api/transporter/step/3', payload);
    await api('POST', '/api/transporter/submit');
    Toast.success('Application submitted!');
    showTSubmittedState();
  } catch (e) {
    Toast.error(e.message || 'Submission failed');
  } finally {
    Loading.hide();
  }
}

async function goToTStep(step) {
  await refreshTProfile();
  renderTWizard(step);
}

async function initVehicleManagement() {
  await loadVehicles();
  document.getElementById('add-vehicle-btn').addEventListener('click', showAddVehicleModal);
}

async function loadVehicles() {
  try {
    const res = await api('GET', '/api/transporter/vehicles');
    renderVehicleList(Array.isArray(res) ? res : (res.vehicles || []));
  } catch (e) {
    Toast.error('Failed to load vehicles');
  }
}

function renderVehicleList(vehicles) {
  const el = document.getElementById('vehicle-list');
  if (!el) return;
  if (!vehicles.length) {
    el.innerHTML = '<div class="empty-state"><p>No vehicles registered yet.</p><button class="btn btn-primary" onclick="showAddVehicleModal()">Add Vehicle</button></div>';
    return;
  }
  el.innerHTML = vehicles.map(v => `
    <div class="card" style="margin-bottom:1rem;">
      <div style="display:flex;justify-content:space-between;align-items:start;">
        <div>
          <div style="font-weight:600;font-size:1.1rem;">${escHtml(v.vehicle_no)}</div>
          <div style="color:var(--gray-600);font-size:0.875rem;">${escHtml(v.vehicle_type)} · ${escHtml(v.make_model || '')} ${v.year ? `(${v.year})` : ''}</div>
          <div style="margin-top:0.5rem;">
            <span class="badge ${v.status === 'active' ? 'badge-approved' : v.status === 'compliance_hold' ? 'badge-rejected' : 'badge-pending'}">${v.status}</span>
          </div>
        </div>
        <button class="btn btn-outline btn-sm" onclick="showVehicleDocModal('${v.id}','${escHtml(v.vehicle_no)'}">Manage Docs</button>
      </div>
      ${renderVehicleDocBadges(v.documents || [])}
    </div>`).join('');
}

function renderVehicleDocBadges(docs) {
  if (!docs.length) return '<div style="font-size:0.8rem;color:var(--gray-500);margin-top:0.5rem;">No documents uploaded</div>';
  return `<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.75rem;">
    ${docs.map(d => `<span class="badge ${d.expiry_status === 'expired' ? 'badge-rejected' : d.expiry_status === 'expiring_soon' ? 'badge-warning' : 'badge-approved'}" title="${escHtml(d.doc_type)}">${escHtml(d.doc_type.replace('_', ' '))}</span>`).join('')}
  </div>`;
}

function showAddVehicleModal() {
  const html = `
    <div class="modal-header"><h3>Add Vehicle</h3></div>
    <div class="modal-body">
      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label required">Vehicle Number</label>
          <input class="form-control" id="v-no" placeholder="MH12AB1234" style="text-transform:uppercase">
        </div>
        <div class="form-group">
          <label class="form-label required">Vehicle Type</label>
          <select class="form-control" id="v-type">
            <option value="">Select type</option>
            <option>Truck</option><option>Tempo</option><option>Container</option>
            <option>Flatbed</option><option>Tanker</option><option>Trailer</option><option>Other</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Make & Model</label>
          <input class="form-control" id="v-make" placeholder="Tata 407">
        </div>
        <div class="form-group">
          <label class="form-label">Year</label>
          <input class="form-control" type="number" id="v-year" placeholder="2020" min="1990" max="2030">
        </div>
        <div class="form-group">
          <label class="form-label">Capacity (tonnes)</label>
          <input class="form-control" type="number" id="v-capacity" placeholder="5" step="0.1">
        </div>
        <div class="form-group">
          <label class="form-label">RC Expiry</label>
          <input class="form-control" type="date" id="v-rc-expiry">
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal('add-vehicle-modal')">Cancel</button>
      <button class="btn btn-primary" onclick="saveVehicle()">Add Vehicle</button>
    </div>`;
  let modal = document.getElementById('add-vehicle-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'add-vehicle-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-box">${html}</div>`;
    document.body.appendChild(modal);
  } else {
    modal.querySelector('.modal-box').innerHTML = html;
  }
  openModal('add-vehicle-modal');
}

async function saveVehicle() {
  const no = document.getElementById('v-no').value.trim().toUpperCase();
  const type = document.getElementById('v-type').value;
  if (!no || !type) { Toast.error('Vehicle number and type are required'); return; }
  const payload = {
    vehicle_no: no,
    vehicle_type: type,
    make_model: document.getElementById('v-make').value.trim() || null,
    year: parseInt(document.getElementById('v-year').value) || null,
    capacity_tonnes: parseFloat(document.getElementById('v-capacity').value) || null,
    rc_expiry: document.getElementById('v-rc-expiry').value || null
  };
  Loading.show();
  try {
    await api('POST', '/api/transporter/vehicles', payload);
    Toast.success('Vehicle added');
    closeModal('add-vehicle-modal');
    await loadVehicles();
  } catch (e) {
    Toast.error(e.message || 'Failed to add vehicle');
  } finally {
    Loading.hide();
  }
}

function showVehicleDocModal(vehicleId, vehicleNo) {
  const html = `
    <div class="modal-header"><h3>Documents: ${escHtml(vehicleNo)}</h3></div>
    <div class="modal-body" id="vdoc-modal-body">Loading...</div>
    <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('vdoc-modal')">Close</button></div>`;
  let modal = document.getElementById('vdoc-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'vdoc-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-box" style="max-width:600px;">${html}</div>`;
    document.body.appendChild(modal);
  } else {
    modal.querySelector('.modal-box').innerHTML = html;
  }
  openModal('vdoc-modal');
  loadVehicleDocModal(vehicleId);
}

async function loadVehicleDocModal(vehicleId) {
  const body = document.getElementById('vdoc-modal-body');
  const V_DOC_TYPES = ['rc', 'insurance', 'fitness_certificate', 'permit', 'pollution_certificate'];
  try {
    const res = await api('GET', '/api/transporter/vehicles');
    const vehicles = Array.isArray(res) ? res : (res.vehicles || []);
    const v = vehicles.find(x => x.id === vehicleId);
    const docs = v ? (v.documents || []) : [];
    body.innerHTML = V_DOC_TYPES.map(dt => {
      const existing = docs.find(d => d.doc_type === dt && !d.is_deleted);
      return tVehicleDocRow(vehicleId, dt, existing);
    }).join('');
  } catch (e) {
    body.innerHTML = '<p class="text-danger">Failed to load documents</p>';
  }
}

function tVehicleDocRow(vehicleId, docType, existing) {
  const label = docType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const hasFile = existing && existing.id;
  return `
    <div style="display:flex;align-items:center;gap:1rem;padding:0.75rem 0;border-bottom:1px solid var(--border);">
      <div style="flex:1;">
        <div style="font-weight:500;">${label}</div>
        ${hasFile ? `<div style="font-size:0.8rem;color:var(--success);">✓ Uploaded${existing.expiry_date ? ` · Expires ${fmtDate(existing.expiry_date)}` : ''}</div>` : '<div style="font-size:0.8rem;color:var(--gray-500);">Not uploaded</div>'}
      </div>
      <div>
        <input type="date" id="vdoc-expiry-${vehicleId}-${docType}" class="form-control form-control-sm" value="${existing ? (existing.expiry_date || '') : ''}" style="width:140px;margin-bottom:0.25rem;">
        <label class="btn btn-${hasFile ? 'outline' : 'primary'} btn-sm" style="cursor:pointer;">
          ${hasFile ? 'Replace' : 'Upload'}
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" style="display:none" onchange="handleVDocUpload(this,'${vehicleId}','${docType}')">
        </label>
      </div>
    </div>`;
}

async function handleVDocUpload(input, vehicleId, docType) {
  if (!input.files[0]) return;
  const file = input.files[0];
  if (file.size > 5 * 1024 * 1024) { Toast.error('File must be under 5 MB'); return; }
  const expiryEl = document.getElementById(`vdoc-expiry-${vehicleId}-${docType}`);
  const fd = new FormData();
  fd.append('doc_type', docType);
  fd.append('file', file);
  if (expiryEl && expiryEl.value) fd.append('expiry_date', expiryEl.value);
  Loading.show();
  try {
    const res = await fetch(`/api/transporter/vehicles/${vehicleId}/documents`, { method: 'POST', body: fd, credentials: 'same-origin' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    Toast.success('Document uploaded');
    await loadVehicles();
    await loadVehicleDocModal(vehicleId);
  } catch (e) {
    Toast.error(e.message);
  } finally {
    Loading.hide();
  }
}
