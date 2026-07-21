'use strict';

async function loadTransporterTrips() {
  await Promise.all([
    loadTripTab('assigned', 'trips-assigned-list'),
    loadTripTab('active',   'trips-active-list'),
    loadTripTab('pod',      'trips-pod-list'),
    loadTripTab('all',      'trips-all-list'),
  ]);

  document.querySelectorAll('#section-trips .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabMap = {
        'trips-assigned': 'assigned',
        'trips-active': 'active',
        'trips-pod': 'pod',
        'trips-all': 'all',
      };
      const key = tabMap[btn.dataset.tab];
      if (key) loadTripTab(key, `${btn.dataset.tab}-list`);
    });
  });
}

async function loadTripTab(tabKey, elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  try {
    let url = '/api/transporter/trips';
    if (tabKey === 'assigned') url += '?status=assigned';
    else if (tabKey === 'active') url += '?status=accepted&status=loaded&status=in_transit';
    else if (tabKey === 'pod') url += '?status=delivered&status=pod_uploaded';

    let trips = await api('GET', url);
    if (!Array.isArray(trips)) trips = [];

    if (tabKey === 'active') {
      trips = trips.filter(t => ['accepted','loaded','in_transit'].includes(t.status));
    } else if (tabKey === 'pod') {
      trips = trips.filter(t => ['delivered','pod_uploaded'].includes(t.status));
    }

    if (!trips.length) {
      const icons = { assigned:'🚛', active:'🚛', pod:'📋', all:'🚛' };
      const msgs  = { assigned:'No pending assignments', active:'No active trips',
                      pod:'No trips pending POD upload or approval', all:'No trips yet' };
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">${icons[tabKey]||'🚛'}</div><p>${msgs[tabKey]||'No trips'}</p></div>`;
      return;
    }
    el.innerHTML = trips.map(t => renderTripCard(t)).join('');
  } catch(e) {
    el.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">${escHtml(e.message)}</p></div>`;
  }
}

function renderTripCard(t) {
  const statusActions = {
    assigned: `
      <button class="btn btn-primary btn-sm" onclick="acceptTrip('${t.id}')">Accept</button>
      <button class="btn btn-outline btn-sm" onclick="declineTrip('${t.id}')">Decline</button>`,
    accepted: `<button class="btn btn-primary btn-sm" onclick="updateTripStatus('${t.id}','loaded')">Mark Loaded</button>`,
    loaded: `<button class="btn btn-primary btn-sm" onclick="updateTripStatus('${t.id}','in_transit')">Mark In Transit</button>`,
    in_transit: `<button class="btn btn-primary btn-sm" onclick="updateTripStatus('${t.id}','delivered')">Mark Delivered</button>`,
    delivered: `<button class="btn btn-primary btn-sm" onclick="openPODModal('${t.id}')">Upload POD</button>`,
    pod_uploaded: `<span style="font-size:0.82rem;color:var(--success);font-weight:600">✓ POD submitted — awaiting admin approval</span>`,
  };

  return `
    <div class="card" style="margin-bottom:0.75rem;">
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:0.5rem;">
          <div>
            <div style="font-size:0.8rem;color:var(--gray-500)">${escHtml(t.trip_number)}</div>
            <div style="font-weight:600;">${escHtml(t.origin_city)} → ${escHtml(t.destination_city)}</div>
            <div style="font-size:0.82rem;color:var(--gray-500);margin-top:0.15rem;">${escHtml(t.route_code)}${t.distance_km ? ` · ${fmtNum(t.distance_km)} km` : ''}</div>
          </div>
          <div>${statusBadge(t.status)}</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:0.5rem;margin-top:0.75rem;font-size:0.82rem;">
          ${t.cargo_description ? `<div><span style="color:var(--gray-500)">Cargo: </span>${escHtml(t.cargo_description)}</div>` : ''}
          ${t.cargo_weight_tons ? `<div><span style="color:var(--gray-500)">Weight: </span>${fmtNum(t.cargo_weight_tons)} T</div>` : ''}
          ${t.assignment_deadline ? `<div><span style="color:var(--gray-500)">Accept By: </span>${fmtDate(t.assignment_deadline)}</div>` : ''}
        </div>
        ${statusActions[t.status] ? `
          <div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:0.75rem;">
            ${statusActions[t.status]}
          </div>` : ''}
      </div>
    </div>`;
}

async function acceptTrip(tripId) {
  Loading.show();
  try {
    await api('POST', `/api/transporter/trips/${tripId}/accept`, {});
    Toast.success('Trip accepted');
    await loadTransporterTrips();
  } catch(e) {
    Toast.error(e.message);
  } finally {
    Loading.hide();
  }
}

async function declineTrip(tripId) {
  const reason = prompt('Reason for declining (optional):') ?? '';
  Loading.show();
  try {
    await api('POST', `/api/transporter/trips/${tripId}/decline`, { reason });
    Toast.success('Trip declined');
    await loadTransporterTrips();
  } catch(e) {
    Toast.error(e.message);
  } finally {
    Loading.hide();
  }
}

async function updateTripStatus(tripId, newStatus) {
  const labels = { loaded: 'Mark as Loaded?', in_transit: 'Mark as In Transit?', delivered: 'Mark as Delivered?' };
  if (!confirm(labels[newStatus] || `Update to ${newStatus}?`)) return;
  Loading.show();
  try {
    await api('POST', `/api/transporter/trips/${tripId}/update-status`, { status: newStatus });
    Toast.success('Status updated');
    await loadTransporterTrips();
  } catch(e) {
    Toast.error(e.message);
  } finally {
    Loading.hide();
  }
}

function openPODModal(tripId) {
  let modal = document.getElementById('pod-upload-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'pod-upload-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `<div class="modal-box" style="max-width:480px;">
    <div class="modal-header">
      <h3>Upload Proof of Delivery</h3>
      <button class="modal-close" onclick="closeModal('pod-upload-modal')">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label required">POD Document (PDF/JPG/PNG)</label>
        <input class="form-control" type="file" id="pod-file" accept=".pdf,.jpg,.jpeg,.png">
      </div>
      <div class="form-group">
        <label class="form-label">Quantity Delivered (Tons)</label>
        <input class="form-control" type="number" id="pod-qty" step="0.01" min="0">
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-control" id="pod-notes" rows="2" placeholder="Any delivery notes..."></textarea>
      </div>
      <div id="pod-errors"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal('pod-upload-modal')">Cancel</button>
      <button class="btn btn-primary" onclick="submitPOD('${tripId}')">Upload POD</button>
    </div>
  </div>`;
  openModal('pod-upload-modal');
}

async function submitPOD(tripId) {
  const file = document.getElementById('pod-file').files[0];
  if (!file) {
    document.getElementById('pod-errors').innerHTML =
      '<div class="alert alert-danger">POD file is required</div>';
    return;
  }
  const fd = new FormData();
  fd.append('file', file);
  const qty = document.getElementById('pod-qty').value;
  const notes = document.getElementById('pod-notes').value.trim();
  if (qty) fd.append('pod_delivered_qty', qty);
  if (notes) fd.append('pod_notes', notes);

  Loading.show();
  try {
    const tok = document.cookie.split(';').map(c => c.trim())
      .find(c => c.startsWith('portal_session='))?.split('=')[1];
    const resp = await fetch(`/api/transporter/trips/${tripId}/pod`, {
      method: 'POST',
      headers: tok ? { 'X-Session-Token': tok } : {},
      body: fd,
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json.error || 'Upload failed');
    Toast.success('POD uploaded successfully');
    closeModal('pod-upload-modal');
    await loadTransporterTrips();
  } catch(e) {
    document.getElementById('pod-errors').innerHTML =
      `<div class="alert alert-danger">${escHtml(e.message)}</div>`;
  } finally {
    Loading.hide();
  }
}
