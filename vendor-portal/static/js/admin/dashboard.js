/* Admin Portal — Dashboard & initialisation */

let _adminUser = null;

async function initAdminPortal() {
  try {
    _adminUser = await api('GET', '/api/auth/me');
  } catch {
    window.location.href = '/';
    return;
  }

  const initials = (_adminUser.name || _adminUser.email || _adminUser.mobile || 'A')[0].toUpperCase();
  document.getElementById('sidebar-avatar').textContent = initials;
  document.getElementById('sidebar-name').textContent   = _adminUser.name || _adminUser.email || _adminUser.mobile;
  document.getElementById('sidebar-role').textContent   =
    (_adminUser.role || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  document.getElementById('dash-date').textContent =
    new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  await loadAdminDashboard();
}

async function loadAdminDashboard() {
  try {
    const data = await api('GET', '/api/admin/dashboard');

    document.getElementById('stat-pending-reg').textContent        = data.pending_registrations ?? '0';
    document.getElementById('stat-open-rfqs').textContent          = data.open_rfqs             ?? '0';
    document.getElementById('stat-quotes-eval').textContent        = data.quotes_awaiting_eval  ?? '0';
    document.getElementById('stat-pos-grn').textContent            = data.pos_awaiting_grn      ?? '0';
    document.getElementById('stat-invoices-review').textContent    = data.invoices_under_review ?? '0';
    document.getElementById('stat-compliance-alerts').textContent  = data.compliance_alerts     ?? '0';

    renderAdminActivity(data.recent_activity || []);
  } catch(e) {
    console.error('Admin dashboard error', e);
  }
}

function renderAdminActivity(items) {
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

function setActiveNav(sectionId) {
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.section === sectionId);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initAdminPortal();

  document.querySelectorAll('.nav-item[data-section]').forEach(btn => {
    btn.addEventListener('click', () => {
      const sec = btn.dataset.section;
      if (sec === 'section-dashboard') {
        loadAdminDashboard();
      } else if (sec === 'section-vendor-reg') {
        _regCurrentTab = 'vendors';
        initAdminRegistrations();
      } else if (sec === 'section-transporter-reg') {
        showSection('section-vendor-reg');
        setActiveNav('section-vendor-reg');
        _regCurrentTab = 'transporters';
        initAdminRegistrations();
      } else if (sec === 'section-rfqs') {
        initAdminRFQs();
      } else if (sec === 'section-pos') {
        initAdminPOs();
      } else if (sec === 'section-compliance') {
        initComplianceView();
      } else if (sec === 'section-audit') {
        initAuditLog();
      } else if (sec === 'section-users') {
        initUserManagement();
      } else if (sec === 'section-routes') {
        initAdminRoutes();
      } else if (sec === 'section-rate-approval') {
        initAdminRateApprovals();
      } else if (sec === 'section-trips') {
        initAdminTrips();
      } else if (sec === 'section-invoices') {
        initAdminInvoices();
      } else if (sec === 'section-payments') {
        initAdminPayments();
      }
    });
  });
});
