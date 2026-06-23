'use strict';

let _availableRoutes = [];

async function loadRateCards() {
  const el = document.getElementById('rate-cards-list');
  if (!el) return;
  try {
    const cards = await api('GET', '/api/transporter/rate-cards');
    renderRateCardsList(Array.isArray(cards) ? cards : []);
  } catch(e) {
    el.innerHTML = '<div class="empty-state"><p style="color:var(--danger)">Failed to load</p></div>';
  }
}

function renderRateCardsList(cards) {
  const el = document.getElementById('rate-cards-list');
  if (!cards.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">💰</div><p>No rate cards submitted yet. Click “+ Add Rate Card” to submit one.</p></div>';
    return;
  }
  el.innerHTML = cards.map(c => `
    <div class="card" style="margin-bottom:0.75rem;">
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:0.5rem;">
          <div>
            <div style="font-size:0.8rem;color:var(--gray-500)">${escHtml(c.route_code)}</div>
            <div style="font-weight:600">${escHtml(c.origin_city)}, ${escHtml(c.origin_state)} → ${escHtml(c.destination_city)}, ${escHtml(c.destination_state)}</div>
            <div style="font-size:0.85rem;color:var(--gray-600)">${escHtml(c.vehicle_type)}</div>
          </div>
          <div>
            ${statusBadge(c.status)}
            ${c.rejection_reason ? `<div style="font-size:0.75rem;color:var(--danger);margin-top:4px">⚠ ${escHtml(c.rejection_reason)}</div>` : ''}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:0.5rem;margin-top:0.75rem;font-size:0.82rem;">
          ${c.rate_per_km    ? `<div><span style="color:var(--gray-500)">Rate/km: </span>₹${fmtNum(c.rate_per_km)}</div>`    : ''}
          ${c.rate_per_ton   ? `<div><span style="color:var(--gray-500)">Rate/ton: </span>₹${fmtNum(c.rate_per_ton)}</div>`   : ''}
          ${c.minimum_charge ? `<div><span style="color:var(--gray-500)">Min: </span>₹${fmtNum(c.minimum_charge)}</div>`      : ''}
          <div><span style="color:var(--gray-500)">Valid: </span>${fmtDate(c.valid_from)} – ${fmtDate(c.valid_until)}</div>
        </div>
      </div>
    </div>`).join('');
}

async function openAddRateCardModal() {
  if (!_availableRoutes.length) {
    try { _availableRoutes = await api('GET', '/api/transporter/routes'); } catch { _availableRoutes = []; }
  }
  const routeOptions = _availableRoutes.map(r =>
    `<option value="${r.id}">${escHtml(r.route_code)} — ${escHtml(r.origin_city)} → ${escHtml(r.destination_city)}</option>`
  ).join('');

  let modal = document.getElementById('modal-add-rate');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-add-rate';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }
  const today = new Date().toISOString().split('T')[0];
  modal.innerHTML = `<div class="modal-box" style="max-width:520px;">
    <div class="modal-header">
      <h3>Submit Rate Card</h3>
      <button class="modal-close" onclick="closeModal('modal-add-rate')">×</button>
    </div>
    <div class="modal-body">
      <div class="form-grid-2">
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label required">Route</label>
          <select class="form-control" id="rc-route">
            <option value="">Select route...</option>
            ${routeOptions}
          </select>
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label required">Vehicle Type</label>
          <select class="form-control" id="rc-vehicle-type">
            <option value="">Select type...</option>
            <option>Truck-LCV</option><option>Truck-MCV</option><option>Truck-HCV</option>
            <option>Truck-XLCV</option><option>Trailer</option><option>Tanker</option>
            <option>Container-20ft</option><option>Container-40ft</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Rate per KM (₹)</label>
          <input class="form-control" type="number" id="rc-per-km" step="0.01" min="0" placeholder="0.00">
        </div>
        <div class="form-group">
          <label class="form-label">Rate per Ton (₹)</label>
          <input class="form-control" type="number" id="rc-per-ton" step="0.01" min="0" placeholder="0.00">
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Minimum Charge (₹)</label>
          <input class="form-control" type="number" id="rc-min-charge" step="0.01" min="0" placeholder="0.00">
        </div>
        <div class="form-group">
          <label class="form-label required">Valid From</label>
          <input class="form-control" type="date" id="rc-from" value="${today}">
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
      <button class="btn btn-primary" onclick="submitRateCard()">Submit Rate Card</button>
    </div>
  </div>`;
  openModal('modal-add-rate');
}

async function submitRateCard() {
  const route_id       = document.getElementById('rc-route')?.value;
  const vehicle_type   = document.getElementById('rc-vehicle-type')?.value;
  const rate_per_km    = parseFloat(document.getElementById('rc-per-km')?.value) || null;
  const rate_per_ton   = parseFloat(document.getElementById('rc-per-ton')?.value) || null;
  const minimum_charge = parseFloat(document.getElementById('rc-min-charge')?.value) || null;
  const valid_from     = document.getElementById('rc-from')?.value;
  const valid_until    = document.getElementById('rc-until')?.value;
  const errEl          = document.getElementById('rc-errors');

  if (!route_id)     { errEl.innerHTML = '<div class="alert alert-danger">Route is required</div>'; return; }
  if (!vehicle_type) { errEl.innerHTML = '<div class="alert alert-danger">Vehicle type is required</div>'; return; }
  if (!valid_from || !valid_until) { errEl.innerHTML = '<div class="alert alert-danger">Validity dates are required</div>'; return; }
  if (!rate_per_km && !rate_per_ton) { errEl.innerHTML = '<div class="alert alert-danger">At least one rate (per km or per ton) is required</div>'; return; }

  Loading.show();
  try {
    await api('POST', '/api/transporter/rate-cards', { route_id, vehicle_type, rate_per_km, rate_per_ton, minimum_charge, valid_from, valid_until });
    Toast.success('Rate card submitted for approval');
    closeModal('modal-add-rate');
    await loadRateCards();
  } catch(e) {
    errEl.innerHTML = `<div class="alert alert-danger">${escHtml(e.message)}</div>`;
  } finally { Loading.hide(); }
}
