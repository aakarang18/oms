'use strict';

// ── Routes ─────────────────────────────────────────────────────────────────────

let _adminRoutes = [];

async function initAdminRoutes() {
  const el = document.getElementById('routes-list');
  if (!el) return;
  try {
    _adminRoutes = await api('GET', '/api/admin/routes');
    renderAdminRoutes(Array.isArray(_adminRoutes) ? _adminRoutes : []);
  } catch(e) {
    el.innerHTML = '<div class="empty-state"><p style="color:var(--danger)">Failed to load routes</p></div>';
  }
}

function renderAdminRoutes(routes) {
  const el = document.getElementById('routes-list');
  if (!routes.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">🗺️</div><p>No routes defined yet</p></div>';
    return;
  }
  el.innerHTML = `<table class="data-table"><thead><tr>
    <th>Code</th><th>Origin</th><th>Destination</th><th>Distance</th><th>Type</th><th>Status</th>
  </tr></thead><tbody>${routes.map(r => `
    <tr>
      <td style="font-weight:600">${escHtml(r.route_code)}</td>
      <td>${escHtml(r.origin_city)}, ${escHtml(r.origin_state)}</td>
      <td>${escHtml(r.destination_city)}, ${escHtml(r.destination_state)}</td>
      <td>${r.distance_km ? fmtNum(r.distance_km) + ' km' : '—'}</td>
      <td>${escHtml(r.route_type)}</td>
      <td><span class="badge ${r.is_active ? 'badge-success' : 'badge-secondary'}">${r.is_active ? 'Active' : 'Inactive'}</span></td>
    </tr>`).join('')}</tbody></table>`;
}

function openCreateRouteModal() {
  let modal = document.getElementById('modal-create-route');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-create-route';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `<div class="modal-box" style="max-width:520px;">
    <div class="modal-header">
      <h3>Create Route</h3>
      <button class="modal-close" onclick="closeModal('modal-create-route')">×</button>
    </div>
    <div class="modal-body">
      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label required">Origin City</label>
          <input class="form-control" type="text" id="route-origin-city" placeholder="e.g. Mumbai">
        </div>
        <div class="form-group">
          <label class="form-label required">Origin State</label>
          <input class="form-control" type="text" id="route-origin-state" placeholder="e.g. Maharashtra">
        </div>
        <div class="form-group">
          <label class="form-label required">Destination City</label>
          <input class="form-control" type="text" id="route-dest-city" placeholder="e.g. Pune">
        </div>
        <div class="form-group">
          <label class="form-label required">Destination State</label>
          <input class="form-control" type="text" id="route-dest-state" placeholder="e.g. Maharashtra">
        </div>
        <div class="form-group">
          <label class="form-label">Distance (km)</label>
          <input class="form-control" type="number" id="route-distance" step="0.1" min="0" placeholder="0.0">
        </div>
        <div class="form-group">
          <label class="form-label">Route Type</label>
          <select class="form-control" id="route-type">
            <option value="Road">Road</option>
            <option value="Rail">Rail</option>
            <option value="Sea">Sea</option>
            <option value="Air">Air</option>
          </select>
        </div>
      </div>
      <div id="route-errors"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal('modal-create-route')">Cancel</button>
      <button class="btn btn-primary" onclick="submitRoute()">Create Route</button>
    </div>
  </div>`;
  openModal('modal-create-route');
}

async function submitRoute() {
  const origin_city       = document.getElementById('route-origin-city')?.value.trim();
  const origin_state      = document.getElementById('route-origin-state')?.value.trim();
  const destination_city  = document.getElementById('route-dest-city')?.value.trim();
  const destination_state = document.getElementById('route-dest-state')?.value.trim();
  const distance_km       = parseFloat(document.getElementById('route-distance')?.value) || null;
  const route_type        = document.getElementById('route-type')?.value;
  const errEl             = document.getElementById('route-errors');

  if (!origin_city || !origin_state || !destination_city || !destination_state) {
    errEl.innerHTML = '<div class="alert alert-danger">Origin and destination (city + state) are required</div>';
    return;
  }
  Loading.show();
  try {
    const res = await api('POST', '/api/admin/routes', { origin_city, origin_state, destination_city, destination_state, distance_km, route_type });
    Toast.success(`Route ${res.route_code} created`);
    closeModal('modal-create-route');
    await initAdminRoutes();
  } catch(e) {
    errEl.innerHTML = `<div class="alert alert-danger">${escHtml(e.message)}</div>`;
  } finally { Loading.hide(); }
}

// ── Rate Card Approvals ────────────────────────────────────────────────────

async function initAdminRateApprovals() {
  const el = document.getElementById('rate-approval-list');
  if (!el) return;
  try {
    const cards = await api('GET', '/api/admin/rate-cards?status=pending');
    renderRateApprovalList(Array.isArray(cards) ? cards : []);
  } catch(e) {
    el.innerHTML = '<div class="empty-state"><p style="color:var(--danger)">Failed to load</p></div>';
  }
}

function renderRateApprovalList(cards) {
  const el = document.getElementById('rate-approval-list');
  if (!cards.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">💰</div><p>No pending rate cards</p></div>';
    return;
  }
  el.innerHTML = cards.map(c => `
    <div class="card" style="margin-bottom:0.75rem;">
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:0.5rem;">
          <div>
            <div style="font-size:0.8rem;color:var(--gray-500)">${escHtml(c.route_code)} · ${escHtml(c.transporter_name)}</div>
            <div style="font-weight:600">${escHtml(c.origin_city)}, ${escHtml(c.origin_state)} → ${escHtml(c.destination_city)}, ${escHtml(c.destination_state)}</div>
            <div style="font-size:0.85rem;color:var(--gray-600)">${escHtml(c.vehicle_type)}</div>
          </div>
          ${statusBadge(c.status)}
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:0.5rem;margin-top:0.75rem;font-size:0.82rem;">
          ${c.rate_per_km    ? `<div><span style="color:var(--gray-500)">Rate/km: </span>₹${fmtNum(c.rate_per_km)}</div>` : ''}
          ${c.rate_per_ton   ? `<div><span style="color:var(--gray-500)">Rate/ton: </span>₹${fmtNum(c.rate_per_ton)}</div>` : ''}
          ${c.minimum_charge ? `<div><span style="color:var(--gray-500)">Min: </span>₹${fmtNum(c.minimum_charge)}</div>` : ''}
          <div><span style="color:var(--gray-500)">Valid: </span>${fmtDate(c.valid_from)} – ${fmtDate(c.valid_until)}</div>
        </div>
        <div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:0.75rem;flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm" onclick="reviewRateCard('${c.id}','approved')">Approve</button>
          <button class="btn btn-outline btn-sm" style="color:var(--danger);border-color:var(--danger)" onclick="openRateRejectModal('${c.id}')">Reject</button>
        </div>
      </div>
    </div>`).join('');
}

async function reviewRateCard(rcId, action) {
  if (!confirm(`${action === 'approved' ? 'Approve' : 'Reject'} this rate card?`)) return;
  Loading.show();
  try {
    await api('POST', `/api/admin/rate-cards/${rcId}/review`, { action });
    Toast.success(`Rate card ${action}`);
    await initAdminRateApprovals();
  } catch(e) { Toast.error(e.message); } finally { Loading.hide(); }
}

function openRateRejectModal(rcId) {
  let modal = document.getElementById('rate-reject-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'rate-reject-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `<div class="modal-box" style="max-width:420px;">
    <div class="modal-header">
      <h3>Reject Rate Card</h3>
      <button class="modal-close" onclick="closeModal('rate-reject-modal')">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label required">Rejection Reason</label>
        <textarea class="form-control" id="rate-reject-reason" rows="3" placeholder="Explain why this rate card is rejected..."></textarea>
      </div>
      <div id="rate-reject-errors"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal('rate-reject-modal')">Cancel</button>
      <button class="btn btn-danger" onclick="submitRateReject('${rcId}')">Reject</button>
    </div>
  </div>`;
  openModal('rate-reject-modal');
}

async function submitRateReject(rcId) {
  const reason = document.getElementById('rate-reject-reason')?.value.trim();
  if (!reason) {
    document.getElementById('rate-reject-errors').innerHTML = '<div class="alert alert-danger">Reason is required</div>';
    return;
  }
  Loading.show();
  try {
    await api('POST', `/api/admin/rate-cards/${rcId}/review`, { action: 'rejected', reason });
    Toast.success('Rate card rejected');
    closeModal('rate-reject-modal');
    await initAdminRateApprovals();
  } catch(e) {
    document.getElementById('rate-reject-errors').innerHTML = `<div class="alert alert-danger">${escHtml(e.message)}</div>`;
  } finally { Loading.hide(); }
}

// ── Admin Trips ────────────────────────────────────────────────────────────────

async function initAdminTrips() {
  const el = document.getElementById('admin-trips-list');
  if (!el) return;
  if (!_adminRoutes.length) {
    try { _adminRoutes = await api('GET', '/api/admin/routes'); } catch { _adminRoutes = []; }
  }
  try {
    const trips = await api('GET', '/api/admin/trips');
    renderAdminTripsList(Array.isArray(trips) ? trips : []);
  } catch(e) {
    el.innerHTML = '<div class="empty-state"><p style="color:var(--danger)">Failed to load trips</p></div>';
  }
}

function renderAdminTripsList(trips) {
  const el = document.getElementById('admin-trips-list');
  if (!trips.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">🚚</div><p>No trips yet</p></div>';
    return;
  }
  el.innerHTML = trips.map(t => {
    const route = `${escHtml(t.origin_city)}, ${escHtml(t.origin_state)} → ${escHtml(t.destination_city)}, ${escHtml(t.destination_state)}`;
    return `
    <div class="card" style="margin-bottom:0.75rem;">
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:0.5rem;">
          <div>
            <div style="font-size:0.8rem;color:var(--gray-500)">${escHtml(t.trip_number)} · ${escHtml(t.route_code)}</div>
            <div style="font-weight:600">${escHtml(t.cargo_description)}</div>
            <div style="font-size:0.85rem;color:var(--gray-600);margin-top:2px">${route}</div>
          </div>
          <div>${statusBadge(t.status)}</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:0.5rem;margin-top:0.75rem;font-size:0.82rem;">
          ${t.transporter_name ? `<div><span style="color:var(--gray-500)">Transporter: </span>${escHtml(t.transporter_name)}</div>` : '<div style="color:var(--gray-400)">Not assigned</div>'}
          ${t.reg_number       ? `<div><span style="color:var(--gray-500)">Vehicle: </span>${escHtml(t.reg_number)}</div>` : ''}
          ${t.cargo_weight_tons ? `<div><span style="color:var(--gray-500)">Weight: </span>${fmtNum(t.cargo_weight_tons)} tons</div>` : ''}
          ${t.assignment_deadline ? `<div><span style="color:var(--gray-500)">Assign by: </span>${fmtDate(t.assignment_deadline)}</div>` : ''}
        </div>
        <div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:0.75rem;flex-wrap:wrap;">
          <button class="btn btn-outline btn-sm" onclick="showAdminTripDetail('${t.id}')">View</button>
          ${t.status === 'posted' ? `<button class="btn btn-primary btn-sm" onclick="openAssignModal('${t.id}')">Assign</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

async function showAdminTripDetail(tripId) {
  let modal = document.getElementById('admin-trip-detail-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'admin-trip-detail-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = '<div class="modal-box" style="max-width:660px;"><div id="admin-trip-detail-body"></div></div>';
    document.body.appendChild(modal);
  }
  document.getElementById('admin-trip-detail-body').innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
  openModal('admin-trip-detail-modal');
  try {
    const t = await api('GET', `/api/admin/trips/${tripId}`);
    const route = `${escHtml(t.origin_city)}, ${escHtml(t.origin_state)} → ${escHtml(t.destination_city)}, ${escHtml(t.destination_state)}`;
    document.getElementById('admin-trip-detail-body').innerHTML = `
      <div class="modal-header">
        <h3>${escHtml(t.trip_number)}</h3>
        <button class="modal-close" onclick="closeModal('admin-trip-detail-modal')">×</button>
      </div>
      <div class="modal-body">
        <div style="display:flex;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap;">
          <span style="font-size:0.85rem;color:var(--gray-500)">${escHtml(t.route_code)}</span>
          ${statusBadge(t.status)}
        </div>
        <div class="detail-grid">
          <div><div style="font-size:0.75rem;color:var(--gray-500)">Route</div><div>${route}</div></div>
          ${t.distance_km       ? `<div><div style="font-size:0.75rem;color:var(--gray-500)">Distance</div><div>${fmtNum(t.distance_km)} km</div></div>` : ''}
          <div><div style="font-size:0.75rem;color:var(--gray-500)">Cargo</div><div>${escHtml(t.cargo_description)}</div></div>
          ${t.cargo_weight_tons  ? `<div><div style="font-size:0.75rem;color:var(--gray-500)">Weight</div><div>${fmtNum(t.cargo_weight_tons)} tons</div></div>` : ''}
          ${t.transporter_name   ? `<div><div style="font-size:0.75rem;color:var(--gray-500)">Transporter</div><div>${escHtml(t.transporter_name)}</div></div>` : ''}
          ${t.transporter_contact ? `<div><div style="font-size:0.75rem;color:var(--gray-500)">Contact</div><div>${escHtml(t.transporter_contact)}</div></div>` : ''}
          ${t.transporter_mobile  ? `<div><div style="font-size:0.75rem;color:var(--gray-500)">Mobile</div><div>${escHtml(t.transporter_mobile)}</div></div>` : ''}
          ${t.reg_number          ? `<div><div style="font-size:0.75rem;color:var(--gray-500)">Vehicle</div><div>${escHtml(t.reg_number)} (${escHtml(t.vehicle_type||'')})</div></div>` : ''}
          ${t.driver_name         ? `<div><div style="font-size:0.75rem;color:var(--gray-500)">Driver</div><div>${escHtml(t.driver_name)}</div></div>` : ''}
          ${t.assigned_at         ? `<div><div style="font-size:0.75rem;color:var(--gray-500)">Assigned</div><div>${fmtDate(t.assigned_at)}</div></div>` : ''}
          ${t.accepted_at         ? `<div><div style="font-size:0.75rem;color:var(--gray-500)">Accepted</div><div>${fmtDate(t.accepted_at)}</div></div>` : ''}
          ${t.delivered_at        ? `<div><div style="font-size:0.75rem;color:var(--gray-500)">Delivered</div><div>${fmtDate(t.delivered_at)}</div></div>` : ''}
          ${t.pod_file_path       ? `<div><div style="font-size:0.75rem;color:var(--gray-500)">POD Ref</div><div>${escHtml(t.pod_file_path)}</div></div>` : ''}
          ${t.pod_delivered_qty   ? `<div><div style="font-size:0.75rem;color:var(--gray-500)">Qty Delivered</div><div>${fmtNum(t.pod_delivered_qty)}</div></div>` : ''}
          ${t.pod_notes           ? `<div style="grid-column:1/-1"><div style="font-size:0.75rem;color:var(--gray-500)">POD Notes</div><div>${escHtml(t.pod_notes)}</div></div>` : ''}
        </div>
        <div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:1.5rem;flex-wrap:wrap;">
          <button class="btn btn-outline" onclick="closeModal('admin-trip-detail-modal')">Close</button>
          ${t.status === 'posted' ? `<button class="btn btn-primary" onclick="openAssignModal('${t.id}')">Assign Transporter</button>` : ''}
        </div>
      </div>`;
  } catch(e) {
    document.getElementById('admin-trip-detail-body').innerHTML =
      `<div class="card-body"><p style="color:var(--danger)">${escHtml(e.message)}</p>
       <button class="btn btn-outline" onclick="closeModal('admin-trip-detail-modal')">Close</button></div>`;
  }
}

async function openPostTripModal() {
  if (!_adminRoutes.length) {
    try { _adminRoutes = await api('GET', '/api/admin/routes'); } catch { _adminRoutes = []; }
  }
  const routeOptions = _adminRoutes.map(r =>
    `<option value="${r.id}">${escHtml(r.route_code)} — ${escHtml(r.origin_city)} → ${escHtml(r.destination_city)}</option>`
  ).join('');
  let modal = document.getElementById('modal-post-trip');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-post-trip';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `<div class="modal-box" style="max-width:520px;">
    <div class="modal-header">
      <h3>Post Trip</h3>
      <button class="modal-close" onclick="closeModal('modal-post-trip')">×</button>
    </div>
    <div class="modal-body">
      <div class="form-grid-2">
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label required">Route</label>
          <select class="form-control" id="trip-route">
            <option value="">Select route...</option>
            ${routeOptions}
          </select>
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label required">Cargo Description</label>
          <input class="form-control" type="text" id="trip-cargo" placeholder="e.g. Alum 50kg bags">
        </div>
        <div class="form-group">
          <label class="form-label">Cargo Weight (tons)</label>
          <input class="form-control" type="number" id="trip-weight" step="0.1" min="0" placeholder="0.0">
        </div>
        <div class="form-group">
          <label class="form-label">Assignment Deadline</label>
          <input class="form-control" type="date" id="trip-deadline">
        </div>
      </div>
      <div id="trip-errors"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal('modal-post-trip')">Cancel</button>
      <button class="btn btn-primary" onclick="submitPostTrip()">Post Trip</button>
    </div>
  </div>`;
  openModal('modal-post-trip');
}

async function submitPostTrip() {
  const route_id            = document.getElementById('trip-route')?.value;
  const cargo_description   = document.getElementById('trip-cargo')?.value.trim();
  const cargo_weight_tons   = parseFloat(document.getElementById('trip-weight')?.value) || null;
  const assignment_deadline = document.getElementById('trip-deadline')?.value || null;
  const errEl               = document.getElementById('trip-errors');

  if (!route_id)           { errEl.innerHTML = '<div class="alert alert-danger">Route is required</div>'; return; }
  if (!cargo_description)  { errEl.innerHTML = '<div class="alert alert-danger">Cargo description is required</div>'; return; }

  Loading.show();
  try {
    const res = await api('POST', '/api/admin/trips', { route_id, cargo_description, cargo_weight_tons, assignment_deadline });
    Toast.success(`Trip ${res.trip_number} posted`);
    closeModal('modal-post-trip');
    await initAdminTrips();
  } catch(e) {
    errEl.innerHTML = `<div class="alert alert-danger">${escHtml(e.message)}</div>`;
  } finally { Loading.hide(); }
}

let _assignTripId = null;
let _transporters = [];

async function openAssignModal(tripId) {
  _assignTripId = tripId;
  if (!_transporters.length) {
    try { _transporters = await api('GET', '/api/admin/transporters'); } catch { _transporters = []; }
  }
  const trOptions = _transporters.map(t =>
    `<option value="${t.id}">${escHtml(t.company_name)}</option>`
  ).join('');
  let modal = document.getElementById('modal-assign-trip');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-assign-trip';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `<div class="modal-box" style="max-width:480px;">
    <div class="modal-header">
      <h3>Assign Transporter</h3>
      <button class="modal-close" onclick="closeModal('modal-assign-trip')">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label required">Transporter</label>
        <select class="form-control" id="assign-transporter" onchange="loadVehiclesForAssign(this.value)">
          <option value="">Select transporter...</option>
          ${trOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label required">Vehicle</label>
        <select class="form-control" id="assign-vehicle" disabled>
          <option value="">Select transporter first...</option>
        </select>
      </div>
      <div id="assign-errors"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal('modal-assign-trip')">Cancel</button>
      <button class="btn btn-primary" onclick="submitAssignment()">Assign</button>
    </div>
  </div>`;
  openModal('modal-assign-trip');
}

async function loadVehiclesForAssign(transporterId) {
  const sel = document.getElementById('assign-vehicle');
  if (!transporterId) { sel.innerHTML = '<option value="">Select transporter first...</option>'; sel.disabled = true; return; }
  sel.innerHTML = '<option value="">Loading...</option>';
  sel.disabled = true;
  try {
    const vehicles = await api('GET', `/api/admin/transporters/${transporterId}/vehicles`);
    sel.innerHTML = '<option value="">Select vehicle...</option>' +
      (Array.isArray(vehicles) ? vehicles : []).map(v =>
        `<option value="${v.id}">${escHtml(v.reg_number)} (${escHtml(v.vehicle_type)})${v.capacity_tons ? ' ' + fmtNum(v.capacity_tons) + 't' : ''}</option>`
      ).join('');
    sel.disabled = false;
  } catch(e) {
    sel.innerHTML = '<option value="">Failed to load vehicles</option>';
  }
}

async function submitAssignment() {
  const transporter_id = document.getElementById('assign-transporter')?.value;
  const vehicle_id     = document.getElementById('assign-vehicle')?.value;
  const errEl          = document.getElementById('assign-errors');

  if (!transporter_id) { errEl.innerHTML = '<div class="alert alert-danger">Transporter is required</div>'; return; }
  if (!vehicle_id)     { errEl.innerHTML = '<div class="alert alert-danger">Vehicle is required</div>'; return; }

  Loading.show();
  try {
    await api('POST', `/api/admin/trips/${_assignTripId}/assign`, { transporter_id, vehicle_id });
    Toast.success('Trip assigned to transporter');
    closeModal('modal-assign-trip');
    closeModal('admin-trip-detail-modal');
    await initAdminTrips();
  } catch(e) {
    errEl.innerHTML = `<div class="alert alert-danger">${escHtml(e.message)}</div>`;
  } finally { Loading.hide(); }
}
