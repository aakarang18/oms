/* Transporter Portal — Dashboard & initialisation */

let _transporterUser = null;

async function initTransporterPortal() {
  try {
    _transporterUser = await api('GET', '/api/auth/me');
  } catch {
    window.location.href = '/';
    return;
  }

  const initials = (_transporterUser.name || _transporterUser.email || _transporterUser.mobile || 'T')[0].toUpperCase();
  document.getElementById('sidebar-avatar').textContent = initials;
  document.getElementById('sidebar-name').textContent   = _transporterUser.name || _transporterUser.email || _transporterUser.mobile;
  document.getElementById('sidebar-role').textContent   =
    (_transporterUser.role || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  document.getElementById('dash-date').textContent =
    new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  // Check registration status — show wizard for non-approved transporters
  try {
    const profile = await api('GET', '/api/transporter/profile');
    if (profile.status !== 'approved') {
      document.getElementById('main-portal-wrap').style.display = 'none';
      document.getElementById('reg-wizard-wrap').style.display = '';
      await initTransporterRegistration();
      return;
    }
  } catch {
    document.getElementById('main-portal-wrap').style.display = 'none';
    document.getElementById('reg-wizard-wrap').style.display = '';
    await initTransporterRegistration();
    return;
  }

  await loadTransporterDashboard();
}

async function loadTransporterDashboard() {
  try {
    const data = await api('GET', '/api/transporter/dashboard');

    document.getElementById('stat-pending-trips').textContent  = data.pending_assignments ?? '0';
    document.getElementById('stat-active-trips').textContent   = data.active_trips        ?? '0';
    document.getElementById('stat-pod-pending').textContent    = data.pod_pending         ?? '0';
    document.getElementById('stat-inv-pending').textContent    = data.invoice_pending     ?? '0';
    document.getElementById('stat-payments-month').textContent = data.payments_month
      ? fmtMoney(data.payments_month) : '₹0';
    document.getElementById('stat-compliance').textContent     = data.compliance_alerts   ?? '0';

    if (data.registration_status && data.registration_status !== 'approved') {
      document.getElementById('reg-pending-banner').style.display = 'flex';
    }

    renderTransporterActivity(data.recent_activity || []);
  } catch(e) {
    console.error('Transporter dashboard error', e);
  }
}

function renderTransporterActivity(items) {
  const el = document.getElementById('activity-feed');
  if (!items.length) return;
  el.innerHTML = items.map(item => `
    <div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--gray-100)">
      <div style="font-size:1.2rem;flex-shrink:0">${item.icon || '📌'}</div>
      <div style="flex:1">
        <div style="font-size:.875rem;color:var(--gray-800)">${escHtml(item.message)}</div>
        <div style="font-size:.75rem;color:var(--gray-400);margin-top:2px">${relTime(item.time)}</div>
      </div>
    </div>
  `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  initTransporterPortal();
});
