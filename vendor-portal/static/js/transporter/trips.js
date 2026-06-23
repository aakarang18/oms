'use strict';

async function loadTransporterTrips() {
  await Promise.all([
    loadTripTab('assigned', 'trips-assigned-list'),
    loadTripTab('accepted,loaded,in_transit', 'trips-active-list'),
    loadTripTab('delivered', 'trips-pod-list'),
    loadAllTrips(),
  ]);
  document.querySelectorAll('#section-trips .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabMap = {
        'trips-assigned': 'assigned',
        'trips-active':   'accepted,loaded,in_transit',
        'trips-pod':      'delivered',
      };
      const status = tabMap[btn.dataset.tab];
      if (status) {
        loadTripTab(status, btn.dataset.tab + '-list');
      } else if (btn.dataset.tab === 'trips-all') {
        loadAllTrips();
      }
    });
  });
}

async function loadTripTab(status, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  try {
    const trips = await api('GET', `/api/transporter/trips?status=${encodeURIComponent(status)}`);
    renderTripCards(el, Array.isArray(trips) ? trips : []);
  } catch(e) {
    el.innerHTML = '<div class="empty-state"><p style="color:var(--danger)">Failed to load</p></div>';
  }
}

async function loadAllTrips() {
  const el = document.getElementById('trips-all-list');
  if (!el) return;
  try {
    const trips = await api('GET', '/api/transporter/trips');
    renderTripCards(el, Array.isArray(trips) ? trips : []);
  } catch(e) {
    el.innerHTML = '<div class="empty-state"><p style="color:var(--danger)">Failed to load</p></div>';
  }
}

function renderTripCards(el, trips) {
  if (!trips.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">🚛</div><p>No trips found</p></div>';
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
          ${t.cargo_weight_tons ? `<div><span style="color:var(--gray-500)">Weight: </span>${fmtNum(t.cargo_weight_tons)} tons</div>` : ''}
          ${t.distance_km       ? `<div><span style="color:var(--gray-500)">Distance: </span>${fmtNum(t.distance_km)} km</div>` : ''}
          ${t.reg_number        ? `<div><span style="color:var(--gray-500)">Vehicle: </span>${escHtml(t.reg_number)}</div>` : ''}
          ${t.assignment_deadline ? `<div><span style="color:var(--gray-500)">Deadline: </span>${fmtDate(t.assignment_deadline)}</div>` : ''}
        </div>
        <div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:0.75rem;flex-wrap:wrap;">
          <button class="btn btn-outline btn-sm" onclick="showTripDetail('${t.id}')">View Details</button>
          ${buildTripActions(t)}
        </div>
      </div>
    </div>`;
  }).join('');
}

function buildTripActions(t) {
  switch (t.status) {
    case 'assigned':  return `<button class="btn btn-primary btn-sm" onclick="acceptTrip('${t.id}')">Accept</button>
                               <button class="btn btn-outline btn-sm" style="color:var(--danger);border-color:var(--danger)" onclick="openDeclineModal('${t.id}')">Decline</button>`;
    case 'accepted':  return `<button class="btn btn-primary btn-sm" onclick="markTripLoaded('${t.id}')">Mark Loaded</button>`;
    case 'loaded':    return `<button class="btn btn-primary btn-sm" onclick="markTripInTransit('${t.id}')">Mark In Transit</button>`;
    case 'in_transit': return `<button class="btn btn-primary btn-sm" onclick="openDeliveredModal('${t.id}')">Mark Delivered + POD</button>`;
    default: return '';
  }
}

async function showTripDetail(tripId) {
  let modal = document.getElementById('trip-detail-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'trip-detail-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = '<div class="modal-box" style="max-width:640px;"><div id="trip-detail-body"></div></div>';
    document.body.appendChild(modal);
  }
  document.getElementById('trip-detail-body').innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
  openModal('trip-detail-modal');
  try {
    const t = await api('GET', `/api/transporter/trips/${tripId}`);
    const route = `${escHtml(t.origin_city)}, ${escHtml(t.origin_state)} → ${escHtml(t.destination_city)}, ${escHtml(t.destination_state)}`;
    document.getElementById('trip-detail-body').innerHTML = `
      <div class="modal-header">
        <h3>${escHtml(t.trip_number)}</h3>
        <button class="modal-close" onclick="closeModal('trip-detail-modal')">×</button>
      </div>
      <div class="modal-body">
        <div style="display:flex;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap;">
          <span style="font-size:0.85rem;color:var(--gray-500)">${escHtml(t.route_code)}</span>
          ${statusBadge(t.status)}
        </div>
        <div class="detail-grid">
          <div><div style="font-size:0.75rem;color:var(--gray-500)">Route</div><div>${route}</div></div>
          ${t.distance_km      ? `<div><div style="font-size:0.75rem;color:var(--gray-500)">Distance</div><div>${fmtNum(t.distance_km)} km</div></div>` : ''}
          <div><div style="font-size:0.75rem;color:var(--gray-500)">Cargo</div><div>${escHtml(t.cargo_description)}</div></div>
          ${t.cargo_weight_tons ? `<div><div style="font-size:0.75rem;color:var(--gray-500)">Weight</div><div>${fmtNum(t.cargo_weight_tons)} tons</div></div>` : ''}
          ${t.reg_number       ? `<div><div style="font-size:0.75rem;color:var(--gray-500)">Vehicle</div><div>${escHtml(t.reg_number)} (${escHtml(t.vehicle_type||'')})</div></div>` : ''}
          ${t.driver_name      ? `<div><div style="font-size:0.75rem;color:var(--gray-500)">Driver</div><div>${escHtml(t.driver_name)}</div></div>` : ''}
          ${t.assigned_at      ? `<div><div style="font-size:0.75rem;color:var(--gray-500)">Assigned</div><div>${fmtDate(t.assigned_at)}</div></div>` : ''}
          ${t.accepted_at      ? `<div><div style="font-size:0.75rem;color:var(--gray-500)">Accepted</div><div>${fmtDate(t.accepted_at)}</div></div>` : ''}
          ${t.loaded_at        ? `<div><div style="font-size:0.75rem;color:var(--gray-500)">Loaded</div><div>${fmtDate(t.loaded_at)}</div></div>` : ''}
          ${t.in_transit_at    ? `<div><div style="font-size:0.75rem;color:var(--gray-500)">In Transit</div><div>${fmtDate(t.in_transit_at)}</div></div>` : ''}
          ${t.delivered_at     ? `<div><div style="font-size:0.75rem;color:var(--gray-500)">Delivered</div><div>${fmtDate(t.delivered_at)}</div></div>` : ''}
          ${t.pod_file_path    ? `<div><div style="font-size:0.75rem;color:var(--gray-500)">POD Ref</div><div>${escHtml(t.pod_file_path)}</div></div>` : ''}
          ${t.pod_delivered_qty ? `<div><div style="font-size:0.75rem;color:var(--gray-500)">Qty Delivered</div><div>${fmtNum(t.pod_delivered_qty)}</div></div>` : ''}
          ${t.pod_notes        ? `<div style="grid-column:1/-1"><div style="font-size:0.75rem;color:var(--gray-500)">POD Notes</div><div>${escHtml(t.pod_notes)}</div></div>` : ''}
        </div>
        <div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:1.5rem;flex-wrap:wrap;">
          <button class="btn btn-outline" onclick="closeModal('trip-detail-modal')">Close</button>
          ${buildTripActions(t)}
        </div>
      </div>`;
  } catch(e) {
    document.getElementById('trip-detail-body').innerHTML =
      `<div class="card-body"><p style="color:var(--danger)">${escHtml(e.message)}</p>
       <button class="btn btn-outline" onclick="closeModal('trip-detail-modal')">Close</button></div>`;
  }
}

async function acceptTrip(tripId) {
  if (!confirm('Accept this trip assignment?')) return;
  Loading.show();
  try {
    await api('POST', `/api/transporter/trips/${tripId}/accept`);
    Toast.success('Trip accepted');
    closeModal('trip-detail-modal');
    await loadTransporterTrips();
  } catch(e) { Toast.error(e.message); } finally { Loading.hide(); }
}

function openDeclineModal(tripId) {
  let modal = document.getElementById('decline-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'decline-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `<div class="modal-box" style="max-width:420px;">
    <div class="modal-header">
      <h3>Decline Trip</h3>
      <button class="modal-close" onclick="closeModal('decline-modal')">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Reason for declining (optional)</label>
        <textarea class="form-control" id="decline-reason" rows="3" placeholder="e.g. Vehicle unavailable..."></textarea>
      </div>
      <div id="decline-errors"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal('decline-modal')">Cancel</button>
      <button class="btn btn-danger" onclick="submitDecline('${tripId}')">Decline Trip</button>
    </div>
  </div>`;
  openModal('decline-modal');
}

async function submitDecline(tripId) {
  const reason = document.getElementById('decline-reason')?.value.trim();
  Loading.show();
  try {
    await api('POST', `/api/transporter/trips/${tripId}/decline`, { reason });
    Toast.success('Trip declined');
    closeModal('decline-modal');
    closeModal('trip-detail-modal');
    await loadTransporterTrips();
  } catch(e) {
    document.getElementById('decline-errors').innerHTML = `<div class="alert alert-danger">${escHtml(e.message)}</div>`;
  } finally { Loading.hide(); }
}

async function markTripLoaded(tripId) {
  if (!confirm('Confirm cargo has been loaded onto vehicle?')) return;
  Loading.show();
  try {
    await api('POST', `/api/transporter/trips/${tripId}/loaded`);
    Toast.success('Trip marked as loaded');
    closeModal('trip-detail-modal');
    await loadTransporterTrips();
  } catch(e) { Toast.error(e.message); } finally { Loading.hide(); }
}

async function markTripInTransit(tripId) {
  if (!confirm('Mark trip as in transit?')) return;
  Loading.show();
  try {
    await api('POST', `/api/transporter/trips/${tripId}/in-transit`);
    Toast.success('Trip is now in transit');
    closeModal('trip-detail-modal');
    await loadTransporterTrips();
  } catch(e) { Toast.error(e.message); } finally { Loading.hide(); }
}

function openDeliveredModal(tripId) {
  let modal = document.getElementById('pod-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'pod-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `<div class="modal-box" style="max-width:480px;">
    <div class="modal-header">
      <h3>Mark Delivered — POD Details</h3>
      <button class="modal-close" onclick="closeModal('pod-modal')">×</button>
    </div>
    <div class="modal-body">
      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label required">Qty Delivered</label>
          <input class="form-control" type="number" id="pod-qty" step="0.01" min="0" placeholder="e.g. 10.5">
        </div>
        <div class="form-group">
          <label class="form-label">Delivery Receipt / LR Ref</label>
          <input class="form-control" type="text" id="pod-ref" placeholder="Receipt number">
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Notes</label>
          <textarea class="form-control" id="pod-notes" rows="2" placeholder="Any delivery remarks..."></textarea>
        </div>
      </div>
      <div id="pod-errors"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal('pod-modal')">Cancel</button>
      <button class="btn btn-primary" onclick="submitDelivered('${tripId}')">Confirm Delivery</button>
    </div>
  </div>`;
  openModal('pod-modal');
}

async function submitDelivered(tripId) {
  const qty   = parseFloat(document.getElementById('pod-qty').value);
  const ref   = document.getElementById('pod-ref')?.value.trim();
  const notes = document.getElementById('pod-notes')?.value.trim();
  if (!qty || qty < 0) {
    document.getElementById('pod-errors').innerHTML = '<div class="alert alert-danger">Quantity delivered is required</div>';
    return;
  }
  Loading.show();
  try {
    await api('POST', `/api/transporter/trips/${tripId}/delivered`, { pod_delivered_qty: qty, pod_ref: ref, pod_notes: notes });
    Toast.success('Delivery confirmed with POD');
    closeModal('pod-modal');
    closeModal('trip-detail-modal');
    await loadTransporterTrips();
  } catch(e) {
    document.getElementById('pod-errors').innerHTML = `<div class="alert alert-danger">${escHtml(e.message)}</div>`;
  } finally { Loading.hide(); }
}
