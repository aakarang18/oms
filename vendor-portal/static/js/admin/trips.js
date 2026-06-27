'use strict';

let _adminRoutes = [];
let _approvedTransporters = [];

// ── Admin Trips ────────────────────────────────────────────────────────────────

async function initAdminTrips() {
  const el = document.getElementById('admin-trips-list');
  if (!el) return;
  try {
    const trips = await api('GET', '/api/admin/trips');
    const list = Array.isArray(trips) ? trips : [];
    if (!list.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">🚚</div><p>No trips yet</p></div>';
      return;
    }
    el.innerHTML = list.map(t => `
      <div class="card" style="margin-bottom:0.75rem;">
        <div class="card-body">
          <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:0.5rem;">
            <div>
              <div style="font-size:0.8rem;color:var(--gray-500)">${escHtml(t.trip_number)}</div>
              <div style="font-weight:600;">${escHtml(t.origin_city)} → ${escHtml(t.destination_city)}</div>
              <div style="font-size:0.82rem;color:var(--gray-500)">${escHtml(t.route_code)}${t.transporter_name ? ` · ${escHtml(t.transporter_name)}` : ''}</div>
            </div>
            <div>${statusBadge(t.status)}</div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:0.5rem;margin-top:0.75rem;font-size:0.82rem;">
            ${t.cargo_description ? `<div><span style="color:var(--gray-500)">Cargo: </span>${escHtml(t.cargo_description)}</div>` : ''}
            ${t.vehicle_reg ? `<div><span style="color:var(--gray-500)">Vehicle: </span>${escHtml(t.vehicle_reg)}</div>` : ''}
          </div>
          <div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:0.75rem;flex-wrap:wrap;">
            ${t.status === 'posted' ? `<button class="btn btn-primary btn-sm" onclick="openAssignTripModal('${t.id}')">Assign Transporter</button>` : ''}
            ${t.status === 'pod_uploaded' ? `<button class="btn btn-primary btn-sm" onclick="approvePOD('${t.id}')">Approve POD</button>` : ''}
          </div>
        </div>
      </div>`).join('');
  } catch(e) {
    if (el) el.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">${escHtml(e.message)}</p></div>`;
  }
}

async function openPostTripModal() {
  if (!_adminRoutes.length) {
    try { _adminRoutes = await api('GET', '/api/admin/routes'); } catch { _adminRoutes = []; }
  }
  let modal = document.getElementById('modal-post-trip');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-post-trip';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }
  const routeOpts = _adminRoutes.length
    ? _adminRoutes.filter(r => r.is_active).map(r =>
        `<option value="${r.id}">${escHtml(r.route_code)} — ${escHtml(r.origin_city)} → ${escHtml(r.destination_city)}</option>`
      ).join('')
    : '<option value="">No active routes</option>';

  modal.innerHTML = `<div class="modal-box" style="max-width:520px;">
    <div class="modal-header">
      <h3>Post New Trip</h3>
      <button class="modal-close" onclick="closeModal('modal-post-trip')">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label required">Route</label>
        <select class="form-control" id="pt-route">${routeOpts}</select>
      </div>
      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label">Cargo Description</label>
          <input class="form-control" id="pt-cargo" placeholder="e.g. Alum powder">
        </div>
        <div class="form-group">
          <label class="form-label">Weight (Tons)</label>
          <input class="form-control" type="number" id="pt-weight" step="0.1" min="0">
        </div>
        <div class="form-group">
          <label class="form-label">Assignment Deadline</label>
          <input class="form-control" type="date" id="pt-deadline">
        </div>
      </div>
      <div id="pt-errors"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal('modal-post-trip')">Cancel</button>
      <button class="btn btn-primary" onclick="submitPostTrip()">Post Trip</button>
    </div>
  </div>`;
  openModal('modal-post-trip');
}

async function submitPostTrip() {
  const route_id = document.getElementById('pt-route').value;
  if (!route_id) {
    document.getElementById('pt-errors').innerHTML = '<div class="alert alert-danger">Route is required</div>';
    return;
  }
  Loading.show();
  try {
    const res = await api('POST', '/api/admin/trips', {
      route_id,
      cargo_description: document.getElementById('pt-cargo').value.trim() || null,
      cargo_weight_tons: document.getElementById('pt-weight').value || null,
      assignment_deadline: document.getElementById('pt-deadline').value || null,
    });
    Toast.success(`Trip ${res.trip_number} posted`);
    closeModal('modal-post-trip');
    await initAdminTrips();
  } catch(e) {
    document.getElementById('pt-errors').innerHTML = `<div class="alert alert-danger">${escHtml(e.message)}</div>`;
  } finally {
    Loading.hide();
  }
}

async function openAssignTripModal(tripId) {
  if (!_approvedTransporters.length) {
    try {
      const res = await api('GET', '/api/admin/transporters?status=approved');
      _approvedTransporters = Array.isArray(res) ? res : [];
    } catch { _approvedTransporters = []; }
  }
  let modal = document.getElementById('modal-assign-trip');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-assign-trip';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }
  const opts = _approvedTransporters.length
    ? _approvedTransporters.map(t => `<option value="${t.id}">${escHtml(t.company_name)}</option>`).join('')
    : '<option value="">No approved transporters</option>';

  modal.innerHTML = `<div class="modal-box" style="max-width:420px;">
    <div class="modal-header">
      <h3>Assign Transporter</h3>
      <button class="modal-close" onclick="closeModal('modal-assign-trip')">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label required">Transporter</label>
        <select class="form-control" id="at-transporter">${opts}</select>
      </div>
      <div id="at-errors"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal('modal-assign-trip')">Cancel</button>
      <button class="btn btn-primary" onclick="submitAssignTrip('${tripId}')">Assign</button>
    </div>
  </div>`;
  openModal('modal-assign-trip');
}

async function submitAssignTrip(tripId) {
  const transporter_id = document.getElementById('at-transporter').value;
  if (!transporter_id) return;
  Loading.show();
  try {
    await api('POST', `/api/admin/trips/${tripId}/assign`, { transporter_id });
    Toast.success('Trip assigned');
    closeModal('modal-assign-trip');
    await initAdminTrips();
  } catch(e) {
    document.getElementById('at-errors').innerHTML = `<div class="alert alert-danger">${escHtml(e.message)}</div>`;
  } finally {
    Loading.hide();
  }
}

async function approvePOD(tripId) {
  if (!confirm('Approve this POD and mark the trip as completed?')) return;
  Loading.show();
  try {
    await api('POST', `/api/admin/trips/${tripId}/approve-pod`, {});
    Toast.success('POD approved, trip completed');
    await initAdminTrips();
  } catch(e) {
    Toast.error(e.message);
  } finally {
    Loading.hide();
  }
}

// ── Admin Routes ───────────────────────────────────────────────────────────────

async function initAdminRoutes() {
  const el = document.getElementById('routes-list');
  if (!el) return;
  try {
    const routes = await api('GET', '/api/admin/routes');
    _adminRoutes = Array.isArray(routes) ? routes : [];
    if (!_adminRoutes.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">🗺️</div><p>No routes defined</p></div>';
      return;
    }
    el.innerHTML = `<table class="data-table"><thead><tr>
      <th>Code</th><th>Origin</th><th>Destination</th><th>Distance</th><th>Type</th><th>Status</th><th>Action</th>
    </tr></thead><tbody>
      ${_adminRoutes.map(r => `<tr>
        <td><strong>${escHtml(r.route_code)}</strong></td>
        <td>${escHtml(r.origin_city)}, ${escHtml(r.origin_state)}</td>
        <td>${escHtml(r.destination_city)}, ${escHtml(r.destination_state)}</td>
        <td>${r.distance_km ? fmtNum(r.distance_km) + ' km' : '—'}</td>
        <td>${escHtml(r.route_type)}</td>
        <td>${r.is_active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-secondary">Inactive</span>'}</td>
        <td><button class="btn btn-outline btn-sm" onclick="toggleRoute('${r.id}',${r.is_active})">${r.is_active ? 'Deactivate' : 'Activate'}</button></td>
      </tr>`).join('')}
    </tbody></table>`;
  } catch(e) {
    if (el) el.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">${escHtml(e.message)}</p></div>`;
  }
}

async function toggleRoute(routeId, isActive) {
  if (!confirm(`${isActive ? 'Deactivate' : 'Activate'} this route?`)) return;
  Loading.show();
  try {
    await api('PATCH', `/api/admin/routes/${routeId}/toggle`, {});
    await initAdminRoutes();
  } catch(e) {
    Toast.error(e.message);
  } finally {
    Loading.hide();
  }
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
      <h3>Add Route</h3>
      <button class="modal-close" onclick="closeModal('modal-create-route')">×</button>
    </div>
    <div class="modal-body">
      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label required">Origin City</label>
          <input class="form-control" id="cr-origin-city">
        </div>
        <div class="form-group">
          <label class="form-label required">Origin State</label>
          <input class="form-control" id="cr-origin-state">
        </div>
        <div class="form-group">
          <label class="form-label required">Destination City</label>
          <input class="form-control" id="cr-dest-city">
        </div>
        <div class="form-group">
          <label class="form-label required">Destination State</label>
          <input class="form-control" id="cr-dest-state">
        </div>
        <div class="form-group">
          <label class="form-label">Distance (km)</label>
          <input class="form-control" type="number" id="cr-distance" step="0.1" min="0">
        </div>
        <div class="form-group">
          <label class="form-label">Route Type</label>
          <select class="form-control" id="cr-type">
            <option>Road</option><option>Rail</option><option>Waterway</option>
          </select>
        </div>
      </div>
      <div id="cr-errors"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal('modal-create-route')">Cancel</button>
      <button class="btn btn-primary" onclick="submitCreateRoute()">Create Route</button>
    </div>
  </div>`;
  openModal('modal-create-route');
}

async function submitCreateRoute() {
  const origin_city = document.getElementById('cr-origin-city').value.trim();
  const origin_state = document.getElementById('cr-origin-state').value.trim();
  const destination_city = document.getElementById('cr-dest-city').value.trim();
  const destination_state = document.getElementById('cr-dest-state').value.trim();

  if (!origin_city || !origin_state || !destination_city || !destination_state) {
    document.getElementById('cr-errors').innerHTML =
      '<div class="alert alert-danger">All city and state fields are required</div>';
    return;
  }
  Loading.show();
  try {
    const res = await api('POST', '/api/admin/routes', {
      origin_city, origin_state, destination_city, destination_state,
      distance_km: document.getElementById('cr-distance').value || null,
      route_type: document.getElementById('cr-type').value,
    });
    Toast.success(`Route ${res.route_code} created`);
    closeModal('modal-create-route');
    await initAdminRoutes();
  } catch(e) {
    document.getElementById('cr-errors').innerHTML = `<div class="alert alert-danger">${escHtml(e.message)}</div>`;
  } finally {
    Loading.hide();
  }
}

// ── Admin Rate Card Approvals ──────────────────────────────────────────────────

async function initAdminRateApprovals() {
  const el = document.getElementById('rate-approval-list');
  if (!el) return;
  try {
    const rcs = await api('GET', '/api/admin/rate-cards?status=pending');
    const list = Array.isArray(rcs) ? rcs : [];
    if (!list.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">💰</div><p>No pending rate cards</p></div>';
      return;
    }
    el.innerHTML = list.map(rc => `
      <div class="card" style="margin-bottom:0.75rem;">
        <div class="card-body">
          <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:0.5rem;">
            <div>
              <div style="font-weight:600;">${escHtml(rc.transporter_name)}</div>
              <div style="font-size:0.82rem;color:var(--gray-500)">${escHtml(rc.route_code)} — ${escHtml(rc.origin_city)} → ${escHtml(rc.destination_city)}</div>
            </div>
            ${statusBadge(rc.status)}
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:0.5rem;margin-top:0.75rem;font-size:0.82rem;">
            <div><span style="color:var(--gray-500)">Type: </span>${escHtml(rc.vehicle_type)}</div>
            ${rc.rate_per_km != null ? `<div><span style="color:var(--gray-500)">Per km: </span>${fmtMoney(rc.rate_per_km)}</div>` : ''}
            ${rc.rate_per_ton != null ? `<div><span style="color:var(--gray-500)">Per ton: </span>${fmtMoney(rc.rate_per_ton)}</div>` : ''}
            ${rc.minimum_charge != null ? `<div><span style="color:var(--gray-500)">Min: </span>${fmtMoney(rc.minimum_charge)}</div>` : ''}
            <div><span style="color:var(--gray-500)">Valid: </span>${fmtDate(rc.valid_from)} – ${fmtDate(rc.valid_until)}</div>
          </div>
          <div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:0.75rem;">
            <button class="btn btn-outline btn-sm" onclick="rejectRateCard('${rc.id}')">Reject</button>
            <button class="btn btn-primary btn-sm" onclick="approveRateCard('${rc.id}')">Approve</button>
          </div>
        </div>
      </div>`).join('');
  } catch(e) {
    if (el) el.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">${escHtml(e.message)}</p></div>`;
  }
}

async function approveRateCard(rcId) {
  Loading.show();
  try {
    await api('POST', `/api/admin/rate-cards/${rcId}/approve`, {});
    Toast.success('Rate card approved');
    await initAdminRateApprovals();
  } catch(e) {
    Toast.error(e.message);
  } finally {
    Loading.hide();
  }
}

async function rejectRateCard(rcId) {
  const reason = prompt('Reason for rejection:');
  if (!reason || !reason.trim()) return;
  Loading.show();
  try {
    await api('POST', `/api/admin/rate-cards/${rcId}/reject`, { rejection_reason: reason.trim() });
    Toast.success('Rate card rejected');
    await initAdminRateApprovals();
  } catch(e) {
    Toast.error(e.message);
  } finally {
    Loading.hide();
  }
}
