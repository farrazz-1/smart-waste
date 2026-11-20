/* SmartWaste — citizen portal API client.
   Uses the same PHP REST API and MySQL database as Android Admin/Petugas. */
(function () {
  'use strict';

  const TOKEN_KEY = 'smartwaste_user_token';
  const SESSION_KEY = TOKEN_KEY;
  const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
  const host = window.location.hostname || 'localhost';
  const API_BASE = String(
    window.SMART_WASTE_API || ('http://' + host + ':8080/Waste2/backend-php/index.php')
  ).replace(/\/+$/, '');

  const TYPES = [
    { id: 'organik', label: 'Organik', icon: 'leaf', color: '#2f5b3a' },
    { id: 'plastik', label: 'Plastik', icon: 'package', color: '#67935a' },
    { id: 'kertas', label: 'Kertas', icon: 'download', color: '#a7c197' },
    { id: 'logam', label: 'Logam', icon: 'weight', color: '#8b9c8f' },
    { id: 'kaca', label: 'Kaca', icon: 'sparkles', color: '#74958c' },
    { id: 'elektronik', label: 'Elektronik', icon: 'grid', color: '#c0a172' },
    { id: 'lainnya', label: 'Lainnya', icon: 'trash', color: '#d5ded0' }
  ];
  const TYPE_BY_ID = Object.fromEntries(TYPES.map((type) => [type.id, type]));

  const STATUS_META = {
    menunggu_verifikasi: { label: 'Menunggu Verifikasi', stageLabel: 'Diterima', badge: 'pending', stage: 0 },
    diproses: { label: 'Diproses', stageLabel: 'Ditangani', badge: 'process', stage: 1 },
    ditugaskan: { label: 'Ditugaskan', stageLabel: 'Ditangani', badge: 'process', stage: 1 },
    diangkut: { label: 'Diangkut', stageLabel: 'Diangkut', badge: 'process', stage: 2 },
    selesai: { label: 'Selesai', stageLabel: 'Selesai', badge: 'done', stage: 3 },
    ditolak: { label: 'Ditolak', stageLabel: 'Ditolak', badge: 'rejected', stage: -1 },
    dibatalkan_warga: { label: 'Dibatalkan warga', stageLabel: 'Dibatalkan', badge: 'cancelled', stage: -1 }
  };

  const EVIDENCE_LABEL = {
    menunggu_pemeriksaan: 'Menunggu pemeriksaan admin',
    disetujui: 'Disetujui admin',
    ditolak: 'Perlu perbaikan bukti'
  };

  const STAGES = [
    { key: 'diterima', label: 'Diterima' },
    { key: 'ditangani', label: 'Ditangani' },
    { key: 'diangkut', label: 'Diangkut' },
    { key: 'selesai', label: 'Selesai' }
  ];

  function pad(value) { return String(value).padStart(2, '0'); }
  function toISODate(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }
  function todayISO() { return toISODate(new Date()); }
  function parseISODate(value) {
    const parts = String(value || '').slice(0, 10).split('-').map(Number);
    if (!parts[0] || !parts[1] || !parts[2]) return new Date(NaN);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  function addDays(value, count) {
    const date = parseISODate(value);
    date.setDate(date.getDate() + count);
    return toISODate(date);
  }

  const Session = {
    create(token) {
      if (!token) throw new Error('Server tidak memberikan token login.');
      localStorage.setItem(TOKEN_KEY, token);
      return token;
    },
    get() {
      try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (error) { return ''; }
    },
    clear() {
      try { localStorage.removeItem(TOKEN_KEY); } catch (error) { /* storage may be unavailable */ }
    },
    restore() {
      // Login is intentionally required when the page is opened again.
      return null;
    }
  };

  function authExpiredEvent() {
    if (typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new Event('smartwaste-auth-expired'));
    }
  }

  async function request(method, path, payload, options) {
    const opts = options || {};
    const headers = { Accept: 'application/json' };
    const requestOptions = { method, headers };
    const isPublicAuthRoute = path === '/auth/login' || path === '/auth/register';
    const needsAuth = opts.auth !== false && !isPublicAuthRoute;
    const token = Session.get();
    if (needsAuth && token) headers.Authorization = 'Bearer ' + token;

    if (payload !== undefined && payload !== null) {
      if (opts.formData) {
        requestOptions.body = payload;
      } else {
        headers['Content-Type'] = 'application/json';
        requestOptions.body = JSON.stringify(payload);
      }
    }

    let response;
    try {
      response = await fetch(API_BASE + path, requestOptions);
    } catch (error) {
      const connectionError = new Error(
        'API Smart Waste belum bisa dihubungi. Pastikan server PHP dan MySQL aktif, lalu periksa alamat API.'
      );
      connectionError.cause = error;
      throw connectionError;
    }

    const text = await response.text();
    let result = {};
    if (text) {
      try { result = JSON.parse(text); } catch (error) { result = {}; }
    }

    if (!response.ok) {
      const apiError = new Error(result.message || result.detail || 'Permintaan tidak dapat diproses.');
      apiError.status = response.status;
      if ([401, 403].includes(response.status) && !path.startsWith('/auth/')) {
        Session.clear();
        authExpiredEvent();
      }
      throw apiError;
    }
    return result;
  }

  function first(...values) {
    for (const value of values) {
      if (value !== undefined && value !== null && value !== '') return value;
    }
    return null;
  }

  function numberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function normalizeStatus(value) {
    const status = String(value || 'menunggu_verifikasi').trim().toLowerCase().replace(/\s+/g, '_');
    if (status === 'dibatalkan' || status === 'cancelled') return 'dibatalkan_warga';
    if (status === 'menunggu' || status === 'pending') return 'menunggu_verifikasi';
    return STATUS_META[status] ? status : 'menunggu_verifikasi';
  }

  function normalizeType(value) {
    const raw = String(value || '').trim().toLowerCase();
    const type = TYPES.find((item) => item.id === raw || item.label.toLowerCase() === raw);
    return type ? type.id : 'lainnya';
  }

  function normalizeUser(user) {
    if (!user) throw new Error('Data akun tidak diterima dari server.');
    if (user.role && user.role !== 'user') {
      throw new Error('Portal ini khusus untuk akun warga. Admin dan Petugas masuk melalui aplikasi Android.');
    }
    return {
      id: String(first(user.id, user.id_user, '')),
      username: String(first(user.username, '')),
      email: String(first(user.email, '')),
      name: String(first(user.name, user.nama, 'Warga')),
      avatar: first(user.profile_photo, user.avatar),
      createdAt: String(first(user.created_at, user.dibuat_pada, user.createdAt, '')),
      role: 'warga'
    };
  }

  function normalizeHistory(entry) {
    return {
      id: String(first(entry.id, '')),
      status: normalizeStatus(entry.status),
      note: String(first(entry.note, entry.catatan, '')),
      at: String(first(entry.at, entry.tanggal_update, entry.created_at, '')),
      by: String(first(entry.by, entry.changed_by, entry.actor, 'Sistem'))
    };
  }

  function normalizeReport(report) {
    const historySource = first(report.timeline, report.riwayat, report.history, []);
    const history = Array.isArray(historySource) ? historySource.map(normalizeHistory) : [];
    const initialPhoto = first(report.photo, report.foto, report.photos && report.photos.initial);
    const locationPhoto = first(
      report.location_evidence_photo,
      report.locationEvidencePhotoUrl,
      report.photos && report.photos.location
    );
    const completionPhoto = first(
      report.completion_proof_photo,
      report.completionProofPhotoUrl,
      report.photos && report.photos.completion
    );
    const rawCompletionStatus = String(first(
      report.completion_status,
      report.completionStatus,
      report.evidence && report.evidence.status
    ) || '');
    const completionStatus = rawCompletionStatus === 'perlu_perbaikan'
      ? 'ditolak'
      : rawCompletionStatus;
    const officer = first(report.worker_name, report.nama_petugas, report.ops && report.ops.officer);
    const vehicle = first(report.vehicle_plate, report.plat_nomor, report.ops && report.ops.vehicle);
    const tpa = first(report.tpa_name, report.nama_tpa, report.ops && report.ops.tpa);
    const createdAt = String(first(report.created_at, report.createdAt, report.report_date, report.tanggal_lapor, ''));
    const updatedAt = String(first(report.updated_at, report.updatedAt, history.length ? history[history.length - 1].at : '', createdAt));
    const date = String(first(report.report_date, report.tanggal_lapor, report.date, createdAt)).slice(0, 10);

    return {
      id: String(first(report.id, report.id_laporan, '')),
      code: String(first(report.code, report.kode_laporan, '')),
      userId: String(first(report.user_id, report.id_user, '')),
      type: normalizeType(first(report.type, report.jenis, report.jenis_sampah)),
      weight: Number(first(report.weight_kg, report.berat_kg, report.weight, report.berat, 0)) || 0,
      location: String(first(report.location, report.lokasi, '')),
      lat: numberOrNull(first(report.lat, report.latitude)),
      lng: numberOrNull(first(report.lng, report.longitude)),
      description: String(first(report.description, report.deskripsi, '')),
      date,
      status: normalizeStatus(report.status),
      photos: {
        initial: initialPhoto,
        location: locationPhoto,
        completion: completionPhoto
      },
      evidence: completionStatus ? {
        status: String(completionStatus),
        checkedAt: String(first(report.completion_submitted_at, report.completionSubmittedAt, '')),
        note: String(first(report.completion_review_note, report.completionReviewNote, ''))
      } : null,
      ops: officer || vehicle || tpa ? {
        officer: String(officer || ''),
        vehicle: String(vehicle || ''),
        vehicleNote: String(first(report.vehicle_note, report.vehicleNote, '')),
        tpa: String(tpa || '')
      } : null,
      history,
      createdAt,
      updatedAt
    };
  }

  function typeLabel(value) {
    return TYPE_BY_ID[normalizeType(value)].label;
  }

  async function toImageBlob(value, prefix) {
    if (typeof Blob !== 'undefined' && value instanceof Blob) return value;
    if (typeof value !== 'string' || value.indexOf('data:image/') !== 0) {
      throw new Error('Foto belum siap diunggah. Pilih atau ambil foto kembali.');
    }
    const response = await fetch(value);
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) throw new Error('Format foto tidak valid.');
    if (blob.size > MAX_PHOTO_BYTES) throw new Error('Ukuran foto maksimal 5 MB.');
    return blob;
  }

  function imageFileName(blob, prefix) {
    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
    return prefix + '.' + ext;
  }

  async function reportFormData(payload) {
    const form = new FormData();
    form.append('jenis_sampah', typeLabel(payload.type));
    form.append('berat_kg', String(payload.weight || 0));
    form.append('lokasi', String(payload.location || '').trim());
    form.append('deskripsi', String(payload.description || '').trim());
    form.append('tanggal_lapor', String(payload.date || ''));
    const photo = await toImageBlob(payload.photo, 'laporan');
    form.append('foto', photo, imageFileName(photo, 'laporan'));
    return form;
  }

  const API = {
    async login(username, password) {
      Session.clear();
      const result = await request('POST', '/auth/login', {
        username: String(username || '').trim(),
        password: String(password || ''),
        client: 'web'
      }, { auth: false });
      Session.create(result.token);
      return normalizeUser(result.user);
    },

    async register(payload) {
      const result = await request('POST', '/auth/register', {
        name: String(payload.name || '').trim(),
        username: String(payload.username || '').trim(),
        password: String(payload.password || ''),
        client: 'web'
      }, { auth: false });
      return result.user ? normalizeUser(result.user) : result;
    },

    async restoreSession() {
      if (!Session.get()) return null;
      try { return await this.getProfile(); } catch (error) { Session.clear(); return null; }
    },

    async logout() {
      if (!Session.get()) { Session.clear(); return { ok: true }; }
      try {
        return await request('POST', '/auth/logout', {}, { auth: true });
      } finally {
        Session.clear();
      }
    },

    async getProfile() {
      const result = await request('GET', '/me');
      return normalizeUser(result.user);
    },

    async listReports() {
      const result = await request('GET', '/laporan/mine');
      const reports = first(result.reports, result.data, []);
      return Array.isArray(reports) ? reports.map(normalizeReport) : [];
    },

    async getReport(userId, reportId) {
      const result = await request('GET', '/laporan/' + encodeURIComponent(reportId));
      return normalizeReport(result.report || result);
    },

    async createReport(userId, payload) {
      const form = await reportFormData(payload);
      const result = await request('POST', '/laporan', form, { formData: true });
      return normalizeReport(result.report || result);
    },

    async updateReport(userId, reportId, patch) {
      const result = await request('PUT', '/laporan/' + encodeURIComponent(reportId), {
        jenis_sampah: typeLabel(patch.type),
        berat_kg: String(patch.weight || 0),
        lokasi: String(patch.location || '').trim(),
        deskripsi: String(patch.description || '').trim(),
        tanggal_lapor: String(patch.date || '')
      });
      return normalizeReport(result.report || result);
    },

    async cancelReport(userId, reportId) {
      return request('DELETE', '/laporan/' + encodeURIComponent(reportId));
    },

    async updateProfile(userId, patch) {
      let user = null;
      if (typeof patch.name === 'string') {
        const result = await request('PUT', '/me', { name: patch.name.trim() });
        user = normalizeUser(result.user);
      }
      if (typeof patch.avatar === 'string' && patch.avatar.indexOf('data:image/') === 0) {
        const photo = await toImageBlob(patch.avatar, 'profil');
        const form = new FormData();
        form.append('foto', photo, imageFileName(photo, 'profil'));
        const result = await request('POST', '/me/foto-profil', form, { formData: true });
        user = normalizeUser(result.user);
      }
      return user || this.getProfile();
    },

    async updateAvatar(userId, dataUrl) {
      return this.updateProfile(userId, { avatar: dataUrl });
    },

    async changePassword(userId, current, next) {
      const result = await request('PATCH', '/me/password', {
        old_password: String(current || ''),
        new_password: String(next || '')
      });
      Session.clear();
      return result;
    }
  };

  function isValidPhotoFile(file) {
    if (!file) return { ok: false, message: 'Pilih foto terlebih dahulu.' };
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.indexOf(file.type) === -1) {
      return { ok: false, message: 'Format foto harus JPG, PNG, atau WebP.' };
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return { ok: false, message: 'Ukuran foto maksimal 5 MB.' };
    }
    return { ok: true };
  }

  window.WasteData = {
    TYPES,
    TYPE_BY_ID,
    STATUS_META,
    EVIDENCE_LABEL,
    STAGES,
    MAX_PHOTO_BYTES,
    SESSION_KEY,
    API,
    Session,
    isValidPhotoFile,
    toISODate,
    todayISO,
    addDays,
    parseISODate
  };
})();
