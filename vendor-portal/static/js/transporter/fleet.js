'use strict';

async function loadFleet() {
  const el = document.getElementById('fleet-list');
  if (!el) return;
  try {
    const vehicles = await api('GET', '/api/transporter/vehicles');
    renderFleetList(Array.isArray(vehicles) ? vehicles : []);
  } catch(e) {
    el.innerHTML = '<div class="empty-state"><p style="color:var(--danger)">Failed to load</p></div>';
  }
}

function renderFleetList(vehicles) {
  const el = document.getElementById('fleet-list');
  if (!vehicles.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">🚗</div><p>No vehicles registered yet. Click “+ Add Vehicle” to add one.</p></div>';
    return;
  }
  el.innerHTML = vehicles.map(v => `
    <div class="card" style="margin-bottom:0.75rem;">
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:0.5rem;">
          <div>
            <div style="font-weight:600;font-size:1.05rem">${escHtml(v.reg_number)}</div>
            <div style="font-size:0.85rem;color:var(--gray-600)">${escHtml(v.vehicle_type)}</div>
          </div>
          ${statusBadge(v.status)}
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:0.5rem;margin-top:0.75rem;font-size:0.82rem;">
          ${v.capacity_tons      ? `<div><span style="color:var(--gray-500)">Capacity: </span>${fmtNum(v.capacity_tons)} tons</div>` : ''}
          ${v.year_of_manufacture ? `<div><span style="color:var(--gray-500)">Year: </span>${v.year_of_manufacture}</div>` : ''}
          ${v.driver_name        ? `<div><span style="color:var(--gray-500)">Driver: </span>${escHtml(v.driver_name)}</div>` : ''}
          ${v.driver_license_number ? `<div><span style="color:var(--gray-500)">License: </span>${escHtml(v.driver_license_number)}</div>` : ''}
          ${v.driver_license_expiry ? `<div><span style="color:var(--gray-500)">License Expiry: </span>${fmtDate(v.driver_license_expiry)}</div>` : ''}
        </div>
      </div>
    </div>`).join('');
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
        <div class="form-group">
          <label class="form-label required">Registration Number</label>
          <input class="form-control" type="text" id="veh-reg" placeholder="e.g. MH01AB1234" style="text-transform:uppercase">
        </div>
        <div class="form-group">
          <label class="form-label required">Vehicle Type</label>
          <select class="form-control" id="veh-type">
            <option value="">Select...</option>
            <option>Truck-LCV</option><option>Truck-MCV</option><option>Truck-HCV</option>
            <option>Truck-XLCV</option><option>Trailer</option><option>Tanker</option>
            <option>Container-20ft</option><option>Container-40ft</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Capacity (tons)</label>
          <input class="form-control" type="number" id="veh-capacity" step="0.1" min="0" placeholder="0.0">
        </div>
        <div class="form-group">
          <label class="form-label">Year of Manufacture</label>
          <input class="form-control" type="number" id="veh-year" min="1990" max="2030" placeholder="YYYY">
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Driver Name</label>
          <input class="form-control" type="text" id="veh-driver" placeholder="Driver's full name">
        </div>
        <div class="form-group">
          <label class="form-label">Driver License No.</label>
          <input class="form-control" type="text" id="veh-license" placeholder="DL number">
        </div>
        <div class="form-group">
          <label class="form-label">License Expiry</label>
          <input class="form-control" type="date" id="veh-license-expiry">
        </div>
      </div>
      <div id="veh-errors"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal('modal-add-vehicle')">Cancel</button>
      <button class="btn btn-primary" onclick="submitVehicle()">Add Vehicle</button>
    </div>
  </div>`;
  openModal('modal-add-vehicle');
}

async function submitVehicle() {
  const reg_number   = document.getElementById('veh-reg')?.value.trim().toUpperCase();
  const vehicle_type = document.getElementById('veh-type')?.value;
  const errEl        = document.getElementById('veh-errors');

  if (!reg_number)   { errEl.innerHTML = '<div class="alert alert-danger">Registration number is required</div>'; return; }
  if (!vehicle_type) { errEl.innerHTML = '<div class="alert alert-danger">Vehicle type is required</div>'; return; }

  Loading.show();
  try {
    await api('POST', '/api/transporter/vehicles', {
      reg_number, vehicle_type,
      capacity_tons:         parseFloat(document.getElementById('veh-capacity')?.value) || null,
      year_of_manufacture:   parseInt(document.getElementById('veh-year')?.value)       || null,
      driver_name:           document.getElementById('veh-driver')?.value.trim()        || null,
      driver_license_number: document.getElementById('veh-license')?.value.trim()       || null,
      driver_license_expiry: document.getElementById('veh-license-expiry')?.value       || null,
    });
    Toast.success('Vehicle added');
    closeModal('modal-add-vehicle');
    await loadFleet();
  } catch(e) {
    errEl.innerHTML = `<div class="alert alert-danger">${escHtml(e.message)}</div>`;
  } finally { Loading.hide(); }
}
