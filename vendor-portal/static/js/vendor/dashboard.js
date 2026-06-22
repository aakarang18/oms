/* Vendor Portal — Dashboard & initialisation */

let _vendorUser = null;

async function initVendorPortal() {
  try {
    _vendorUser = await api('GET', '/api/auth/me');
  } catch {
    window.location.href = '/';
    return;
  }

  // Populate sidebar
  const initials = (_vendorUser.name || _vendorUser.email || _vendorUser.mobile || 'V')[0].toUpperCase();
  document.getElementById('sidebar-avatar').textContent = initials;
  document.getElementById('sidebar-name').textContent   = _vendorUser.name || _vendorUser.email || _vendorUser.mobile;
  document.getElementById('sidebar-role').textContent   =
    (_vendorUser.role || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  document.getElementById('dash-date').textContent =
    new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  // Check registration status — show wizard for non-approved vendors
  try {
    const profile = await api('GET', '/api/vendor/profile');
    if (profile.status !== 'approved') {
      document.getElementById('main-portal-wrap').style.display = 'none';
      document.getElementById('reg-wizard-wrap').style.display = '';
      await initRegistrationWizard();
      return;
    }
  } catch {
    // If no vendor profile yet, show wizard
    document.getElementById('main-portal-wrap').style.display = 'none';
    document.getElementById('reg-wizard-wrap').style.display = '';
    await initRegistrationWizard();
    return;
  }

  await loadVendorDashboard();
}

async function loadVendorDashboard() {
  try {
    const data = await api('GET', '/api/vendor/dashboard');

    document.getElementById('stat-open-rfqs').textContent      = data.open_rfqs       ?? '0';
    document.getElementById('stat-active-quotes').textContent  = data.active_quotes   ?? '0';
    document.getElementById('stat-pending-ack').textContent    = data.pending_ack     ?? '0';
    document.getElementById('stat-pending-inv').textContent    = data.pending_invoices?? '0';
    document.getElementById('stat-payments-month').textContent = data.payments_month
      ? fmtMoney(data.payments_month) : '₹0';
    document.getElementById('stat-docs-expiring').textContent  = data.docs_expiring   ?? '0';

    if (data.registration_status && data.registration_status !== 'approved') {
      const banner = document.getElementById('reg-pending-banner');
      banner.style.display = 'flex';
      document.getElementById('reg-status-label').textContent =
        data.registration_status.replace(/_/g, ' ');
    }

    renderActivityFeed(data.recent_activity || []);
  } catch(e) {
    console.error('Dashboard load error', e);
  }
}

function renderActivityFeed(items) {
  const el = document.getElementById('activity-feed');
  if (!items.length) return;
  el.innerHTML = items.map(item => `
    <div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--gray-100)">
      <div style="font-size:1.2rem;flex-shrink:0">${activityIcon(item.type)}</div>
      <div style="flex:1">
        <div style="font-size:.875rem;color:var(--gray-800)">${escHtml(item.message)}</div>
        <div style="font-size:.75rem;color:var(--gray-400);margin-top:2px">${relTime(item.time)}</div>
      </div>
    </div>
  `).join('');
}

function activityIcon(type) {
  const icons = {
    rfq: '📋', quote: '💬', po: '📦', invoice: '🧾',
    payment: '💳', document: '📄', registration: '🏡',
  };
  return icons[type] || '📌';
}

function setActiveNav(sectionId) {
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.section === sectionId);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initVendorPortal();

  // Wire nav items to also refresh data when switching sections
  document.querySelectorAll('.nav-item[data-section]').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      if (section === 'section-dashboard') loadVendorDashboard();
    });
  });
});
