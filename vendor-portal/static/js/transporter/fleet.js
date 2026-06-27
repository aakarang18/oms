'use strict';

const VEHICLE_TYPES = ['Open', 'Closed', 'Tanker', 'Trailer', 'LCV', 'HCV'];

async function loadFleet() {
  const el = document.getElementById('fleet-list');
  if (!el) return;
  try {
    const vehicles = await api('GET', '/api/transporter/vehicles');
    const list = Array.isArray(vehicles) ? vehicles : [];
    if (!list.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">🚗</div><p>No vehicles registered</p></div>';
      return;
    }
    el.innerHTML = list.map(v => `
      <div class="card" style="margin-bottom:0.75rem;">
        <div class="card-body">
          <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:0.5rem;">
            <div>
              <div style="font-weight:600;font-size:1rem;">${escHtml(v.reg_number)}</div>
              <div style="font-size:0.82rem;color:var(--gray-500)">${escHtml(v.vehicle_type)}${v.capacity_tons ? ` · ${fmtNum(v.capacity_tons)} T` : ''}</div>
            </div>
            <div style="display:flex;gap:0.5rem;align-items:center;">
              ${statusBadge(v.status)}
              ${(v.compliance_alerts || 0) > 0 ? `<span class="badge badge-danger">⚠ ${v.compliance_alerts} Alert${v.compliance_alerts > 1 ? 's' : ''}</span>` : ''}
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:0.5rem;margin-top:0.75rem;font-size:0.82rem;">
            ${v.driver_name ? `<div><span style="color:var(--gray-500)">Driver: </span>${escHtml(v.driver_name)}</div>` : ''}
            ${v.driver_license_number ? `<div><span style="color:var(--gray-500)">License: </span>${escHtml(v.driver_license_number)}</div>` : ''}
            ${v.year_of_manufacture ? `<div><span style="color:var(--gray-500)">Year: </span>${v.year_of_manufacture}</div>` : ''}
            <div><span style="color:var(--gray-500)">Docs: </span>${v.doc_count || 0} uploaded</div>
          </div>
          <div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:0.75rem;">
            <button class="btn btn-outline btn-sm" onclick="showVehicleDetail('${v.id}')">View / Upload Docs</button>
          </div>
        </div>
      </div>
    `).join('');
  } catch(e) {
    el.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">${escHtml(e.message)}</p></div>`;
  }
}

async function showVehicleDetail(vehicleId) {
  let modal = document.getElementById('vehicle-detail-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'vehicle-detail-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = '<div class="modal-box" style="max-width:640px;"><div id="vehicle-detail-body"></div></div>';
    document.body.appendChild(modal);
  }
  document.getElementById('vehicle-detail-body').innerHTML =
    '<div class="empty-state"><div class="spinner"></div></div>';
  openModal('vehicle-detail-modal');
  try {
    const v = await api('GET', `/api/transporter/vehicles/${vehicleId}`);
    renderVehicleDetail(v);
  } catch(e) {
    document.getElementById('vehicle-detail-body').innerHTML =
      `<div class="card-body"><p style="color:var(--danger)">${escHtml(e.message)}</p>
       <button class="btn btn-outline" onclick="closeModal('vehicle-detail-modal')">Close</button></div>`;
  }
}

function renderVehicleDetail(v) {
  const docs = v.documents || [];
  const docTypes = ['rc_book', 'insurance', 'fitness', 'pollution', 'other'];
  const docLabels = { rc_book: 'RC Book', insurance: 'Insurance', fitness: 'Fitness Certificate',
                      pollution: 'Pollution Certificate', other: 'Other' };
  document.getElementById('vehicle-detail-body').innerHTML = `
    <div class="modal-header">
      <h3>${escHtml(v.reg_number)}</h3>
      <button class="modal-close" onclick="closeModal('vehicle-detail-modal')">×</button>
    </div>
    <div class="modal-body">
      <div class="detail-grid" style="margin-bottom:1.5rem;">
        <div><div style="font-size:0.75rem;color:var(--gray-500)">Type</div>${escHtml(v.vehicle_type)}</div>
        <div><div style="font-size:0.75rem;color:var(--gray-500)">Capacity</div>${v.capacity_tons ? fmtNum(v.capacity_tons) + ' T' : '—'}</div>
        <div><div style="font-size:0.75rem;color:var(--gray-500)">Driver</div>${escHtml(v.driver_name || '—')}</div>
        <div><div style="font-size:0.75rem;color:var(--gray-500)">License</div>${escHtml(v.driver_license_number || '—')}</div>
        ${v.driver_license_expiry ? `<div><div style="font-size:0.75rem;color:var(--gray-500)">License Expiry</div>${fmtDate(v.driver_license_expiry)}</div>` : ''}
      </div>
      <h4 style="margin-bottom:0.75rem;">Documents</h4>
      ${docTypes.map(dt => {
        const doc = docs.find(d => d.doc_type === dt);
        return `
          <div style="display:flex;align-items:center;gap:0.75rem;padding:0.6rem 0;border-bottom:1px solid var(--gray-100);">
            <div style="flex:1;">
              <div style="font-size:0.875rem;font-weight:500;">${docLabels[dt]}</div>
              ${doc ? `<div style="font-size:0.75rem;color:var(--gray-500);">Uploaded · Expiry: ${doc.expiry_date ? fmtDate(doc.expiry_date) : 'N/A'}</div>` : '<div style="font-size:0.75rem;color:var(--gray-400);">Not uploaded</div>'}
            </div>
            ${doc ? statusBadge(doc.expiry_status || 'ok') : ''}
            <label class="btn btn-outline btn-sm" style="cursor:pointer;margin:0;">
              ${doc ? 'Replace' : 'Upload'}
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" style="display:none"
                onchange="uploadVehicleDoc('${v.id}','${dt}',this)">
            </label>
          </div>`;
      }).join('')}
      <div style="margin-top:0.5rem;font-size:0.8rem;color:var(--gray-500);">
        Expiry date field will appear after selecting a file.
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal('vehicle-detail-modal')">Close</button>
    </div>`;
}

async function uploadVehicleDoc(vehicleId, docType, input) {
  const file = input.files[0];
  if (!file) return;
  const expiry = prompt('Enter expiry date (YYYY-MM-DD), or leave blank if not applicable:');
  const fd = new FormData();
  fd.append('file', file);
  fd.append('doc_type', docType);
  if (expiry && expiry.trim()) fd.append('expiry_date', expiry.trim());
  Loading.show();
  try {
    const tok = document.cookie.split(';').map(c => c.trim())
      .find(c => c.startsWith('portal_session='))?.split('=')[1];
    const resp = await fetch(`/api/transporter/vehicles/${vehicleId}/documents`, {
      method: 'POST',
      headers: tok ? { 'X-Session-Token': tok } : {},
      body: fd,
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json.error || 'Upload failed');
    Toast.success('Document uploaded');
    await showVehicleDetail(vehicleId);
    await loadFleet();
  } catch(e) {
    Toast.error(e.message);
  } finally {
    Loading.hide();
  }
}

function openAddVehicleModal() {
  let modal = document.getElementById('modal-add-vehicle');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-add-vehicle';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `<div class="modal-box" style="max-width:520px;">
    <div class="modal-header">
      <h3>Add Vehicle</h3>
      <button class="modal-close" onclick="closeModal('modal-add-vehicle')">×</button>
    </div>
    <div class="modal-body">
      <div class="form-grid-2">
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label required">Registration Number</label>
          <input class="form-control" id="v-reg" placeholder="e.g. MH12AB1234" style="text-transform:uppercase">
        </div>
        <div class="form-group">
          <label class="form-label required">Vehicle Type</label>
          <select class="form-control" id="v-type">
            ${VEHICLE_TYPES.map(t => `<option>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Capacity (Tons)</label>
          <input class="form-control" type="number" id="v-capacity" step="0.1" min="0">
        </div>
        <div class="form-group">
          <label class="form-label">Year of Manufacture</label>
          <input class="form-control" type="number" id="v-year" min="1990" max="${new Date().getFullYear()}">
        </div>
        <div class="form-group">
          <label class="form-label">Driver Name</label>
          <input class="form-control" id="v-driver">
        </div>
        <div class="form-group">
          <label class="form-label">Driver License No.</label>
          <input class="form-control" id="v-license">
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Driver License Expiry</label>
          <input class="form-control" type="date" id="v-license-expiry">
        </div>
      </div>
      <div id="v-errors"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal('modal-add-vehicle')">Cancel</button>
      <button class="btn btn-primary" onclick="submitAddVehicle()">Add Vehicle</button>
    </div>
  </div>`;
  openModal('modal-add-vehicle');
}

async function submitAddVehicle() {
  const reg = document.getElementById('v-reg').value.trim().toUpperCase();
  if (!reg) {
    document.getElementById('v-errors').innerHTML = '<div class="alert alert-danger">Registration number is required</div>';
    return;
  }
  Loading.show();
  try {
    await api('POST', '/api/transporter/vehicles', {
      reg_number: reg,
      vehicle_type: document.getElementById('v-type').value,
      capacity_tons: document.getElementById('v-capacity').value || null,
      year_of_manufacture: document.getElementById('v-year').value || null,
      driver_name: document.getElementById('v-driver').value.trim() || null,
      driver_license_number: document.getElementById('v-license').value.trim() || null,
      driver_license_expiry: document.getElementById('v-license-expiry').value || null,
    });
    Toast.success('Vehicle added');
    closeModal('modal-add-vehicle');
    await loadFleet();
  } catch(e) {
    document.getElementById('v-errors').innerHTML = `<div class="alert alert-danger">${escHtml(e.message)}</div>`;
  } finally {
    Loading.hide();
  }
}
