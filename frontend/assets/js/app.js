/* ============================================================
   SmartWaste — Portal Warga
   Application controller
   ============================================================ */
(function () {
  'use strict';

  const D = window.WasteData;
  const { TYPES, TYPE_BY_ID, STATUS_META, EVIDENCE_LABEL, API, Session } = D;

  const DRAFT_PREFIX = 'smartwaste.draft.';
  const NOTIF_SEEN_PREFIX = 'smartwaste.notifSeen.';
  const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const MONTHS_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const POLL_MS = 15000;
  const ROUTES = {
    '#/ringkasan': 'dashboard',
    '#/buat': 'new',
    '#/riwayat': 'reports',
    '#/profil': 'profile',
    '#/masuk': 'auth',
    '#/daftar': 'auth'
  };

  const state = {
    user: null,
    reports: [],
    route: 'dashboard',
    detailId: null,
    selectedReportId: null,
    filters: { status: 'semua', q: '', from: '', to: '' },
    pendingPhoto: null,
    photoError: '',
    coords: null,
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    connecting: false,
    loadingReports: false,
    lastSync: null,
    lastError: '',
    statusSnapshot: null,
    pollTimer: null,
    draftTimer: null,
    notificationsSeenAt: 0,
    notifOpen: false,
    modalOpen: false,
    modalPrevFocus: null,
    cameraStream: null,
    cameraRequestId: 0,
    pendingViewRefresh: false
  };

  /* -------------------------------------------------------------- helpers */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));
  const pad = (n) => String(n).padStart(2, '0');

  function esc(value) {
    return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }

  function typeMeta(id) { return TYPE_BY_ID[id] || TYPE_BY_ID.lainnya; }
  function statusMeta(status) {
    return STATUS_META[status] || { label: status || 'Tidak diketahui', stageLabel: status || '—', badge: 'outline', stage: -1 };
  }
  function statusBadge(status, extra) {
    const meta = statusMeta(status);
    return '<span class="badge badge--' + meta.badge + (extra ? ' ' + extra : '') + '">' + esc(meta.label) + '</span>';
  }
  function typeTile(typeId, cls) {
    return '<span class="report-type-icon' + (cls ? ' ' + cls : '') + '">' + icon(typeMeta(typeId).icon) + '</span>';
  }
  function initials(name) {
    const parts = String(name || 'W').trim().split(/\s+/).filter(Boolean);
    return (parts.slice(0, 2).map((p) => p[0]).join('') || 'W').toUpperCase();
  }
  function firstName(name) { return String(name || '').trim().split(/\s+/)[0] || 'Warga'; }

  function paintAvatar(el, user) {
    if (!el) return;
    el.innerHTML = '';
    el.style.backgroundImage = '';
    if (user && user.avatar) {
      const img = document.createElement('img');
      img.src = user.avatar;
      img.alt = '';
      el.appendChild(img);
    } else {
      el.textContent = initials(user ? user.name : '');
    }
  }
  function avatarHTML(user, cls) {
    const klass = 'avatar' + (cls ? ' ' + cls : '');
    if (user && user.avatar) {
      return '<span class="' + klass + '"><img src="' + esc(user.avatar) + '" alt=""></span>';
    }
    return '<span class="' + klass + '">' + esc(initials(user ? user.name : '')) + '</span>';
  }

  /* -------------------------------------------------------------- dates */
  function parseISODate(iso) {
    if (!iso) return null;
    const parts = String(iso).slice(0, 10).split('-').map(Number);
    if (!parts[0] || !parts[1] || !parts[2]) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  function fmtDate(iso, opts) {
    const d = parseISODate(iso);
    if (!d) return '—';
    const year = !opts || opts.year !== false;
    return d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()] + (year ? ' ' + d.getFullYear() : '');
  }
  function fmtDateLong(iso) {
    const d = parseISODate(iso);
    if (!d) return '—';
    return d.getDate() + ' ' + MONTHS_LONG[d.getMonth()] + ' ' + d.getFullYear();
  }
  function fmtTimestamp(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()] + ' ' + d.getFullYear() + ' · ' + pad(d.getHours()) + '.' + pad(d.getMinutes());
  }
  function fmtClock(d) {
    if (!d) return '';
    return pad(d.getHours()) + '.' + pad(d.getMinutes());
  }
  function timeAgo(iso) {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const diff = Math.max(0, Date.now() - then);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'baru saja';
    if (mins < 60) return mins + ' menit lalu';
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + ' jam lalu';
    const days = Math.floor(hours / 24);
    if (days < 30) return days + ' hari lalu';
    return fmtDate(iso);
  }
  function todayLong() {
    const d = new Date();
    const str = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  function greetingName() {
    const h = new Date().getHours();
    if (h < 11) return 'Selamat pagi';
    if (h < 15) return 'Selamat siang';
    if (h < 19) return 'Selamat sore';
    return 'Selamat malam';
  }

  /* -------------------------------------------------------------- numbers */
  const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
  function fmtNumber(n) { return nf.format(Number(n) || 0); }
  function fmtKg(n) { return fmtNumber(n) + ' kg'; }
  function pct(part, total) { return total ? Math.round((part / total) * 100) : 0; }

  /* -------------------------------------------------------------- toast */
  function toast(type, title, message, opts) {
    const root = $('#toastRoot');
    if (!root) return;
    const options = opts || {};
    const iconName = type === 'error' ? 'alert-triangle' : type === 'info' ? 'info' : 'check-circle';
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'error' ? ' is-error' : type === 'info' ? ' is-info' : '');
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML = '<span class="toast-ic">' + icon(iconName) + '</span>' +
      '<div class="toast-body"><strong></strong><p></p></div>' +
      '<button type="button" class="toast-close" aria-label="Tutup notifikasi">' + icon('x') + '</button>';
    $('strong', el).textContent = title;
    const p = $('p', el);
    if (message) p.textContent = message; else p.remove();
    root.appendChild(el);
    const remove = () => {
      if (!el.isConnected || el.classList.contains('is-leaving')) return;
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 230);
    };
    $('.toast-close', el).addEventListener('click', remove);
    setTimeout(remove, options.duration || (type === 'error' ? 8000 : 6000));
    while (root.children.length > 4) root.firstElementChild.remove();
  }

  /* -------------------------------------------------------------- modal */
  function openModal(html) {
    closeNotif();
    state.modalPrevFocus = document.activeElement;
    const root = $('#modalRoot');
    root.innerHTML = '<div class="modal-backdrop">' + html + '</div>';
    document.body.style.overflow = 'hidden';
    state.modalOpen = true;
    hydrateIcons(root);
    hydrateArt(root);
    const focusTarget = $('[data-autofocus]', root) || $('.modal input:not([type="hidden"]), .modal select, .modal textarea', root) || $('.modal-close', root);
    requestAnimationFrame(() => { if (focusTarget && typeof focusTarget.focus === 'function') focusTarget.focus(); });
  }
  function closeModal() {
    if (!state.modalOpen) return;
    state.cameraRequestId += 1;
    if (state.cameraStream) {
      state.cameraStream.getTracks().forEach((track) => track.stop());
      state.cameraStream = null;
    }
    $('#modalRoot').innerHTML = '';
    document.body.style.overflow = '';
    state.modalOpen = false;
    if (state.modalPrevFocus && typeof state.modalPrevFocus.focus === 'function') {
      try { state.modalPrevFocus.focus(); } catch (e) { /* ignore */ }
    }
    state.modalPrevFocus = null;
    if (state.pendingViewRefresh && state.user) {
      state.pendingViewRefresh = false;
      renderRoute();
    }
  }
  function isModalOpen() { return state.modalOpen; }

  function trapFocus(event) {
    const modal = $('.modal', $('#modalRoot'));
    if (!modal) return;
    const focusables = $$('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', modal)
      .filter((el) => el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* -------------------------------------------------------------- chrome */
  function paintChrome() {
    const user = state.user;
    if (!user) return;
    const today = $('#todayLabel');
    if (today) today.textContent = todayLong();
    const topName = $('#topName');
    if (topName) topName.textContent = firstName(user.name);
    const chipName = $('#topChipName');
    if (chipName) chipName.textContent = user.name;
    const sideName = $('#sidebarName');
    if (sideName) sideName.textContent = user.name;
    paintAvatar($('#topAvatar'), user);
    paintAvatar($('#sidebarAvatar'), user);
    updatePendingBadge();
    updateConnectivity();
    renderNotificationsDot();
  }

  function updatePendingBadge() {
    const badge = $('#navPendingBadge');
    if (!badge) return;
    const count = state.reports.filter((r) => r.status === 'menunggu_verifikasi').length;
    badge.textContent = String(count);
    badge.hidden = count === 0;
  }

  function updateConnectivity() {
    const banner = $('#connBanner');
    const bannerText = $('#connBannerText');
    if (banner) banner.hidden = state.online && !state.lastError;
    if (bannerText) bannerText.textContent = state.lastError || 'Koneksi ke server terputus. Data yang tampil mungkin belum terbaru.';
  }

  function updateNav() {
    $$('.nav-item[data-nav]').forEach((item) => {
      const key = item.dataset.nav;
      const active = key === state.route || (key === 'reports' && state.route === 'detail');
      item.classList.toggle('is-active', active);
      if (active) item.setAttribute('aria-current', 'page'); else item.removeAttribute('aria-current');
    });
  }

  function setDocTitle() {
    const titles = { dashboard: 'Ringkasan', new: 'Buat laporan', reports: 'Riwayat laporan', detail: 'Detail laporan', profile: 'Profil' };
    document.title = (titles[state.route] || 'Portal Warga') + ' — SmartWaste';
  }

  /* -------------------------------------------------------------- sidebar */
  function openSidebar() {
    $('#sidebar').classList.add('is-open');
    $('#scrim').hidden = false;
    $('#menuBtn').setAttribute('aria-expanded', 'true');
  }
  function closeSidebar() {
    const sidebar = $('#sidebar');
    if (!sidebar) return;
    sidebar.classList.remove('is-open');
    $('#scrim').hidden = true;
    $('#menuBtn').setAttribute('aria-expanded', 'false');
  }
  function toggleSidebar() {
    if ($('#sidebar').classList.contains('is-open')) closeSidebar(); else openSidebar();
  }

  /* -------------------------------------------------------------- notifications */
  function notifSeenKey() { return NOTIF_SEEN_PREFIX + (state.user ? state.user.id : 'anon'); }

  function allTimelineEvents() {
    const events = [];
    state.reports.forEach((report) => {
      (report.history || []).forEach((entry) => {
        events.push({ report, entry, at: entry.at });
      });
    });
    return events.sort((a, b) => new Date(b.at) - new Date(a.at));
  }
  function latestEventTime() {
    const events = allTimelineEvents();
    return events.length ? new Date(events[0].at).getTime() : 0;
  }
  function renderNotificationsDot() {
    const dot = $('#notifDot');
    if (!dot) return;
    const latest = latestEventTime();
    dot.hidden = !(latest > state.notificationsSeenAt);
  }
  function markNotificationsSeen() {
    state.notificationsSeenAt = Date.now();
    try { localStorage.setItem(notifSeenKey(), String(state.notificationsSeenAt)); } catch (e) { /* ignore */ }
    const dot = $('#notifDot');
    if (dot) dot.hidden = true;
  }
  function renderNotificationList() {
    const list = $('#notifList');
    if (!list) return;
    const events = allTimelineEvents().slice(0, 7);
    if (!events.length) {
      list.innerHTML = '<div class="notif-empty">Belum ada aktivitas laporan.<br>Perubahan status akan tampil di sini.</div>';
      return;
    }
    list.innerHTML = events.map(({ report, entry }) => {
      const meta = statusMeta(entry.status);
      return '<a class="notif-item" href="#/laporan/' + encodeURIComponent(report.id) + '" data-action="close-notif">' +
        '<span class="notif-ic">' + icon(entry.status === 'ditolak' ? 'x-circle' : entry.status === 'selesai' ? 'check-circle' : 'clock') + '</span>' +
        '<span class="notif-text"><strong>' + esc(typeMeta(report.type).label) + ' · ' + esc(report.code) + '</strong>' +
        '<p>' + esc(meta.label) + ' — ' + esc(entry.note) + '</p>' +
        '<span class="notif-time">' + esc(timeAgo(entry.at)) + '</span></span></a>';
    }).join('');
    hydrateIcons(list);
  }
  function openNotif() {
    renderNotificationList();
    const pop = $('#notifPop');
    pop.hidden = false;
    state.notifOpen = true;
    $('#bellBtn').setAttribute('aria-expanded', 'true');
    markNotificationsSeen();
    hydrateIcons(pop);
  }
  function closeNotif() {
    const pop = $('#notifPop');
    if (!pop || pop.hidden) return;
    pop.hidden = true;
    state.notifOpen = false;
    const bell = $('#bellBtn');
    if (bell) bell.setAttribute('aria-expanded', 'false');
  }
  function toggleNotif() {
    if (state.notifOpen) closeNotif(); else openNotif();
  }

  /* -------------------------------------------------------------- buttons/loading */
  function setButtonLoading(btn, loading, label) {
    if (!btn) return;
    if (loading) {
      if (btn.dataset.savedHtml === undefined) btn.dataset.savedHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" aria-hidden="true"></span><span>' + esc(label || 'Memproses…') + '</span>';
    } else {
      btn.disabled = false;
      if (btn.dataset.savedHtml !== undefined) {
        btn.innerHTML = btn.dataset.savedHtml;
        delete btn.dataset.savedHtml;
      }
      hydrateIcons(btn);
    }
  }

  /* -------------------------------------------------------------- authentication */
  function initAuth() {
    $$('[data-auth-tab]').forEach((btn) => {
      btn.addEventListener('click', () => switchAuthTab(btn.dataset.authTab));
    });
    const loginForm = $('#loginForm');
    const registerForm = $('#registerForm');
    if (loginForm) loginForm.addEventListener('submit', onLoginSubmit);
    if (registerForm) registerForm.addEventListener('submit', onRegisterSubmit);
  }

  function switchAuthTab(mode, opts) {
    const isLogin = mode !== 'register';
    const loginTab = $('#loginTab');
    const registerTab = $('#registerTab');
    const loginForm = $('#loginForm');
    const registerForm = $('#registerForm');
    if (!loginForm || !registerForm) return;
    loginForm.classList.toggle('hidden', !isLogin);
    registerForm.classList.toggle('hidden', isLogin);
    loginTab.classList.toggle('is-active', isLogin);
    registerTab.classList.toggle('is-active', !isLogin);
    loginTab.setAttribute('aria-selected', String(isLogin));
    registerTab.setAttribute('aria-selected', String(!isLogin));
    const authHash = isLogin ? '#/masuk' : '#/daftar';
    if (location.hash !== authHash) history.replaceState(null, '', authHash);
    $('#authTitle').textContent = isLogin ? 'Selamat datang kembali' : 'Buat akun warga';
    document.title = (isLogin ? 'Masuk' : 'Daftar') + ' — SmartWaste';
    $('#authSubtitle').textContent = isLogin
      ? 'Masuk untuk melanjutkan pemantauan laporanmu.'
      : 'Satu akun untuk semua laporan sampah di sekitarmu.';
    clearAuthError('login');
    clearAuthError('register');
    if (!opts || opts.focus !== false) {
      const target = isLogin ? $('#loginUsername') : $('#registerName');
      if (target) target.focus();
    }
  }

  function setAuthError(which, message) {
    const box = which === 'login' ? $('#loginError') : $('#registerError');
    if (!box) return;
    box.hidden = !message;
    box.innerHTML = message ? icon('alert-triangle') + '<span>' + esc(message) + '</span>' : '';
  }
  function clearAuthError(which) { setAuthError(which, ''); }

  async function onLoginSubmit(event) {
    event.preventDefault();
    const username = $('#loginUsername').value.trim();
    const password = $('#loginPassword').value;
    setAuthError('login', '');
    if (!username) { setAuthError('login', 'Username wajib diisi.'); $('#loginUsername').focus(); return; }
    if (!password) { setAuthError('login', 'Password wajib diisi.'); $('#loginPassword').focus(); return; }
    const btn = $('#loginSubmit');
    setButtonLoading(btn, true, 'Memeriksa akun…');
    try {
      const user = await API.login(username, password);
      setButtonLoading(btn, false);
      state.user = user;
      await enterApp(true);
    } catch (err) {
      setButtonLoading(btn, false);
      setAuthError('login', err.message || 'Gagal masuk. Coba lagi.');
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        state.online = false;
        updateConnectivity();
      }
    }
  }

  async function onRegisterSubmit(event) {
    event.preventDefault();
    const name = $('#registerName').value.trim();
    const username = $('#registerUsername').value.trim();
    const password = $('#registerPassword').value;
    setAuthError('register', '');
    if (!name) { setAuthError('register', 'Nama lengkap wajib diisi.'); $('#registerName').focus(); return; }
    if (username.length < 3) { setAuthError('register', 'Username minimal 3 karakter.'); $('#registerUsername').focus(); return; }
    if (password.length < 8) { setAuthError('register', 'Password minimal 8 karakter.'); $('#registerPassword').focus(); return; }
    const btn = $('#registerSubmit');
    setButtonLoading(btn, true, 'Membuat akun…');
    try {
      await API.register({ name, username, password });
      setButtonLoading(btn, false);
      $('#registerForm').reset();
      switchAuthTab('login', { focus: false });
      $('#loginUsername').value = username;
      $('#loginPassword').value = '';
      $('#loginPassword').focus();
      toast('success', 'Akun berhasil dibuat', 'Masuk menggunakan username dan password barumu.');
    } catch (err) {
      setButtonLoading(btn, false);
      setAuthError('register', err.message || 'Gagal membuat akun. Coba lagi.');
    }
  }

  function normalizeHash() {
    const hash = location.hash;
    const isDetail = hash.indexOf('#/laporan/') === 0;
    if (!ROUTES[hash] || hash === '#/masuk') {
      if (!isDetail) history.replaceState(null, '', '#/ringkasan');
    }
  }

  function showAuthScreen() {
    $('#authView').classList.remove('hidden');
    $('#shell').classList.add('hidden');
    switchAuthTab(location.hash === '#/daftar' ? 'register' : 'login', { focus: false });
    hydrateIcons(document);
    hydrateArt(document);
  }

  async function enterApp(welcome) {
    const authView = $('#authView');
    const shell = $('#shell');
    if (authView) authView.classList.add('hidden');
    if (shell) shell.classList.remove('hidden');
    document.body.style.overflow = '';
    state.pendingPhoto = null;
    state.photoError = '';
    state.coords = null;
    state.pendingViewRefresh = false;
    state.filters = { status: 'semua', q: '', from: '', to: '' };
    try { state.notificationsSeenAt = Number(localStorage.getItem(notifSeenKey())) || 0; } catch (e) { state.notificationsSeenAt = 0; }
    normalizeHash();
    paintChrome();
    const view = $('#view');
    view.innerHTML = loadingTemplate();
    hydrateIcons(view);
    const result = await refreshReports({ silent: true });
    if (result.ok) {
      renderRoute();
    } else {
      view.innerHTML = loadErrorTemplate(state.lastError || 'Data belum dapat dimuat.');
      hydrateIcons(view);
    }
    startPolling();
    if (welcome) {
      toast('success', greetingName() + ', ' + firstName(state.user.name) + '!', 'Semua laporanmu bisa dipantau dari halaman ringkasan.');
    }
  }

  function leaveApp() {
    stopPolling();
    Session.clear();
    state.user = null;
    state.reports = [];
    state.statusSnapshot = null;
    state.selectedReportId = null;
    state.pendingPhoto = null;
    state.photoError = '';
    state.coords = null;
    state.pendingViewRefresh = false;
    state.lastSync = null;
    state.lastError = '';
    state.filters = { status: 'semua', q: '', from: '', to: '' };
    state.route = 'dashboard';
    state.detailId = null;
    state.connecting = false;
    closeSidebar();
    closeNotif();
    closeModal();
    $('#shell').classList.add('hidden');
    $('#authView').classList.remove('hidden');
    $('#loginForm').reset();
    $('#registerForm').reset();
    clearAuthError('login');
    clearAuthError('register');
    switchAuthTab('login', { focus: false });
    history.replaceState(null, '', '#/masuk');
    window.scrollTo(0, 0);
    hydrateIcons(document);
    hydrateArt(document);
  }

  function doLogout() {
    API.logout().catch(() => {});
    leaveApp();
    toast('info', 'Kamu telah keluar', 'Sesi portal sudah diakhiri.');
  }

  /* -------------------------------------------------------------- routing */
  function parseRoute() {
    const hash = location.hash || '#/ringkasan';
    if (hash.indexOf('#/laporan/') === 0) {
      return { name: 'detail', id: decodeURIComponent(hash.slice('#/laporan/'.length)) };
    }
    return { name: ROUTES[hash] || 'dashboard' };
  }

  function renderRoute() {
    if (!state.user) return;
    let route = parseRoute();
    if (route.name === 'auth') {
      history.replaceState(null, '', '#/ringkasan');
      route = { name: 'dashboard' };
    }
    state.route = route.name;
    state.detailId = route.id || null;
    closeSidebar();
    closeNotif();
    updateNav();
    setDocTitle();
    const view = $('#view');
    if (!view) return;
    if (route.name === 'dashboard') view.innerHTML = dashboardView();
    else if (route.name === 'reports') view.innerHTML = reportsView();
    else if (route.name === 'detail') view.innerHTML = detailView(route.id);
    else if (route.name === 'new') view.innerHTML = newReportView();
    else if (route.name === 'profile') view.innerHTML = profileView();
    else view.innerHTML = dashboardView();
    hydrateIcons(view);
    hydrateArt(view);
    if (state.route === 'dashboard') bindDashboard();
    if (state.route === 'new') bindCreateForm();
    if (state.route === 'profile') bindProfileForms();
  }

  function onHashChange() {
    if (!state.user) return;
    closeSidebar();
    closeNotif();
    window.scrollTo({ top: 0, behavior: 'auto' });
    renderRoute();
  }

  /* -------------------------------------------------------------- data loading */
  function ensureSelectedReport() {
    if (state.selectedReportId && state.reports.some((r) => r.id === state.selectedReportId)) return;
    const active = state.reports.find((r) => ['menunggu_verifikasi', 'diproses', 'ditugaskan', 'diangkut'].includes(r.status));
    state.selectedReportId = (active || state.reports[0] || {}).id || null;
  }

  async function refreshReports(opts) {
    const options = opts || {};
    if (!state.user) return { ok: false, error: new Error('Sesi berakhir.') };
    if (state.loadingReports) return { ok: false, skipped: true };
    state.loadingReports = true;
    if (options.manual) state.connecting = true;
    updateConnectivity();
    try {
      const reports = await API.listReports(state.user.id);
      const previousReports = new Map(state.reports.map((report) => [report.id, report]));
      const reportDataChanged = reports.length !== state.reports.length || reports.some((report) => {
        const previousReport = previousReports.get(report.id);
        return !previousReport || JSON.stringify(previousReport) !== JSON.stringify(report);
      });
      const previous = state.statusSnapshot;
      const changes = [];
      if (previous) {
        reports.forEach((report) => {
          if (previous[report.id] && previous[report.id] !== report.status) {
            changes.push({ id: report.id, code: report.code, status: report.status });
          }
        });
      }
      state.reports = reports;
      state.statusSnapshot = Object.fromEntries(reports.map((r) => [r.id, r.status]));
      state.online = true;
      state.lastError = '';
      state.lastSync = new Date();
      ensureSelectedReport();
      updateChrome();
      if (changes.length && !options.suppressStatusToast) {
        changes.forEach((change) => {
          toast('success', 'Status laporan diperbarui', change.code + ' kini ' + statusMeta(change.status).label + '.');
        });
      }
      const recovering = !!$('#view .load-error');
      const reportRoutes = ['dashboard', 'reports', 'detail', 'profile'];
      if (reportDataChanged && reportRoutes.includes(state.route) && isModalOpen()) state.pendingViewRefresh = true;
      const shouldRender = !!options.forceRender || recovering ||
        (reportDataChanged && reportRoutes.includes(state.route) && !isModalOpen());
      if (shouldRender) renderRoute();
      if (options.notify) toast('success', 'Data terbaru dimuat', 'Informasi laporan sudah disinkronkan dengan server.');
      return { ok: true, changes };
    } catch (err) {
      state.online = false;
      state.lastError = err && err.message ? err.message : 'Tidak dapat memuat data dari server.';
      updateConnectivity();
      if (options.notify) toast('error', 'Gagal memuat data', state.lastError);
      return { ok: false, error: err };
    } finally {
      state.loadingReports = false;
      state.connecting = false;
      updateConnectivity();
      updatePendingBadge();
    }
  }

  function updateChrome() {
    paintChrome();
  }

  function startPolling() {
    stopPolling();
    state.pollTimer = setInterval(() => {
      if (document.hidden || !state.user || state.loadingReports) return;
      refreshReports({ silent: true });
    }, POLL_MS);
  }
  function stopPolling() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  async function retryConnection() {
    if (!state.user) return;
    state.connecting = true;
    updateConnectivity();
    const res = await refreshReports({ manual: true, forceRender: ['dashboard', 'reports', 'detail', 'profile'].includes(state.route) });
    if (res.ok) {
      toast('success', 'Koneksi pulih', 'Data terbaru sudah dimuat dari server.');
      if (state.route === 'profile') renderRoute();
    } else {
      toast('error', 'Masih belum tersambung', (res.error && res.error.message) || 'Periksa koneksi lalu coba lagi.');
    }
  }

  window.addEventListener('online', () => {
    state.online = true;
    updateConnectivity();
    if (state.user) {
      toast('success', 'Kembali tersambung', 'Menyinkronkan data terbaru…');
      refreshReports({ silent: true });
    }
  });
  window.addEventListener('offline', () => {
    state.online = false;
    updateConnectivity();
    if (state.user) toast('info', 'Koneksi terputus', 'Portal akan mencoba menyambung kembali secara otomatis.');
  });

  /* -------------------------------------------------------------- app listeners */
  function runSideSearch() {
    const input = $('#sideSearch');
    if (!input || !state.user) return;
    const q = input.value.trim();
    state.filters = { status: 'semua', q, from: '', to: '' };
    if (location.hash === '#/riwayat') {
      syncFilterInputs();
      updateFilterResults();
    } else {
      location.hash = '#/riwayat';
    }
    input.value = '';
  }

  function bindChrome() {
    const menuBtn = $('#menuBtn');
    if (menuBtn) menuBtn.addEventListener('click', toggleSidebar);
    const scrim = $('#scrim');
    if (scrim) scrim.addEventListener('click', closeSidebar);
    const sideSearchForm = $('#sideSearchForm');
    if (sideSearchForm) sideSearchForm.addEventListener('submit', (event) => {
      event.preventDefault();
      runSideSearch();
    });
    document.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && String(event.key).toLowerCase() === 'k') {
        const input = $('#sideSearch');
        if (input && state.user) {
          event.preventDefault();
          input.focus();
          input.select();
        }
      }
    });
    const bell = $('#bellBtn');
    if (bell) bell.addEventListener('click', (event) => { event.stopPropagation(); toggleNotif(); });
    const modalRoot = $('#modalRoot');
    if (modalRoot) {
      modalRoot.addEventListener('mousedown', (event) => {
        if (event.target.classList.contains('modal-backdrop')) closeModal();
      });
    }
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('input', onDocumentInput);
    document.addEventListener('change', onDocumentChange);
    document.addEventListener('keydown', onKeydown);
    window.addEventListener('hashchange', onHashChange);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && state.user && (!state.lastSync || Date.now() - state.lastSync.getTime() > 12000)) {
        refreshReports({ silent: true });
      }
    });
    window.addEventListener('storage', (event) => {
      if (!state.user) return;
      if (event.key === D.SESSION_KEY && !event.newValue) {
        leaveApp();
        toast('info', 'Sesi berakhir', 'Akun ini telah keluar dari tab lain. Silakan masuk kembali.');
      }
    });
    window.addEventListener('smartwaste-auth-expired', () => {
      if (!state.user) return;
      leaveApp();
      setAuthError('login', 'Sesi login berakhir. Silakan masuk kembali.');
      toast('info', 'Sesi berakhir', 'Masuk kembali dengan username dan passwordmu.');
    });
    $$('[data-auth-tab]').forEach((tab) => {
      tab.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          const next = tab.dataset.authTab === 'login' ? 'register' : 'login';
          switchAuthTab(next);
          $('[data-auth-tab="' + next + '"]').focus();
        }
      });
    });
  }

  function onDocumentClick(event) {
    const pop = $('#notifPop');
    if (pop && !pop.hidden && !event.target.closest('#notifPop') && !event.target.closest('#bellBtn')) closeNotif();
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    if (!action) return;
    try {
      const result = handleAction(action, actionEl, event);
      if (result && typeof result.catch === 'function') {
        result.catch((err) => {
          console.error(err);
          toast('error', 'Terjadi kesalahan', (err && err.message) || 'Silakan coba lagi.');
        });
      }
    } catch (err) {
      console.error(err);
      toast('error', 'Terjadi kesalahan', (err && err.message) || 'Silakan coba lagi.');
    }
  }

  function onDocumentInput(event) {
    const target = event.target;
    if (target.id === 'reportSearch') {
      state.filters.q = target.value;
      updateFilterResults();
      return;
    }
    if (target.closest('#createReportForm')) {
      if (target.id === 'fLocation' && state.coords && !target.value.startsWith('Koordinat GPS:')) {
        state.coords = null;
        updateCoordNote();
      }
      clearFieldError(target);
      scheduleDraftSave();
    }
  }

  function onDocumentChange(event) {
    const target = event.target;
    if (target.id === 'filterFrom' || target.id === 'filterTo') {
      state.filters.from = $('#filterFrom') ? $('#filterFrom').value : '';
      state.filters.to = $('#filterTo') ? $('#filterTo').value : '';
      updateFilterResults();
      return;
    }
    if (target.id === 'photoInput') {
      if (target.files && target.files[0]) handlePhotoFile(target.files[0]);
      return;
    }
    if (target.id === 'avatarInput') {
      if (target.files && target.files[0]) handleAvatarFile(target.files[0]);
      return;
    }
    if (target.id === 'reportSelect') {
      state.selectedReportId = target.value;
      const card = $('#progressCard');
      if (card) {
        card.outerHTML = progressCardHTML(dashboardData());
        hydrateIcons($('#progressCard'));
      }
      return;
    }
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      if (isModalOpen()) { closeModal(); return; }
      if (state.notifOpen) { closeNotif(); return; }
      const sidebar = $('#sidebar');
      if (sidebar && sidebar.classList.contains('is-open')) { closeSidebar(); return; }
    }
    if (event.key === 'Tab' && isModalOpen()) trapFocus(event);
  }

  function handleAction(action, el, event) {
    switch (action) {
      case 'toggle-password':
        if (event) event.preventDefault();
        togglePasswordVisibility(el);
        return;
      case 'go-profile':
        location.hash = '#/profil';
        return;
      case 'logout':
        doLogout();
        return;
      case 'open-help':
        openHelpModal();
        return;
      case 'close-modal':
        closeModal();
        return;
      case 'open-report-camera':
        return openReportCamera();
      case 'capture-report-photo':
        captureReportPhoto();
        return;
      case 'retry-connection':
        retryConnection();
        return;
      case 'export-csv':
        exportReportsCsv();
        return;
      case 'filter-reports':
        setFilterStatus(el.dataset.status);
        return;
      case 'reset-filters':
        resetFilters();
        return;
      case 'reset-dates':
        resetDates();
        return;
      case 'remove-photo':
        removePhoto();
        return;
      case 'use-location':
        useMyLocation(el);
        return;
      case 'edit-report':
        openEditModal(el.dataset.id);
        return;
      case 'cancel-report':
        openCancelModal(el.dataset.id);
        return;
      case 'confirm-cancel':
        confirmCancelReport(el);
        return;
      case 'view-photo':
        openPhotoModal(el.dataset.report, el.dataset.kind);
        return;
      case 'upload-avatar':
        if ($('#avatarInput')) $('#avatarInput').click();
        return;
      case 'close-notif':
        closeNotif();
        return;
      case 'focus-new-type':
        if (event) event.preventDefault();
        const firstType = $('#createReportForm input[name="type"]');
        if (firstType) firstType.focus();
        return;
      default:
        return;
    }
  }

  function togglePasswordVisibility(button) {
    const input = document.getElementById(button.dataset.target);
    if (!input) return;
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    button.innerHTML = icon(showing ? 'eye' : 'eye-off');
    button.setAttribute('aria-label', showing ? 'Tampilkan password' : 'Sembunyikan password');
  }

  /* -------------------------------------------------------------- dashboard */
  function lastSixMonths() {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: d.getFullYear() + '-' + pad(d.getMonth() + 1),
        label: MONTHS_SHORT[d.getMonth()],
        full: MONTHS_LONG[d.getMonth()] + ' ' + d.getFullYear()
      });
    }
    return months;
  }

  function stageDates(report) {
    const dates = [null, null, null, null];
    if (!report) return dates;
    const findEntry = (statuses) => (report.history || []).find((h) => statuses.indexOf(h.status) !== -1);
    const initial = findEntry(['menunggu_verifikasi']);
    if (initial) dates[0] = initial.at;
    const handled = findEntry(['diproses', 'ditugaskan']);
    if (handled) dates[1] = handled.at;
    const transported = findEntry(['diangkut']);
    if (transported) dates[2] = transported.at;
    const done = findEntry(['selesai']);
    if (done) dates[3] = done.at;
    return dates;
  }

  function dashboardData() {
    const reports = state.reports;
    const total = reports.length;
    const count = (statuses) => reports.filter((r) => statuses.indexOf(r.status) !== -1).length;
    const pending = count(['menunggu_verifikasi']);
    const handled = count(['diproses', 'ditugaskan']);
    const transported = count(['diangkut']);
    const done = count(['selesai']);
    const rejected = count(['ditolak']);
    const cancelled = count(['dibatalkan_warga']);
    const months = lastSixMonths();
    const trend = months.map((month) => {
      const items = reports.filter((r) => r.date && r.date.slice(0, 7) === month.key);
      return {
        key: month.key,
        label: month.label,
        full: month.full,
        count: items.length,
        weight: items.reduce((sum, r) => sum + (Number(r.weight) || 0), 0)
      };
    });
    const weight6 = trend.reduce((sum, m) => sum + m.weight, 0);
    const typeStats = TYPES.map((type) => ({
      ...type,
      count: reports.filter((r) => r.type === type.id).length
    })).filter((t) => t.count > 0).sort((a, b) => b.count - a.count);
    let selected = reports.find((r) => r.id === state.selectedReportId) || null;
    if (!selected && reports.length) selected = reports[0];
    return {
      reports, total, pending, handled, transported, done, rejected, cancelled,
      processing: handled + transported,
      completion: pct(done, total),
      trend, weight6, typeStats, selected,
      trendTotal: trend.reduce((sum, m) => sum + m.count, 0)
    };
  }

  function stepperHTML(report, large) {
    const meta = statusMeta(report ? report.status : 'menunggu_verifikasi');
    const stage = meta.stage;
    const dates = stageDates(report);
    const terminal = stage < 0;
    const fill = stage > 0 ? Math.min(stage, 3) * 25 : 0;
    const steps = [
      { label: 'Diterima', date: dates[0] },
      { label: 'Ditangani', date: dates[1] },
      { label: 'Diangkut', date: dates[2] },
      { label: 'Selesai', date: dates[3] }
    ];
    const items = steps.map((step, index) => {
      const isDone = terminal ? Boolean(step.date) : stage > index;
      const isCurrent = !terminal && stage === index;
      const showCheck = isDone || (isCurrent && stage === 3);
      const classes = ['step'];
      if (isDone) classes.push('is-done');
      if (isCurrent) classes.push('is-current');
      return '<div class="' + classes.join(' ') + '" aria-current="' + (isCurrent ? 'step' : 'false') + '">' +
        '<span class="step-dot">' + (showCheck ? icon('check') : isCurrent ? '<span class="step-pip"></span>' : '') + '</span>' +
        '<span class="step-label">' + step.label + '</span>' +
        '<span class="step-date">' + (step.date ? esc(fmtDate(step.date, { year: false })) : '&nbsp;') + '</span>' +
        '</div>';
    }).join('');
    return '<div class="stepper' + (large ? ' stepper--lg' : '') + '" aria-label="Progres laporan ' + esc(meta.label) + '">' +
      '<div class="stepper-line"></div><div class="stepper-fill" style="width:' + fill + '%"></div>' + items + '</div>';
  }

  function terminalBannerHTML(report, compact) {
    if (!report) return '';
    const meta = statusMeta(report.status);
    if (meta.stage >= 0) return '';
    const last = (report.history || []).slice().reverse().find((h) => h.status === report.status);
    const isDanger = report.status === 'ditolak';
    const title = report.status === 'ditolak' ? 'Laporan ditolak' : 'Laporan dibatalkan warga';
    const note = last ? last.note : (report.status === 'ditolak' ? 'Laporan tidak dapat diproses.' : 'Laporan tidak dilanjutkan.');
    return '<div class="status-banner' + (isDanger ? ' is-danger' : '') + '">' +
      '<span class="status-banner-ic">' + icon(isDanger ? 'x-circle' : 'info') + '</span>' +
      '<div><strong>' + esc(title) + '</strong><span>' + esc(note) + '</span></div></div>';
  }

  function kpiCardsHTML(data) {
    const completion = data.total ? Math.round((data.done / data.total) * 100) : 0;
    return '<section class="kpi-grid" aria-label="Ringkasan angka laporan">' +
      '<article class="kpi-card">' +
        '<div class="kpi-head"><span class="kpi-label">Total laporan</span><span class="kpi-icon">' + icon('grid') + '</span></div>' +
        '<div class="kpi-value">' + fmtNumber(data.total) + '</div>' +
        '<div class="kpi-meta"><span class="kpi-delta is-green">' + icon('arrow-up-right') + fmtKg(data.weight6) + '</span><span class="kpi-sub">estimasi 6 bulan</span></div>' +
      '</article>' +
      '<article class="kpi-card">' +
        '<div class="kpi-head"><span class="kpi-label">Menunggu verifikasi</span><span class="kpi-icon">' + icon('clock') + '</span></div>' +
        '<div class="kpi-value">' + fmtNumber(data.pending) + '</div>' +
        '<div class="kpi-meta"><span class="kpi-delta is-amber">Perlu ditinjau</span><span class="kpi-sub">oleh petugas</span></div>' +
      '</article>' +
      '<article class="kpi-card">' +
        '<div class="kpi-head"><span class="kpi-label">Sedang diproses</span><span class="kpi-icon">' + icon('truck') + '</span></div>' +
        '<div class="kpi-value">' + fmtNumber(data.processing) + '</div>' +
        '<div class="kpi-meta"><span class="kpi-delta is-blue">Ditangani</span><span class="kpi-sub">&amp; diangkut</span></div>' +
      '</article>' +
      '<article class="kpi-card">' +
        '<div class="kpi-head"><span class="kpi-label">Selesai</span><span class="kpi-icon">' + icon('check-circle') + '</span></div>' +
        '<div class="kpi-value">' + fmtNumber(data.done) + '</div>' +
        '<div class="kpi-progress" aria-hidden="true"><span style="width:' + completion + '%"></span></div>' +
        '<div class="kpi-meta"><span class="kpi-delta is-green">' + completion + '%</span><span class="kpi-sub">dari total laporan</span></div>' +
      '</article>' +
    '</section>';
  }

  function heroHTML(data) {
    return '<section class="hero">' +
      '<div class="hero-content">' +
        '<span class="eyebrow-pill"><span class="dot"></span> Ringkasan laporan</span>' +
        '<h2>Lingkungan bersih dimulai dari <em>laporanmu.</em></h2>' +
        '<p class="hero-sub">Pantau setiap laporan sampah yang kamu kirim, dari diterima petugas sampai selesai ditangani.</p>' +
        '<div class="hero-stats">' +
          '<div class="hero-stat"><strong>' + fmtNumber(data.total) + '</strong><span>Total laporan</span></div>' +
          '<div class="hero-divider"></div>' +
          '<div class="hero-stat"><strong>' + fmtNumber(data.weight6) + '<span class="hero-unit"> kg</span></strong><span>Estimasi berat 6 bulan</span></div>' +
        '</div>' +
        '<div class="hero-actions">' +
          '<a class="btn btn--hero" href="#/buat">Buat laporan ' + icon('arrow-right') + '</a>' +
          '<a class="btn btn--hero-ghost" href="#/riwayat">Lihat riwayat</a>' +
        '</div>' +
      '</div>' +
      '<div class="hero-art" aria-hidden="true">' + ART.hero + '</div>' +
    '</section>';
  }

  function funnelHTML(data) {
    const stages = [
      { label: 'Diterima', value: data.pending, caption: 'Menunggu verifikasi' },
      { label: 'Ditangani', value: data.handled, caption: 'Petugas ditugaskan' },
      { label: 'Diangkut', value: data.transported, caption: 'Menuju TPA' },
      { label: 'Selesai', value: data.done, caption: 'Tuntas ditangani' }
    ];
    const total = Math.max(1, data.total);
    const segments = stages.map((stage, index) => {
      const share = Math.round((stage.value / total) * 100);
      return '<span class="pipeline-seg p' + (index + 1) + '" style="width:' + share + '%" title="' + esc(stage.label + ': ' + stage.value + ' laporan') + '"></span>';
    }).join('');
    const rows = stages.map((stage, index) => {
      const share = data.total ? Math.round((stage.value / data.total) * 100) : 0;
      return '<div class="pipeline-row">' +
        '<span class="pipeline-dot p' + (index + 1) + '"></span>' +
        '<div class="pipeline-label"><strong>' + stage.label + '</strong><small>' + stage.caption + '</small></div>' +
        '<span class="pipeline-count">' + stage.value + '</span>' +
        '<span class="pipeline-pct">' + share + '%</span>' +
      '</div>';
    }).join('');
    return '<section class="card pipeline-card">' +
      '<div class="card-head"><div><h3 class="card-title">Status penanganan</h3><p class="card-sub">Posisi laporanmu di setiap tahap.</p></div>' +
        '<span class="chip chip--plain">' + data.completion + '% selesai</span></div>' +
      '<div class="pipeline-seg" aria-hidden="true">' + segments + '</div>' +
      '<div class="pipeline-list">' + rows + '</div>' +
      '<div class="pipeline-foot"><span><strong>' + data.done + '</strong> dari <strong>' + data.total + '</strong> laporan tuntas</span>' +
        '<span>' + data.processing + ' sedang diproses</span></div>' +
    '</section>';
  }

  function chartGeometry(trend) {
    const width = 800;
    const height = 220;
    const padX = 22;
    const top = 18;
    const bottom = 26;
    const usable = width - padX * 2;
    const max = Math.max(1, ...trend.map((t) => t.count));
    const points = trend.map((item, index) => {
      const x = padX + (usable * index) / Math.max(1, trend.length - 1);
      const y = top + (height - top - bottom) * (1 - item.count / max);
      return { ...item, x, y, xp: (x / width) * 100, yp: (y / height) * 100 };
    });
    let line = 'M ' + points[0].x + ' ' + points[0].y;
    for (let i = 0; i < points.length - 1; i += 1) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      line += ' C ' + cp1x + ' ' + cp1y + ', ' + cp2x + ' ' + cp2y + ', ' + p2.x + ' ' + p2.y;
    }
    const baseline = height - bottom + 8;
    const area = line + ' L ' + points[points.length - 1].x + ' ' + baseline + ' L ' + points[0].x + ' ' + baseline + ' Z';
    const grid = [0, 1, 2, 3].map((i) => top + ((height - top - bottom) * i) / 3);
    return { width, height, points, line, area, grid };
  }

  function trendCardHTML(data) {
    const geo = chartGeometry(data.trend);
    return '<section class="card">' +
      '<div class="card-head">' +
        '<div><h3 class="card-title">Tren laporan</h3><p class="card-sub">Jumlah laporan per bulan dalam enam bulan terakhir.</p></div>' +
        '<div class="trend-total"><strong>' + data.trendTotal + ' laporan</strong><span>6 bulan terakhir</span></div>' +
      '</div>' +
      '<div class="trend-chart">' +
        '<svg class="trend-svg" viewBox="0 0 ' + geo.width + ' ' + geo.height + '" preserveAspectRatio="none" aria-hidden="true">' +
          '<defs><linearGradient id="trendFillArea" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%" stop-color="#7d9c72" stop-opacity=".28"/><stop offset="100%" stop-color="#7d9c72" stop-opacity="0"/>' +
          '</linearGradient></defs>' +
          geo.grid.map((y) => '<line class="trend-grid-line" x1="0" x2="' + geo.width + '" y1="' + y + '" y2="' + y + '"/>').join('') +
          '<path class="trend-area" d="' + geo.area + '" fill="url(#trendFillArea)"/>' +
          '<path class="trend-line" d="' + geo.line + '"/>' +
        '</svg>' +
        geo.points.map((point, index) =>
          '<button type="button" class="trend-point-hit" style="left:' + point.xp + '%;top:' + point.yp + '%" data-chart-index="' + index + '" ' +
          'aria-label="' + esc(point.full + ': ' + point.count + ' laporan, estimasi ' + fmtKg(point.weight)) + '"></button>' +
          '<span class="trend-dot" aria-hidden="true" style="left:' + point.xp + '%;top:' + point.yp + '%"></span>'
        ).join('') +
        '<div class="trend-hover" id="trendTooltip" role="status" aria-live="polite"></div>' +
      '</div>' +
      '<div class="trend-labels">' +
        data.trend.map((month, index) => '<span' + (index === data.trend.length - 1 ? ' class="is-now"' : '') + '>' + month.label + '</span>').join('') +
      '</div>' +
      '<div class="trend-note">' + icon('scale') + '<span><strong>' + fmtKg(data.weight6) + '</strong> estimasi berat dari seluruh laporan pada rentang yang sama, bukan berat satu laporan.</span></div>' +
    '</section>';
  }

  function typesCardHTML(data) {
    if (!data.total) {
      return '<section class="card types-card">' +
        '<div class="card-head"><div><h3 class="card-title">Jenis sampah</h3><p class="card-sub">Distribusi dari seluruh laporanmu.</p></div></div>' +
        '<div class="empty-mini">' + icon('leaf') + '<p>Belum ada data jenis sampah.<br>Kirim laporan pertamamu.</p></div>' +
        '<a class="btn btn--soft btn--block btn--sm" href="#/buat">Buat laporan</a></section>';
    }
    const radius = 58;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    const segments = data.typeStats.map((type) => {
      const share = (type.count / data.total) * 100;
      const dash = Math.max(0.8, share - 1.2);
      const circle = '<circle class="donut-seg" cx="80" cy="80" r="' + radius + '" pathLength="100" stroke="' + type.color + '" ' +
        'stroke-dasharray="' + dash + ' ' + (100 - dash) + '" stroke-dashoffset="' + (-offset) + '">' +
        '<title>' + esc(type.label + ': ' + type.count + ' laporan (' + Math.round(share) + '%)') + '</title></circle>';
      offset += share;
      return circle;
    }).join('');
    const top = data.typeStats.slice(0, 4);
    const legend = top.map((type) => '<div class="type-row">' +
      '<span class="type-swatch" style="background:' + type.color + '"></span>' +
      '<span class="type-name">' + esc(type.label) + '</span>' +
      '<span class="type-count">' + type.count + '</span>' +
      '<span class="type-pct">' + Math.round((type.count / data.total) * 100) + '%</span>' +
      '</div>').join('');
    return '<section class="card types-card">' +
      '<div class="card-head"><div><h3 class="card-title">Jenis sampah</h3><p class="card-sub">Distribusi dari seluruh laporanmu.</p></div></div>' +
      '<div class="donut-wrap">' +
        '<svg class="donut-svg" viewBox="0 0 160 160" aria-hidden="true" style="--circ:' + circumference + '">' +
          '<circle cx="80" cy="80" r="' + radius + '" fill="none" stroke="#f2f7ee" stroke-width="25"/>' + segments +
        '</svg>' +
        '<div class="donut-center"><strong>' + data.total + '</strong><span>Laporan</span></div>' +
      '</div>' +
      '<div class="type-legend">' + legend + '</div>' +
      (data.typeStats.length > 4 ? '<p class="type-more">+' + (data.typeStats.length - 4) + ' kategori lainnya</p>' : '') +
      '<a class="btn btn--ghost btn--block btn--sm" href="#/riwayat">Lihat semua riwayat ' + icon('arrow-right') + '</a>' +
    '</section>';
  }

  function recentCardHTML(data) {
    const recent = data.reports.slice(0, 3);
    return '<section class="card recent-card">' +
      '<div class="card-head"><div><h3 class="card-title">Laporan terbaru</h3><p class="card-sub">Tiga laporan yang terakhir kamu kirim.</p></div></div>' +
      (recent.length ? '<div class="recent-list">' + recent.map((report) => {
        const type = typeMeta(report.type);
        return '<a class="recent-item" href="#/laporan/' + encodeURIComponent(report.id) + '">' +
          '<span class="recent-icon">' + icon(type.icon) + '</span>' +
          '<span class="recent-main">' +
            '<span class="recent-code">' + esc(report.code) + '</span>' +
            '<span class="recent-title">' + esc(type.label) + '</span>' +
            '<span class="recent-meta">' + esc(fmtDate(report.date, { year: false })) + ' · ' + fmtKg(report.weight) + '</span>' +
          '</span>' +
          '<span class="recent-side">' + statusBadge(report.status) + '</span>' +
        '</a>';
      }).join('') + '</div>' : '<div class="empty-mini">' + icon('clock') + '<p>Belum ada laporan.<br>Mulai dari laporan pertamamu.</p></div>') +
      '<a class="btn btn--ghost btn--block btn--sm" href="#/riwayat">Lihat seluruh riwayat ' + icon('arrow-right') + '</a>' +
    '</section>';
  }

  function recentTableHTML(data) {
    const recent = data.reports.slice(0, 3);
    return '<section class="card recent-table-card">' +
      '<div class="results-head"><div><h3>Laporan terbaru</h3>' +
      '<p>Tiga laporan yang terakhir kamu kirim.</p></div>' +
      '<a class="btn btn--ghost btn--sm" href="#/riwayat">Lihat semua ' + icon('arrow-right') + '</a></div>' +
      (recent.length ?
        '<div class="report-table-head"><span>Laporan</span><span>Tanggal</span><span>Lokasi</span><span>Berat</span><span>Status</span><span></span></div>' +
        recent.map(reportRowHTML).join('') :
        '<div class="empty-mini">' + icon('clock') + '<p>Belum ada laporan.<br>Mulai dari laporan pertamamu.</p></div>') +
    '</section>';
  }

  function progressCardHTML(data) {
    const report = data.selected;
    const selector = data.total > 1 ? '<div class="select-wrap" style="margin-bottom:14px">' +
      '<select id="reportSelect" aria-label="Pilih laporan yang dipantau">' +
      data.reports.map((r) => '<option value="' + esc(r.id) + '"' + (report && r.id === report.id ? ' selected' : '') + '>' +
        esc(r.code + ' · ' + typeMeta(r.type).label + ' · ' + statusMeta(r.status).label) + '</option>').join('') +
      '</select>' + icon('chevron-down') + '</div>' : '';
    let body = '';
    if (report) {
      const type = typeMeta(report.type);
      body = '<div class="mini-report">' +
        '<div><div class="mini-report-code">' + esc(report.code) + '</div>' +
        '<div class="mini-report-type"><strong>' + esc(type.label) + '</strong>' +
        '<span class="muted" style="font-size:10px">· ' + esc(fmtDate(report.date, { year: false })) + '</span></div></div>' +
        statusBadge(report.status) +
      '</div>' +
      stepperHTML(report) +
      terminalBannerHTML(report) +
      '<div class="mini-report-foot">' +
        '<div class="mini-loc">' + icon('map-pin') + '<span>' + esc(report.location) + '</span></div>' +
        '<span class="mini-weight">' + fmtKg(report.weight) + '</span>' +
      '</div>' +
      '<a class="btn btn--soft btn--block btn--sm" href="#/laporan/' + encodeURIComponent(report.id) + '">Lihat detail laporan ' + icon('arrow-right') + '</a>';
    } else {
      body = '<div class="empty-mini">' + icon('image') + '<p>Belum ada laporan untuk dipantau.<br>Kirim laporan pertama untuk melihat progresnya.</p>' +
        '<a class="btn btn--primary btn--sm" href="#/buat">Buat laporan</a></div>';
    }
    return '<section class="card progress-card" id="progressCard">' +
      '<div class="card-head progress-card-head"><div><h3 class="card-title">Pantau progres</h3>' +
      '<p class="card-sub">Ikuti laporanmu dari diterima sampai selesai.</p></div></div>' +
      selector + body +
    '</section>';
  }

  function dashboardView() {
    const data = dashboardData();
    return '<div class="page-head">' +
      '<div><h2>Ringkasan</h2><p>Pantau perjalanan setiap laporan sampahmu di satu tempat.</p></div>' +
      '<div class="page-actions">' +
        '<span class="date-chip">' + icon('calendar') + fmtDateLong(D.todayISO()) + '</span>' +
        '<a class="btn btn--primary" href="#/buat">' + icon('plus') + ' Buat laporan</a>' +
      '</div></div>' +
      kpiCardsHTML(data) +
      '<div class="dash-trio">' + typesCardHTML(data) + progressCardHTML(data) + funnelHTML(data) + '</div>' +
      trendCardHTML(data) +
      recentTableHTML(data);
  }

  function bindDashboard() {
    const chart = $('.trend-chart');
    if (!chart) return;
    const data = dashboardData();
    const tooltip = $('#trendTooltip', chart);
    if (!tooltip) return;
    $$('.trend-point-hit', chart).forEach((button) => {
      const index = Number(button.dataset.chartIndex);
      const point = data.trend[index];
      if (!point) return;
      const show = () => {
        tooltip.innerHTML = '<strong>' + esc(point.count + ' laporan') + '</strong><span>' + esc(point.full + ' · ' + fmtKg(point.weight)) + '</span>';
        tooltip.style.left = point.xp + '%';
        tooltip.style.top = point.yp + '%';
        tooltip.classList.add('is-visible');
      };
      const hide = () => tooltip.classList.remove('is-visible');
      button.addEventListener('mouseenter', show);
      button.addEventListener('mouseleave', hide);
      button.addEventListener('focus', show);
      button.addEventListener('blur', hide);
    });
  }

  /* -------------------------------------------------------------- report history */
  const STATUS_FILTER_MAP = {
    semua: () => true,
    menunggu: (r) => r.status === 'menunggu_verifikasi',
    diproses: (r) => ['diproses', 'ditugaskan', 'diangkut'].indexOf(r.status) !== -1,
    selesai: (r) => r.status === 'selesai',
    ditolak: (r) => r.status === 'ditolak'
  };

  function filteredReports() {
    const q = state.filters.q.trim().toLowerCase();
    const from = state.filters.from;
    const to = state.filters.to;
    const statusTest = STATUS_FILTER_MAP[state.filters.status] || STATUS_FILTER_MAP.semua;
    return state.reports.filter((report) => {
      if (!statusTest(report)) return false;
      if (from && report.date < from) return false;
      if (to && report.date > to) return false;
      if (q) {
        const haystack = [
          report.code, typeMeta(report.type).label, report.location, report.description,
          statusMeta(report.status).label, report.status
        ].join(' ').toLowerCase();
        if (haystack.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function hasActiveFilters() {
    return state.filters.status !== 'semua' || !!state.filters.q.trim() || !!state.filters.from || !!state.filters.to;
  }

  function filterChip(status, label, count) {
    const active = state.filters.status === status;
    return '<button type="button" class="filter-chip' + (active ? ' is-active' : '') + '" data-action="filter-reports" data-status="' + status + '" aria-pressed="' + active + '">' +
      esc(label) + ' <small>' + count + '</small></button>';
  }

  function reportRowHTML(report) {
    const type = typeMeta(report.type);
    const initialPhoto = report.photos && report.photos.initial;
    const thumbnail = initialPhoto
      ? '<span class="report-photo"><img src="' + esc(initialPhoto) + '" alt="" loading="lazy"></span>'
      : typeTile(report.type);
    return '<a class="report-row" href="#/laporan/' + encodeURIComponent(report.id) + '">' +
      '<div class="report-cell-main">' + thumbnail +
        '<div><strong>' + esc(type.label) + '</strong><span>' + esc(report.code) + '</span></div>' +
      '</div>' +
      '<div class="report-cell-date">' + esc(fmtDate(report.date)) + '</div>' +
      '<div class="report-cell-loc">' + esc(report.location) + '</div>' +
      '<div class="report-cell-weight">' + fmtKg(report.weight) + '</div>' +
      '<div class="report-cell-status">' + statusBadge(report.status) + '</div>' +
      '<div class="report-chevron">' + icon('chevron-right') + '</div>' +
    '</a>';
  }

  function resultsCardHTML(list) {
    const active = hasActiveFilters();
    let empty;
    if (!state.reports.length) {
      empty = '<div class="empty-state">' +
        '<span class="empty-art">' + icon('trash') + '</span>' +
        '<h4>Belum ada laporan</h4>' +
        '<p>Kirim laporan pertama tentang kondisi sampah di sekitarmu.<br>Petugas akan menindaklanjuti setelah verifikasi.</p>' +
        '<a class="btn btn--primary btn--sm" href="#/buat">' + icon('plus') + ' Buat laporan</a></div>';
    } else {
      empty = '<div class="empty-state">' +
        '<span class="empty-art">' + icon('search') + '</span>' +
        '<h4>Laporan tidak ditemukan</h4>' +
        '<p>Coba ubah kata kunci, status, atau rentang tanggal yang dipilih.</p>' +
        (active ? '<button type="button" class="btn btn--ghost btn--sm" data-action="reset-filters">Reset filter</button>' : '') +
        '</div>';
    }
    return '<section class="card results-card">' +
      '<div class="results-head"><div><h3>Daftar laporan</h3>' +
      '<p>Menampilkan ' + list.length + ' dari ' + state.reports.length + ' laporan</p></div>' +
      (state.reports.length ? '<span class="chip chip--mint">' + icon('shield') + ' Hanya data milikmu</span>' : '') +
      '</div>' +
      (list.length ?
        '<div class="report-table-head"><span>Laporan</span><span>Tanggal</span><span>Lokasi</span><span>Berat</span><span>Status</span><span></span></div>' +
        list.map(reportRowHTML).join('') :
        empty) +
    '</section>';
  }

  function reportsView() {
    const data = dashboardData();
    const counts = {
      semua: state.reports.length,
      menunggu: data.pending,
      diproses: data.processing,
      selesai: data.done,
      ditolak: data.rejected
    };
    return '<div class="page-head">' +
      '<div><h2>Riwayat laporan</h2><p>Semua laporan yang kamu kirim, lengkap dengan status terbarunya.</p></div>' +
      '<div class="page-actions">' +
        '<button type="button" class="btn btn--ghost" data-action="export-csv" title="Mengunduh seluruh laporan">' + icon('download') + ' Unduh CSV</button>' +
        '<a class="btn btn--primary" href="#/buat">' + icon('plus') + ' Buat laporan</a>' +
      '</div></div>' +
      '<section class="card toolbar">' +
        '<div class="filter-chips" role="group" aria-label="Filter status laporan">' +
          filterChip('semua', 'Semua', counts.semua) +
          filterChip('menunggu', 'Menunggu', counts.menunggu) +
          filterChip('diproses', 'Diproses', counts.diproses) +
          filterChip('selesai', 'Selesai', counts.selesai) +
          filterChip('ditolak', 'Ditolak', counts.ditolak) +
        '</div>' +
        '<div class="toolbar-row">' +
          '<div class="search-field">' + icon('search') +
            '<input id="reportSearch" type="search" placeholder="Cari kode, jenis, lokasi, atau deskripsi…" aria-label="Cari laporan" value="' + esc(state.filters.q) + '">' +
          '</div>' +
          '<div class="date-range">' + icon('calendar') +
            '<input id="filterFrom" type="date" aria-label="Tanggal awal" value="' + esc(state.filters.from) + '">' +
            '<span class="date-sep">—</span>' +
            '<input id="filterTo" type="date" aria-label="Tanggal akhir" value="' + esc(state.filters.to) + '">' +
            '<button type="button" class="date-clear" data-action="reset-dates" aria-label="Hapus batas tanggal">×</button>' +
          '</div>' +
        '</div>' +
      '</section>' +
      '<div id="reportResultsWrap">' + resultsCardHTML(filteredReports()) + '</div>';
  }

  function updateFilterChips() {
    $$('.filter-chip').forEach((chip) => {
      const active = chip.dataset.status === state.filters.status;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', String(active));
    });
  }

  function updateFilterResults() {
    const wrap = $('#reportResultsWrap');
    if (!wrap) return;
    wrap.innerHTML = resultsCardHTML(filteredReports());
    hydrateIcons(wrap);
    updateFilterChips();
  }

  function syncFilterInputs() {
    const search = $('#reportSearch');
    if (search) search.value = state.filters.q;
    const from = $('#filterFrom');
    if (from) from.value = state.filters.from;
    const to = $('#filterTo');
    if (to) to.value = state.filters.to;
  }

  function setFilterStatus(status) {
    if (!STATUS_FILTER_MAP[status]) return;
    state.filters.status = status;
    updateFilterResults();
  }

  function resetFilters() {
    state.filters = { status: 'semua', q: '', from: '', to: '' };
    syncFilterInputs();
    updateFilterResults();
  }

  function resetDates() {
    state.filters.from = '';
    state.filters.to = '';
    syncFilterInputs();
    updateFilterResults();
  }

  function csvCell(value) {
    let text = String(value === null || value === undefined ? '' : value);
    if (/^[=+\-@]/.test(text)) text = "'" + text;
    if (/[",\r\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
    return text;
  }

  function exportReportsCsv() {
    if (!state.reports.length) {
      toast('info', 'Belum ada data', 'Buat laporan terlebih dahulu sebelum mengunduh CSV.');
      return;
    }
    const rows = [
      ['Kode', 'Tanggal', 'Jenis', 'Berat (kg)', 'Lokasi', 'Status', 'Deskripsi']
    ];
    state.reports.forEach((report) => {
      rows.push([
        report.code,
        report.date,
        typeMeta(report.type).label,
        String(report.weight),
        report.location,
        statusMeta(report.status).label,
        report.description || ''
      ]);
    });
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'smartwaste-laporan-' + D.todayISO() + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('success', 'CSV berhasil diunduh', rows.length - 1 + ' laporan diekspor. File memuat seluruh laporanmu, bukan hanya hasil filter.');
  }

  /* -------------------------------------------------------------- report detail */
  function evidenceBadge(status) {
    const meta = {
      disetujui: { label: EVIDENCE_LABEL.disetujui, cls: 'done' },
      menunggu_pemeriksaan: { label: EVIDENCE_LABEL.menunggu_pemeriksaan, cls: 'pending' },
      ditolak: { label: EVIDENCE_LABEL.ditolak, cls: 'rejected' }
    }[status] || { label: EVIDENCE_LABEL[status] || status || '—', cls: 'cancelled' };
    return '<span class="badge badge--' + meta.cls + '">' + esc(meta.label) + '</span>';
  }

  function photoFigureHTML(report, kind, label) {
    const src = report.photos ? report.photos[kind] : null;
    if (!src) return '';
    return '<figure class="photo-card">' +
      '<button type="button" class="photo-open" data-action="view-photo" data-report="' + esc(report.id) + '" data-kind="' + kind + '" aria-label="Perbesar ' + esc(label) + '">' +
        '<img src="' + esc(src) + '" alt="' + esc(label + ' laporan ' + report.code) + '" loading="lazy">' +
      '</button>' +
      '<figcaption><strong>' + esc(label) + '</strong><span>' + icon('image') + '</span></figcaption>' +
    '</figure>';
  }

  function timelineIcon(status) {
    if (status === 'selesai') return 'check-circle';
    if (status === 'ditolak') return 'x-circle';
    if (status === 'dibatalkan_warga') return 'info';
    if (status === 'diangkut') return 'truck';
    if (status === 'ditugaskan' || status === 'diproses') return 'user';
    return 'clock';
  }

  function detailView(reportId) {
    const report = state.reports.find((r) => r.id === reportId);
    if (!report) {
      return '<div class="detail-head"><a class="breadcrumb" href="#/riwayat">' + icon('arrow-left') + ' Riwayat laporan</a>' +
        '<h2 style="font-size:24px;font-weight:800;letter-spacing:-.035em">Detail laporan</h2></div>' +
        '<section class="card"><div class="empty-state"><span class="empty-art">' + icon('search') + '</span>' +
        '<h4>Laporan tidak ditemukan</h4><p>Laporan ini tidak tersedia atau bukan milik akunmu.</p>' +
        '<a class="btn btn--primary btn--sm" href="#/riwayat">Kembali ke riwayat</a></div></section>';
    }
    const type = typeMeta(report.type);
    const meta = statusMeta(report.status);
    const canModify = report.status === 'menunggu_verifikasi';
    const hasPhotos = Boolean(report.photos && (report.photos.initial || report.photos.location || report.photos.completion));
    const ops = report.ops;
    const hasOps = ops && (ops.officer || ops.vehicle || ops.tpa);
    const history = report.history || [];
    const timeline = history.map((entry, index) => {
      const entryMeta = statusMeta(entry.status);
      const latest = index === history.length - 1;
      const bad = entry.status === 'ditolak' || entry.status === 'dibatalkan_warga';
      return '<div class="timeline-item' + (latest ? ' is-latest' : '') + (bad ? ' is-bad' : '') + '">' +
        '<span class="timeline-dot">' + icon(timelineIcon(entry.status)) + '</span>' +
        '<div class="timeline-content">' +
          '<div class="timeline-top"><strong>' + esc(entryMeta.label) + '</strong>' +
          '<span class="timeline-time">' + esc(fmtTimestamp(entry.at)) + '</span></div>' +
          '<p class="timeline-note">' + esc(entry.note) + '</p>' +
          '<span class="timeline-by">Dicatat oleh ' + esc(entry.by || 'Sistem') + '</span>' +
        '</div></div>';
    }).join('');
    const opsRows = hasOps ? [
      ops.officer ? '<div class="ops-row"><span class="ops-ic">' + icon('user') + '</span><span class="ops-text"><span>Petugas</span><strong>' + esc(ops.officer) + '</strong></span></div>' : '',
      ops.vehicle ? '<div class="ops-row"><span class="ops-ic">' + icon('truck') + '</span><span class="ops-text"><span>Kendaraan' + (ops.vehicleNote ? ' · ' + esc(ops.vehicleNote) : '') + '</span><strong>' + esc(ops.vehicle) + '</strong></span></div>' : '',
      ops.tpa ? '<div class="ops-row"><span class="ops-ic">' + icon('building') + '</span><span class="ops-text"><span>Tujuan TPA</span><strong>' + esc(ops.tpa) + '</strong></span></div>' : ''
    ].join('') : '';

    return '<div class="detail-head">' +
      '<a class="breadcrumb" href="#/riwayat">' + icon('arrow-left') + ' Riwayat laporan</a>' +
      '<div class="detail-title-row">' +
        '<div><h2>Detail laporan</h2>' +
          '<div class="detail-code-row"><span class="detail-code">' + esc(report.code) + '</span>' + statusBadge(report.status, 'badge--lg') +
          '<span class="muted" style="font-size:10.5px">Dikirim ' + esc(fmtTimestamp(report.createdAt)) + '</span></div>' +
        '</div>' +
        '<div class="detail-actions">' +
          (canModify ? '<button type="button" class="btn btn--ghost" data-action="edit-report" data-id="' + esc(report.id) + '">' + icon('edit') + ' Edit</button>' +
            '<button type="button" class="btn btn--danger" data-action="cancel-report" data-id="' + esc(report.id) + '">' + icon('x-circle') + ' Batalkan</button>' : '') +
          '<a class="btn btn--soft" href="#/riwayat">Kembali</a>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="detail-grid">' +
      '<div class="detail-col">' +
        '<section class="card detail-progress-card">' +
          '<div class="detail-progress-top"><div><h3>Progres penanganan</h3><p>Terakhir diperbarui ' + esc(timeAgo(report.updatedAt)) + '</p></div>' +
          '<span class="chip chip--mint">' + icon('shield') + ' Status API</span></div>' +
          stepperHTML(report, true) +
          terminalBannerHTML(report) +
          '<div class="detail-metrics">' +
            '<div class="detail-metric"><span>Tahap saat ini</span><strong>' + esc(meta.stageLabel) + '</strong><small>' + esc(meta.label) + '</small></div>' +
            '<div class="detail-metric"><span>Berat laporan</span><strong>' + fmtKg(report.weight) + '</strong><small>Perkiraan dari warga</small></div>' +
            '<div class="detail-metric"><span>Tanggal laporan</span><strong>' + esc(fmtDate(report.date, { year: false })) + '</strong><small>' + esc(String(new Date(report.date + 'T00:00:00').getFullYear())) + '</small></div>' +
          '</div>' +
        '</section>' +
        (hasPhotos ? '<section class="card">' +
          '<div class="card-head"><div><h3 class="card-title">Foto &amp; bukti</h3><p class="card-sub">Lampiran kondisi awal dan bukti penanganan dari petugas.</p></div></div>' +
          '<div class="photo-grid">' +
            photoFigureHTML(report, 'initial', 'Foto kondisi awal') +
            photoFigureHTML(report, 'location', 'Bukti lokasi') +
            photoFigureHTML(report, 'completion', 'Foto penyelesaian') +
          '</div></section>' : '') +
        '<section class="card">' +
          '<div class="card-head"><div><h3 class="card-title">Riwayat status</h3><p class="card-sub">Catatan dan pembaruan dari sistem serta petugas.</p></div>' +
          '<span class="chip">' + history.length + ' pembaruan</span></div>' +
          '<div class="timeline">' + timeline + '</div>' +
        '</section>' +
      '</div>' +
      '<div class="detail-col">' +
        '<section class="card">' +
          '<div class="card-head"><div><h3 class="card-title">Informasi laporan</h3></div></div>' +
          '<div class="info-list">' +
            '<div class="info-row"><span class="info-label">Jenis sampah</span><span class="info-value">' + esc(type.label) + '</span></div>' +
            '<div class="info-row"><span class="info-label">Berat perkiraan</span><span class="info-value">' + fmtKg(report.weight) + '</span></div>' +
            '<div class="info-row"><span class="info-label">Tanggal</span><span class="info-value">' + esc(fmtDateLong(report.date)) + '</span></div>' +
            '<div class="info-row"><span class="info-label">Lokasi</span><span class="info-value">' + esc(report.location) + '</span></div>' +
          '</div>' +
          '<div class="info-block"><span>Deskripsi warga</span><p class="' + (report.description ? '' : 'muted') + '">' + esc(report.description || 'Tidak ada deskripsi tambahan.') + '</p></div>' +
        '</section>' +
        '<section class="card">' +
          '<div class="card-head"><div><h3 class="card-title">Penanganan lapangan</h3><p class="card-sub">Data dari aplikasi operasional petugas.</p></div></div>' +
          (hasOps ? '<div>' + opsRows + '</div>' : '<div class="empty-mini">' + icon('truck') + '<p>' + (report.status === 'menunggu_verifikasi' ? 'Belum ada penugasan. Informasi petugas tampil setelah laporan diverifikasi.' : 'Belum ada data petugas atau armada untuk laporan ini.') + '</p></div>') +
          (report.evidence ? '<div class="info-row" style="margin-top:10px;border-top:1px solid var(--line-2);padding-top:12px"><span class="info-label">Status bukti</span><span class="info-value">' + evidenceBadge(report.evidence.status) + '</span></div>' : '') +
        '</section>' +
        '<section class="card">' +
          '<div class="card-head"><div><h3 class="card-title">Butuh bantuan?</h3></div></div>' +
          '<p class="card-sub" style="margin:0 0 12px">Pelajari cara memantau progres, mengoreksi laporan, dan mengunduh data.</p>' +
          '<button type="button" class="btn btn--ghost btn--block btn--sm" data-action="open-help">' + icon('help') + ' Buka panduan</button>' +
        '</section>' +
      '</div>' +
    '</div>';
  }

  function openPhotoModal(reportId, kind) {
    const report = state.reports.find((r) => r.id === reportId);
    if (!report || !report.photos) return;
    const src = report.photos[kind];
    if (!src) return;
    const labels = { initial: 'Foto kondisi awal', location: 'Bukti lokasi', completion: 'Foto penyelesaian' };
    const label = labels[kind] || 'Foto laporan';
    openModal('<div class="modal modal--wide" role="dialog" aria-modal="true" aria-labelledby="photoModalTitle">' +
      '<div class="modal-head"><div><h2 id="photoModalTitle">' + esc(label) + '</h2>' +
      '<p>' + esc(typeMeta(report.type).label + ' · ' + report.code + ' · ' + fmtDate(report.date)) + '</p></div>' +
      '<button type="button" class="modal-close" data-action="close-modal" aria-label="Tutup foto">' + icon('x') + '</button></div>' +
      '<div class="modal-body"><img class="photo-full" src="' + esc(src) + '" alt="' + esc(label + ' laporan ' + report.code) + '"></div>' +
    '</div>');
  }

  /* -------------------------------------------------------------- create report */
  function draftKey() { return DRAFT_PREFIX + (state.user ? state.user.id : 'anon'); }

  function readDraft() {
    try {
      const raw = sessionStorage.getItem(draftKey());
      if (!raw) return null;
      const draft = JSON.parse(raw);
      if (!draft || typeof draft !== 'object') return null;
      return draft;
    } catch (e) { return null; }
  }
  function clearDraft() {
    try { sessionStorage.removeItem(draftKey()); } catch (e) { /* ignore */ }
  }

  function photoFieldHTML() {
    if (state.pendingPhoto) {
      const name = state.pendingPhoto.name || 'foto-kondisi-awal.jpg';
      return '<div class="dropzone is-filled" id="photoDrop">' +
        '<div class="photo-preview">' +
          '<img src="' + esc(state.pendingPhoto.data) + '" alt="Pratinjau foto kondisi awal">' +
          '<div class="photo-preview-bar">' +
            '<span class="photo-name" title="' + esc(name) + '">' + esc(name) + '</span>' +
            '<div class="photo-preview-actions">' +
              '<label class="btn btn--ghost btn--sm photo-source">Pilih foto' +
                '<input type="file" id="photoInput" accept="image/jpeg,image/png,image/webp" class="sr-only" aria-label="Pilih foto lain dari perangkat">' +
              '</label>' +
              '<button type="button" class="btn btn--ghost btn--sm photo-source" data-action="open-report-camera">Ambil ulang</button>' +
              '<button type="button" class="btn btn--danger btn--sm" data-action="remove-photo">' + icon('trash') + ' Hapus</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }
    return '<div class="dropzone" id="photoDrop" tabindex="-1">' +
      '<span class="dropzone-icon">' + icon('camera') + '</span>' +
      '<strong>Tambahkan foto laporan</strong>' +
      '<p>Pilih foto dari perangkat atau ambil langsung dengan kamera.<br>JPG, PNG, atau WebP · maksimal 5 MB.</p>' +
      '<div class="photo-source-actions">' +
        '<label class="btn btn--ghost btn--sm photo-source">Pilih foto' +
          '<input type="file" id="photoInput" accept="image/jpeg,image/png,image/webp" class="sr-only" aria-label="Pilih foto dari perangkat">' +
        '</label>' +
        '<button type="button" class="btn btn--ghost btn--sm photo-source" data-action="open-report-camera">Ambil foto</button>' +
      '</div>' +
    '</div>';
  }

  function setCameraStatus(message, isError) {
    const status = $('#cameraStatus');
    if (!status) return;
    status.textContent = message;
    status.hidden = !message;
    status.classList.toggle('is-error', Boolean(isError));
  }

  function cameraErrorMessage(error) {
    if (error && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) {
      return 'Akses kamera ditolak. Izinkan kamera untuk halaman ini, lalu coba lagi.';
    }
    if (error && (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError')) {
      return 'Kamera tidak ditemukan pada perangkat ini. Kamu masih bisa memilih foto dari perangkat.';
    }
    if (error && (error.name === 'NotReadableError' || error.name === 'TrackStartError')) {
      return 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.';
    }
    return 'Kamera tidak dapat dibuka. Kamu masih bisa memilih foto dari perangkat.';
  }

  async function openReportCamera() {
    const requestId = ++state.cameraRequestId;
    openModal('<div class="modal modal--camera" role="dialog" aria-modal="true" aria-labelledby="cameraModalTitle">' +
      '<div class="modal-head"><div><h2 id="cameraModalTitle">Ambil foto</h2><p>Arahkan kamera ke kondisi sampah yang ingin dilaporkan.</p></div>' +
        '<button type="button" class="modal-close" data-action="close-modal" aria-label="Tutup kamera">' + icon('x') + '</button></div>' +
      '<div class="modal-body camera-modal-body">' +
        '<div class="camera-stage"><video id="reportCameraVideo" autoplay playsinline muted></video>' +
          '<div class="camera-status" id="cameraStatus">Mengaktifkan kamera…</div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-foot"><button type="button" class="btn btn--ghost" data-action="close-modal">Batal</button>' +
        '<button type="button" class="btn btn--primary" id="cameraCapture" data-action="capture-report-photo" disabled>Ambil foto</button></div>' +
    '</div>');

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      setCameraStatus('Browser ini tidak menyediakan akses kamera. Pilih foto dari perangkat.', true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });
      if (!state.modalOpen || requestId !== state.cameraRequestId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      state.cameraStream = stream;
      const video = $('#reportCameraVideo');
      if (!video) {
        closeModal();
        return;
      }
      video.srcObject = stream;
      await video.play();
      if (!video.videoWidth) {
        await new Promise((resolve, reject) => {
          video.addEventListener('loadeddata', resolve, { once: true });
          video.addEventListener('error', () => reject(new Error('Kamera tidak dapat menampilkan gambar.')), { once: true });
        });
      }
      if (!state.modalOpen || requestId !== state.cameraRequestId) return;
      setCameraStatus('', false);
      const capture = $('#cameraCapture');
      if (capture) capture.disabled = false;
    } catch (error) {
      if (!state.modalOpen || requestId !== state.cameraRequestId) return;
      if (state.cameraStream) {
        state.cameraStream.getTracks().forEach((track) => track.stop());
        state.cameraStream = null;
      }
      setCameraStatus(cameraErrorMessage(error), true);
    }
  }

  function captureReportPhoto() {
    const video = $('#reportCameraVideo');
    if (!state.cameraStream || !video || !video.videoWidth || !video.videoHeight) {
      setCameraStatus('Kamera belum siap. Tunggu sebentar lalu coba lagi.', true);
      return;
    }
    try {
      const scale = Math.min(1, 1400 / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Tidak dapat menyiapkan foto kamera.');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL('image/jpeg', 0.78);
      state.pendingPhoto = { data, name: 'foto-kondisi-awal.jpg' };
      state.photoError = '';
      closeModal();
      renderPhotoField();
      toast('success', 'Foto siap dipakai', 'Foto dari kamera sudah ditambahkan ke laporan.');
    } catch (error) {
      setCameraStatus('Foto gagal diambil. Coba lagi atau pilih foto dari perangkat.', true);
    }
  }

  function updatePhotoHint() {
    const hint = $('#photoHint');
    if (!hint) return;
    hint.classList.remove('is-error', 'is-ok');
    if (state.photoError) {
      hint.classList.add('is-error');
      hint.textContent = state.photoError;
    } else if (state.pendingPhoto) {
      hint.classList.add('is-ok');
      hint.textContent = 'Foto siap dikirim. Kamu masih bisa mengganti atau menghapusnya sebelum mengirim.';
    } else {
      hint.textContent = 'Wajib. Foto yang jelas membantu petugas memverifikasi laporan.';
    }
  }

  function renderPhotoField() {
    const wrap = $('#photoField');
    if (!wrap) return;
    wrap.innerHTML = photoFieldHTML();
    hydrateIcons(wrap);
    updatePhotoHint();
    bindPhotoDrop();
  }

  function draftStatusLabel(saved) {
    const el = $('#draftStatus');
    if (!el) return;
    el.textContent = saved
      ? 'Draft teks tersimpan otomatis pukul ' + fmtClock(new Date()) + '.'
      : 'Draft teks tersimpan sementara di browser ini.';
  }

  function saveDraftNow() {
    const form = $('#createReportForm');
    if (!form) return;
    const fd = new FormData(form);
    const draft = {
      type: fd.get('type') || '',
      weight: fd.get('weight') === null ? '' : String(fd.get('weight')),
      location: String(fd.get('location') || ''),
      description: String(fd.get('description') || ''),
      date: String(fd.get('date') || ''),
      lat: state.coords ? state.coords.lat : null,
      lng: state.coords ? state.coords.lng : null,
      savedAt: Date.now()
    };
    const meaningful = !!(draft.type || draft.location.trim() || draft.description.trim() || draft.weight !== '');
    try {
      if (meaningful) sessionStorage.setItem(draftKey(), JSON.stringify(draft));
      else sessionStorage.removeItem(draftKey());
    } catch (e) { /* session storage may be unavailable */ }
    draftStatusLabel(meaningful);
  }

  function scheduleDraftSave() {
    if (state.draftTimer) clearTimeout(state.draftTimer);
    state.draftTimer = setTimeout(saveDraftNow, 450);
  }

  function updateCoordNote() {
    const note = $('#coordNote');
    if (!note) return;
    if (state.coords) {
      note.innerHTML = '<div class="coord-note">' + icon('map-pin') +
        ' Koordinat GPS ikut dikirim di lokasi laporan: ' + state.coords.lat.toFixed(5) + ', ' + state.coords.lng.toFixed(5) + '</div>';
    } else {
      note.innerHTML = '<p class="field-hint">Opsional. Izin lokasi dibutuhkan; koordinat membantu petugas menemukan titik.</p>';
    }
    hydrateIcons(note);
  }

  function newReportView() {
    const draft = readDraft();
    if (draft && !state.coords && (!draft.location || String(draft.location).startsWith('Koordinat GPS:')) &&
        Number.isFinite(draft.lat) && Number.isFinite(draft.lng)) {
      state.coords = { lat: draft.lat, lng: draft.lng };
    }
    const restored = Boolean(draft && (draft.type || (draft.location && draft.location.trim()) || (draft.description && draft.description.trim()) || (draft.weight !== undefined && String(draft.weight) !== '')));
    const value = {
      type: draft ? draft.type || '' : '',
      weight: draft && draft.weight !== undefined && draft.weight !== null ? draft.weight : '',
      location: draft ? draft.location || (state.coords
        ? 'Koordinat GPS: ' + state.coords.lat.toFixed(5) + ', ' + state.coords.lng.toFixed(5)
        : '') : '',
      description: draft ? draft.description || '' : '',
      date: draft && draft.date ? draft.date : D.todayISO()
    };
    return '<div class="page-head">' +
      '<div><a class="breadcrumb" href="#/ringkasan">' + icon('arrow-left') + ' Kembali ke ringkasan</a>' +
      '<h2>Buat laporan</h2><p>Ceritakan kondisi sampah yang kamu temui. Data ini masuk ke petugas untuk diverifikasi.</p></div>' +
    '</div>' +
    '<div class="form-layout">' +
      '<form class="card form-card" id="createReportForm" novalidate>' +
        '<div class="form-error" id="createError" role="alert" hidden></div>' +
        (restored ? '<div class="draft-banner">' + icon('info') + '<div><strong>Draft dipulihkan.</strong> Data teks dari sesi sebelumnya sudah diisi kembali. Foto perlu dipilih ulang.</div></div>' : '') +
        '<section class="form-section">' +
          '<div class="form-section-head"><span class="step-num">01</span><div><h3>Detail sampah</h3><p>Pilih jenis dan lengkapi perkiraan beratnya.</p></div></div>' +
          '<div class="field">' +
            '<span class="field-label" id="typeLabel">Jenis sampah <span class="optional">Wajib</span></span>' +
            '<div class="type-picker" role="radiogroup" aria-labelledby="typeLabel">' +
              TYPES.map((type) => '<div class="type-option">' +
                '<input type="radio" id="type-' + type.id + '" name="type" value="' + type.id + '"' + (value.type === type.id ? ' checked' : '') + '>' +
                '<label for="type-' + type.id + '">' + icon(type.icon) + '<span>' + esc(type.label) + '</span></label>' +
              '</div>').join('') +
            '</div>' +
            '<p class="field-hint" id="typeError" hidden></p>' +
          '</div>' +
          '<div class="field-grid">' +
            '<div class="field">' +
              '<div class="label-row"><label for="fWeight">Perkiraan berat <span class="optional">Opsional</span></label></div>' +
              '<div class="input-wrap weight-wrap"><input class="input" id="fWeight" name="weight" type="number" inputmode="decimal" min="0" max="100000" step="0.1" placeholder="Contoh: 12,5" value="' + esc(value.weight) + '" style="padding-right:48px"><span class="weight-unit">kg</span></div>' +
              '<p class="field-hint" data-for="fWeight" hidden></p>' +
              '<p class="field-hint">Kosongkan jika tidak tahu — dihitung 0 kg.</p>' +
            '</div>' +
            '<div class="field">' +
              '<div class="label-row"><label for="fDate">Tanggal laporan</label></div>' +
              '<input class="input" id="fDate" name="date" type="date" value="' + esc(value.date) + '" required>' +
              '<p class="field-hint" data-for="fDate" hidden></p>' +
            '</div>' +
          '</div>' +
        '</section>' +
        '<section class="form-section">' +
          '<div class="form-section-head"><span class="step-num">02</span><div><h3>Lokasi kejadian</h3><p>Tulis lokasi yang mudah ditemukan petugas.</p></div></div>' +
          '<div class="field">' +
            '<label for="fLocation">Lokasi kejadian <span class="optional">Wajib</span></label>' +
            '<div class="location-field">' +
              '<input class="input" id="fLocation" name="location" type="text" placeholder="Contoh: Jl. Cikini Raya No. 24, Jakarta Pusat" value="' + esc(value.location) + '" required>' +
              '<button type="button" class="btn btn--ghost" data-action="use-location">' + icon('map-pin') + ' Lokasi saya</button>' +
            '</div>' +
            '<p class="field-hint" data-for="fLocation" hidden></p>' +
            '<div id="coordNote"></div>' +
          '</div>' +
        '</section>' +
        '<section class="form-section">' +
          '<div class="form-section-head"><span class="step-num">03</span><div><h3>Foto kondisi awal</h3><p>Lampirkan foto agar laporan bisa diverifikasi.</p></div></div>' +
          '<div class="field">' +
            '<div class="label-row"><span class="field-label">Foto kondisi awal <span class="optional">Wajib</span></span><span class="field-hint" style="margin:0">Maks. 5 MB</span></div>' +
            '<div id="photoField">' + photoFieldHTML() + '</div>' +
            '<p class="field-hint" id="photoHint"></p>' +
          '</div>' +
        '</section>' +
        '<section class="form-section">' +
          '<div class="form-section-head"><span class="step-num">04</span><div><h3>Deskripsi singkat</h3><p>Tambahan informasi yang membantu petugas.</p></div></div>' +
          '<div class="field">' +
            '<label for="fDescription">Deskripsi <span class="optional">Opsional</span></label>' +
            '<textarea class="input" id="fDescription" name="description" rows="3" placeholder="Contoh: Tumpukan botol plastik di pinggir jalan, menutup sebagian saluran air.">' + esc(value.description) + '</textarea>' +
          '</div>' +
        '</section>' +
        '<div class="form-actions">' +
          '<span class="form-actions-note">' + icon('shield') + ' Hanya petugas yang menangani laporanmu yang dapat melihat data ini.</span>' +
          '<div class="form-actions-btns">' +
            '<a class="btn btn--ghost" href="#/ringkasan">Batal</a>' +
            '<button type="submit" class="btn btn--primary" id="createSubmit">' + icon('arrow-right') + ' Kirim laporan</button>' +
          '</div>' +
        '</div>' +
      '</form>' +
      '<aside class="form-aside">' +
        '<div class="tip-card">' +
          '<h3>Agar laporan cepat ditangani</h3>' +
          '<p>Petugas memakai detail laporanmu untuk menemukan titik sampah.</p>' +
          '<div class="tip-list">' +
            '<div class="tip-item"><span class="tip-ic">' + icon('camera') + '</span><div><strong>Foto dengan cahaya cukup</strong><p>Tampakkan tumpukan sampah dan bangunan di sekitarnya.</p></div></div>' +
            '<div class="tip-item"><span class="tip-ic">' + icon('map-pin') + '</span><div><strong>Lokasi yang spesifik</strong><p>Sertakan nama jalan, nomor, atau patokan yang mudah dikenali.</p></div></div>' +
            '<div class="tip-item"><span class="tip-ic">' + icon('edit') + '</span><div><strong>Laporan masih bisa dikoreksi</strong><p>Edit atau batalkan selama status masih menunggu verifikasi.</p></div></div>' +
          '</div>' +
        '</div>' +
        '<div class="privacy-note">' + icon('shield') + '<span>Foto dan lokasi hanya dipakai untuk penanganan sampah serta dipantau melalui API resmi Smart Waste.</span></div>' +
        '<div class="privacy-note">' + icon('edit') + '<span id="draftStatus">Draft teks tersimpan sementara di browser ini.</span></div>' +
      '</aside>' +
    '</div>';
  }

  function bindCreateForm() {
    const form = $('#createReportForm');
    if (!form) return;
    form.addEventListener('submit', submitCreateReport);
    updateCoordNote();
    updatePhotoHint();
    bindPhotoDrop();
    const date = $('#fDate');
    if (date && !date.value) date.value = D.todayISO();
  }

  function bindPhotoDrop() {
    const drop = $('#photoDrop');
    if (!drop) return;
    drop.addEventListener('dragover', (event) => {
      if (state.pendingPhoto) return;
      event.preventDefault();
      drop.classList.add('is-drag');
    });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-drag'));
    drop.addEventListener('drop', (event) => {
      if (state.pendingPhoto) return;
      event.preventDefault();
      drop.classList.remove('is-drag');
      const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      if (file) handlePhotoFile(file);
    });
  }

  function compressImage(file, maxDimension, quality) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        try {
          const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(objectUrl);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (err) {
          URL.revokeObjectURL(objectUrl);
          reject(err);
        }
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Foto tidak dapat dibaca.'));
      };
      image.src = objectUrl;
    });
  }

  async function handlePhotoFile(file) {
    const check = D.isValidPhotoFile(file);
    if (!check.ok) {
      state.photoError = check.message;
      renderPhotoField();
      toast('error', 'Foto belum sesuai', check.message);
      return;
    }
    state.photoError = '';
    const hint = $('#photoHint');
    if (hint) hint.textContent = 'Memproses foto…';
    try {
      const dataUrl = await compressImage(file, 1400, 0.78);
      state.pendingPhoto = { data: dataUrl, name: file.name };
      renderPhotoField();
    } catch (err) {
      state.photoError = 'Foto gagal diproses. Coba pilih file lain.';
      renderPhotoField();
      toast('error', 'Foto gagal diproses', 'Coba gunakan file JPG atau PNG lain.');
    }
  }

  function removePhoto() {
    state.pendingPhoto = null;
    state.photoError = '';
    renderPhotoField();
  }

  function useMyLocation(button) {
    if (!navigator.geolocation) {
      toast('error', 'Lokasi tidak didukung', 'Browser ini tidak menyediakan fitur lokasi.');
      return;
    }
    setButtonLoading(button, true, 'Mencari…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setButtonLoading(button, false);
        state.coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        const locationField = $('#fLocation');
        if (locationField) {
          locationField.value = 'Koordinat GPS: ' + state.coords.lat.toFixed(5) + ', ' + state.coords.lng.toFixed(5);
          locationField.dispatchEvent(new Event('input', { bubbles: true }));
        }
        updateCoordNote();
        scheduleDraftSave();
        toast('success', 'Lokasi ditemukan', 'Koordinat GPS ditulis ke lokasi laporan agar petugas dapat melihatnya.');
      },
      (error) => {
        setButtonLoading(button, false);
        const message = error && error.code === 1
          ? 'Izin lokasi ditolak. Kamu tetap bisa menulis lokasi secara manual.'
          : 'Lokasi tidak dapat diambil. Periksa koneksi atau izin lokasi browser.';
        toast('error', 'Lokasi tidak tersedia', message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  function showFieldError(field, message, hintId) {
    const input = document.getElementById(field);
    if (input) input.setAttribute('aria-invalid', 'true');
    const hint = hintId ? document.getElementById(hintId) : $('[data-for="' + field + '"]');
    if (hint) {
      hint.hidden = false;
      hint.classList.add('is-error');
      hint.textContent = message;
    }
  }
  function clearFieldError(input) {
    if (!input || !input.id) return;
    input.removeAttribute('aria-invalid');
    const hint = $('[data-for="' + input.id + '"]');
    if (hint) {
      hint.hidden = true;
      hint.textContent = '';
      hint.classList.remove('is-error');
    }
  }
  function showFormError(boxId, message) {
    const box = document.getElementById(boxId);
    if (!box) return;
    box.hidden = false;
    box.innerHTML = icon('alert-triangle') + '<span>' + esc(message) + '</span>';
  }
  function clearFormError(boxId) {
    const box = document.getElementById(boxId);
    if (box) { box.hidden = true; box.innerHTML = ''; }
  }

  function collectCreatePayload(form) {
    const fd = new FormData(form);
    const rawWeight = fd.get('weight');
    return {
      type: fd.get('type') || '',
      weight: rawWeight === null || String(rawWeight).trim() === '' ? 0 : Number(rawWeight),
      location: String(fd.get('location') || '').trim(),
      date: String(fd.get('date') || ''),
      description: String(fd.get('description') || '').trim(),
      photo: state.pendingPhoto ? state.pendingPhoto.data : null
    };
  }

  async function submitCreateReport(event) {
    event.preventDefault();
    clearFormError('createError');
    const form = event.currentTarget;
    const payload = collectCreatePayload(form);
    ['fWeight', 'fDate', 'fLocation'].forEach((id) => {
      const input = document.getElementById(id);
      if (input) clearFieldError(input);
    });
    const typeError = $('#typeError');
    if (typeError) { typeError.hidden = true; typeError.textContent = ''; }
    state.photoError = '';
    updatePhotoHint();

    const problems = [];
    let focusTarget = null;
    if (!payload.type) {
      problems.push('jenis sampah');
      if (typeError) {
        typeError.hidden = false;
        typeError.textContent = 'Pilih salah satu jenis sampah.';
        typeError.classList.add('is-error');
      }
      focusTarget = focusTarget || $('#createReportForm input[name="type"]');
    }
    if (!payload.location) {
      problems.push('lokasi');
      showFieldError('fLocation', 'Lokasi kejadian wajib diisi.');
      focusTarget = focusTarget || $('#fLocation');
    }
    if (!payload.date) {
      problems.push('tanggal');
      showFieldError('fDate', 'Tanggal laporan wajib diisi.');
      focusTarget = focusTarget || $('#fDate');
    }
    if (!Number.isFinite(payload.weight) || payload.weight < 0 || payload.weight > 100000) {
      problems.push('perkiraan berat (0–100.000 kg)');
      showFieldError('fWeight', 'Masukkan berat antara 0 dan 100.000 kg.');
      focusTarget = focusTarget || $('#fWeight');
    }
    if (!state.pendingPhoto) {
      problems.push('foto kondisi awal');
      state.photoError = 'Foto kondisi awal wajib dilampirkan sebelum mengirim.';
      renderPhotoField();
      focusTarget = focusTarget || $('#photoDrop');
    }
    if (problems.length) {
      showFormError('createError', 'Lengkapi ' + problems.join(', ') + ' sebelum mengirim laporan.');
      const box = $('#createError');
      if (box) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (focusTarget) focusTarget.focus({ preventScroll: true });
      return;
    }

    const btn = $('#createSubmit');
    setButtonLoading(btn, true, 'Mengirim laporan…');
    try {
      const report = await API.createReport(state.user.id, payload);
      clearDraft();
      state.pendingPhoto = null;
      state.photoError = '';
      state.coords = null;
      state.selectedReportId = report.id;
      await refreshReports({ suppressStatusToast: true });
      toast('success', 'Laporan berhasil dikirim', report.code + ' berstatus Menunggu Verifikasi. Petugas akan memeriksa laporanmu.');
      location.hash = '#/ringkasan';
    } catch (err) {
      setButtonLoading(btn, false);
      showFormError('createError', err.message || 'Laporan gagal dikirim. Data yang kamu isi tetap tersimpan sebagai draft.');
      const box = $('#createError');
      if (box) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        state.online = false;
        state.lastError = 'Tidak ada koneksi internet. Laporan belum terkirim.';
        updateConnectivity();
      }
    }
  }

  /* -------------------------------------------------------------- edit / cancel */
  function typePickerHTML(selected, prefix) {
    return '<div class="type-picker" role="radiogroup" aria-label="Jenis sampah">' +
      TYPES.map((type) => '<div class="type-option">' +
        '<input type="radio" id="' + prefix + '-type-' + type.id + '" name="type" value="' + type.id + '"' + (selected === type.id ? ' checked' : '') + '>' +
        '<label for="' + prefix + '-type-' + type.id + '">' + icon(type.icon) + '<span>' + esc(type.label) + '</span></label>' +
      '</div>').join('') + '</div>';
  }

  function openEditModal(reportId) {
    const report = state.reports.find((r) => r.id === reportId);
    if (!report) { toast('error', 'Laporan tidak ditemukan', 'Muat ulang data lalu coba lagi.'); return; }
    if (report.status !== 'menunggu_verifikasi') {
      toast('info', 'Tidak dapat diedit', 'Hanya laporan menunggu verifikasi yang bisa diubah.');
      return;
    }
    openModal('<div class="modal modal--wide" role="dialog" aria-modal="true" aria-labelledby="editModalTitle">' +
      '<div class="modal-head"><div><h2 id="editModalTitle">Edit laporan</h2><p>' + esc(report.code) + ' · Foto awal tidak diganti dari form ini.</p></div>' +
      '<button type="button" class="modal-close" data-action="close-modal" aria-label="Tutup form edit">' + icon('x') + '</button></div>' +
      '<form id="editReportForm" novalidate>' +
        '<div class="modal-body">' +
          '<div class="form-error" id="editError" role="alert" hidden></div>' +
          '<div class="field"><span class="field-label">Jenis sampah</span>' + typePickerHTML(report.type, 'edit') + '</div>' +
          '<div class="field-grid">' +
            '<div class="field"><label for="editWeight">Perkiraan berat</label><div class="input-wrap weight-wrap">' +
              '<input class="input" id="editWeight" name="weight" type="number" inputmode="decimal" min="0" max="100000" step="0.1" value="' + esc(report.weight) + '" style="padding-right:48px"><span class="weight-unit">kg</span></div></div>' +
            '<div class="field"><label for="editDate">Tanggal laporan</label>' +
              '<input class="input" id="editDate" name="date" type="date" value="' + esc(report.date) + '"></div>' +
          '</div>' +
          '<div class="field"><label for="editLocation">Lokasi kejadian</label>' +
            '<input class="input" id="editLocation" name="location" type="text" value="' + esc(report.location) + '"></div>' +
          '<div class="field"><label for="editDescription">Deskripsi <span class="optional">Opsional</span></label>' +
            '<textarea class="input" id="editDescription" name="description" rows="3">' + esc(report.description || '') + '</textarea></div>' +
          '<div class="privacy-note">' + icon('info') + '<span>Perubahan hanya dapat dilakukan selama laporan belum diverifikasi petugas.</span></div>' +
        '</div>' +
        '<div class="modal-foot">' +
          '<button type="button" class="btn btn--ghost" data-action="close-modal">Batal</button>' +
          '<button type="submit" class="btn btn--primary" id="editSubmit">Simpan perubahan</button>' +
        '</div>' +
      '</form></div>');
    const form = $('#editReportForm');
    if (form) form.addEventListener('submit', (event) => submitEditReport(event, report));
  }

  async function submitEditReport(event, report) {
    event.preventDefault();
    clearFormError('editError');
    const form = event.currentTarget;
    const fd = new FormData(form);
    const type = fd.get('type');
    const weight = String(fd.get('weight') || '').trim() === '' ? 0 : Number(fd.get('weight'));
    const date = String(fd.get('date') || '');
    const location = String(fd.get('location') || '').trim();
    const description = String(fd.get('description') || '').trim();
    ['editWeight', 'editDate', 'editLocation'].forEach((id) => {
      const input = document.getElementById(id);
      if (input) input.removeAttribute('aria-invalid');
    });
    if (!type) { showFormError('editError', 'Pilih jenis sampah terlebih dahulu.'); return; }
    if (!location) {
      showFormError('editError', 'Lokasi kejadian wajib diisi.');
      $('#editLocation').setAttribute('aria-invalid', 'true');
      $('#editLocation').focus();
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      showFormError('editError', 'Tanggal laporan wajib diisi.');
      $('#editDate').setAttribute('aria-invalid', 'true');
      $('#editDate').focus();
      return;
    }
    if (!Number.isFinite(weight) || weight < 0 || weight > 100000) {
      showFormError('editError', 'Perkiraan berat harus antara 0 dan 100.000 kg.');
      $('#editWeight').setAttribute('aria-invalid', 'true');
      $('#editWeight').focus();
      return;
    }
    const btn = $('#editSubmit');
    setButtonLoading(btn, true, 'Menyimpan…');
    try {
      await API.updateReport(state.user.id, report.id, {
        type, weight, date, location, description
      });
      closeModal();
      await refreshReports({ suppressStatusToast: true });
      renderRoute();
      toast('success', 'Laporan diperbarui', 'Perubahan disimpan dan masih menunggu verifikasi petugas.');
    } catch (err) {
      setButtonLoading(btn, false);
      showFormError('editError', err.message || 'Perubahan gagal disimpan. Coba lagi.');
    }
  }

  function openCancelModal(reportId) {
    const report = state.reports.find((r) => r.id === reportId);
    if (!report) { toast('error', 'Laporan tidak ditemukan', 'Muat ulang data lalu coba lagi.'); return; }
    if (report.status !== 'menunggu_verifikasi') {
      toast('info', 'Tidak dapat dibatalkan', 'Hanya laporan menunggu verifikasi yang bisa dibatalkan.');
      return;
    }
    openModal('<div class="modal" role="dialog" aria-modal="true" aria-labelledby="cancelModalTitle">' +
      '<div class="modal-head"><div><span class="modal-icon is-danger">' + icon('x-circle') + '</span>' +
      '<h2 id="cancelModalTitle">Batalkan laporan?</h2><p>' + esc(report.code) + ' · ' + esc(typeMeta(report.type).label) + '</p></div>' +
      '<button type="button" class="modal-close" data-action="close-modal" aria-label="Tutup konfirmasi">' + icon('x') + '</button></div>' +
      '<div class="modal-body">' +
        '<p class="confirm-copy">Laporan <strong>' + esc(report.code) + '</strong> akan berstatus <strong>Dibatalkan warga</strong>. Petugas tidak akan menindaklanjuti laporan ini.</p>' +
        '<ul class="confirm-list">' +
          '<li>' + icon('check') + ' Data laporan tetap tersimpan di riwayat.</li>' +
          '<li>' + icon('check') + ' Foto dan deskripsi tidak dihapus.</li>' +
          '<li>' + icon('info') + ' Tindakan ini tidak bisa diurungkan.</li>' +
        '</ul>' +
        '<div class="form-error" id="cancelError" role="alert" hidden></div>' +
      '</div>' +
      '<div class="modal-foot">' +
        '<button type="button" class="btn btn--ghost" data-action="close-modal">Kembali</button>' +
        '<button type="button" class="btn btn--danger-solid" data-action="confirm-cancel" data-id="' + esc(report.id) + '">Ya, batalkan laporan</button>' +
      '</div></div>');
  }

  async function confirmCancelReport(button) {
    const reportId = button.dataset.id;
    clearFormError('cancelError');
    setButtonLoading(button, true, 'Membatalkan…');
    try {
      await API.cancelReport(state.user.id, reportId);
      closeModal();
      await refreshReports({ suppressStatusToast: true });
      renderRoute();
      toast('info', 'Laporan dibatalkan', 'Laporan tetap terlihat di riwayat dengan status Dibatalkan warga.');
    } catch (err) {
      setButtonLoading(button, false);
      showFormError('cancelError', err.message || 'Laporan gagal dibatalkan. Coba lagi.');
    }
  }

  /* -------------------------------------------------------------- profile */
  function profileView() {
    const user = state.user;
    const data = dashboardData();
    const written = state.reports.length;
    const completed = data.done;
    return '<div class="page-head">' +
      '<div><h2>Profil &amp; keamanan</h2><p>Kelola identitas akun, foto profil, dan password portal warga.</p></div>' +
    '</div>' +
    '<div class="profile-grid">' +
      '<section class="card profile-card">' +
        '<div class="profile-avatar-wrap">' +
          avatarHTML(user, 'avatar--lg profile-avatar') +
          '<button type="button" class="avatar-edit" data-action="upload-avatar" aria-label="Ganti foto profil" title="Ganti foto profil">' + icon('camera') + '</button>' +
          '<input type="file" id="avatarInput" accept="image/jpeg,image/png,image/webp" class="sr-only" aria-label="Pilih foto profil">' +
        '</div>' +
        '<h3>' + esc(user.name) + '</h3>' +
        '<p class="profile-username">@' + esc(user.username) + '</p>' +
        '<div class="profile-role"><span class="chip chip--mint">' + icon('user') + ' Akun warga</span></div>' +
        '<p class="profile-since">Bergabung sejak ' + esc(fmtDateLong(user.createdAt ? user.createdAt.slice(0, 10) : '')) + '</p>' +
        '<div class="profile-stats">' +
          '<div class="profile-stat"><strong>' + written + '</strong><span>Total laporan</span></div>' +
          '<div class="profile-stat"><strong>' + completed + '</strong><span>Laporan selesai</span></div>' +
        '</div>' +
        '<button type="button" class="btn btn--ghost btn--block btn--sm logout-btn" data-action="logout">' + icon('logout') + ' Keluar dari akun</button>' +
        '<p class="profile-tip">Foto profil JPG, PNG, atau WebP maksimal 5 MB. Username tidak dapat diubah karena dipakai untuk masuk.</p>' +
      '</section>' +
      '<div class="profile-col">' +
        '<section class="card">' +
          '<h3 class="profile-section-title">Informasi akun</h3>' +
          '<p class="profile-section-sub">Nama lengkap tampil pada ringkasan dan riwayat laporan.</p>' +
          '<form id="profileNameForm" novalidate>' +
            '<div class="profile-form-grid">' +
              '<div class="field"><label for="profileName">Nama lengkap</label><input class="input" id="profileName" name="name" type="text" value="' + esc(user.name) + '" autocomplete="name"></div>' +
              '<div class="field"><label for="profileUsername">Username</label><input class="input" id="profileUsername" type="text" value="' + esc(user.username) + '" disabled><p class="field-hint">Username tidak dapat diubah.</p></div>' +
            '</div>' +
            '<div class="form-error" id="profileNameError" role="alert" hidden></div>' +
            '<div class="profile-form-actions"><button type="submit" class="btn btn--primary" id="profileNameSubmit">Simpan perubahan</button></div>' +
          '</form>' +
        '</section>' +
        '<section class="card">' +
          '<h3 class="profile-section-title">Ganti password</h3>' +
          '<p class="profile-section-sub">Setelah password berhasil diganti, sesi diakhiri dan kamu harus masuk kembali.</p>' +
          '<form id="passwordForm" novalidate>' +
            '<div class="profile-form-grid">' +
              '<div class="field"><label for="currentPassword">Password lama</label><input class="input" id="currentPassword" name="current" type="password" autocomplete="current-password"></div>' +
              '<div class="field"><label for="newPassword">Password baru</label><input class="input" id="newPassword" name="next" type="password" autocomplete="new-password"><p class="field-hint">Minimal 8 karakter.</p></div>' +
              '<div class="field"><label for="confirmPassword">Konfirmasi password baru</label><input class="input" id="confirmPassword" name="confirm" type="password" autocomplete="new-password"></div>' +
            '</div>' +
            '<div class="form-error" id="passwordError" role="alert" hidden></div>' +
            '<div class="profile-form-actions"><button type="submit" class="btn btn--primary" id="passwordSubmit">Perbarui password</button></div>' +
          '</form>' +
        '</section>' +
      '</div>' +
    '</div>';
  }

  function bindProfileForms() {
    const nameForm = $('#profileNameForm');
    if (nameForm) nameForm.addEventListener('submit', saveProfileName);
    const passwordForm = $('#passwordForm');
    if (passwordForm) passwordForm.addEventListener('submit', saveNewPassword);
  }

  async function saveProfileName(event) {
    event.preventDefault();
    clearFormError('profileNameError');
    const name = $('#profileName').value.trim();
    if (name.length < 2) {
      showFormError('profileNameError', 'Nama lengkap minimal 2 karakter.');
      $('#profileName').focus();
      return;
    }
    const btn = $('#profileNameSubmit');
    setButtonLoading(btn, true, 'Menyimpan…');
    try {
      const updated = await API.updateProfile(state.user.id, { name });
      state.user = updated;
      paintChrome();
      renderRoute();
      toast('success', 'Nama diperbarui', 'Nama baru dipakai pada seluruh halaman portal.');
    } catch (err) {
      setButtonLoading(btn, false);
      showFormError('profileNameError', err.message || 'Perubahan gagal disimpan.');
    }
  }

  async function handleAvatarFile(file) {
    const check = D.isValidPhotoFile(file);
    if (!check.ok) {
      toast('error', 'Foto profil belum sesuai', check.message);
      return;
    }
    try {
      const avatar = await compressImage(file, 480, 0.82);
      const updated = await API.updateProfile(state.user.id, { avatar });
      state.user = updated;
      paintChrome();
      renderRoute();
      toast('success', 'Foto profil diperbarui', 'Foto baru langsung ditampilkan di portal.');
    } catch (err) {
      toast('error', 'Foto profil gagal diunggah', err.message || 'Coba pilih file lain.');
    }
  }

  async function saveNewPassword(event) {
    event.preventDefault();
    clearFormError('passwordError');
    const current = $('#currentPassword').value;
    const next = $('#newPassword').value;
    const confirm = $('#confirmPassword').value;
    if (!current) {
      showFormError('passwordError', 'Password lama wajib diisi.');
      $('#currentPassword').focus();
      return;
    }
    if (next.length < 8) {
      showFormError('passwordError', 'Password baru minimal 8 karakter.');
      $('#newPassword').focus();
      return;
    }
    if (next !== confirm) {
      showFormError('passwordError', 'Konfirmasi password baru tidak sama.');
      $('#confirmPassword').focus();
      return;
    }
    const btn = $('#passwordSubmit');
    setButtonLoading(btn, true, 'Memperbarui…');
    try {
      await API.changePassword(state.user.id, current, next);
      toast('success', 'Password berhasil diperbarui', 'Sesi diakhiri. Silakan masuk kembali dengan password baru.');
      setTimeout(() => { leaveApp(); }, 900);
    } catch (err) {
      setButtonLoading(btn, false);
      showFormError('passwordError', err.message || 'Password gagal diperbarui.');
    }
  }

  /* -------------------------------------------------------------- help / states */
  function openHelpModal() {
    openModal('<div class="modal modal--help" role="dialog" aria-modal="true" aria-labelledby="helpModalTitle">' +
      '<div class="modal-head"><div><span class="modal-icon">' + icon('help') + '</span><h2 id="helpModalTitle">Panduan singkat</h2>' +
      '<p>Hal penting saat mengirim dan memantau laporan sampah.</p></div>' +
      '<button type="button" class="modal-close" data-action="close-modal" aria-label="Tutup panduan">' + icon('x') + '</button></div>' +
      '<div class="modal-body"><div class="help-list">' +
        '<div class="help-article"><span class="help-ic">' + icon('camera') + '</span><div><strong>Foto kondisi awal</strong>' +
        '<p>Foto wajib JPG, PNG, atau WebP maksimal 5 MB. Ambil gambar dengan cahaya cukup, tampakkan tumpukan sampah dan patokan di sekitarnya. Foto dapat diganti sebelum laporan dikirim.</p></div></div>' +
        '<div class="help-article"><span class="help-ic">' + icon('edit') + '</span><div><strong>Edit dan batalkan laporan</strong>' +
        '<p>Tombol Edit dan Batalkan hanya tersedia saat laporan berstatus Menunggu Verifikasi. Setelah diverifikasi, hubungi petugas melalui aplikasi operasional. Pembatalan tidak menghapus data; status menjadi Dibatalkan warga.</p></div></div>' +
        '<div class="help-article"><span class="help-ic">' + icon('clock') + '</span><div><strong>Memantau progres</strong>' +
        '<p>Tahap yang ditampilkan: Diterima, Ditangani, Diangkut, dan Selesai. Status Ditolak atau Dibatalkan warga menjadi keadaan akhir tersendiri. Status mengikuti pembaruan yang dikirim petugas melalui aplikasi operasional.</p></div></div>' +
        '<div class="help-article"><span class="help-ic">' + icon('download') + '</span><div><strong>Riwayat dan ekspor</strong>' +
        '<p>Gunakan filter status, pencarian, dan rentang tanggal di halaman Riwayat. Unduh CSV memuat seluruh laporanmu, bukan hanya hasil filter yang terlihat.</p></div></div>' +
      '</div>' +
      '<div class="auth-note">Data operasional seperti petugas, kendaraan, TPA, dan bukti penanganan berasal dari aplikasi Android petugas. Portal hanya menampilkan data yang tersedia dari API.</div></div>' +
      '<div class="modal-foot"><button type="button" class="btn btn--primary" data-action="close-modal">Mengerti</button></div>' +
    '</div>');
  }

  function loadingTemplate() {
    return '<div class="page-head"><div><div class="skeleton" style="width:150px;height:24px"></div>' +
      '<div class="skeleton" style="width:300px;height:11px;margin-top:10px"></div></div></div>' +
      '<div class="kpi-grid">' +
        Array.from({ length: 4 }).map(() => '<div class="card loading-card"><div class="skeleton loading-row is-title"></div><div class="skeleton" style="height:30px;width:45%;margin-top:12px"></div><div class="skeleton loading-row" style="width:65%;margin-top:14px"></div></div>').join('') +
      '</div>' +
      '<div class="dash-trio">' +
        '<div class="card loading-card"><div class="skeleton loading-row is-title"></div><div class="skeleton" style="height:150px;border-radius:12px;margin-top:14px"></div></div>' +
        '<div class="card loading-card"><div class="skeleton loading-row is-title"></div><div class="skeleton loading-row"></div><div class="skeleton loading-row" style="width:70%"></div><div class="skeleton" style="height:90px;margin-top:16px;border-radius:12px"></div></div>' +
        '<div class="card loading-card"><div class="skeleton loading-row is-title"></div><div class="skeleton loading-row"></div><div class="skeleton loading-row"></div><div class="skeleton loading-row" style="width:60%"></div></div>' +
      '</div>' +
      '<div class="card loading-card" style="margin-top:16px"><div class="skeleton loading-row is-title"></div><div class="skeleton" style="height:150px;border-radius:12px"></div></div>';
  }

  function loadErrorTemplate(message) {
    return '<div class="page-head"><div><h2>Ringkasan</h2><p>Data belum dapat dimuat.</p></div></div>' +
      '<section class="card load-error"><div class="empty-state">' +
        '<span class="empty-art">' + icon('wifi-off') + '</span>' +
        '<h4>Koneksi ke server bermasalah</h4>' +
        '<p>' + esc(message || 'API tidak dapat dijangkau. Pastikan server berjalan dan koneksi internet tersedia.') + '</p>' +
        '<button type="button" class="btn btn--primary btn--sm" data-action="retry-connection">' + icon('refresh') + ' Coba lagi</button>' +
        '<p class="field-hint" style="margin-top:14px">Portal akan mencoba kembali saat koneksi pulih. Tekan Coba lagi untuk memuat data sekarang.</p>' +
      '</div></section>';
  }

  /* -------------------------------------------------------------- boot */
  function init() {
    hydrateIcons(document);
    hydrateArt(document);
    initAuth();
    bindChrome();
    // Require credentials each time the application is opened; do not restore
    // a persisted session straight into the dashboard.
    Session.clear();
    showAuthScreen();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
