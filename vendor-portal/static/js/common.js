/* ================================================================
   Amar Alum Portal — Shared JS Utilities
   ================================================================ */

// ── Toast Notifications ──────────────────────────────────────────
const Toast = (() => {
  const container = document.getElementById('toast-container');
  function show(message, type = 'info', duration = 4000) {
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
    el.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${message}</span>`;
    container.appendChild(el);
    el.addEventListener('click', () => el.remove());
    if (duration > 0) setTimeout(() => el.remove(), duration);
    return el;
  }
  return {
    success: (m, d) => show(m, 'success', d),
    error:   (m, d) => show(m, 'error',   d),
    info:    (m, d) => show(m, 'info',    d),
    warning: (m, d) => show(m, 'warning', d),
  };
})();

// ── API Helper ───────────────────────────────────────────────────
async function api(method, url, body = null, opts = {}) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    credentials: 'same-origin',
  };
  if (body && method !== 'GET') options.body = JSON.stringify(body);
  const resp = await fetch(url, options);
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: resp.status, data });
  return data;
}

// ── Loading Overlay ──────────────────────────────────────────────
const Loading = (() => {
  let el = null;
  function show() {
    if (el) return;
    el = document.createElement('div');
    el.className = 'loading-overlay';
    el.innerHTML = '<div class="spinner" style="width:40px;height:40px;border-width:4px"></div>';
    document.body.appendChild(el);
  }
  function hide() { el?.remove(); el = null; }
  return { show, hide };
})();

// ── Modal Helper ─────────────────────────────────────────────────
function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('open'); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  const el = typeof id === 'string' ? document.getElementById(id) : id;
  if (el) { el.classList.remove('open'); document.body.style.overflow = ''; }
}
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) closeModal(e.target);
  if (e.target.classList.contains('modal-close')) closeModal(e.target.closest('.modal-overlay'));
});

// ── Sidebar Navigation ───────────────────────────────────────────
function initSidebar() {
  // Mobile toggle
  document.querySelector('.menu-toggle')?.addEventListener('click', () => {
    document.querySelector('.sidebar')?.classList.toggle('open');
  });
  // Nav items → sections
  document.querySelectorAll('.nav-item[data-section]').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      showSection(section);
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelector('.header-title').textContent = btn.dataset.label || '';
      document.querySelector('.sidebar')?.classList.remove('open');
    });
  });
}

function showSection(id) {
  document.querySelectorAll('.portal-section').forEach(s => {
    s.style.display = s.id === id ? 'block' : 'none';
  });
}

// ── Tabs ─────────────────────────────────────────────────────────
function initTabs(container) {
  (container || document).querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = btn.dataset.tab;
      const parent = btn.closest('[data-tabs]') || btn.closest('.card') || document;
      parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      parent.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      parent.querySelector(`.tab-panel[data-tab="${panel}"]`)?.classList.add('active');
    });
  });
}

// ── Notifications ─────────────────────────────────────────────────
let _notifOpen = false;
async function loadNotifications() {
  try {
    const data = await api('GET', '/api/notifications');
    const badge = document.getElementById('notif-badge');
    if (badge) {
      badge.textContent = data.unread_count || '';
      badge.style.display = data.unread_count ? 'flex' : 'none';
    }
    renderNotifList(data.notifications || []);
  } catch { /* silent */ }
}

function renderNotifList(items) {
  const list = document.getElementById('notif-list');
  if (!list) return;
  if (!items.length) {
    list.innerHTML = '<div class="empty-state" style="padding:24px"><p>No notifications</p></div>';
    return;
  }
  list.innerHTML = items.map(n => `
    <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="markRead('${n.id}',this)">
      <div class="notif-title">${escHtml(n.title)}</div>
      <div class="notif-body">${escHtml(n.body)}</div>
      <div class="notif-time">${relTime(n.created_at)}</div>
    </div>
  `).join('');
}

async function markRead(id, el) {
  try { await api('POST', `/api/notifications/${id}/read`); } catch {}
  el?.classList.remove('unread');
  loadNotifications();
}

async function markAllRead() {
  try { await api('POST', '/api/notifications/read-all'); } catch {}
  loadNotifications();
}

function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  if (!panel) return;
  _notifOpen = !_notifOpen;
  panel.classList.toggle('open', _notifOpen);
  if (_notifOpen) loadNotifications();
}

// ── Logout ───────────────────────────────────────────────────────
async function logout() {
  try { await api('POST', '/api/auth/logout'); } catch {}
  window.location.href = '/';
}

// ── Utilities ────────────────────────────────────────────────────
function escHtml(s) {
  const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML;
}

function relTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso + 'Z').getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'Just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day:'numeric', month:'short' });
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
}

function fmtMoney(n) {
  if (n == null) return '—';
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

function fmtNum(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-IN');
}

function statusBadge(status) {
  const map = {
    draft:          'badge-draft',
    submitted:      'badge-pending',
    under_review:   'badge-pending',
    pending:        'badge-pending',
    approved:       'badge-approved',
    rejected:       'badge-rejected',
    info_requested: 'badge-warning',
    active:         'badge-active',
    published:      'badge-active',
    awarded:        'badge-success',
    generated:      'badge-info',
    acknowledged:   'badge-info',
    paid:           'badge-success',
    cancelled:      'badge-draft',
    expired:        'badge-danger',
    expiring_7:     'badge-danger',
    expiring_15:    'badge-warning',
    expiring_30:    'badge-warning',
    posted:         'badge-info',
    assigned:       'badge-pending',
    accepted:       'badge-info',
    in_transit:     'badge-active',
    delivered:      'badge-success',
    pod_uploaded:   'badge-success',
  };
  const cls = map[status] || 'badge-draft';
  const label = (status || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return `<span class="badge ${cls}">${label}</span>`;
}

// ── Form validation helpers ───────────────────────────────────────
function validateGSTIN(v) {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v?.toUpperCase());
}
function validatePAN(v) {
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v?.toUpperCase());
}
function validateMobile(v) {
  return /^[6-9][0-9]{9}$/.test(v?.replace(/\D/g, ''));
}
function validateIFSC(v) {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v?.toUpperCase());
}

function showFieldError(fieldEl, msg) {
  fieldEl.classList.add('error');
  let err = fieldEl.parentElement.querySelector('.field-error');
  if (!err) { err = document.createElement('div'); err.className = 'field-error'; fieldEl.parentElement.appendChild(err); }
  err.textContent = msg;
}
function clearFieldError(fieldEl) {
  fieldEl.classList.remove('error');
  fieldEl.parentElement.querySelector('.field-error')?.remove();
}

// File drag-and-drop
document.querySelectorAll('.file-upload-zone').forEach(zone => {
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('dragover'); });
});

// ── Init on DOMContentLoaded ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initTabs();
  // Poll notifications every 60s if logged in
  if (document.getElementById('notif-badge')) {
    loadNotifications();
    setInterval(loadNotifications, 60000);
  }
});
