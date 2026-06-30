'use strict';

let _routes = [];

async function loadRateCards() {
  const el = document.getElementById('rate-cards-list');
  if (!el) return;
  try {
    const [rcs, routes] = await Promise.all([
      api('GET', '/api/transporter/rate-cards'),
      api('GET', '/api/transporter/routes'),
    ]);
    _routes = Array.isArray(routes) ? routes : [];
    const list = Array.isArray(rcs) ? rcs : [];
    if (!list.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">💰</div><p>No rate cards submitted</p></div>';
      return;
    }
    el.innerHTML = `<table class="data-table"><thead><tr>
      <th>Route</th><th>Vehicle Type</th><th>Rate/km</th><th>Rate/Ton</th><th>Min Charge</th><th>Valid</th><th>Status</th>
    </tr></thead><tbody>
      ${list.map(rc => `<tr>
        <td>${escHtml(rc.route_code)} · ${escHtml(rc.origin_city)} → ${escHtml(rc.destination_city)}</td>
        <td>${escHtml(rc.vehicle_type)}</td>
        <td>${rc.rate_per_km != null ? fmtMoney(rc.rate_per_km) : '—'}</td>
        <td>${rc.rate_per_ton != null ? fmtMoney(rc.rate_per_ton) : '—'}</td>
        <td>${rc.minimum_charge != null ? fmtMoney(rc.minimum_charge) : '—'}</td>
        <td style="font-size:0.8rem">${fmtDate(rc.valid_from)} – ${fmtDate(rc.valid_until)}</td>
        <td>${statusBadge(rc.status)}</td>
      </tr>`).join('')}
    </tbody></table>`;
  } catch(e) {
    el.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">${escHtml(e.message)}</p></div>`;
  }
}

function openAddRateModal() {
  let modal = document.getElementById('modal-add-rate');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-add-rate';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }
  const routeOptions = _routes.length
    ? _routes.map(r => `<option value="${r.id}">${escHtml(r.route_code)} — ${escHtml(r.origin_city)} → ${escHtml(r.destination_city)}</option>`).join('')
    : '<option value="">No routes available</option>';

  modal.innerHTML = `<div class="modal-box" style="max-width:520px;">
    <div class="modal-header">
      <h3>Submit Rate Card</h3>
      <button class="modal-close" onclick="closeModal('modal-add-rate')">×</button>
    </div>
    <div class="modal-body">
      <div class="form-grid-2">
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label required">Route</label>
          <select class="form-control" id="rc-route">${routeOptions}</select>
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label required">Vehicle Type</label>
          <select class="form-control" id="rc-vtype">
            <option>Open</option><option>Closed</option><option>Tanker</option>
            <option>Trailer</option><option>LCV</option><option>HCV</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Rate per km (₹)</label>
          <input class="form-control" type="number" id="rc-per-km" step="0.01" min="0">
        </div>
        <div class="form-group">
          <label class="form-label">Rate per Ton (₹)</label>
          <input class="form-control" type="number" id="rc-per-ton" step="0.01" min="0">
        </div>
        <div class="form-group">
          <label class="form-label">Minimum Charge (₹)</label>
          <input class="form-control" type="number" id="rc-min" step="0.01" min="0">
        </div>
        <div class="form-group">
          <label class="form-label required">Valid From</label>
          <input class="form-control" type="date" id="rc-from" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group">
          <label class="form-label required">Valid Until</label>
          <input class="form-control" type="date" id="rc-until">
        </div>
      </div>
      <div id="rc-errors"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal('modal-add-rate')">Cancel</button>
      <button class="btn btn-primary" onclick="submitRateCard()">Submit for Approval</button>
    </div>
  </div>`;
  openModal('modal-add-rate');
}

async function submitRateCard() {
  const route_id = document.getElementById('rc-route').value;
  const valid_from = document.getElementById('rc-from').value;
  const valid_until = document.getElementById('rc-until').value;

  if (!route_id || !valid_from || !valid_until) {
    document.getElementById('rc-errors').innerHTML =
      '<div class="alert alert-danger">Route, valid from, and valid until are required</div>';
    return;
  }
  Loading.show();
  try {
    await api('POST', '/api/transporter/rate-cards', {
      route_id,
      vehicle_type: document.getElementById('rc-vtype').value,
      rate_per_km: document.getElementById('rc-per-km').value || null,
      rate_per_ton: document.getElementById('rc-per-ton').value || null,
      minimum_charge: document.getElementById('rc-min').value || null,
      valid_from,
      valid_until,
    });
    Toast.success('Rate card submitted for approval');
    closeModal('modal-add-rate');
    await loadRateCards();
  } catch(e) {
    document.getElementById('rc-errors').innerHTML = `<div class="alert alert-danger">${escHtml(e.message)}</div>`;
  } finally {
    Loading.hide();
  }
}
