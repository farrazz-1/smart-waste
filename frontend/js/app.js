/* Smart Waste — Portal Warga (Website / User) */
const API_HOST = window.location.hostname || "localhost";
const API =
  window.SMART_WASTE_API ||
  `http://${API_HOST}:8080/Waste2/backend-php/index.php`;
const TOKEN_KEY = "smartwaste_user_token";
const state = {
  user: null,
  reports: [],
  filter: "all",
  selectedProgressReportId: "",
  poll: null,
  loadError: "",
  hasLoadedData: false,
};
const reportPhotoState = { file: null, previewUrl: "" };
let reportCameraStream = null;
let reportCameraRequest = 0;
const profilePhotoState = { previewUrl: "" };
let reportDraftSaveTimer;
let restoredReportDraftKey = "";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function token() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function setConnectionStatus(status) {
  const pill = $("#connection-status");
  if (!pill) return;
  pill.dataset.state = status;
  $("#connection-label").textContent = {
    checking: "Menghubungkan",
    connected: "Terhubung",
    offline: "Belum terhubung",
  }[status] || "Terhubung";
}

function updateConnectionWarning() {
  const warning = $("#connection-warning");
  if (!warning) return;
  warning.hidden = !state.loadError;
  if (!state.loadError) return;
  $("#connection-warning-copy").textContent = state.hasLoadedData
    ? "Data terakhir masih ditampilkan, tetapi belum berhasil diperbarui."
    : "Data belum berhasil dimuat. Periksa koneksi server lalu coba lagi.";
}

async function api(method, path, payload = null, isForm = false) {
  const options = { method, headers: {} };
  const currentToken = token();
  if (currentToken) options.headers.Authorization = `Bearer ${currentToken}`;
  if (payload !== null) {
    if (isForm) {
      options.body = payload;
    } else {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(payload);
    }
  }
  let response;
  try {
    response = await fetch(`${API}${path}`, options);
  } catch (error) {
    setConnectionStatus("offline");
    throw new Error(
      "API belum bisa dihubungi. Pastikan Apache dan MySQL aktif di laptop server, lalu sambungkan perangkat ke Wi-Fi yang sama.",
    );
  }
  setConnectionStatus("connected");
  let result = {};
  try {
    result = await response.json();
  } catch (_) {
    result = {};
  }
  if (!response.ok) {
    const error = new Error(result.message || "Permintaan tidak dapat diproses.");
    error.status = response.status;
    throw error;
  }
  return result;
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[char],
  );
}

function progressReportKey(report, index) {
  return String(report.id ?? report.id_laporan ?? report.code ?? report.kode_laporan ?? `report-${index}`);
}

function safeUrl(value) {
  const url = String(value || "");
  return /^https?:\/\//i.test(url) ? url : "";
}

function setMessage(id, message = "", type = "error") {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = message;
  element.className = `form-message ${message ? `is-${type}` : ""}`;
}

let toastTimer;
function toast(message, type = "success") {
  const element = $("#toast");
  if (!element) return;
  element.textContent = message;
  element.className = `toast is-visible is-${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("is-visible"), 3200);
}

function showAuth(view = "login", message = "", type = "error") {
  $("#auth-screen").hidden = false;
  $("#app-shell").hidden = true;
  $("#login-form").hidden = view !== "login";
  $("#register-form").hidden = view !== "register";
  $("#show-login").classList.toggle("is-active", view === "login");
  $("#show-register").classList.toggle("is-active", view === "register");
  $("#retry-session").hidden = true;
  $("#auth-title").textContent =
    view === "login" ? "Selamat datang!" : "Buat akun warga";
  $("#auth-subtitle").textContent =
    view === "login"
      ? "Masuk untuk memantau laporan kebersihan di sekitarmu."
      : "Daftar untuk mengirim laporan dan memantau penanganannya.";
  setMessage(
    view === "login" ? "login-message" : "register-message",
    message,
    type,
  );
}

function showApp() {
  $("#auth-screen").hidden = true;
  $("#app-shell").hidden = false;
  renderUser();
  goPage("dashboard");
}

function renderUser() {
  const user = state.user || {};
  const name = user.name || user.nama || "User";
  const initial = name.trim().charAt(0).toUpperCase() || "U";
  const shortName = name.trim().split(/\s+/).slice(0, 2).join(" ");
  $("#user-initial-text").textContent = initial;
  $("#user-short-name").textContent = shortName;
  $("#profile-initial").textContent = initial;
  renderUserAvatars(user);
  $("#profile-display-name").textContent = name;
  $("#profile-display-username").textContent = `@${user.username || "user"}`;
  $("#profile-name").value = name;
  $("#profile-username").value = user.username || "";
}

function renderUserAvatars(user = state.user || {}) {
  const photo = profilePhotoState.previewUrl || safeUrl(user.profile_photo || user.foto_profil);
  renderAvatar("#user-avatar-photo", "#user-initial-text", photo);
  renderAvatar("#profile-avatar-photo", "#profile-initial", photo);
}

function renderAvatar(imageSelector, initialSelector, photoUrl) {
  const image = $(imageSelector);
  const initial = $(initialSelector);
  if (!image || !initial) return;
  if (!photoUrl) {
    image.hidden = true;
    image.removeAttribute("src");
    initial.hidden = false;
    return;
  }
  image.onerror = () => {
    image.hidden = true;
    initial.hidden = false;
  };
  if (image.getAttribute("src") !== photoUrl) image.src = photoUrl;
  image.hidden = false;
  initial.hidden = true;
}

function goPage(page, { scroll = true } = {}) {
  $$(".page").forEach((element) =>
    element.classList.toggle("is-active", element.id === `page-${page}`),
  );
  $$("[data-page-link]").forEach((element) =>
    element.classList.toggle("is-active", element.dataset.pageLink === page),
  );
  document.body.classList.remove("mobile-nav-open");
  if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
}

function chooseReportPhoto(file, input) {
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    input.value = "";
    setMessage("report-message", "Ukuran foto maksimal 5 MB. Pilih foto yang lebih kecil.", "error");
    return;
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    input.value = "";
    setMessage("report-message", "Pilih foto berformat JPG, PNG, atau WEBP.", "error");
    return;
  }
  if (reportPhotoState.previewUrl) URL.revokeObjectURL(reportPhotoState.previewUrl);
  reportPhotoState.file = file;
  reportPhotoState.previewUrl = URL.createObjectURL(file);
  $("#photo-preview-image").src = reportPhotoState.previewUrl;
  $("#photo-preview-name").textContent = file.name;
  $("#photo-name").hidden = true;
  $("#photo-preview").hidden = false;
  setMessage("report-message", "");
}

async function openCameraCapture() {
  const modal = $("#camera-capture-modal");
  const video = $("#report-camera-preview");
  const captureButton = $("#capture-report-photo");
  const retryButton = $("#retry-report-camera");
  const message = $("#camera-capture-message");
  const requestId = ++reportCameraRequest;

  if (reportCameraStream) {
    reportCameraStream.getTracks().forEach((track) => track.stop());
    reportCameraStream = null;
  }
  video.srcObject = null;
  message.textContent = "";
  retryButton.hidden = true;
  captureButton.disabled = true;
  modal.hidden = false;
  requestAnimationFrame(() => {
    modal.classList.add("is-open");
    captureButton.focus({ preventScroll: true });
  });

  if (!navigator.mediaDevices?.getUserMedia) {
    message.textContent = "Browser belum bisa membuka kamera di alamat ini. Buka melalui localhost atau HTTPS, lalu izinkan akses kamera.";
    retryButton.hidden = false;
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    if (requestId !== reportCameraRequest || modal.hidden) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    reportCameraStream = stream;
    video.srcObject = stream;
    await video.play();
    if (requestId === reportCameraRequest) captureButton.disabled = false;
  } catch (error) {
    if (requestId !== reportCameraRequest) return;
    if (reportCameraStream) {
      reportCameraStream.getTracks().forEach((track) => track.stop());
      reportCameraStream = null;
    }
    const cameraMessage = error.name === "NotAllowedError" || error.name === "SecurityError"
      ? "Akses kamera ditolak. Izinkan kamera untuk situs ini di pengaturan browser, lalu coba lagi."
      : error.name === "NotFoundError"
        ? "Kamera tidak ditemukan di perangkat ini. Kamu tetap bisa memilih foto dari galeri."
        : "Kamera tidak bisa dibuka. Periksa izin kamera browser, lalu coba lagi.";
    message.textContent = cameraMessage;
    retryButton.hidden = false;
  }
}

function closeCameraCapture() {
  const modal = $("#camera-capture-modal");
  const video = $("#report-camera-preview");
  ++reportCameraRequest;
  if (reportCameraStream) {
    reportCameraStream.getTracks().forEach((track) => track.stop());
    reportCameraStream = null;
  }
  video.pause();
  video.srcObject = null;
  $("#capture-report-photo").disabled = true;
  modal.classList.remove("is-open");
  window.setTimeout(() => {
    if (!modal.classList.contains("is-open")) {
      modal.hidden = true;
      $("#take-report-photo").focus({ preventScroll: true });
    }
  }, 180);
}

function captureReportPhoto() {
  const video = $("#report-camera-preview");
  const captureButton = $("#capture-report-photo");
  const message = $("#camera-capture-message");
  if (!video.videoWidth || !video.videoHeight) {
    message.textContent = "Kamera belum siap. Tunggu sebentar, lalu coba lagi.";
    return;
  }

  captureButton.disabled = true;
  const scale = Math.min(1, 1920 / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  canvas.toBlob((blob) => {
    if (!blob) {
      captureButton.disabled = false;
      message.textContent = "Foto belum berhasil dibuat. Silakan coba lagi.";
      return;
    }
    const file = new File([blob], `foto-kondisi-awal-${Date.now()}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
    chooseReportPhoto(file, $("#report-photo-camera"));
    if (reportPhotoState.file === file) {
      closeCameraCapture();
      toast("Foto berhasil ditambahkan ke laporan.");
    } else {
      captureButton.disabled = false;
      message.textContent = $("#report-message").textContent || "Foto gagal ditambahkan. Silakan coba lagi.";
    }
  }, "image/jpeg", 0.88);
}

function clearReportPhoto() {
  if (reportPhotoState.previewUrl) URL.revokeObjectURL(reportPhotoState.previewUrl);
  reportPhotoState.file = null;
  reportPhotoState.previewUrl = "";
  $("#report-photo-camera").value = "";
  $("#report-photo-gallery").value = "";
  $("#photo-preview-image").removeAttribute("src");
  $("#photo-preview-name").textContent = "";
  $("#photo-preview").hidden = true;
  $("#photo-name").hidden = false;
  $("#photo-name").textContent = "Belum ada foto dipilih";
  setMessage("report-message", "");
}

function reportDraftKey() {
  const userKey = state.user?.id || state.user?.username;
  return userKey ? "smartwaste_report_draft_" + userKey : "";
}

function scheduleReportDraftSave() {
  if (!state.user) return;
  window.clearTimeout(reportDraftSaveTimer);
  reportDraftSaveTimer = window.setTimeout(() => {
    const key = reportDraftKey();
    const status = $("#report-draft-status");
    const draft = {
      type: $("#report-type").value,
      weight: $("#report-weight").value,
      location: $("#report-location").value,
      description: $("#report-description").value,
      date: $("#report-date").value,
    };
    const hasContent = draft.type || draft.weight || draft.location.trim() || draft.description.trim();
    try {
      if (hasContent) {
        sessionStorage.setItem(key, JSON.stringify(draft));
        status.textContent = "Draft tersimpan otomatis di sesi ini.";
        status.hidden = false;
      } else {
        sessionStorage.removeItem(key);
        status.hidden = true;
      }
    } catch (_) {
      status.textContent = "Penyimpanan draft tidak tersedia di browser ini.";
      status.hidden = false;
    }
  }, 350);
}

function restoreReportDraft() {
  const key = reportDraftKey();
  if (!key || restoredReportDraftKey === key) return;
  restoredReportDraftKey = key;
  try {
    const saved = sessionStorage.getItem(key);
    if (!saved) return;
    const draft = JSON.parse(saved);
    $("#report-type").value = draft.type || "";
    $("#report-weight").value = draft.weight || "";
    $("#report-location").value = draft.location || "";
    $("#report-description").value = draft.description || "";
    $("#report-date").value = draft.date || localDateInputValue();
    const status = $("#report-draft-status");
    status.textContent = "Draft dipulihkan. Silakan pilih ulang foto kondisi awal.";
    status.hidden = false;
  } catch (_) {
    sessionStorage.removeItem(key);
  }
}

function clearReportDraft() {
  window.clearTimeout(reportDraftSaveTimer);
  const key = reportDraftKey();
  if (key) sessionStorage.removeItem(key);
  restoredReportDraftKey = key;
  const status = $("#report-draft-status");
  if (status) status.hidden = true;
}

function statusLabel(status) {
  return (
    {
      menunggu_verifikasi: "Menunggu Verifikasi",
      diproses: "Diproses",
      ditugaskan: "Ditugaskan",
      diangkut: "Diangkut",
      selesai: "Selesai",
      ditolak: "Ditolak",
      dibatalkan: "Dibatalkan warga",
    }[status] ||
    status ||
    "Belum ada status"
  );
}

function compactReportTimeline(entries) {
  const stageByStatus = {
    menunggu_verifikasi: { key: "received", order: 0, label: "Laporan diterima" },
    diproses: { key: "assigned", order: 1, label: "Petugas ditugaskan" },
    ditugaskan: { key: "assigned", order: 1, label: "Petugas ditugaskan" },
    diangkut: { key: "transported", order: 2, label: "Pengangkutan ke TPA" },
    selesai: { key: "completed", order: 3, label: "Selesai di TPA" },
      ditolak: { key: "rejected", order: 4, label: "Laporan ditolak" },
      dibatalkan: { key: "cancelled", order: 5, label: "Laporan dibatalkan warga" },
  };
  const stages = new Map();
  entries.forEach((item) => {
    const stage = stageByStatus[item.status];
    if (stage) stages.set(stage.key, { ...item, ...stage });
  });
  return [...stages.values()].sort((a, b) => a.order - b.order);
}

function formatDate(value, withTime = false) {
  if (!value) return "-";
  const raw = String(value).replace(" ", "T");
  const date = new Date(raw.length === 10 ? `${raw}T00:00:00` : raw);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(
    "id-ID",
    withTime
      ? {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      : { day: "numeric", month: "short", year: "numeric" },
  ).format(date);
}

function localDateInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function statusBadge(report) {
  const status = escapeHtml(report.status || "menunggu_verifikasi");
  return `<span class="status-badge status-${status}"><i></i>${escapeHtml(report.status_label || statusLabel(report.status))}</span>`;
}

function reportCard(report, compact = false) {
  const photo = safeUrl(report.photo || report.foto);
  const thumb = photo
    ? `<img src="${escapeHtml(photo)}" alt="Kondisi awal dari foto warga" loading="lazy">`
    : `<span class="report-placeholder">♻</span>`;
  return `<button class="report-item ${compact ? "is-compact" : ""}" type="button" data-report-id="${Number(report.id) || 0}">
    <span class="report-thumb">${thumb}</span>
    <span class="report-main"><strong>${escapeHtml(report.code || report.kode_laporan || "Laporan")}</strong><span>${escapeHtml(report.type || report.jenis || "Sampah")} · ${escapeHtml(report.location || report.lokasi || "Lokasi belum diisi")}</span><small>${formatDate(report.report_date || report.tanggal_lapor || report.created_at)}</small></span>
    <span class="report-side">${statusBadge(report)}<b>›</b></span>
  </button>`;
}

function reportWeight(report) {
  const value = Number(
    report.weight_kg ?? report.berat_kg ?? report.weight ?? report.berat ?? 0,
  );
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function formatWeight(value) {
  return `${value.toLocaleString("id-ID", {
    minimumFractionDigits: value % 1 ? 1 : 0,
    maximumFractionDigits: 1,
  })} kg`;
}

function renderImpactSummary(reports) {
  const completed = reports.filter((report) => report.status === "selesai").length;
  const completion = reports.length ? Math.round((completed / reports.length) * 100) : 0;
  const categoryCounts = reports.reduce((counts, report) => {
    const category = report.type || report.jenis || "Lainnya";
    counts[category] = (counts[category] || 0) + 1;
    return counts;
  }, {});
  const rankedCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const topCategory = rankedCategories[0]?.[0] || "—";
  const total = $("#impact-total");
  const weight = $("#impact-weight");
  const completionValue = $("#impact-completion");
  const completedCount = $("#impact-completed-count");
  const gauge = $("#impact-gauge");
  const category = $("#impact-category");
  const categoryList = $("#impact-category-list");
  const chart = $("#impact-chart");
  const monthsLabel = $("#impact-months");
  const message = $("#impact-message");
  if (!total || !weight || !completionValue || !completedCount || !gauge || !category || !categoryList || !chart || !monthsLabel || !message) return;

  completionValue.textContent = `${completion}%`;
  completedCount.textContent = `${completed.toLocaleString("id-ID")} / ${reports.length.toLocaleString("id-ID")}`;
  gauge.style.setProperty("--completion-progress", `${completion}%`);
  gauge.setAttribute("aria-label", `${completion}% laporan selesai`);
  category.textContent = topCategory === "—" ? "Belum ada data" : `Terbanyak: ${topCategory}`;

  const now = new Date();
  const monthBuckets = Array.from({ length: 6 }, (_, index) => {
    const month = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    return { month, count: 0, weight: 0 };
  });
  const monthIndex = new Map(monthBuckets.map(({ month }, index) => [
    `${month.getFullYear()}-${month.getMonth()}`,
    index,
  ]));
  reports.forEach((report) => {
    const dateValue = report.report_date || report.tanggal_lapor || report.created_at;
    if (!dateValue) return;
    const date = new Date(String(dateValue).trim().replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return;
    const index = monthIndex.get(`${date.getFullYear()}-${date.getMonth()}`);
    if (index !== undefined) {
      monthBuckets[index].count += 1;
      monthBuckets[index].weight += reportWeight(report);
    }
  });

  const recentReportCount = monthBuckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const recentReportWeight = monthBuckets.reduce((sum, bucket) => sum + bucket.weight, 0);
  total.textContent = recentReportCount.toLocaleString("id-ID");
  weight.textContent = formatWeight(recentReportWeight);

  const chartPoints = monthBuckets.map(({ count }, index) => ({
    x: 34 + index * 126.4,
    y: 137 - (count / Math.max(1, ...monthBuckets.map((bucket) => bucket.count))) * 94,
  }));
  const linePath = chartPoints.map(({ x, y }, index) => `${index ? "L" : "M"} ${x} ${y}`).join(" ");
  const areaPath = `${linePath} L ${chartPoints.at(-1).x} 164 L ${chartPoints[0].x} 164 Z`;
  const gridLines = [42, 82, 122, 164].map((y) =>
    `<line x1="24" y1="${y}" x2="678" y2="${y}" />`,
  ).join("");
  const points = chartPoints.map(({ x, y }) =>
    `<circle cx="${x}" cy="${y}" r="4" />`,
  ).join("");
  chart.innerHTML = `<svg viewBox="0 0 704 182" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="impact-area-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#14784e" stop-opacity=".2"/><stop offset="100%" stop-color="#14784e" stop-opacity="0"/></linearGradient>
      <linearGradient id="impact-line-gradient" x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stop-color="#075b3b"/><stop offset="100%" stop-color="#14784e"/></linearGradient>
    </defs>
    <g class="chart-grid-lines">${gridLines}</g>
    <path class="chart-area" d="${areaPath}" />
    <path class="chart-line" d="${linePath}" />
    <g class="chart-points">${points}</g>
  </svg>`;
  monthsLabel.innerHTML = monthBuckets.map(({ month }) =>
    `<span>${new Intl.DateTimeFormat("id-ID", { month: "short" }).format(month)}</span>`,
  ).join("");

  const categoryRows = rankedCategories.length
    ? rankedCategories
    : ["Organik", "Plastik", "Kertas", "Elektronik"].map((name) => [name, 0]);
  const maxCategoryCount = Math.max(1, ...categoryRows.map(([, count]) => count));
  categoryList.innerHTML = categoryRows.map(([name, count], index) => {
    const percent = Math.round((count / maxCategoryCount) * 100);
    return `<div class="impact-category-row">
      <div class="impact-category-label"><span class="category-dot category-dot-${index + 1}"></span><span>${escapeHtml(name)}</span><strong>${count.toLocaleString("id-ID")}</strong></div>
      <div class="impact-category-track"><span style="width:${percent}%"></span></div>
    </div>`;
  }).join("");

  if (!reports.length) {
    message.textContent = "Kirim laporan pertamamu untuk mulai melihat dampaknya.";
  } else if (completion === 100) {
    message.textContent = "Semua laporanmu sudah selesai. Terima kasih sudah ikut menjaga lingkungan.";
  } else if (completed > 0) {
    message.textContent = `${completed} laporan selesai. Pantau laporan aktifmu sampai penanganan tuntas.`;
  } else {
    message.textContent = "Laporanmu sedang dipantau. Setiap laporan membantu petugas bergerak lebih cepat.";
  }
}

function renderDashboard() {
  const reports = state.reports;
  renderResidentProgress(reports);
  const exportButton = $("#export-reports");
  if (exportButton) exportButton.disabled = reports.length === 0;
  const count = (status) =>
    reports.filter((report) => report.status === status).length;
  const processCount = reports.filter((report) =>
    ["diproses", "ditugaskan", "diangkut"].includes(report.status),
  ).length;
  $("#stat-total").textContent = reports.length;
  $("#stat-waiting").textContent = count("menunggu_verifikasi");
  $("#stat-process").textContent = processCount;
  $("#stat-done").textContent = count("selesai");
  renderImpactSummary(reports);
  const recent = reports.slice(0, 3);
  $("#recent-list").innerHTML = recent.length
    ? recent.map((report) => reportCard(report, true)).join("")
    : `<div class="empty-state"><span>✦</span><strong>Belum ada laporan</strong><p>Yuk mulai dari laporan pertamamu.</p><button class="text-button" data-page-link="reports" type="button">Buat laporan →</button></div>`;
  $("#last-sync").textContent = reports.length
    ? `Diperbarui ${new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(new Date())}`
    : "Belum ada data";
}

function renderResidentProgress(reports) {
  const container = $("#resident-progress-content");
  if (!container) return;
  if (!reports.length) {
    container.innerHTML = `<div class="resident-progress-empty"><span class="resident-progress-empty-icon">↗</span><div><strong>Belum ada laporan untuk dipantau</strong><p>Kirim laporan pertama, lalu pantau setiap tahap penanganannya di sini.</p></div><button class="primary-button" data-page-link="reports" type="button"><span>Buat laporan</span><b>→</b></button></div>`;
    return;
  }

  const activeStatuses = ["menunggu_verifikasi", "diproses", "ditugaskan", "diangkut"];
  const assignedReport = reports.find((item) =>
    ["ditugaskan", "diangkut"].includes(item.status) &&
    [item.worker_name, item.vehicle_plate, item.tpa_name].some((value) => String(value || "").trim()),
  );
  const selectedReportIndex = reports.findIndex((item, index) =>
    progressReportKey(item, index) === state.selectedProgressReportId,
  );
  const defaultReport = assignedReport || reports.find((item) => activeStatuses.includes(item.status)) || reports[0];
  const report = selectedReportIndex >= 0 ? reports[selectedReportIndex] : defaultReport;
  const reportIndex = reports.indexOf(report);
  const reportKey = progressReportKey(report, reportIndex);
  state.selectedProgressReportId = reportKey;
  const stages = [
    { label: "Diterima", statuses: ["menunggu_verifikasi"] },
    { label: "Ditangani", statuses: ["diproses", "ditugaskan"] },
    { label: "Diangkut", statuses: ["diangkut"] },
    { label: "Selesai", statuses: ["selesai"] },
  ];
  const stageIndex = report.status === "selesai" ? 3
    : report.status === "diangkut" ? 2
      : ["diproses", "ditugaskan"].includes(report.status) ? 1 : 0;
  const terminal = ["ditolak", "dibatalkan"].includes(report.status);
  const progress = report.status === "selesai" ? 100 : ["diproses", "ditugaskan"].includes(report.status) ? 46 : report.status === "diangkut" ? 76 : 14;
  const message = {
    menunggu_verifikasi: "Laporan sudah diterima dan sedang menunggu pemeriksaan.",
    diproses: "Laporan mulai ditangani. Kamu bisa melihat catatan terbaru di detail.",
    ditugaskan: "Petugas dan armada sudah ditetapkan untuk laporan ini.",
    diangkut: "Sampah sedang diangkut menuju tempat pengolahan.",
    selesai: "Penanganan laporan ini sudah selesai. Terima kasih sudah berkontribusi!",
    ditolak: "Laporan ini tidak dapat diproses. Buka detail untuk membaca alasannya.",
    dibatalkan: "Laporan ini sudah dibatalkan dan tersimpan di riwayatmu.",
  }[report.status] || "Buka detail untuk melihat informasi terbaru.";
  const assignmentFields = [
    { label: "Petugas", value: report.worker_name || report.petugas_nama },
    { label: "Kendaraan", value: report.vehicle_plate || report.plat_nomor },
    { label: "Tujuan TPA", value: report.tpa_name || report.nama_tpa },
  ];
  const hasAssignment = assignmentFields.some((field) => String(field.value || "").trim());
  const latestUpdate = (report.timeline || report.riwayat || []).slice(-1)[0];
  const assignmentMarkup = hasAssignment
    ? `<section class="resident-assignment" aria-label="Informasi penugasan dari aplikasi"><div class="resident-assignment-heading"><strong>Penugasan dari aplikasi</strong><small>Sinkron dengan data operasional</small></div><dl>${assignmentFields.map((field) => `<div><dt>${field.label}</dt><dd>${escapeHtml(field.value || "Belum ditetapkan")}</dd></div>`).join("")}</dl></section>`
    : ["ditugaskan", "diangkut", "selesai"].includes(report.status)
      ? `<section class="resident-assignment is-pending"><strong>Rincian penugasan belum tersedia</strong><p>Detail petugas, kendaraan, dan TPA akan tampil setelah tersimpan di aplikasi.</p></section>`
      : "";
  const updateMarkup = latestUpdate && (latestUpdate.note || latestUpdate.catatan)
    ? `<p class="resident-latest-note"><strong>Catatan terbaru dari aplikasi</strong><span>${escapeHtml(latestUpdate.note || latestUpdate.catatan)}</span><small>${formatDate(latestUpdate.tanggal_update, true)}</small></p>`
    : "";
  const stepMarkup = stages.map((stage, index) => {
    const done = report.status === "selesai" || index < stageIndex;
    const current = !terminal && index === stageIndex && report.status !== "selesai";
    return `<li class="resident-progress-step ${done ? "is-done" : ""} ${current ? "is-current" : ""}"><span>${done ? "✓" : `0${index + 1}`}</span><small>${stage.label}</small></li>`;
  }).join("");
  const reportPicker = reports.length > 1
    ? `<div class="resident-progress-picker"><label for="resident-progress-select"><span>Pilih laporan</span><small>Ganti laporan yang sedang kamu pantau</small></label><select id="resident-progress-select" aria-label="Pilih laporan untuk melihat progres">${reports.map((item, index) => {
      const key = progressReportKey(item, index);
      const code = item.code || item.kode_laporan || `Laporan ${index + 1}`;
      const type = item.type || item.jenis || "Sampah";
      const weightLabel = reportWeight(item) ? ` · ${formatWeight(reportWeight(item))}` : "";
      return `<option value="${escapeHtml(key)}"${key === reportKey ? " selected" : ""}>${escapeHtml(code)} · ${escapeHtml(type)}${weightLabel} · ${escapeHtml(statusLabel(item.status))}</option>`;
    }).join("")}</select></div>`
    : "";
  container.innerHTML = `${reportPicker}<article class="resident-progress-card">
    <div class="resident-progress-top"><div><span class="eyebrow">${terminal ? "PEMBARUAN LAPORAN" : "LAPORAN AKTIF"}</span><h3>${escapeHtml(report.code || report.kode_laporan || "Laporan")}</h3><p>${escapeHtml(report.type || report.jenis || "Sampah")} · ${reportWeight(report) ? escapeHtml(formatWeight(reportWeight(report))) : "Berat belum diisi"} · ${escapeHtml(report.location || report.lokasi || "Lokasi belum diisi")}</p></div>${statusBadge(report)}</div>
    ${terminal ? `<div class="resident-progress-terminal"><span>i</span><p>${escapeHtml(message)}</p></div>` : `<div class="resident-progress-track" aria-label="Tahap ${stageIndex + 1} dari 4"><span style="width:${progress}%"></span></div><ol class="resident-progress-steps">${stepMarkup}</ol><p class="resident-progress-message">${escapeHtml(message)}</p>`}
    ${assignmentMarkup}${updateMarkup}
    <button class="resident-progress-detail" data-report-id="${Number(report.id) || 0}" type="button">Lihat detail dan riwayat <span>→</span></button>
  </article>`;
}

function notifyResidentStatusChanges(previousReports, nextReports) {
  if (!previousReports.length || !nextReports.length) return;
  const previousById = new Map(previousReports.map((report) => [Number(report.id || report.id_laporan), report]));
  const changed = nextReports.filter((report) => {
    const previous = previousById.get(Number(report.id || report.id_laporan));
    return previous && previous.status !== report.status;
  });
  if (!changed.length) return;
  const report = changed[0];
  const label = report.status_label || statusLabel(report.status);
  toast(changed.length === 1
    ? `Pembaruan dari aplikasi · ${report.code || report.kode_laporan}: ${label}.`
    : `${changed.length} laporan mendapat pembaruan status dari aplikasi.`);
}

function exportReportsCsv() {
  if (!state.reports.length) {
    toast("Belum ada laporan untuk diunduh.", "error");
    return;
  }
  const columns = ["Kode laporan", "Tanggal", "Jenis sampah", "Berat (kg)", "Lokasi", "Status", "Deskripsi"];
  const csvCell = (value) => {
    let text = String(value ?? "");
    if (/^[\u0000-\u0020]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  const rows = state.reports.map((report) => [
    report.code || report.kode_laporan,
    report.report_date || report.tanggal_lapor || report.created_at,
    report.type || report.jenis,
    report.weight_kg ?? report.berat_kg ?? report.weight ?? report.berat,
    report.location || report.lokasi,
    report.status_label || statusLabel(report.status),
    report.description || report.deskripsi,
  ]);
  const content = "\uFEFF" + [columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  const now = new Date();
  const date = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  link.href = url;
  link.download = "laporan-smart-waste-" + date + ".csv";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(state.reports.length + " laporan berhasil disiapkan untuk diunduh.");
}

function renderReports() {
  const inProcess = ["diproses", "ditugaskan", "diangkut"];
  let visible =
    state.filter === "all"
      ? state.reports
      : state.filter === "diproses"
        ? state.reports.filter((report) => inProcess.includes(report.status))
        : state.reports.filter((report) => report.status === state.filter);
  const query = ($("#reports-search")?.value || "").trim().toLocaleLowerCase("id-ID");
  if (query) {
    visible = visible.filter((report) => [
      report.code, report.kode_laporan, report.type, report.jenis,
      report.location, report.lokasi, report.description, report.deskripsi,
      report.status_label, statusLabel(report.status),
    ].some((value) => String(value || "").toLocaleLowerCase("id-ID").includes(query)));
  }
  const dateFrom = $("#reports-date-from")?.value || "";
  const dateTo = $("#reports-date-to")?.value || "";
  if (dateFrom || dateTo) {
    visible = visible.filter((report) => {
      const reportDate = String(report.report_date || report.tanggal_lapor || report.created_at || "").slice(0, 10);
      return (!dateFrom || reportDate >= dateFrom) && (!dateTo || reportDate <= dateTo);
    });
  }
  $("#reports-list").innerHTML = visible.length
    ? visible.map((report) => reportCard(report)).join("")
    : `<div class="empty-state"><span>◌</span><strong>Tidak ada laporan di filter ini</strong><p>Data akan muncul setelah kamu mengirim laporan.</p></div>`;
  const count = $("#history-count");
  if (count) {
    count.textContent = state.filter === "all"
      ? `${visible.length} laporan`
      : `${visible.length} dari ${state.reports.length} laporan`;
  }
  $$(".filter-button").forEach((button) =>
    button.classList.toggle(
      "is-active",
      button.dataset.filter === state.filter,
    ),
  );
}

function renderAll() {
  renderDashboard();
  renderReports();
}

async function refreshData(silent = false) {
  try {
    const [me, result] = await Promise.all([
      api("GET", "/me"),
      api("GET", "/laporan/mine"),
    ]);
    state.user = me.user;
    restoreReportDraft();
    const previousReports = state.reports;
    const nextReports = result.reports || result.data || [];
    if (state.hasLoadedData) notifyResidentStatusChanges(previousReports, nextReports);
    state.reports = nextReports;
    state.loadError = "";
    state.hasLoadedData = true;
    renderUser();
    renderAll();
    updateConnectionWarning();
    return true;
  } catch (error) {
    state.loadError = error.message;
    setConnectionStatus(error.status ? "connected" : "offline");
    updateConnectionWarning();
    if (error.status === 401 || error.status === 403) {
      localStorage.removeItem(TOKEN_KEY);
      stopPolling();
      state.user = null;
      showAuth(
        "login",
        error.status === 401
          ? "Sesi kamu sudah berakhir. Silakan login lagi."
          : "Akun ini tidak memiliki akses ke Portal Warga. Masuk dengan akun warga."
      );
      return false;
    }
    renderAll();
    if (!silent) toast(error.message, "error");
    return false;
  }
}

async function retrySessionRestore() {
  const button = $("#retry-session");
  button.disabled = true;
  setConnectionStatus("checking");
  const restored = await refreshData(true);
  if (restored) {
    showApp();
    startPolling();
  } else if (token()) {
    showAuth("login", "Server belum dapat dihubungi. Sesi tetap tersimpan; coba lagi.");
    button.hidden = false;
  }
  button.disabled = false;
}

function startPolling() {
  stopPolling();
  state.poll = setInterval(() => refreshData(true), 15000);
}

function stopPolling() {
  if (state.poll) clearInterval(state.poll);
  state.poll = null;
}

function openReportModal(id, showFullTimeline = false) {
  const report = state.reports.find((item) => Number(item.id) === Number(id));
  if (!report) return;
  const timeline = report.timeline || report.riwayat || [];
  const compactTimeline = compactReportTimeline(timeline);
  const visibleTimeline = showFullTimeline ? timeline : compactTimeline;
  const photo = safeUrl(report.photo || report.foto);
  const afterPhoto = safeUrl(report.completion_proof_photo || report.completionProofPhoto);
  const locationEvidencePhoto = safeUrl(report.location_evidence_photo || report.locationEvidencePhotoUrl);
  const photoSteps = [
    photo
      ? `<a class="report-photo-step" href="${escapeHtml(photo)}" target="_blank" rel="noreferrer"><strong>Sebelum · foto warga</strong><img src="${escapeHtml(photo)}" alt="Kondisi sebelum ditangani, dilaporkan warga"></a>`
      : "",
    afterPhoto
      ? `<a class="report-photo-step" href="${escapeHtml(afterPhoto)}" target="_blank" rel="noreferrer"><strong>Sesudah · foto petugas</strong><img src="${escapeHtml(afterPhoto)}" alt="Kondisi sesudah ditangani, bukti petugas"></a>`
      : "",
    locationEvidencePhoto
      ? `<a class="report-photo-step" href="${escapeHtml(locationEvidencePhoto)}" target="_blank" rel="noreferrer"><strong>Bukti lokasi · petugas</strong><img src="${escapeHtml(locationEvidencePhoto)}" alt="Foto lokasi yang dikirim petugas melalui aplikasi"></a>`
      : "",
  ].filter(Boolean);
  const photoComparison = photoSteps.length
    ? `<div class="report-photo-comparison ${photoSteps.length === 1 ? "is-single" : ""} ${photoSteps.length === 3 ? "has-three" : ""}">${photoSteps.join("")}</div>`
    : "";
  const timelineMarkup = visibleTimeline.length
    ? visibleTimeline.map((item) => `<div class="timeline-item"><i></i><div><strong>${escapeHtml(item.compactLabel || item.status_label || statusLabel(item.status))}</strong><small>${formatDate(item.tanggal_update, true)} · ${escapeHtml(item.changed_by || "Sistem")}</small>${item.note || item.catatan ? `<p>${escapeHtml(item.note || item.catatan)}</p>` : ""}</div></div>`).join("")
    : `<p class="muted-copy">Riwayat status belum tersedia.</p>`;
  const timelineToggle = timeline.length > compactTimeline.length
    ? `<button class="text-button timeline-toggle" type="button" data-toggle-report-history data-report-id="${Number(id)}" aria-expanded="${showFullTimeline}">${showFullTimeline ? "Ringkas progres" : `Lihat riwayat lengkap · ${timeline.length}`}</button>`
    : "";
  const assignmentFields = [
    { label: "Petugas", value: report.worker_name || report.petugas_nama },
    { label: "Kendaraan", value: report.vehicle_plate || report.plat_nomor },
    { label: "Tujuan TPA", value: report.tpa_name || report.nama_tpa },
  ];
  const assignmentMarkup = assignmentFields.some((field) => String(field.value || "").trim())
    ? `<section class="report-assignment-detail"><span class="eyebrow">PENANGANAN DARI APLIKASI</span><dl>${assignmentFields.map((field) => `<div><dt>${field.label}</dt><dd>${escapeHtml(field.value || "Belum ditetapkan")}</dd></div>`).join("")}</dl></section>`
    : "";
  const completionStatusLabels = {
    menunggu: "Menunggu pemeriksaan admin",
    disetujui: "Bukti disetujui",
    perlu_perbaikan: "Perlu perbaikan bukti",
  };
  const completionStatus = String(report.completion_status || "").toLowerCase();
  const completionNote = report.completion_review_note || report.completionReviewNote || "";
  const completionSubmittedAt = report.completion_submitted_at || report.completionSubmittedAt || "";
  const completionMarkup = completionStatus || completionNote || completionSubmittedAt
    ? `<section class="report-completion-detail"><div><span class="eyebrow">KONFIRMASI PENYELESAIAN</span><strong>${escapeHtml(completionStatusLabels[completionStatus] || (completionStatus ? statusLabel(completionStatus) : "Bukti penyelesaian diperbarui"))}</strong></div>${completionSubmittedAt ? `<small>Dikirim ${formatDate(completionSubmittedAt, true)}</small>` : ""}${completionNote ? `<p>${escapeHtml(completionNote)}</p>` : ""}</section>`
    : "";
  const canEdit = report.status === "menunggu_verifikasi";
  $("#modal-content").innerHTML =
    `<div class="modal-heading"><span class="eyebrow">DETAIL LAPORAN</span><h2>${escapeHtml(report.code || report.kode_laporan)}</h2><p>${escapeHtml(report.type || report.jenis)} · ${formatDate(report.report_date || report.tanggal_lapor)}</p></div>
    <div class="modal-status">${statusBadge(report)}<span>${escapeHtml(report.location || report.lokasi)}</span></div>
    ${photoComparison}
    <div class="detail-grid"><div><small>Lokasi</small><strong>${escapeHtml(report.location || report.lokasi)}</strong></div><div><small>Berat perkiraan</small><strong>${Number(report.weight_kg || report.berat_kg || 0).toLocaleString("id-ID")} kg</strong></div><div class="detail-full"><small>Deskripsi</small><strong>${escapeHtml(report.description || report.deskripsi || "Tidak ada deskripsi tambahan.")}</strong></div></div>
    ${assignmentMarkup}
    ${completionMarkup}
    <div class="timeline"><span class="eyebrow">PROGRES LAPORAN · ${showFullTimeline ? "RIWAYAT LENGKAP" : "TAHAP UTAMA"}</span>${timelineMarkup}${timelineToggle}</div>`;
  if (canEdit) {
    $("#modal-content").insertAdjacentHTML(
      "beforeend",
      '<div class="report-owner-actions"><button class="outline-button" data-edit-report="' + Number(id) + '" type="button">Edit laporan</button><button class="outline-button" data-cancel-report="' + Number(id) + '" type="button">Batalkan laporan</button></div>',
    );
  }
  $("#report-modal").hidden = false;
  requestAnimationFrame(() => $("#report-modal").classList.add("is-open"));
}

function renderReportEditForm(report) {
  const id = Number(report.id || report.id_laporan) || 0;
  const currentType = report.type || report.jenis || "";
  const types = ["Organik", "Plastik", "Kertas", "Logam", "Kaca", "Elektronik", "Lainnya"];
  if (currentType && !types.includes(currentType)) types.unshift(currentType);
  const options = ['<option value="">Pilih jenis</option>'].concat(types.map((type) =>
    '<option value="' + escapeHtml(type) + '"' + (type === currentType ? " selected" : "") + '>' + escapeHtml(type) + '</option>',
  )).join("");
  $("#modal-content").innerHTML =
    '<div class="modal-heading"><span class="eyebrow">KOREKSI LAPORAN</span><h2>' +
    escapeHtml(report.code || report.kode_laporan || "Laporan") +
    '</h2><p>Perubahan hanya bisa dilakukan sebelum laporan diverifikasi.</p></div>' +
    '<form id="report-edit-form" data-report-id="' + id + '" class="report-edit-form">' +
    '<label>Jenis sampah<select name="type" required>' + options + '</select></label>' +
    '<label>Perkiraan berat (kg)<input name="weight" type="number" min="0" max="100000" step="0.1" value="' +
    escapeHtml(report.weight_kg ?? report.berat_kg ?? 0) + '"></label>' +
    '<label>Lokasi kejadian<input name="location" maxlength="255" required value="' +
    escapeHtml(report.location || report.lokasi || "") + '"></label>' +
    '<label>Deskripsi singkat<textarea name="description" rows="3">' +
    escapeHtml(report.description || report.deskripsi || "") + '</textarea></label>' +
    '<label>Tanggal laporan<input name="date" type="date" required value="' +
    escapeHtml(report.report_date || report.tanggal_lapor || "") + '"></label>' +
    '<p class="form-message" data-edit-message role="alert"></p>' +
    '<div class="report-owner-actions"><button class="outline-button" type="button" data-cancel-edit="' + id + '">Tutup</button>' +
    '<button class="primary-button" type="submit"><span>Simpan perubahan</span></button></div></form>';
  $("#report-edit-form").addEventListener("submit", submitReportEdit);
}

async function submitReportEdit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const id = form.dataset.reportId;
  const button = form.querySelector('button[type="submit"]');
  const message = form.querySelector("[data-edit-message]");
  const data = new FormData(form);
  button.disabled = true;
  message.textContent = "Menyimpan perubahan...";
  try {
    await api("PUT", "/laporan/" + id, {
      jenis_sampah: data.get("type"),
      berat_kg: data.get("weight") || "0",
      lokasi: data.get("location"),
      deskripsi: data.get("description"),
      tanggal_lapor: data.get("date"),
    });
    await refreshData(true);
    openReportModal(id);
    toast("Perubahan laporan berhasil disimpan.");
  } catch (error) {
    message.textContent = error.message;
    button.disabled = false;
  }
}

async function cancelCitizenReport(id) {
  const report = state.reports.find((item) => Number(item.id) === Number(id));
  if (!report || report.status !== "menunggu_verifikasi") {
    toast("Laporan hanya bisa dibatalkan sebelum diverifikasi.", "error");
    return;
  }
  const code = report.code || report.kode_laporan || "ini";
  if (!window.confirm("Batalkan laporan " + code + "? Laporan tetap tersimpan di riwayat dengan status Dibatalkan warga.")) return;
  try {
    await api("DELETE", "/laporan/" + id);
    await refreshData(true);
    closeModal();
    toast("Laporan berhasil dibatalkan.");
  } catch (error) {
    toast(error.message, "error");
  }
}

function closeModal() {
  $("#report-modal").classList.remove("is-open");
  setTimeout(() => {
    $("#report-modal").hidden = true;
  }, 180);
}

async function handleLogin(event) {
  event.preventDefault();
  setMessage("login-message", "Memeriksa akun...", "info");
  const button = $("#login-form button[type=submit]");
  button.disabled = true;
  try {
    const result = await api("POST", "/auth/login", {
      username: $("#login-identity").value.trim(),
      password: $("#login-password").value,
      client: "web",
    });
    localStorage.setItem(TOKEN_KEY, result.token);
    state.user = result.user;
    $("#login-password").value = "";
    showApp();
    await refreshData();
    startPolling();
    toast("Selamat datang di portal Smart Waste.");
  } catch (error) {
    setMessage("login-message", error.message, "error");
  } finally {
    button.disabled = false;
  }
}

async function handleRegister(event) {
  event.preventDefault();
  setMessage("register-message", "Menyimpan akun...", "info");
  const button = $("#register-form button[type=submit]");
  button.disabled = true;
  try {
    await api("POST", "/auth/register", {
      name: $("#register-name").value.trim(),
      username: $("#register-username").value.trim(),
      password: $("#register-password").value,
      client: "web",
    });
    $("#login-identity").value = $("#register-username").value.trim();
    $("#register-form").reset();
    showAuth("login", "Akun berhasil dibuat. Silakan masuk.", "success");
  } catch (error) {
    setMessage("register-message", error.message, "error");
  } finally {
    button.disabled = false;
  }
}

async function handleReport(event) {
  event.preventDefault();
  const messageId = "report-message";
  const photo = reportPhotoState.file;
  if (!photo) {
    setMessage(messageId, "Lampirkan foto kondisi awal sebelum mengirim laporan.", "error");
    $("#report-photo-section").scrollIntoView({ behavior: "smooth", block: "center" });
    $("#take-report-photo").focus({ preventScroll: true });
    return;
  }
  setMessage(messageId, "Mengirim laporan...", "info");
  const button = $("#report-form button[type=submit]");
  button.disabled = true;
  const form = new FormData();
  form.append("jenis_sampah", $("#report-type").value);
  form.append("berat_kg", $("#report-weight").value || "0");
  form.append("lokasi", $("#report-location").value.trim());
  form.append("deskripsi", $("#report-description").value.trim());
  form.append("tanggal_lapor", $("#report-date").value);
  form.append("foto", photo);
  try {
    await api("POST", "/laporan", form, true);
    clearReportDraft();
    $("#report-form").reset();
    $("#report-date").value = localDateInputValue();
    clearReportPhoto();
    await refreshData();
    goPage("dashboard");
    toast("Laporan dan foto kondisi awal terkirim untuk diverifikasi.");
  } catch (error) {
    setMessage(messageId, error.message, "error");
  } finally {
    button.disabled = false;
  }
}

async function handleProfile(event) {
  event.preventDefault();
  setMessage("profile-message", "Menyimpan perubahan...", "info");
  try {
    const result = await api("PUT", "/me", {
      name: $("#profile-name").value.trim(),
    });
    state.user = result.user;
    renderUser();
    setMessage("profile-message", "Profil berhasil diperbarui.", "success");
  } catch (error) {
    setMessage("profile-message", error.message, "error");
  }
}

async function handleProfilePhotoSelection(event) {
  const input = event.currentTarget;
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    input.value = "";
    toast("Ukuran foto maksimal 5 MB.");
    return;
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    input.value = "";
    toast("Pilih foto berformat JPG, PNG, atau WEBP.");
    return;
  }
  if (profilePhotoState.previewUrl) URL.revokeObjectURL(profilePhotoState.previewUrl);
  profilePhotoState.previewUrl = URL.createObjectURL(file);
  renderUserAvatars();
  await uploadProfilePhoto(file, input);
}

async function uploadProfilePhoto(file, input) {
  const selectButton = $("#select-profile-photo");
  selectButton.disabled = true;
  const form = new FormData();
  form.append("foto", file);
  try {
    const result = await api("POST", "/me/foto-profil", form, true);
    state.user = result.user;
    if (profilePhotoState.previewUrl) URL.revokeObjectURL(profilePhotoState.previewUrl);
    profilePhotoState.previewUrl = "";
    renderUserAvatars();
  } catch (error) {
    if (profilePhotoState.previewUrl) URL.revokeObjectURL(profilePhotoState.previewUrl);
    profilePhotoState.previewUrl = "";
    renderUserAvatars();
    toast(error.message);
  } finally {
    input.value = "";
    selectButton.disabled = false;
  }
}

async function handlePassword(event) {
  event.preventDefault();
  setMessage("password-message", "Memperbarui password...", "info");
  try {
    await api("PATCH", "/me/password", {
      old_password: $("#old-password").value,
      new_password: $("#new-password").value,
    });
    localStorage.removeItem(TOKEN_KEY);
    stopPolling();
    $("#password-form").reset();
    $("#login-password").value = "";
    showAuth(
      "login",
      "Password berhasil diganti. Silakan login kembali.",
      "success",
    );
  } catch (error) {
    setMessage("password-message", error.message, "error");
  }
}

async function logout() {
  try {
    await api("POST", "/auth/logout");
  } catch (_) {
    /* token tetap dibersihkan */
  }
  localStorage.removeItem(TOKEN_KEY);
  stopPolling();
  state.user = null;
  state.reports = [];
  state.selectedProgressReportId = "";
  state.loadError = "";
  state.hasLoadedData = false;
  $("#login-password").value = "";
  showAuth("login", "Kamu sudah keluar dari akun.", "success");
}

function bindEvents() {
  $("#show-login").addEventListener("click", () => showAuth("login"));
  $("#show-register").addEventListener("click", () => showAuth("register"));
  $("#login-form").addEventListener("submit", handleLogin);
  $("#retry-session").addEventListener("click", retrySessionRestore);
  $("#register-form").addEventListener("submit", handleRegister);
  $("#report-form").addEventListener("submit", handleReport);
  ["#report-type", "#report-weight", "#report-location", "#report-description", "#report-date"]
    .forEach((selector) => {
      const field = $(selector);
      field.addEventListener("input", scheduleReportDraftSave);
      field.addEventListener("change", scheduleReportDraftSave);
    });
  $("#take-report-photo").addEventListener("click", openCameraCapture);
  $("#capture-report-photo").addEventListener("click", captureReportPhoto);
  $("#retry-report-camera").addEventListener("click", openCameraCapture);
  $("#choose-report-photo").addEventListener("click", () => $("#report-photo-gallery").click());
  [$("#report-photo-camera"), $("#report-photo-gallery")].forEach((input) => {
    input.addEventListener("change", (event) => chooseReportPhoto(event.currentTarget.files[0], event.currentTarget));
  });
  $("#remove-report-photo").addEventListener("click", clearReportPhoto);
  $("#profile-form").addEventListener("submit", handleProfile);
  $("#select-profile-photo").addEventListener("click", () => $("#profile-photo-input").click());
  $("#profile-photo-input").addEventListener("change", handleProfilePhotoSelection);
  $("#password-form").addEventListener("submit", handlePassword);
  $("#logout-button").addEventListener("click", logout);
  $("#refresh-reports").addEventListener("click", () => refreshData());
  $("#retry-data").addEventListener("click", () => refreshData());
  $("#export-reports").addEventListener("click", exportReportsCsv);
  $("#mobile-menu").addEventListener("click", () =>
    document.body.classList.toggle("mobile-nav-open"),
  );
  $("#user-menu").addEventListener("click", () => goPage("profile"));
  document.addEventListener("change", (event) => {
    if (event.target.matches("#resident-progress-select")) {
      state.selectedProgressReportId = event.target.value;
      renderResidentProgress(state.reports);
    }
  });
  document.addEventListener("click", (event) => {
    const reportFilter = event.target.closest("[data-report-filter]");
    if (reportFilter) {
      state.filter = reportFilter.dataset.reportFilter;
      goPage("history");
      renderReports();
      return;
    }
    if (event.target.closest("[data-camera-close]")) {
      closeCameraCapture();
      return;
    }
    const photoShortcut = event.target.closest("[data-photo-report]");
    if (photoShortcut) {
      event.preventDefault();
      goPage("reports", { scroll: false });
      requestAnimationFrame(() => {
        $("#report-photo-section").scrollIntoView({ behavior: "smooth", block: "center" });
        $("#take-report-photo").focus({ preventScroll: true });
      });
      return;
    }
    const editReport = event.target.closest("[data-edit-report]");
    if (editReport) {
      const id = Number(editReport.dataset.editReport);
      const report = state.reports.find((item) => Number(item.id) === id);
      if (report && report.status === "menunggu_verifikasi") renderReportEditForm(report);
      else toast("Laporan hanya bisa diedit sebelum diverifikasi.", "error");
      return;
    }
    const cancelEdit = event.target.closest("[data-cancel-edit]");
    if (cancelEdit) {
      closeModal();
      return;
    }
    const cancelReport = event.target.closest("[data-cancel-report]");
    if (cancelReport) {
      cancelCitizenReport(cancelReport.dataset.cancelReport);
      return;
    }
    const historyToggle = event.target.closest("[data-toggle-report-history]");
    if (historyToggle) {
      openReportModal(
        historyToggle.dataset.reportId,
        historyToggle.getAttribute("aria-expanded") !== "true",
      );
      return;
    }
    const pageLink = event.target.closest("[data-page-link]");
    const quickCategory = event.target.closest("[data-report-type]");
    if (quickCategory) {
      $("#report-type").value = quickCategory.dataset.reportType;
    }
    if (pageLink) {
      event.preventDefault();
      goPage(pageLink.dataset.pageLink);
    }
    const reportItem = event.target.closest(".report-item[data-report-id], .resident-progress-detail[data-report-id]");
    if (reportItem) openReportModal(reportItem.dataset.reportId);
    if (event.target.closest("[data-close-modal]")) closeModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!$("#camera-capture-modal").hidden) closeCameraCapture();
      else closeModal();
    }
  });

  $$(".filter-button").forEach((button) =>
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      renderReports();
    }),
  );
  $$(".password-toggle").forEach((button) =>
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.target);
      input.type = input.type === "password" ? "text" : "password";
      const isVisible = input.type === "text";
      button.classList.toggle("is-visible", isVisible);
      button.setAttribute(
        "aria-label",
        isVisible ? "Sembunyikan password" : "Tampilkan password",
      );
    }),
  );
  $("#reports-search").addEventListener("input", renderReports);
  ["#reports-date-from", "#reports-date-to"].forEach((selector) =>
    $(selector).addEventListener("change", renderReports),
  );
  $("#clear-history-dates").addEventListener("click", () => {
    $("#reports-date-from").value = "";
    $("#reports-date-to").value = "";
    renderReports();
  });
  $("#use-location").addEventListener("click", () => {
    if (!navigator.geolocation) {
      toast("Browser ini tidak mendukung lokasi otomatis.", "error");
      return;
    }
    const button = $("#use-location");
    button.disabled = true;
    button.textContent = "⌖ Mencari lokasi...";
    navigator.geolocation.getCurrentPosition(
      (position) => {
        $("#report-location").value =
          `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
        button.disabled = false;
        button.textContent = "⌖ Lokasi terisi";
      },
      () => {
        button.disabled = false;
        button.textContent = "⌖ Gunakan lokasi saya";
        toast("Lokasi belum bisa diakses. Isi lokasi secara manual.", "error");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });
}

async function boot() {
  $("#report-date").value = localDateInputValue();
  bindEvents();
  if (new URLSearchParams(window.location.search).get("logout") === "1") {
    await logout();
    window.history.replaceState({}, "", window.location.pathname + window.location.hash);
    return;
  }
  if (!token()) {
    showAuth("login");
    return;
  }
  if (await refreshData(true)) {
    showApp();
    startPolling();
  } else if (token()) {
    showAuth("login", "Server belum dapat dihubungi. Sesi tetap tersimpan; coba lagi.");
    $("#retry-session").hidden = false;
  }
}

document.addEventListener("DOMContentLoaded", boot);
