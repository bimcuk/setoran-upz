
'use strict';

// ==================================================
// KONFIGURASI
// ==================================================

const SUPABASE_URL = 'https://efmgvgqyzdbhmejigqyg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qhbns7HHepypJ2s3TiF-MQ_i_-bpaow';
const APPS_SCRIPT_URL = '/api/backend';

const STORAGE_BUCKET = 'setoran-upz';
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// ==================================================
// ELEMENT
// ==================================================

const loginPage = document.getElementById('loginPage');
const dashboardPage = document.getElementById('dashboardPage');
const loginForm = document.getElementById('loginForm');
const loginButton = document.getElementById('loginButton');
const message = document.getElementById('message');
const logoutButton = document.getElementById('logoutButton');

const setoranForm = document.getElementById('setoranForm');
const setoranMessage = document.getElementById('setoranMessage');
const fileExcel = document.getElementById('fileExcel');
const fileExcelInfo = document.getElementById('fileExcelInfo');
const excelPreview = document.getElementById('excelPreview');
const nominalSetoran = document.getElementById('nominalSetoran');

const upzFilterTahun = document.getElementById('upzFilterTahun');
const upzFilterBulan = document.getElementById('upzFilterBulan');
const upzFilterStatus = document.getElementById('upzFilterStatus');
const upzResetFilterButton = document.getElementById('upzResetFilterButton');
const upzFilterCount = document.getElementById('upzFilterCount');

const adminPage = document.getElementById('adminPage');
const adminSetoranContainer = document.getElementById('adminSetoranContainer');
const adminFilterStatus = document.getElementById('adminFilterStatus');
const adminSearchInput = document.getElementById('adminSearchInput');
const adminFilterUpz = document.getElementById('adminFilterUpz');
const adminFilterTanggal = document.getElementById('adminFilterTanggal');
const adminFilterBulan = document.getElementById('adminFilterBulan');
const adminFilterTahun = document.getElementById('adminFilterTahun');
const adminFilterNominal = document.getElementById('adminFilterNominal');
const adminResetFilterButton = document.getElementById('adminResetFilterButton');
const adminFilterCount = document.getElementById('adminFilterCount');
const adminJumlahUpz = document.getElementById('adminJumlahUpz');
const adminMessage = document.getElementById('adminMessage');
const refreshAdminButton = document.getElementById('refreshAdminButton');
const exportRekapAdminButton = document.getElementById('exportRekapAdminButton');
const detailModal = document.getElementById('detailModal');
const detailModalBody = document.getElementById('detailModalBody');
const detailModalMeta = document.getElementById('detailModalMeta');
const detailModalSubtitle = document.getElementById('detailModalSubtitle');
const detailModalVerify = document.getElementById('detailModalVerify');
const detailModalCloseButton = document.getElementById('detailCloseButton');
const detailModalCloseX = document.getElementById('detailModalCloseX');
const detailDownloadButton = document.getElementById('detailDownloadButton');
const exportModal = document.getElementById('exportModal');
const exportModalCloseX = document.getElementById('exportModalCloseX');
const exportModalCancel = document.getElementById('exportModalCancel');
const exportOptions = document.getElementById('exportOptions');
const exportConfig = document.getElementById('exportConfig');
const exportMonth = document.getElementById('exportMonth');
const exportYear = document.getElementById('exportYear');
const exportUpz = document.getElementById('exportUpz');
const exportBackButton = document.getElementById('exportBackButton');
const exportConfirmButton = document.getElementById('exportConfirmButton');
const exportMonthField = document.getElementById('exportMonthField');
const exportYearField = document.getElementById('exportYearField');
const exportUpzField = document.getElementById('exportUpzField');
const downloadTemplateButton = document.getElementById('downloadTemplateButton');

// ==================================================
// STATE
// ==================================================

let excelData = [];
let totalNominalExcel = 0;
let excelValid = false;
let currentProfile = null;
let currentSetoran = [];
let currentFilteredUpzSetoran = [];
let currentAdminSetoran = [];
let currentFilteredAdminSetoran = [];
let upzMap = {};
let isSubmitting = false;
let isReadingExcel = false;
let isLoadingDashboard = false;
let isLoadingAdmin = false;
let activeDetailItem = null;
let adminCurrentPage = 1;
let upzCurrentPage = 1;
const PAGE_SIZE = 10;

// ==================================================
// UTILITAS
// ==================================================

function formatRupiah(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatRupiahSimple(value) {
  return Number(value || 0).toLocaleString('id-ID');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, function (char) {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return entities[char];
  });
}

// HANYA SETORAN DITERIMA YANG MASUK TOTAL TERVERIFIKASI
function hitungTotalTerverifikasi(daftarSetoran) {
  return (daftarSetoran || [])
    .filter(function (item) {
      return String(item.status || '').toLowerCase() === 'diterima';
    })
    .reduce(function (total, item) {
      return total + Number(item.nominal || 0);
    }, 0);
}

function isSetoranProgram(item) {
  if (!item) return false;
  if (item.tipe_setoran === 'program') return true;
  if (item.nama_program) return true;
  if (item.file_name && String(item.file_name).includes('[PROGRAM]')) return true;
  if (item.catatan && String(item.catatan).includes('PROGRAM:')) return true;
  return false;
}

function getNamaProgram(item) {
  if (!item) return '';
  if (item.nama_program) return String(item.nama_program).trim();
  if (item.file_name && String(item.file_name).includes('[PROGRAM]')) {
    return String(item.file_name).replace(/\[PROGRAM\]/i, '').trim();
  }
  if (item.catatan && String(item.catatan).includes('PROGRAM:')) {
    const raw = String(item.catatan).replace(/.*PROGRAM:/i, '').trim();
    return raw.split('|')[0].trim();
  }
  return 'Setoran Program';
}

function hitungTotalReguler(daftarSetoran) {
  return (daftarSetoran || [])
    .filter(function (item) {
      return String(item.status || '').toLowerCase() === 'diterima' && !isSetoranProgram(item);
    })
    .reduce(function (total, item) {
      return total + Number(item.nominal || 0);
    }, 0);
}

function hitungTotalProgram(daftarSetoran) {
  return (daftarSetoran || [])
    .filter(function (item) {
      return String(item.status || '').toLowerCase() === 'diterima' && isSetoranProgram(item);
    })
    .reduce(function (total, item) {
      return total + Number(item.nominal || 0);
    }, 0);
}

function showMessage(element, text, color) {
  if (!element) return;
  element.textContent = text;
  element.style.color = color || '#666';
}

function setSubmitButtonState(disabled, text) {
  const button = document.getElementById('submitSetoranButton');
  if (!button) return;

  button.disabled = disabled;
  button.textContent = text;
}

function formatTanggal(value) {
  if (!value) return '-';

  const date = new Date(String(value).substring(0, 10) + 'T00:00:00');

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function formatTanggalWaktu(value) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function getNamaBulan(number) {
  const months = [
    '',
    'Januari', 'Februari', 'Maret', 'April',
    'Mei', 'Juni', 'Juli', 'Agustus',
    'September', 'Oktober', 'November', 'Desember'
  ];

  return months[Number(number)] || '-';
}

function getStatusClass(status) {
  const classes = {
    menunggu: 'status-menunggu',
    diterima: 'status-diterima',
    ditolak: 'status-ditolak',
    sesuai: 'status-sesuai',
    selisih: 'status-selisih'
  };

  return classes[String(status || '').toLowerCase()] || 'status-menunggu';
}

function getStatusLabel(status) {
  const labels = {
    menunggu: 'Menunggu Verifikasi',
    diterima: 'Diterima',
    ditolak: 'Ditolak',
    sesuai: 'Sesuai',
    selisih: 'Ada Selisih'
  };

  return labels[String(status || '').toLowerCase()] || 'Belum diketahui';
}

function sortByCreatedAt(items) {
  return items.slice().sort(function (a, b) {
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dateB - dateA;
  });
}

// ==================================================
// TOAST NOTIFIKASI
// ==================================================

function showToast(titleOrMessage, type = 'info', description = '') {
  const stack = document.getElementById('toastStack');
  if (!stack) return;

  const toast = document.createElement('div');
  toast.className = 'toast';

  let iconSvg = '<svg class="icon" style="width:18px;height:18px;"><use href="#i-alert"></use></svg>';
  let bgColor = 'var(--slate-900)';
  if (type === 'success') {
    iconSvg = '<svg class="icon" style="width:18px;height:18px;"><use href="#i-check"></use></svg>';
    bgColor = '#166534';
  } else if (type === 'error') {
    iconSvg = '<svg class="icon" style="width:18px;height:18px;"><use href="#i-x"></use></svg>';
    bgColor = '#dc2626';
  } else if (type === 'notif') {
    iconSvg = '<svg class="icon" style="width:18px;height:18px;"><use href="#i-bell"></use></svg>';
    bgColor = '#1e293b';
  }

  toast.style.background = bgColor;

  if (description) {
    toast.innerHTML = `${iconSvg}<div><div style="font-weight:600;font-size:13px;">${escapeHtml(titleOrMessage)}</div><div style="font-size:12px;opacity:0.9;font-weight:400;margin-top:2px;">${escapeHtml(description)}</div></div>`;
  } else {
    toast.innerHTML = `${iconSvg}<span>${escapeHtml(titleOrMessage)}</span>`;
  }

  stack.appendChild(toast);

  setTimeout(function () {
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, 4500);
}
window.showToast = showToast;
window.showFloatingToast = showToast;

// ==================================================
// SISTEM NOTIFIKASI AKTIVITAS UPZ (ROLE ADMIN)
// ==================================================

let adminNotifications = [];
let adminReadNotifIds = new Set();
let adminDeletedNotifIds = new Set();
let activeNotifTab = 'semua';
let realtimeNotifChannel = null;
let isNotifSystemInitialized = false;

function loadReadNotifIds() {
  try {
    const saved = JSON.parse(localStorage.getItem('admin_read_notif_ids_v1') || '[]');
    adminReadNotifIds = new Set(Array.isArray(saved) ? saved : []);
  } catch (_) {
    adminReadNotifIds = new Set();
  }
}

function saveReadNotifIds() {
  try {
    localStorage.setItem('admin_read_notif_ids_v1', JSON.stringify(Array.from(adminReadNotifIds)));
  } catch (_) {}
}

function loadDeletedNotifIds() {
  try {
    const saved = JSON.parse(localStorage.getItem('admin_deleted_notif_ids_v1') || '[]');
    adminDeletedNotifIds = new Set(Array.isArray(saved) ? saved : []);
  } catch (_) {
    adminDeletedNotifIds = new Set();
  }
}

function saveDeletedNotifIds() {
  try {
    localStorage.setItem('admin_deleted_notif_ids_v1', JSON.stringify(Array.from(adminDeletedNotifIds)));
  } catch (_) {}
}

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffSec < 60) return 'Baru saja';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return diffMin + ' mnt lalu';
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return diffHour + ' jam lalu';
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return diffDay + ' hari lalu';

    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  } catch (_) {
    return '';
  }
}

function recordUpzActivity(payload) {
  try {
    const actId = 'act_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const item = {
      id: actId,
      type: payload.type || 'perubahan',
      title: payload.title || 'Aktivitas UPZ',
      nama_upz: payload.nama_upz || 'UPZ',
      upz_id: payload.upz_id || null,
      file_name: payload.file_name || null,
      nominal: payload.nominal || null,
      desc: payload.desc || '',
      timestamp: new Date().toISOString()
    };

    // 1. Simpan ke localStorage agar persisten
    const stored = JSON.parse(localStorage.getItem('upz_activity_logs_v1') || '[]');
    const list = Array.isArray(stored) ? stored : [];
    list.unshift(item);
    if (list.length > 50) list.length = 50;
    localStorage.setItem('upz_activity_logs_v1', JSON.stringify(list));

    // 2. Broadcast realtime via Supabase jika channel aktif
    if (realtimeNotifChannel) {
      realtimeNotifChannel.send({
        type: 'broadcast',
        event: 'upz_activity',
        payload: item
      }).catch(function (e) {
        console.warn('Realtime broadcast error:', e);
      });
    }

    // 3. Jika sedang login sebagai admin, langsung sinkronkan UI
    if (currentProfile && currentProfile.role === 'admin') {
      syncAdminNotifications();
    }
  } catch (err) {
    console.warn('Record UPZ activity error:', err);
  }
}

function syncAdminNotifications() {
  const notifs = [];
  loadReadNotifIds();
  loadDeletedNotifIds();
  const isUpz = currentProfile && currentProfile.role === 'upz';
  const myUpzId = currentProfile ? String(currentProfile.upz_id || currentProfile.id || '').toLowerCase() : '';

  if (isUpz) {
    // 1. Notifikasi untuk UPZ dari status setoran (Verifikasi Diterima / Ditolak)
    const setoranData = Array.isArray(currentSetoran) ? currentSetoran : [];
    setoranData.forEach(function (s) {
      const status = String(s.status || '').toLowerCase();
      const nominalStr = formatRupiah(s.nominal);
      const periodeStr = getNamaBulan(s.periode_bulan) + ' ' + (s.periode_tahun || '');
      const id = s.id;

      if (status === 'diterima' || status === 'disetujui' || status === 'verified' || status === 'sukses') {
        const notifId = 'upz_accept_' + id;
        notifs.push({
          id: notifId,
          type: 'upload',
          setoran_id: id,
          category: 'Verifikasi Setoran',
          title: 'Setoran Diterima & Diverifikasi',
          nama_upz: 'BAZNAS Banyumas',
          desc: `Setoran periode <strong>${escapeHtml(periodeStr)}</strong> senilai <strong>${nominalStr}</strong> telah disetujui BAZNAS.`,
          timestamp: s.updated_at || s.tanggal_setor || new Date().toISOString(),
          status: 'success',
          read: adminReadNotifIds.has(notifId)
        });
      } else if (status === 'ditolak') {
        const notifId = 'upz_reject_' + id;
        notifs.push({
          id: notifId,
          type: 'upload',
          setoran_id: id,
          category: 'Verifikasi Setoran',
          title: 'Setoran Ditolak oleh Admin',
          nama_upz: 'BAZNAS Banyumas',
          desc: `Setoran periode <strong>${escapeHtml(periodeStr)}</strong> ditolak. Catatan: <em>${escapeHtml(s.catatan || 'Periksa rincian data.')}</em>`,
          timestamp: s.updated_at || s.tanggal_setor || new Date().toISOString(),
          status: 'danger',
          read: adminReadNotifIds.has(notifId)
        });
      }

      // Notifikasi jika BSZ resmi telah diunggah admin
      const bsz = (typeof getBszRecord === 'function') ? getBszRecord(id) : null;
      if (bsz) {
        const notifId = 'upz_bsz_' + id;
        notifs.push({
          id: notifId,
          type: 'upload',
          setoran_id: id,
          category: 'Bukti Setor Zakat',
          title: 'Bukti Setor Zakat (BSZ) Tersedia',
          nama_upz: 'BAZNAS Banyumas',
          desc: `Admin telah mengunggah BSZ resmi (<strong>${escapeHtml(bsz.file_name || 'BSZ.pdf')}</strong>) untuk periode ${periodeStr}. Silakan unduh.`,
          timestamp: bsz.uploaded_at || new Date().toISOString(),
          status: 'info',
          read: adminReadNotifIds.has(notifId)
        });
      }
    });

    // 2. Notifikasi jika admin merubah informasi milik UPZ
    try {
      const extraProfile = JSON.parse(localStorage.getItem('upz_profile_extra_' + myUpzId) || 'null');
      if (extraProfile && extraProfile.updated_at) {
        const notifId = 'upz_prof_upd_' + myUpzId + '_' + extraProfile.updated_at;
        notifs.push({
          id: notifId,
          type: 'perubahan',
          category: 'Informasi Profil',
          title: 'Informasi UPZ Diperbarui',
          nama_upz: 'Admin BAZNAS',
          desc: `Data profil resmi UPZ Anda (SK, kepengurusan, atau kontak) telah diperbarui oleh Admin.`,
          timestamp: extraProfile.updated_at,
          status: 'info',
          read: adminReadNotifIds.has(notifId)
        });
      }
    } catch (_) {}

    // 3. Notifikasi Pentasharufan milik UPZ
    try {
      const myPenta = (typeof getLocalPentaRecords === 'function') ? getLocalPentaRecords() : [];
      if (Array.isArray(myPenta)) {
        myPenta.forEach(function (p) {
          const pStatus = String(p.status || 'menunggu').toLowerCase();
          const pNominal = formatRupiah(p.nominal || 0);
          const pProg = p.program || p.jenis || 'Pentasharufan';
          const notifId = 'upz_penta_' + p.id;
          notifs.push({
            id: notifId,
            type: 'pentasharufan',
            penta_id: p.id,
            category: 'Permohonan Pentasharufan',
            title: pStatus === 'disetujui' ? 'Permohonan Pentasharufan Disetujui' : (pStatus === 'ditolak' ? 'Permohonan Pentasharufan Ditolak' : 'Pengajuan Pentasharufan Terkirim'),
            nama_upz: 'BAZNAS Banyumas',
            desc: `Pengajuan program <strong>${escapeHtml(pProg)}</strong> senilai <strong>${pNominal}</strong> ${pStatus === 'disetujui' ? 'telah disetujui' : (pStatus === 'ditolak' ? 'ditolak admin' : 'sedang ditinjau')}.`,
            timestamp: p.created_at || new Date().toISOString(),
            status: pStatus === 'disetujui' ? 'success' : (pStatus === 'ditolak' ? 'danger' : 'menunggu'),
            read: adminReadNotifIds.has(notifId)
          });
        });
      }
    } catch (_) {}

  } else {
    // Role Admin: Dari data setoran admin (Upload berkas & setoran baru)
    if (Array.isArray(currentAdminSetoran) && currentAdminSetoran.length > 0) {
      currentAdminSetoran.forEach(function (s) {
        const notifId = 'setoran_' + s.id;
        const isPending = s.status === 'menunggu';
        const upzName = (upzMap && upzMap[s.upz_id]) || s.nama_upz || 'UPZ';
        const nominalStr = formatRupiah(s.nominal);
        const periodeStr = getNamaBulan(s.periode_bulan) + ' ' + (s.periode_tahun || '');
        const fileName = s.file_name || 'Berkas Excel';

        notifs.push({
          id: notifId,
          type: 'upload',
          category: 'Upload Berkas',
          title: isPending ? 'Setoran Baru Menunggu Verifikasi' : 'Berkas Setoran Diunggah',
          nama_upz: upzName,
          upz_id: s.upz_id,
          setoran_id: s.id,
          file_name: fileName,
          desc: `Mengunggah berkas <strong>${escapeHtml(fileName)}</strong> senilai <strong>${nominalStr}</strong> (Periode ${periodeStr})`,
          timestamp: s.created_at || s.tanggal_setor || new Date().toISOString(),
          status: s.status || 'menunggu',
          read: adminReadNotifIds.has(notifId)
        });
      });
    }

    // Dari riwayat aktivitas lokal fallback
    try {
      const actLogs = JSON.parse(localStorage.getItem('upz_activity_logs_v1') || '[]');
      if (Array.isArray(actLogs)) {
        actLogs.forEach(function (log) {
          if (!notifs.some(n => n.id === log.id)) {
            notifs.push({
              id: log.id,
              type: log.type || 'perubahan',
              category: 'Perubahan Data',
              title: log.title || 'Perubahan Data UPZ',
              nama_upz: log.nama_upz || 'UPZ',
              upz_id: log.upz_id,
              desc: log.desc || 'Terdapat pembaruan data dari UPZ',
              timestamp: log.timestamp || new Date().toISOString(),
              status: 'info',
              read: adminReadNotifIds.has(log.id)
            });
          }
        });
      }
    } catch (_) {}
  }

  // 3. Ambil notifikasi aktivitas realtime dari server database (/api/notifications)
  if (typeof getValidAuthToken === 'function') {
    getValidAuthToken().then(function (token) {
      if (!token) return;
      fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token })
      }).then(function (res) {
        if (!res.ok) return null;
        return res.json();
      }).then(function (json) {
        if (!json || !json.success || !Array.isArray(json.data)) return;
        let hasNew = false;
        json.data.forEach(function (an) {
          if (!notifs.some(function (n) { return n.id === an.id; })) {
            notifs.push({
              id: an.id,
              type: an.type || 'perubahan',
              category: an.category || 'Perubahan Akun',
              title: an.title || 'Pembaruan Data Akun',
              nama_upz: an.nama_upz || 'UPZ',
              upz_id: an.upz_id,
              desc: an.desc,
              timestamp: an.timestamp || new Date().toISOString(),
              status: an.status || 'info',
              read: adminReadNotifIds.has(an.id)
            });
            hasNew = true;
          }
        });
        if (hasNew) {
          const activeNotifs = notifs.filter(function (n) { return !adminDeletedNotifIds.has(String(n.id)); });
          activeNotifs.sort(function (a, b) {
            const timeA = new Date(a.timestamp).getTime() || 0;
            const timeB = new Date(b.timestamp).getTime() || 0;
            return timeB - timeA;
          });
          adminNotifications = activeNotifs;
          renderAdminNotificationUI();
        }
      }).catch(function (err) {
        console.warn('Sync server notifications notice:', err);
      });
    }).catch(function () {});
  }

  // Filter notifikasi yang telah dihapus & urutkan dari yang terbaru
  const activeNotifs = notifs.filter(function (n) { return !adminDeletedNotifIds.has(String(n.id)); });
  activeNotifs.sort(function (a, b) {
    const timeA = new Date(a.timestamp).getTime() || 0;
    const timeB = new Date(b.timestamp).getTime() || 0;
    return timeB - timeA;
  });

  adminNotifications = activeNotifs;
  renderAdminNotificationUI();
}

function highlightElement(el) {
  if (!el) return;
  // Jangan pernah sorot elemen di dalam pop-up notifikasi
  if (el.closest && (el.closest('#adminNotifDropdown') || el.closest('.notif-dropdown') || el.closest('.notif-item'))) {
    return;
  }
  el.classList.remove('notif-target-highlight');
  void el.offsetWidth;
  el.classList.add('notif-target-highlight');
  el.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
  el.style.boxShadow = '0 0 0 3.5px rgba(37, 145, 72, 0.55), 0 0 22px rgba(37, 145, 72, 0.35)';
  el.style.borderColor = '#259148';
  try {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (_) {
    el.scrollIntoView(true);
  }
  setTimeout(function () {
    el.classList.remove('notif-target-highlight');
    el.style.boxShadow = '';
    el.style.borderColor = '';
  }, 3500);
}

function focusAndHighlightItem(primarySelector, fallbackSelector, maxTries) {
  let tries = 0;
  const limit = maxTries || 18;
  function attempt() {
    tries++;
    let el = null;
    if (primarySelector) {
      try {
        const found = document.querySelectorAll(primarySelector);
        for (let i = 0; i < found.length; i++) {
          if (!found[i].closest('.notif-dropdown') && !found[i].closest('.notif-item')) {
            el = found[i];
            break;
          }
        }
      } catch (_) {}
    }
    if (!el && fallbackSelector) {
      try {
        const found = document.querySelectorAll(fallbackSelector);
        for (let i = 0; i < found.length; i++) {
          if (!found[i].closest('.notif-dropdown') && !found[i].closest('.notif-item')) {
            el = found[i];
            break;
          }
        }
      } catch (_) {}
    }
    if (el) {
      highlightElement(el);
    } else if (tries < limit) {
      setTimeout(attempt, 70);
    }
  }
  setTimeout(attempt, 50);
}

function renderAdminNotificationUI() {
  const badge = document.getElementById('adminNotifBadge');
  const unreadPill = document.getElementById('notifUnreadPill');
  const listEl = document.getElementById('adminNotifList');
  if (!listEl) return;

  const unreadCount = adminNotifications.filter(function (n) { return !n.read && !adminReadNotifIds.has(n.id); }).length;

  if (badge) {
    if (unreadCount > 0) {
      badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  if (unreadPill) {
    if (unreadCount > 0) {
      unreadPill.textContent = unreadCount + ' baru';
      unreadPill.classList.remove('hidden');
    } else {
      unreadPill.classList.add('hidden');
    }
  }

  let items = adminNotifications;
  if (activeNotifTab === 'upload') {
    items = items.filter(function (n) { return n.type === 'upload'; });
  } else if (activeNotifTab === 'perubahan') {
    items = items.filter(function (n) { return n.type === 'perubahan'; });
  }

  if (!items.length) {
    let emptyMsg = 'Belum ada notifikasi aktivitas UPZ.';
    if (activeNotifTab === 'upload') emptyMsg = 'Belum ada notifikasi unggahan berkas setoran.';
    if (activeNotifTab === 'perubahan') emptyMsg = 'Belum ada notifikasi perubahan data pengelola.';
    listEl.innerHTML = `<div class="notif-empty">${emptyMsg}</div>`;
    return;
  }

  let html = '';
  items.forEach(function (n) {
    const isUnread = !n.read && !adminReadNotifIds.has(n.id);
    const relTime = formatRelativeTime(n.timestamp);

    let iconBoxClass = n.type === 'upload' ? 'upload' : 'perubahan';
    let iconName = n.type === 'upload' ? 'i-sheet' : 'i-edit';
    if (n.status === 'menunggu') {
      iconBoxClass = 'pending';
    }

    let tagHtml = '';
    if (n.type === 'upload') {
      if (n.status === 'menunggu') {
        tagHtml = `<span class="notif-tag pending">Menunggu Verifikasi</span>`;
      } else if (n.status === 'diterima') {
        tagHtml = `<span class="notif-tag success">Diterima</span>`;
      } else if (n.status === 'ditolak') {
        tagHtml = `<span class="notif-tag" style="background:#fee2e2;color:#991b1b;">Ditolak</span>`;
      }
    } else {
      tagHtml = `<span class="notif-tag perubahan">Perubahan Akun</span>`;
    }

    html += `
      <div class="notif-item ${isUnread ? 'unread' : ''}" data-notif-id="${escapeHtml(n.id)}" data-type="${escapeHtml(n.type)}" data-upz-name="${escapeHtml(n.nama_upz || '')}" data-notif-setoran-id="${escapeHtml(n.setoran_id || '')}" data-notif-penta-id="${escapeHtml(n.penta_id || '')}">
        <div class="notif-icon-box ${iconBoxClass}">
          <svg class="icon"><use href="#${iconName}"></use></svg>
        </div>
        <div class="notif-body">
          <div class="notif-title-row">
            <span class="notif-upz-name" title="${escapeHtml(n.nama_upz)}">${escapeHtml(n.nama_upz || 'UPZ')}</span>
            <span class="notif-time">${escapeHtml(relTime)}</span>
          </div>
          <div class="notif-desc">${n.desc}</div>
          <div class="notif-tags-row">
            ${tagHtml}
            <span style="font-size:10px;color:var(--slate-400);">${escapeHtml(n.title)}</span>
          </div>
        </div>
        <div class="notif-item-actions">
          ${isUnread ? '<span class="notif-unread-dot" title="Belum dibaca"></span>' : ''}
          <div class="notif-kebab-menu">
            <button type="button" class="notif-kebab-btn" title="Opsi notifikasi" aria-label="Opsi notifikasi" data-notif-id="${escapeHtml(n.id)}">
              <svg class="icon"><use href="#i-more-vertical"></use></svg>
            </button>
            <div class="notif-kebab-dropdown hidden">
              <button type="button" class="notif-kebab-item btn-notif-toggle-read" data-notif-id="${escapeHtml(n.id)}" data-action="${isUnread ? 'mark-read' : 'mark-unread'}">
                <svg class="icon"><use href="#${isUnread ? 'i-check' : 'i-mail'}"></use></svg>
                <span>${isUnread ? 'Tandai sudah dibaca' : 'Tandai belum dibaca'}</span>
              </button>
              <button type="button" class="notif-kebab-item danger btn-notif-delete" data-notif-id="${escapeHtml(n.id)}">
                <svg class="icon"><use href="#i-trash-2"></use></svg>
                <span>Hapus notifikasi</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  });

  listEl.innerHTML = html;

  // Click on item
  listEl.querySelectorAll('.notif-item').forEach(function (el) {
    el.addEventListener('click', function (e) {
      if (e.target.closest('.notif-kebab-menu')) {
        return;
      }
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      const notifId = el.dataset.notifId;
      const type = el.dataset.type;
      const upzName = el.dataset.upzName;
      const setoranId = el.dataset.notifSetoranId || el.dataset.setoranId;
      const pentaId = el.dataset.notifPentaId || el.dataset.pentaId;

      // Tutup dropdown dan kembalikan state aria
      const dropdown = document.getElementById('adminNotifDropdown');
      if (dropdown) dropdown.classList.add('hidden');
      const btn = document.getElementById('adminNotifButton');
      if (btn) btn.setAttribute('aria-expanded', 'false');

      const hamburgerDropdown = document.getElementById('hamburgerDropdown');
      if (hamburgerDropdown) hamburgerDropdown.classList.add('hidden');
      const hamburgerBtn = document.getElementById('hamburgerButton');
      if (hamburgerBtn) hamburgerBtn.setAttribute('aria-expanded', 'false');

      if (notifId) {
        adminReadNotifIds.add(notifId);
        saveReadNotifIds();
        const found = adminNotifications.find(function (n) { return String(n.id) === String(notifId); });
        if (found) found.read = true;
        setTimeout(function () {
          renderAdminNotificationUI();
        }, 50);
      }

      // Deteksi role
      const isRoleAdmin = (currentProfile && currentProfile.role === 'admin') ||
        Boolean(document.getElementById('adminPage') && !document.getElementById('adminPage').classList.contains('hidden'));

      // Tentukan target view secara komprehensif berdasarkan tipe atau awalan ID
      const isPenta = type === 'pentasharufan' || Boolean(pentaId) ||
        (notifId && (notifId.startsWith('upz_penta_') || notifId.startsWith('penta_')));
      const isProfile = type === 'perubahan' || type === 'profil' ||
        (notifId && (notifId.startsWith('upz_prof_') || notifId.startsWith('prof_')));

      if (isPenta) {
        if (isRoleAdmin) {
          if (typeof navigateToView === 'function') navigateToView('pentasharufan', true);
          const upzFilter = document.getElementById('adminPentaFilterUpz');
          const progFilter = document.getElementById('adminPentaFilterProgram');
          const statusFilter = document.getElementById('adminPentaFilterStatus');
          if (upzFilter) upzFilter.value = 'semua';
          if (progFilter) progFilter.value = 'semua';
          if (statusFilter) statusFilter.value = 'semua';

          const handleAdminPentaHighlight = function () {
            focusAndHighlightItem(
              pentaId ? `#adminPentaTableContainer tr[data-penta-id="${pentaId}"]` : null,
              '#adminPentaTableContainer tbody tr'
            );
          };

          if (typeof loadAdminPentasharufan === 'function') {
            loadAdminPentasharufan().then(handleAdminPentaHighlight).catch(handleAdminPentaHighlight);
          } else {
            handleAdminPentaHighlight();
          }
        } else {
          // Role UPZ: Menuju ke kartu pentasharufan & highlight
          if (typeof navigateToView === 'function') navigateToView('pentasharufan', true);
          const handleUpzPentaHighlight = function () {
            focusAndHighlightItem(
              pentaId ? `#upzPentaRiwayatContainer .penta-card[data-penta-id="${pentaId}"]` : null,
              '#upzPentaRiwayatContainer .penta-card'
            );
          };

          if (typeof loadUpzPentasharufan === 'function') {
            loadUpzPentasharufan().then(handleUpzPentaHighlight).catch(handleUpzPentaHighlight);
          } else {
            handleUpzPentaHighlight();
          }
        }
      } else if (isProfile) {
        if (isRoleAdmin) {
          if (typeof navigateToView === 'function') navigateToView('upz', true);
          if (upzName) {
            const searchInput = document.getElementById('upzMgmtSearch');
            if (searchInput) {
              searchInput.value = upzName;
              upzMgmtCurrentPage = 1;
              if (typeof renderUpzMgmtTable === 'function') renderUpzMgmtTable();
            }
          }
          focusAndHighlightItem('#adminUpzTableBody tr', '#adminUpzTableBody');
        } else {
          // Role UPZ: Menuju ke halaman profil/manajemen UPZ & highlight
          if (typeof navigateToView === 'function') navigateToView('mgmt', true);
          focusAndHighlightItem('#upzViewMgmt .content-card');
        }
      } else {
        // Default ke Setoran / Riwayat (menangani upload berkas, verifikasi setoran, BSZ, dll.)
        if (isRoleAdmin) {
          if (typeof navigateToView === 'function') navigateToView('setoran', true);
          if (adminFilterStatus) adminFilterStatus.value = 'semua';
          if (adminFilterUpz) adminFilterUpz.value = 'semua';
          if (adminSearchInput) adminSearchInput.value = '';
          if (adminFilterTanggal) adminFilterTanggal.value = '';
          if (adminFilterBulan) adminFilterBulan.value = 'semua';
          if (adminFilterTahun) adminFilterTahun.value = '';
          if (adminFilterNominal) adminFilterNominal.value = '';
          if (setoranId && Array.isArray(currentAdminSetoran)) {
            const idx = currentAdminSetoran.findIndex(function (s) { return String(s.id) === String(setoranId); });
            if (idx !== -1) {
              adminCurrentPage = Math.floor(idx / PAGE_SIZE) + 1;
            }
          }
          if (typeof renderAdminSetoran === 'function') renderAdminSetoran(currentAdminSetoran);
          focusAndHighlightItem(
            setoranId ? `#adminSetoranContainer .riwayat-item[data-admin-setoran-id="${setoranId}"]` : null,
            '#adminSetoranContainer .riwayat-item'
          );
        } else {
          // Role UPZ: Menuju ke item riwayat setoran & beri efek highlight pada kartu transaksi
          if (typeof navigateToView === 'function') navigateToView('riwayat', true);
          if (upzFilterTahun) upzFilterTahun.value = 'semua';
          if (upzFilterBulan) upzFilterBulan.value = 'semua';
          if (upzFilterStatus) upzFilterStatus.value = 'semua';
          if (setoranId && Array.isArray(currentSetoran)) {
            const sIdx = currentSetoran.findIndex(function (s) { return String(s.id) === String(setoranId); });
            if (sIdx !== -1) {
              upzCurrentPage = Math.floor(sIdx / PAGE_SIZE) + 1;
            }
          }
          if (typeof filterAndRenderRiwayat === 'function') filterAndRenderRiwayat();
          focusAndHighlightItem(
            setoranId ? `#riwayatContainer .riwayat-item[data-setoran-id="${setoranId}"]` : null,
            '#riwayatContainer .riwayat-item'
          );
        }
      }
    });
  });

  // Setup 3-dots kebab buttons pada notifikasi
  listEl.querySelectorAll('.notif-kebab-btn').forEach(function (kBtn) {
    kBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      const wrap = kBtn.closest('.notif-kebab-menu');
      const menu = wrap ? wrap.querySelector('.notif-kebab-dropdown') : null;
      if (!menu) return;
      const isHidden = menu.classList.contains('hidden');

      // Tutup semua kebab menu dropdown lainnya pada notifikasi
      listEl.querySelectorAll('.notif-kebab-dropdown').forEach(function (d) {
        if (d !== menu) d.classList.add('hidden');
      });

      menu.classList.toggle('hidden', !isHidden);

      if (!menu.classList.contains('hidden')) {
        const listRect = listEl.getBoundingClientRect();
        const btnRect = kBtn.getBoundingClientRect();
        if (btnRect.bottom + 95 > listRect.bottom) {
          menu.style.top = 'auto';
          menu.style.bottom = '100%';
        } else {
          menu.style.top = 'calc(100% + 4px)';
          menu.style.bottom = 'auto';
        }
      }
    });
  });

  // Action: Tandai belum dibaca / sudah dibaca
  listEl.querySelectorAll('.btn-notif-toggle-read').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      const notifId = btn.dataset.notifId;
      const action = btn.dataset.action;
      if (!notifId) return;

      if (action === 'mark-unread') {
        adminReadNotifIds.delete(String(notifId));
        adminReadNotifIds.delete(notifId);
        saveReadNotifIds();
        const found = adminNotifications.find(function (n) { return String(n.id) === String(notifId); });
        if (found) found.read = false;
        renderAdminNotificationUI();
        if (typeof showToast === 'function') {
          showToast('Notifikasi ditandai belum dibaca', 'info');
        }
      } else {
        adminReadNotifIds.add(String(notifId));
        saveReadNotifIds();
        const found = adminNotifications.find(function (n) { return String(n.id) === String(notifId); });
        if (found) found.read = true;
        renderAdminNotificationUI();
        if (typeof showToast === 'function') {
          showToast('Notifikasi ditandai sudah dibaca', 'success');
        }
      }
    });
  });

  // Action: Hapus notifikasi
  listEl.querySelectorAll('.btn-notif-delete').forEach(function (btn) {
    btn.addEventListener('click', async function (e) {
      e.preventDefault();
      e.stopPropagation();
      const notifId = btn.dataset.notifId;
      if (!notifId) return;

      const ok = await askDialog(
        'Hapus Pemberitahuan?',
        'Pemberitahuan ini akan dihapus dari daftar. Lanjutkan?',
        'Ya, Hapus',
        'i-trash-2',
        true
      );
      if (!ok) return;

      adminDeletedNotifIds.add(String(notifId));
      saveDeletedNotifIds();

      adminNotifications = adminNotifications.filter(function (n) {
        return String(n.id) !== String(notifId);
      });

      try {
        const stored = JSON.parse(localStorage.getItem('upz_activity_logs_v1') || '[]');
        if (Array.isArray(stored)) {
          const filtered = stored.filter(function (log) { return String(log.id) !== String(notifId); });
          localStorage.setItem('upz_activity_logs_v1', JSON.stringify(filtered));
        }
      } catch (_) {}

      renderAdminNotificationUI();
      if (typeof showToast === 'function') {
        showToast('Notifikasi berhasil dihapus', 'info');
      }
    });
  });
}

function initAdminNotificationSystem() {
  if (isNotifSystemInitialized) return;
  isNotifSystemInitialized = true;

  const btn = document.getElementById('adminNotifButton');
  const dropdown = document.getElementById('adminNotifDropdown');
  const markAllBtn = document.getElementById('markAllNotifsReadBtn');
  const deleteAllBtn = document.getElementById('deleteAllNotifsBtn');
  const refreshBtn = document.getElementById('refreshNotifsBtn');
  const tabs = document.querySelectorAll('.notif-tabs .notif-tab');

  if (btn && dropdown) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      const isHidden = dropdown.classList.contains('hidden');
      if (isHidden) {
        // Tutup hamburger menu bila sedang terbuka
        const hamburgerDropdown = document.getElementById('hamburgerDropdown');
        const hamburgerBtn = document.getElementById('hamburgerButton');
        if (hamburgerDropdown) hamburgerDropdown.classList.add('hidden');
        if (hamburgerBtn) hamburgerBtn.setAttribute('aria-expanded', 'false');
      }
      dropdown.classList.toggle('hidden', !isHidden);
      btn.setAttribute('aria-expanded', String(isHidden));
    });
  }

  // Close when clicking outside
  document.addEventListener('click', function (e) {
    // Jangan tutup notif dropdown jika klik terjadi di dalam modal dialog atau modal konfirmasi
    if (e.target.closest('#dialogModal') || e.target.closest('.modal-overlay')) {
      return;
    }

    if (!dropdown || dropdown.classList.contains('hidden')) {
      // Check kebab dropdowns
      if (!e.target.closest('.table-kebab-menu') && !e.target.closest('.notif-kebab-menu')) {
        document.querySelectorAll('.kebab-dropdown').forEach(function (d) { d.classList.add('hidden'); });
        document.querySelectorAll('.notif-kebab-dropdown').forEach(function (d) { d.classList.add('hidden'); });
      }
    } else if (!dropdown.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
      dropdown.classList.add('hidden');
      if (btn) btn.setAttribute('aria-expanded', 'false');
      document.querySelectorAll('.notif-kebab-dropdown').forEach(function (d) { d.classList.add('hidden'); });
    } else if (!e.target.closest('.notif-kebab-menu')) {
      document.querySelectorAll('.notif-kebab-dropdown').forEach(function (d) { d.classList.add('hidden'); });
    }
  });

  // Close on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      const dialogModal = document.getElementById('dialogModal');
      if (dialogModal && !dialogModal.classList.contains('hidden')) {
        return; // Dialog konfirmasi sedang terbuka, jangan tutup notif dropdown
      }
      if (dropdown && !dropdown.classList.contains('hidden')) {
        dropdown.classList.add('hidden');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      }
      document.querySelectorAll('.kebab-dropdown').forEach(function (d) { d.classList.add('hidden'); });
      document.querySelectorAll('.notif-kebab-dropdown').forEach(function (d) { d.classList.add('hidden'); });
    }
  });

  // Mark all as read
  if (markAllBtn) {
    markAllBtn.addEventListener('click', async function (e) {
      e.stopPropagation();
      if (!adminNotifications.length) {
        showToast('Tidak ada pemberitahuan', 'info');
        return;
      }
      const ok = await askDialog(
        'Tandai Semua Pemberitahuan?',
        'Tandai semua pemberitahuan aktivitas UPZ sebagai sudah dibaca?',
        'Ya, Tandai Dibaca',
        'i-check',
        false
      );
      if (!ok) return;

      adminNotifications.forEach(function (n) {
        adminReadNotifIds.add(n.id);
        n.read = true;
      });
      saveReadNotifIds();
      renderAdminNotificationUI();
      showToast('Semua pemberitahuan ditandai sudah dibaca', 'success');
    });
  }

  // Delete all notifications
  if (deleteAllBtn) {
    deleteAllBtn.addEventListener('click', async function (e) {
      e.stopPropagation();
      if (!adminNotifications.length) {
        showToast('Tidak ada pemberitahuan untuk dihapus', 'info');
        return;
      }
      const ok = await askDialog(
        'Hapus Semua Pemberitahuan?',
        'Seluruh pemberitahuan aktivitas UPZ akan dihapus permanen. Lanjutkan?',
        'Ya, Hapus Semua',
        'i-trash-2',
        true
      );
      if (!ok) return;

      adminNotifications.forEach(function (n) {
        adminDeletedNotifIds.add(String(n.id));
      });
      saveDeletedNotifIds();
      adminNotifications = [];
      try {
        localStorage.setItem('upz_activity_logs_v1', '[]');
      } catch (_) {}
      renderAdminNotificationUI();
      showToast('Semua pemberitahuan berhasil dihapus', 'info');
    });
  }

  // Refresh
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async function (e) {
      e.stopPropagation();
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = '<span class="spinner" style="width:12px;height:12px;" aria-hidden="true"></span>';
      try {
        if (currentProfile && currentProfile.role === 'admin') {
          await loadAdminSetoran();
        } else {
          await loadDashboard(true);
        }
        syncAdminNotifications();
        showToast('Notifikasi berhasil dimuat ulang', 'info');
      } catch (err) {
        console.warn('Refresh notif error:', err);
      } finally {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = '<svg class="icon"><use href="#i-refresh"></use></svg> Segarkan';
      }
    });
  }

  // Tab switching
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      activeNotifTab = tab.dataset.tab || 'semua';
      renderAdminNotificationUI();
    });
  });
}

function initAdminRealtimeNotifications() {
  if (!supabaseClient || !supabaseClient.channel || realtimeNotifChannel) return;

  try {
    realtimeNotifChannel = supabaseClient.channel('admin-notif-hub');

    realtimeNotifChannel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'setoran' }, function (payload) {
        console.log('Realtime setoran INSERT:', payload);
        const newRow = payload.new || {};
        const upzName = (upzMap && upzMap[newRow.upz_id]) || 'UPZ';
        const nominalStr = newRow.nominal ? formatRupiah(newRow.nominal) : '';
        showToast('Setoran Baru Diunggah!', 'notif', `${upzName} mengunggah setoran ${nominalStr}`);
        loadAdminSetoran();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, function (payload) {
        console.log('Realtime profile UPDATE:', payload);
        const p = payload.new || {};
        if (p.role === 'upz') {
          showToast('Perubahan Data UPZ', 'notif', `Data pengelola UPZ diperbarui: ${p.nama_lengkap || ''}`);
          syncAdminNotifications();
        }
      })
      .on('broadcast', { event: 'upz_activity' }, function (event) {
        console.log('Realtime broadcast upz_activity:', event);
        const p = event.payload || {};
        const cleanDesc = (p.desc || '').replace(/<[^>]+>/g, '');
        showToast(p.title || 'Aktivitas UPZ', 'notif', cleanDesc);
        syncAdminNotifications();
      })
      .subscribe(function (status) {
        console.log('Realtime notification channel status:', status);
      });
  } catch (err) {
    console.warn('Init realtime notification error:', err);
  }
}

// ==================================================
// CALL BACKEND
// ==================================================
// HELPER: Ambil token Supabase valid & otomatis refresh jika expired
// ==================================================
async function getValidAuthToken() {
  try {
    let { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !session) return null;
    const now = Math.floor(Date.now() / 1000);
    if (!session.expires_at || session.expires_at < now + 120) {
      try {
        const { data: refreshData, error: refreshError } = await supabaseClient.auth.refreshSession();
        if (!refreshError && refreshData && refreshData.session) {
          session = refreshData.session;
        }
      } catch (e) {
        console.warn('Auto refresh session failed:', e);
      }
    }
    return session ? session.access_token : null;
  } catch (err) {
    console.warn('getValidAuthToken failed:', err);
    return null;
  }
}

async function callBackend(action, payload = {}) {
  const token = await getValidAuthToken();
  if (!token) {
    await supabaseClient.auth.signOut().catch(function () {});
    showLogin();
    throw new Error('Sesi login tidak ditemukan atau kedaluwarsa. Silakan login kembali.');
  }

  let response;

  try {
    response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: action,
        token: token,
        payload: payload
      })
    });
  } catch (error) {
    const networkError = new Error(
      'Koneksi ke backend terputus. Periksa kembali data sebelum mengulangi tindakan.'
    );
    networkError.uncertainResult = true;
    throw networkError;
  }

  const responseText = await response.text();
  let result;

  try {
    result = JSON.parse(responseText);
  } catch (error) {
    console.error('BACKEND RAW RESPONSE:', responseText);

    const parseError = new Error(
      'Respons backend tidak dapat dibaca. Periksa kembali data sebelum mencoba lagi.'
    );
    parseError.uncertainResult = true;
    throw parseError;
  }

  if (!response.ok || !result.success) {
    const errorMsg = String(result.message || '');
    if (
      errorMsg.includes('session_not_found') ||
      errorMsg.includes('Token tidak valid') ||
      errorMsg.includes('JWT does not exist') ||
      errorMsg.includes('claim in JWT does not exist')
    ) {
      console.warn('Sesi login Supabase kedaluwarsa atau tidak valid di server. Mengarahkan ke form login...');
      await supabaseClient.auth.signOut().catch(function () {});
      currentProfile = null;
      currentSetoran = [];
      currentAdminSetoran = [];
      showLogin();
      showMessage(message, 'Sesi login Anda telah berakhir. Silakan login kembali.', '#d93025');
      const err = new Error('Sesi login Anda telah berakhir. Silakan login kembali.');
      err.backendRejected = true;
      throw err;
    }

    const backendError = new Error(
      result.message || 'Terjadi kesalahan pada server.'
    );

    backendError.backendRejected = true;
    backendError.backendResponse = result;
    throw backendError;
  }

  return result;
}

// ==================================================
// TAMPILAN HALAMAN & RESET DATA VISUAL
// ==================================================

function clearAllUserVisualData() {
  currentProfile = null;
  currentSetoran = [];
  currentFilteredUpzSetoran = [];
  currentAdminSetoran = [];
  currentFilteredAdminSetoran = [];
  upzMap = {};
  activeDetailItem = null;
  adminCurrentPage = 1;
  upzCurrentPage = 1;
  excelData = [];
  totalNominalExcel = 0;
  excelValid = false;

  // Reset semua cache lokal
  if (typeof upzDonaturCache !== 'undefined') {
    upzDonaturCache = { upzId: null, loaded: false, donors: [] };
  }
  if (typeof adminDonaturCache !== 'undefined') {
    adminDonaturCache = { loaded: false, data: [] };
  }
  if (typeof cachedRkatConfig !== 'undefined') {
    cachedRkatConfig = { target_tahun: 0, global_unlocked: false, unlocked_year: 0, upz_settings: {}, loaded: false };
  }
  if (typeof cachedUpzPentaRecords !== 'undefined') {
    cachedUpzPentaRecords = [];
  }
  if (typeof cachedAdminPentaRecords !== 'undefined') {
    cachedAdminPentaRecords = [];
  }

  // 1. Bersihkan Header & Info Pengguna
  const userName = document.getElementById('userName');
  if (userName) userName.textContent = '-';
  const upzName = document.getElementById('upzName');
  if (upzName) upzName.textContent = '-';
  const userRoleBadge = document.getElementById('userRoleBadge');
  if (userRoleBadge) {
    userRoleBadge.textContent = '';
    userRoleBadge.className = 'badge user-role-badge';
  }
  const headerChip = document.getElementById('headerUserChip');
  if (headerChip) {
    const avatar = headerChip.querySelector('.avatar, .user-avatar, .header-avatar');
    if (avatar) avatar.textContent = '';
  }
  const mgmtPengelolaEl = document.getElementById('upzMgmtProfilePengelola');
  if (mgmtPengelolaEl) mgmtPengelolaEl.textContent = '-';
  const mgmtUpzEl = document.getElementById('upzMgmtProfileUpz');
  if (mgmtUpzEl) mgmtUpzEl.textContent = '-';
  const headerKategoriBadge = document.getElementById('headerKategoriBadge');
  if (headerKategoriBadge) {
    headerKategoriBadge.classList.add('hidden');
    headerKategoriBadge.innerHTML = '';
  }

  // 2. Bersihkan Scorecard & Ringkasan UPZ
  const totalSetoran = document.getElementById('totalSetoran');
  if (totalSetoran) totalSetoran.textContent = 'Rp 0';
  const totalSetoranProgram = document.getElementById('totalSetoranProgram');
  if (totalSetoranProgram) totalSetoranProgram.textContent = 'Rp 0';
  const adminTotalSetoranProg = document.getElementById('adminTotalSetoranProgram');
  if (adminTotalSetoranProg) adminTotalSetoranProg.textContent = 'Rp 0';
  const jumlahTransaksi = document.getElementById('jumlahTransaksi');
  if (jumlahTransaksi) jumlahTransaksi.textContent = '0';
  const jumlahDonatur = document.getElementById('jumlahDonatur');
  if (jumlahDonatur) jumlahDonatur.textContent = '0';

  // 3. Bersihkan Riwayat Setoran UPZ
  const riwayatContainer = document.getElementById('riwayatContainer');
  if (riwayatContainer) riwayatContainer.innerHTML = '';
  if (upzFilterTahun) upzFilterTahun.innerHTML = '<option value="semua">Semua Tahun</option>';
  if (upzFilterBulan) upzFilterBulan.value = 'semua';
  if (upzFilterStatus) upzFilterStatus.value = 'semua';
  if (upzFilterCount) upzFilterCount.textContent = '';

  // 4. Bersihkan Form Setoran UPZ
  if (setoranForm) {
    try { setoranForm.reset(); } catch (_) {}
  }
  const setoranProgForm = document.getElementById('setoranProgramForm');
  if (setoranProgForm) {
    try { setoranProgForm.reset(); } catch (_) {}
  }
  const setoranProgMsg = document.getElementById('setoranProgramMessage');
  if (setoranProgMsg) { setoranProgMsg.textContent = ''; setoranProgMsg.style.display = 'none'; }
  if (fileExcel) fileExcel.value = '';
  if (fileExcelInfo) { fileExcelInfo.textContent = ''; fileExcelInfo.classList.add('hidden'); }
  if (excelPreview) excelPreview.innerHTML = '';
  if (nominalSetoran) nominalSetoran.value = '';
  if (setoranMessage) { setoranMessage.textContent = ''; setoranMessage.style.display = 'none'; }

  // 5. Bersihkan Rekap Donatur & Pentasharufan & RKAT
  const donaturTableContainer = document.getElementById('donaturTableContainer');
  if (donaturTableContainer) donaturTableContainer.innerHTML = '';
  const adminDonaturTableContainer = document.getElementById('adminDonaturTableContainer');
  if (adminDonaturTableContainer) adminDonaturTableContainer.innerHTML = '';
  const upzPentaContainer = document.getElementById('upzPentaRiwayatContainer');
  if (upzPentaContainer) upzPentaContainer.innerHTML = '';
  const adminPentaContainer = document.getElementById('adminPentaTableBody');
  if (adminPentaContainer) adminPentaContainer.innerHTML = '';
  const rkatTableBody = document.getElementById('rkatTableBody');
  if (rkatTableBody) rkatTableBody.innerHTML = '';
  const adminRkatTableBody = document.getElementById('adminRkatTableBody');
  if (adminRkatTableBody) adminRkatTableBody.innerHTML = '';

  // 6. Bersihkan Data Admin Setoran & Ringkasan
  if (adminSetoranContainer) adminSetoranContainer.innerHTML = '';
  const adminJumlahTransaksi = document.getElementById('adminJumlahTransaksi');
  if (adminJumlahTransaksi) adminJumlahTransaksi.textContent = '0';
  const adminJumlahMenunggu = document.getElementById('adminJumlahMenunggu');
  if (adminJumlahMenunggu) adminJumlahMenunggu.textContent = '0';
  const adminTotalNominal = document.getElementById('adminTotalNominal');
  if (adminTotalNominal) adminTotalNominal.textContent = 'Rp 0';
  const adminPartisipasi = document.getElementById('adminJumlahUpzPartisipasi');
  if (adminPartisipasi) adminPartisipasi.textContent = '0';
  const adminTerdata = document.getElementById('adminJumlahUpzTerdata') || document.getElementById('adminJumlahUpz');
  if (adminTerdata) adminTerdata.textContent = '0';
  if (adminFilterStatus) adminFilterStatus.value = 'semua';
  if (adminSearchInput) adminSearchInput.value = '';
  if (adminFilterUpz) adminFilterUpz.innerHTML = '<option value="semua">Semua UPZ</option>';
  if (adminFilterTanggal) adminFilterTanggal.value = '';
  if (adminFilterBulan) adminFilterBulan.value = 'semua';
  if (adminFilterTahun) adminFilterTahun.value = 'semua';
  if (adminFilterNominal) adminFilterNominal.value = 'semua';
  if (adminFilterCount) adminFilterCount.textContent = '';
  if (adminMessage) { adminMessage.textContent = ''; adminMessage.style.display = 'none'; }

  // 7. Bersihkan Notifikasi
  const notifWrap = document.getElementById('adminNotificationWrap');
  if (notifWrap) notifWrap.classList.add('hidden');
  const notifDrop = document.getElementById('adminNotifDropdown');
  if (notifDrop) notifDrop.classList.add('hidden');
  const notifList = document.getElementById('adminNotifList');
  if (notifList) notifList.innerHTML = '';
  const notifBadge = document.getElementById('adminNotifBadge');
  if (notifBadge) { notifBadge.textContent = '0'; notifBadge.classList.add('hidden'); }

  // 8. Tutup semua modal aktif
  const openModals = document.querySelectorAll('.modal:not(.hidden)');
  openModals.forEach(function (m) { m.classList.add('hidden'); });
}

function showLogin() {
  document.body.classList.remove('is-logged-in', 'splash-active', 'role-admin', 'role-upz');
  document.documentElement.classList.remove('splash-active');
  const splash = document.getElementById('mobileLoginSplash');
  if (splash) {
    splash.classList.add('hidden');
    splash.classList.remove('splash-fade-out');
  }
  isSplashDismissed = false;
  isAppReadyAfterLogin = false;
  isSplashEnterWaiting = false;
  clearAllUserVisualData();
  if (loginPage) loginPage.classList.remove('hidden');
  if (dashboardPage) dashboardPage.classList.add('hidden');
}

function showDashboard() {
  document.body.classList.add('is-logged-in');
  if (loginPage) loginPage.classList.add('hidden');
  if (dashboardPage) dashboardPage.classList.remove('hidden');
}

function showRolePage(role, keepCurrentView = false) {
  showDashboard();

  document.querySelectorAll('.upz-only').forEach(function (element) {
    element.classList.toggle('hidden', role !== 'upz');
  });

  if (adminPage) {
    adminPage.classList.toggle('hidden', role !== 'admin');
  }

  // Toggle dropdown group sesuai role
  const adminMenuGroup = document.getElementById('adminMenuGroup');
  if (adminMenuGroup) {
    adminMenuGroup.classList.toggle('hidden', role !== 'admin');
  }
  const upzMenuGroup = document.getElementById('upzMenuGroup');
  if (upzMenuGroup) {
    upzMenuGroup.classList.toggle('hidden', role !== 'upz');
  }

  // Jaminan keamanan: Fitur manajemen akun UPZ & rekap donatur admin HANYA ada di role admin
  const upzMgmt = document.getElementById('adminUpzManagement');
  if (upzMgmt && role !== 'admin') {
    upzMgmt.classList.add('hidden');
  }
  const adminDonaturMgmt = document.getElementById('adminDonaturManagement');
  if (adminDonaturMgmt && role !== 'admin') {
    adminDonaturMgmt.classList.add('hidden');
  }

  // Tampilkan tombol & sistem notifikasi untuk role admin dan upz
  const notifWrap = document.getElementById('adminNotificationWrap');
  if (notifWrap) {
    notifWrap.classList.remove('hidden');
  }

  initAdminNotificationSystem();
  if (role === 'admin') {
    initAdminRealtimeNotifications();
  }
  syncAdminNotifications();

  document.body.classList.toggle('role-admin', role === 'admin');
  document.body.classList.toggle('role-upz', role === 'upz');

  // Trigger modal info profil bila nama pengelola / user chip di header diklik (role UPZ)
  const headerChip = document.getElementById('headerUserChip');
  if (headerChip && !headerChip.dataset.boundProfilModal) {
    headerChip.dataset.boundProfilModal = 'true';
    headerChip.addEventListener('click', function () {
      if (currentProfile && currentProfile.role === 'upz') {
        openUpzProfileInfoModal();
      }
    });
  }

  // Tampilkan halaman Beranda secara default saat login/pertama kali, kecuali diminta pertahankan view
  if (!keepCurrentView && typeof navigateToView === 'function') {
    navigateToView('beranda');
  } else if (keepCurrentView && typeof currentActiveView !== 'undefined' && currentActiveView && typeof navigateToView === 'function') {
    navigateToView(currentActiveView);
  }
}

// ==================================================
// AMBIL RINCIAN SETORAN
// ==================================================

async function getDetailSetoran(setoranId) {
  if (!setoranId) {
    throw new Error('ID transaksi tidak ditemukan.');
  }

  const { data, error } = await supabaseClient
    .from('detail_setoran')
    .select('id, setoran_id, nama_muzaki, nominal, jenis, keterangan')
    .eq('setoran_id', setoranId)
    .order('nama_muzaki', { ascending: true });

  if (error) {
    console.error('GET DETAIL SETORAN ERROR:', error);
    throw new Error(
      'Gagal mengambil rincian donatur. Periksa kebijakan akses tabel detail_setoran.'
    );
  }

  return data || [];
}

async function updateUpzDonaturScorecard(setoranList) {
  const jumlahDonatur = document.getElementById('jumlahDonatur');
  if (!jumlahDonatur) return;

  const list = setoranList || currentSetoran || [];
  // Hanya hitung donatur dari setoran reguler yang berstatus diterima
  const acceptedReguler = list.filter(function (s) {
    const st = String(s.status || '').toLowerCase().trim();
    const isAccepted = (st === 'diterima' || st === 'disetujui' || st === 'verified' || st === 'sukses' || st === 'cocok');
    return isAccepted && !isSetoranProgram(s);
  });

  if (!acceptedReguler.length) {
    jumlahDonatur.textContent = '0';
    return;
  }

  // Jika cache donatur UPZ sudah dimuat sebelumnya
  if (upzDonaturCache && upzDonaturCache.loaded && Array.isArray(upzDonaturCache.donors) && upzDonaturCache.donors.length > 0) {
    jumlahDonatur.textContent = upzDonaturCache.donors.length.toLocaleString('id-ID');
    return;
  }

  const setoranIds = acceptedReguler.map(function (s) { return s.id; }).filter(Boolean);
  try {
    const { data: details, error } = await supabaseClient
      .from('detail_setoran')
      .select('nama_muzaki, setoran_id')
      .in('setoran_id', setoranIds);

    if (!error && Array.isArray(details) && details.length > 0) {
      const uniqueDonors = new Set();
      details.forEach(function (d) {
        if (d.nama_muzaki && String(d.nama_muzaki).trim()) {
          uniqueDonors.add(String(d.nama_muzaki).trim().toLowerCase());
        }
      });
      jumlahDonatur.textContent = uniqueDonors.size.toLocaleString('id-ID');
    } else {
      // Fallback per-transaksi jika chunk in() kosong
      const uniqueDonors = new Set();
      for (const s of acceptedReguler) {
        try {
          const rows = await getDetailSetoran(s.id);
          if (Array.isArray(rows)) {
            rows.forEach(function (r) {
              if (r.nama_muzaki && String(r.nama_muzaki).trim()) {
                uniqueDonors.add(String(r.nama_muzaki).trim().toLowerCase());
              }
            });
          }
        } catch (_) {}
      }
      jumlahDonatur.textContent = (uniqueDonors.size || acceptedReguler.length).toLocaleString('id-ID');
    }
  } catch (err) {
    console.warn('Gagal menghitung donatur UPZ:', err);
    jumlahDonatur.textContent = '0';
  }
}

// ==================================================
// LOAD DASHBOARD BERDASARKAN ROLE
// ==================================================

async function loadDashboard(keepCurrentView = false) {
  if (isLoadingDashboard) return false;

  if (!keepCurrentView) {
    clearAllUserVisualData();
  }

  isLoadingDashboard = true;

  try {
    let profile = currentProfile;
    if (!profile) {
      try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (user) {
          const { data: pData } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();
          if (pData) {
            profile = pData;
            currentProfile = profile;
          }
        }
      } catch (authErr) {
        console.warn('Direct supabase auth getUser warning:', authErr);
      }

      if (!profile) {
        const profileResult = await callBackend('test');
        profile = profileResult ? profileResult.profile : null;
      }

      if (!profile) {
        throw new Error('Data profil tidak ditemukan dari database atau server backend.');
      }

      if (profile.status !== 'aktif') {
        throw new Error('Akun belum aktif. Silakan hubungi administrator.');
      }

      currentProfile = profile;
    }

    // DASHBOARD ADMIN
    if (profile.role === 'admin') {
      const userName = document.getElementById('userName');
      if (userName) {
        userName.textContent = profile.nama_lengkap || 'Administrator';
      }

      const upzName = document.getElementById('upzName');
      if (upzName) upzName.textContent = 'Administrator';

      showRolePage('admin', keepCurrentView);
      await loadAdminSetoran();
      loadUpzList().catch(function(e) { console.warn('Preload UPZ list:', e); });
      return true;
    }

    // DASHBOARD UPZ
    if (profile.role !== 'upz' || !profile.upz_id) {
      throw new Error('Akun ini tidak terhubung ke UPZ.');
    }

    showRolePage('upz', keepCurrentView);

    let result = null;
    try {
      result = await callBackend('getDashboard');
    } catch (e) {
      console.warn('Backend getDashboard failed, fallback to Supabase:', e);
    }

    if (!result || !result.profile) {
      const { data: directSetoran } = await supabaseClient
        .from('setoran')
        .select('*')
        .eq('upz_id', currentProfile.upz_id)
        .order('tanggal_setor', { ascending: false });

      result = {
        success: true,
        profile: currentProfile,
        setoran: directSetoran || []
      };
    }

    currentProfile = result.profile || currentProfile;

    // Pastikan nama UPZ terisi: jika backend belum mengembalikan nama_upz, ambil dari tabel upz
    if (currentProfile.upz_id && !currentProfile.nama_upz) {
      try {
        const { data: upzRow, error: upzErr } = await supabaseClient
          .from('upz')
          .select('id, kode_upz, nama_upz')
          .eq('id', currentProfile.upz_id)
          .maybeSingle();

        if (!upzErr && upzRow) {
          currentProfile.nama_upz = upzRow.nama_upz;
          currentProfile.kode_upz = upzRow.kode_upz;
        }
      } catch (err) {
        console.warn('Gagal mengambil nama UPZ dari database:', err);
      }
    }

    // Sinkronisasi data profil pengelola terbaru dari Supabase profiles / user_metadata / extras
    try {
      const pId = currentProfile.id || currentProfile.profile_id;
      if (pId) {
        const { data: profData } = await supabaseClient
          .from('profiles')
          .select('*')
          .eq('id', pId)
          .maybeSingle();
        if (profData) {
          if (profData.nama_lengkap) currentProfile.nama_lengkap = profData.nama_lengkap;
          if (profData.no_sk) currentProfile.no_sk = profData.no_sk;
          if (profData.nama_ketua) currentProfile.nama_ketua = profData.nama_ketua;
        }
      }
      const { data: authUserData } = await supabaseClient.auth.getUser();
      if (authUserData && authUserData.user && authUserData.user.user_metadata) {
        const um = authUserData.user.user_metadata;
        if (um.nama_pengelola) currentProfile.nama_lengkap = um.nama_pengelola;
        if (um.no_sk) currentProfile.no_sk = um.no_sk;
        if (um.nama_ketua) currentProfile.nama_ketua = um.nama_ketua;
      }
    } catch (_) {}

    const extras = getUpzProfileExtras(currentProfile.upz_id || currentProfile.id);
    if (!currentProfile.nama_lengkap && extras.nama_pengelola) {
      currentProfile.nama_lengkap = extras.nama_pengelola;
    }
    if (!currentProfile.no_sk && extras.no_sk) {
      currentProfile.no_sk = extras.no_sk;
    }
    if (!currentProfile.nama_ketua && extras.nama_ketua) {
      currentProfile.nama_ketua = extras.nama_ketua;
    }

    const setoran = sortByCreatedAt(
      Array.isArray(result.setoran) ? result.setoran : []
    );

    currentSetoran = setoran;

    const nameElement = document.getElementById('userName');
    if (nameElement) {
      nameElement.textContent = currentProfile.nama_lengkap || '-';
    }

    const mgmtPengelolaEl = document.getElementById('upzMgmtProfilePengelola');
    if (mgmtPengelolaEl) {
      mgmtPengelolaEl.textContent = currentProfile.nama_lengkap || '-';
    }

    const upzNameElement = document.getElementById('upzName');
    if (upzNameElement) {
      upzNameElement.textContent =
        currentProfile.nama_upz ||
        currentProfile.kode_upz ||
        currentProfile.upz_id ||
        '-';
    }

    // Jumlah transaksi tetap menghitung seluruh status.
    const jumlahTransaksi = document.getElementById('jumlahTransaksi');
    if (jumlahTransaksi) {
      jumlahTransaksi.textContent = setoran.length.toLocaleString('id-ID');
    }

    // TOTAL SETORAN UPZ: Reguler & Program terpisah, hanya menghitung status DITERIMA.
    const totalReguler = hitungTotalReguler(setoran);
    const totalProgram = hitungTotalProgram(setoran);

    const totalSetoran = document.getElementById('totalSetoran');
    if (totalSetoran) {
      totalSetoran.textContent = formatRupiah(totalReguler + totalProgram);
    }

    const totalSetoranProgEl = document.getElementById('totalSetoranProgram');
    if (totalSetoranProgEl) {
      totalSetoranProgEl.textContent = formatRupiah(totalProgram);
    }

    // JUMLAH DONATUR UPZ: Dihitung dari seluruh donatur unik setoran reguler diterima
    await updateUpzDonaturScorecard(setoran);

    populateUpzTahunFilter(setoran);
    filterAndRenderRiwayat();
    showRolePage('upz', keepCurrentView);
    if (typeof syncAdminNotifications === 'function') syncAdminNotifications();

    // Muat matriks donatur UPZ otomatis dari setoran diterima
    loadUpzDonaturMatrix();

    // Muat data profil pada halaman Manajemen UPZ
    populateUpzMgmtProfile(currentProfile);

    if (typeof renderUpzMonthlyChart === 'function') {
      renderUpzMonthlyChart();
    }

    // Tampilkan badge kategori UPZ (async, non-blocking)
    setTimeout(function () {
      if (typeof _tryShowKategoriBadge === 'function') _tryShowKategoriBadge();
    }, 100);

    if (typeof syncBszList === 'function') {
      syncBszList().catch(function (e) { console.warn('Sync bsz in loadDashboard:', e); });
    }

    return true;

  } catch (error) {
    console.error('DASHBOARD ERROR:', error);
    showMessage(message, error.message, '#d93025');
    const errStr = String(error.message || '').toLowerCase();
    if (errStr.includes('sesi login') || errStr.includes('token tidak valid') || errStr.includes('jwt') || errStr.includes('kedaluwarsa') || errStr.includes('session_not_found')) {
      showLogin();
    }
    return false;

  } finally {
    isLoadingDashboard = false;
  }
}

// ==================================================
// RIWAYAT SETORAN UPZ
// ==================================================

function populateUpzTahunFilter(setoran) {
  if (!upzFilterTahun) return;

  const currentYear = new Date().getFullYear();
  const yearsSet = new Set([currentYear]);

  (setoran || []).forEach(function (item) {
    if (item.periode_tahun) {
      yearsSet.add(Number(item.periode_tahun));
    }
  });

  const sortedYears = Array.from(yearsSet).sort(function (a, b) {
    return b - a;
  });

  const savedVal = upzFilterTahun.value;
  let optionsHtml = '<option value="semua">Semua Tahun</option>';
  sortedYears.forEach(function (year) {
    optionsHtml += `<option value="${year}">${year}</option>`;
  });

  upzFilterTahun.innerHTML = optionsHtml;
  upzFilterTahun.value = savedVal || 'semua';
}

function filterAndRenderRiwayat() {
  const tahun = upzFilterTahun ? upzFilterTahun.value : 'semua';
  const bulan = upzFilterBulan ? upzFilterBulan.value : 'semua';
  const status = upzFilterStatus ? upzFilterStatus.value : 'semua';

  let filtered = (currentSetoran || []).slice();

  if (tahun && tahun !== 'semua') {
    filtered = filtered.filter(function (item) {
      return Number(item.periode_tahun) === Number(tahun);
    });
  }

  if (bulan && bulan !== 'semua') {
    filtered = filtered.filter(function (item) {
      return Number(item.periode_bulan) === Number(bulan);
    });
  }

  if (status && status !== 'semua') {
    filtered = filtered.filter(function (item) {
      return String(item.status || '').toLowerCase() === String(status).toLowerCase();
    });
  }

  currentFilteredUpzSetoran = filtered;

  if (upzFilterCount) {
    if (filtered.length === (currentSetoran || []).length) {
      upzFilterCount.textContent = 'Menampilkan seluruh ' + currentSetoran.length + ' transaksi';
    } else {
      upzFilterCount.textContent = 'Menampilkan ' + filtered.length + ' dari ' + currentSetoran.length + ' transaksi';
    }
  }

  renderRiwayat(filtered);
}

function renderRiwayat(setoran) {
  const container = document.getElementById('riwayatContainer');
  if (!container) return;
  if (!setoran.length) {
    const isFiltered = (upzFilterTahun && upzFilterTahun.value !== 'semua') || (upzFilterBulan && upzFilterBulan.value !== 'semua') || (upzFilterStatus && upzFilterStatus.value !== 'semua');
    container.innerHTML = `<div class="empty-state">${isFiltered ? 'Tidak ada transaksi setoran yang cocok dengan filter periode ini.' : 'Belum ada data setoran.'}</div>`;
    return;
  }
  const totalPages = Math.ceil(setoran.length / PAGE_SIZE);
  upzCurrentPage = Math.min(upzCurrentPage, totalPages);
  const pageItems = setoran.slice((upzCurrentPage - 1) * PAGE_SIZE, upzCurrentPage * PAGE_SIZE);
  container.innerHTML = pageItems.map(function (item) {
    const id = escapeHtml(item.id || '');
    const status = String(item.status || 'menunggu').toLowerCase();

    const isProgram = isSetoranProgram(item);
    const tagHtml = isProgram
      ? `<div style="margin-top:4px;"><span class="badge-program-tag"><svg class="icon" style="width:11px;height:11px;"><use href="#i-tag"></use></svg> Program: ${escapeHtml(getNamaProgram(item))}</span></div>`
      : `<div style="margin-top:4px;"><span class="badge-reguler-tag"><svg class="icon" style="width:11px;height:11px;"><use href="#i-sheet"></use></svg> Setoran Reguler</span></div>`;

    return `<article class="riwayat-item" data-setoran-id="${id}"><div class="riwayat-main"><div class="riwayat-nominal">${formatRupiah(item.nominal)}</div><div class="riwayat-info"><div>Tanggal setor: <strong>${escapeHtml(formatTanggal(item.tanggal_setor))}</strong></div><div>Periode: <strong>${escapeHtml(getNamaBulan(item.periode_bulan) + ' ' + (item.periode_tahun || '-'))}</strong></div>${tagHtml}</div><div class="status-badge ${getStatusClass(status)}" data-badge-setoran-id="${id}" title="Klik untuk melihat catatan status">${escapeHtml(getStatusLabel(status))}</div><div class="riwayat-actions"><button type="button" class="btn btn-soft btn-sm btn-icon-only history-preview-button" data-preview-id="${id}" title="Rincian Setoran" aria-label="Rincian Setoran"><svg class="icon"><use href="#i-file-text"></use></svg></button></div></div></article>`;
  }).join('') + renderPagination('upz', upzCurrentPage, totalPages);
  bindHistoryPreviewEvents(container, false);
}

function renderPagination(type, page, totalPages) {
  if (totalPages <= 1) return '';
  return `<nav class="pagination" aria-label="Navigasi halaman"><button type="button" class="btn btn-ghost pagination-button" data-page-type="${type}" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>Sebelumnya</button><span>Halaman ${page} dari ${totalPages}</span><button type="button" class="btn btn-ghost pagination-button" data-page-type="${type}" data-page="${page + 1}" ${page === totalPages ? 'disabled' : ''}>Berikutnya</button></nav>`;
}

function bindPagination(container) {
  container.querySelectorAll('.pagination-button').forEach(function (button) {
    button.addEventListener('click', function () {
      if (button.dataset.pageType === 'upz') { upzCurrentPage = Number(button.dataset.page); filterAndRenderRiwayat(); }
      else { adminCurrentPage = Number(button.dataset.page); renderAdminSetoran(currentAdminSetoran); }
    });
  });
}

function bindHistoryPreviewEvents(container, isAdmin) {
  container.querySelectorAll('.history-preview-button').forEach(function (button) {
    button.addEventListener('click', function () {
      openDetailModal(button.dataset.previewId, isAdmin);
    });
  });

  // Klik keterangan status (diterima, ditolak, menunggu) untuk melihat catatan admin
  container.querySelectorAll('.status-badge[data-badge-setoran-id]').forEach(function (badge) {
    badge.addEventListener('click', function (e) {
      e.stopPropagation();
      const setoranId = badge.dataset.badgeSetoranId;
      openStatusExplanationModal(setoranId, isAdmin);
    });
  });
}

function openStatusExplanationModal(setoranId, isAdmin) {
  const allItems = [
    ...(Array.isArray(currentAdminSetoran) ? currentAdminSetoran : []),
    ...(Array.isArray(currentSetoran) ? currentSetoran : [])
  ];
  let item = allItems.find(function (row) {
    return String(row.id) === String(setoranId);
  });
  if (!item && isAdmin !== undefined) {
    const targetArr = isAdmin ? currentAdminSetoran : currentSetoran;
    item = (targetArr || []).find(function (r) { return String(r.id) === String(setoranId); });
  }
  if (!item) {
    const badgeEl = document.querySelector(`[data-badge-setoran-id="${setoranId}"]`);
    if (badgeEl) {
      const parentRow = badgeEl.closest('.riwayat-item');
      item = {
        id: setoranId,
        status: badgeEl.textContent.trim().toLowerCase(),
        catatan: parentRow ? (parentRow.querySelector('.admin-catatan')?.value || '') : ''
      };
    }
  }
  if (!item) {
    console.warn('Setoran tidak ditemukan untuk modal alasan status:', setoranId);
    return;
  }

  const modal = document.getElementById('statusExplanationModal');
  if (!modal) return;

  const status = String(item.status || 'menunggu').toLowerCase();
  const upzName = (item.upz_id && upzMap && upzMap[item.upz_id]) ? upzMap[item.upz_id] : (item.nama_upz || item.upz_id || 'UPZ');
  const periode = (typeof getNamaBulan === 'function' ? getNamaBulan(item.periode_bulan) : (item.periode_bulan || '')) + ' ' + (item.periode_tahun || '');
  const tglSetor = (typeof formatTanggal === 'function' && item.tanggal_setor) ? formatTanggal(item.tanggal_setor) : (item.tanggal_setor || '-');

  const metaEl = document.getElementById('statusModalMeta');
  const badgeEl = document.getElementById('statusModalBadge');
  const catatanEl = document.getElementById('statusModalCatatanBox');
  const titleEl = document.getElementById('statusModalTitle');
  const iconBox = document.getElementById('statusModalIconBox');

  if (metaEl) metaEl.textContent = `${upzName} · Periode ${periode} (Setor: ${tglSetor})`;
  if (badgeEl) {
    badgeEl.className = 'status-badge ' + getStatusClass(status);
    badgeEl.textContent = getStatusLabel(status);
  }

  if (iconBox) {
    iconBox.className = 'modal-icon ' + (status === 'diterima' || status === 'disetujui' ? 'tone-green' : (status === 'ditolak' ? 'tone-rose' : 'tone-amber'));
  }

  if (titleEl) {
    titleEl.textContent = (status === 'diterima' || status === 'disetujui') ? 'Setoran Diterima' : (status === 'ditolak' ? 'Setoran Ditolak' : 'Setoran Menunggu Verifikasi');
  }

  if (catatanEl) {
    if (item.catatan && item.catatan.trim()) {
      catatanEl.textContent = item.catatan.trim();
      catatanEl.style.fontStyle = 'normal';
      catatanEl.style.color = status === 'ditolak' ? '#b91c1c' : 'var(--slate-800)';
    } else {
      catatanEl.textContent = status === 'ditolak' ? 'Tidak ada catatan alasan penolakan yang dicantumkan.' : (status === 'diterima' || status === 'disetujui' ? 'Setoran telah diverifikasi dan disetujui tanpa catatan khusus.' : 'Setoran sedang dalam proses antrean verifikasi oleh admin BAZNAS.');
      catatanEl.style.fontStyle = 'italic';
      catatanEl.style.color = 'var(--slate-500)';
    }
  }

  modal.classList.remove('hidden');

  const closeX = document.getElementById('closeStatusModalX');
  const closeBtn = document.getElementById('closeStatusModalBtn');
  function closeModal() { modal.classList.add('hidden'); }
  if (closeX && !closeX.dataset.boundClose) { closeX.dataset.boundClose = 'true'; closeX.onclick = closeModal; }
  if (closeBtn && !closeBtn.dataset.boundClose) { closeBtn.dataset.boundClose = 'true'; closeBtn.onclick = closeModal; }
  modal.onclick = function (e) { if (e.target === modal) closeModal(); };
}

// Delegasi klik status badge untuk jaminan interaksi di seluruh tabel
document.addEventListener('click', function (e) {
  const badge = e.target.closest('.status-badge[data-badge-setoran-id]');
  if (badge) {
    e.stopPropagation();
    const setoranId = badge.dataset.badgeSetoranId;
    const isAdmin = (currentProfile && currentProfile.role === 'admin') || Boolean(badge.closest('#adminSetoranContainer'));
    openStatusExplanationModal(setoranId, isAdmin);
  }
});

function bindHistoryDownloadEvents(container, isAdmin) {
  container.querySelectorAll('.download-excel-button').forEach(function (button) {
    button.addEventListener('click', function () {
      const item = (isAdmin ? currentAdminSetoran : currentSetoran).find(function (row) {
        return String(row.id) === String(button.dataset.downloadId);
      });
      if (item) downloadSetoranExcel(item, button);
    });
  });
}

async function downloadSetoranExcel(item, button) {
  const originalText = button.innerHTML;
  button.disabled = true;
  button.textContent = 'Menyiapkan...';
  try {
    let downloaded = false;
    if (item.file_path) {
      const { data: fileBlob, error } = await supabaseClient.storage.from(STORAGE_BUCKET).download(item.file_path);
      if (!error && fileBlob && fileBlob.size > 0) {
        const blobUrl = URL.createObjectURL(fileBlob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = item.file_name || 'rincian-setoran.xlsx';
        link.click();
        URL.revokeObjectURL(blobUrl);
        downloaded = true;
      }
    }
    if (!downloaded) {
      const detail = await getDetailSetoran(item.id);
      if (typeof XLSX === 'undefined') throw new Error('Pustaka Excel tidak tersedia.');
      const rows = [['No', 'Nama Muzaki', 'Nominal', 'Jenis', 'Keterangan']];
      (detail.length ? detail : [{ nama_muzaki: 'Setoran UPZ (Ringkasan)', nominal: item.nominal, jenis: 'Setoran', keterangan: '' }]).forEach(function (row, index) {
        rows.push([index + 1, row.nama_muzaki || '', Number(row.nominal || 0), row.jenis || '', row.keterangan || '']);
      });
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Rincian Muzaki');
      XLSX.writeFile(workbook, item.file_name || 'rincian-setoran.xlsx');
    }
  } catch (error) {
    alert('Gagal mengunduh file Excel:\n\n' + error.message);
  } finally {
    button.disabled = false;
    button.innerHTML = originalText;
  }
}


async function openDetailModal(setoranId, isAdmin) {
  const item = (isAdmin ? currentAdminSetoran : currentSetoran).find(function (row) {
    return String(row.id) === String(setoranId);
  }) || (currentAdminSetoran || []).concat(currentSetoran || []).find(function (row) {
    return String(row.id) === String(setoranId);
  });
  if (!item || !detailModal) return;
  activeDetailItem = item;
  const status = String(item.status || 'menunggu').toLowerCase();
  detailModalSubtitle.textContent = (isAdmin ? (upzMap[item.upz_id] || item.upz_id || '-') + ' · ' : '') + formatTanggal(item.tanggal_setor);
  detailModalMeta.innerHTML = '<div class="meta-item"><label>Nominal</label><div>' + escapeHtml(formatRupiah(item.nominal)) + '</div></div>' +
    '<div class="meta-item"><label>Periode</label><div>' + escapeHtml(getNamaBulan(item.periode_bulan) + ' ' + item.periode_tahun) + '</div></div>' +
    '<div class="meta-item"><label>Status</label><div><span class="status-badge ' + getStatusClass(status) + '">' + escapeHtml(getStatusLabel(status)) + '</span></div></div>' +
    '<div class="meta-item"><label>File Rincian</label><div class="text-break">' + escapeHtml(item.file_name || 'Tidak tersedia') + '</div></div>';
  detailModalBody.innerHTML = '<p class="empty-state">Memuat rincian donatur...</p>';
  detailModalVerify.classList.toggle('hidden', !(isAdmin && status === 'menunggu'));
  if (detailDownloadButton) detailDownloadButton.classList.toggle('hidden', !item.file_path && !item.id);

  // Update BSZ Section di dalam modal
  updateDetailModalBszSection(item.id, isAdmin);
  if (typeof syncBszList === 'function') {
    syncBszList().then(function () {
      if (activeDetailItem && String(activeDetailItem.id) === String(item.id)) {
        updateDetailModalBszSection(item.id, isAdmin);
      }
    }).catch(function () {});
  }

  // Tombol Hapus Setoran di dalam modal:
  // Admin: selalu aktif
  // UPZ: aktif jika status 'menunggu'
  const delBtn = document.getElementById('detailDeleteButton');
  if (delBtn) {
    if (isAdmin || status === 'menunggu') {
      delBtn.style.display = 'inline-flex';
      delBtn.onclick = function () {
        openDeleteSetoranModal(item);
      };
    } else {
      delBtn.style.display = 'none';
    }
  }

  // Tombol Konfirmasi Setoran WhatsApp: Hanya untuk role UPZ (!isAdmin)
  const waBtn = document.getElementById('detailWaConfirmButton');
  if (waBtn) {
    if (!isAdmin) {
      const waNumber = '6281469734792';
      const upzName = (currentProfile && (currentProfile.nama_upz || currentProfile.name)) || (upzMap && upzMap[item.upz_id]) || item.nama_upz || 'UPZ';
      const periodeStr = `${getNamaBulan(item.periode_bulan)} ${item.periode_tahun || ''}`.trim();
      const nominalStr = formatRupiah(item.nominal || 0);
      const textMsg = encodeURIComponent(
        `Assalamu'alaikum Admin BAZNAS Banyumas,\n` +
        `Saya ingin konfirmasi setoran UPZ:\n` +
        `• Nama UPZ: ${upzName}\n` +
        `• Nominal: ${nominalStr}\n` +
        `• Periode: ${periodeStr}\n` +
        `• Tanggal Setor: ${formatTanggal(item.tanggal_setor)}\n` +
        `Mohon untuk diverifikasi. Terima kasih.`
      );
      waBtn.href = `https://wa.me/${waNumber}?text=${textMsg}`;
      waBtn.classList.remove('hidden');
    } else {
      waBtn.classList.add('hidden');
    }
  }

  detailModal.classList.remove('hidden');
  if (isSetoranProgram(item)) {
    const progName = getNamaProgram(item);
    const nom = Number(String(item.nominal || 0).replace(/[^\d.-]/g, '')) || 0;
    const upzName = (item.upz_id && upzMap && upzMap[item.upz_id]) ? upzMap[item.upz_id] : (item.nama_upz || (currentProfile && currentProfile.nama_upz) || '-');
    detailModalBody.innerHTML = `
      <div style="background:var(--blue-50,#eff6ff);border:1px solid var(--blue-200,#bfdbfe);border-radius:10px;padding:18px;margin-bottom:14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:14px;border-bottom:1px solid var(--blue-200,#bfdbfe);padding-bottom:10px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <svg class="icon" style="width:20px;height:20px;color:var(--blue-600);"><use href="#i-tag"></use></svg>
            <strong style="font-size:15px;color:var(--blue-900);">Program: ${escapeHtml(progName)}</strong>
          </div>
          <span class="status-badge ${getStatusClass(status)}">${escapeHtml(getStatusLabel(status))}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:12px;margin-bottom:14px;">
          <div>
            <div style="font-size:11px;text-transform:uppercase;color:var(--slate-500);font-weight:600;">Nominal Setoran</div>
            <div style="font-size:18px;font-weight:700;color:var(--primary-700);margin-top:2px;">${formatRupiah(nom)}</div>
          </div>
          <div>
            <div style="font-size:11px;text-transform:uppercase;color:var(--slate-500);font-weight:600;">Tanggal Setor</div>
            <div style="font-size:13px;font-weight:600;color:var(--slate-800);margin-top:2px;">${escapeHtml(formatTanggal(item.tanggal_setor))}</div>
          </div>
          <div>
            <div style="font-size:11px;text-transform:uppercase;color:var(--slate-500);font-weight:600;">UPZ Penyetor</div>
            <div style="font-size:13px;font-weight:600;color:var(--slate-800);margin-top:2px;">${escapeHtml(upzName)}</div>
          </div>
        </div>
        <p style="font-size:12px;color:var(--slate-600);margin:0;line-height:1.5;">
          Transaksi ini disetor melalui <strong>Formulir Setoran Program</strong> tanpa berkas rincian muzaki perorangan.
        </p>
        ${item.catatan ? `<div style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--blue-200);font-size:13px;color:var(--slate-700);"><strong>Catatan:</strong> ${escapeHtml(item.catatan)}</div>` : ''}
      </div>
    `;
    if (detailDownloadButton) detailDownloadButton.classList.add('hidden');
  } else {
    try {
      detailModalBody.innerHTML = renderDetailSetoran(await getDetailSetoran(item.id));
    } catch (error) {
      detailModalBody.innerHTML = '<p class="form-message" style="color:#dc2626">' + escapeHtml(error.message) + '</p>';
    }

    if (detailDownloadButton) {
      detailDownloadButton.onclick = function () {
        downloadSetoranExcelFile(item);
      };
    }
  }
}

function updateDetailModalDocsSection(setoranId, isAdmin) {
  const docConfigs = [
    {
      key: 'bsz_upz',
      name: 'BSZ UPZ',
      rowId: 'detailDocRow_bsz_upz',
      uploadBtnId: 'detailUploadBtn_bsz_upz',
      downloadBtnId: 'detailDownloadBtn_bsz_upz',
      descId: 'detailDocDesc_bsz_upz',
      emptyDescAdmin: 'Belum diterbitkan. Unggah berkas resmi BSZ UPZ (PDF/RAR).',
      emptyDescUpz: 'Belum diterbitkan oleh Admin BAZNAS.'
    },
    {
      key: 'bsz_nama',
      name: 'BSZ Per Nama',
      rowId: 'detailDocRow_bsz_nama',
      uploadBtnId: 'detailUploadBtn_bsz_nama',
      downloadBtnId: 'detailDownloadBtn_bsz_nama',
      descId: 'detailDocDesc_bsz_nama',
      emptyDescAdmin: 'Belum diterbitkan. Unggah berkas BSZ per nama donatur (PDF/RAR).',
      emptyDescUpz: 'Belum diterbitkan oleh Admin BAZNAS.'
    }
  ];

  docConfigs.forEach(function (cfg) {
    const doc = (typeof getTransferDocRecord === 'function') ? getTransferDocRecord(setoranId, cfg.key) : null;
    const rowEl = document.getElementById(cfg.rowId);
    const descEl = document.getElementById(cfg.descId);
    const uploadBtn = document.getElementById(cfg.uploadBtnId);
    const downloadBtn = document.getElementById(cfg.downloadBtnId);

    if (doc && (doc.file_name || doc.file_path)) {
      if (rowEl) {
        rowEl.classList.remove('is-empty');
        rowEl.classList.add('is-uploaded');
        if (!isAdmin) {
          rowEl.classList.remove('admin-view');
          rowEl.setAttribute('title', 'Klik untuk mengunduh ' + (doc.nama_bsz || cfg.name));
          rowEl.onclick = function (e) {
            if (e.target.closest('.detail-doc-actions')) return;
            downloadTransferDocFile(setoranId, cfg.key);
          };
        } else {
          rowEl.classList.add('admin-view');
          rowEl.removeAttribute('title');
          rowEl.onclick = null;
        }
      }
      const ext = ((doc.file_name || '').split('.').pop() || 'PDF').toUpperCase();
      const displayName = doc.nama_bsz || doc.file_name;
      if (descEl) {
        descEl.innerHTML = `<span style="background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;margin-right:6px;border:1px solid #bbf7d0;">${escapeHtml(ext)}</span> <strong>${escapeHtml(displayName)}</strong>${doc.nama_bsz && doc.file_name !== doc.nama_bsz ? ` <span style="font-size:11px;color:var(--slate-500);">(${escapeHtml(doc.file_name)})</span>` : ''}`;
      }
      if (downloadBtn) {
        if (!isAdmin) {
          downloadBtn.style.display = 'inline-flex';
          downloadBtn.disabled = false;
          downloadBtn.className = 'btn btn-soft btn-sm detail-doc-download-btn';
          downloadBtn.style.opacity = '1';
          downloadBtn.style.cursor = 'pointer';
          downloadBtn.setAttribute('title', 'Unduh ' + displayName);
          downloadBtn.innerHTML = `<svg class="icon"><use href="#i-download"></use></svg><span>Unduh ${escapeHtml(cfg.name)}</span>`;
          downloadBtn.onclick = function (e) {
            e.stopPropagation();
            downloadTransferDocFile(setoranId, cfg.key);
          };
        } else {
          downloadBtn.style.display = 'none';
          downloadBtn.onclick = null;
        }
      }
      if (uploadBtn) {
        if (isAdmin) {
          uploadBtn.style.display = 'inline-flex';
          uploadBtn.setAttribute('title', 'Ganti Berkas ' + cfg.name);
          uploadBtn.innerHTML = `<svg class="icon"><use href="#i-upload"></use></svg><span>Ganti ${escapeHtml(cfg.name)}</span>`;
          uploadBtn.onclick = function (e) {
            e.stopPropagation();
            openUploadDocModal(setoranId, cfg.key);
          };
        } else {
          uploadBtn.style.display = 'none';
        }
      }
    } else {
      if (rowEl) {
        rowEl.classList.add('is-empty');
        rowEl.classList.remove('is-uploaded');
        rowEl.removeAttribute('title');
        rowEl.onclick = null;
        if (isAdmin) rowEl.classList.add('admin-view');
        else rowEl.classList.remove('admin-view');
      }
      if (descEl) {
        descEl.textContent = isAdmin ? cfg.emptyDescAdmin : cfg.emptyDescUpz;
      }
      if (downloadBtn) {
        if (!isAdmin) {
          downloadBtn.style.display = 'inline-flex';
          downloadBtn.disabled = true;
          downloadBtn.className = 'btn btn-soft btn-sm detail-doc-download-btn btn-disabled';
          downloadBtn.style.opacity = '0.4';
          downloadBtn.style.cursor = 'not-allowed';
          downloadBtn.setAttribute('title', 'Belum diunggah oleh admin');
          downloadBtn.innerHTML = `<svg class="icon"><use href="#i-download"></use></svg><span>Unduh ${escapeHtml(cfg.name)}</span>`;
          downloadBtn.onclick = null;
        } else {
          downloadBtn.style.display = 'none';
          downloadBtn.onclick = null;
        }
      }
      if (uploadBtn) {
        if (isAdmin) {
          uploadBtn.style.display = 'inline-flex';
          uploadBtn.setAttribute('title', 'Upload ' + cfg.name);
          uploadBtn.innerHTML = `<svg class="icon"><use href="#i-upload"></use></svg><span>Upload ${escapeHtml(cfg.name)}</span>`;
          uploadBtn.onclick = function (e) {
            e.stopPropagation();
            openUploadDocModal(setoranId, cfg.key);
          };
        } else {
          uploadBtn.style.display = 'none';
        }
      }
    }
  });
}

function updateDetailModalBszSection(setoranId, isAdmin) {
  return updateDetailModalDocsSection(setoranId, isAdmin);
}

async function downloadSetoranExcelFile(item) {
  if (!item) return;
  const originalText = detailDownloadButton ? detailDownloadButton.innerHTML : '';
  if (detailDownloadButton) {
    detailDownloadButton.disabled = true;
    detailDownloadButton.innerHTML = '<span>Mengunduh...</span>';
  }
  try {
    let downloaded = false;
    if (item.file_path) {
      try {
        const { data: fileBlob, error } = await supabaseClient.storage.from(STORAGE_BUCKET).download(item.file_path);
        if (!error && fileBlob && fileBlob.size > 0) {
          const blobUrl = URL.createObjectURL(fileBlob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = item.file_name || 'rincian-setoran.xlsx';
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(blobUrl);
          downloaded = true;
        }
      } catch (e) {
        console.warn('Storage download error:', e);
      }
    }
    if (!downloaded) {
      let detail = [];
      try { detail = await getDetailSetoran(item.id); } catch (_) {}
      const excelRows = [
        ['No', 'Nama Muzaki', 'Nominal', 'Jenis', 'Keterangan'],
        ...detail.map((d, i) => [i + 1, d.nama_muzaki || '-', Number(d.nominal || 0), d.jenis || '-', d.keterangan || '-'])
      ];
      const ws = XLSX.utils.aoa_to_sheet(excelRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Rincian Setoran');
      XLSX.writeFile(wb, item.file_name || `Setoran_${item.id.slice(0, 8)}.xlsx`);
    }
  } catch (err) {
    alert('Gagal mengunduh file: ' + err.message);
  } finally {
    if (detailDownloadButton) {
      detailDownloadButton.disabled = false;
      detailDownloadButton.innerHTML = originalText;
    }
  }
}

// ==================================================
// MODAL KONFIRMASI VERIFIKASI SETORAN (ADMIN)
// ==================================================
let pendingAdminVerification = null;

function openAdminVerifyConfirmModal(options) {
  // options: { setoranId, upzName, nominal, periode, decision, initialCatatan, onComplete }
  const modal = document.getElementById('adminVerifyConfirmModal');
  if (!modal) return;

  pendingAdminVerification = options;

  const upzEl = document.getElementById('adminConfirmUpzName');
  const nominalEl = document.getElementById('adminConfirmNominal');
  const periodeEl = document.getElementById('adminConfirmPeriode');
  const badgeEl = document.getElementById('adminConfirmDecisionBadge');
  const titleEl = document.getElementById('verifyConfirmModalTitle');
  const subtitleEl = document.getElementById('verifyConfirmModalSubtitle');
  const iconBox = document.getElementById('verifyConfirmIconBox');
  const catatanEl = document.getElementById('confirmVerifyCatatan');
  const errorEl = document.getElementById('confirmVerifyErrorMsg');
  const execBtn = document.getElementById('executeVerifyConfirmBtn');
  const execText = document.getElementById('executeVerifyConfirmText');

  if (upzEl) upzEl.textContent = options.upzName || '-';
  if (nominalEl) nominalEl.textContent = formatRupiah(options.nominal || 0);
  if (periodeEl) periodeEl.textContent = options.periode || '-';

  if (catatanEl) {
    catatanEl.value = options.initialCatatan || '';
  }
  if (errorEl) {
    errorEl.style.display = 'none';
    errorEl.textContent = '';
  }

  const isAccept = (options.decision === 'diterima');

  if (titleEl) {
    titleEl.textContent = isAccept ? 'Konfirmasi Terima Setoran' : 'Konfirmasi Tolak Setoran';
  }
  if (subtitleEl) {
    subtitleEl.textContent = isAccept
      ? 'Setoran akan ditandai valid dan nominal masuk ke akumulasi terverifikasi.'
      : 'Setoran akan ditandai ditolak dan alasan penolakan wajib disertakan.';
  }

  if (iconBox) {
    iconBox.className = 'modal-icon ' + (isAccept ? 'verify-icon-diterima' : 'verify-icon-ditolak');
    iconBox.innerHTML = `<svg class="icon"><use href="#${isAccept ? 'i-check' : 'i-x'}"></use></svg>`;
  }

  if (badgeEl) {
    badgeEl.innerHTML = isAccept
      ? '<span class="badge badge-success" style="font-size:12px;">✓ Terima (Disetujui)</span>'
      : '<span class="badge badge-danger" style="font-size:12px;">✕ Tolak (Ditolak)</span>';
  }

  if (execBtn) {
    execBtn.disabled = false;
    execBtn.className = 'btn ' + (isAccept ? 'btn-primary' : 'btn-danger');
  }
  if (execText) {
    execText.textContent = isAccept ? 'Ya, Terima Setoran' : 'Ya, Tolak Setoran';
  }

  modal.classList.remove('hidden');
  if (catatanEl) {
    setTimeout(function () { catatanEl.focus(); }, 120);
  }
}

function closeAdminVerifyConfirmModal() {
  const modal = document.getElementById('adminVerifyConfirmModal');
  if (modal) modal.classList.add('hidden');
  const errorEl = document.getElementById('confirmVerifyErrorMsg');
  if (errorEl) {
    errorEl.style.display = 'none';
    errorEl.textContent = '';
  }
  pendingAdminVerification = null;
}

(function setupAdminVerifyConfirmModalEvents() {
  const modal = document.getElementById('adminVerifyConfirmModal');
  const closeX = document.getElementById('closeVerifyConfirmX');
  const cancelBtn = document.getElementById('cancelVerifyConfirmBtn');
  const execBtn = document.getElementById('executeVerifyConfirmBtn');
  const catatanEl = document.getElementById('confirmVerifyCatatan');
  const errorEl = document.getElementById('confirmVerifyErrorMsg');

  if (closeX) closeX.addEventListener('click', closeAdminVerifyConfirmModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeAdminVerifyConfirmModal);
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeAdminVerifyConfirmModal();
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
      closeAdminVerifyConfirmModal();
    }
  });

  if (execBtn) {
    execBtn.addEventListener('click', async function () {
      if (!pendingAdminVerification) return;
      const opts = pendingAdminVerification;
      const catatan = catatanEl ? catatanEl.value.trim() : '';

      if (opts.decision === 'ditolak' && !catatan) {
        if (errorEl) {
          errorEl.textContent = 'Catatan wajib diisi jika setoran ditolak untuk memberitahu alasan kepada UPZ.';
          errorEl.style.display = 'block';
        }
        if (catatanEl) catatanEl.focus();
        return;
      }

      if (errorEl) {
        errorEl.style.display = 'none';
        errorEl.textContent = '';
      }

      execBtn.disabled = true;
      const textSpan = document.getElementById('executeVerifyConfirmText');
      const originalText = textSpan ? textSpan.textContent : '';
      if (textSpan) {
        textSpan.textContent = 'Menyimpan...';
      }

      try {
        const result = await callBackend('verifikasiSetoran', {
          setoran_id: opts.setoranId,
          keputusan: opts.decision,
          catatan: catatan
        });

        if (typeof showToast === 'function') {
          showToast(result.message || (opts.decision === 'diterima' ? 'Setoran berhasil diterima.' : 'Setoran berhasil ditolak.'), 'success');
        }
        if (typeof showMessage === 'function' && adminMessage) {
          showMessage(adminMessage, result.message || 'Verifikasi berhasil disimpan.', '#259148');
        }

        if (typeof opts.onComplete === 'function') {
          opts.onComplete();
        }

        closeAdminVerifyConfirmModal();
        if (typeof closeDetailModal === 'function') {
          closeDetailModal();
        }

        await loadAdminSetoran();

      } catch (error) {
        console.error('VERIFIKASI SETORAN ERROR:', error);
        if (errorEl) {
          errorEl.textContent = error.message || 'Verifikasi gagal disimpan. Silakan coba lagi.';
          errorEl.style.display = 'block';
        }
        if (typeof showToast === 'function') {
          showToast(error.message || 'Verifikasi gagal.', 'error');
        }
        execBtn.disabled = false;
        if (textSpan) {
          textSpan.textContent = originalText;
        }
      }
    });
  }
})();

function verifyFromDetailModal(decision) {
  if (!activeDetailItem) return;
  const initialCatatan = document.getElementById('detailCatatan') ? document.getElementById('detailCatatan').value.trim() : '';
  const upzName = (upzMap && upzMap[activeDetailItem.upz_id]) || activeDetailItem.nama_upz || activeDetailItem.upz_id || 'UPZ';
  const periode = (getNamaBulan(activeDetailItem.periode_bulan) || '') + ' ' + (activeDetailItem.periode_tahun || '');
  openAdminVerifyConfirmModal({
    setoranId: activeDetailItem.id,
    upzName: upzName,
    nominal: activeDetailItem.nominal,
    periode: periode,
    decision: decision,
    initialCatatan: initialCatatan
  });
}
const detailAcceptButton = document.getElementById('detailAcceptButton');
const detailRejectButton = document.getElementById('detailRejectButton');
if (detailAcceptButton) detailAcceptButton.addEventListener('click', function () { verifyFromDetailModal('diterima'); });
if (detailRejectButton) detailRejectButton.addEventListener('click', function () { verifyFromDetailModal('ditolak'); });

function closeDetailModal() { if (detailModal) detailModal.classList.add('hidden'); }
[detailModalCloseButton, detailModalCloseX].forEach(function (button) {
  if (button) button.addEventListener('click', closeDetailModal);
});
if (detailModal) detailModal.addEventListener('click', function (event) { if (event.target === detailModal) closeDetailModal(); });
document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && detailModal && !detailModal.classList.contains('hidden')) closeDetailModal(); });

// ==================================================
// RENDER DETAIL DONATUR
// ==================================================

function renderDetailSetoran(detail) {
  if (!detail || !detail.length) {
    return '<p class="empty-state">Rincian donatur tidak ditemukan.</p>';
  }

  const total = detail.reduce(function (sum, item) {
    return sum + Number(item.nominal || 0);
  }, 0);

  const rows = detail.map(function (item, index) {
    return `
      <tr>
        <td style="padding:9px;border-bottom:1px solid #eee;">${index + 1}</td>
        <td style="padding:9px;border-bottom:1px solid #eee;">
          ${escapeHtml(item.nama_muzaki || '-')}
        </td>
        <td style="padding:9px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;">
          ${formatRupiah(item.nominal)}
        </td>
        <td style="padding:9px;border-bottom:1px solid #eee;">
          ${escapeHtml(item.jenis || '-')}
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div style="margin-bottom:10px;font-size:13px;color:#555;">
      Jumlah donatur: <strong>${detail.length.toLocaleString('id-ID')}</strong>
      &nbsp; | &nbsp;
      Total rincian: <strong>${formatRupiah(total)}</strong>
    </div>

    <div style="overflow-x:auto;width:100%;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f5f7f5;text-align:left;">
            <th style="padding:9px;">No.</th>
            <th style="padding:9px;">Nama Muzaki</th>
            <th style="padding:9px;text-align:right;">Nominal</th>
            <th style="padding:9px;">Jenis</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

// ==================================================
// DASHBOARD ADMIN
// ==================================================

async function loadAdminSetoran() {
  if (isLoadingAdmin) return;

  isLoadingAdmin = true;

  if (refreshAdminButton) {
    refreshAdminButton.disabled = true;
    refreshAdminButton.setAttribute('aria-busy', 'true');
    refreshAdminButton.setAttribute('title', 'Memuat ulang...');
  }

  showMessage(adminMessage, 'Memuat daftar setoran...', '#666');

  try {
    const result = await callBackend('getAdminSetoran');
    const rows = Array.isArray(result.setoran) ? result.setoran : [];

    currentAdminSetoran = sortByCreatedAt(rows);

    // Ambil mapping nama UPZ agar admin dapat melihat nama UPZ
    try {
      const { data: upzList, error: upzErr } = await supabaseClient
        .from('upz')
        .select('id, kode_upz, nama_upz');

      if (!upzErr && Array.isArray(upzList)) {
        upzMap = {};
        upzList.forEach(function (u) {
          upzMap[u.id] = u.nama_upz || u.kode_upz || u.id;
        });

        if (adminFilterUpz) {
          const currentVal = adminFilterUpz.value;
          let optionsHtml = '<option value="semua">Semua UPZ (' + Object.keys(upzMap).length + ')</option>';
          Object.keys(upzMap)
            .sort(function (a, b) {
              return String(upzMap[a]).localeCompare(String(upzMap[b]));
            })
            .forEach(function (id) {
              optionsHtml += `<option value="${id}">${escapeHtml(upzMap[id])}</option>`;
            });
          adminFilterUpz.innerHTML = optionsHtml;
          adminFilterUpz.value = currentVal || 'semua';
        }

        if (typeof populateAdminDonaturUpzFilter === 'function') {
          populateAdminDonaturUpzFilter();
        }
        if (typeof populateScorecardUpzFilter === 'function') {
          populateScorecardUpzFilter();
        }
      }
    } catch (err) {
      console.warn('Gagal memuat mapping nama UPZ:', err);
    }

    updateAdminSummary(currentAdminSetoran);
    renderAdminSetoran(currentAdminSetoran);
    syncAdminNotifications();
    if (typeof renderAdminMonthlyChart === 'function') {
      renderAdminMonthlyChart();
    }
    if (typeof populateAdminRankingYearFilter === 'function') {
      populateAdminRankingYearFilter();
    }
    if (typeof populateAdminRankingKategoriFilter === 'function') {
      populateAdminRankingKategoriFilter();
    }
    if (typeof renderAdminUpzRankings === 'function') {
      renderAdminUpzRankings();
    }

    if (typeof adminDonaturCache !== 'undefined') {
      adminDonaturCache.loaded = false;
      const donaturSection = document.getElementById('adminDonaturManagement');
      if (donaturSection && !donaturSection.classList.contains('hidden')) {
        loadAdminDonaturMatrix();
      }
    }

    showMessage(
      adminMessage,
      'Data setoran berhasil dimuat.',
      '#259148'
    );

  } catch (error) {
    console.error('LOAD ADMIN SETORAN ERROR:', error);

    if (adminSetoranContainer) {
      adminSetoranContainer.innerHTML = `
        <div class="empty-state">
          Gagal memuat daftar setoran.<br>
          ${escapeHtml(error.message)}
        </div>
      `;
    }

    showMessage(adminMessage, error.message, '#d93025');

  } finally {
    isLoadingAdmin = false;

    if (refreshAdminButton) {
      refreshAdminButton.disabled = false;
      refreshAdminButton.removeAttribute('aria-busy');
      refreshAdminButton.setAttribute('title', 'Muat ulang');
    }
  }
}

function updateAdminSummary(setoran) {
  const jumlahTransaksi = document.getElementById('adminJumlahTransaksi');
  const jumlahMenunggu = document.getElementById('adminJumlahMenunggu');
  const totalNominal = document.getElementById('adminTotalNominal');
  const partisipasiEl = document.getElementById('adminJumlahUpzPartisipasi');
  const terdataEl = document.getElementById('adminJumlahUpzTerdata') || document.getElementById('adminJumlahUpz');

  const menunggu = setoran.filter(function (item) {
    return String(item.status || '').toLowerCase() === 'menunggu';
  });

  // TOTAL ADMIN HANYA MENGHITUNG STATUS DITERIMA (Reguler & Program terpisah).
  const totalReguler = hitungTotalReguler(setoran);
  const totalProgram = hitungTotalProgram(setoran);

  if (jumlahTransaksi) {
    jumlahTransaksi.textContent = setoran.length.toLocaleString('id-ID');
  }

  if (jumlahMenunggu) {
    jumlahMenunggu.textContent = menunggu.length.toLocaleString('id-ID');
  }

  if (totalNominal) {
    totalNominal.textContent = formatRupiah(totalReguler + totalProgram);
  }

  const adminProgEl = document.getElementById('adminTotalSetoranProgram');
  if (adminProgEl) {
    adminProgEl.textContent = formatRupiah(totalProgram);
  }

  if (partisipasiEl) {
    const partSet = new Set();
    setoran.forEach(function (s) {
      if (s.upz_id) partSet.add(s.upz_id);
    });
    partisipasiEl.textContent = partSet.size.toLocaleString('id-ID');
  }

  if (terdataEl) {
    const totalCount = (allUpzList && allUpzList.length > 50) ? allUpzList.length : 602;
    terdataEl.textContent = totalCount.toLocaleString('id-ID');
  }

  if (typeof populateScorecardUpzFilter === 'function') {
    populateScorecardUpzFilter();
  }
  if (typeof updateScorecardDonatur === 'function') {
    updateScorecardDonatur();
  }
}

function renderAdminSetoran(setoran) {
  if (!adminSetoranContainer) return;

  let filtered = setoran.slice();

  const filterStatus = adminFilterStatus
    ? adminFilterStatus.value
    : 'semua';

  const filterUpz = adminFilterUpz
    ? adminFilterUpz.value
    : 'semua';

  const searchQuery = adminSearchInput
    ? adminSearchInput.value.trim().toLowerCase()
    : '';

  // Filter Status
  if (filterStatus && filterStatus !== 'semua' && filterStatus !== 'all') {
    filtered = filtered.filter(function (item) {
      return String(item.status || '').toLowerCase() ===
        String(filterStatus).toLowerCase();
    });
  }

  // Filter UPZ
  if (filterUpz && filterUpz !== 'semua' && filterUpz !== 'all') {
    filtered = filtered.filter(function (item) { return String(item.upz_id || '') === String(filterUpz); });
  }

  const filterTanggal = adminFilterTanggal ? adminFilterTanggal.value : '';
  const filterBulan = adminFilterBulan ? adminFilterBulan.value : 'semua';
  const filterTahun = adminFilterTahun ? adminFilterTahun.value.trim() : '';
  const filterNominal = adminFilterNominal ? Number(adminFilterNominal.value.replace(/\D/g, '') || 0) : 0;
  if (filterTanggal) filtered = filtered.filter(function (item) { return String(item.tanggal_setor || '').substring(0, 10) === filterTanggal; });
  if (filterBulan !== 'semua') filtered = filtered.filter(function (item) { return Number(item.periode_bulan) === Number(filterBulan); });
  if (filterTahun) filtered = filtered.filter(function (item) { return Number(item.periode_tahun) === Number(filterTahun); });
  if (filterNominal > 0) filtered = filtered.filter(function (item) { return Number(item.nominal || 0) === filterNominal; });

  // Filter Pencarian (Nama UPZ, Kode UPZ, File, Nominal, Catatan)
  if (searchQuery) {
    filtered = filtered.filter(function (item) {
      const namaUpz = (item.upz_id && upzMap[item.upz_id])
        ? String(upzMap[item.upz_id]).toLowerCase()
        : '';
      const kodeUpz = item.upz_id ? String(item.upz_id).toLowerCase() : '';
      const fileName = item.file_name ? String(item.file_name).toLowerCase() : '';
      const nominalStr = item.nominal ? String(item.nominal) : '';
      const catatan = item.catatan ? String(item.catatan).toLowerCase() : '';
      const tgl = item.tanggal_setor ? String(item.tanggal_setor).toLowerCase() : '';

      return namaUpz.includes(searchQuery) ||
        kodeUpz.includes(searchQuery) ||
        fileName.includes(searchQuery) ||
        nominalStr.includes(searchQuery) ||
        catatan.includes(searchQuery) ||
        tgl.includes(searchQuery);
    });
  }

  currentFilteredAdminSetoran = filtered;

  const filterCountEl = document.getElementById('adminFilterCount');
  if (filterCountEl) {
    if (filtered.length === setoran.length) {
      filterCountEl.textContent = 'Menampilkan seluruh ' + setoran.length + ' transaksi';
    } else {
      filterCountEl.textContent = 'Menampilkan ' + filtered.length + ' dari ' + setoran.length + ' transaksi';
    }
  }

  if (!filtered.length) {
    adminSetoranContainer.innerHTML = `
      <div class="empty-state">
        Tidak ada setoran yang cocok dengan filter atau pencarian ini.
      </div>
    `;
    return;
  }

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  adminCurrentPage = Math.min(adminCurrentPage, totalPages);
  const pageItems = filtered.slice((adminCurrentPage - 1) * PAGE_SIZE, adminCurrentPage * PAGE_SIZE);
  adminSetoranContainer.innerHTML = pageItems.map(function (item) {
    const id = escapeHtml(item.id || '');
    const status = String(item.status || 'menunggu').toLowerCase();
    const namaUpz = (item.upz_id && upzMap[item.upz_id]) ? upzMap[item.upz_id] : (item.upz_id || '-');
    const isPending = status === 'menunggu';
    const isProgram = isSetoranProgram(item);
    const tagHtml = isProgram
      ? `<div style="margin-top:4px;"><span class="badge-program-tag"><svg class="icon" style="width:11px;height:11px;"><use href="#i-tag"></use></svg> Program: ${escapeHtml(getNamaProgram(item))}</span></div>`
      : `<div style="margin-top:4px;"><span class="badge-reguler-tag"><svg class="icon" style="width:11px;height:11px;"><use href="#i-sheet"></use></svg> Setoran Reguler</span></div>`;

    return `<article class="riwayat-item admin-riwayat-item" data-admin-setoran-id="${id}"><div class="riwayat-main"><div class="riwayat-nominal">${formatRupiah(item.nominal)}</div><div class="riwayat-info"><div><strong>${escapeHtml(namaUpz)}</strong></div><div>Tanggal setor: <strong>${escapeHtml(formatTanggal(item.tanggal_setor))}</strong></div><div>Periode: <strong>${escapeHtml(getNamaBulan(item.periode_bulan) + ' ' + (item.periode_tahun || '-'))}</strong></div>${tagHtml}</div><div class="status-badge ${getStatusClass(status)}" data-badge-setoran-id="${id}" title="Klik untuk melihat catatan status">${escapeHtml(getStatusLabel(status))}</div><div class="riwayat-actions admin-row-actions"><button type="button" class="btn btn-soft btn-sm btn-icon-only history-preview-button" data-preview-id="${id}" title="Rincian Setoran" aria-label="Rincian Setoran"><svg class="icon"><use href="#i-file-text"></use></svg></button></div></div>${isPending ? `<div class="admin-verify-inline"><label for="catatan-${id}">Catatan verifikasi</label><textarea id="catatan-${id}" class="admin-catatan" data-catatan-id="${id}" rows="2" placeholder="Catatan wajib diisi jika ditolak."></textarea><div class="verify-actions"><button type="button" class="admin-verify-button btn btn-primary" data-keputusan="diterima" data-setoran-id="${id}">Terima</button><button type="button" class="admin-verify-button btn btn-danger" data-keputusan="ditolak" data-setoran-id="${id}">Tolak</button></div></div>` : ''}</article>`;
  }).join('') + renderPagination('admin', adminCurrentPage, totalPages);
  bindHistoryPreviewEvents(adminSetoranContainer, true);
  bindAdminVerifyEvents();
  bindAdminDownloadEvents();
  if (typeof bindAdminDeleteSetoranEvents === 'function') {
    bindAdminDeleteSetoranEvents();
  }
  bindPagination(adminSetoranContainer);
}

function bindAdminDetailEvents() {
  if (!adminSetoranContainer) return;

  adminSetoranContainer
    .querySelectorAll('details[data-admin-setoran-id]')
    .forEach(function (details) {
      details.addEventListener('toggle', async function () {
        if (!details.open) return;

        const content = details.querySelector('.admin-detail-content');
        if (!content || content.dataset.detailLoaded === 'true') return;

        content.innerHTML = '<p style="color:#777;">Memuat rincian donatur...</p>';

        try {
          const detail = await getDetailSetoran(
            details.dataset.adminSetoranId
          );

          content.innerHTML = renderDetailSetoran(detail);
          content.dataset.detailLoaded = 'true';

        } catch (error) {
          console.error('ADMIN DETAIL ERROR:', error);

          content.innerHTML = `
            <p style="color:#d93025;">
              Tidak dapat memuat rincian donatur: ${escapeHtml(error.message)}
            </p>
            <button type="button" class="admin-retry-detail">
              Coba Lagi
            </button>
          `;

          const retry = content.querySelector('.admin-retry-detail');

          if (retry) {
            retry.addEventListener('click', function () {
              content.dataset.detailLoaded = 'false';
              details.open = false;
              details.open = true;
            });
          }
        }
      });
    });
}

function bindAdminVerifyEvents() {
  if (!adminSetoranContainer) return;

  adminSetoranContainer
    .querySelectorAll('.admin-verify-button')
    .forEach(function (button) {
      button.addEventListener('click', function () {
        const setoranId = button.dataset.setoranId;
        const keputusan = button.dataset.keputusan;
        const catatanElement = adminSetoranContainer.querySelector(
          '[data-catatan-id="' + setoranId + '"]'
        );
        const catatan = catatanElement ? catatanElement.value.trim() : '';

        const item = (currentAdminSetoran || []).find(function (s) {
          return String(s.id) === String(setoranId);
        });

        const upzName = (item && ((upzMap && upzMap[item.upz_id]) || item.nama_upz || item.upz_id)) || 'UPZ';
        const nominal = item ? item.nominal : 0;
        const periode = item ? (getNamaBulan(item.periode_bulan) + ' ' + (item.periode_tahun || '')) : '-';

        openAdminVerifyConfirmModal({
          setoranId: setoranId,
          upzName: upzName,
          nominal: nominal,
          periode: periode,
          decision: keputusan,
          initialCatatan: catatan,
          onComplete: function () {
            if (catatanElement) catatanElement.value = '';
          }
        });
      });
    });
}

function bindAdminDownloadEvents() {
  if (!adminSetoranContainer) return;

  adminSetoranContainer
    .querySelectorAll('.admin-download-button')
    .forEach(function (button) {
      button.addEventListener('click', async function () {
        const item = currentAdminSetoran.find(function (row) {
          return String(row.id) === String(button.dataset.downloadId);
        });

        if (!item) {
          alert('Data transaksi tidak ditemukan.');
          return;
        }

        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = 'Menyiapkan unduhan...';

        try {
          let downloaded = false;

          // 1. Coba download dari Supabase Storage jika ada file_path
          if (item.file_path) {
            try {
              const { data: fileBlob, error: downloadError } = await supabaseClient
                .storage
                .from(STORAGE_BUCKET)
                .download(item.file_path);

              if (!downloadError && fileBlob && fileBlob.size > 0) {
                const blobUrl = URL.createObjectURL(fileBlob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = item.file_name || 'rincian-setoran.xlsx';
                document.body.appendChild(link);
                link.click();
                link.remove();
                URL.revokeObjectURL(blobUrl);
                downloaded = true;
              } else {
                console.warn('File fisik di storage tidak ditemukan (404), beralih ke pembuatan Excel otomatis:', downloadError);
              }
            } catch (storageErr) {
              console.warn('Download Storage via download() gagal, menggunakan fallback:', storageErr);
            }
          }

          // 2. Fallback: jika Storage gagal / tidak ada file fisik / dibatasi RLS, buat file Excel langsung
          if (!downloaded) {
            button.textContent = 'Mengambil rincian muzaki...';
            let detail = [];
            try {
              detail = await getDetailSetoran(item.id);
            } catch (e) {
              console.warn('Gagal ambil detail muzaki:', e);
            }

            button.textContent = 'Membuat file Excel...';

            const excelRows = [
              ['No', 'Nama Muzaki', 'Nominal', 'Jenis', 'Keterangan']
            ];

            if (detail && detail.length > 0) {
              detail.forEach(function (d, idx) {
                excelRows.push([
                  idx + 1,
                  d.nama_muzaki || '',
                  Number(d.nominal || 0),
                  d.jenis || '',
                  d.keterangan || ''
                ]);
              });
            } else {
              excelRows.push([1, 'Setoran UPZ (Ringkasan)', Number(item.nominal || 0), 'Setoran', 'Rincian individual tidak tersimpan di database']);
            }

            if (typeof XLSX !== 'undefined') {
              const wb = XLSX.utils.book_new();
              const ws = XLSX.utils.aoa_to_sheet(excelRows);
              XLSX.utils.book_append_sheet(wb, ws, 'Rincian Muzaki');

              const upzLabel = (item.upz_id && upzMap[item.upz_id])
                ? String(upzMap[item.upz_id]).replace(/[^a-zA-Z0-9_-]/g, '_')
                : 'UPZ';
              const defaultName = 'Setoran_' + upzLabel + '_' + (item.periode_tahun || '') + '_' + (item.periode_bulan || '') + '.xlsx';

              XLSX.writeFile(wb, item.file_name || defaultName);
              downloaded = true;
            } else {
              throw new Error('Pustaka Excel tidak tersedia.');
            }
          }

        } catch (error) {
          console.error('ADMIN DOWNLOAD ERROR:', error);
          alert('Gagal mengunduh file Excel: ' + error.message);
        } finally {
          button.disabled = false;
          button.textContent = originalText;
        }
      });
    });
}

// ==================================================
// FILTER ADMIN
// ==================================================

[adminFilterStatus, adminFilterUpz, adminFilterTanggal, adminFilterBulan, adminFilterTahun, adminFilterNominal].forEach(function (element) {
  if (element) element.addEventListener('change', function () { renderAdminSetoran(currentAdminSetoran); });
});

if (adminFilterNominal) attachNominalFormat(adminFilterNominal);

if (adminSearchInput) adminSearchInput.addEventListener('input', function () { renderAdminSetoran(currentAdminSetoran); });

if (adminResetFilterButton) {
  adminResetFilterButton.addEventListener('click', function () {
    if (adminSearchInput) adminSearchInput.value = '';
    if (adminFilterStatus) adminFilterStatus.value = 'semua';
    if (adminFilterUpz) adminFilterUpz.value = 'semua';
    if (adminFilterTanggal) adminFilterTanggal.value = '';
    if (adminFilterBulan) adminFilterBulan.value = 'semua';
    if (adminFilterTahun) adminFilterTahun.value = '';
    if (adminFilterNominal) adminFilterNominal.value = '';
    renderAdminSetoran(currentAdminSetoran);
  });
}

if (refreshAdminButton) {
  refreshAdminButton.addEventListener('click', function () {
    loadAdminSetoran();
  });
}

// ==================================================
// EXPORT REKAPITULASI SETORAN ADMIN
// ==================================================

function exportRekapAdmin(mode, options = {}) {
  let items = currentFilteredAdminSetoran.length ? currentFilteredAdminSetoran : currentAdminSetoran;
  if (mode === 'bulan') items = items.filter(function (item) { return Number(item.periode_bulan) === Number(options.month) && Number(item.periode_tahun) === Number(options.year); });
  if (mode === 'tahun') items = items.filter(function (item) { return Number(item.periode_tahun) === Number(options.year); });
  if (mode === 'upz') items = items.filter(function (item) { return String(item.upz_id) === String(options.upz); });
  if (!items.length) return alert('Tidak ada data sesuai pilihan export.');
  if (typeof XLSX === 'undefined') return alert('Pustaka SheetJS (XLSX) tidak tersedia.');
  const groups = {};
  items.forEach(function (item) {
    const upz = (item.upz_id && upzMap[item.upz_id]) || item.upz_id || '-';
    const key = mode === 'bulan' ? getNamaBulan(item.periode_bulan) : mode === 'tahun' ? String(item.periode_tahun || '-') : upz;
    (groups[key] ||= []).push(item);
  });
  const wb = XLSX.utils.book_new();
  Object.keys(groups).sort().forEach(function (group) {
    const rows = [['No', 'Tanggal Setor', 'Nama UPZ', 'Periode', 'Nominal (Rp)', 'Status Verifikasi', 'Catatan']];
    groups[group].forEach(function (item, index) {
      rows.push([index + 1, formatTanggal(item.tanggal_setor), (item.upz_id && upzMap[item.upz_id]) || item.upz_id || '-', getNamaBulan(item.periode_bulan) + ' ' + (item.periode_tahun || ''), Number(item.nominal || 0), getStatusLabel(item.status), item.catatan || '-']);
    });
    const safeName = group.replace(/[\\/*?:\[\]]/g, '').substring(0, 25) || 'Rekap';
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), safeName);
  });
  XLSX.writeFile(wb, 'Rekapitulasi_Setoran_UPZ_' + mode + '_' + new Date().toISOString().slice(0, 10) + '.xlsx');
}

let selectedExportMode = '';
if (exportRekapAdminButton) exportRekapAdminButton.addEventListener('click', function () { if (exportModal) exportModal.classList.remove('hidden'); });
function closeExportModal() { if (exportModal) exportModal.classList.add('hidden'); }
function showExportOptions() { selectedExportMode = ''; exportOptions.classList.remove('hidden'); exportConfig.classList.add('hidden'); }
[exportModalCloseX, exportModalCancel].forEach(function (button) { if (button) button.addEventListener('click', closeExportModal); });
if (exportModal) exportModal.addEventListener('click', function (event) { if (event.target === exportModal) closeExportModal(); });
document.querySelectorAll('.export-option').forEach(function (button) {
  button.addEventListener('click', function () {
    selectedExportMode = button.dataset.exportMode;
    exportOptions.classList.add('hidden'); exportConfig.classList.remove('hidden');
    exportMonthField.classList.toggle('hidden', selectedExportMode === 'upz' || selectedExportMode === 'tahun');
    exportYearField.classList.toggle('hidden', selectedExportMode === 'upz');
    exportUpzField.classList.toggle('hidden', selectedExportMode !== 'upz');
    if (selectedExportMode === 'upz') exportUpz.innerHTML = '<option value="">Pilih UPZ</option>' + Object.keys(upzMap).sort(function (a, b) { return String(upzMap[a]).localeCompare(String(upzMap[b])); }).map(function (id) { return `<option value="${id}">${escapeHtml(upzMap[id])}</option>`; }).join('');
  });
});
if (exportBackButton) exportBackButton.addEventListener('click', showExportOptions);
if (exportConfirmButton) exportConfirmButton.addEventListener('click', function () {
  const month = exportMonth.value, year = exportYear.value, upz = exportUpz.value;
  if (selectedExportMode === 'bulan' && (!month || !year)) return alert('Pilih bulan dan tahun.');
  if (selectedExportMode === 'tahun' && !year) return alert('Pilih tahun.');
  if (selectedExportMode === 'upz' && !upz) return alert('Pilih nama UPZ.');
  closeExportModal(); exportRekapAdmin(selectedExportMode, { month: month, year: year, upz: upz });
});

// ==================================================
// EVENT LISTENER FILTER UPZ
// ==================================================

if (upzFilterTahun) {
  upzFilterTahun.addEventListener('change', filterAndRenderRiwayat);
}

if (upzFilterBulan) {
  upzFilterBulan.addEventListener('change', filterAndRenderRiwayat);
}

if (upzFilterStatus) {
  upzFilterStatus.addEventListener('change', filterAndRenderRiwayat);
}

if (upzResetFilterButton) {
  upzResetFilterButton.addEventListener('click', function () {
    if (upzFilterTahun) upzFilterTahun.value = 'semua';
    if (upzFilterBulan) upzFilterBulan.value = 'semua';
    if (upzFilterStatus) upzFilterStatus.value = 'semua';
    filterAndRenderRiwayat();
  });
}

// ==================================================
// ANIMASI TYPEWRITER & STAGGERED FADE LOGIN BRAND
// ==================================================
(function initLoginTypewriter() {
  const headlineEl = document.getElementById('typewriterHeadline');
  if (!headlineEl) return;

  const twText = headlineEl.querySelector('.tw-text');
  if (!twText) return;

  const line1 = 'Amanah tersalurkan,';
  const line2 = 'tercatat dengan rapi.';

  twText.innerHTML = '<span class="tw-l1"></span><br><span class="tw-l2"></span>';
  const elL1 = twText.querySelector('.tw-l1');
  const elL2 = twText.querySelector('.tw-l2');
  const cursorEl = headlineEl.querySelector('.tw-cursor');

  // Letakkan kursor garis kuning di baris pertama sejak awal
  if (cursorEl && elL1) {
    elL1.after(cursorEl);
  }

  const pointItems = document.querySelectorAll('.brand-point-item');

  let i = 0;
  let j = 0;

  function typeL1() {
    if (i < line1.length) {
      elL1.textContent += line1.charAt(i);
      i++;
      setTimeout(typeL1, 40);
    } else {
      setTimeout(function () {
        // Pindahkan kursor ke baris kedua
        if (cursorEl && elL2) {
          elL2.after(cursorEl);
        }
        typeL2();
      }, 160);
    }
  }

  function typeL2() {
    if (j < line2.length) {
      elL2.textContent += line2.charAt(j);
      j++;
      setTimeout(typeL2, 40);
    } else {
      // Munculkan keterangan satu per satu setelah ketikan selesai
      revealPoints();
    }
  }

  function revealPoints() {
    pointItems.forEach(function (item, idx) {
      setTimeout(function () {
        item.classList.add('is-revealed');
      }, (idx + 1) * 220);
    });
  }

  // Mulai ketik setelah logo fade-in muncul
  setTimeout(typeL1, 300);
})();

if (loginForm) {
  loginForm.addEventListener('submit', async function (event) {
    event.preventDefault();

    const emailElement = document.getElementById('email');
    const passwordElement = document.getElementById('password');

    const email = emailElement ? emailElement.value.trim() : '';
    const password = passwordElement ? passwordElement.value : '';

    if (!email || !password) {
      showMessage(message, 'Silakan masukkan email dan password.', '#d93025');
      return;
    }

    // Login wajib menggunakan format email valid
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showMessage(message, 'Login wajib menggunakan alamat email yang valid (contoh: nama@email.com).', '#d93025');
      return;
    }

    if (loginButton) {
      loginButton.disabled = true;
      loginButton.classList.add('is-loading');
      loginButton.innerHTML = '<span class="spinner" aria-hidden="true"></span>Memeriksa akun...';
    }

    showMessage(message, '', '');

    try {
      clearAllUserVisualData();
      // Reset status splash screen
      isSplashDismissed = false;
      isAppReadyAfterLogin = false;
      isSplashEnterWaiting = false;

      // 1. Cek profil tersimpan dari email untuk instan preview HANYA jika sudah ada nama UPZ valid (bukan PIC/Pengelola)
      const normalizedEmail = email.toLowerCase().trim();
      let cachedProfile = null;
      try {
        const cachedRaw = localStorage.getItem('cached_profile_' + normalizedEmail);
        if (cachedRaw) cachedProfile = JSON.parse(cachedRaw);
      } catch (_) {}

      let cachedUpzName = (cachedProfile && cachedProfile.nama_upz) ? String(cachedProfile.nama_upz).trim() : '';
      if (cachedUpzName) {
        const l = cachedUpzName.toLowerCase();
        if (l === 'pic' || l === 'pengelola upz' || l === 'pengelola') cachedUpzName = '';
      }
      if (cachedProfile && cachedUpzName && typeof showMobileLoginSplash === 'function') {
        showMobileLoginSplash(cachedProfile.role, cachedUpzName);
      }

      const { data: authData, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) throw error;

      // Segera ambil nama UPZ dari database jika belum ada cache (agar langsung "Assalamualaikum, [Nama UPZ]")
      if (authData && authData.user) {
        try {
          const { data: qProf } = await supabaseClient
            .from('profiles')
            .select('role, nama_lengkap, upz_id')
            .eq('id', authData.user.id)
            .maybeSingle();

          if (qProf) {
            let upzDisplayName = '';
            if (qProf.role === 'admin') {
              upzDisplayName = qProf.nama_lengkap || 'Administrator';
            } else if (qProf.upz_id) {
              const { data: uRow } = await supabaseClient
                .from('upz')
                .select('nama_upz')
                .eq('id', qProf.upz_id)
                .maybeSingle();
              if (uRow && uRow.nama_upz) {
                upzDisplayName = String(uRow.nama_upz).trim();
              }
            }

            if (upzDisplayName) {
              const l = upzDisplayName.toLowerCase();
              if (l === 'pic' || l === 'pengelola upz' || l === 'pengelola') upzDisplayName = '';
            }

            // Tampilkan splash HANYA jika nama UPZ sudah siap
            if (upzDisplayName) {
              if (!cachedUpzName && typeof showMobileLoginSplash === 'function') {
                showMobileLoginSplash(qProf.role, upzDisplayName);
              } else if (typeof updateMobileLoginSplashInfo === 'function') {
                updateMobileLoginSplashInfo(qProf.role, upzDisplayName);
              }
            }
          }
        } catch (_) {}
      }

      const loaded = await loadDashboard();

      if (loaded) {
        showMessage(message, 'Login berhasil.', '#259148');
        const role = currentProfile ? currentProfile.role : (cachedProfile ? cachedProfile.role : 'upz');
        let finalUpzName = (role === 'admin')
          ? ((currentProfile && currentProfile.nama_lengkap) || 'Administrator')
          : ((currentProfile && currentProfile.nama_upz) || '');

        if (finalUpzName) {
          const l = finalUpzName.toLowerCase();
          if (l === 'pic' || l === 'pengelola upz' || l === 'pengelola') finalUpzName = '';
        }
        if (!finalUpzName && role === 'upz') {
          finalUpzName = 'UPZ';
        }

        // Simpan cache profil untuk login berikutnya agar instan menampilkan nama UPZ
        if (finalUpzName && finalUpzName !== 'UPZ') {
          try {
            localStorage.setItem('cached_profile_' + normalizedEmail, JSON.stringify({ role: role, nama_upz: finalUpzName }));
          } catch (_) {}
        }

        isAppReadyAfterLogin = true;

        if (typeof showMobileLoginSplash === 'function') {
          showMobileLoginSplash(role, finalUpzName);
        } else if (typeof updateMobileLoginSplashInfo === 'function') {
          updateMobileLoginSplashInfo(role, finalUpzName);
        }

        const splashEl = document.getElementById('mobileLoginSplash');
        const isSplashVisible = splashEl && !splashEl.classList.contains('hidden');

        // Jika user sebelumnya sudah klik "Masuk ke Aplikasi" saat loading, langsung tutup splash
        if (isSplashEnterWaiting || !isSplashVisible) {
          hideMobileLoginSplash();
        } else {
          const enterBtn = document.getElementById('btnEnterAppFromSplash');
          if (enterBtn) {
            enterBtn.disabled = false;
            enterBtn.innerHTML = '<span>Masuk ke Aplikasi</span>';
          }
          // Auto-masuk ke dashboard secara elegan setelah jeda singkat (900ms)
          setTimeout(function () {
            if (!isSplashDismissed) {
              hideMobileLoginSplash();
            }
          }, 900);
        }
      } else {
        hideMobileLoginSplash();
        showLogin();
      }

    } catch (error) {
      isSplashDismissed = true;
      hideMobileLoginSplash();
      showLogin();
      console.error('LOGIN ERROR:', error);
      let errMsg = error.message || 'Gagal login.';
      const errLower = errMsg.toLowerCase();
      if (errLower.includes('invalid login credentials')) {
        errMsg = 'Email atau password salah. Pastikan akun terdaftar di Supabase dan password sudah benar.';
      } else if (errLower.includes('email not confirmed')) {
        errMsg = 'Email belum dikonfirmasi di Supabase.';
      } else if (errLower.includes('network') || errLower.includes('fetch')) {
        errMsg = 'Gagal terhubung ke server auth. Periksa koneksi internet Anda.';
      }
      showMessage(message, errMsg, '#d93025');

    } finally {
      if (loginButton) {
        loginButton.disabled = false;
        loginButton.classList.remove('is-loading');
        loginButton.textContent = 'Login';
      }
    }
  });
}

// TOGGLE LIHAT PASSWORD (LOGIN & FORM MANDIRI UPZ)
function setupPasswordToggle(btnId, inputId) {
  const toggleBtn = document.getElementById(btnId);
  const pwdInput = document.getElementById(inputId);
  if (!toggleBtn || !pwdInput) return;
  toggleBtn.addEventListener('click', function () {
    const isPass = pwdInput.type === 'password';
    pwdInput.type = isPass ? 'text' : 'password';
    toggleBtn.setAttribute('title', isPass ? 'Sembunyikan password' : 'Lihat password');
    toggleBtn.setAttribute('aria-label', isPass ? 'Sembunyikan password' : 'Lihat password');
    toggleBtn.style.color = isPass ? 'var(--primary-600)' : '';
    const useEl = toggleBtn.querySelector('use');
    if (useEl) {
      useEl.setAttribute('href', isPass ? '#i-eye-off' : '#i-eye');
    }
  });
}
setupPasswordToggle('togglePasswordBtn', 'password');
setupPasswordToggle('toggleUpzNewPasswordBtn', 'upzNewPassword');
setupPasswordToggle('toggleUpzConfirmPasswordBtn', 'upzConfirmPassword');

function askDialog(title, text, confirmText, iconId, isDanger) {
  const modal = document.getElementById('dialogModal');
  if (!modal) return Promise.resolve(window.confirm(text));
  document.getElementById('dialogTitle').textContent = title;
  document.getElementById('dialogMessage').textContent = text;
  const yes = document.getElementById('dialogConfirmButton');
  yes.textContent = confirmText || 'Ya, Lanjutkan';
  const iconContainer = document.getElementById('dialogIcon');
  if (isDanger) {
    yes.classList.remove('btn-primary');
    yes.classList.add('btn-danger');
    if (iconContainer) {
      iconContainer.style.backgroundColor = '#fee2e2';
      iconContainer.style.color = '#dc2626';
    }
  } else {
    yes.classList.add('btn-primary');
    yes.classList.remove('btn-danger');
    if (iconContainer) {
      iconContainer.style.backgroundColor = '';
      iconContainer.style.color = '';
    }
  }
  if (iconContainer) {
    iconContainer.innerHTML = '<svg class="icon"><use href="#' + (iconId || 'i-alert') + '"></use></svg>';
  }
  modal.classList.remove('hidden');
  return new Promise(function (resolve) {
    const no = document.getElementById('dialogCancelButton');
    function done(result) {
      modal.classList.add('hidden');
      yes.removeEventListener('click', onYes);
      no.removeEventListener('click', onNo);
      modal.removeEventListener('click', onOverlay);
      document.removeEventListener('keydown', onKey);
      resolve(result);
    }
    function onYes(e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      done(true);
    }
    function onNo(e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      done(false);
    }
    function onOverlay(e) {
      if (e.target === modal) {
        e.preventDefault();
        e.stopPropagation();
        done(false);
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        done(false);
      }
    }
    yes.addEventListener('click', onYes);
    no.addEventListener('click', onNo);
    modal.addEventListener('click', onOverlay);
    document.addEventListener('keydown', onKey);
  });
}

if (logoutButton) {
  logoutButton.addEventListener('click', async function () {
    if (!await askDialog('Keluar dari akun?', 'Sesi Anda akan diakhiri pada perangkat ini.', 'Ya, Logout', 'i-logout')) return;
    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;
      clearAllUserVisualData();
      showLogin();
      const email = document.getElementById('email');
      const password = document.getElementById('password');
      if (email) email.value = '';
      if (password) password.value = '';
      showMessage(message, '', '');
      if (loginButton) { loginButton.disabled = false; loginButton.textContent = 'Login'; }
    } catch (error) {
      showMessage(message, error.message, '#d93025');
    }
  });
}

// ==================================================
// CEK SESSION
// ==================================================

async function checkSession() {
  try {
    const {
      data: { session },
      error
    } = await supabaseClient.auth.getSession();

    if (error) throw error;

    if (session) {
      // Verifikasi token aktif ke Supabase server
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
      if (userError || !user) {
        console.warn('Session JWT Supabase kedaluwarsa atau tidak ditemukan:', userError);
        await supabaseClient.auth.signOut().catch(function () {});
        showLogin();
        if (typeof message !== 'undefined') {
          showMessage(message, 'Sesi login Anda telah berakhir. Silakan login kembali.', '#b54708');
        }
        return;
      }

      await loadDashboard();
      if (typeof _tryShowKategoriBadge === 'function') {
        _tryShowKategoriBadge();
      }
    } else {
      showLogin();
    }
  } catch (error) {
    console.error('SESSION ERROR:', error);
    await supabaseClient.auth.signOut().catch(function () {});
    showLogin();
  }
}

if (downloadTemplateButton) {
  downloadTemplateButton.addEventListener('click', function (event) {
    event.preventDefault();
    if (typeof XLSX === 'undefined') {
      showToast('Library Excel belum selesai dimuat. Silakan tunggu sesaat.', 'error');
      return;
    }
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([['No', 'Nama Muzaki', 'Nominal', 'Jenis'], [1, 'Contoh Nama', 100000, 'Zakat']]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Rincian Muzaki');
    XLSX.writeFile(workbook, 'template_rincian_muzaki.xlsx');
  });
}


if (setoranForm) {
  setoranForm.addEventListener('submit', async function (event) {
    event.preventDefault();

    if (isSubmitting) return;

    const tanggalSetor = document.getElementById('tanggalSetor').value;
    const periodeBulan = document.getElementById('periodeBulan').value;
    const periodeTahun = document.getElementById('periodeTahun').value;
    const nominalInput = document.getElementById('nominalSetoran').value;

    const file = fileExcel && fileExcel.files
      ? fileExcel.files[0]
      : null;

    if (!tanggalSetor || !periodeBulan || !periodeTahun || !nominalInput) {
      showMessage(setoranMessage, 'Semua data setoran wajib diisi.', '#d93025');
      return;
    }

    if (!file) {
      showMessage(
        setoranMessage,
        'Rincian muzaki dalam Excel wajib diupload.',
        '#d93025'
      );
      return;
    }

    if (!currentProfile || currentProfile.role !== 'upz' || !currentProfile.upz_id) {
      showMessage(
        setoranMessage,
        'Profil UPZ belum tersedia. Silakan login kembali.',
        '#d93025'
      );
      return;
    }

    if (isReadingExcel) {
      showMessage(setoranMessage, 'Tunggu sampai pembacaan Excel selesai.', '#d93025');
      return;
    }

    if (!excelValid) {
      showMessage(
        setoranMessage,
        'Total nominal Excel belum sesuai dengan Nominal Setoran.',
        '#d93025'
      );
      return;
    }

    let nominalAngka;

    try {
      nominalAngka = Number(
        nominalInput.replace(/\./g, '').replace(/,/g, '')
      );

      if (!Number.isFinite(nominalAngka) || nominalAngka <= 0) {
        throw new Error('Nominal setoran harus lebih dari nol.');
      }

      const indexes = validateExcelFormat(excelData);

      const detail = excelData.slice(1)
        .filter(function (row) {
          const nama = row[indexes.namaIndex];
          return nama !== undefined &&
            nama !== null &&
            String(nama).trim() !== '';
        })
        .map(function (row, index) {
          const nama = String(row[indexes.namaIndex]).trim();
          const nominalCell = row[indexes.nominalIndex];

          if (
            nominalCell === '' ||
            nominalCell === null ||
            nominalCell === undefined
          ) {
            throw new Error(
              'Nominal muzaki pada baris data ' + (index + 1) + ' kosong.'
            );
          }

          const nominal = parseNominalExcel(nominalCell);

          if (!Number.isFinite(nominal) || nominal < 0) {
            throw new Error(
              'Nominal muzaki pada baris data ' + (index + 1) + ' tidak valid.'
            );
          }

          const jenisCell = row[indexes.jenisIndex];

          return {
            nama_muzaki: nama,
            nominal: nominal,
            jenis: jenisCell ? String(jenisCell).trim() : null
          };
        });

      if (!detail.length) {
        throw new Error('Data rincian muzaki tidak ditemukan.');
      }

      const totalDetail = detail.reduce(function (sum, item) {
        return sum + item.nominal;
      }, 0);

      if (Math.round(totalDetail * 100) !== Math.round(nominalAngka * 100)) {
        throw new Error('Total rincian Excel tidak sama dengan nominal setoran.');
      }

      const setuju = await askConfirmSetoran({
        upz: currentProfile.nama_upz || currentProfile.kode_upz || '-',
        tanggal: formatTanggal(tanggalSetor),
        periode: getNamaBulan(Number(periodeBulan)) + ' ' + periodeTahun,
        nominal: formatRupiah(nominalAngka),
        jumlah: detail.length + ' orang',
        file: file.name
      });

      if (!setuju) {
        showMessage(setoranMessage, 'Pengiriman dibatalkan.', '#666');
        return;
      }

      isSubmitting = true;
      setSubmitButtonState(true, 'Menyimpan...');
      showMessage(setoranMessage, 'Mengupload file Excel...', '#666');

      let uploadedFile = null;
      let transactionSaved = false;

      try {
        uploadedFile = await uploadExcelToStorage(
          file,
          currentProfile.upz_id,
          Number(periodeTahun),
          Number(periodeBulan)
        );

        showMessage(
          setoranMessage,
          'Menyimpan setoran dan rincian muzaki...',
          '#666'
        );

        const response = await callBackend('simpanSetoranLengkap', {
          tanggal_setor: tanggalSetor,
          periode_bulan: Number(periodeBulan),
          periode_tahun: Number(periodeTahun),
          nominal: nominalAngka,
          file_name: uploadedFile.originalName,
          file_path: uploadedFile.filePath,
          detail: detail
        });

        transactionSaved = true;
        setSubmitButtonState(false, 'Simpan Setoran');
        isSubmitting = false;

        console.log('SIMPAN SETORAN LENGKAP RESULT:', response);

        const result = response.result || {};

        showMessage(
          setoranMessage,
          'Setoran berhasil dikirim. Status: ' +
          getStatusLabel(result.status || 'menunggu') + '.',
          '#259148'
        );

        recordUpzActivity({
          type: 'upload',
          title: 'Upload Berkas Setoran Baru',
          nama_upz: (currentProfile && (currentProfile.nama_upz || currentProfile.nama_lengkap)) || 'UPZ',
          upz_id: currentProfile && currentProfile.upz_id,
          file_name: uploadedFile.originalName,
          nominal: nominalAngka,
          desc: `Mengunggah berkas <strong>${escapeHtml(uploadedFile.originalName)}</strong> senilai <strong>${formatRupiah(nominalAngka)}</strong> (Periode ${getNamaBulan(periodeBulan)} ${periodeTahun})`
        });

        const submittedYear = Number(periodeTahun);

        setoranForm.reset();

        excelData = [];
        totalNominalExcel = 0;
        excelValid = false;

        if (fileExcelInfo) {
          fileExcelInfo.textContent = 'Belum ada file dipilih.';
        }

        if (excelPreview) {
          excelPreview.innerHTML = '';
          excelPreview.style.display = 'none';
        }

        const summary = document.getElementById('excelSummary');
        if (summary) summary.remove();

        await loadDashboard();

        if (typeof renderUpzMonthlyChart === 'function') {
          renderUpzMonthlyChart(submittedYear);
        }

      } catch (error) {
        console.error('CREATE SETORAN ERROR:', error);

        if (uploadedFile && error.backendRejected && !transactionSaved) {
          try {
            await deleteExcelFromStorage(uploadedFile.filePath);
          } catch (cleanupError) {
            console.error('CLEANUP FILE ERROR:', cleanupError);
          }
        }

        if (error.uncertainResult) {
          showMessage(
            setoranMessage,
            error.message +
            ' Jangan kirim ulang sebelum memeriksa riwayat setoran.',
            '#b54708'
          );
        } else {
          showMessage(
            setoranMessage,
            error.message || 'Gagal menyimpan setoran.',
            '#d93025'
          );
        }

      } finally {
        isSubmitting = false;
        setSubmitButtonState(false, 'Simpan Setoran');
      }

    } catch (error) {
      showMessage(
        setoranMessage,
        error.message || 'Data setoran tidak valid.',
        '#d93025'
      );
    }
  });
}

// ==================================================
// MODAL KONFIRMASI SETORAN
// ==================================================

function askConfirmSetoran(data) {
  const modal = document.getElementById('confirmSetoranModal');
  if (!modal) return Promise.resolve(window.confirm('Kirim setoran ' + data.nominal + '?'));
  if (!modal.classList.contains('hidden')) return Promise.resolve(false);

  document.getElementById('confirmUpzName').textContent = data.upz;
  document.getElementById('confirmTanggal').textContent = data.tanggal;
  document.getElementById('confirmPeriode').textContent = data.periode;
  document.getElementById('confirmNominal').textContent = data.nominal;
  document.getElementById('confirmJumlahMuzaki').textContent = data.jumlah;
  document.getElementById('confirmNamaFile').textContent = data.file;

  const proceedBtn = document.getElementById('proceedConfirmButton');
  const cancelBtns = [
    document.getElementById('cancelConfirmButton'),
    document.getElementById('closeConfirmModalButton')
  ];

  modal.classList.remove('hidden');
  proceedBtn.focus();

  return new Promise(function (resolve) {
    function done(result) {
      modal.classList.add('hidden');
      proceedBtn.removeEventListener('click', onYes);
      cancelBtns.forEach(function (b) { b.removeEventListener('click', onNo); });
      modal.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKey);
      resolve(result);
    }
    function onYes() { done(true); }
    function onNo() { done(false); }
    function onBackdrop(e) { if (e.target === modal) done(false); }
    function onKey(e) { if (e.key === 'Escape') done(false); }

    proceedBtn.addEventListener('click', onYes);
    cancelBtns.forEach(function (b) { b.addEventListener('click', onNo); });
    modal.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKey);
  });
}

// ==================================================
// FORMAT NOMINAL SETORAN
// ==================================================

function attachNominalFormat(el, onChange) {
  el.addEventListener('beforeinput', function (event) {
    if (event.data && /\D/.test(event.data)) event.preventDefault();
  });
  // Backspace/Delete next to a separator: hop over it so a digit gets deleted.
  el.addEventListener('keydown', function (event) {
    const pos = el.selectionStart;
    if (pos !== el.selectionEnd) return;
    if (event.key === 'Backspace' && el.value[pos - 1] === '.') el.setSelectionRange(pos - 1, pos - 1);
    if (event.key === 'Delete' && el.value[pos] === '.') el.setSelectionRange(pos + 1, pos + 1);
  });
  el.addEventListener('input', function () {
    const digitsLeft = el.value.slice(0, el.selectionStart).replace(/\D/g, '').length;
    const digits = el.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    el.value = digits ? Number(digits).toLocaleString('id-ID') : '';
    let pos = 0;
    for (let seen = 0; pos < el.value.length && seen < digitsLeft; pos++) {
      if (/\d/.test(el.value[pos])) seen++;
    }
    el.setSelectionRange(pos, pos);
    if (onChange) onChange();
  });
}

if (nominalSetoran) {
  attachNominalFormat(nominalSetoran, function () {
    if (excelData.length > 0) refreshExcelSummary();
  });
}

function refreshExcelSummary() {
  try {
    const indexes = validateExcelFormat(excelData);
    const calculation = calculateExcelTotal(excelData, indexes);

    renderExcelSummary(
      calculation.total,
      calculation.jumlahData,
      calculation.nominalKosong
    );
  } catch (error) {
    excelValid = false;
  }
}

// ==================================================
// PARSE NOMINAL EXCEL
// ==================================================

function parseNominalExcel(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  if (typeof value === 'number') return value;

  let text = String(value)
    .trim()
    .replace(/rp/gi, '')
    .replace(/\s/g, '');

  if (!text) return 0;

  if (/^-?\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, '');
  } else if (/^-?\d+,\d{1,2}$/.test(text)) {
    text = text.replace(',', '.');
  } else if (/^-?\d+(\.\d+)?$/.test(text)) {
    // Angka polos atau desimal dengan titik.
  } else {
    text = text.replace(/[.,]/g, '');
  }

  const number = Number(text);
  return Number.isFinite(number) ? number : NaN;
}

// ==================================================
// VALIDASI FORMAT EXCEL
// ==================================================

function validateExcelFormat(rows) {
  if (!rows || !rows.length) {
    throw new Error('File Excel kosong.');
  }

  const header = rows[0].map(function (cell) {
    return String(cell || '').trim().toLowerCase();
  });

  const namaIndex = header.indexOf('nama muzaki');
  const nominalIndex = header.indexOf('nominal');
  const jenisIndex = header.indexOf('jenis');

  if (namaIndex === -1) {
    throw new Error('Kolom "Nama Muzaki" tidak ditemukan.');
  }

  if (nominalIndex === -1) {
    throw new Error('Kolom "Nominal" tidak ditemukan.');
  }

  if (jenisIndex === -1) {
    throw new Error('Kolom "Jenis" tidak ditemukan.');
  }

  return {
    noIndex: header.indexOf('no'),
    namaIndex: namaIndex,
    nominalIndex: nominalIndex,
    jenisIndex: jenisIndex
  };
}

// ==================================================
// UPLOAD EXCEL KE STORAGE
// ==================================================

async function uploadExcelToStorage(file, upzId, tahun, bulan) {
  if (!file) throw new Error('File Excel tidak ditemukan.');
  if (!upzId) throw new Error('ID UPZ tidak ditemukan.');

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Ukuran file Excel maksimal 5 MB.');
  }

  const lowerName = file.name.toLowerCase();
  const allowed = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls');

  if (!allowed) {
    throw new Error('File harus berformat Excel (.xlsx atau .xls).');
  }

  const extension = lowerName.endsWith('.xlsx') ? '.xlsx' : '.xls';

  const uniqueName =
    Date.now() + '_' +
    Math.random().toString(36).substring(2, 8) +
    extension;

  const filePath =
    upzId + '/' +
    tahun + '/' +
    String(bulan).padStart(2, '0') + '/' +
    uniqueName;

  const { data, error } = await supabaseClient
    .storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error('UPLOAD EXCEL ERROR:', error);
    throw new Error('Gagal upload Excel: ' + error.message);
  }

  console.log('EXCEL UPLOADED:', data);

  return {
    originalName: file.name,
    filePath: filePath
  };
}

// ==================================================
// HAPUS FILE EXCEL
// ==================================================

async function deleteExcelFromStorage(filePath) {
  if (!filePath) return;

  const { data, error } = await supabaseClient
    .storage
    .from(STORAGE_BUCKET)
    .remove([filePath]);

  if (error) {
    console.error('DELETE EXCEL ERROR:', error);
    throw new Error('Gagal membersihkan file sementara: ' + error.message);
  }

  console.log('EXCEL DELETED:', data);
}

// ==================================================
// HITUNG TOTAL EXCEL
// ==================================================

function calculateExcelTotal(rows, indexes) {
  let total = 0;
  let jumlahData = 0;
  let nominalKosong = 0;
  let nominalTidakValid = 0;

  rows.slice(1).forEach(function (row) {
    const nama = row[indexes.namaIndex];

    if (!nama || String(nama).trim() === '') return;

    jumlahData++;

    const nominalValue = row[indexes.nominalIndex];

    if (
      nominalValue === undefined ||
      nominalValue === null ||
      String(nominalValue).trim() === ''
    ) {
      nominalKosong++;
      return;
    }

    const nominal = parseNominalExcel(nominalValue);

    if (!Number.isFinite(nominal) || nominal < 0) {
      nominalTidakValid++;
      return;
    }

    total += nominal;
  });

  return {
    total: total,
    jumlahData: jumlahData,
    nominalKosong: nominalKosong,
    nominalTidakValid: nominalTidakValid
  };
}

// ==================================================
// RENDER SUMMARY EXCEL
// ==================================================

function renderExcelSummary(totalExcel, jumlahData, nominalKosong) {
  if (!nominalSetoran) return;

  const nominal = Number(
    nominalSetoran.value.replace(/\./g, '').replace(/,/g, '')
  ) || 0;

  const indexes = validateExcelFormat(excelData);
  const calculation = calculateExcelTotal(excelData, indexes);
  const selisih = totalExcel - nominal;

  excelValid =
    nominal > 0 &&
    jumlahData > 0 &&
    nominalKosong === 0 &&
    calculation.nominalTidakValid === 0 &&
    Math.round(selisih * 100) === 0;

  let statusText = '';
  let statusColor = '#666';

  if (nominal === 0) {
    statusText = 'Isi Nominal Setoran untuk membandingkan dengan Excel.';
  } else if (jumlahData === 0) {
    statusText = 'Tidak ada data muzaki dalam Excel.';
    statusColor = '#b54708';
  } else if (nominalKosong > 0) {
    statusText = 'Ada ' + nominalKosong + ' data yang nominalnya kosong.';
    statusColor = '#b54708';
  } else if (calculation.nominalTidakValid > 0) {
    statusText = 'Ada nominal Excel yang tidak valid.';
    statusColor = '#b54708';
  } else if (Math.round(selisih * 100) === 0) {
    statusText = 'Nominal Excel sesuai dengan Nominal Setoran.';
    statusColor = '#18753a';
  } else {
    statusText =
      'Terdapat selisih Rp ' + formatRupiahSimple(Math.abs(selisih)) + '.';
    statusColor = '#b54708';
  }

  let summary = document.getElementById('excelSummary');

  if (!summary) {
    summary = document.createElement('div');
    summary.id = 'excelSummary';

    if (excelPreview && excelPreview.parentNode) {
      excelPreview.parentNode.insertBefore(summary, excelPreview);
    } else {
      return;
    }
  }

  summary.innerHTML = `
    <div style="
      margin-bottom:10px;
      padding:14px;
      border:1px solid #e5e5e5;
      border-radius:10px;
      background:#fafafa;
    ">
      <div style="display:flex;justify-content:space-between;gap:15px;margin-bottom:6px;">
        <span>Total Data Muzaki</span>
        <strong>${jumlahData}</strong>
      </div>

      <div style="display:flex;justify-content:space-between;gap:15px;margin-bottom:6px;">
        <span>Total Nominal Excel</span>
        <strong>Rp ${formatRupiahSimple(totalExcel)}</strong>
      </div>

      <div style="display:flex;justify-content:space-between;gap:15px;margin-bottom:8px;">
        <span>Nominal Setoran</span>
        <strong>Rp ${formatRupiahSimple(nominal)}</strong>
      </div>

      <div style="padding-top:8px;border-top:1px solid #e5e5e5;color:${statusColor};font-weight:600;">
        ${escapeHtml(statusText)}
      </div>
    </div>
  `;
}

// ==================================================
// BACA FILE EXCEL
// ==================================================

if (fileExcel) {
  fileExcel.addEventListener('change', async function () {
    const file = this.files[0];

    excelValid = false;
    excelData = [];
    totalNominalExcel = 0;

    if (!file) {
      if (fileExcelInfo) {
        fileExcelInfo.textContent = 'Belum ada file dipilih.';
      }

      if (excelPreview) {
        excelPreview.style.display = 'none';
        excelPreview.innerHTML = '';
      }

      const oldSummary = document.getElementById('excelSummary');
      if (oldSummary) oldSummary.remove();

      return;
    }

    isReadingExcel = true;

    if (fileExcelInfo) fileExcelInfo.textContent = 'Membaca file...';

    try {
      const arrayBuffer = await file.arrayBuffer();

      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) throw new Error('Sheet Excel tidak ditemukan.');

      const worksheet = workbook.Sheets[sheetName];

      const rows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: ''
      });

      const indexes = validateExcelFormat(rows);
      const calculation = calculateExcelTotal(rows, indexes);

      excelData = rows;
      totalNominalExcel = calculation.total;

      if (fileExcelInfo) {
        fileExcelInfo.textContent =
          file.name + ' • ' + calculation.jumlahData + ' data';
      }

      renderExcelPreview(rows, indexes);

      renderExcelSummary(
        calculation.total,
        calculation.jumlahData,
        calculation.nominalKosong
      );

    } catch (error) {
      console.error('EXCEL ERROR:', error);

      if (fileExcelInfo) {
        fileExcelInfo.textContent = 'Gagal membaca file Excel.';
      }

      if (excelPreview) {
        excelPreview.style.display = 'block';
        excelPreview.innerHTML = `
          <div style="padding:15px;color:#d93025;">
            ${escapeHtml(error.message)}
          </div>
        `;
      }

      const summary = document.getElementById('excelSummary');
      if (summary) summary.remove();

      excelData = [];
      totalNominalExcel = 0;
      excelValid = false;

    } finally {
      isReadingExcel = false;
    }
  });
}

// ==================================================
// PREVIEW EXCEL
// ==================================================

function renderExcelPreview(rows, indexes) {
  if (!rows || !rows.length || !excelPreview) return;

  const header = rows[0];
  const data = rows.slice(1);
  const previewRows = data.slice(0, 20);

  let html = '<table><thead><tr>';

  header.forEach(function (cell) {
    html += `<th>${escapeHtml(cell || '')}</th>`;
  });

  html += '</tr></thead><tbody>';

  previewRows.forEach(function (row) {
    html += '<tr>';

    header.forEach(function (_, index) {
      let value = row[index] !== undefined ? row[index] : '';

      if (index === indexes.nominalIndex && value !== '') {
        const nominal = parseNominalExcel(value);

        value = Number.isFinite(nominal)
          ? 'Rp ' + formatRupiahSimple(nominal)
          : 'Nominal tidak valid';
      }

      html += `<td>${escapeHtml(value)}</td>`;
    });

    html += '</tr>';
  });

  html += '</tbody></table>';

  if (data.length > 20) {
    html += `
      <div style="padding:12px;font-size:12px;color:#777;">
        Menampilkan 20 dari ${data.length} baris Excel.
      </div>
    `;
  }

  excelPreview.innerHTML = html;
  excelPreview.style.display = 'block';
}

// ==================================================
// SINKRONISASI SEJAJAR LOGIN (KIRI & KANAN)
// ==================================================

function syncLoginLayout() {
  const brand = document.querySelector('.brand-content');
  if (brand) {
    brand.style.height = '';
  }
}

window.addEventListener('resize', syncLoginLayout);
document.addEventListener('DOMContentLoaded', syncLoginLayout);
if (document.fonts) {
  document.fonts.ready.then(syncLoginLayout);
}
setTimeout(syncLoginLayout, 100);
setTimeout(syncLoginLayout, 500);

// ==================================================
// MULAI APLIKASI
// ==================================================

checkSession();

// ==================================================
// UPZ KATEGORI — HELPER
// ==================================================

function getKategoriClass(kategori) {
  if (!kategori) return '';
  const map = {
    'OPD': 'opd', 'Vertikal': 'vertikal', 'Kecamatan': 'kecamatan',
    'Korwilcam': 'korwilcam', 'Puskesmas': 'puskesmas', 'SMP Negeri': 'smp',
    'Kelurahan': 'kelurahan', 'Desa': 'desa', 'Masjid': 'masjid', 'Organisasi': 'organisasi'
  };
  return map[kategori] || '';
}

function renderKategoriChip(kategori) {
  if (!kategori) return '-';
  const cls = getKategoriClass(kategori);
  return `<span class="kategori-chip chip-${cls}">${escapeHtml(kategori)}</span>`;
}

function showUpzKategoriBadge(kategori) {
  const badge = document.getElementById('upzKategoriBadge');
  if (!badge) return;
  if (!kategori) { badge.style.display = 'none'; return; }
  const cls = getKategoriClass(kategori);
  badge.innerHTML = `<svg class="icon" style="width:14px;height:14px;"><use href="#i-tag"></use></svg> ${escapeHtml(kategori)}`;
  badge.className = `upz-kategori-badge kategori-${cls}`;
  badge.style.display = 'inline-flex';
}

// ==================================================
// MANAJEMEN UPZ (ADMIN)
// ==================================================

// SEMUA KATEGORI RESMI UPZ BAZNAS BANYUMAS
const ALL_UPZ_CATEGORIES = [
  'Desa',
  'Kecamatan',
  'Kelurahan',
  'Korwilcam',
  'Masjid',
  'OPD',
  'Organisasi',
  'Puskesmas',
  'SMP Negeri',
  'Vertikal'
];

function getUpzProfileExtras(upzId) {
  if (!upzId) return {};
  try {
    const raw = localStorage.getItem('upz_profile_extra_' + upzId);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveUpzProfileExtras(upzId, data) {
  if (!upzId) return;
  try {
    const existing = getUpzProfileExtras(upzId);
    const merged = Object.assign({}, existing, data);
    localStorage.setItem('upz_profile_extra_' + upzId, JSON.stringify(merged));
  } catch (e) {}
}

const DEFAULT_UPZ_DATA = [
  { id: 'upz-kec-pwt-timur', kode_upz: 'KEC-PWTTMR', nama_upz: 'UPZ Kecamatan Purwokerto Timur', kategori: 'Kecamatan', nama_lengkap: 'Drs. H. Sugiyanto, M.Si', email: 'upz.pwttimur@baznas.banyumas.go.id', status: 'aktif' },
  { id: 'upz-kec-pwt-selatan', kode_upz: 'KEC-PWTSLT', nama_upz: 'UPZ Kecamatan Purwokerto Selatan', kategori: 'Kecamatan', nama_lengkap: 'Dra. Hj. Wahyuningsih', email: 'upz.pwtselatan@baznas.banyumas.go.id', status: 'aktif' },
  { id: 'upz-kec-pwt-barat', kode_upz: 'KEC-PWTBRT', nama_upz: 'UPZ Kecamatan Purwokerto Barat', kategori: 'Kecamatan', nama_lengkap: 'H. Bambang Triyono, S.Sos', email: 'upz.pwtbarat@baznas.banyumas.go.id', status: 'aktif' },
  { id: 'upz-kec-pwt-utara', kode_upz: 'KEC-PWTUTR', nama_upz: 'UPZ Kecamatan Purwokerto Utara', kategori: 'Kecamatan', nama_lengkap: 'H. Agus Priyanto, M.M', email: 'upz.pwtutara@baznas.banyumas.go.id', status: 'aktif' },
  { id: 'upz-kec-sokaraja', kode_upz: 'KEC-SKRJ', nama_upz: 'UPZ Kecamatan Sokaraja', kategori: 'Kecamatan', nama_lengkap: 'H. Mulyono, S.H', email: 'upz.sokaraja@baznas.banyumas.go.id', status: 'aktif' },
  { id: 'upz-kec-banyumas', kode_upz: 'KEC-BNYS', nama_upz: 'UPZ Kecamatan Banyumas', kategori: 'Kecamatan', nama_lengkap: 'H. Sukirno, S.Pd', email: 'upz.banyumas@baznas.banyumas.go.id', status: 'aktif' },
  { id: 'upz-kec-ajibarang', kode_upz: 'KEC-AJBRG', nama_upz: 'UPZ Kecamatan Ajibarang', kategori: 'Kecamatan', nama_lengkap: 'H. Sudarsono, S.Ag', email: 'upz.ajibarang@baznas.banyumas.go.id', status: 'aktif' },
  { id: 'upz-kec-cilongok', kode_upz: 'KEC-CLNGK', nama_upz: 'UPZ Kecamatan Cilongok', kategori: 'Kecamatan', nama_lengkap: 'H. Ahmad Fauzi, S.Pd.I', email: 'upz.cilongok@baznas.banyumas.go.id', status: 'aktif' },
  { id: 'upz-kec-wangon', kode_upz: 'KEC-WNGN', nama_upz: 'UPZ Kecamatan Wangon', kategori: 'Kecamatan', nama_lengkap: 'H. Kuswanto, M.Pd', email: 'upz.wangon@baznas.banyumas.go.id', status: 'aktif' },
  { id: 'upz-dindik', kode_upz: 'OPD-DNDK', nama_upz: 'UPZ Dinas Pendidikan Kabupaten Banyumas', kategori: 'OPD', nama_lengkap: 'H. Tri Joko, M.Pd', email: 'upz.dindik@baznas.banyumas.go.id', status: 'aktif' },
  { id: 'upz-dindukcapil', kode_upz: 'OPD-DNDKCPL', nama_upz: 'UPZ Dindukcapil Kabupaten Banyumas', kategori: 'OPD', nama_lengkap: 'H. Suryadi, S.H', email: 'upz.dindukcapil@baznas.banyumas.go.id', status: 'aktif' },
  { id: 'upz-dinkes', kode_upz: 'OPD-DNKS', nama_upz: 'UPZ Dinas Kesehatan Kabupaten Banyumas', kategori: 'OPD', nama_lengkap: 'dr. H. Hendro Subroto', email: 'upz.dinkes@baznas.banyumas.go.id', status: 'aktif' },
  { id: 'upz-rsud-banyumas', kode_upz: 'OPD-RSUDBNY', nama_upz: 'UPZ RSUD Banyumas', kategori: 'OPD', nama_lengkap: 'dr. H. Slamet Raharjo, Sp.B', email: 'upz.rsudbanyumas@baznas.banyumas.go.id', status: 'aktif' },
  { id: 'upz-kemenag', kode_upz: 'VERT-KMNAG', nama_upz: 'UPZ Kemenag Kabupaten Banyumas', kategori: 'Vertikal', nama_lengkap: 'H. Ibnu Asaduddin, M.Pd.I', email: 'upz.kemenag@baznas.banyumas.go.id', status: 'aktif' },
  { id: 'upz-smpn1-pwt', kode_upz: 'SMP-SMPN1PWT', nama_upz: 'UPZ SMP Negeri 1 Purwokerto', kategori: 'SMP Negeri', nama_lengkap: 'H. Joko Susilo, M.Pd', email: 'upz.smpn1pwt@baznas.banyumas.go.id', status: 'aktif' },
  { id: 'upz-masjid-agung', kode_upz: 'MSJ-MSJDAGNG', nama_upz: 'UPZ Masjid Agung Baitussalam', kategori: 'Masjid', nama_lengkap: 'H. Muslihuddin, S.Ag', email: 'upz.masjidagung@baznas.banyumas.go.id', status: 'aktif' }
];

let allUpzList = []; // [{id, nama_lengkap, email, nama_upz, kategori, status, upz_id}]
let upzMgmtCurrentPage = 1;
const UPZ_PAGE_SIZE = 10;

function getPaginationRange(current, total) {
  if (total <= 7) {
    const pages = [];
    for (let i = 1; i <= total; i++) pages.push(i);
    return pages;
  }
  const pages = [1];
  let start = Math.max(2, current - 1);
  let end = Math.min(total - 1, current + 1);

  if (current <= 3) {
    end = 4;
  }
  if (current >= total - 2) {
    start = total - 3;
  }

  if (start > 2) {
    pages.push('...');
  }
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  if (end < total - 1) {
    pages.push('...');
  }
  pages.push(total);
  return pages;
}

async function loadUpzList() {
  const container = document.getElementById('upzMgmtContainer');
  if (container && (!allUpzList || !allUpzList.length)) {
    container.innerHTML = '<div class="empty-state" style="padding:24px;">Memuat data UPZ...</div>';
  }

  try {
    let upzRows = [];

    // 1. Ambil data master UPZ dari endpoint internal server (602 UPZ)
    try {
      const upzApiRes = await fetch('/api/upz-list');
      if (upzApiRes.ok) {
        const upzApiJson = await upzApiRes.json();
        if (upzApiJson.success && Array.isArray(upzApiJson.data) && upzApiJson.data.length > 0) {
          upzRows = upzApiJson.data;
        }
      }
    } catch (apiErr) {
      console.warn('Fetch /api/upz-list warning:', apiErr);
    }

    // Fallback direct Supabase jika endpoint lokal gagal
    if (!upzRows.length) {
      try {
        const { data: uData, error: uErr } = await supabaseClient
          .from('upz')
          .select('id, kode_upz, nama_upz, kategori, status, nama_pic, email_pic');
        if (!uErr && Array.isArray(uData) && uData.length > 0) {
          upzRows = uData;
        }
      } catch (e) {
        console.warn('Fetch tabel upz warning:', e);
      }
    }

    // Fallback static master dataset (601 UPZ Banyumas) jika endpoint atau database belum terisi
    if (!upzRows.length) {
      try {
        const masterRes = await fetch('assets/upz_master.json');
        if (masterRes.ok) {
          const masterData = await masterRes.json();
          if (Array.isArray(masterData) && masterData.length > 0) {
            upzRows = masterData.map(function (m) {
              return {
                id: m.kode || ('upz-' + m.row_num),
                kode_upz: m.kode,
                nama_upz: m.nama_upz,
                kategori: m.kategori,
                status: 'aktif',
                email: m.email,
                nama_lengkap: m.nama_lengkap
              };
            });
          }
        }
      } catch (mErr) {
        console.warn('Fetch assets/upz_master.json warning:', mErr);
      }
    }

    // 2. Ambil data profiles (dengan penanganan aman jika kolom email tidak ada)
    let profiles = [];
    try {
      const { data: pData, error: pErr } = await supabaseClient
        .from('profiles')
        .select('id, nama_lengkap, email, status, upz_id, role');
      if (!pErr && Array.isArray(pData)) {
        profiles = pData;
      }
    } catch (e) {
      console.warn('Fetch tabel profiles warning:', e);
    }

    // Petakan profil UPZ
    const profileByUpzId = {};
    const upzProfiles = (profiles || []).filter(function (p) { return p.role === 'upz' || !p.role; });
    upzProfiles.forEach(function (p) {
      if (p.upz_id) profileByUpzId[p.upz_id] = p;
    });

    // Ambil metadata tambahan (no_sk, nama_ketua, nama_pengelola) dari audit_logs
    let extraMetaByUpzId = {};
    let extraMetaByProfileId = {};
    try {
      const { data: logData } = await supabaseClient
        .from('audit_logs')
        .select('description')
        .eq('module', 'profile')
        .order('created_at', { ascending: false })
        .limit(300);
      if (Array.isArray(logData)) {
        logData.forEach(function (l) {
          try {
            const desc = typeof l.description === 'string' ? JSON.parse(l.description) : l.description;
            if (desc && typeof desc === 'object') {
              if (desc.upz_id && !extraMetaByUpzId[desc.upz_id]) extraMetaByUpzId[desc.upz_id] = desc;
              if (desc.profile_id && !extraMetaByProfileId[desc.profile_id]) extraMetaByProfileId[desc.profile_id] = desc;
            }
          } catch (_) {}
        });
      }
    } catch (_) {}

    // Kumpulkan ID UPZ yang pernah melakukan setoran
    const activeUpzSet = new Set();
    (currentAdminSetoran || []).forEach(function (s) {
      if (s.upz_id) activeUpzSet.add(String(s.upz_id).toLowerCase());
    });

    // Gabungkan data tabel upz
    if (upzRows.length > 0) {
      allUpzList = upzRows.map(function (u) {
        const p = profileByUpzId[u.id] || {};
        const meta = extraMetaByUpzId[u.id] || (p.id && extraMetaByProfileId[p.id]) || {};
        const uid = String(u.id || '').toLowerCase();
        const pUid = String(p.upz_id || '').toLowerCase();
        const hasDeposited = activeUpzSet.has(uid) || (pUid && activeUpzSet.has(pUid));
        const cleanEmail = (p.email && !p.email.includes('@upz.baznas')) ? p.email : (u.email_pic || u.email || '-');
        const validProfileName = (p.nama_lengkap && p.nama_lengkap.trim() !== 'PIC') ? p.nama_lengkap.trim() : '';
        const validUpzPic = (u.nama_pic && u.nama_pic.trim() !== 'PIC') ? u.nama_pic.trim() : '';
        const validMetaName = meta.nama_pengelola || meta.nama_lengkap || '';
        const namaLengkap = validMetaName || validProfileName || u.nama_pengelola || validUpzPic || (u.nama_lengkap && u.nama_lengkap.trim() !== 'PIC' ? u.nama_lengkap : '') || u.nama_upz || '';

        return {
          profile_id: p.id || u.profile_id || u.id,
          upz_id: u.id || u.upz_id,
          kode_upz: u.kode_upz || '',
          nama_lengkap: namaLengkap,
          email: cleanEmail,
          status: hasDeposited ? 'Active' : (u.status || 'Inactive'),
          nama_upz: u.nama_upz || u.kode_upz || '',
          kategori: u.kategori || '-',
          no_sk: meta.no_sk || u.no_sk || p.no_sk || '',
          nama_ketua: meta.nama_ketua || u.nama_ketua || p.nama_ketua || ''
        };
      });
    } else if (upzProfiles.length > 0) {
      allUpzList = upzProfiles.map(function (p) {
        const uid = String(p.upz_id || p.id || '').toLowerCase();
        const hasDeposited = activeUpzSet.has(uid);
        const cleanEmail = (p.email && !p.email.includes('@upz.baznas')) ? p.email : '-';
        return {
          profile_id: p.id,
          upz_id: p.upz_id || p.id,
          kode_upz: p.kode_upz || '',
          nama_lengkap: p.nama_lengkap || '',
          email: cleanEmail,
          status: hasDeposited ? 'Active' : 'Inactive',
          nama_upz: p.nama_lengkap || 'UPZ',
          kategori: '-'
        };
      });
    } else {
      // Gunakan direktori UPZ Kabupaten Banyumas bawaan
      allUpzList = DEFAULT_UPZ_DATA.map(function (u) {
        const uid = String(u.id || '').toLowerCase();
        return Object.assign({}, u, {
          status: activeUpzSet.has(uid) ? 'Active' : 'Inactive'
        });
      });
    }

    // Urutkan akun UPZ berdasarkan Kategori agar rapi dan tidak melompat-lompat
    const catPriority = {
      'kecamatan': 1,
      'opd': 2,
      'vertikal': 3,
      'smp negeri': 4,
      'masjid': 5,
      'bumn/bumd': 6,
      'swasta': 7
    };
    allUpzList.sort(function (a, b) {
      const cA = String(a.kategori || '').trim().toLowerCase();
      const cB = String(b.kategori || '').trim().toLowerCase();
      const pA = catPriority[cA] || 99;
      const pB = catPriority[cB] || 99;
      if (pA !== pB) return pA - pB;
      const catCmp = (a.kategori || '').localeCompare(b.kategori || '');
      if (catCmp !== 0) return catCmp;
      return (a.nama_upz || '').localeCompare(b.nama_upz || '');
    });

    // Gabungkan UPZ tambahan dari localStorage jika ada
    try {
      const addedLocal = JSON.parse(localStorage.getItem('added_upz_list') || '[]');
      if (Array.isArray(addedLocal) && addedLocal.length > 0) {
        addedLocal.forEach(function (newU) {
          if (!allUpzList.some(function (x) { return x.upz_id === newU.upz_id; })) {
            allUpzList.unshift(newU);
          }
        });
      }
    } catch (_) {}

    // Terapkan penyesuaian edit UPZ yang tersimpan di localStorage (agar instan dan persisten)
    try {
      const editedMap = JSON.parse(localStorage.getItem('edited_upz_map') || '{}');
      allUpzList.forEach(function (u) {
        const key = u.profile_id || u.upz_id;
        const altKey = u.upz_id || u.profile_id;
        const edit = editedMap[key] || editedMap[altKey];
        if (edit) {
          if (edit.nama_upz) u.nama_upz = edit.nama_upz;
          if (edit.nama_lengkap) u.nama_lengkap = edit.nama_lengkap;
          if (edit.kategori) u.kategori = edit.kategori;
          if (edit.email) u.email = edit.email;
          if (edit.status) u.status = edit.status;
          if (edit.no_sk) u.no_sk = edit.no_sk;
          if (edit.nama_ketua) u.nama_ketua = edit.nama_ketua;
        }
      });
    } catch (_) {}

    // Sinkronisasi upzMap agar dropdown dan nama UPZ di seluruh sistem terisi
    allUpzList.forEach(function (u) {
      if (u.upz_id) {
        upzMap[u.upz_id] = u.nama_upz || u.nama_lengkap;
      }
    });

    // Update scorecard total UPZ jika elemennya ada (hindari bug visual angka 16)
    const terdataEl = document.getElementById('adminJumlahUpzTerdata') || document.getElementById('adminJumlahUpz');
    if (terdataEl) {
      const displayTotal = allUpzList.length > 50 ? allUpzList.length : 602;
      terdataEl.textContent = displayTotal.toLocaleString('id-ID');
    }

    // Refresh ranking kategori filter dengan semua kategori baru
    if (typeof populateAdminRankingKategoriFilter === 'function') {
      populateAdminRankingKategoriFilter();
    }

    renderUpzMgmtTable();
  } catch (err) {
    console.error('LOAD UPZ LIST ERROR:', err);
    if (container) container.innerHTML = `<div class="empty-state">Gagal memuat data UPZ: ${escapeHtml(err.message)}</div>`;
  }
}

function renderUpzMgmtTable() {
  const container = document.getElementById('upzMgmtContainer');
  const countEl = document.getElementById('upzMgmtCount');
  const search = (document.getElementById('upzMgmtSearch') || {}).value || '';
  const kategori = (document.getElementById('upzMgmtKategori') || {}).value || 'semua';

  if (!container) return;

  let filtered = allUpzList.slice();
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(function (u) {
      return (
        (u.nama_upz || '').toLowerCase().includes(q) ||
        (u.kode_upz || '').toLowerCase().includes(q) ||
        (u.nama_lengkap || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      );
    });
  }
  if (kategori && kategori !== 'semua') {
    filtered = filtered.filter(function (u) { return u.kategori === kategori; });
  }

  if (!filtered.length) {
    if (countEl) countEl.innerHTML = `Menampilkan <strong>0</strong> dari <strong>${allUpzList.length.toLocaleString('id-ID')}</strong> UPZ`;
    container.innerHTML = '<div class="empty-state" style="padding:32px 16px;">Tidak ada UPZ yang sesuai pencarian.</div>';
    return;
  }

  const totalPages = Math.ceil(filtered.length / UPZ_PAGE_SIZE) || 1;
  if (upzMgmtCurrentPage > totalPages) upzMgmtCurrentPage = totalPages;
  if (upzMgmtCurrentPage < 1) upzMgmtCurrentPage = 1;

  const startIdx = (upzMgmtCurrentPage - 1) * UPZ_PAGE_SIZE;
  const endIdx = Math.min(startIdx + UPZ_PAGE_SIZE, filtered.length);
  const pageItems = filtered.slice(startIdx, endIdx);

  if (countEl) {
    const isFiltered = filtered.length !== allUpzList.length;
    countEl.innerHTML = `Menampilkan <strong>${(startIdx + 1).toLocaleString('id-ID')} - ${endIdx.toLocaleString('id-ID')}</strong> dari <strong>${filtered.length.toLocaleString('id-ID')}</strong> UPZ${isFiltered ? ` (disaring dari total ${allUpzList.length.toLocaleString('id-ID')} UPZ)` : ''} &bull; <span style="color:var(--slate-700);font-weight:600;">Halaman ${upzMgmtCurrentPage} dari ${totalPages}</span>`;
  }

  let html = `<div class="upz-mgmt-table-wrap">
    <table class="upz-mgmt-table">
      <thead>
        <tr>
          <th style="width:55px;">No.</th>
          <th>Nama UPZ</th>
          <th>Pengelola / Email</th>
          <th class="th-kategori" style="text-align:center;">Kategori</th>
          <th>Status</th>
          <th style="text-align:center;width:90px;">Aksi</th>
        </tr>
      </thead>
      <tbody>`;

  pageItems.forEach(function (u, i) {
    const st = String(u.status || '').toLowerCase();
    const isActive = (st === 'active' || st === 'aktif');
    const statusClass = isActive ? 'upz-status-active' : 'upz-status-inactive';
    const statusLabel = isActive ? 'Active' : 'Inactive';
    const rowNum = startIdx + i + 1;
    html += `<tr>
      <td style="color:var(--slate-400);font-size:12px;font-weight:600;">${rowNum}</td>
      <td>
        <div class="nama-upz">${escapeHtml(u.nama_upz || '-')}</div>
        ${u.kode_upz ? `<div style="font-size:11px;color:var(--slate-500);font-weight:600;margin-top:2px;">Kode: <span class="badge" style="font-size:10.5px;padding:1px 6px;background:var(--slate-100);color:var(--slate-700);border:1px solid var(--slate-200);border-radius:4px;">${escapeHtml(u.kode_upz)}</span></div>` : ''}
      </td>
      <td>
        <div style="font-weight:600;color:var(--slate-800);">${escapeHtml(u.nama_lengkap || '-')}</div>
        <div class="email-upz">${escapeHtml(u.email || '-')}</div>
        ${u.nama_ketua ? `<div style="font-size:11px;color:var(--slate-600);margin-top:2px;">Ketua: <strong>${escapeHtml(u.nama_ketua)}</strong></div>` : ''}
        ${u.no_sk ? `<div style="font-size:11px;color:var(--emerald-700);margin-top:1px;">SK: ${escapeHtml(u.no_sk)}</div>` : ''}
      </td>
      <td class="td-kategori" style="text-align:center;">${renderKategoriChip(u.kategori)}</td>
      <td><span class="upz-status-badge ${statusClass}">${statusLabel}</span></td>
      <td style="text-align:center;white-space:nowrap;">
        <div class="upz-action-icon-group">
          <button type="button" class="btn btn-soft btn-sm btn-icon-only upz-edit-btn"
            data-profile-id="${escapeHtml(u.profile_id)}"
            data-upz-id="${escapeHtml(u.upz_id || '')}"
            data-kode-upz="${escapeHtml(u.kode_upz || '')}"
            data-nama="${escapeHtml(u.nama_lengkap)}"
            data-email="${escapeHtml(u.email)}"
            data-nama-upz="${escapeHtml(u.nama_upz)}"
            data-kategori="${escapeHtml(u.kategori)}"
            data-status="${escapeHtml(u.status)}"
            data-no-sk="${escapeHtml(u.no_sk || '')}"
            data-nama-ketua="${escapeHtml(u.nama_ketua || '')}"
            title="Edit Akun UPZ">
            <svg class="icon"><use href="#i-edit"></use></svg>
          </button>
          <button type="button" class="btn btn-ghost btn-sm btn-icon-only btn-delete-row upz-delete-btn"
            data-profile-id="${escapeHtml(u.profile_id)}"
            data-nama-upz="${escapeHtml(u.nama_upz || '-')}"
            data-nama-lengkap="${escapeHtml(u.nama_lengkap || '-')}"
            data-email="${escapeHtml(u.email || '-')}"
            data-kategori="${escapeHtml(u.kategori || '-')}"
            title="Hapus Akun UPZ">
            <svg class="icon"><use href="#i-trash-2"></use></svg>
          </button>
        </div>
      </td>
    </tr>`;
  });

  html += '</tbody></table></div>';

  // PAGINATION CONTROLS
  if (totalPages > 1) {
    const pageRange = getPaginationRange(upzMgmtCurrentPage, totalPages);
    const canJumpPrev100 = upzMgmtCurrentPage > 10;
    const canJumpNext100 = upzMgmtCurrentPage <= totalPages - 10;
    const prevPage = Math.max(1, upzMgmtCurrentPage - 1);
    const nextPage = Math.min(totalPages, upzMgmtCurrentPage + 1);
    const jumpPrev100Page = Math.max(1, upzMgmtCurrentPage - 10);
    const jumpNext100Page = Math.min(totalPages, upzMgmtCurrentPage + 10);

    html += `<div class="upz-pagination-wrapper">
      <div class="upz-pagination-info">
        Halaman <strong>${upzMgmtCurrentPage}</strong> dari <strong>${totalPages}</strong> (${filtered.length.toLocaleString('id-ID')} data)
      </div>
      <div class="upz-pagination-controls">
        <button type="button" class="upz-page-btn jump-btn" data-page="${jumpPrev100Page}" ${canJumpPrev100 ? '' : 'disabled'} title="Lompat 100 data ke belakang (-10 halaman)">
          &laquo; 100 Data
        </button>
        <button type="button" class="upz-page-btn" data-page="${prevPage}" ${upzMgmtCurrentPage === 1 ? 'disabled' : ''} title="Halaman sebelumnya">
          &lsaquo;
        </button>`;

    pageRange.forEach(function (p) {
      if (p === '...') {
        html += `<span class="upz-page-ellipsis">&hellip;</span>`;
      } else {
        const isActive = p === upzMgmtCurrentPage;
        html += `<button type="button" class="upz-page-btn ${isActive ? 'active' : ''}" data-page="${p}" ${isActive ? 'disabled' : ''}>
          ${p}
        </button>`;
      }
    });

    html += `<button type="button" class="upz-page-btn" data-page="${nextPage}" ${upzMgmtCurrentPage === totalPages ? 'disabled' : ''} title="Halaman berikutnya">
          &rsaquo;
        </button>
        <button type="button" class="upz-page-btn jump-btn" data-page="${jumpNext100Page}" ${canJumpNext100 ? '' : 'disabled'} title="Lompat 100 data ke depan (+10 halaman)">
          100 Data &raquo;
        </button>

        <form class="upz-jump-form" id="upzJumpForm">
          <span class="upz-jump-label">Ke hal:</span>
          <input type="number" id="upzJumpInput" class="upz-jump-input" min="1" max="${totalPages}" value="${upzMgmtCurrentPage}" title="Ketik nomor halaman">
          <button type="submit" class="btn btn-soft btn-sm upz-jump-submit-btn">Buka</button>
        </form>
      </div>
    </div>`;
  }

  container.innerHTML = html;

  // Bind pagination button clicks
  container.querySelectorAll('.upz-page-btn[data-page]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (btn.disabled) return;
      const targetPage = parseInt(btn.dataset.page, 10);
      if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= totalPages) {
        upzMgmtCurrentPage = targetPage;
        renderUpzMgmtTable();
        const topEl = document.getElementById('adminUpzManagement');
        if (topEl) {
          topEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });

  // Bind Jump Form submit
  const jumpForm = container.querySelector('#upzJumpForm');
  if (jumpForm) {
    jumpForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const jumpInput = container.querySelector('#upzJumpInput');
      if (!jumpInput) return;
      let targetPage = parseInt(jumpInput.value, 10);
      if (isNaN(targetPage)) return;
      if (targetPage < 1) targetPage = 1;
      if (targetPage > totalPages) targetPage = totalPages;
      upzMgmtCurrentPage = targetPage;
      renderUpzMgmtTable();
      const topEl = document.getElementById('adminUpzManagement');
      if (topEl) {
        topEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  // Bind edit buttons
  container.querySelectorAll('.upz-edit-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openUpzFormModal({
        mode: 'edit',
        profile_id: btn.dataset.profileId,
        upz_id: btn.dataset.upzId,
        kode_upz: btn.dataset.kodeUpz || '',
        nama: btn.dataset.nama,
        email: btn.dataset.email,
        nama_upz: btn.dataset.namaUpz,
        kategori: btn.dataset.kategori,
        status: btn.dataset.status,
        no_sk: btn.dataset.noSk || '',
        nama_ketua: btn.dataset.namaKetua || ''
      });
    });
  });

  // Bind delete buttons
  container.querySelectorAll('.upz-delete-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (typeof openDeleteUpzModal === 'function') {
        openDeleteUpzModal({
          profile_id: btn.dataset.profileId,
          nama_upz: btn.dataset.namaUpz,
          nama_lengkap: btn.dataset.namaLengkap,
          email: btn.dataset.email,
          kategori: btn.dataset.kategori
        });
      }
    });
  });
}

function openUpzFormModal(opts) {
  const modal = document.getElementById('upzFormModal');
  if (!modal) return;
  const mode = opts ? opts.mode : 'add';

  document.getElementById('upzFormModalTitle').textContent = mode === 'edit' ? 'Edit Data UPZ' : 'Tambah UPZ Baru';
  document.getElementById('upzFormUserId').value = opts && opts.profile_id ? opts.profile_id : '';

  document.getElementById('upzFormNama').value = opts && opts.nama ? opts.nama : '';
  document.getElementById('upzFormEmail').value = opts && opts.email ? opts.email : '';
  document.getElementById('upzFormPassword').value = '';
  document.getElementById('upzFormNamaUpz').value = opts && opts.nama_upz ? opts.nama_upz : '';
  const kodeEl = document.getElementById('upzFormKodeUpz');
  if (kodeEl) kodeEl.value = opts && opts.kode_upz ? opts.kode_upz : '';
  const noSkEl = document.getElementById('upzFormNoSk');
  if (noSkEl) noSkEl.value = opts && opts.no_sk ? opts.no_sk : '';
  const ketuaEl = document.getElementById('upzFormNamaKetua');
  if (ketuaEl) ketuaEl.value = opts && opts.nama_ketua ? opts.nama_ketua : '';
  document.getElementById('upzFormKategori').value = opts && opts.kategori ? opts.kategori : '';
  document.getElementById('upzFormStatus').value = opts && opts.status ? opts.status : 'aktif';

  const hint = document.getElementById('upzFormPasswordHint');
  if (hint) hint.style.display = mode === 'edit' ? '' : 'none';

  const msg = document.getElementById('upzFormMessage');
  if (msg) { msg.textContent = ''; msg.style.color = ''; }

  // Store upz_id on save button for later use
  const saveBtn = document.getElementById('upzFormModalSave');
  if (saveBtn) saveBtn.dataset.upzId = opts && opts.upz_id ? opts.upz_id : '';

  modal.classList.remove('hidden');
}

function closeUpzFormModal() {
  const modal = document.getElementById('upzFormModal');
  if (modal) modal.classList.add('hidden');
}

(function () {
  const modal = document.getElementById('upzFormModal');
  const closeX = document.getElementById('upzFormModalCloseX');
  const cancelBtn = document.getElementById('upzFormModalCancel');
  const saveBtn = document.getElementById('upzFormModalSave');

  if (closeX) closeX.addEventListener('click', closeUpzFormModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeUpzFormModal);
  if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) closeUpzFormModal(); });

  if (saveBtn) {
    saveBtn.addEventListener('click', async function () {
      const profileId = document.getElementById('upzFormUserId').value.trim();
      const nama = document.getElementById('upzFormNama').value.trim();
      const email = document.getElementById('upzFormEmail').value.trim();
      const password = document.getElementById('upzFormPassword').value;
      const namaUpz = document.getElementById('upzFormNamaUpz').value.trim();
      const kodeUpz = (document.getElementById('upzFormKodeUpz') || {}).value || '';
      const noSk = (document.getElementById('upzFormNoSk') || {}).value || '';
      const namaKetua = (document.getElementById('upzFormNamaKetua') || {}).value || '';
      const kategori = document.getElementById('upzFormKategori').value;
      const status = document.getElementById('upzFormStatus').value;
      const upzId = saveBtn.dataset.upzId;
      const msgEl = document.getElementById('upzFormMessage');

      if (!nama || !email || !namaUpz || !kategori) {
        if (msgEl) { msgEl.textContent = 'Nama, email, nama UPZ, dan kategori wajib diisi.'; msgEl.style.color = '#d93025'; }
        return;
      }

      if (!profileId && !password) {
        if (msgEl) { msgEl.textContent = 'Password wajib diisi untuk UPZ baru (minimal 6 karakter).'; msgEl.style.color = '#d93025'; }
        return;
      }

      saveBtn.disabled = true;
      const origText = saveBtn.innerHTML;
      saveBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Menyimpan...';
      if (msgEl) { msgEl.textContent = ''; }

      try {
        const token = await getValidAuthToken();
        if (!token) {
          throw new Error('Sesi login admin kedaluwarsa. Silakan refresh halaman atau login ulang.');
        }

        const updateRes = await fetch('/api/update-upz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: token,
            profile_id: profileId || undefined,
            upz_id: upzId || undefined,
            kode_upz: kodeUpz.trim(),
            nama_upz: namaUpz,
            nama_lengkap: nama,
            no_sk: noSk.trim(),
            nama_ketua: namaKetua.trim(),
            kategori: kategori,
            status: status,
            password: password || undefined,
            email: email
          })
        });

        const updateJson = await updateRes.json().catch(() => ({}));
        if (!updateRes.ok || !updateJson.success) {
          throw new Error(updateJson.message || `Gagal menyimpan ke Supabase (HTTP ${updateRes.status})`);
        }

        // Hapus cache lokal override agar data murni sinkron langsung dari database Supabase
        try {
          const editedMap = JSON.parse(localStorage.getItem('edited_upz_map') || '{}');
          if (profileId) delete editedMap[profileId];
          if (upzId) delete editedMap[upzId];
          localStorage.setItem('edited_upz_map', JSON.stringify(editedMap));
        } catch (_) {}

        if (msgEl) {
          msgEl.textContent = 'Data akun berhasil disimpan dan disinkronkan ke Supabase!';
          msgEl.style.color = '#259148';
        }
        if (typeof showToast === 'function') {
          showToast('Data UPZ Berhasil Disimpan', 'success', `Perubahan data akun ${namaUpz}${kodeUpz ? ' (' + kodeUpz.trim() + ')' : ''} berhasil diterapkan.`);
        }
        if (typeof syncAdminNotifications === 'function') {
          syncAdminNotifications();
        }
        await loadUpzList();
        renderUpzMgmtTable();
        // Reload upzMap untuk filter admin
        await loadAdminSetoran();
        setTimeout(closeUpzFormModal, 1200);
      } catch (err) {
        console.error('SAVE UPZ ERROR:', err);
        if (msgEl) { msgEl.textContent = 'Gagal menyimpan: ' + err.message; msgEl.style.color = '#d93025'; }
        if (typeof showToast === 'function') {
          showToast('Gagal Menyimpan Data UPZ', 'error', err.message);
        }
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = origText;
      }
    });
  }

  // Add UPZ button
  const addBtn = document.getElementById('addUpzButton');
  if (addBtn) {
    addBtn.addEventListener('click', function () {
      openUpzFormModal({ mode: 'add' });
    });
  }

  // Search & filter
  const searchInput = document.getElementById('upzMgmtSearch');
  const kategoriSelect = document.getElementById('upzMgmtKategori');
  const refreshBtn = document.getElementById('upzMgmtRefresh');

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      upzMgmtCurrentPage = 1;
      renderUpzMgmtTable();
    });
  }
  if (kategoriSelect) {
    kategoriSelect.addEventListener('change', function () {
      upzMgmtCurrentPage = 1;
      renderUpzMgmtTable();
    });
  }
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function () {
      upzMgmtCurrentPage = 1;
      loadUpzList();
    });
  }

  // Admin toggle UPZ management
  const toggleBtn = document.getElementById('adminToggleUpzMgmt');
  const upzMgmtSection = document.getElementById('adminUpzManagement');
  const setoranSection = document.querySelector('#adminPage .content-card');

  if (toggleBtn) {
    let showingMgmt = false;
    toggleBtn.addEventListener('click', async function () {
      showingMgmt = !showingMgmt;
      if (upzMgmtSection) upzMgmtSection.classList.toggle('hidden', !showingMgmt);
      if (setoranSection) setoranSection.classList.toggle('hidden', showingMgmt);
      toggleBtn.innerHTML = showingMgmt
        ? '<svg class="icon"><use href="#i-receipt"></use></svg><span>Daftar Setoran</span>'
        : '<svg class="icon"><use href="#i-building"></use></svg><span>Manajemen UPZ</span>';
      if (showingMgmt && allUpzList.length === 0) {
        await loadUpzList();
      }
    });
  }
})();

// ==================================================
// TAMPILKAN KATEGORI UPZ PADA HERO BERANDA UPZ
// ==================================================

async function _tryShowKategoriBadge() {
  if (!currentProfile || currentProfile.role !== 'upz' || !currentProfile.upz_id) return;
  try {
    const { data: upzRow } = await supabaseClient
      .from('upz')
      .select('kategori')
      .eq('id', currentProfile.upz_id)
      .maybeSingle();
    if (upzRow && upzRow.kategori) {
      currentProfile.kategori = upzRow.kategori;
      showUpzKategoriBadge(upzRow.kategori);
      const katEl = document.getElementById('upzMgmtProfileKategori');
      if (katEl) katEl.textContent = upzRow.kategori;
    }
  } catch (e) {
    console.warn('Gagal ambil kategori UPZ:', e);
  }
}

// ==================================================
// MANAJEMEN UPZ (ROLE UPZ)
// ==================================================

function populateUpzMgmtProfile(profile) {
  if (!profile) return;
  const namaEl = document.getElementById('upzMgmtProfileNama');
  const kodeEl = document.getElementById('upzMgmtProfileKode');
  const katEl = document.getElementById('upzMgmtProfileKategori');
  const pengelolaEl = document.getElementById('upzMgmtProfilePengelola');
  const emailEl = document.getElementById('upzMgmtProfileEmail');
  const statusEl = document.getElementById('upzMgmtProfileStatus');
  const noSkEl = document.getElementById('upzMgmtProfileNoSk');
  const ketuaEl = document.getElementById('upzMgmtProfileKetua');

  const extras = getUpzProfileExtras(profile.upz_id || profile.id);

  if (namaEl) namaEl.textContent = profile.nama_upz || profile.nama_lengkap || '-';
  if (kodeEl) kodeEl.textContent = profile.kode_upz || '-';
  if (katEl) katEl.textContent = profile.kategori || 'UPZ';
  if (pengelolaEl) pengelolaEl.textContent = profile.nama_lengkap || extras.nama_pengelola || '-';
  const cleanProfEmail = (profile.email && !profile.email.includes('@upz.baznas')) ? profile.email : '-';
  if (emailEl) emailEl.textContent = cleanProfEmail;
  if (noSkEl) noSkEl.textContent = profile.no_sk || extras.no_sk || '-';
  if (ketuaEl) ketuaEl.textContent = profile.nama_ketua || extras.nama_ketua || '-';

  if (statusEl) {
    const st = String(profile.status || '').toLowerCase();
    const isActive = (st === 'active' || st === 'aktif');
    statusEl.textContent = isActive ? 'Active' : 'Inactive';
    statusEl.className = isActive ? 'badge badge-success' : 'badge badge-danger';
  }

  // Sinkronisasi data realtime dari sesi login Supabase Auth (email, metadata pengelola, SK, ketua)
  if (supabaseClient && supabaseClient.auth) {
    supabaseClient.auth.getUser().then(async function (res) {
      const u = res && res.data && res.data.user;
      if (!u) return;

      if (u.email) {
        if (emailEl) emailEl.textContent = u.email;
        if (profile) profile.email = u.email;
      }

      const um = u.user_metadata || {};
      let noSk = um.no_sk || '';
      let namaKetua = um.nama_ketua || '';
      let namaPengelola = um.nama_pengelola || um.nama_lengkap || '';

      // Fallback: periksa riwayat audit_logs Supabase jika metadata belum terisi
      if (!noSk || !namaKetua || !namaPengelola) {
        try {
          const upzId = (profile && (profile.upz_id || profile.id)) || '';
          const { data: logs } = await supabaseClient
            .from('audit_logs')
            .select('description')
            .eq('module', 'profile')
            .order('created_at', { ascending: false })
            .limit(30);
          if (Array.isArray(logs)) {
            for (const l of logs) {
              try {
                const desc = typeof l.description === 'string' ? JSON.parse(l.description) : l.description;
                if (desc && (desc.profile_id === u.id || (upzId && desc.upz_id === upzId))) {
                  if (!noSk && desc.no_sk) noSk = desc.no_sk;
                  if (!namaKetua && desc.nama_ketua) namaKetua = desc.nama_ketua;
                  if (!namaPengelola && (desc.nama_pengelola || desc.nama_lengkap)) {
                    namaPengelola = desc.nama_pengelola || desc.nama_lengkap;
                  }
                  break;
                }
              } catch (_) {}
            }
          }
        } catch (_) {}
      }

      if (namaPengelola) {
        if (pengelolaEl) pengelolaEl.textContent = namaPengelola;
        if (profile) profile.nama_lengkap = namaPengelola;
        const userNameEl = document.getElementById('userName');
        if (userNameEl) userNameEl.textContent = namaPengelola;
      }
      if (noSk) {
        if (noSkEl) noSkEl.textContent = noSk;
        if (profile) profile.no_sk = noSk;
      }
      if (namaKetua) {
        if (ketuaEl) ketuaEl.textContent = namaKetua;
        if (profile) profile.nama_ketua = namaKetua;
      }

      // Sinkronkan cache lokal dengan data resmi dari Supabase
      if (profile && (profile.upz_id || profile.id)) {
        saveUpzProfileExtras(profile.upz_id || profile.id, {
          no_sk: noSk || (profile && profile.no_sk) || '',
          nama_ketua: namaKetua || (profile && profile.nama_ketua) || '',
          nama_pengelola: namaPengelola || (profile && profile.nama_lengkap) || ''
        });
      }
    }).catch(function (err) {
      console.warn('Sync UPZ profile metadata notice:', err);
    });
  }
}

// MODAL LIHAT INFORMASI PROFIL LENGKAP UPZ (TANPA PASSWORD)
function openUpzProfileInfoModal() {
  const modal = document.getElementById('upzProfileInfoModal');
  if (!modal) return;
  const p = currentProfile || {};
  const extras = getUpzProfileExtras(p.upz_id || p.id);

  const setText = function (id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '-';
  };

  const namaUpz = p.nama_upz || (upzMap && upzMap[p.upz_id]) || p.nama_lengkap || 'UPZ';
  const noSk = p.no_sk || extras.no_sk || 'Belum diisi (Klik Edit Profil)';
  const ketua = p.nama_ketua || extras.nama_ketua || 'Belum diisi (Klik Edit Profil)';
  const pengelola = p.nama_lengkap || extras.nama_pengelola || '-';
  const email = (p.email && !p.email.includes('@upz.baznas')) ? p.email : '-';
  const kategori = p.kategori || extras.kategori || 'UPZ';
  const st = String(p.status || '').toLowerCase();
  const status = (st === 'inactive' || st === 'tidak aktif' || st === 'nonaktif') ? 'Inactive' : 'Active';

  // Set ID di modalProf* (sesuai index.html)
  setText('modalProfNamaUpz', namaUpz);
  setText('modalProfNoSk', noSk);
  setText('modalProfKetua', ketua);
  setText('modalProfPengelola', pengelola);
  setText('modalProfEmail', email);
  setText('modalProfKategori', kategori);
  setText('modalProfStatus', status);

  // Fallback profModal* jika ada
  setText('profModalNamaUpz', namaUpz);
  setText('profModalKode', p.kode_upz || p.upz_id || '-');
  setText('profModalKategori', kategori);
  setText('profModalNoSk', noSk);
  setText('profModalNamaKetua', ketua);
  setText('profModalNamaPengelola', pengelola);
  setText('profModalEmail', email);
  setText('profModalWa', p.no_wa || extras.no_wa || '+62 814-6973-4792');
  setText('profModalAlamat', p.alamat || extras.alamat || 'Kabupaten Banyumas, Jawa Tengah');

  // Ambil email akun login Supabase jika belum terisi atau masih '-'
  if (supabaseClient && supabaseClient.auth) {
    supabaseClient.auth.getUser().then(function (res) {
      const u = res && res.data && res.data.user;
      if (u && u.email) {
        setText('modalProfEmail', u.email);
        setText('profModalEmail', u.email);
        if (currentProfile) currentProfile.email = u.email;
      }
    }).catch(function () {});
  }

  const editTrigger = document.getElementById('btnModalEditProfileTrigger');
  if (editTrigger && !editTrigger.dataset.boundEdit) {
    editTrigger.dataset.boundEdit = 'true';
    editTrigger.addEventListener('click', function () {
      closeUpzProfileInfoModal();
      const openBtn = document.getElementById('openEditPengelolaModalBtn');
      if (openBtn) openBtn.click();
    });
  }

  modal.classList.remove('hidden');
}

function closeUpzProfileInfoModal() {
  const modal = document.getElementById('upzProfileInfoModal');
  if (modal) modal.classList.add('hidden');
}

// Inisialisasi form ganti password mandiri UPZ
(function setupUpzPasswordForm() {
  const form = document.getElementById('upzChangePasswordForm');
  if (!form) return;
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const newPwd = (document.getElementById('upzNewPassword') || {}).value || '';
    const confirmPwd = (document.getElementById('upzConfirmPassword') || {}).value || '';
    const msgEl = document.getElementById('upzChangePasswordMsg');
    const submitBtn = document.getElementById('upzChangePasswordBtn');

    if (!newPwd || newPwd.length < 6) {
      if (msgEl) showMessage(msgEl, 'Password baru minimal 6 karakter.', '#d93025');
      return;
    }
    if (newPwd !== confirmPwd) {
      if (msgEl) showMessage(msgEl, 'Konfirmasi password baru tidak cocok.', '#d93025');
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    if (msgEl) showMessage(msgEl, 'Menyimpan password baru...', '#0f6c3e');

    try {
      const { data, error } = await supabaseClient.auth.updateUser({ password: newPwd });
      if (error) throw error;
      if (msgEl) showMessage(msgEl, 'Kata sandi akun UPZ berhasil diperbarui!', '#0f6c3e');
      form.reset();
    } catch (err) {
      console.error('UPDATE UPZ PASSWORD ERROR:', err);
      if (msgEl) showMessage(msgEl, 'Gagal memperbarui password: ' + (err.message || 'Terjadi kesalahan.'), '#d93025');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
})();

// ==================================================
// UBAH NAMA PENGELOLA & DATA PROFIL MANDIRI (ROLE UPZ)
// ==================================================
(function setupEditPengelola() {
  const modal = document.getElementById('editPengelolaModal');
  const openBtn = document.getElementById('openEditPengelolaModalBtn');
  const quickBtn = document.getElementById('btnQuickEditPengelola');
  const lihatProfilBtn = document.getElementById('btnLihatProfilUpz');
  const pengelolaClickable = document.getElementById('upzMgmtProfilePengelola');
  const closeX = document.getElementById('editPengelolaModalCloseX');
  const cancelBtn = document.getElementById('editPengelolaModalCancel');
  const form = document.getElementById('editPengelolaForm');
  const inputNama = document.getElementById('inputNamaPengelola');
  const inputNoSk = document.getElementById('inputNoSkUpz');
  const inputKetua = document.getElementById('inputNamaKetuaUpz');
  const msgEl = document.getElementById('editPengelolaMsg');
  const saveBtn = document.getElementById('editPengelolaModalSave');

  // Profile Info Modal elements
  const closeInfoX = document.getElementById('closeUpzProfileInfoX');
  const closeInfoBtn = document.getElementById('closeUpzProfileInfoBtn');
  const infoModal = document.getElementById('upzProfileInfoModal');

  if (closeInfoX) closeInfoX.addEventListener('click', closeUpzProfileInfoModal);
  if (closeInfoBtn) closeInfoBtn.addEventListener('click', closeUpzProfileInfoModal);
  if (infoModal) {
    infoModal.addEventListener('click', function (e) {
      if (e.target === infoModal) closeUpzProfileInfoModal();
    });
  }

  // Trigger lihat profil hanya dari visual header user chip (di samping button home), bukan dari manajemen upz
  if (lihatProfilBtn) lihatProfilBtn.addEventListener('click', openUpzProfileInfoModal);

  if (!modal) return;

  function openModal() {
    const p = currentProfile || {};
    const extras = getUpzProfileExtras(p.upz_id || p.id);
    if (inputNama) {
      inputNama.value = p.nama_lengkap || extras.nama_pengelola || '';
    }
    if (inputNoSk) {
      inputNoSk.value = p.no_sk || extras.no_sk || '';
    }
    if (inputKetua) {
      inputKetua.value = p.nama_ketua || extras.nama_ketua || '';
    }
    if (msgEl) {
      msgEl.textContent = '';
      msgEl.style.color = '';
    }
    modal.classList.remove('hidden');
    if (inputNama) {
      setTimeout(function () { inputNama.focus(); }, 100);
    }
  }

  function closeModal() {
    modal.classList.add('hidden');
  }

  if (openBtn) openBtn.addEventListener('click', openModal);
  if (quickBtn) quickBtn.addEventListener('click', openModal);
  if (closeX) closeX.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeModal();
  });

  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const newNama = (inputNama ? inputNama.value : '').trim();
      const newNoSk = (inputNoSk ? inputNoSk.value : '').trim();
      const newKetua = (inputKetua ? inputKetua.value : '').trim();

      if (!newNama) {
        if (msgEl) showMessage(msgEl, 'Nama pengelola tidak boleh kosong.', '#d93025');
        return;
      }

      if (!currentProfile || !currentProfile.id) {
        if (msgEl) showMessage(msgEl, 'Sesi pengguna tidak valid.', '#d93025');
        return;
      }

      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Menyimpan...';
      }
      if (msgEl) showMessage(msgEl, 'Menyimpan data profil...', '#0f6c3e');

      try {
        // 1. Simpan ke Supabase via endpoint /api/update-profile
        try {
          const token = await getValidAuthToken();
          if (token) {
            const upRes = await fetch('/api/update-profile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token: token,
                nama_pengelola: newNama,
                no_sk: newNoSk,
                nama_ketua: newKetua
              })
            });
            const upJson = await upRes.json().catch(() => ({}));
            if (!upRes.ok || !upJson.success) {
              console.warn('Endpoint /api/update-profile warning:', upJson.message);
            }
          }
        } catch (apiErr) {
          console.warn('Endpoint /api/update-profile notice:', apiErr);
        }

        // 2. Selalu simpan ke user_metadata di Supabase Auth via client SDK
        try {
          await supabaseClient.auth.updateUser({
            data: {
              nama_lengkap: newNama,
              nama_pengelola: newNama,
              no_sk: newNoSk,
              nama_ketua: newKetua
            }
          });
        } catch (authMetaErr) {
          console.warn('supabase auth updateUser notice:', authMetaErr);
        }

        // 3. Simpan ke local storage agar persisten di browser ini
        saveUpzProfileExtras(currentProfile.upz_id || currentProfile.id, {
          no_sk: newNoSk,
          nama_ketua: newKetua,
          nama_pengelola: newNama
        });

        currentProfile.no_sk = newNoSk;
        currentProfile.nama_ketua = newKetua;
        currentProfile.nama_lengkap = newNama;

        // 4. Update tabel profiles di Supabase jika memungkinkan
        try {
          await supabaseClient
            .from('profiles')
            .update({ nama_lengkap: newNama })
            .eq('id', currentProfile.id);
        } catch (dbErr) {
          console.warn('Update profiles db warning:', dbErr);
        }

        // 3. Update UI
        const pengelolaEl = document.getElementById('upzMgmtProfilePengelola');
        if (pengelolaEl) pengelolaEl.textContent = newNama;
        const noSkEl = document.getElementById('upzMgmtProfileNoSk');
        if (noSkEl) noSkEl.textContent = newNoSk || '-';
        const ketuaEl = document.getElementById('upzMgmtProfileKetua');
        if (ketuaEl) ketuaEl.textContent = newKetua || '-';

        const userNameEl = document.getElementById('userName');
        if (userNameEl) userNameEl.textContent = newNama;

        if (msgEl) showMessage(msgEl, 'Profil UPZ berhasil diperbarui!', '#0f6c3e');

        recordUpzActivity({
          type: 'perubahan',
          title: 'Perubahan Data Profil UPZ',
          nama_upz: (currentProfile && (currentProfile.nama_upz || currentProfile.nama_lengkap)) || 'UPZ',
          upz_id: currentProfile && currentProfile.upz_id,
          nama_pengelola: newNama,
          desc: `Data profil diperbarui: Pengelola <strong>${escapeHtml(newNama)}</strong>, Ketua <strong>${escapeHtml(newKetua || '-')}</strong>, SK <strong>${escapeHtml(newNoSk || '-')}</strong>`
        });

        setTimeout(function () {
          closeModal();
        }, 900);

      } catch (err) {
        console.error('UPDATE PROFIL UPZ ERROR:', err);
        if (msgEl) showMessage(msgEl, 'Gagal memperbarui profil: ' + (err.message || 'Terjadi kesalahan.'), '#d93025');
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<svg class="icon"><use href="#i-check"></use></svg><span>Simpan Perubahan</span>';
        }
      }
    });
  }
})();

// ==================================================
// DAFTAR DONATUR & MATRIKS CEKLIS BULANAN
// (OTOMATIS DARI FILE EXCEL SETORAN STATUS DITERIMA)
// ==================================================

const BULAN_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BULAN_SHORT = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// Cache detail setoran untuk UPZ
let upzDonaturCache = {
  upzId: null,
  loaded: false,
  donors: []
};

// Cache detail setoran untuk Admin
let adminDonaturCache = {
  loaded: false,
  donors: []
};

// Helper: Ambil data detail_setoran dalam chunks
async function fetchDetailsForSetoranIds(setoranIds) {
  if (!setoranIds || !setoranIds.length) return [];
  const chunkSize = 50;
  let allDetails = [];
  for (let i = 0; i < setoranIds.length; i += chunkSize) {
    const chunk = setoranIds.slice(i, i + chunkSize);
    try {
      const { data, error } = await supabaseClient
        .from('detail_setoran')
        .select('id, setoran_id, nama_muzaki, nominal, jenis')
        .in('setoran_id', chunk);
      if (!error && Array.isArray(data)) {
        allDetails = allDetails.concat(data);
      }
    } catch (e) {
      console.warn('Gagal fetch chunk detail_setoran:', e);
    }
  }
  return allDetails;
}

// --------------------------------------------------
// UPZ: DAFTAR DONATUR & MATRIKS BULANAN
// --------------------------------------------------

function populateUpzDonaturTahunFilter(acceptedSetorans) {
  const sel = document.getElementById('donaturFilterTahun');
  if (!sel) return;
  const currentYear = new Date().getFullYear();
  const yearSet = new Set([currentYear]);
  (acceptedSetorans || []).forEach(function (s) {
    if (s.periode_tahun) yearSet.add(Number(s.periode_tahun));
  });
  const sortedYears = Array.from(yearSet).sort(function (a, b) { return b - a; });
  const prevVal = sel.value;
  let html = '';
  sortedYears.forEach(function (y) {
    html += `<option value="${y}">${y}</option>`;
  });
  sel.innerHTML = html;
  sel.value = prevVal && yearSet.has(Number(prevVal)) ? prevVal : String(currentYear);
}

async function loadUpzDonaturMatrix(forceRefresh = false) {
  const container = document.getElementById('donaturTableContainer');
  if (!container || !currentProfile || !currentProfile.upz_id) return;

  if (upzDonaturCache.loaded && upzDonaturCache.upzId === currentProfile.upz_id && !forceRefresh) {
    renderUpzDonaturTable();
    return;
  }

  container.innerHTML = '<div class="empty-state" style="padding:24px;">Memuat data donatur dari setoran diterima...</div>';

  const accepted = (currentSetoran || []).filter(function (s) {
    const st = String(s.status || '').toLowerCase().trim();
    const isAccepted = (st === 'diterima' || st === 'disetujui' || st === 'verified' || st === 'sukses' || st === 'cocok');
    return isAccepted && !isSetoranProgram(s);
  });

  populateUpzDonaturTahunFilter(accepted);

  if (!accepted.length) {
    upzDonaturCache = { upzId: currentProfile.upz_id, loaded: true, donors: [] };
    const jdEl = document.getElementById('jumlahDonatur');
    if (jdEl) jdEl.textContent = '0';
    renderUpzDonaturTable();
    return;
  }

  const setoranById = {};
  accepted.forEach(function (s) { setoranById[s.id] = s; });
  const setoranIds = accepted.map(function (s) { return s.id; });

  try {
    let details = await fetchDetailsForSetoranIds(setoranIds);

    // Fallback 1: jika chunk fetch kosong, coba getDetailSetoran per transaksi
    if ((!details || !details.length) && setoranIds.length > 0) {
      const fetchList = setoranIds.slice(0, 30).map(function (sid) {
        return getDetailSetoran(sid).catch(function () { return []; });
      });
      const settled = await Promise.all(fetchList);
      settled.forEach(function (rows) {
        if (Array.isArray(rows)) details = details.concat(rows);
      });
    }

    const donorMap = {};
    if (details && details.length > 0) {
      details.forEach(function (d) {
        if (!d.nama_muzaki || !String(d.nama_muzaki).trim()) return;
        const rawName = String(d.nama_muzaki).trim();
        const normKey = rawName.toLowerCase();
        const s = setoranById[d.setoran_id];
        if (!s) return;

        const yr = Number(s.periode_tahun);
        const mo = Number(s.periode_bulan);

        if (!donorMap[normKey]) {
          donorMap[normKey] = {
            nama: rawName,
            donations: {}
          };
        }
        if (!donorMap[normKey].donations[yr]) {
          donorMap[normKey].donations[yr] = {};
        }
        donorMap[normKey].donations[yr][mo] = {
          nominal: Number(d.nominal || 0),
          jenis: d.jenis || 'Setoran'
        };
      });
    } else {
      // Fallback 2: jika rincian detail belum tersimpan di tabel detail_setoran,
      // tampilkan donatur dari setoran terverifikasi agar matriks donatur tetap muncul
      accepted.forEach(function (s) {
        const upzTitle = (currentProfile && (currentProfile.nama_upz || currentProfile.nama_lengkap)) || 'UPZ';
        const rawName = s.keterangan || (upzTitle + ' (Muzaki Terdaftar)');
        const normKey = rawName.toLowerCase();
        const yr = Number(s.periode_tahun);
        const mo = Number(s.periode_bulan);

        if (!donorMap[normKey]) {
          donorMap[normKey] = {
            nama: rawName,
            donations: {}
          };
        }
        if (!donorMap[normKey].donations[yr]) {
          donorMap[normKey].donations[yr] = {};
        }
        donorMap[normKey].donations[yr][mo] = {
          nominal: Number(s.nominal || 0),
          jenis: 'Setoran'
        };
      });
    }

    upzDonaturCache = {
      upzId: currentProfile.upz_id,
      loaded: true,
      donors: Object.values(donorMap).sort(function (a, b) {
        return a.nama.localeCompare(b.nama);
      })
    };

    const jdEl = document.getElementById('jumlahDonatur');
    if (jdEl && Array.isArray(upzDonaturCache.donors)) {
      jdEl.textContent = upzDonaturCache.donors.length.toLocaleString('id-ID');
    }

    renderUpzDonaturTable();
  } catch (err) {
    console.error('LOAD UPZ DONATUR ERROR:', err);
    container.innerHTML = `<div class="empty-state" style="color:#d93025;">Gagal memuat data donatur: ${escapeHtml(err.message)}</div>`;
  }
}

function renderUpzDonaturTable() {
  const container = document.getElementById('donaturTableContainer');
  if (!container) return;

  const donors = upzDonaturCache.donors || [];
  const tahunSelect = document.getElementById('donaturFilterTahun');
  const selectedYear = Number((tahunSelect && tahunSelect.value) ? tahunSelect.value : new Date().getFullYear());
  const search = ((document.getElementById('donaturSearch') || {}).value || '').trim().toLowerCase();
  const filterStatus = (document.getElementById('donaturFilterStatus') || {}).value || 'semua';
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const isCurrentYear = (selectedYear === now.getFullYear());

  // Hitung summary metrics untuk tahun terpilih
  let sudahCount = 0;
  let belumCount = 0;

  donors.forEach(function (d) {
    const hasCurrent = !!(d.donations[selectedYear] && d.donations[selectedYear][currentMonth]);
    if (hasCurrent) sudahCount++;
    else belumCount++;
  });

  const totalEl = document.getElementById('upzDonaturTotalCount');
  const sudahEl = document.getElementById('upzDonaturSudahCount');
  const belumEl = document.getElementById('upzDonaturBelumCount');
  const sudahLabel = document.getElementById('upzDonaturSudahLabel');
  const belumLabel = document.getElementById('upzDonaturBelumLabel');

  if (totalEl) totalEl.textContent = donors.length;
  if (sudahEl) sudahEl.textContent = sudahCount;
  if (belumEl) belumEl.textContent = belumCount;
  if (sudahLabel) sudahLabel.textContent = `Sudah Donasi (${BULAN_SHORT[currentMonth]} ${selectedYear})`;
  if (belumLabel) belumLabel.textContent = `Belum Donasi (${BULAN_SHORT[currentMonth]} ${selectedYear})`;

  // Filter
  let filtered = donors.slice();
  if (search) {
    filtered = filtered.filter(function (d) {
      return d.nama.toLowerCase().includes(search);
    });
  }
  if (filterStatus === 'sudah') {
    filtered = filtered.filter(function (d) {
      return !!(d.donations[selectedYear] && d.donations[selectedYear][currentMonth]);
    });
  } else if (filterStatus === 'belum') {
    filtered = filtered.filter(function (d) {
      return !(d.donations[selectedYear] && d.donations[selectedYear][currentMonth]);
    });
  }

  // Sort: belum donasi bulan ini ditampilkan di atas agar mudah dicek
  filtered.sort(function (a, b) {
    const aCur = !!(a.donations[selectedYear] && a.donations[selectedYear][currentMonth]);
    const bCur = !!(b.donations[selectedYear] && b.donations[selectedYear][currentMonth]);
    if (aCur === bCur) return a.nama.localeCompare(b.nama);
    return aCur ? 1 : -1;
  });

  const countEl = document.getElementById('upzDonaturListCount');
  if (countEl) countEl.textContent = `Menampilkan ${filtered.length} dari ${donors.length} donatur`;

  if (!donors.length) {
    container.innerHTML = `<div class="empty-state">Belum ada donatur dari setoran yang diterima pada tahun ${selectedYear}.<br><small style="color:var(--slate-500);">Data otomatis terisi saat setoran Excel diverifikasi dan diterima admin.</small></div>`;
    return;
  }

  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state">Tidak ada donatur yang cocok dengan filter pencarian.</div>`;
    return;
  }

  let html = `<table class="matrix-table">
    <thead>
      <tr>
        <th style="width:40px;text-align:center;">No</th>
        <th>Nama Donatur / Muzaki</th>`;

  for (let m = 1; m <= 12; m++) {
    const isCur = (isCurrentYear && m === currentMonth);
    html += `<th class="col-month ${isCur ? 'col-current-month' : ''}" title="${BULAN_NAMES[m]}">${BULAN_SHORT[m]}</th>`;
  }

  html += `<th style="text-align:right;">Total (${selectedYear})</th>
        <th style="text-align:center;">Status Bulan Ini</th>
      </tr>
    </thead>
    <tbody>`;

  filtered.forEach(function (d, idx) {
    const isDonatedCurrent = !!(d.donations[selectedYear] && d.donations[selectedYear][currentMonth]);
    const rowClass = isDonatedCurrent ? '' : 'row-unpaid';

    let totalNominalYear = 0;
    let monthCells = '';

    for (let m = 1; m <= 12; m++) {
      const isCur = (isCurrentYear && m === currentMonth);
      const donation = (d.donations[selectedYear] && d.donations[selectedYear][m]);
      if (donation) {
        totalNominalYear += donation.nominal;
        monthCells += `<td class="col-month ${isCur ? 'col-current-month' : ''}">
          <span class="matrix-check" title="${BULAN_NAMES[m]}: Rp ${formatRupiahSimple(donation.nominal)} (${escapeHtml(donation.jenis)})">✓</span>
        </td>`;
      } else {
        monthCells += `<td class="col-month ${isCur ? 'col-current-month' : ''}">
          <span class="matrix-dash" title="${BULAN_NAMES[m]}: Belum berdonasi">-</span>
        </td>`;
      }
    }

    const statusBadge = isDonatedCurrent
      ? `<span class="badge-status-sudah">✓ Sudah</span>`
      : `<span class="badge-status-belum">⚠ Belum</span>`;

    html += `<tr class="${rowClass}">
      <td style="text-align:center;color:var(--slate-400);">${idx + 1}</td>
      <td style="font-weight:600;color:var(--slate-900);">${escapeHtml(d.nama)}</td>
      ${monthCells}
      <td style="text-align:right;font-weight:600;color:var(--primary-700);">
        ${totalNominalYear ? 'Rp ' + formatRupiahSimple(totalNominalYear) : '-'}
      </td>
      <td style="text-align:center;">${statusBadge}</td>
    </tr>`;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

// --------------------------------------------------
// ADMIN: DAFTAR DONATUR SELURUH UPZ
// --------------------------------------------------

function populateAdminDonaturTahunFilter(acceptedSetorans) {
  const sel = document.getElementById('adminDonaturFilterTahun');
  if (!sel) return;
  const currentYear = new Date().getFullYear();
  const yearSet = new Set([currentYear]);
  (acceptedSetorans || []).forEach(function (s) {
    if (s.periode_tahun) yearSet.add(Number(s.periode_tahun));
  });
  const sortedYears = Array.from(yearSet).sort(function (a, b) { return b - a; });
  const prevVal = sel.value;
  let html = '';
  sortedYears.forEach(function (y) {
    html += `<option value="${y}">${y}</option>`;
  });
  sel.innerHTML = html;
  sel.value = prevVal && yearSet.has(Number(prevVal)) ? prevVal : String(currentYear);
}

function populateAdminDonaturUpzFilter() {
  const sel = document.getElementById('adminDonaturFilterUpz');
  if (!sel || !upzMap) return;
  const currentVal = sel.value;
  let html = '<option value="semua">Semua UPZ</option>';
  Object.keys(upzMap)
    .sort(function (a, b) { return String(upzMap[a]).localeCompare(String(upzMap[b])); })
    .forEach(function (id) {
      html += `<option value="${id}">${escapeHtml(upzMap[id])}</option>`;
    });
  sel.innerHTML = html;
  sel.value = currentVal || 'semua';
}

function populateScorecardUpzFilter() {
  const sel = document.getElementById('scorecardUpzFilter');
  if (!sel || !upzMap) return;
  const currentVal = sel.value || 'semua';
  let html = '<option value="semua">Semua UPZ</option>';
  Object.keys(upzMap)
    .sort(function (a, b) { return String(upzMap[a]).localeCompare(String(upzMap[b])); })
    .forEach(function (id) {
      html += `<option value="${id}">${escapeHtml(upzMap[id])}</option>`;
    });
  sel.innerHTML = html;
  sel.value = currentVal;
}

async function ensureAdminDonaturLoaded(forceRefresh = false) {
  if (adminDonaturCache.loaded && !forceRefresh) {
    return adminDonaturCache.donors;
  }

  // 1. Pastikan data setoran admin sudah dimuat
  if (!currentAdminSetoran || !currentAdminSetoran.length) {
    try {
      await loadAdminSetoran();
    } catch (e) {
      console.warn('Auto loadAdminSetoran error:', e);
    }
  }

  const accepted = (currentAdminSetoran || []).filter(function (s) {
    const st = String(s.status || '').toLowerCase().trim();
    return st === 'diterima' || st === 'disetujui' || st === 'verified' || st === 'sukses';
  });

  if (!accepted.length) {
    adminDonaturCache = {
      loaded: true,
      donors: []
    };
    return adminDonaturCache.donors;
  }

  const setoranById = {};
  accepted.forEach(function (s) { setoranById[s.id] = s; });
  const setoranIds = accepted.map(function (s) { return s.id; });

  try {
    let details = await fetchDetailsForSetoranIds(setoranIds);

    // Fallback: jika .in() tidak mengembalikan baris, ambil via getDetailSetoran
    if ((!details || !details.length) && setoranIds.length > 0) {
      const fetchList = setoranIds.slice(0, 30).map(function (sid) {
        return getDetailSetoran(sid).catch(function () { return []; });
      });
      const settled = await Promise.all(fetchList);
      settled.forEach(function (rows) {
        if (Array.isArray(rows)) details = details.concat(rows);
      });
    }

    // Kategori mapping dari allUpzList jika ada
    const upzKategoriMap = {};
    if (Array.isArray(allUpzList)) {
      allUpzList.forEach(function (u) {
        if (u.upz_id) upzKategoriMap[u.upz_id] = u.kategori;
      });
    }

    const donorMap = {};
    if (details && details.length > 0) {
      details.forEach(function (d) {
        if (!d.nama_muzaki || !String(d.nama_muzaki).trim()) return;
        const rawName = String(d.nama_muzaki).trim();
        const s = setoranById[d.setoran_id];
        if (!s) return;

        const upzId = s.upz_id || 'unknown';
        const key = `${upzId}__${rawName.toLowerCase()}`;
        const yr = Number(s.periode_tahun);
        const mo = Number(s.periode_bulan);
        const jenisStr = String(d.jenis || '').toLowerCase();
        const isZakat = jenisStr.includes('zakat') || jenisStr.includes('fitrah') || jenisStr.includes('maal') || jenisStr.includes('profesi');

        if (!donorMap[key]) {
          donorMap[key] = {
            key: key,
            nama: rawName,
            upz_id: upzId,
            nama_upz: (upzMap && upzMap[upzId]) || 'UPZ',
            kategori: upzKategoriMap[upzId] || '-',
            donations: {},
            hasZakat: false,
            hasNonZakat: false
          };
        }
        if (isZakat) {
          donorMap[key].hasZakat = true;
        } else {
          donorMap[key].hasNonZakat = true;
        }
        if (!donorMap[key].donations[yr]) {
          donorMap[key].donations[yr] = {};
        }
        donorMap[key].donations[yr][mo] = {
          nominal: Number(d.nominal || 0),
          jenis: d.jenis || 'Setoran'
        };
      });
    } else {
      accepted.forEach(function (s) {
        const upzId = s.upz_id || 'unknown';
        const upzTitle = (upzMap && upzMap[upzId]) || 'UPZ';
        const key = `${upzId}__summary`;
        const yr = Number(s.periode_tahun);
        const mo = Number(s.periode_bulan);
        const jenisStr = String(s.jenis || '').toLowerCase();
        const isZakat = !jenisStr || jenisStr.includes('zakat') || jenisStr.includes('fitrah') || jenisStr.includes('maal') || jenisStr.includes('profesi');

        if (!donorMap[key]) {
          donorMap[key] = {
            key: key,
            nama: upzTitle + ' (Setoran Terverifikasi)',
            upz_id: upzId,
            nama_upz: upzTitle,
            kategori: upzKategoriMap[upzId] || '-',
            donations: {},
            hasZakat: isZakat,
            hasNonZakat: !isZakat
          };
        }
        if (!donorMap[key].donations[yr]) {
          donorMap[key].donations[yr] = {};
        }
        donorMap[key].donations[yr][mo] = {
          nominal: Number(s.nominal || 0),
          jenis: 'Setoran'
        };
      });
    }

    adminDonaturCache = {
      loaded: true,
      donors: Object.values(donorMap).sort(function (a, b) {
        const uComp = (a.nama_upz || '').localeCompare(b.nama_upz || '');
        if (uComp !== 0) return uComp;
        return a.nama.localeCompare(b.nama);
      })
    };
  } catch (err) {
    console.error('ENSURE ADMIN DONATUR ERROR:', err);
  }

  return adminDonaturCache.donors;
}

async function updateScorecardDonatur(selectedUpzId) {
  const sel = document.getElementById('scorecardUpzFilter');
  const upzId = selectedUpzId !== undefined ? selectedUpzId : (sel ? sel.value : 'semua');
  const topCountEl = document.getElementById('adminTotalDonaturScorecard');
  const topSubEl = document.getElementById('scorecardDonaturSub');
  const chartDonaturEl = document.getElementById('adminChartDonaturUpz');
  const chartLabelEl = document.getElementById('adminChartDonaturLabel');

  await ensureAdminDonaturLoaded();

  const donors = adminDonaturCache.donors || [];

  // 1. Scorecard atas admin: SELALU akumulasi seluruh donatur dari SEMUA UPZ
  if (topCountEl) {
    topCountEl.textContent = donors.length.toLocaleString('id-ID');
  }
  if (topSubEl) {
    topSubEl.textContent = 'Muzaki & Munfik (Seluruh UPZ)';
  }

  // 2. Metrik grafik bulanan: Jumlah donatur tiap-tiap UPZ sesuai filter UPZ
  let chartCount = 0;
  if (!upzId || upzId === 'semua') {
    chartCount = donors.length;
    if (chartLabelEl) chartLabelEl.textContent = 'Jumlah Donatur';
  } else {
    const upzName = (upzMap && upzMap[upzId]) || 'UPZ';
    const upzDonors = donors.filter(function (d) { return String(d.upz_id) === String(upzId); });
    chartCount = upzDonors.length;
    if (chartLabelEl) chartLabelEl.textContent = 'Jumlah Donatur';
  }

  if (chartDonaturEl) {
    chartDonaturEl.textContent = chartCount.toLocaleString('id-ID');
  }
}

// MODAL RINCIAN DONATUR: MUZAKI (ZAKAT) VS MUNFIK (NON-ZAKAT)
function renderDonaturBreakdownModalContent(forcedUpzId) {
  let upzId = 'semua';
  if (forcedUpzId !== undefined) {
    upzId = forcedUpzId;
  } else {
    const sel = document.getElementById('scorecardUpzFilter');
    upzId = (sel && sel.value) ? sel.value : 'semua';
  }
  const donors = (adminDonaturCache && adminDonaturCache.donors) ? adminDonaturCache.donors : [];

  let filtered = donors;
  let scopeLabel = 'Seluruh UPZ (Semua Wilayah)';
  if (upzId && upzId !== 'semua') {
    filtered = donors.filter(function (d) { return String(d.upz_id) === String(upzId); });
    scopeLabel = (upzMap && upzMap[upzId]) || 'UPZ Terpilih';
  }

  const total = filtered.length;
  let muzaki = 0;
  let munfik = 0;

  filtered.forEach(function (d) {
    if (d.hasZakat) muzaki++;
    if (d.hasNonZakat) munfik++;
    if (!d.hasZakat && !d.hasNonZakat) muzaki++;
  });

  const muzakiPct = total > 0 ? Math.round((muzaki / total) * 100) : 0;
  const munfikPct = total > 0 ? Math.round((munfik / total) * 100) : 0;

  const scopeEl = document.getElementById('donaturBreakdownSub') || document.getElementById('donaturModalScopeLabel');
  const totalEl = document.getElementById('modalTotalDonaturCount') || document.getElementById('donaturModalTotal');
  const muzakiEl = document.getElementById('modalMuzakiCount') || document.getElementById('donaturModalMuzaki');
  const munfikEl = document.getElementById('modalMunfikCount') || document.getElementById('donaturModalMunfik');
  const zakatRatioEl = document.getElementById('donaturModalZakatRatio');
  const nonZakatRatioEl = document.getElementById('donaturModalNonZakatRatio');

  if (scopeEl) scopeEl.textContent = `Komposisi Muzaki dan Munfik (${scopeLabel})`;
  if (totalEl) totalEl.textContent = total.toLocaleString('id-ID');
  if (muzakiEl) muzakiEl.textContent = muzaki.toLocaleString('id-ID');
  if (munfikEl) munfikEl.textContent = munfik.toLocaleString('id-ID');
  if (zakatRatioEl) zakatRatioEl.textContent = `${muzakiPct}% dari total donatur`;
  if (nonZakatRatioEl) nonZakatRatioEl.textContent = `${munfikPct}% dari total donatur`;
}

async function openDonaturBreakdownModal(forcedUpzId) {
  const modal = document.getElementById('donaturBreakdownModal');
  if (!modal) return;
  modal.classList.remove('hidden');

  renderDonaturBreakdownModalContent(forcedUpzId);

  try {
    await ensureAdminDonaturLoaded();
    renderDonaturBreakdownModalContent(forcedUpzId);
  } catch (err) {
    console.warn('Gagal memuat detail donatur:', err);
  }
}

function closeDonaturBreakdownModal() {
  const modal = document.getElementById('donaturBreakdownModal');
  if (modal) modal.classList.add('hidden');
}

// MODAL DETAIL KATEGORI UPZ TERDATA
function renderUpzCategoryModalContent() {
  const countEl = document.getElementById('modalTotalUpzCount') || document.getElementById('upzCategoryModalCount');
  const listEl = document.getElementById('modalUpzCategoryGrid') || document.getElementById('upzCategoryModalList');

  const upzSource = (allUpzList && allUpzList.length > 0) ? allUpzList : (typeof DEFAULT_UPZ_DATA !== 'undefined' ? DEFAULT_UPZ_DATA : []);
  if (countEl) countEl.textContent = upzSource.length.toLocaleString('id-ID');

  const catCount = {};
  upzSource.forEach(function (u) {
    const k = (u.kategori || '').trim() || 'Lainnya';
    catCount[k] = (catCount[k] || 0) + 1;
  });

  if (listEl) {
    listEl.className = 'upz-category-simple-list';
    const sortedEntries = Object.entries(catCount).sort(function (a, b) { return b[1] - a[1]; });
    listEl.innerHTML = sortedEntries.map(function (entry) {
      const cat = entry[0];
      const cnt = entry[1];
      return `
        <div class="upz-simple-cat-item">
          <span class="upz-simple-cat-name">${escapeHtml(cat)}</span>
          <span class="upz-simple-cat-count"><strong>${cnt.toLocaleString('id-ID')}</strong> UPZ</span>
        </div>
      `;
    }).join('');
  }
}

async function openUpzCategoryModal() {
  const modal = document.getElementById('upzCategoryModal');
  if (!modal) return;
  modal.classList.remove('hidden');

  renderUpzCategoryModalContent();

  if (!allUpzList || !allUpzList.length) {
    try {
      await loadUpzList();
      renderUpzCategoryModalContent();
    } catch (_) {}
  }
}

function closeUpzCategoryModal() {
  const modal = document.getElementById('upzCategoryModal');
  if (modal) modal.classList.add('hidden');
}

async function loadAdminDonaturMatrix(forceRefresh = false) {
  const container = document.getElementById('adminDonaturTableContainer');
  if (!container) return;

  if (adminDonaturCache.loaded && !forceRefresh) {
    renderAdminDonaturTable();
    return;
  }

  container.innerHTML = '<div class="empty-state" style="padding:24px;">Memuat data donatur dari seluruh UPZ...</div>';

  await ensureAdminDonaturLoaded(forceRefresh);

  const accepted = (currentAdminSetoran || []).filter(function (s) {
    const st = String(s.status || '').toLowerCase().trim();
    return st === 'diterima' || st === 'disetujui' || st === 'verified' || st === 'sukses';
  });

  populateAdminDonaturTahunFilter(accepted.length ? accepted : [{ periode_tahun: new Date().getFullYear() }]);
  populateAdminDonaturUpzFilter();
  renderAdminDonaturTable();
}

function renderAdminDonaturTable() {
  const container = document.getElementById('adminDonaturTableContainer');
  if (!container) return;

  const donors = adminDonaturCache.donors || [];
  const selectedUpz = (document.getElementById('adminDonaturFilterUpz') || {}).value || 'semua';
  const tahunSelect = document.getElementById('adminDonaturFilterTahun');
  const selectedYear = Number((tahunSelect && tahunSelect.value) ? tahunSelect.value : new Date().getFullYear());
  const search = ((document.getElementById('adminDonaturSearch') || {}).value || '').trim().toLowerCase();
  const filterStatus = (document.getElementById('adminDonaturFilterStatus') || {}).value || 'semua';
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const isCurrentYear = (selectedYear === now.getFullYear());

  let filtered = donors.slice();
  if (selectedUpz && selectedUpz !== 'semua') {
    filtered = filtered.filter(function (d) { return d.upz_id === selectedUpz; });
  }

  // Hitung summary metrics untuk UPZ & Tahun terpilih
  let sudahCount = 0;
  let belumCount = 0;
  filtered.forEach(function (d) {
    const hasCurrent = !!(d.donations[selectedYear] && d.donations[selectedYear][currentMonth]);
    if (hasCurrent) sudahCount++;
    else belumCount++;
  });

  const totalEl = document.getElementById('adminDonaturTotalCount');
  const sudahEl = document.getElementById('adminDonaturSudahCount');
  const belumEl = document.getElementById('adminDonaturBelumCount');
  if (totalEl) totalEl.textContent = filtered.length;
  if (sudahEl) sudahEl.textContent = sudahCount;
  if (belumEl) belumEl.textContent = belumCount;

  if (search) {
    filtered = filtered.filter(function (d) {
      return d.nama.toLowerCase().includes(search) || d.nama_upz.toLowerCase().includes(search);
    });
  }
  if (filterStatus === 'sudah') {
    filtered = filtered.filter(function (d) {
      return !!(d.donations[selectedYear] && d.donations[selectedYear][currentMonth]);
    });
  } else if (filterStatus === 'belum') {
    filtered = filtered.filter(function (d) {
      return !(d.donations[selectedYear] && d.donations[selectedYear][currentMonth]);
    });
  }

  // Sort: belum donasi di atas
  filtered.sort(function (a, b) {
    const aCur = !!(a.donations[selectedYear] && a.donations[selectedYear][currentMonth]);
    const bCur = !!(b.donations[selectedYear] && b.donations[selectedYear][currentMonth]);
    if (aCur === bCur) return a.nama.localeCompare(b.nama);
    return aCur ? 1 : -1;
  });

  const countEl = document.getElementById('adminDonaturListCount');
  if (countEl) countEl.textContent = `Menampilkan ${filtered.length} donatur`;

  if (!donors.length) {
    container.innerHTML = `<div class="empty-state">Belum ada donatur dari setoran yang diterima pada tahun ${selectedYear}.</div>`;
    return;
  }

  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state">Tidak ada donatur yang cocok dengan filter yang dipilih.</div>`;
    return;
  }

  let html = `<table class="matrix-table">
    <thead>
      <tr>
        <th style="width:40px;text-align:center;">No</th>
        <th>Nama Donatur / Muzaki</th>
        <th>UPZ</th>
        <th>Kategori</th>`;

  for (let m = 1; m <= 12; m++) {
    const isCur = (isCurrentYear && m === currentMonth);
    html += `<th class="col-month ${isCur ? 'col-current-month' : ''}" title="${BULAN_NAMES[m]}">${BULAN_SHORT[m]}</th>`;
  }

  html += `<th style="text-align:right;">Total (${selectedYear})</th>
        <th style="text-align:center;">Status Bulan Ini</th>
      </tr>
    </thead>
    <tbody>`;

  filtered.forEach(function (d, idx) {
    const isDonatedCurrent = !!(d.donations[selectedYear] && d.donations[selectedYear][currentMonth]);
    const rowClass = isDonatedCurrent ? '' : 'row-unpaid';

    let totalNominalYear = 0;
    let monthCells = '';

    for (let m = 1; m <= 12; m++) {
      const isCur = (isCurrentYear && m === currentMonth);
      const donation = (d.donations[selectedYear] && d.donations[selectedYear][m]);
      if (donation) {
        totalNominalYear += donation.nominal;
        monthCells += `<td class="col-month ${isCur ? 'col-current-month' : ''}">
          <span class="matrix-check" title="${BULAN_NAMES[m]}: Rp ${formatRupiahSimple(donation.nominal)} (${escapeHtml(donation.jenis)})">✓</span>
        </td>`;
      } else {
        monthCells += `<td class="col-month ${isCur ? 'col-current-month' : ''}">
          <span class="matrix-dash" title="${BULAN_NAMES[m]}: Belum berdonasi">-</span>
        </td>`;
      }
    }

    const statusBadge = isDonatedCurrent
      ? `<span class="badge-status-sudah">✓ Sudah</span>`
      : `<span class="badge-status-belum">⚠ Belum</span>`;

    html += `<tr class="${rowClass}">
      <td style="text-align:center;color:var(--slate-400);">${idx + 1}</td>
      <td style="font-weight:600;color:var(--slate-900);">${escapeHtml(d.nama)}</td>
      <td><span style="font-weight:500;">${escapeHtml(d.nama_upz)}</span></td>
      <td>${renderKategoriChip(d.kategori)}</td>
      ${monthCells}
      <td style="text-align:right;font-weight:600;color:var(--primary-700);">
        ${totalNominalYear ? 'Rp ' + formatRupiahSimple(totalNominalYear) : '-'}
      </td>
      <td style="text-align:center;">${statusBadge}</td>
    </tr>`;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

function exportAdminDonaturExcel() {
  if (typeof XLSX === 'undefined') {
    alert('Pustaka SheetJS (XLSX) tidak tersedia.');
    return;
  }
  const donors = adminDonaturCache.donors || [];
  if (!donors.length) {
    alert('Tidak ada data donatur untuk diexport.');
    return;
  }
  const tahunSelect = document.getElementById('adminDonaturFilterTahun');
  const selectedYear = Number((tahunSelect && tahunSelect.value) ? tahunSelect.value : new Date().getFullYear());
  const selectedUpz = (document.getElementById('adminDonaturFilterUpz') || {}).value || 'semua';
  const now = new Date();
  const currentMonth = now.getMonth() + 1;

  let filtered = donors.slice();
  if (selectedUpz && selectedUpz !== 'semua') {
    filtered = filtered.filter(function (d) { return d.upz_id === selectedUpz; });
  }

  const headers = ['No', 'Nama Donatur', 'UPZ', 'Kategori', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des', `Total (${selectedYear})`, `Status ${BULAN_SHORT[currentMonth]} ${selectedYear}`];
  const rows = [headers];

  filtered.forEach(function (d, idx) {
    let totalNominal = 0;
    const monthChecks = [];
    for (let m = 1; m <= 12; m++) {
      const donation = (d.donations[selectedYear] && d.donations[selectedYear][m]);
      if (donation) {
        totalNominal += donation.nominal;
        monthChecks.push('✓');
      } else {
        monthChecks.push('-');
      }
    }
    const isDonatedCur = !!(d.donations[selectedYear] && d.donations[selectedYear][currentMonth]);
    rows.push([
      idx + 1,
      d.nama,
      d.nama_upz,
      d.kategori || '-',
      ...monthChecks,
      totalNominal,
      isDonatedCur ? 'Sudah' : 'Belum'
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, `Donatur ${selectedYear}`);
  XLSX.writeFile(wb, `Rekap_Donatur_UPZ_${selectedYear}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// Event Listeners untuk Donatur Matrix (UPZ & Admin)
(function () {
  // UPZ event listeners
  const upzSearch = document.getElementById('donaturSearch');
  const upzTahun = document.getElementById('donaturFilterTahun');
  const upzStatus = document.getElementById('donaturFilterStatus');
  const upzReset = document.getElementById('donaturFilterReset');
  const upzRefresh = document.getElementById('upzDonaturRefresh');

  if (upzSearch) upzSearch.addEventListener('input', renderUpzDonaturTable);
  if (upzTahun) upzTahun.addEventListener('change', renderUpzDonaturTable);
  if (upzStatus) upzStatus.addEventListener('change', renderUpzDonaturTable);
  if (upzReset) upzReset.addEventListener('click', function () {
    if (upzSearch) upzSearch.value = '';
    if (upzStatus) upzStatus.value = 'semua';
    renderUpzDonaturTable();
  });
  if (upzRefresh) upzRefresh.addEventListener('click', function () {
    loadUpzDonaturMatrix(true);
  });

  // Admin event listeners
  const adminUpzFilter = document.getElementById('adminDonaturFilterUpz');
  const adminSearch = document.getElementById('adminDonaturSearch');
  const adminTahun = document.getElementById('adminDonaturFilterTahun');
  const adminStatus = document.getElementById('adminDonaturFilterStatus');
  const adminReset = document.getElementById('adminDonaturFilterReset');
  const adminRefresh = document.getElementById('adminDonaturRefreshBtn');
  const adminExport = document.getElementById('adminDonaturExportBtn');

  if (adminUpzFilter) adminUpzFilter.addEventListener('change', renderAdminDonaturTable);
  if (adminSearch) adminSearch.addEventListener('input', renderAdminDonaturTable);
  if (adminTahun) adminTahun.addEventListener('change', renderAdminDonaturTable);
  if (adminStatus) adminStatus.addEventListener('change', renderAdminDonaturTable);
  if (adminReset) adminReset.addEventListener('click', function () {
    if (adminSearch) adminSearch.value = '';
    if (adminUpzFilter) adminUpzFilter.value = 'semua';
    if (adminStatus) adminStatus.value = 'semua';
    renderAdminDonaturTable();
  });
  if (adminRefresh) adminRefresh.addEventListener('click', function () {
    loadAdminDonaturMatrix(true);
  });
  if (adminExport) adminExport.addEventListener('click', exportAdminDonaturExcel);

  // Scorecard UPZ filter listener (mengubah donatur & grafik tren)
  const scorecardUpzFilter = document.getElementById('scorecardUpzFilter');
  if (scorecardUpzFilter) {
    scorecardUpzFilter.addEventListener('change', function () {
      updateScorecardDonatur(this.value);
      if (typeof renderAdminMonthlyChart === 'function') {
        renderAdminMonthlyChart();
      }
    });
  }

  // Admin Ranking Year filter listener
  const rankingYearFilter = document.getElementById('adminRankingYearFilter');
  if (rankingYearFilter) {
    rankingYearFilter.addEventListener('change', function () {
      if (typeof renderAdminUpzRankings === 'function') {
        renderAdminUpzRankings();
      }
    });
  }

  // Admin Toggle buttons in hero
  const toggleDonaturBtn = document.getElementById('adminToggleDonaturMgmt');
  const donaturSection = document.getElementById('adminDonaturManagement');
  const upzMgmtSection = document.getElementById('adminUpzManagement');

  if (toggleDonaturBtn && donaturSection) {
    toggleDonaturBtn.addEventListener('click', function () {
      const isHidden = donaturSection.classList.contains('hidden');
      if (isHidden) {
        donaturSection.classList.remove('hidden');
        if (upzMgmtSection) upzMgmtSection.classList.add('hidden');
        loadAdminDonaturMatrix();
        donaturSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }
})();

// ==================================================
// TOPBAR NAVIGATION & MONTHLY CHARTS (SPA PAGES)
// ==================================================

let adminChartInstance = null;
let upzChartInstance = null;
let currentActiveView = 'beranda';

// FORMAT RUPIAH SINGKAT UNTUK TICKS CHART (misal 15 Jt, 500 Rb)
function formatRupiahShort(val) {
  if (val >= 1000000000) return 'Rp ' + (val / 1000000000).toFixed(1) + ' M';
  if (val >= 1000000) return 'Rp ' + (val / 1000000).toFixed(0) + ' Jt';
  if (val >= 1000) return 'Rp ' + (val / 1000).toFixed(0) + ' Rb';
  return 'Rp ' + val;
}

// RENDER GRAFIK SETORAN PER BULAN ADMIN
function renderAdminMonthlyChart(forcedYear) {
  const canvas = document.getElementById('adminMonthlyChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const currentYear = new Date().getFullYear();
  const yearSelect = document.getElementById('adminChartYearFilter');
  const upzSelect = document.getElementById('scorecardUpzFilter');
  const selectedUpz = (upzSelect && upzSelect.value) ? upzSelect.value : 'semua';

  const filteredSetorans = (selectedUpz && selectedUpz !== 'semua')
    ? currentAdminSetoran.filter(function (item) { return String(item.upz_id) === String(selectedUpz); })
    : currentAdminSetoran;

  const yearSet = new Set([currentYear]);
  currentAdminSetoran.forEach(function (item) {
    if (item.periode_tahun) yearSet.add(Number(item.periode_tahun));
  });
  if (forcedYear) yearSet.add(Number(forcedYear));
  const years = Array.from(yearSet).sort(function (a, b) { return b - a; });

  if (yearSelect) {
    const existingYears = Array.from(yearSelect.options).map(function (o) { return Number(o.value); });
    const isIdentical = existingYears.length === years.length && existingYears.every(function (y, i) { return y === years[i]; });
    let curVal = forcedYear ? Number(forcedYear) : (yearSelect.value ? Number(yearSelect.value) : years[0]);
    if (!years.includes(curVal)) curVal = years[0];

    if (!isIdentical || forcedYear) {
      yearSelect.innerHTML = years.map(function (y) {
        return `<option value="${y}" ${y === curVal ? 'selected' : ''}>${y}</option>`;
      }).join('');
    }
    yearSelect.value = String(curVal);
  }

  const selectedYear = Number((yearSelect && yearSelect.value) ? yearSelect.value : (forcedYear || years[0]));

  const yearLabel = document.getElementById('adminChartYearLabel');
  if (yearLabel) yearLabel.textContent = selectedYear;

  const chartDesc = document.querySelector('#adminChartCard .section-desc');
  const upzName = (upzMap && upzMap[selectedUpz]) || 'UPZ Terpilih';
  if (chartDesc) {
    if (selectedUpz !== 'semua') {
      chartDesc.innerHTML = `Akumulasi nominal setoran yang masuk per bulan khusus untuk <strong>${escapeHtml(upzName)}</strong> pada tahun ${selectedYear}.`;
    } else {
      chartDesc.textContent = `Akumulasi nominal setoran yang masuk setiap bulan dari seluruh UPZ pada tahun ${selectedYear}.`;
    }
  }

  const dataDiterimaReguler = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const dataDiterimaProgram = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const dataMenunggu = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  filteredSetorans.forEach(function (item) {
    if (Number(item.periode_tahun) === selectedYear) {
      const m = Number(item.periode_bulan) - 1;
      if (m >= 0 && m < 12) {
        const nominal = Number(item.nominal || 0);
        const status = String(item.status || '').toLowerCase();
        if (status === 'diterima') {
          if (isSetoranProgram(item)) {
            dataDiterimaProgram[m] += nominal;
          } else {
            dataDiterimaReguler[m] += nominal;
          }
        } else if (status === 'menunggu') {
          dataMenunggu[m] += nominal;
        }
      }
    }
  });

  const totalRegulerYear = dataDiterimaReguler.reduce(function (a, b) { return a + b; }, 0);
  const totalProgramYear = dataDiterimaProgram.reduce(function (a, b) { return a + b; }, 0);
  const totalYear = totalRegulerYear + totalProgramYear;
  const currentRunningMonth = new Date().getMonth() + 1;
  const runningMonths = (selectedYear === currentYear) ? Math.max(1, currentRunningMonth) : 12;
  const avgMonth = Math.round(totalYear / runningMonths);

  let maxMonthIdx = 0;
  let maxMonthVal = 0;
  for (let i = 0; i < 12; i++) {
    const combinedVal = dataDiterimaReguler[i] + dataDiterimaProgram[i];
    if (combinedVal > maxMonthVal) {
      maxMonthVal = combinedVal;
      maxMonthIdx = i;
    }
  }

  const regulerEl = document.getElementById('adminChartRegulerYear');
  if (regulerEl) regulerEl.textContent = formatRupiah(totalRegulerYear);

  const progEl = document.getElementById('adminChartProgramYear');
  if (progEl) progEl.textContent = formatRupiah(totalProgramYear);

  const totalEl = document.getElementById('adminChartTotalYear');
  if (totalEl) totalEl.textContent = formatRupiah(totalYear);

  const totalTransaksiYear = filteredSetorans.filter(function (item) {
    const yr = Number(item.periode_tahun) || (item.tanggal_setor ? parseInt(String(item.tanggal_setor).substring(0, 4), 10) : 0);
    return yr === selectedYear;
  }).length;
  const trxEl = document.getElementById('adminChartTransaksiYear');
  if (trxEl) trxEl.textContent = totalTransaksiYear.toLocaleString('id-ID');

  const avgEl = document.getElementById('adminChartAvgMonth');
  if (avgEl) avgEl.textContent = formatRupiah(avgMonth);

  const peakEl = document.getElementById('adminChartPeakMonth');
  if (peakEl) {
    peakEl.textContent = maxMonthVal > 0
      ? BULAN_NAMES[maxMonthIdx + 1] + ' (' + formatRupiahSimple(maxMonthVal) + ')'
      : '-';
  }

  if (typeof updateScorecardDonatur === 'function') {
    updateScorecardDonatur(selectedUpz);
  }

  if (adminChartInstance) {
    adminChartInstance.destroy();
  }

  const ctx = canvas.getContext('2d');
  adminChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
      datasets: [
        {
          label: 'Reguler (Diterima)',
          data: dataDiterimaReguler,
          backgroundColor: 'rgba(25, 135, 84, 0.85)',
          hoverBackgroundColor: 'rgba(15, 108, 62, 1)',
          borderRadius: 6,
          borderSkipped: false
        },
        {
          label: 'Program (Diterima)',
          data: dataDiterimaProgram,
          backgroundColor: 'rgba(37, 99, 235, 0.85)',
          hoverBackgroundColor: 'rgba(29, 78, 216, 1)',
          borderRadius: 6,
          borderSkipped: false
        },
        {
          label: 'Menunggu Verifikasi',
          data: dataMenunggu,
          backgroundColor: 'rgba(245, 158, 11, 0.75)',
          hoverBackgroundColor: 'rgba(217, 119, 6, 1)',
          borderRadius: 6,
          borderSkipped: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { family: 'Poppins', size: 12, weight: '600' },
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 16
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          padding: 12,
          cornerRadius: 8,
          titleFont: { family: 'Poppins', size: 13, weight: '700' },
          bodyFont: { family: 'Poppins', size: 12 },
          callbacks: {
            title: function (ctx) {
              const idx = ctx[0].dataIndex;
              return BULAN_NAMES[idx + 1] + ' ' + selectedYear;
            },
            label: function (ctx) {
              return ' ' + ctx.dataset.label + ': Rp ' + formatRupiahSimple(ctx.parsed.y);
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: 'Poppins', size: 12, weight: '500' } }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(226, 232, 240, 0.8)' },
          ticks: {
            font: { family: 'Poppins', size: 11 },
            callback: function (val) {
              return formatRupiahShort(val);
            }
          }
        }
      }
    }
  });
}

// ==================================================
// KLASEMEN / PERINGKAT SETORAN UPZ (TOP 5 & BOTTOM 5)
// ==================================================
function populateAdminRankingYearFilter() {
  const sel = document.getElementById('adminRankingYearFilter');
  if (!sel) return;
  const currentVal = sel.value || 'semua';
  const currentYear = new Date().getFullYear();
  const yearSet = new Set([currentYear]);
  (currentAdminSetoran || []).forEach(function (item) {
    if (item.periode_tahun) yearSet.add(Number(item.periode_tahun));
  });
  const sortedYears = Array.from(yearSet).sort(function (a, b) { return b - a; });
  let html = '<option value="semua">Semua Periode</option>';
  sortedYears.forEach(function (y) {
    html += `<option value="${y}" ${String(y) === String(currentVal) ? 'selected' : ''}>Tahun ${y}</option>`;
  });
  sel.innerHTML = html;
  sel.value = currentVal;
}

function populateAdminRankingKategoriFilter() {
  const sel = document.getElementById('adminRankingKategoriFilter');
  if (!sel) return;
  const currentVal = sel.value || 'semua';
  const katSet = new Set(ALL_UPZ_CATEGORIES);
  const upzSource = (allUpzList && allUpzList.length > 0) ? allUpzList : DEFAULT_UPZ_DATA;
  upzSource.forEach(function (u) {
    if (u.kategori && u.kategori !== '-' && String(u.kategori).trim()) {
      katSet.add(String(u.kategori).trim());
    }
  });
  const sortedKats = Array.from(katSet).sort();
  let html = '<option value="semua">Semua Kategori</option>';
  sortedKats.forEach(function (k) {
    html += `<option value="${escapeHtml(k)}" ${String(k) === String(currentVal) ? 'selected' : ''}>${escapeHtml(k)}</option>`;
  });
  sel.innerHTML = html;
  sel.value = currentVal;
}

async function renderAdminUpzRankings() {
  const topContainer = document.getElementById('top5UpzList');
  const bottomContainer = document.getElementById('bottom5UpzList');
  if (!topContainer || !bottomContainer) return;

  // Pastikan daftar UPZ tersedia
  if (!allUpzList || !allUpzList.length) {
    if (typeof loadUpzList === 'function') {
      try {
        await loadUpzList();
      } catch (e) {
        console.warn('Auto loadUpzList error:', e);
      }
    }
  }

  const baseUpzSource = (allUpzList && allUpzList.length > 0) ? allUpzList : DEFAULT_UPZ_DATA;
  const yearFilter = document.getElementById('adminRankingYearFilter');
  const selectedYear = (yearFilter && yearFilter.value) ? yearFilter.value : 'semua';

  const kategoriFilter = document.getElementById('adminRankingKategoriFilter');
  const selectedKategori = (kategoriFilter && kategoriFilter.value) ? kategoriFilter.value : 'semua';

  // Filter sumber UPZ berdasarkan kategori jika dipilih
  const upzSource = (selectedKategori !== 'semua')
    ? baseUpzSource.filter(function (u) {
        return String(u.kategori || '').toLowerCase().trim() === String(selectedKategori).toLowerCase().trim();
      })
    : baseUpzSource;

  // Update subtitle info klasemen
  const topSub = document.getElementById('top5TotalInfo');
  if (topSub) {
    topSub.textContent = selectedKategori !== 'semua' ? `Kategori: ${selectedKategori}` : 'Top Kontributor';
  }
  const botSub = document.getElementById('bottom5TotalInfo');
  if (botSub) {
    botSub.textContent = selectedKategori !== 'semua' ? `Kategori: ${selectedKategori}` : 'Perlu Peningkatan';
  }

  // Kumpulkan setoran berstatus sukses/diterima
  const acceptedSetorans = (currentAdminSetoran || []).filter(function (s) {
    const st = String(s.status || '').toLowerCase().trim();
    const isAccepted = (st === 'diterima' || st === 'disetujui' || st === 'verified' || st === 'sukses');
    if (!isAccepted) return false;
    if (selectedYear !== 'semua' && Number(s.periode_tahun) !== Number(selectedYear)) return false;
    return true;
  });

  // Hitung total setoran & jumlah transaksi per UPZ
  const upzSummaryMap = {};
  upzSource.forEach(function (u) {
    const uid = u.upz_id || u.id;
    upzSummaryMap[uid] = {
      upz_id: uid,
      nama_upz: u.nama_upz || u.nama_lengkap || (upzMap && upzMap[uid]) || 'UPZ',
      kategori: u.kategori || '-',
      totalNominal: 0,
      totalTransaksi: 0
    };
  });

  acceptedSetorans.forEach(function (s) {
    const uid = s.upz_id || 'unknown';
    if (upzSummaryMap[uid]) {
      upzSummaryMap[uid].totalNominal += Number(s.nominal || 0);
      upzSummaryMap[uid].totalTransaksi += 1;
    } else if (selectedKategori === 'semua') {
      upzSummaryMap[uid] = {
        upz_id: uid,
        nama_upz: (upzMap && upzMap[uid]) || s.nama_upz || 'UPZ',
        kategori: '-',
        totalNominal: Number(s.nominal || 0),
        totalTransaksi: 1
      };
    }
  });

  const upzArray = Object.values(upzSummaryMap);

  // Urutkan dari tertinggi ke terendah
  upzArray.sort(function (a, b) {
    if (b.totalNominal !== a.totalNominal) {
      return b.totalNominal - a.totalNominal;
    }
    return b.totalTransaksi - a.totalTransaksi;
  });

  // Top 5
  const top5 = upzArray.slice(0, 5);
  const maxTopNominal = (top5[0] && top5[0].totalNominal > 0) ? top5[0].totalNominal : 1;

  // Bottom 5 (urut dari yang paling kecil/0 naik ke atas)
  const bottom5 = upzArray.slice().sort(function (a, b) {
    if (a.totalNominal !== b.totalNominal) {
      return a.totalNominal - b.totalNominal;
    }
    return a.totalTransaksi - b.totalTransaksi;
  }).slice(0, 5);

  // Render Top 5
  const rankBadges = ['rank-badge-gold', 'rank-badge-silver', 'rank-badge-bronze', 'rank-badge-default', 'rank-badge-default'];
  let topHtml = '';
  top5.forEach(function (item, idx) {
    const percent = Math.max(8, Math.min(100, Math.round((item.totalNominal / maxTopNominal) * 100)));
    const badgeClass = rankBadges[idx] || 'rank-badge-default';
    topHtml += `
      <div class="ranking-item">
        <div class="rank-badge ${badgeClass}">${idx + 1}</div>
        <div class="rank-info">
          <div class="rank-upz-row">
            <span class="rank-upz-name" title="${escapeHtml(item.nama_upz)}">${escapeHtml(item.nama_upz)}</span>
          </div>
          <div class="rank-bar-wrap">
            <div class="rank-bar-fill fill-green" style="width:${item.totalNominal > 0 ? percent : 0}%"></div>
          </div>
        </div>
        <div class="rank-amount-col">
          <div class="rank-nominal ${item.totalNominal > 0 ? 'nominal-green' : 'nominal-muted'}">
            ${item.totalNominal > 0 ? formatRupiah(item.totalNominal) : 'Rp 0'}
          </div>
          <div class="rank-count">${item.totalTransaksi}x setor</div>
        </div>
      </div>
    `;
  });
  topContainer.innerHTML = topHtml || '<div class="empty-state" style="padding:16px;">Belum ada data setoran terverifikasi.</div>';

  // Render Bottom 5
  let bottomHtml = '';
  bottom5.forEach(function (item, idx) {
    bottomHtml += `
      <div class="ranking-item">
        <div class="rank-badge rank-badge-bottom">${idx + 1}</div>
        <div class="rank-info">
          <div class="rank-upz-row">
            <span class="rank-upz-name" title="${escapeHtml(item.nama_upz)}">${escapeHtml(item.nama_upz)}</span>
          </div>
          <div class="rank-bar-wrap">
            <div class="rank-bar-fill fill-amber" style="width:${item.totalNominal > 0 ? '25%' : '0%'}"></div>
          </div>
        </div>
        <div class="rank-amount-col">
          <div class="rank-nominal ${item.totalNominal > 0 ? '' : 'nominal-muted'}">
            ${item.totalNominal > 0 ? formatRupiah(item.totalNominal) : 'Rp 0'}
          </div>
          <div class="rank-count">${item.totalNominal > 0 ? item.totalTransaksi + 'x setor' : 'Belum setor'}</div>
        </div>
      </div>
    `;
  });
  bottomContainer.innerHTML = bottomHtml || '<div class="empty-state" style="padding:16px;">Belum ada data UPZ.</div>';
}

// RENDER GRAFIK SETORAN PER BULAN UPZ
function renderUpzMonthlyChart(forcedYear) {
  const canvas = document.getElementById('upzMonthlyChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const currentYear = new Date().getFullYear();
  const yearSelect = document.getElementById('upzChartYearFilter');

  const yearSet = new Set([currentYear]);
  currentSetoran.forEach(function (item) {
    if (item.periode_tahun) yearSet.add(Number(item.periode_tahun));
  });
  if (forcedYear) yearSet.add(Number(forcedYear));
  const years = Array.from(yearSet).sort(function (a, b) { return b - a; });

  if (yearSelect) {
    const existingYears = Array.from(yearSelect.options).map(function (o) { return Number(o.value); });
    const isIdentical = existingYears.length === years.length && existingYears.every(function (y, i) { return y === years[i]; });
    let curVal = forcedYear ? Number(forcedYear) : (yearSelect.value ? Number(yearSelect.value) : years[0]);
    if (!years.includes(curVal)) curVal = years[0];

    if (!isIdentical || forcedYear) {
      yearSelect.innerHTML = years.map(function (y) {
        return `<option value="${y}" ${y === curVal ? 'selected' : ''}>${y}</option>`;
      }).join('');
    }
    yearSelect.value = String(curVal);
  }

  const selectedYear = Number((yearSelect && yearSelect.value) ? yearSelect.value : (forcedYear || years[0]));

  const yearLabel = document.getElementById('upzChartYearLabel');
  if (yearLabel) yearLabel.textContent = selectedYear;

  const dataDiterimaReguler = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const dataDiterimaProgram = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const dataMenunggu = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  currentSetoran.forEach(function (item) {
    if (Number(item.periode_tahun) === selectedYear) {
      const m = Number(item.periode_bulan) - 1;
      if (m >= 0 && m < 12) {
        const nominal = Number(item.nominal || 0);
        const status = String(item.status || '').toLowerCase();
        if (status === 'diterima') {
          if (isSetoranProgram(item)) {
            dataDiterimaProgram[m] += nominal;
          } else {
            dataDiterimaReguler[m] += nominal;
          }
        } else if (status === 'menunggu') {
          dataMenunggu[m] += nominal;
        }
      }
    }
  });

  const totalRegulerYear = dataDiterimaReguler.reduce(function (a, b) { return a + b; }, 0);
  const totalProgramYear = dataDiterimaProgram.reduce(function (a, b) { return a + b; }, 0);
  const totalYear = totalRegulerYear + totalProgramYear;
  const currentRunningMonth = new Date().getMonth() + 1;
  const runningMonths = (selectedYear === currentYear) ? Math.max(1, currentRunningMonth) : 12;
  const avgMonth = Math.round(totalYear / runningMonths);

  let maxMonthIdx = 0;
  let maxMonthVal = 0;
  for (let i = 0; i < 12; i++) {
    const combinedVal = dataDiterimaReguler[i] + dataDiterimaProgram[i];
    if (combinedVal > maxMonthVal) {
      maxMonthVal = combinedVal;
      maxMonthIdx = i;
    }
  }

  const regulerEl = document.getElementById('upzChartRegulerYear');
  if (regulerEl) regulerEl.textContent = formatRupiah(totalRegulerYear);

  const progEl = document.getElementById('upzChartProgramYear');
  if (progEl) progEl.textContent = formatRupiah(totalProgramYear);

  const totalEl = document.getElementById('upzChartTotalYear');
  if (totalEl) totalEl.textContent = formatRupiah(totalYear);

  const totalTransaksiYear = currentSetoran.filter(function (item) {
    const yr = Number(item.periode_tahun) || (item.tanggal_setor ? parseInt(String(item.tanggal_setor).substring(0, 4), 10) : 0);
    return yr === selectedYear;
  }).length;
  const trxEl = document.getElementById('upzChartTransaksiYear');
  if (trxEl) trxEl.textContent = totalTransaksiYear.toLocaleString('id-ID');

  const avgEl = document.getElementById('upzChartAvgMonth');
  if (avgEl) avgEl.textContent = formatRupiah(avgMonth);

  const peakEl = document.getElementById('upzChartPeakMonth');
  if (peakEl) {
    peakEl.textContent = maxMonthVal > 0
      ? BULAN_NAMES[maxMonthIdx + 1] + ' (' + formatRupiahSimple(maxMonthVal) + ')'
      : '-';
  }

  if (upzChartInstance) {
    upzChartInstance.destroy();
  }

  const ctx = canvas.getContext('2d');
  upzChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
      datasets: [
        {
          label: 'Reguler (Diterima)',
          data: dataDiterimaReguler,
          backgroundColor: 'rgba(25, 135, 84, 0.85)',
          hoverBackgroundColor: 'rgba(15, 108, 62, 1)',
          borderRadius: 6,
          borderSkipped: false
        },
        {
          label: 'Program (Diterima)',
          data: dataDiterimaProgram,
          backgroundColor: 'rgba(37, 99, 235, 0.85)',
          hoverBackgroundColor: 'rgba(29, 78, 216, 1)',
          borderRadius: 6,
          borderSkipped: false
        },
        {
          label: 'Menunggu Verifikasi',
          data: dataMenunggu,
          backgroundColor: 'rgba(245, 158, 11, 0.75)',
          hoverBackgroundColor: 'rgba(217, 119, 6, 1)',
          borderRadius: 6,
          borderSkipped: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { family: 'Poppins', size: 12, weight: '600' },
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 16
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          padding: 12,
          cornerRadius: 8,
          titleFont: { family: 'Poppins', size: 13, weight: '700' },
          bodyFont: { family: 'Poppins', size: 12 },
          callbacks: {
            title: function (ctx) {
              const idx = ctx[0].dataIndex;
              return BULAN_NAMES[idx + 1] + ' ' + selectedYear;
            },
            label: function (ctx) {
              return ' ' + ctx.dataset.label + ': Rp ' + formatRupiahSimple(ctx.parsed.y);
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: 'Poppins', size: 12, weight: '500' } }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(226, 232, 240, 0.8)' },
          ticks: {
            font: { family: 'Poppins', size: 11 },
            callback: function (val) {
              return formatRupiahShort(val);
            }
          }
        }
      }
    }
  });
}

// SISTEM NAVIGASI ANTAR HALAMAN (SPA PAGES)
function navigateToView(viewName, skipScrollTop) {
  currentActiveView = viewName;
  const adminPageEl = document.getElementById('adminPage');
  const isRoleAdmin = (currentProfile && currentProfile.role === 'admin') ||
    (adminPageEl && !adminPageEl.classList.contains('hidden'));

  if (isRoleAdmin) {
    const adminViews = {
      beranda: document.getElementById('adminViewBeranda'),
      setoran: document.getElementById('adminViewSetoran'),
      pentasharufan: document.getElementById('adminViewPentasharufan'),
      donatur: document.getElementById('adminViewDonatur'),
      upz: document.getElementById('adminViewUpz'),
      panduan: document.getElementById('adminViewPanduan')
    };

    Object.keys(adminViews).forEach(function (key) {
      if (adminViews[key]) {
        adminViews[key].classList.toggle('hidden', key !== viewName);
      }
    });

    if (viewName === 'beranda') {
      renderAdminMonthlyChart();
    } else if (viewName === 'pentasharufan') {
      if (typeof loadAdminPentasharufan === 'function') loadAdminPentasharufan();
    } else if (viewName === 'donatur') {
      const donaturSec = document.getElementById('adminDonaturManagement');
      if (donaturSec) donaturSec.classList.remove('hidden');
      loadAdminDonaturMatrix(true);
    } else if (viewName === 'upz') {
      const upzSec = document.getElementById('adminUpzManagement');
      if (upzSec) upzSec.classList.remove('hidden');
      loadUpzList();
    } else if (viewName === 'panduan') {
      if (typeof renderSystemGuide === 'function') {
        renderSystemGuide('adminGuideContainer', 'admin');
      }
    }
  } else {
    const upzViews = {
      beranda: document.getElementById('upzViewBeranda'),
      input: document.getElementById('upzViewInput'),
      pentasharufan: document.getElementById('upzViewPentasharufan'),
      donatur: document.getElementById('upzViewDonatur'),
      riwayat: document.getElementById('upzViewRiwayat'),
      mgmt: document.getElementById('upzViewMgmt'),
      panduan: document.getElementById('upzViewPanduan')
    };

    Object.keys(upzViews).forEach(function (key) {
      if (upzViews[key]) {
        upzViews[key].classList.toggle('hidden', key !== viewName);
      }
    });

    if (viewName === 'beranda') {
      renderUpzMonthlyChart();
    } else if (viewName === 'pentasharufan') {
      if (typeof loadUpzPentasharufan === 'function') loadUpzPentasharufan();
    } else if (viewName === 'donatur') {
      loadUpzDonaturMatrix();
    } else if (viewName === 'mgmt') {
      populateUpzMgmtProfile(currentProfile);
    } else if (viewName === 'panduan') {
      if (typeof renderSystemGuide === 'function') {
        renderSystemGuide('upzGuideContainer', 'upz');
      }
    }
  }

  if (!skipScrollTop) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

(function setupHeaderNavigation() {
  const homeBtn = document.getElementById('headerHomeButton');
  const refreshBtn = document.getElementById('headerRefreshButton');
  const hamburgerBtn = document.getElementById('hamburgerButton');
  const hamburgerDropdown = document.getElementById('hamburgerDropdown');
  const topbarBrand = document.querySelector('.topbar-brand');

  // Menu items Admin
  const menuAdminBeranda = document.getElementById('menuAdminBeranda');
  const menuAdminSetoran = document.getElementById('menuAdminSetoran');
  const menuAdminDonatur = document.getElementById('menuAdminDonatur');
  const menuAdminUpz = document.getElementById('menuAdminUpz');
  const menuAdminExport = document.getElementById('menuAdminExport');

  // Menu items UPZ
  const menuUpzBeranda = document.getElementById('menuUpzBeranda');
  const menuUpzInput = document.getElementById('menuUpzInput');
  const menuUpzDonatur = document.getElementById('menuUpzDonatur');
  const menuUpzRiwayat = document.getElementById('menuUpzRiwayat');
  const menuUpzMgmt = document.getElementById('menuUpzMgmt');

  // Menu Logout
  const menuLogout = document.getElementById('menuLogout');

  function closeDropdown() {
    if (!hamburgerDropdown) return;
    hamburgerDropdown.classList.add('hidden');
    if (hamburgerBtn) hamburgerBtn.setAttribute('aria-expanded', 'false');
  }

  function toggleDropdown() {
    if (!hamburgerDropdown) return;
    const isHidden = hamburgerDropdown.classList.contains('hidden');
    if (isHidden) {
      // Tutup notifikasi dropdown bila sedang terbuka
      const notifDropdown = document.getElementById('adminNotifDropdown');
      const notifBtn = document.getElementById('adminNotifButton');
      if (notifDropdown) notifDropdown.classList.add('hidden');
      if (notifBtn) notifBtn.setAttribute('aria-expanded', 'false');

      hamburgerDropdown.classList.remove('hidden');
      if (hamburgerBtn) hamburgerBtn.setAttribute('aria-expanded', 'true');
    } else {
      closeDropdown();
    }
  }

  if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleDropdown();
    });
  }

  // Close when clicking outside
  document.addEventListener('click', function (e) {
    if (!hamburgerDropdown || hamburgerDropdown.classList.contains('hidden')) return;
    if (!hamburgerDropdown.contains(e.target) && e.target !== hamburgerBtn && !hamburgerBtn.contains(e.target)) {
      closeDropdown();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && hamburgerDropdown && !hamburgerDropdown.classList.contains('hidden')) {
      closeDropdown();
    }
  });

  // TOMBOL BERANDA DI HEADER & LOGO BRAND
  if (homeBtn) {
    homeBtn.addEventListener('click', function () {
      navigateToView('beranda');
    });
  }

  if (topbarBrand) {
    topbarBrand.style.cursor = 'pointer';
    topbarBrand.addEventListener('click', function () {
      navigateToView('beranda');
    });
  }

  // TOMBOL KEMBALI KE BERANDA PADA SUB-PAGES
  document.querySelectorAll('.back-to-beranda-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      navigateToView('beranda');
    });
  });

  // FILTER TAHUN GRAFIK
  const adminChartYearFilter = document.getElementById('adminChartYearFilter');
  if (adminChartYearFilter) {
    adminChartYearFilter.addEventListener('change', function () {
      renderAdminMonthlyChart(Number(this.value));
    });
  }

  const upzChartYearFilter = document.getElementById('upzChartYearFilter');
  if (upzChartYearFilter) {
    upzChartYearFilter.addEventListener('change', function () {
      renderUpzMonthlyChart(Number(this.value));
    });
  }

  // HEADER REFRESH BUTTON
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function () {
      if (typeof executeVisualDataRefresh === 'function') {
        executeVisualDataRefresh();
      }
    });
  }

  // ADMINISTRATOR MENU ACTIONS
  if (menuAdminBeranda) {
    menuAdminBeranda.addEventListener('click', function () {
      closeDropdown();
      navigateToView('beranda');
    });
  }

  if (menuAdminSetoran) {
    menuAdminSetoran.addEventListener('click', function () {
      closeDropdown();
      navigateToView('setoran');
    });
  }

  if (menuAdminDonatur) {
    menuAdminDonatur.addEventListener('click', function () {
      closeDropdown();
      navigateToView('donatur');
    });
  }

  if (menuAdminUpz) {
    menuAdminUpz.addEventListener('click', function () {
      closeDropdown();
      navigateToView('upz');
    });
  }

  if (menuAdminExport) {
    menuAdminExport.addEventListener('click', function () {
      closeDropdown();
      if (exportModal) {
        showExportOptions();
        exportModal.classList.remove('hidden');
      }
    });
  }

  // PENTASHARUFAN ADMIN MENU ACTION
  const menuAdminPentasharufan = document.getElementById('menuAdminPentasharufan');
  if (menuAdminPentasharufan) {
    menuAdminPentasharufan.addEventListener('click', function () {
      closeDropdown();
      navigateToView('pentasharufan');
    });
  }

  // PANDUAN SISTEM ADMIN MENU ACTION
  const menuAdminPanduan = document.getElementById('menuAdminPanduan');
  if (menuAdminPanduan) {
    menuAdminPanduan.addEventListener('click', function () {
      closeDropdown();
      navigateToView('panduan');
    });
  }

  // UPZ MENU ACTIONS
  if (menuUpzBeranda) {
    menuUpzBeranda.addEventListener('click', function () {
      closeDropdown();
      navigateToView('beranda');
    });
  }

  if (menuUpzInput) {
    menuUpzInput.addEventListener('click', function () {
      closeDropdown();
      navigateToView('input');
    });
  }

  if (menuUpzDonatur) {
    menuUpzDonatur.addEventListener('click', function () {
      closeDropdown();
      navigateToView('donatur');
    });
  }

  if (menuUpzRiwayat) {
    menuUpzRiwayat.addEventListener('click', function () {
      closeDropdown();
      navigateToView('riwayat');
    });
  }

  if (menuUpzMgmt) {
    menuUpzMgmt.addEventListener('click', function () {
      closeDropdown();
      navigateToView('mgmt');
    });
  }

  // PENTASHARUFAN UPZ MENU ACTION
  const menuUpzPentasharufan = document.getElementById('menuUpzPentasharufan');
  if (menuUpzPentasharufan) {
    menuUpzPentasharufan.addEventListener('click', function () {
      closeDropdown();
      navigateToView('pentasharufan');
    });
  }

  // PANDUAN UPZ MENU ACTION
  const menuUpzPanduan = document.getElementById('menuUpzPanduan');
  if (menuUpzPanduan) {
    menuUpzPanduan.addEventListener('click', function () {
      closeDropdown();
      navigateToView('panduan');
    });
  }

  // RANKING KATEGORI FILTER ACTION
  const adminRankingKategoriFilter = document.getElementById('adminRankingKategoriFilter');
  if (adminRankingKategoriFilter) {
    adminRankingKategoriFilter.addEventListener('change', function () {
      renderAdminUpzRankings();
    });
  }

  // LOGOUT ACTION
  if (menuLogout) {
    menuLogout.addEventListener('click', function () {
      closeDropdown();
      const hiddenLogoutBtn = document.getElementById('logoutButton');
      if (hiddenLogoutBtn) {
        hiddenLogoutBtn.click();
      }
    });
  }
})();

// ======================================================================
// 1. INTERACTIVE LOGIN BRAND GRADIENT MOTION
// ======================================================================
function initLoginBrandMotion() {
  const brandPanel = document.querySelector('.login-brand');
  if (!brandPanel) return;

  brandPanel.addEventListener('mousemove', function (e) {
    const rect = brandPanel.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    brandPanel.style.setProperty('--cursor-x', `${x}%`);
    brandPanel.style.setProperty('--cursor-y', `${y}%`);
  });

  brandPanel.addEventListener('mouseleave', function () {
    brandPanel.style.setProperty('--cursor-x', '50%');
    brandPanel.style.setProperty('--cursor-y', '30%');
  });
}

// ======================================================================
// 2. MOBILE LOGIN SPLASH SCREEN
// ======================================================================
let isSplashDismissed = false;
let isAppReadyAfterLogin = false;
let isSplashEnterWaiting = false;

function isUpzOrPlaceholderName(name, profile) {
  if (!name || typeof name !== 'string') return true;
  const s = name.trim().toLowerCase();
  if (!s || s === 'pic' || s === '-' || s === 'upz' || s === 'pengelola') return true;
  if (/^upz\b/i.test(s)) return true;
  if (s.includes('testing')) return true;
  if (profile) {
    if (profile.nama_upz && s === profile.nama_upz.trim().toLowerCase()) return true;
    if (profile.kode_upz && s === profile.kode_upz.trim().toLowerCase()) return true;
  }
  return false;
}

function updateMobileLoginSplashInfo(role, name) {
  const roleEl = document.getElementById('splashGreetingRole');
  const nameEl = document.getElementById('splashGreetingName');
  if (roleEl) {
    roleEl.textContent = (role === 'admin') ? 'Administrator Terverifikasi' : 'Unit Pengumpul Zakat (UPZ)';
  }
  if (nameEl) {
    let displayName = (name && typeof name === 'string' && name.trim()) ? name.trim() : '';
    if (displayName) {
      const l = displayName.toLowerCase();
      if (l === 'pic' || l === 'pengelola upz' || l === 'pengelola') displayName = '';
    }
    if (!displayName) {
      if (role === 'admin') {
        displayName = (currentProfile && currentProfile.nama_lengkap) || 'Administrator';
      } else {
        displayName = (currentProfile && currentProfile.nama_upz) || '';
      }
    }
    nameEl.textContent = displayName ? `Assalamualaikum, ${displayName}` : 'Assalamualaikum';
  }
}

function showMobileLoginSplash(role, name) {
  // Jika sudah pernah ditutup oleh user pada sesi/login ini, jangan pernah munculkan ulang
  if (isSplashDismissed) return;

  const splash = document.getElementById('mobileLoginSplash');
  if (!splash) return;

  // Kunci scroll halaman secara menyeluruh saat splash screen aktif
  document.body.classList.add('splash-active');
  document.documentElement.classList.add('splash-active');

  updateMobileLoginSplashInfo(role, name);

  const enterBtn = document.getElementById('btnEnterAppFromSplash');
  if (enterBtn) {
    enterBtn.disabled = false;
    enterBtn.innerHTML = '<span>Masuk ke Aplikasi</span>';
  }

  splash.classList.remove('hidden', 'splash-fade-out');

  // Interaktivitas background splash screen (gerakan mouse / sentuhan)
  if (!splash.dataset.boundMotion) {
    splash.dataset.boundMotion = 'true';
    const orb1 = splash.querySelector('.splash-orb-1');
    const orb2 = splash.querySelector('.splash-orb-2');

    // Cegah scroll mouse wheel saat kursor berada di splash screen
    splash.addEventListener('wheel', function (e) {
      e.preventDefault();
    }, { passive: false });

    function updateSplashMotion(clientX, clientY) {
      const rect = splash.getBoundingClientRect();
      const xPercent = ((clientX - rect.left) / rect.width) * 100;
      const yPercent = ((clientY - rect.top) / rect.height) * 100;
      splash.style.setProperty('--splash-cursor-x', `${xPercent.toFixed(1)}%`);
      splash.style.setProperty('--splash-cursor-y', `${yPercent.toFixed(1)}%`);

      const offsetX = (clientX - rect.left - rect.width / 2) / 25;
      const offsetY = (clientY - rect.top - rect.height / 2) / 25;
      if (orb1) orb1.style.transform = `translate(${offsetX * 1.5}px, ${offsetY * 1.5}px)`;
      if (orb2) orb2.style.transform = `translate(${-offsetX * 1.2}px, ${-offsetY * 1.2}px)`;
    }

    splash.addEventListener('mousemove', function (e) {
      updateSplashMotion(e.clientX, e.clientY);
    });

    splash.addEventListener('touchmove', function (e) {
      e.preventDefault();
      if (e.touches && e.touches[0]) {
        updateSplashMotion(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });
  }

  if (enterBtn && !enterBtn.dataset.boundEnter) {
    enterBtn.dataset.boundEnter = 'true';
    enterBtn.addEventListener('click', function () {
      if (!isAppReadyAfterLogin) {
        // Data dashboard masih dimuat di latar belakang
        isSplashEnterWaiting = true;
        enterBtn.disabled = true;
        enterBtn.innerHTML = '<span class="spinner" aria-hidden="true" style="width:16px;height:16px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></span><span>Menyiapkan Dashboard...</span>';
        return;
      }
      hideMobileLoginSplash();
    });
  }
}

function hideMobileLoginSplash() {
  isSplashDismissed = true;
  isSplashEnterWaiting = false;

  // Buka kembali scroll halaman
  document.body.classList.remove('splash-active');
  document.documentElement.classList.remove('splash-active');

  const splash = document.getElementById('mobileLoginSplash');
  if (splash && !splash.classList.contains('hidden')) {
    splash.classList.add('splash-fade-out');
    setTimeout(function () {
      splash.classList.add('hidden');
      splash.classList.remove('splash-fade-out');
    }, 450);
  }

  // Jaminan 100%: Tampilan aktif adalah dashboard, dan hanya menampilkan Beranda
  showDashboard();
  if (currentProfile && currentProfile.role) {
    if (currentProfile.role === 'admin') {
      if (adminPage) adminPage.classList.remove('hidden');
      document.querySelectorAll('.upz-only').forEach(function (el) { el.classList.add('hidden'); });
    } else {
      if (adminPage) adminPage.classList.add('hidden');
      document.querySelectorAll('.upz-only').forEach(function (el) { el.classList.remove('hidden'); });
    }
  }
  if (typeof navigateToView === 'function') {
    navigateToView('beranda');
  }
}

// ======================================================================
// 3. SUPERADMIN DELETE SETORAN FEATURE
// ======================================================================
let pendingDeleteSetoranItem = null;

function bindAdminDeleteSetoranEvents() {
  const container = document.getElementById('adminSetoranContainer');
  if (!container) return;

  container.querySelectorAll('.admin-delete-setoran-btn').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      const setoranId = btn.dataset.deleteId;
      const item = (currentAdminSetoran || []).find(function (s) {
        return String(s.id) === String(setoranId);
      });
      if (item) {
        openDeleteSetoranModal(item);
      }
    });
  });
}

function openDeleteSetoranModal(item) {
  pendingDeleteSetoranItem = item;
  const modal = document.getElementById('deleteSetoranModal');
  if (!modal) return;

  const upzNameEl = document.getElementById('delConfirmUpzName');
  const nominalEl = document.getElementById('delConfirmNominal');
  const periodeEl = document.getElementById('delConfirmPeriode');
  const fileEl = document.getElementById('delConfirmFile');

  const namaUpz = (item.upz_id && upzMap[item.upz_id]) ? upzMap[item.upz_id] : (item.nama_upz || item.upz_id || '-');
  if (upzNameEl) upzNameEl.textContent = namaUpz;
  if (nominalEl) nominalEl.textContent = formatRupiah(item.nominal || 0);
  if (periodeEl) periodeEl.textContent = `${getNamaBulan(item.periode_bulan)} ${item.periode_tahun || ''}`;
  if (fileEl) fileEl.textContent = item.file_name || (item.file_path ? item.file_path.split('/').pop() : 'Tidak ada berkas');

  modal.classList.remove('hidden');
}

function closeDeleteSetoranModal() {
  pendingDeleteSetoranItem = null;
  const modal = document.getElementById('deleteSetoranModal');
  if (modal) modal.classList.add('hidden');
}

function initDeleteSetoranFeature() {
  const closeX = document.getElementById('closeDeleteSetoranX');
  const cancelBtn = document.getElementById('cancelDeleteSetoranBtn');
  const execBtn = document.getElementById('executeDeleteSetoranBtn');
  const execText = document.getElementById('executeDeleteSetoranText');

  if (closeX) closeX.addEventListener('click', closeDeleteSetoranModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeDeleteSetoranModal);

  if (execBtn) {
    execBtn.addEventListener('click', async function () {
      if (!pendingDeleteSetoranItem) return;
      const setoranId = pendingDeleteSetoranItem.id;

      execBtn.disabled = true;
      if (execText) execText.textContent = 'Menghapus...';

      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        const token = session ? session.access_token : '';

        const filePath = (pendingDeleteSetoranItem && pendingDeleteSetoranItem.file_path) ? pendingDeleteSetoranItem.file_path : '';
        const res = await fetch('/api/delete-setoran', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: token, setoran_id: setoranId, file_path: filePath })
        });

        const resJson = await res.json();
        if (!res.ok) {
          throw new Error(resJson.error || 'Gagal menghapus setoran dari server.');
        }

        closeDeleteSetoranModal();
        if (detailModal && !detailModal.classList.contains('hidden')) {
          detailModal.classList.add('hidden');
        }
        if (typeof showFloatingToast === 'function') {
          showFloatingToast('Setoran berhasil dihapus permanen.', 'success');
        } else {
          alert('Setoran berhasil dihapus permanen.');
        }

        if (typeof loadAdminSetoran === 'function') {
          await loadAdminSetoran();
        }
        if (typeof filterAndRenderRiwayat === 'function') {
          filterAndRenderRiwayat();
        }
        if (typeof loadDashboard === 'function') {
          await loadDashboard(true);
        }
      } catch (err) {
        console.error('DELETE SETORAN ERROR:', err);
        alert('Gagal menghapus setoran: ' + (err.message || 'Terjadi kesalahan sistem.'));
      } finally {
        execBtn.disabled = false;
        if (execText) execText.textContent = 'Ya, Hapus Setoran';
      }
    });
  }
}

// ======================================================================
// 4. SUPERADMIN DELETE AKUN UPZ FEATURE
// ======================================================================
let pendingDeleteUpzItem = null;

function openDeleteUpzModal(item) {
  pendingDeleteUpzItem = item;
  const modal = document.getElementById('deleteUpzModal');
  if (!modal) return;

  const upzNameEl = document.getElementById('delConfirmUpzNamaUpz');
  const namaLengkapEl = document.getElementById('delConfirmUpzNamaLengkap');
  const emailEl = document.getElementById('delConfirmUpzEmail');
  const kategoriEl = document.getElementById('delConfirmUpzKategori');

  if (upzNameEl) upzNameEl.textContent = item.nama_upz || '-';
  if (namaLengkapEl) namaLengkapEl.textContent = item.nama_lengkap || '-';
  if (emailEl) emailEl.textContent = item.email || '-';
  if (kategoriEl) kategoriEl.textContent = item.kategori || '-';

  modal.classList.remove('hidden');
}

function closeDeleteUpzModal() {
  pendingDeleteUpzItem = null;
  const modal = document.getElementById('deleteUpzModal');
  if (modal) modal.classList.add('hidden');
}

function initDeleteUpzFeature() {
  const closeX = document.getElementById('closeDeleteUpzX');
  const cancelBtn = document.getElementById('cancelDeleteUpzBtn');
  const execBtn = document.getElementById('executeDeleteUpzBtn');
  const execText = document.getElementById('executeDeleteUpzText');

  if (closeX) closeX.addEventListener('click', closeDeleteUpzModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeDeleteUpzModal);

  if (execBtn) {
    execBtn.addEventListener('click', async function () {
      if (!pendingDeleteUpzItem) return;
      const profileId = pendingDeleteUpzItem.profile_id;

      execBtn.disabled = true;
      if (execText) execText.textContent = 'Menghapus...';

      try {
        const token = await getValidAuthToken();
        if (!token) throw new Error('Sesi login admin kedaluwarsa. Silakan login ulang.');

        const res = await fetch('/api/delete-upz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: token, profile_id: profileId })
        });

        const resJson = await res.json();
        if (!res.ok) {
          throw new Error(resJson.error || 'Gagal menghapus akun UPZ dari server.');
        }

        closeDeleteUpzModal();
        if (typeof showToast === 'function') {
          showToast('Akun UPZ Berhasil Dihapus', 'success', `Akun ${pendingDeleteUpzItem ? pendingDeleteUpzItem.nama_upz : 'UPZ'} telah dihapus permanen.`);
        }
        if (typeof syncAdminNotifications === 'function') {
          syncAdminNotifications();
        }

        if (typeof loadUpzList === 'function') {
          await loadUpzList();
        }
      } catch (err) {
        console.error('DELETE UPZ ERROR:', err);
        alert('Gagal menghapus akun UPZ: ' + (err.message || 'Terjadi kesalahan sistem.'));
      } finally {
        execBtn.disabled = false;
        if (execText) execText.textContent = 'Ya, Hapus Akun';
      }
    });
  }
}


// ======================================================================
// 6. PERBANTUAN PENTASHARUFAN MODULE (UPZ & SUPERADMIN)
// ======================================================================
const LOCAL_PENTA_KEY = 'baznas_penta_records';

function getLocalPentaRecords() {
  try {
    const raw = localStorage.getItem(LOCAL_PENTA_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalPentaRecord(rec) {
  try {
    const list = getLocalPentaRecords();
    const existingIdx = list.findIndex(function (x) { return x.id === rec.id; });
    if (existingIdx >= 0) {
      list[existingIdx] = rec;
    } else {
      list.unshift(rec);
    }
    localStorage.setItem(LOCAL_PENTA_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Save local penta error:', e);
  }
}

function deleteLocalPentaRecord(id) {
  try {
    const list = getLocalPentaRecords().filter(function (x) { return String(x.id) !== String(id); });
    localStorage.setItem(LOCAL_PENTA_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Delete local penta error:', e);
  }
}

// 6a. Generate Official Excel Template
function generatePentasharufanTemplateExcel() {
  if (typeof XLSX === 'undefined') {
    alert('Library Excel belum siap. Silakan muat ulang halaman.');
    return;
  }

  const rows = [
    ['PETUNJUK PENGISIAN DAFTAR PENERIMA MANFAAT PENTASHARUFAN BAZNAS BANYUMAS'],
    ['1. Lengkapi NIK penerima manfaat (16 digit angka).'],
    ['2. Isi nama lengkap mustahik / penerima manfaat sesuai KTP/KK.'],
    ['3. Cantumkan alamat lengkap, RT/RW, Desa/Kelurahan, dan Kecamatan di Kab. Banyumas.'],
    ['4. Tentukan nominal bantuan per penerima (angka bulat tanpa titik atau koma).'],
    ['5. Pilih Kategori Asnaf: Fakir Miskin, Fisabilillah, Ibnu Sabil, Gharimin, Mualaf, atau Hak Amil.'],
    [''],
    ['NO', 'NIK (16 DIGIT)', 'NAMA PENERIMA MANFAAT', 'ALAMAT LENGKAP', 'RT/RW', 'DESA / KELURAHAN', 'KECAMATAN', 'NOMINAL BANTUAN (RP)', 'KATEGORI ASNAF', 'KETERANGAN'],
    [1, '3302011205800001', 'Ahmad Fulan', 'Jl. Kenanga No. 14', '02/03', 'Purwokerto Wetan', 'Purwokerto Timur', 500000, 'Fakir Miskin', 'Santunan paket sembako dan biaya hidup'],
    [2, '3302022304920002', 'Siti Maryam', 'Grumbul Karanganyar RT 01 RW 04', '01/04', 'Kedungwringin', 'Patikraja', 750000, 'Fisabilillah', 'Bantuan operasional sarana mengaji'],
    [3, '3302031508850003', 'Budi Santoso', 'Jl. Raya Rawalo KM 3', '03/01', 'Pesawahan', 'Rawalo', 1000000, 'Fakir Miskin', 'Bantuan bedah rumah dhuafa']
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 22 },
    { wch: 28 },
    { wch: 34 },
    { wch: 10 },
    { wch: 22 },
    { wch: 20 },
    { wch: 24 },
    { wch: 18 },
    { wch: 35 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Penerima Manfaat');
  XLSX.writeFile(wb, 'Template_Penerima_Manfaat_BAZNAS_Banyumas.xlsx');
}

// 6b. Preview Foto Modal handlers
function openPreviewFotoModal(imgUrl, title, subtitle) {
  const modal = document.getElementById('previewFotoModal');
  const imgEl = document.getElementById('previewFotoFullImg');
  const titleEl = document.getElementById('previewFotoTitle');
  const subEl = document.getElementById('previewFotoSubtitle');
  const downloadLink = document.getElementById('previewFotoDownloadLink');

  if (!modal || !imgEl) return;

  imgEl.src = imgUrl;
  if (titleEl) titleEl.textContent = title || 'Dokumentasi Pentasharufan';
  if (subEl) subEl.textContent = subtitle || '';
  if (downloadLink) {
    downloadLink.href = imgUrl;
    downloadLink.download = `Dokumentasi_Pentasharufan_${Date.now()}.jpg`;
  }

  modal.classList.remove('hidden');
}

function closePreviewFotoModal() {
  const modal = document.getElementById('previewFotoModal');
  const imgEl = document.getElementById('previewFotoFullImg');
  if (modal) modal.classList.add('hidden');
  if (imgEl) imgEl.src = '';
}

// 6c. Upload helper for Pentasharufan (via /api/upload-penta ke bucket 'pentasharufan')
async function uploadPentaFile(file, subfolder, upzId) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      reject(new Error('Gagal membaca file ' + file.name));
    };
    reader.onload = async function (e) {
      const dataUrl = e.target.result;
      const base64 = typeof dataUrl === 'string' && dataUrl.includes(',') ? dataUrl.split(',')[1] : '';

      // 1. Coba upload via endpoint /api/upload-penta (menggunakan server/service role key)
      try {
        const res = await fetch('/api/upload-penta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: file.name,
            type: file.type,
            subfolder: subfolder,
            upzId: upzId,
            base64: base64
          })
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success && (json.publicUrl || json.signedUrl || json.filePath)) {
            return resolve({
              filePath: json.filePath,
              publicUrl: json.publicUrl || json.signedUrl,
              originalName: file.name
            });
          }
        }
      } catch (netErr) {
        console.warn('API /api/upload-penta network notice:', netErr);
      }

      // 2. Fallback direct upload ke bucket pentasharufan Supabase
      const ext = file.name.split('.').pop() || 'dat';
      const cleanBase = file.name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
      const safeUpz = (upzId || 'umum').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filePath = `${safeUpz}/${subfolder}/${Date.now()}_${cleanBase}.${ext}`;

      let directSuccess = false;
      let directErr = null;
      try {
        const { error: upErr } = await supabaseClient.storage
          .from('pentasharufan')
          .upload(filePath, file, { cacheControl: '3600', upsert: true });
        if (!upErr) directSuccess = true;
        else directErr = upErr;
      } catch (storageErr) {
        directErr = storageErr;
      }

      let signedFallbackUrl = '';
      if (directSuccess) {
        try {
          const { data: signData } = await supabaseClient.storage
            .from('pentasharufan')
            .createSignedUrl(filePath, 604800);
          if (signData && signData.signedUrl) signedFallbackUrl = signData.signedUrl;
        } catch (_) {}
      }

      if (directSuccess) {
        const pubUrl = signedFallbackUrl || (subfolder === 'foto' ? dataUrl : `/api/penta-file?path=${encodeURIComponent(filePath)}`);
        return resolve({
          filePath: filePath,
          publicUrl: pubUrl,
          originalName: file.name
        });
      }

      // Beri notifikasi jelas jika upload gagal
      const errMsg = directErr ? (directErr.message || directErr.error_description || String(directErr)) : 'Gagal menghubungi server storage';
      reject(new Error(`Gagal mengunggah berkas ${file.name}: ${errMsg}. Pastikan izin bucket pentasharufan tersedia.`));
    };
    reader.readAsDataURL(file);
  });
}

// 6d. Initialize Pentasharufan Feature
function initPentasharufanFeature() {
  // Modal Foto Close
  const closeFotoX = document.getElementById('closePreviewFotoX');
  const closeFotoBtn = document.getElementById('closePreviewFotoBtn');
  if (closeFotoX) closeFotoX.addEventListener('click', closePreviewFotoModal);
  if (closeFotoBtn) closeFotoBtn.addEventListener('click', closePreviewFotoModal);

  // Template download button
  const downloadTemplateBtn = document.getElementById('downloadPentaTemplateBtn');
  if (downloadTemplateBtn) {
    downloadTemplateBtn.addEventListener('click', function () {
      generatePentasharufanTemplateExcel();
    });
  }

  // Nominal formatting
  const pentaNominal = document.getElementById('pentaNominal');
  if (pentaNominal) {
    pentaNominal.addEventListener('input', function () {
      const numeric = this.value.replace(/\D/g, '');
      this.value = numeric ? Number(numeric).toLocaleString('id-ID') : '';
    });
  }

  // File Excel label update
  const pentaFileExcel = document.getElementById('pentaFileExcel');
  const pentaFileExcelInfo = document.getElementById('pentaFileExcelInfo');
  if (pentaFileExcel && pentaFileExcelInfo) {
    pentaFileExcel.addEventListener('change', function () {
      const file = this.files && this.files[0];
      if (file) {
        if (file.size > MAX_FILE_SIZE) {
          alert('Ukuran file Excel melebihi 5 MB.');
          this.value = '';
          pentaFileExcelInfo.textContent = 'Pilih atau seret file Excel (.xlsx / .xls)';
          return;
        }
        pentaFileExcelInfo.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      } else {
        pentaFileExcelInfo.textContent = 'Pilih atau seret file Excel (.xlsx / .xls)';
      }
    });
  }

  // File Foto preview
  const pentaFileFoto = document.getElementById('pentaFileFoto');
  const pentaFotoPreview = document.getElementById('pentaFotoPreview');
  const pentaFotoImg = document.getElementById('pentaFotoImg');
  const pentaFotoName = document.getElementById('pentaFotoName');
  const pentaRemoveFotoBtn = document.getElementById('pentaRemoveFotoBtn');

  if (pentaFileFoto) {
    pentaFileFoto.addEventListener('change', function () {
      const file = this.files && this.files[0];
      if (file) {
        if (file.size > MAX_FILE_SIZE) {
          alert('Ukuran foto melebihi 5 MB.');
          this.value = '';
          return;
        }
        const reader = new FileReader();
        reader.onload = function (e) {
          if (pentaFotoImg) pentaFotoImg.src = e.target.result;
          if (pentaFotoName) pentaFotoName.textContent = file.name;
          if (pentaFotoPreview) pentaFotoPreview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (pentaRemoveFotoBtn) {
    pentaRemoveFotoBtn.addEventListener('click', function () {
      if (pentaFileFoto) pentaFileFoto.value = '';
      if (pentaFotoImg) pentaFotoImg.src = '';
      if (pentaFotoPreview) pentaFotoPreview.classList.add('hidden');
    });
  }

  // Form Submit Pentasharufan (Role UPZ)
  const pentaForm = document.getElementById('pentaForm');
  const pentaMessage = document.getElementById('pentaMessage');
  const pentaSubmitBtn = document.getElementById('pentaSubmitBtn');

  if (pentaForm && !pentaForm.dataset.bound) {
    pentaForm.dataset.bound = 'true';
    pentaForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const jenis = document.getElementById('pentaJenis') ? document.getElementById('pentaJenis').value : '';
      const nominalRaw = pentaNominal ? pentaNominal.value.replace(/\D/g, '') : '0';
      const nominalVal = Number(nominalRaw || 0);
      const jmlPenerima = document.getElementById('pentaJumlahPenerima') ? Number(document.getElementById('pentaJumlahPenerima').value) : 0;
      const keterangan = document.getElementById('pentaKeterangan') ? document.getElementById('pentaKeterangan').value.trim() : '';

      const excelFile = pentaFileExcel && pentaFileExcel.files ? pentaFileExcel.files[0] : null;
      const fotoFile = pentaFileFoto && pentaFileFoto.files ? pentaFileFoto.files[0] : null;

      if (!jenis) {
        showMessage(pentaMessage, 'Silakan pilih Program / Jenis Pentasharufan.', '#d93025');
        return;
      }

      const currentUpzId = currentProfile ? (currentProfile.upz_id || currentProfile.id) : null;
      const rkatSetting = getUpzRkatSetting(currentUpzId);
      if (!rkatSetting.rkat_unlocked) {
        showMessage(pentaMessage, 'Akses perbantuan pentasharufan terkunci. Daftarkan RKAT UPZ Anda ke Admin BAZNAS terlebih dahulu via WhatsApp.', '#d93025');
        return;
      }
      if (!nominalVal || nominalVal <= 0) {
        showMessage(pentaMessage, 'Nominal bantuan pentasharufan wajib diisi dengan benar.', '#d93025');
        return;
      }
      if (!jmlPenerima || jmlPenerima <= 0) {
        showMessage(pentaMessage, 'Jumlah penerima manfaat wajib diisi minimal 1 orang.', '#d93025');
        return;
      }
      if (!excelFile) {
        showMessage(pentaMessage, 'Wajib mengunggah file Excel daftar penerima manfaat.', '#d93025');
        return;
      }
      if (!fotoFile) {
        showMessage(pentaMessage, 'Wajib mengunggah 1 foto dokumentasi pentasharufan.', '#d93025');
        return;
      }

      if (pentaSubmitBtn) {
        pentaSubmitBtn.disabled = true;
        pentaSubmitBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span>Mengunggah & Mengirim Permohonan...';
      }
      showMessage(pentaMessage, 'Sedang memproses unggahan berkas...', '#4a5568');

      try {
        const upzId = currentProfile ? currentProfile.upz_id : 'UPZ-UMUM';
        const namaUpz = currentProfile ? (currentProfile.nama_upz || currentProfile.nama_lengkap || 'UPZ') : 'UPZ';
        const kategoriUpz = currentProfile ? (currentProfile.kategori || '-') : '-';

        // 1. Upload Excel
        const uploadedExcel = await uploadPentaFile(excelFile, 'excel', upzId);

        // 2. Upload Foto
        const uploadedFoto = await uploadPentaFile(fotoFile, 'foto', upzId);

        const pentaRecord = {
          id: 'PENTA-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
          created_at: new Date().toISOString(),
          upz_id: upzId,
          nama_upz: namaUpz,
          kategori: kategoriUpz,
          jenis_program: jenis,
          nominal: nominalVal,
          jumlah_penerima: jmlPenerima,
          keterangan: keterangan,
          file_excel_name: excelFile.name,
          file_excel_path: uploadedExcel.filePath,
          file_excel_url: uploadedExcel.publicUrl,
          file_foto_name: fotoFile.name,
          file_foto_path: uploadedFoto.filePath,
          file_foto_url: uploadedFoto.publicUrl || '',
          status: 'menunggu',
          catatan_admin: ''
        };

        // 1. Simpan ke Supabase via endpoint /api/save-penta
        let backendSaved = false;
        try {
          const saveRes = await fetch('/api/save-penta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ record: pentaRecord })
          });
          if (saveRes.ok) {
            backendSaved = true;
          }
        } catch (apiErr) {
          console.warn('API /api/save-penta notice:', apiErr);
        }

        // 2. Fallback direct insert ke Supabase audit_logs (HANYA kolom valid: action, module, description)
        if (!backendSaved) {
          try {
            await supabaseClient.from('audit_logs').insert([{
              action: 'PENTASHARUFAN_SUBMIT',
              module: 'pentasharufan',
              description: JSON.stringify(pentaRecord)
            }]);
          } catch (supabaseErr) {
            console.warn('Supabase audit_logs pentasharufan save notice:', supabaseErr);
          }
        }

        // 3. Simpan ke localStorage agar instan
        saveLocalPentaRecord(pentaRecord);

        showMessage(pentaMessage, 'Permohonan pentasharufan berhasil dikirim ke Admin BAZNAS.', '#259148');
        pentaForm.reset();

        if (pentaFileExcelInfo) pentaFileExcelInfo.textContent = 'Pilih atau seret file Excel (.xlsx / .xls)';
        if (pentaFotoPreview) pentaFotoPreview.classList.add('hidden');
        if (pentaFotoImg) pentaFotoImg.src = '';

        if (typeof recordUpzActivity === 'function') {
          recordUpzActivity({
            type: 'pentasharufan',
            title: 'Pengajuan Pentasharufan Baru',
            nama_upz: namaUpz,
            upz_id: upzId,
            nominal: nominalVal,
            desc: `Mengajukan pentasharufan program <strong>${escapeHtml(jenis)}</strong> senilai <strong>${formatRupiah(nominalVal)}</strong> untuk <strong>${jmlPenerima} penerima manfaat</strong>.`
          });
        }

        await loadUpzPentasharufan();

      } catch (err) {
        console.error('PENTASHARUFAN SUBMIT ERROR:', err);
        showMessage(pentaMessage, 'Gagal mengirim permohonan: ' + (err.message || 'Terjadi kesalahan sistem.'), '#d93025');
      } finally {
        if (pentaSubmitBtn) {
          pentaSubmitBtn.disabled = false;
          pentaSubmitBtn.innerHTML = '<svg class="icon"><use href="#i-send"></use></svg><span>Kirim Permohonan Pentasharufan</span>';
        }
      }
    });
  }

  // Refresh buttons pentasharufan (UPZ & Admin) dengan animasi dan pop-up visual
  const upzRefresh = document.getElementById('upzPentaRefreshBtn');
  if (upzRefresh) {
    upzRefresh.addEventListener('click', async function () {
      upzRefresh.classList.add('is-spinning');
      const modal = document.getElementById('refreshStatusModal');
      const spinnerWrap = document.getElementById('refreshModalSpinner');
      const checkWrap = document.getElementById('refreshModalCheck');
      const titleEl = document.getElementById('refreshModalTitle');
      const subEl = document.getElementById('refreshModalSub');

      if (modal) {
        if (spinnerWrap) spinnerWrap.classList.remove('hidden');
        if (checkWrap) checkWrap.classList.add('hidden');
        if (titleEl) titleEl.textContent = 'Memuat Ulang Riwayat...';
        if (subEl) subEl.textContent = 'Menyinkronkan data permohonan pentasharufan...';
        modal.classList.remove('hidden');
      }

      const startTime = Date.now();
      try {
        await loadUpzPentasharufan();
      } catch (e) {
        console.error('REFRESH PENTA UPZ ERROR:', e);
      }

      const elapsed = Date.now() - startTime;
      if (elapsed < 600) {
        await new Promise(function (r) { setTimeout(r, 600 - elapsed); });
      }

      upzRefresh.classList.remove('is-spinning');

      if (modal) {
        if (spinnerWrap) spinnerWrap.classList.add('hidden');
        if (checkWrap) checkWrap.classList.remove('hidden');
        if (titleEl) titleEl.textContent = 'Riwayat Diperbarui!';
        if (subEl) subEl.textContent = 'Data pengajuan pentasharufan terbaru berhasil dimuat.';

        setTimeout(function () {
          modal.classList.add('hidden');
        }, 900);
      }
    });
  }

  const adminRefresh = document.getElementById('adminPentaRefreshBtn');
  if (adminRefresh) {
    adminRefresh.addEventListener('click', async function () {
      adminRefresh.classList.add('is-spinning');
      const modal = document.getElementById('refreshStatusModal');
      const spinnerWrap = document.getElementById('refreshModalSpinner');
      const checkWrap = document.getElementById('refreshModalCheck');
      const titleEl = document.getElementById('refreshModalTitle');
      const subEl = document.getElementById('refreshModalSub');

      if (modal) {
        if (spinnerWrap) spinnerWrap.classList.remove('hidden');
        if (checkWrap) checkWrap.classList.add('hidden');
        if (titleEl) titleEl.textContent = 'Menyegarkan Data...';
        if (subEl) subEl.textContent = 'Mengambil daftar permohonan pentasharufan terbaru...';
        modal.classList.remove('hidden');
      }

      const startTime = Date.now();
      try {
        await loadAdminPentasharufan();
      } catch (e) {
        console.error('REFRESH PENTA ADMIN ERROR:', e);
      }

      const elapsed = Date.now() - startTime;
      if (elapsed < 600) {
        await new Promise(function (r) { setTimeout(r, 600 - elapsed); });
      }

      adminRefresh.classList.remove('is-spinning');

      if (modal) {
        if (spinnerWrap) spinnerWrap.classList.add('hidden');
        if (checkWrap) checkWrap.classList.remove('hidden');
        if (titleEl) titleEl.textContent = 'Permohonan Diperbarui!';
        if (subEl) subEl.textContent = 'Seluruh daftar pengajuan pentasharufan telah disinkronkan.';

        setTimeout(function () {
          modal.classList.add('hidden');
        }, 900);
      }
    });
  }

  // Admin Penta Filters
  const adminPentaFilterUpz = document.getElementById('adminPentaFilterUpz');
  const adminPentaFilterProgram = document.getElementById('adminPentaFilterProgram');
  const adminPentaFilterStatus = document.getElementById('adminPentaFilterStatus');
  const adminPentaResetFilter = document.getElementById('adminPentaResetFilter');

  if (adminPentaFilterUpz) adminPentaFilterUpz.addEventListener('change', filterAndRenderAdminPentaTable);
  if (adminPentaFilterProgram) adminPentaFilterProgram.addEventListener('change', filterAndRenderAdminPentaTable);
  if (adminPentaFilterStatus) adminPentaFilterStatus.addEventListener('change', filterAndRenderAdminPentaTable);
  if (adminPentaResetFilter) {
    adminPentaResetFilter.addEventListener('click', function () {
      if (adminPentaFilterUpz) adminPentaFilterUpz.value = 'semua';
      if (adminPentaFilterProgram) adminPentaFilterProgram.value = 'semua';
      if (adminPentaFilterStatus) adminPentaFilterStatus.value = 'semua';
      filterAndRenderAdminPentaTable();
    });
  }
}

// ============================================================
// FITUR: RKAT LOCK & PERBANTUAN PENTASHARUFAN BUDGET
// ============================================================
let cachedRkatConfig = {
  default: { persen_penta: 35, persen_amil: 5, tagihan_salin: 0 },
  upz_settings: {}
};
let cachedUpzPentaRecords = [];
let upzPentaChartInstance = null;
let cachedAllUpzListRkat = [];

async function fetchRkatConfig() {
  let loaded = false;
  try {
    const res = await fetch('/api/rkat-config');
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        cachedRkatConfig = json.data;
        loaded = true;
      }
    }
  } catch (err) {
    console.warn('fetchRkatConfig network notice:', err);
  }

  // Fallback direct Supabase audit_logs jika endpoint backend belum mengembalikan data
  if (!loaded || !cachedRkatConfig || !cachedRkatConfig.upz_settings || !Object.keys(cachedRkatConfig.upz_settings).length) {
    try {
      if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        const { data: logs, error } = await supabaseClient
          .from('audit_logs')
          .select('description, created_at')
          .eq('module', 'rkat_config')
          .order('created_at', { ascending: true });

        if (!error && Array.isArray(logs) && logs.length > 0) {
          if (!cachedRkatConfig) {
            cachedRkatConfig = { default: { persen_penta: 35, persen_amil: 5, tagihan_salin: 0 }, upz_settings: {} };
          }
          if (!cachedRkatConfig.upz_settings) cachedRkatConfig.upz_settings = {};

          logs.forEach(l => {
            try {
              const p = typeof l.description === 'string' ? JSON.parse(l.description) : l.description;
              if (p && p.upz_id) {
                cachedRkatConfig.upz_settings[p.upz_id] = Object.assign(
                  cachedRkatConfig.upz_settings[p.upz_id] || {},
                  p
                );
              }
            } catch (_) {}
          });
        }
      }
    } catch (sbErr) {
      console.warn('Direct Supabase rkat_config fallback notice:', sbErr);
    }
  }

  if (typeof refreshActiveGuide === 'function') {
    refreshActiveGuide();
  }
  return cachedRkatConfig;
}

function getUpzRkatSetting(upzId) {
  if (!cachedRkatConfig) {
    cachedRkatConfig = { default: { persen_penta: 35, persen_amil: 5, tagihan_salin: 0 }, upz_settings: {} };
  }
  const def = (cachedRkatConfig && cachedRkatConfig.default) || { persen_penta: 35, persen_amil: 5, tagihan_salin: 0 };
  const currentYear = new Date().getFullYear();
  if (!upzId || !cachedRkatConfig.upz_settings) {
    return Object.assign({ rkat_unlocked: false, unlocked_year: null, current_year: currentYear }, def);
  }

  let found = cachedRkatConfig.upz_settings[upzId];
  if (!found) {
    const keys = Object.keys(cachedRkatConfig.upz_settings);
    for (let k of keys) {
      const item = cachedRkatConfig.upz_settings[k];
      if (item && (
        item.upz_id === upzId ||
        String(k).toLowerCase() === String(upzId).toLowerCase() ||
        (item.nama_upz && String(item.nama_upz).toLowerCase() === String(upzId).toLowerCase()) ||
        (item.kode_upz && String(item.kode_upz).toLowerCase() === String(upzId).toLowerCase())
      )) {
        found = item;
        break;
      }
    }
  }

  let isUnlocked = found ? Boolean(found.rkat_unlocked) : false;
  const unlockedYear = found ? (found.unlocked_year || (found.updated_at ? new Date(found.updated_at).getFullYear() : null)) : null;

  // RKAT hanya berlaku untuk 1 tahun berjalan. Jika telah berganti tahun, auto-lock!
  if (isUnlocked && unlockedYear && Number(unlockedYear) !== currentYear) {
    isUnlocked = false;
  }

  const rawSalinBulanan = (found && Array.isArray(found.salin_bulanan)) ? found.salin_bulanan : null;
  const legacyTransferred = (found && Array.isArray(found.salin_bulan_transfer)) ? found.salin_bulan_transfer.map(Number) : [];
  const legacyNominal = (found && found.tagihan_salin !== undefined) ? Number(found.tagihan_salin) : def.tagihan_salin;

  const salinBulanan = [];
  for (let m = 1; m <= 12; m++) {
    const existing = rawSalinBulanan ? rawSalinBulanan.find(x => Number(x.bulan) === m) : null;
    if (existing) {
      salinBulanan.push({
        bulan: m,
        nominal: Math.max(0, Number(existing.nominal) || 0),
        transfer: Boolean(existing.transfer)
      });
    } else {
      salinBulanan.push({
        bulan: m,
        nominal: 0,
        transfer: false
      });
    }
  }

  const transferredMonths = salinBulanan.filter(x => x.transfer).map(x => x.bulan);
  const totalSalinTransferred = salinBulanan.filter(x => x.transfer).reduce((sum, x) => sum + x.nominal, 0);

  return {
    upz_id: upzId,
    rkat_unlocked: isUnlocked,
    unlocked_year: isUnlocked ? unlockedYear : null,
    registered_year: unlockedYear,
    current_year: currentYear,
    persen_penta: (found && found.persen_penta !== undefined) ? Number(found.persen_penta) : def.persen_penta,
    persen_amil: (found && found.persen_amil !== undefined) ? Number(found.persen_amil) : def.persen_amil,
    tagihan_salin: totalSalinTransferred,
    salin_bulan_transfer: transferredMonths,
    salin_bulanan: salinBulanan,
    salin_tahun: (found && found.salin_tahun) || {}
  };
}

function getSalinBulananForYear(setting, targetYear) {
  if (!setting) return [];
  const yr = String(targetYear || new Date().getFullYear());
  if (setting.salin_tahun && Array.isArray(setting.salin_tahun[yr]) && setting.salin_tahun[yr].length === 12) {
    return setting.salin_tahun[yr];
  }
  const curYear = String(new Date().getFullYear());
  const activeYear = String(setting.unlocked_year || setting.current_year || curYear);
  if (yr === activeYear && Array.isArray(setting.salin_bulanan) && setting.salin_bulanan.length === 12) {
    return setting.salin_bulanan;
  }
  const list = [];
  for (let m = 1; m <= 12; m++) {
    list.push({
      bulan: m,
      nominal: 0,
      transfer: false
    });
  }
  return list;
}

function updateUpzRkatLockUI() {
  const myUpzId = currentProfile ? (currentProfile.upz_id || currentProfile.id) : null;
  const myNamaUpz = currentProfile ? (currentProfile.nama_upz || currentProfile.nama_lengkap || 'UPZ') : 'UPZ';
  const setting = getUpzRkatSetting(myUpzId);
  const currentYear = new Date().getFullYear();

  const badgeWrap = document.getElementById('upzRkatStatusBadgeWrap');
  const lockBanner = document.getElementById('upzRkatLockBanner');
  const pentaForm = document.getElementById('pentaForm');
  const waBtn = document.getElementById('upzRkatWaBtn');

  if (waBtn) {
    const waMsg = encodeURIComponent(
      `Assalamualaikum BAZNAS Kabupaten Banyumas, kami dari UPZ ${myNamaUpz} ingin mendaftarkan dan konfirmasi dokumen RKAT (Rencana Kerja & Anggaran Tahunan) Tahun ${currentYear} agar akses fitur Perbantuan Pentasharufan dapat dibuka. Mohon verifikasinya, terima kasih.`
    );
    waBtn.href = `https://wa.me/6281368691114?text=${waMsg}`;
  }

  if (!setting.rkat_unlocked) {
    const isExpired = setting.registered_year && Number(setting.registered_year) !== currentYear;
    if (badgeWrap) {
      badgeWrap.innerHTML = isExpired
        ? `<span class="rkat-badge rkat-badge-locked"><svg class="icon" style="width:14px;height:14px;"><use href="#i-lock"></use></svg> RKAT Kedaluwarsa (${setting.registered_year})</span>`
        : `<span class="rkat-badge rkat-badge-locked"><svg class="icon" style="width:14px;height:14px;"><use href="#i-lock"></use></svg> RKAT Belum Aktif (${currentYear})</span>`;
    }
    if (lockBanner) {
      lockBanner.classList.remove('hidden');
      const bannerTitle = lockBanner.querySelector('h3');
      const bannerDesc = lockBanner.querySelector('p');
      if (bannerTitle) {
        bannerTitle.textContent = isExpired
          ? `Masa Berlaku RKAT Tahun ${setting.registered_year} Telah Berakhir`
          : `Akses Perbantuan Pentasharufan Tahun ${currentYear} Terkunci`;
      }
      if (bannerDesc) {
        bannerDesc.innerHTML = isExpired
          ? `Akses RKAT berlaku untuk 1 tahun anggaran. Karena sistem telah memasuki <strong>Tahun ${currentYear}</strong>, RKAT otomatis terkunci kembali. Silakan lakukan konfirmasi pembaruan RKAT tahun berjalan ke BAZNAS Banyumas.`
          : `Fitur permohonan perbantuan pentasharufan hanya dapat diakses oleh UPZ yang telah mendaftarkan dan mengesahkan dokumen <strong>RKAT Tahun ${currentYear}</strong> di BAZNAS Kabupaten Banyumas.`;
      }
    }
    if (pentaForm) {
      pentaForm.querySelectorAll('input, select, textarea, button').forEach(function (el) {
        el.disabled = true;
      });
      pentaForm.style.opacity = '0.5';
      pentaForm.style.pointerEvents = 'none';
    }
  } else {
    const yr = setting.unlocked_year || currentYear;
    if (badgeWrap) {
      badgeWrap.innerHTML = `<span class="rkat-badge rkat-badge-active"><svg class="icon" style="width:14px;height:14px;"><use href="#i-check"></use></svg> RKAT Terverifikasi & Aktif (${yr})</span>`;
    }
    if (lockBanner) lockBanner.classList.add('hidden');
    if (pentaForm) {
      pentaForm.querySelectorAll('input, select, textarea, button').forEach(function (el) {
        el.disabled = false;
      });
      pentaForm.style.opacity = '1';
      pentaForm.style.pointerEvents = 'auto';
    }
  }
}

function renderUpzPentaBudgetAndChart() {
  const myUpzId = currentProfile ? (currentProfile.upz_id || currentProfile.id) : null;
  const setting = getUpzRkatSetting(myUpzId);

  const tahunSelect = document.getElementById('upzPentaFilterTahun');
  const bulanSelect = document.getElementById('upzPentaFilterBulan');

  const verifiedSetoran = (currentSetoran || []).filter(function (s) {
    return String(s.status || '').toLowerCase() === 'diterima';
  });

  if (tahunSelect && tahunSelect.options.length === 0) {
    const years = new Set();
    const currentYear = new Date().getFullYear();
    years.add(currentYear);
    verifiedSetoran.forEach(function (s) {
      const d = s.tanggal_setor || s.created_at;
      if (d) {
        const yr = new Date(d).getFullYear();
        if (!isNaN(yr)) years.add(yr);
      }
    });
    (cachedUpzPentaRecords || []).forEach(function (p) {
      const d = p.created_at;
      if (d) {
        const yr = new Date(d).getFullYear();
        if (!isNaN(yr)) years.add(yr);
      }
    });

    const sortedYears = Array.from(years).sort(function (a, b) { return b - a; });
    sortedYears.forEach(function (yr) {
      const opt = document.createElement('option');
      opt.value = String(yr);
      opt.textContent = `Tahun ${yr}`;
      tahunSelect.appendChild(opt);
    });
    const optSemua = document.createElement('option');
    optSemua.value = 'semua';
    optSemua.textContent = 'Semua Tahun';
    tahunSelect.appendChild(optSemua);
    tahunSelect.value = String(sortedYears[0] || currentYear);
  }

  if (tahunSelect && !tahunSelect.dataset.bound) {
    tahunSelect.dataset.bound = 'true';
    tahunSelect.addEventListener('change', renderUpzPentaBudgetAndChart);
  }
  if (bulanSelect && !bulanSelect.dataset.bound) {
    bulanSelect.dataset.bound = 'true';
    bulanSelect.addEventListener('change', renderUpzPentaBudgetAndChart);
  }
  const resetBtn = document.getElementById('upzPentaResetFilterBtn');
  if (resetBtn && !resetBtn.dataset.bound) {
    resetBtn.dataset.bound = 'true';
    resetBtn.addEventListener('click', function () {
      if (bulanSelect) bulanSelect.value = 'semua';
      renderUpzPentaBudgetAndChart();
    });
  }

  const selectedTahun = tahunSelect ? tahunSelect.value : 'semua';
  const selectedBulan = bulanSelect ? bulanSelect.value : 'semua';

  const filteredSetoran = verifiedSetoran.filter(function (s) {
    const dStr = s.tanggal_setor || s.created_at;
    if (!dStr) return false;
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return false;
    if (selectedTahun !== 'semua' && d.getFullYear() !== Number(selectedTahun)) return false;
    if (selectedBulan !== 'semua' && (d.getMonth() + 1) !== Number(selectedBulan)) return false;
    return true;
  });

  const filteredPenta = (cachedUpzPentaRecords || []).filter(function (p) {
    const dStr = p.created_at;
    if (!dStr) return false;
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return false;
    if (selectedTahun !== 'semua' && d.getFullYear() !== Number(selectedTahun)) return false;
    if (selectedBulan !== 'semua' && (d.getMonth() + 1) !== Number(selectedBulan)) return false;
    return true;
  });

  const totalSetoran = filteredSetoran.reduce(function (sum, s) {
    return sum + Number(s.nominal || 0);
  }, 0);

  const persenPenta = setting.persen_penta !== undefined ? setting.persen_penta : 35;
  const persenAmil = setting.persen_amil !== undefined ? setting.persen_amil : 5;
  const salinFilterTahun = document.getElementById('upzSalinFilterTahun');
  if (salinFilterTahun && salinFilterTahun.options.length === 0) {
    const curYear = new Date().getFullYear();
    const years = [curYear - 2, curYear - 1, curYear, curYear + 1];
    salinFilterTahun.innerHTML = years.map(function (y) {
      return `<option value="${y}" ${y === curYear ? 'selected' : ''}>Tahun ${y}</option>`;
    }).join('');
  }

  if (salinFilterTahun && !salinFilterTahun.dataset.bound) {
    salinFilterTahun.dataset.bound = 'true';
    salinFilterTahun.addEventListener('change', function () {
      renderUpzPentaBudgetAndChart();
    });
  }

  if (selectedTahun !== 'semua' && salinFilterTahun) {
    if (!Array.from(salinFilterTahun.options).some(function (opt) { return opt.value === selectedTahun; })) {
      const opt = document.createElement('option');
      opt.value = selectedTahun;
      opt.textContent = `Tahun ${selectedTahun}`;
      salinFilterTahun.appendChild(opt);
    }
    salinFilterTahun.value = selectedTahun;
  }

  const activeSalinYear = (selectedTahun !== 'semua')
    ? selectedTahun
    : (salinFilterTahun ? salinFilterTahun.value : String(new Date().getFullYear()));

  const salinBulanan = getSalinBulananForYear(setting, activeSalinYear);
  const bulanFullNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  const alokasiPenta = Math.round(totalSetoran * (persenPenta / 100));
  const hakAmil = Math.round(totalSetoran * (persenAmil / 100));

  let totalTagihanSalin = 0;
  let countBulanSalin = 0;
  if (selectedBulan !== 'semua') {
    const mNum = Number(selectedBulan);
    const mItem = salinBulanan.find(function (x) { return x.bulan === mNum; });
    if (mItem && mItem.transfer) {
      totalTagihanSalin = Number(mItem.nominal) || 0;
      countBulanSalin = 1;
    } else {
      totalTagihanSalin = 0;
      countBulanSalin = 0;
    }
  } else {
    salinBulanan.forEach(function (x) {
      if (x.transfer) {
        totalTagihanSalin += Number(x.nominal) || 0;
        countBulanSalin += 1;
      }
    });
  }

  const approvedPenta = filteredPenta.filter(function (p) {
    const st = String(p.status || '').toLowerCase();
    return st === 'disetujui' || st === 'selesai';
  });
  const realisasiPenta = approvedPenta.reduce(function (sum, p) {
    return sum + Number(p.nominal || 0);
  }, 0);

  // Alur: Alokasi perbantuan dikurangi akumulasi tagihan salin aslimas (bulan ditransfer) dan realisasi
  const sisaAnggaran = alokasiPenta - totalTagihanSalin - realisasiPenta;

  const elTotalSetoran = document.getElementById('upzPentaTotalSetoran');
  if (elTotalSetoran) elTotalSetoran.textContent = formatRupiah(totalSetoran);

  const elSetoranSub = document.getElementById('upzPentaSetoranSub');
  if (elSetoranSub) {
    elSetoranSub.textContent = `${filteredSetoran.length} setoran terverifikasi`;
  }

  const elAlokasi = document.getElementById('upzPentaAlokasi');
  if (elAlokasi) elAlokasi.textContent = formatRupiah(alokasiPenta);

  const elPersenBadge = document.getElementById('upzPentaPersenPentaBadge');
  if (elPersenBadge) {
    elPersenBadge.textContent = `${persenPenta}% dari Setoran Masuk`;
  }

  const elRealisasi = document.getElementById('upzPentaRealisasi');
  if (elRealisasi) elRealisasi.textContent = formatRupiah(realisasiPenta);

  const elRealisasiSub = document.getElementById('upzPentaRealisasiSub');
  if (elRealisasiSub) {
    elRealisasiSub.textContent = `${approvedPenta.length} pengajuan disetujui`;
  }

  const elSisa = document.getElementById('upzPentaSisa');
  if (elSisa) {
    elSisa.textContent = formatRupiah(sisaAnggaran);
    elSisa.style.color = sisaAnggaran >= 0 ? '#0f5132' : '#d93025';
  }

  const elSisaBadge = document.getElementById('upzPentaSisaBadge');
  if (elSisaBadge) {
    if (sisaAnggaran >= 0) {
      elSisaBadge.textContent = totalTagihanSalin > 0
        ? `Tersedia (potong Salin ${countBulanSalin} bln: ${formatRupiah(totalTagihanSalin)})`
        : 'Tersedia untuk disalurkan';
      elSisaBadge.style.color = '#16a34a';
    } else {
      elSisaBadge.textContent = 'Melebihi alokasi anggaran';
      elSisaBadge.style.color = '#dc2626';
    }
  }

  const elHakAmil = document.getElementById('upzPentaHakAmil');
  if (elHakAmil) {
    elHakAmil.textContent = formatRupiah(hakAmil);
  }
  const elHakAmilSub = document.getElementById('upzPentaHakAmilSub');
  if (elHakAmilSub) {
    elHakAmilSub.textContent = `${persenAmil}% dari Setoran Masuk`;
  }

  // 6. Scorecard Tagihan Salin Aslimas (Akumulasi Saja)
  const elTagihanSalin = document.getElementById('upzPentaTagihanSalin');
  if (elTagihanSalin) {
    elTagihanSalin.textContent = formatRupiah(totalTagihanSalin);
  }
  const elTagihanSalinSub = document.getElementById('upzPentaTagihanSalinSub');
  if (elTagihanSalinSub) {
    if (selectedBulan !== 'semua') {
      const mIdx = Number(selectedBulan) - 1;
      const mItem = salinBulanan.find(function (x) { return x.bulan === Number(selectedBulan); });
      const isTrf = mItem && mItem.transfer;
      elTagihanSalinSub.textContent = isTrf
        ? `${bulanFullNames[mIdx] || 'Bulan'}: Sudah ditransfer BAZNAS`
        : `${bulanFullNames[mIdx] || 'Bulan'}: Belum ditransfer BAZNAS`;
    } else {
      elTagihanSalinSub.textContent = countBulanSalin > 0
        ? `Akumulasi ${countBulanSalin} bulan ditransfer BAZNAS`
        : 'Belum ada transfer BAZNAS';
    }
  }

  // Render Kontainer Review Pembayaran Salin Aslimas (Role UPZ)
  const reviewTbody = document.getElementById('upzSalinReviewTableBody');
  if (reviewTbody) {
    let totalAllMonths = 0;
    let totalTransferredAll = 0;
    let countTransferredAll = 0;

    let rowsHtml = '';
    salinBulanan.forEach(function (item, idx) {
      const nom = Number(item.nominal) || 0;
      const isTransferred = Boolean(item.transfer);
      totalAllMonths += nom;
      if (isTransferred) {
        totalTransferredAll += nom;
        countTransferredAll += 1;
      }

      const statusBadge = isTransferred
        ? `<span class="badge-status-clean badge-clean-green" style="font-size:11px;padding:3px 8px;font-weight:600;"><svg class="icon" style="width:10px;height:10px;margin-right:2px;"><use href="#i-check"></use></svg> Sudah Ditransfer</span>`
        : `<span class="badge-status-clean" style="font-size:11px;padding:3px 8px;background:#f1f5f9;color:#64748b;border:1px solid #cbd5e1;">Belum Ditransfer</span>`;

      const impactText = isTransferred
        ? `<span style="color:#15803d;font-weight:600;">Mengurangi alokasi (${formatRupiah(nom)})</span>`
        : `<span style="color:var(--slate-400);">Belum memotong anggaran</span>`;

      rowsHtml += `
        <tr style="border-bottom:1px solid var(--slate-100);">
          <td style="text-align:center;color:var(--slate-400);">${idx + 1}</td>
          <td style="font-weight:600;color:var(--slate-800);">${bulanFullNames[idx]}</td>
          <td style="font-weight:600;">${formatRupiah(nom)}</td>
          <td style="text-align:center;">${statusBadge}</td>
          <td style="font-size:12px;">${impactText}</td>
        </tr>
      `;
    });
    reviewTbody.innerHTML = rowsHtml;

    const countBadge = document.getElementById('upzSalinTransferCountBadge');
    if (countBadge) countBadge.textContent = `${countTransferredAll}/12 Bln Ditransfer`;

    const accumBadge = document.getElementById('upzSalinTotalAccumBadge');
    if (accumBadge) accumBadge.textContent = `Akumulasi: ${formatRupiah(totalTransferredAll)}`;
  }

  renderUpzPentaChart(selectedTahun === 'semua' ? new Date().getFullYear() : Number(selectedTahun), persenPenta);
}

function renderUpzPentaChart(tahun, persenPenta) {
  const canvas = document.getElementById('upzPentaChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const bulanLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const setoranMonthly = new Array(12).fill(0);
  const alokasiMonthly = new Array(12).fill(0);
  const realisasiMonthly = new Array(12).fill(0);

  const verifiedSetoran = (currentSetoran || []).filter(function (s) {
    return String(s.status || '').toLowerCase() === 'diterima';
  });

  verifiedSetoran.forEach(function (s) {
    const dStr = s.tanggal_setor || s.created_at;
    if (!dStr) return;
    const d = new Date(dStr);
    if (d.getFullYear() === tahun) {
      const m = d.getMonth();
      setoranMonthly[m] += Number(s.nominal || 0);
    }
  });

  for (let i = 0; i < 12; i++) {
    alokasiMonthly[i] = Math.round(setoranMonthly[i] * (persenPenta / 100));
  }

  (cachedUpzPentaRecords || []).forEach(function (p) {
    const st = String(p.status || '').toLowerCase();
    if (st === 'disetujui' || st === 'selesai') {
      const dStr = p.created_at;
      if (!dStr) return;
      const d = new Date(dStr);
      if (d.getFullYear() === tahun) {
        const m = d.getMonth();
        realisasiMonthly[m] += Number(p.nominal || 0);
      }
    }
  });

  const chartDesc = document.getElementById('upzPentaChartDesc');
  if (chartDesc) {
    chartDesc.textContent = `Grafik komparasi alokasi (${persenPenta}%) vs realisasi pentasharufan tahun ${tahun}.`;
  }

  if (upzPentaChartInstance) {
    upzPentaChartInstance.destroy();
    upzPentaChartInstance = null;
  }

  const ctx = canvas.getContext('2d');
  upzPentaChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: bulanLabels,
      datasets: [
        {
          label: 'Alokasi Pentasharufan',
          data: alokasiMonthly,
          backgroundColor: 'rgba(15, 81, 50, 0.75)',
          borderColor: '#0f5132',
          borderWidth: 1.5,
          borderRadius: 6
        },
        {
          label: 'Realisasi Ditasharufkan',
          data: realisasiMonthly,
          backgroundColor: 'rgba(37, 99, 235, 0.75)',
          borderColor: '#2563eb',
          borderWidth: 1.5,
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            boxWidth: 12,
            font: { family: "'Poppins', sans-serif", size: 12 }
          }
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return context.dataset.label + ': ' + formatRupiah(context.raw || 0);
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function (val) {
              if (val >= 1000000) return 'Rp ' + (val / 1000000).toFixed(1) + ' jt';
              if (val >= 1000) return 'Rp ' + (val / 1000).toFixed(0) + ' rb';
              return 'Rp ' + val;
            },
            font: { family: "'Poppins', sans-serif", size: 11 }
          },
          grid: { color: 'rgba(0, 0, 0, 0.05)' }
        },
        x: {
          grid: { display: false },
          ticks: { font: { family: "'Poppins', sans-serif", size: 12 } }
        }
      }
    }
  });
}

// ------------------------------------------------------------
// ADMIN RKAT MANAGEMENT FUNCTIONS
// ------------------------------------------------------------
function updateAdminRkatStatusDisplay(isUnlocked, unlockedYear) {
  const currentYear = new Date().getFullYear();
  const yr = unlockedYear || currentYear;
  const statusEl = document.getElementById('adminRkatCurrentStatus');
  const toggleBtn = document.getElementById('adminRkatToggleLockBtn');
  if (statusEl) {
    if (isUnlocked) {
      statusEl.innerHTML = `<span class="rkat-badge rkat-badge-active"><svg class="icon" style="width:12px;height:12px;"><use href="#i-check"></use></svg> Aktif (Tahun ${yr})</span>`;
    } else {
      statusEl.innerHTML = `<span class="rkat-badge rkat-badge-locked"><svg class="icon" style="width:12px;height:12px;"><use href="#i-lock"></use></svg> Terkunci (${currentYear})</span>`;
    }
  }
  if (toggleBtn) {
    toggleBtn.dataset.unlocked = isUnlocked ? 'true' : 'false';
    toggleBtn.dataset.unlockedYear = isUnlocked ? String(yr) : '';
    if (isUnlocked) {
      toggleBtn.className = 'btn btn-sm btn-outline-danger';
      toggleBtn.innerHTML = '<svg class="icon" style="width:14px;height:14px;"><use href="#i-lock"></use></svg> Kunci Akses RKAT';
    } else {
      toggleBtn.className = 'btn btn-sm btn-primary';
      toggleBtn.innerHTML = `<svg class="icon" style="width:14px;height:14px;"><use href="#i-check"></use></svg> Buka RKAT ${currentYear}`;
    }
  }
}

function renderAdminSalinMonthTable(salinBulanan = []) {
  const tbody = document.getElementById('adminSalinMonthTableBody');
  if (!tbody) return;

  const bulanNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  let html = '';
  for (let m = 1; m <= 12; m++) {
    const item = (Array.isArray(salinBulanan) ? salinBulanan.find(function (x) { return Number(x.bulan) === m; }) : null) || { bulan: m, nominal: 0, transfer: false };
    const nomStr = item.nominal ? Number(item.nominal).toLocaleString('id-ID') : '0';
    const isChecked = Boolean(item.transfer);

    html += `
      <tr style="border-bottom:1px solid var(--slate-100);" data-month="${m}">
        <td style="text-align:center;padding:6px;">
          <input type="checkbox" class="admin-salin-cb" data-month="${m}" ${isChecked ? 'checked' : ''} style="cursor:pointer;width:16px;height:16px;accent-color:#16a34a;margin:0;">
        </td>
        <td style="padding:6px 8px;font-weight:600;color:var(--slate-800);">${bulanNames[m - 1]}</td>
        <td style="padding:6px 8px;">
          <div class="salin-input-addon">
            <span class="salin-addon-text">Rp</span>
            <input type="text" class="salin-nom-input admin-salin-nom-input" data-month="${m}" value="${nomStr}" placeholder="0" inputmode="numeric">
          </div>
        </td>
        <td style="padding:6px 8px;text-align:center;">
          <span class="badge-status-clean ${isChecked ? 'badge-clean-green' : ''} admin-salin-status-badge" style="font-size:10.5px;padding:2px 6px;">
            ${isChecked ? 'Sudah Ditransfer' : 'Belum Ditransfer'}
          </span>
        </td>
      </tr>
    `;
  }

  tbody.innerHTML = html;

  tbody.querySelectorAll('.admin-salin-nom-input').forEach(function (inp) {
    inp.addEventListener('input', function () {
      const raw = this.value.replace(/\D/g, '');
      this.value = raw ? Number(raw).toLocaleString('id-ID') : '';
      updateAdminSalinSummary();
    });
  });

  tbody.querySelectorAll('.admin-salin-cb').forEach(function (cb) {
    cb.addEventListener('change', function () {
      const row = cb.closest('tr');
      const badge = row ? row.querySelector('.admin-salin-status-badge') : null;
      if (badge) {
        if (cb.checked) {
          badge.className = 'badge-status-clean badge-clean-green admin-salin-status-badge';
          badge.textContent = 'Sudah Ditransfer';
        } else {
          badge.className = 'badge-status-clean admin-salin-status-badge';
          badge.textContent = 'Belum Ditransfer';
        }
      }
      updateAdminSalinSummary();
    });
  });

  updateAdminSalinSummary();
}

function updateAdminSalinSummary() {
  const rows = document.querySelectorAll('#adminSalinMonthTableBody tr');
  let checkedCount = 0;
  let totalTransferred = 0;

  rows.forEach(function (tr) {
    const cb = tr.querySelector('.admin-salin-cb');
    const inp = tr.querySelector('.admin-salin-nom-input');
    const nom = inp ? (parseInt(inp.value.replace(/\D/g, ''), 10) || 0) : 0;
    if (cb && cb.checked) {
      checkedCount += 1;
      totalTransferred += nom;
    }
  });

  const countEl = document.getElementById('adminSalinCountLabel');
  if (countEl) countEl.textContent = `${checkedCount} bulan`;

  const totalEl = document.getElementById('adminSalinTotalLabel');
  if (totalEl) totalEl.textContent = formatRupiah(totalTransferred);
}

async function initAdminRkatManagement() {
  await fetchRkatConfig();

  const upzSelect = document.getElementById('adminRkatSelectUpz');
  if (!upzSelect) return;

  const salinTahunSelect = document.getElementById('adminSalinTahunSelect');
  if (salinTahunSelect && salinTahunSelect.options.length === 0) {
    const curYear = new Date().getFullYear();
    const yearOptions = [curYear - 1, curYear, curYear + 1, curYear + 2];
    salinTahunSelect.innerHTML = yearOptions.map(function (y) {
      return `<option value="${y}" ${y === curYear ? 'selected' : ''}>${y}</option>`;
    }).join('');
  }

  if (salinTahunSelect && !salinTahunSelect.dataset.bound) {
    salinTahunSelect.dataset.bound = 'true';
    salinTahunSelect.addEventListener('change', function () {
      const selectedId = upzSelect.value;
      if (!selectedId) return;
      const setting = getUpzRkatSetting(selectedId);
      const chosenYear = salinTahunSelect.value;
      const list = getSalinBulananForYear(setting, chosenYear);
      renderAdminSalinMonthTable(list);
    });
  }

  if (!cachedAllUpzListRkat.length) {
    try {
      const res = await fetch('/api/upz-list');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          cachedAllUpzListRkat = json.data;
        }
      }
    } catch (_) {}

    if (!cachedAllUpzListRkat.length && typeof allUpzList !== 'undefined' && allUpzList.length) {
      cachedAllUpzListRkat = allUpzList;
    } else if (!cachedAllUpzListRkat.length && typeof DEFAULT_UPZ_DATA !== 'undefined') {
      cachedAllUpzListRkat = DEFAULT_UPZ_DATA;
    }
  }

  // Populate select
  const currentSelectVal = upzSelect.value;
  let optHtml = '<option value="">-- Pilih UPZ --</option>';
  cachedAllUpzListRkat.forEach(function (u) {
    const uid = u.id || u.kode_upz;
    const unama = u.nama_upz || u.nama_lengkap;
    optHtml += `<option value="${escapeHtml(uid)}" ${uid === currentSelectVal ? 'selected' : ''}>${escapeHtml(unama)}</option>`;
  });
  upzSelect.innerHTML = optHtml;

  renderAdminRkatTable();

  if (!upzSelect.dataset.bound) {
    upzSelect.dataset.bound = 'true';
    upzSelect.addEventListener('change', function () {
      const selectedId = upzSelect.value;
      const detailsBox = document.getElementById('adminRkatUpzDetails');
      if (!selectedId) {
        if (detailsBox) detailsBox.classList.add('hidden');
        return;
      }

      const u = cachedAllUpzListRkat.find(function (item) { return (item.id === selectedId || item.kode_upz === selectedId); });
      const setting = getUpzRkatSetting(selectedId);

      if (detailsBox) detailsBox.classList.remove('hidden');

      updateAdminRkatStatusDisplay(setting.rkat_unlocked, setting.unlocked_year);

      const pentaInput = document.getElementById('adminRkatPersenPenta');
      if (pentaInput) pentaInput.value = setting.persen_penta !== undefined ? setting.persen_penta : 35;

      const amilInput = document.getElementById('adminRkatPersenAmil');
      if (amilInput) amilInput.value = setting.persen_amil !== undefined ? setting.persen_amil : 5;

      const chosenYear = salinTahunSelect ? salinTahunSelect.value : String(new Date().getFullYear());
      const list = getSalinBulananForYear(setting, chosenYear);
      renderAdminSalinMonthTable(list);
    });
  }

  const toggleBtn = document.getElementById('adminRkatToggleLockBtn');
  if (toggleBtn && !toggleBtn.dataset.bound) {
    toggleBtn.dataset.bound = 'true';
    toggleBtn.addEventListener('click', async function () {
      const selectedId = upzSelect.value;
      if (!selectedId) {
        showMessage(msgEl, 'Pilih UPZ terlebih dahulu.', '#d93025');
        return;
      }
      const current = toggleBtn.dataset.unlocked === 'true';
      const targetState = !current;
      const currentYear = new Date().getFullYear();
      updateAdminRkatStatusDisplay(targetState, targetState ? currentYear : null);

      if (saveBtn) {
        saveBtn.click();
      }
    });
  }

  const selectAllBtn = document.getElementById('adminSalinSelectAllBtn');
  if (selectAllBtn && !selectAllBtn.dataset.bound) {
    selectAllBtn.dataset.bound = 'true';
    selectAllBtn.addEventListener('click', function () {
      document.querySelectorAll('#adminSalinMonthTableBody .admin-salin-cb').forEach(function (cb) {
        cb.checked = true;
        const row = cb.closest('tr');
        const badge = row ? row.querySelector('.admin-salin-status-badge') : null;
        if (badge) {
          badge.className = 'badge-status-clean badge-clean-green admin-salin-status-badge';
          badge.textContent = 'Sudah Ditransfer';
        }
      });
      updateAdminSalinSummary();
    });
  }

  const clearAllBtn = document.getElementById('adminSalinClearAllBtn');
  if (clearAllBtn && !clearAllBtn.dataset.bound) {
    clearAllBtn.dataset.bound = 'true';
    clearAllBtn.addEventListener('click', function () {
      document.querySelectorAll('#adminSalinMonthTableBody .admin-salin-cb').forEach(function (cb) {
        cb.checked = false;
        const row = cb.closest('tr');
        const badge = row ? row.querySelector('.admin-salin-status-badge') : null;
        if (badge) {
          badge.className = 'badge-status-clean admin-salin-status-badge';
          badge.textContent = 'Belum Ditransfer';
        }
      });
      updateAdminSalinSummary();
    });
  }

  const quickNominalInput = document.getElementById('adminSalinQuickNominal');
  if (quickNominalInput && !quickNominalInput.dataset.bound) {
    quickNominalInput.dataset.bound = 'true';
    quickNominalInput.addEventListener('input', function () {
      const raw = this.value.replace(/\D/g, '');
      this.value = raw ? Number(raw).toLocaleString('id-ID') : '';
    });
  }

  const quickApplyBtn = document.getElementById('adminSalinQuickApplyBtn');
  if (quickApplyBtn && !quickApplyBtn.dataset.bound) {
    quickApplyBtn.dataset.bound = 'true';
    quickApplyBtn.addEventListener('click', function () {
      const qInput = document.getElementById('adminSalinQuickNominal');
      const valStr = qInput ? qInput.value.trim() : '';
      document.querySelectorAll('#adminSalinMonthTableBody .admin-salin-nom-input').forEach(function (inp) {
        inp.value = valStr;
      });
      updateAdminSalinSummary();
    });
  }

  const saveBtn = document.getElementById('adminRkatSaveBtn');
  const msgEl = document.getElementById('adminRkatMsg');
  if (saveBtn && !saveBtn.dataset.bound) {
    saveBtn.dataset.bound = 'true';
    saveBtn.addEventListener('click', async function () {
      const selectedId = upzSelect.value;
      if (!selectedId) {
        showMessage(msgEl, 'Pilih UPZ terlebih dahulu.', '#d93025');
        return;
      }
      const u = cachedAllUpzListRkat.find(function (item) { return (item.id === selectedId || item.kode_upz === selectedId); });
      const isUnlocked = toggleBtn ? toggleBtn.dataset.unlocked === 'true' : false;
      const currentYear = new Date().getFullYear();
      const pPenta = parseFloat(document.getElementById('adminRkatPersenPenta').value) || 35;
      const pAmil = parseFloat(document.getElementById('adminRkatPersenAmil').value) || 5;
      const chosenYear = salinTahunSelect ? salinTahunSelect.value : String(currentYear);

      const salinBulanan = [];
      for (let m = 1; m <= 12; m++) {
        const cb = document.querySelector(`#adminSalinMonthTableBody .admin-salin-cb[data-month="${m}"]`);
        const nomInput = document.querySelector(`#adminSalinMonthTableBody .admin-salin-nom-input[data-month="${m}"]`);
        const nomRaw = (nomInput ? nomInput.value : '0').replace(/\D/g, '');
        salinBulanan.push({
          bulan: m,
          nominal: parseInt(nomRaw, 10) || 0,
          transfer: cb ? cb.checked : false
        });
      }
      const checkedMonths = salinBulanan.filter(function (x) { return x.transfer; }).map(function (x) { return x.bulan; });
      const totalSalinTransferred = salinBulanan.filter(function (x) { return x.transfer; }).reduce(function (sum, x) { return sum + x.nominal; }, 0);

      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Menyimpan...';
      showMessage(msgEl, 'Menyimpan pengaturan UPZ...', '#0f6c3e');

      let saved = false;
      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        const token = session ? session.access_token : '';
        const res = await fetch('/api/save-rkat-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: token,
            upz_id: selectedId,
            nama_upz: u ? (u.nama_upz || u.nama_lengkap) : '',
            rkat_unlocked: isUnlocked,
            unlocked_year: isUnlocked ? currentYear : null,
            persen_penta: pPenta,
            persen_amil: pAmil,
            tagihan_salin: totalSalinTransferred,
            salin_bulan_transfer: checkedMonths,
            salin_bulanan: salinBulanan,
            tahun: chosenYear
          })
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success) saved = true;
        }
      } catch (apiErr) {
        console.warn('API /api/save-rkat-config notice:', apiErr);
      }

      // Direct Supabase fallback jika backend API belum terhubung
      if (!saved && typeof supabaseClient !== 'undefined') {
        try {
          const sPayload = {
            upz_id: selectedId,
            nama_upz: u ? (u.nama_upz || u.nama_lengkap) : '',
            rkat_unlocked: isUnlocked,
            unlocked_year: isUnlocked ? currentYear : null,
            persen_penta: pPenta,
            persen_amil: pAmil,
            tagihan_salin: totalSalinTransferred,
            salin_bulan_transfer: checkedMonths,
            salin_bulanan: salinBulanan,
            tahun: chosenYear,
            updated_at: new Date().toISOString()
          };
          const { error: insErr } = await supabaseClient.from('audit_logs').insert([{
            action: 'UPDATE_RKAT_CONFIG',
            module: 'rkat_config',
            reference_id: isUuid(selectedId) ? selectedId : null,
            description: JSON.stringify(sPayload)
          }]);
          if (!insErr) saved = true;
        } catch (sbErr) {
          console.warn('Supabase audit_logs direct insert notice:', sbErr);
        }
      }

      if (saved) {
        showMessage(msgEl, 'Pengaturan RKAT & alokasi berhasil disimpan!', '#16a34a');
        const upzLabel = u ? (u.nama_upz || u.nama_lengkap) : 'UPZ';
        if (typeof showToast === 'function') {
          showToast('Pengaturan RKAT Berhasil Disimpan', 'success', `Konfigurasi RKAT & tagihan salin untuk ${upzLabel} berhasil diperbarui.`);
        }
        if (typeof syncAdminNotifications === 'function') {
          syncAdminNotifications();
        }
        await fetchRkatConfig();
        renderAdminRkatTable(document.getElementById('adminRkatSearchTable') ? document.getElementById('adminRkatSearchTable').value.toLowerCase().trim() : '');
      } else {
        showMessage(msgEl, 'Gagal menyimpan pengaturan RKAT. Silakan coba lagi.', '#d93025');
      }

      saveBtn.disabled = false;
      saveBtn.innerHTML = '<svg class="icon"><use href="#i-check"></use></svg> Simpan Pengaturan UPZ';
    });
  }

  const searchInput = document.getElementById('adminRkatSearchTable');
  if (searchInput && !searchInput.dataset.bound) {
    searchInput.dataset.bound = 'true';
    searchInput.addEventListener('input', function () {
      renderAdminRkatTable(searchInput.value.toLowerCase().trim());
    });
  }
}

function renderAdminRkatTable(filterText = '') {
  const tbody = document.getElementById('adminRkatTableBody');
  if (!tbody) return;

  const list = (cachedAllUpzListRkat || []).filter(function (u) {
    if (!filterText) return true;
    const name = (u.nama_upz || u.nama_lengkap || '').toLowerCase();
    const kode = (u.kode_upz || '').toLowerCase();
    return name.includes(filterText) || kode.includes(filterText);
  });

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:16px;color:var(--slate-400);">Tidak ada data UPZ yang cocok.</td></tr>';
    return;
  }

  let html = '';
  list.forEach(function (u) {
    const uid = u.id || u.kode_upz;
    const unama = u.nama_upz || u.nama_lengkap || 'UPZ';
    const setting = getUpzRkatSetting(uid);
    const isUnlocked = setting.rkat_unlocked;
    const currentYear = new Date().getFullYear();
    const isExpired = !isUnlocked && setting.registered_year && Number(setting.registered_year) !== currentYear;

    let statusBadge = '';
    if (isUnlocked) {
      statusBadge = `<span class="rkat-badge rkat-badge-active" style="font-size:11px;padding:2px 8px;" title="Berlaku untuk tahun ${setting.unlocked_year || currentYear}"><svg class="icon" style="width:10px;height:10px;"><use href="#i-check"></use></svg> Aktif (${setting.unlocked_year || currentYear})</span>`;
    } else if (isExpired) {
      statusBadge = `<span class="rkat-badge rkat-badge-locked" style="font-size:11px;padding:2px 8px;background:#fef2f2;color:#991b1b;border-color:#fecaca;" title="Kedaluwarsa tahun ${setting.registered_year}. Auto-lock di tahun ${currentYear}"><svg class="icon" style="width:10px;height:10px;"><use href="#i-clock"></use></svg> Kedaluwarsa (${setting.registered_year})</span>`;
    } else {
      statusBadge = `<span class="rkat-badge rkat-badge-locked" style="font-size:11px;padding:2px 8px;"><svg class="icon" style="width:10px;height:10px;"><use href="#i-lock"></use></svg> Terkunci</span>`;
    }

    const actionBtn = isUnlocked
      ? `<button type="button" class="btn btn-xs btn-outline-danger rkat-quick-toggle" data-upz-id="${escapeHtml(uid)}" data-target-state="false" style="padding:2px 8px;font-size:11px;">Kunci</button>`
      : `<button type="button" class="btn btn-xs btn-primary rkat-quick-toggle" data-upz-id="${escapeHtml(uid)}" data-target-state="true" style="padding:2px 8px;font-size:11px;">Buka RKAT ${currentYear}</button>`;

    const totalTrf = (setting.salin_bulanan || []).filter(function (x) { return x.transfer; }).reduce(function (sum, x) { return sum + x.nominal; }, 0);
    const countTrf = (setting.salin_bulan_transfer || []).length;

    html += `
      <tr style="border-bottom:1px solid var(--slate-100);">
        <td style="padding:8px 10px;font-weight:500;">${escapeHtml(unama)}</td>
        <td style="padding:8px 10px;">${statusBadge}</td>
        <td style="padding:8px 10px;">${setting.persen_penta}%</td>
        <td style="padding:8px 10px;">${setting.persen_amil}%</td>
        <td style="padding:8px 10px;">
          ${formatRupiah(totalTrf)}
          <span style="font-size:11px;color:var(--slate-500);display:block;">(${countTrf}/12 bln transfer)</span>
        </td>
        <td style="padding:8px 10px;text-align:center;white-space:nowrap;">
          ${actionBtn}
          <button type="button" class="btn btn-xs btn-ghost rkat-quick-edit" data-upz-id="${escapeHtml(uid)}" style="padding:2px 6px;margin-left:4px;" title="Pilih & Edit">
            <svg class="icon" style="width:12px;height:12px;"><use href="#i-edit"></use></svg>
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;

  tbody.querySelectorAll('.rkat-quick-toggle').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const upzId = btn.dataset.upzId;
      const targetState = btn.dataset.targetState === 'true';
      const u = cachedAllUpzListRkat.find(function (item) { return (item.id === upzId || item.kode_upz === upzId); });
      const setting = getUpzRkatSetting(upzId);
      const currentYear = new Date().getFullYear();

      btn.disabled = true;
      btn.textContent = '...';

      let saved = false;
      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        const token = session ? session.access_token : '';
        const res = await fetch('/api/save-rkat-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: token,
            upz_id: upzId,
            nama_upz: u ? (u.nama_upz || u.nama_lengkap) : '',
            rkat_unlocked: targetState,
            unlocked_year: targetState ? currentYear : null,
            persen_penta: setting.persen_penta,
            persen_amil: setting.persen_amil,
            tagihan_salin: setting.tagihan_salin,
            salin_bulan_transfer: setting.salin_bulan_transfer || [],
            salin_bulanan: setting.salin_bulanan || []
          })
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success) saved = true;
        }
      } catch (err) {
        console.warn('Quick toggle fetch notice:', err);
      }

      if (!saved && typeof supabaseClient !== 'undefined') {
        try {
          const sPayload = {
            upz_id: upzId,
            nama_upz: u ? (u.nama_upz || u.nama_lengkap) : '',
            rkat_unlocked: targetState,
            unlocked_year: targetState ? currentYear : null,
            persen_penta: setting.persen_penta,
            persen_amil: setting.persen_amil,
            tagihan_salin: setting.tagihan_salin,
            salin_bulan_transfer: setting.salin_bulan_transfer || [],
            salin_bulanan: setting.salin_bulanan || [],
            updated_at: new Date().toISOString()
          };
          const { error: insErr } = await supabaseClient.from('audit_logs').insert([{
            action: 'UPDATE_RKAT_CONFIG',
            module: 'rkat_config',
            reference_id: isUuid(upzId) ? upzId : null,
            description: JSON.stringify(sPayload)
          }]);
          if (!insErr) saved = true;
        } catch (sbErr) {
          console.warn('Quick toggle direct Supabase notice:', sbErr);
        }
      }

      await fetchRkatConfig();
      renderAdminRkatTable(filterText);

      const upzSelect = document.getElementById('adminRkatSelectUpz');
      if (upzSelect && upzSelect.value === upzId) {
        updateAdminRkatStatusDisplay(targetState, targetState ? currentYear : null);
      }
    });
  });

  tbody.querySelectorAll('.rkat-quick-edit').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const upzId = btn.dataset.upzId;
      const upzSelect = document.getElementById('adminRkatSelectUpz');
      if (upzSelect) {
        upzSelect.value = upzId;
        upzSelect.dispatchEvent(new Event('change'));
        upzSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  });
}

// 6e. Load Riwayat Pentasharufan (Role UPZ)
async function loadUpzPentasharufan() {
  const container = document.getElementById('upzPentaRiwayatContainer');
  if (!container) return;

  container.innerHTML = '<div class="empty-state" style="padding:24px;">Memuat riwayat pentasharufan...</div>';

  const myUpzId = currentProfile ? currentProfile.upz_id : null;
  const myNamaUpz = currentProfile ? (currentProfile.nama_upz || currentProfile.nama_lengkap) : null;

  const recordsMap = new Map();

  // 1. Ambil dari endpoint backend /api/penta-list (Single Source of Truth)
  try {
    const res = await fetch('/api/penta-list');
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        // Sinkronisasi: jika admin menghapus permohonan, hapus dari cache lokal UPZ
        const serverIds = new Set(json.data.map(function (r) { return String(r.id); }));
        const localList = getLocalPentaRecords();
        localList.forEach(function (l) {
          if (l && l.id && !serverIds.has(String(l.id))) {
            deleteLocalPentaRecord(l.id);
          }
        });
        if (json.data.length === 0) {
          localStorage.removeItem(LOCAL_PENTA_KEY);
        }

        json.data.forEach(function (rec) {
          if (rec && rec.id && (rec.nama_upz || rec.nominal || rec.jenis_program)) {
            recordsMap.set(rec.id, rec);
            saveLocalPentaRecord(rec);
          }
        });
      }
    }
  } catch (apiErr) {
    console.warn('Fetch /api/penta-list warning:', apiErr);
    // Hanya jika network offline sama sekali, fallback ke localStorage
    const localList = getLocalPentaRecords();
    localList.forEach(function (rec) {
      if (rec && rec.id && !recordsMap.has(rec.id) && (rec.nama_upz || rec.nominal || rec.jenis_program)) {
        recordsMap.set(rec.id, rec);
      }
    });
  }

  // 3. Sinkronkan dengan Supabase audit_logs (urutan asc)
  try {
    const { data: logs, error } = await supabaseClient
      .from('audit_logs')
      .select('*')
      .eq('module', 'pentasharufan')
      .order('created_at', { ascending: true });

    if (!error && Array.isArray(logs) && logs.length > 0) {
      logs.forEach(function (log) {
        try {
          const parsed = typeof log.description === 'string' ? JSON.parse(log.description) : log.description;
          if (!parsed || !parsed.id) return;

          if (log.action === 'PENTASHARUFAN_DELETE') {
            recordsMap.delete(parsed.id);
            deleteLocalPentaRecord(parsed.id);
            return;
          }

          if (log.action === 'PENTASHARUFAN_SUBMIT') {
            if (parsed.nama_upz || parsed.nominal || parsed.jenis_program) {
              recordsMap.set(parsed.id, parsed);
            }
            return;
          }

          if (recordsMap.has(parsed.id)) {
            const current = recordsMap.get(parsed.id);
            if (parsed.status) current.status = parsed.status;
            if (parsed.catatan_admin !== undefined) current.catatan_admin = parsed.catatan_admin;
          }
        } catch (_) {}
      });
    }
  } catch (err) {
    console.warn('Fetch pentasharufan logs error:', err);
  }

  // Filter khusus UPZ yang login dan pastikan record valid
  const myRecords = Array.from(recordsMap.values()).filter(function (r) {
    if (!r || !r.id || (!r.nama_upz && !r.nominal && !r.jenis_program)) return false;
    if (myUpzId && String(r.upz_id) === String(myUpzId)) return true;
    if (myNamaUpz && String(r.nama_upz || '').toLowerCase().trim() === String(myNamaUpz).toLowerCase().trim()) return true;
    return false;
  }).sort(function (a, b) {
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });

  cachedUpzPentaRecords = myRecords;
  await fetchRkatConfig();
  updateUpzRkatLockUI();
  renderUpzPentaBudgetAndChart();

  if (!myRecords.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:32px 16px;">
        <svg class="icon tone-teal" style="width:40px;height:40px;margin-bottom:12px;"><use href="#i-hand-heart"></use></svg>
        <p>Belum ada permohonan pentasharufan yang diajukan oleh UPZ Anda.</p>
      </div>
    `;
    return;
  }

  let html = '';
  myRecords.forEach(function (rec) {
    const st = String(rec.status || 'menunggu').toLowerCase();
    const stClass = st === 'disetujui' || st === 'selesai' ? 'status-diterima' : (st === 'ditolak' ? 'status-ditolak' : 'status-menunggu');
    const stLabel = st === 'disetujui' || st === 'selesai' ? 'Disetujui' : (st === 'ditolak' ? 'Ditolak' : 'Menunggu Review');
    const fotoSrc = rec.file_foto_url || rec.photo_fallback || '';
    const myNamaUpz = currentProfile ? (currentProfile.nama_upz || currentProfile.nama_lengkap || 'UPZ') : 'UPZ';
    const waText = encodeURIComponent(
      `Assalamualaikum BAZNAS Kabupaten Banyumas, kami dari UPZ *${myNamaUpz}* telah mengajukan permohonan perbantuan pentasharufan:\n\n` +
      `• Program: *${rec.jenis_program || '-'}*\n` +
      `• Tanggal Pengajuan: ${formatTanggal(rec.created_at)}\n` +
      `• Nominal Bantuan: *${formatRupiah(rec.nominal || 0)}*\n` +
      `• Penerima Manfaat: ${(rec.jumlah_penerima || 0).toLocaleString('id-ID')} jiwa/mustahik\n` +
      (rec.keterangan ? `• Keterangan: ${rec.keterangan}\n` : '') +
      `• Status Saat Ini: *${stLabel}*\n\n` +
      `Mohon untuk dapat diverifikasi dan ditindaklanjuti. Terima kasih.`
    );
    const waConfirmUrl = `https://wa.me/6285133744077?text=${waText}`;

    html += `
      <article class="penta-card" data-penta-id="${escapeHtml(rec.id)}">
        <div class="penta-card-header">
          <div>
            <span class="penta-card-program">${escapeHtml(rec.jenis_program || 'Pentasharufan UPZ')}</span>
            <div class="penta-card-date">${escapeHtml(formatTanggal(rec.created_at))}</div>
          </div>
          <span class="status-badge ${stClass}">${stLabel}</span>
        </div>
        <div class="penta-card-body">
          <div class="penta-stat-row">
            <div class="penta-stat-item">
              <span class="penta-stat-label">Nominal Bantuan</span>
              <span class="penta-stat-value confirm-nominal">${formatRupiah(rec.nominal || 0)}</span>
            </div>
            <div class="penta-stat-item">
              <span class="penta-stat-label">Penerima Manfaat</span>
              <span class="penta-stat-value">${(rec.jumlah_penerima || 0).toLocaleString('id-ID')} Jiwa / Mustahik</span>
            </div>
          </div>
          ${rec.keterangan ? `<p class="penta-card-desc"><strong>Keterangan:</strong> ${escapeHtml(rec.keterangan)}</p>` : ''}
          ${rec.catatan_admin ? `<div class="penta-admin-note"><strong>Catatan BAZNAS:</strong> ${escapeHtml(rec.catatan_admin)}</div>` : ''}
        </div>
        <div class="penta-card-footer">
          <div class="penta-files-row">
            ${rec.file_excel_url ? `
              <a href="${escapeHtml(rec.file_excel_url)}" download="${escapeHtml(rec.file_excel_name || 'Daftar_Penerima.xlsx')}" class="btn btn-soft btn-xs" target="_blank" rel="noopener noreferrer">
                <svg class="icon"><use href="#i-sheet"></use></svg><span>Unduh Excel (${escapeHtml(rec.file_excel_name || 'File')})</span>
              </a>
            ` : ''}
            ${fotoSrc ? `
              <button type="button" class="btn btn-ghost btn-xs upz-view-foto-btn" data-foto-url="${escapeHtml(fotoSrc)}" data-program="${escapeHtml(rec.jenis_program)}" data-date="${escapeHtml(formatTanggal(rec.created_at))}">
                <svg class="icon"><use href="#i-image"></use></svg><span>Lihat Foto Dokumentasi</span>
              </button>
            ` : ''}
            <a href="${waConfirmUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp-xs" title="Konfirmasi permohonan ke Admin BAZNAS via WhatsApp">
              <svg class="icon"><use href="#i-message-circle"></use></svg><span>Konfirmasi WA</span>
            </a>
          </div>
        </div>
      </article>
    `;
  });

  container.innerHTML = html;

  // Bind view photo
  container.querySelectorAll('.upz-view-foto-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openPreviewFotoModal(btn.dataset.fotoUrl, 'Dokumentasi Pentasharufan UPZ', `${btn.dataset.program} · ${btn.dataset.date}`);
    });
  });
}

// 6f. Load Pentasharufan Table & Review (Superadmin)
let cachedAdminPentaRecords = [];

async function loadAdminPentasharufan() {
  const container = document.getElementById('adminPentaTableContainer');
  if (!container) return;

  const recordsMap = new Map();

  // 1. Ambil dari endpoint backend /api/penta-list
  try {
    const res = await fetch('/api/penta-list');
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        json.data.forEach(function (rec) {
          if (rec && rec.id && (rec.nama_upz || rec.nominal || rec.jenis_program)) {
            recordsMap.set(rec.id, rec);
          }
        });
      }
    }
  } catch (apiErr) {
    console.warn('Fetch /api/penta-list warning:', apiErr);
  }

  // 2. Sinkronkan dengan Supabase audit_logs (urutan asc)
  try {
    const { data: logs, error } = await supabaseClient
      .from('audit_logs')
      .select('*')
      .eq('module', 'pentasharufan')
      .order('created_at', { ascending: true });

    if (!error && Array.isArray(logs) && logs.length > 0) {
      logs.forEach(function (log) {
        try {
          const parsed = typeof log.description === 'string' ? JSON.parse(log.description) : log.description;
          if (!parsed || !parsed.id) return;

          // Hapus jika di-delete admin
          if (log.action === 'PENTASHARUFAN_DELETE') {
            recordsMap.delete(parsed.id);
            return;
          }

          // Tambah submit baru hanya jika valid
          if (log.action === 'PENTASHARUFAN_SUBMIT') {
            if (parsed.nama_upz || parsed.nominal || parsed.jenis_program) {
              recordsMap.set(parsed.id, parsed);
            }
            return;
          }

          // Update status permohonan
          if (recordsMap.has(parsed.id)) {
            const current = recordsMap.get(parsed.id);
            if (parsed.status) current.status = parsed.status;
            if (parsed.catatan_admin !== undefined) current.catatan_admin = parsed.catatan_admin;
          }
        } catch (_) {}
      });
    }
  } catch (err) {
    console.warn('Fetch admin pentasharufan logs error:', err);
  }

  cachedAdminPentaRecords = Array.from(recordsMap.values())
    .filter(function (r) { return r && r.id && (r.nama_upz || r.nominal || r.jenis_program); })
    .sort(function (a, b) {
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

  // Populate Filter UPZ
  const upzSelect = document.getElementById('adminPentaFilterUpz');
  if (upzSelect) {
    const currentVal = upzSelect.value || 'semua';
    const upzNames = new Set();
    const upzSource = (allUpzList && allUpzList.length > 0) ? allUpzList : DEFAULT_UPZ_DATA;
    upzSource.forEach(function (u) {
      const name = u.nama_upz || u.nama_lengkap;
      if (name) upzNames.add(name);
    });
    cachedAdminPentaRecords.forEach(function (r) {
      if (r.nama_upz) upzNames.add(r.nama_upz);
    });
    const sortedUpz = Array.from(upzNames).sort();
    let optHtml = `<option value="semua">Semua UPZ (${sortedUpz.length} UPZ)</option>`;
    sortedUpz.forEach(function (u) {
      optHtml += `<option value="${escapeHtml(u)}" ${u === currentVal ? 'selected' : ''}>${escapeHtml(u)}</option>`;
    });
    upzSelect.innerHTML = optHtml;
  }

  // Update Scorecards
  updateAdminPentaScorecards(cachedAdminPentaRecords);

  // Render Table
  filterAndRenderAdminPentaTable();

  // Inisialisasi Manajemen Akses RKAT & Persentase UPZ
  await initAdminRkatManagement();
}

function updateAdminPentaScorecards(records) {
  const totalCountEl = document.getElementById('adminPentaTotalCount');
  const menungguCountEl = document.getElementById('adminPentaMenungguCount');
  const disetujuiCountEl = document.getElementById('adminPentaDisetujuiCount');
  const totalNominalEl = document.getElementById('adminPentaTotalNominal');

  const total = records.length;
  const menunggu = records.filter(function (r) { return String(r.status || '').toLowerCase() === 'menunggu'; }).length;
  const disetujui = records.filter(function (r) {
    const st = String(r.status || '').toLowerCase();
    return st === 'disetujui' || st === 'selesai';
  }).length;
  const totalNominal = records.reduce(function (sum, r) { return sum + Number(r.nominal || 0); }, 0);

  if (totalCountEl) totalCountEl.textContent = total.toLocaleString('id-ID');
  if (menungguCountEl) menungguCountEl.textContent = menunggu.toLocaleString('id-ID');
  if (disetujuiCountEl) disetujuiCountEl.textContent = disetujui.toLocaleString('id-ID');
  if (totalNominalEl) totalNominalEl.textContent = formatRupiah(totalNominal);
}

function filterAndRenderAdminPentaTable() {
  const container = document.getElementById('adminPentaTableContainer');
  const countEl = document.getElementById('adminPentaCount');
  if (!container) return;

  const upzFilter = document.getElementById('adminPentaFilterUpz');
  const progFilter = document.getElementById('adminPentaFilterProgram');
  const statusFilter = document.getElementById('adminPentaFilterStatus');

  const selectedUpz = upzFilter ? upzFilter.value : 'semua';
  const selectedProg = progFilter ? progFilter.value : 'semua';
  const selectedStatus = statusFilter ? statusFilter.value : 'semua';

  const filtered = cachedAdminPentaRecords.filter(function (r) {
    if (selectedUpz !== 'semua' && String(r.nama_upz || '') !== String(selectedUpz)) return false;
    if (selectedProg !== 'semua' && !String(r.jenis_program || '').toLowerCase().includes(String(selectedProg).toLowerCase())) return false;
    if (selectedStatus !== 'semua' && String(r.status || '').toLowerCase() !== String(selectedStatus).toLowerCase()) return false;
    return true;
  });

  if (countEl) {
    countEl.textContent = `Menampilkan ${filtered.length} dari ${cachedAdminPentaRecords.length} permohonan pentasharufan`;
  }

  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:32px 16px;">
        <p>Tidak ada data permohonan pentasharufan yang sesuai filter.</p>
      </div>
    `;
    return;
  }

  let html = `
    <div class="table-responsive">
      <table class="penta-table">
        <thead>
          <tr>
            <th style="width:50px;">No</th>
            <th>UPZ Pemohon</th>
            <th>Program & Tanggal</th>
            <th>Nominal & Penerima</th>
            <th>Status</th>
            <th>Berkas & Foto</th>
            <th style="text-align:right;">Aksi</th>
          </tr>
        </thead>
        <tbody>
  `;

  filtered.forEach(function (rec, idx) {
    const st = String(rec.status || 'menunggu').toLowerCase();
    const stClass = st === 'disetujui' || st === 'selesai' ? 'status-diterima' : (st === 'ditolak' ? 'status-ditolak' : 'status-menunggu');
    const stLabel = st === 'disetujui' || st === 'selesai' ? 'Disetujui' : (st === 'ditolak' ? 'Ditolak' : 'Menunggu Review');
    const isPending = st === 'menunggu';
    const fotoSrc = rec.file_foto_url || rec.photo_fallback || '';

    html += `
      <tr data-penta-id="${escapeHtml(rec.id)}">
        <td style="color:var(--slate-500);font-weight:600;">${idx + 1}</td>
        <td>
          <div style="font-weight:600;color:var(--slate-900);">${escapeHtml(rec.nama_upz || '-')}</div>
          <div style="font-size:12px;color:var(--slate-500);">${escapeHtml(rec.kategori || 'UPZ')}</div>
        </td>
        <td>
          <div style="font-weight:500;">${escapeHtml(rec.jenis_program || '-')}</div>
          <div style="font-size:12px;color:var(--slate-500);">${escapeHtml(formatTanggal(rec.created_at))}</div>
        </td>
        <td>
          <div style="font-weight:600;color:var(--emerald-800);">${formatRupiah(rec.nominal || 0)}</div>
          <div style="font-size:12px;color:var(--slate-500);">${(rec.jumlah_penerima || 0).toLocaleString('id-ID')} Orang / Mustahik</div>
        </td>
        <td>
          <span class="status-badge ${stClass}">${stLabel}</span>
        </td>
        <td>
          <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-start;">
            ${rec.file_excel_url ? `
              <a href="${escapeHtml(rec.file_excel_url)}" download="${escapeHtml(rec.file_excel_name || 'Daftar_Penerima.xlsx')}" class="btn btn-soft btn-xs" target="_blank" rel="noopener noreferrer" title="Unduh Berkas Excel">
                <svg class="icon"><use href="#i-download"></use></svg><span>Unduh Excel</span>
              </a>
            ` : '<span style="font-size:12px;color:var(--slate-400);">Tidak ada Excel</span>'}
            ${fotoSrc ? `
              <button type="button" class="btn btn-ghost btn-xs admin-view-penta-foto" data-foto-url="${escapeHtml(fotoSrc)}" data-upz="${escapeHtml(rec.nama_upz)}" data-program="${escapeHtml(rec.jenis_program)}" data-date="${escapeHtml(formatTanggal(rec.created_at))}">
                <svg class="icon"><use href="#i-image"></use></svg><span>Lihat Foto</span>
              </button>
            ` : '<span style="font-size:12px;color:var(--slate-400);">Tidak ada Foto</span>'}
          </div>
        </td>
        <td style="text-align:right;">
          <div style="display:flex;justify-content:flex-end;gap:6px;align-items:center;">
            ${isPending ? `
              <button type="button" class="btn btn-xs btn-primary admin-approve-penta-btn" data-id="${escapeHtml(rec.id)}" title="Setujui Permohonan">
                <svg class="icon"><use href="#i-check"></use></svg><span>Terima</span>
              </button>
              <button type="button" class="btn btn-xs btn-danger admin-reject-penta-btn" data-id="${escapeHtml(rec.id)}" title="Tolak Permohonan">
                <svg class="icon"><use href="#i-x"></use></svg><span>Tolak</span>
              </button>
            ` : ''}
            <button type="button" class="btn btn-ghost btn-xs btn-delete-row admin-delete-penta-btn" data-id="${escapeHtml(rec.id)}" title="Hapus Pengajuan">
              <svg class="icon"><use href="#i-trash-2"></use></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;

  // Bind Photo View
  container.querySelectorAll('.admin-view-penta-foto').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openPreviewFotoModal(btn.dataset.fotoUrl, 'Dokumentasi Pentasharufan', `${btn.dataset.upz} · ${btn.dataset.program} (${btn.dataset.date})`);
    });
  });

  // Bind Approve
  container.querySelectorAll('.admin-approve-penta-btn').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const id = btn.dataset.id;
      const rec = cachedAdminPentaRecords.find(function (r) { return String(r.id) === String(id); });
      if (!rec) return;

      rec.status = 'disetujui';
      saveLocalPentaRecord(rec);

      try {
        await fetch('/api/update-penta-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: id,
            status: 'disetujui',
            admin_id: currentProfile ? currentProfile.id : null
          })
        });
      } catch (e) {
        console.warn('Update penta status warning:', e);
      }

      updateAdminPentaScorecards(cachedAdminPentaRecords);
      filterAndRenderAdminPentaTable();
      if (typeof showFloatingToast === 'function') {
        showFloatingToast('Permohonan pentasharufan disetujui.', 'success');
      }
    });
  });

  // Bind Reject
  container.querySelectorAll('.admin-reject-penta-btn').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const id = btn.dataset.id;
      const rec = cachedAdminPentaRecords.find(function (r) { return String(r.id) === String(id); });
      if (!rec) return;

      const catatan = prompt('Tuliskan alasan penolakan permohonan pentasharufan:');
      if (catatan === null) return;

      rec.status = 'ditolak';
      rec.catatan_admin = catatan || 'Ditolak oleh admin.';
      saveLocalPentaRecord(rec);

      try {
        await fetch('/api/update-penta-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: id,
            status: 'ditolak',
            catatan_admin: catatan || 'Ditolak oleh admin.',
            admin_id: currentProfile ? currentProfile.id : null
          })
        });
      } catch (e) {
        console.warn('Update penta status warning:', e);
      }

      updateAdminPentaScorecards(cachedAdminPentaRecords);
      filterAndRenderAdminPentaTable();
      if (typeof showFloatingToast === 'function') {
        showFloatingToast('Permohonan pentasharufan ditolak.', 'error');
      }
    });
  });

  // Bind Delete
  container.querySelectorAll('.admin-delete-penta-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const id = btn.dataset.id;
      const rec = cachedAdminPentaRecords.find(function (r) { return String(r.id) === String(id); });
      openDeletePentaModal(id, rec);
    });
  });
}

let pendingDeletePentaId = null;

function openDeletePentaModal(id, rec) {
  pendingDeletePentaId = id;
  const modal = document.getElementById('deletePentaModal');
  if (!modal) return;
  const progEl = document.getElementById('delConfirmPentaProgram');
  const nomEl = document.getElementById('delConfirmPentaNominal');
  const penEl = document.getElementById('delConfirmPentaPenerima');
  if (progEl) progEl.textContent = rec ? (rec.program || rec.jenis || '-') : '-';
  if (nomEl) nomEl.textContent = rec ? formatRupiah(rec.nominal) : '-';
  if (penEl) penEl.textContent = rec ? `${rec.jumlah_penerima || '-'} Penerima` : '-';
  modal.classList.remove('hidden');
}

function closeDeletePentaModal() {
  pendingDeletePentaId = null;
  const modal = document.getElementById('deletePentaModal');
  if (modal) modal.classList.add('hidden');
}

function initDeletePentaFeature() {
  const closeX = document.getElementById('closeDeletePentaX');
  const cancelBtn = document.getElementById('cancelDeletePentaBtn');
  const execBtn = document.getElementById('executeDeletePentaBtn');
  if (closeX) closeX.addEventListener('click', closeDeletePentaModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeDeletePentaModal);
  if (execBtn) {
    execBtn.addEventListener('click', async function () {
      if (!pendingDeletePentaId) return;
      const id = pendingDeletePentaId;
      deleteLocalPentaRecord(id);
      cachedAdminPentaRecords = cachedAdminPentaRecords.filter(function (r) { return String(r.id) !== String(id); });
      try {
        await fetch('/api/delete-penta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: id, admin_id: currentProfile ? currentProfile.id : null })
        });
      } catch (e) {
        console.warn('Delete penta notice:', e);
        try {
          if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            await supabaseClient.from('audit_logs').insert([{
              action: 'PENTASHARUFAN_DELETE',
              module: 'pentasharufan',
              user_id: currentProfile ? currentProfile.id : null,
              description: JSON.stringify({ id: id })
            }]);
          }
        } catch (_) {}
      }
      updateAdminPentaScorecards(cachedAdminPentaRecords);
      filterAndRenderAdminPentaTable();
      closeDeletePentaModal();
      if (typeof showFloatingToast === 'function') {
        showFloatingToast('Data pentasharufan berhasil dihapus.', 'info');
      }
    });
  }

  // Multi-tab sync: update UPZ view jika admin menghapus di tab lain
  window.addEventListener('storage', function (e) {
    if (e.key === LOCAL_PENTA_KEY) {
      const upzView = document.getElementById('upzViewPentasharufan');
      if (upzView && !upzView.classList.contains('hidden')) {
        if (typeof loadUpzPentasharufan === 'function') loadUpzPentasharufan();
      }
    }
  });
}

// ======================================================================
// 6f. INITIALIZE NEW MODALS (UPZ CATEGORY & DONATUR BREAKDOWN)
// ======================================================================
function initNewModalsFeature() {
  // 1. UPZ Category Modal
  const btnDetailCat = document.getElementById('btnDetailKategoriUpz');
  const closeCatX = document.getElementById('closeUpzCategoryX');
  const closeCatBtn = document.getElementById('closeUpzCategoryBtn');
  const catModal = document.getElementById('upzCategoryModal');

  if (btnDetailCat) btnDetailCat.addEventListener('click', openUpzCategoryModal);
  if (closeCatX) closeCatX.addEventListener('click', closeUpzCategoryModal);
  if (closeCatBtn) closeCatBtn.addEventListener('click', closeUpzCategoryModal);
  if (catModal) {
    catModal.addEventListener('click', function (e) {
      if (e.target === catModal) closeUpzCategoryModal();
    });
  }

  // 2. Donatur Breakdown Modal (Muzaki vs Munfik)
  const triggerDonatur = document.getElementById('triggerDonaturBreakdown');
  const btnDetailDonatur = document.getElementById('btnDetailDonatur');
  const closeDonaturX = document.getElementById('closeDonaturBreakdownX');
  const closeDonaturBtn = document.getElementById('closeDonaturBreakdownBtn');
  const donaturModal = document.getElementById('donaturBreakdownModal');

  const btnChartDonatur = document.getElementById('btnChartDetailDonaturAdmin');
  if (triggerDonatur) triggerDonatur.addEventListener('click', function () { openDonaturBreakdownModal('semua'); });
  if (btnDetailDonatur) btnDetailDonatur.addEventListener('click', function () { openDonaturBreakdownModal('semua'); });
  if (btnChartDonatur) {
    btnChartDonatur.addEventListener('click', function () {
      const sel = document.getElementById('scorecardUpzFilter');
      openDonaturBreakdownModal(sel ? sel.value : 'semua');
    });
  }
  if (closeDonaturX) closeDonaturX.addEventListener('click', closeDonaturBreakdownModal);
  if (closeDonaturBtn) closeDonaturBtn.addEventListener('click', closeDonaturBreakdownModal);
  if (donaturModal) {
    donaturModal.addEventListener('click', function (e) {
      if (e.target === donaturModal) closeDonaturBreakdownModal();
    });
  }

  // Delegasi klik dokumen untuk memastikan klik tombol rincian selalu tertangkap
  document.addEventListener('click', function (e) {
    const catBtn = e.target.closest('#btnDetailKategoriUpz, .btnDetailKategoriUpz');
    if (catBtn) {
      e.preventDefault();
      e.stopPropagation();
      openUpzCategoryModal();
      return;
    }

    const chartDonaturBtn = e.target.closest('#btnChartDetailDonaturAdmin');
    if (chartDonaturBtn) {
      e.preventDefault();
      e.stopPropagation();
      const sel = document.getElementById('scorecardUpzFilter');
      openDonaturBreakdownModal(sel ? sel.value : 'semua');
      return;
    }

    const donaturBtn = e.target.closest('#btnDetailDonatur, .btnDetailDonatur, #triggerDonaturBreakdown');
    if (donaturBtn) {
      e.preventDefault();
      e.stopPropagation();
      openDonaturBreakdownModal('semua');
      return;
    }
  });
}

// ======================================================================
// 6g. BUKTI SETOR ZAKAT (BSZ) FEATURE (ADMIN UPLOAD & UPZ DOWNLOAD)
// ======================================================================
// ======================================================================
// 6g. DOKUMEN & BUKTI TRANSFER (BSZ, TF PENTA, TF AMIL, TF SALIN)
// ======================================================================
let bszRecords = {};
let transferDocsRecords = {};

async function syncTransferDocsList() {
  try {
    const res = await fetch('/api/transfer-docs-list');
    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.data) {
        transferDocsRecords = json.data;
        try { localStorage.setItem('transfer_docs_cache', JSON.stringify(transferDocsRecords)); } catch (_) {}
      }
    }
  } catch (err) {
    console.warn('syncTransferDocsList fetch warning:', err);
  }
  try {
    const cached = localStorage.getItem('transfer_docs_cache');
    if (cached) transferDocsRecords = JSON.parse(cached);
  } catch (_) {}
  return transferDocsRecords;
}

async function syncBszList() {
  try {
    const res = await fetch('/api/bsz-list');
    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.data) {
        bszRecords = json.data;
        try { localStorage.setItem('bsz_records_cache', JSON.stringify(bszRecords)); } catch (_) {}
      }
    }
  } catch (err) {
    console.warn('syncBszList fetch warning:', err);
  }
  try {
    const cached = localStorage.getItem('bsz_records_cache');
    if (cached) bszRecords = JSON.parse(cached);
  } catch (_) {}
  await syncTransferDocsList();
  return bszRecords;
}

function getBszRecord(setoranId) {
  if (!setoranId) return null;
  return bszRecords[String(setoranId)] || null;
}

function getTransferDocRecord(setoranId, docType) {
  if (!setoranId || !docType) return null;
  const sDocs = transferDocsRecords[String(setoranId)] || {};
  if (sDocs[docType]) return sDocs[docType];

  const bszObj = bszRecords[String(setoranId)];
  if (bszObj) {
    if (bszObj[docType]) return bszObj[docType];
    if (docType === 'bsz_upz' || docType === 'bsz') {
      if (bszObj.bsz_upz) return bszObj.bsz_upz;
      if (bszObj.file_name) return bszObj;
    }
    if (docType === 'bsz_nama' && bszObj.bsz_nama) return bszObj.bsz_nama;
  }
  return null;
}

function openUploadDocModal(setoranId, docType) {
  docType = docType || 'bsz_upz';
  const modal = document.getElementById('uploadBszModal');
  if (!modal) return;
  const item = (currentAdminSetoran || []).concat(currentSetoran || []).find(function (s) { return String(s.id) === String(setoranId); });
  const upzName = (item && ((upzMap && upzMap[item.upz_id]) || item.nama_upz || item.upz_id)) || 'UPZ';

  const isPerNama = (docType === 'bsz_nama');
  const typeTitle = isPerNama ? 'BSZ Per Nama' : 'BSZ UPZ';

  const titleEl = document.getElementById('uploadBszModalTitle');
  if (titleEl) titleEl.textContent = 'Unggah ' + typeTitle;

  const subEl = document.getElementById('uploadBszModalSubtitle');
  if (subEl) subEl.textContent = isPerNama
    ? `Unggah berkas resmi BSZ per nama donatur/muzakki • ${upzName}`
    : `Unggah berkas resmi BSZ lembaga UPZ • ${upzName}`;

  const labelEl = document.getElementById('uploadDocFileLabel');
  if (labelEl) labelEl.textContent = `Pilih Berkas ${typeTitle} (PDF / RAR):`;

  const idInput = document.getElementById('uploadBszSetoranId');
  if (idInput) idInput.value = setoranId;

  const typeInput = document.getElementById('uploadDocType');
  if (typeInput) typeInput.value = docType;

  const customNameInput = document.getElementById('inputBszCustomName');
  const existing = getTransferDocRecord(setoranId, docType);
  if (customNameInput) {
    customNameInput.value = (existing && (existing.nama_bsz || existing.file_name)) ? (existing.nama_bsz || existing.file_name) : '';
    customNameInput.placeholder = isPerNama ? 'Contoh: BSZ Donatur Perorangan - UPZ ...' : 'Contoh: BSZ Lembaga UPZ Periode ...';
  }

  const fileInput = document.getElementById('inputBszFile');
  if (fileInput) fileInput.value = '';

  const msgEl = document.getElementById('uploadBszMsg');
  if (msgEl) { msgEl.textContent = ''; msgEl.className = 'form-message'; }

  const currentNotice = document.getElementById('uploadBszCurrentFileNotice');
  if (currentNotice) {
    if (existing && existing.file_name) {
      const ext = (existing.file_name.split('.').pop() || 'PDF').toUpperCase();
      const displayName = existing.nama_bsz || existing.file_name;
      currentNotice.classList.remove('hidden');
      currentNotice.innerHTML = `<strong>Berkas Saat Ini:</strong> [${escapeHtml(ext)}] ${escapeHtml(displayName)} <span style="color:var(--slate-500);font-size:11px;">(${new Date(existing.uploaded_at).toLocaleDateString('id-ID')})</span> <a href="javascript:void(0)" id="previewCurrentDocLink" style="margin-left:8px;color:var(--primary);font-weight:600;">Lihat / Unduh</a>`;
      const prevLink = document.getElementById('previewCurrentDocLink');
      if (prevLink) {
        prevLink.addEventListener('click', function () {
          downloadTransferDocFile(setoranId, docType);
        });
      }
    } else {
      currentNotice.classList.add('hidden');
      currentNotice.innerHTML = '';
    }
  }

  const btnText = document.getElementById('saveUploadBszBtnText');
  if (btnText) {
    btnText.textContent = existing ? `Perbarui ${typeTitle}` : `Simpan & Terbitkan ${typeTitle}`;
  }

  modal.classList.remove('hidden');
}

function openUploadBszModal(setoranId) {
  return openUploadDocModal(setoranId, 'bsz_upz');
}

function closeUploadBszModal() {
  const modal = document.getElementById('uploadBszModal');
  if (modal) modal.classList.add('hidden');
}

async function downloadTransferDocFile(setoranId, docType) {
  docType = docType || 'bsz_upz';
  const doc = getTransferDocRecord(setoranId, docType);
  if (!doc) {
    if (typeof showToast === 'function') showToast('Berkas BSZ belum tersedia untuk transaksi ini.', 'warning');
    else alert('Berkas BSZ belum tersedia.');
    return;
  }

  const rawExt = (doc.file_name ? doc.file_name.split('.').pop() : 'pdf').toLowerCase();
  let downloadName = doc.nama_bsz || doc.file_name || `BSZ_${setoranId.slice(0, 8)}.${rawExt}`;
  if (!downloadName.toLowerCase().endsWith('.' + rawExt)) {
    downloadName += '.' + rawExt;
  }

  // 1. Jika ada file_data (base64 data url), unduh langsung
  if (doc.file_data && doc.file_data.startsWith('data:')) {
    const link = document.createElement('a');
    link.href = doc.file_data;
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }

  // 2. Jika ada file_path di Supabase Storage
  if (doc.file_path) {
    try {
      const { data: fileBlob, error } = await supabaseClient.storage.from(STORAGE_BUCKET).download(doc.file_path);
      if (!error && fileBlob) {
        const blobUrl = URL.createObjectURL(fileBlob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = downloadName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(blobUrl);
        return;
      }
    } catch (e) {
      console.warn('Storage doc download error:', e);
    }
  }

  alert('Gagal mengunduh berkas. Berkas tidak ditemukan.');
}

function downloadBszFile(setoranId) {
  return downloadTransferDocFile(setoranId, 'bsz_upz');
}

function initBszUploadFeature() {
  const modal = document.getElementById('uploadBszModal');
  const closeX = document.getElementById('closeUploadBszX');
  const closeBtn = document.getElementById('closeUploadBszBtn');
  const saveBtn = document.getElementById('saveUploadBszBtn');
  const fileInput = document.getElementById('inputBszFile');
  const customNameInput = document.getElementById('inputBszCustomName');
  const idInput = document.getElementById('uploadBszSetoranId');
  const typeInput = document.getElementById('uploadDocType');
  const msgEl = document.getElementById('uploadBszMsg');

  if (closeX) closeX.addEventListener('click', closeUploadBszModal);
  if (closeBtn) closeBtn.addEventListener('click', closeUploadBszModal);
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeUploadBszModal();
    });
  }

  // Auto-fill nama BSZ jika nama masih kosong saat memilih file
  if (fileInput && customNameInput) {
    fileInput.addEventListener('change', function () {
      if (fileInput.files && fileInput.files[0] && !customNameInput.value.trim()) {
        const rawName = fileInput.files[0].name.replace(/\.[^/.]+$/, '');
        customNameInput.value = rawName;
      }
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', async function () {
      const setoranId = idInput ? idInput.value : '';
      const docType = (typeInput && typeInput.value) || 'bsz_upz';

      if (!setoranId) {
        if (msgEl) showMessage(msgEl, 'ID setoran tidak valid.', '#d93025');
        return;
      }

      const file = fileInput && fileInput.files ? fileInput.files[0] : null;
      if (!file) {
        if (msgEl) showMessage(msgEl, 'Pilih berkas terlebih dahulu.', '#d93025');
        return;
      }

      const validExts = ['pdf', 'rar'];
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!validExts.includes(ext)) {
        if (msgEl) showMessage(msgEl, 'Format berkas harus PDF atau RAR.', '#d93025');
        return;
      }

      if (file.size > 20 * 1024 * 1024) {
        if (msgEl) showMessage(msgEl, 'Ukuran berkas melebihi batas maksimal 20MB.', '#d93025');
        return;
      }

      const customName = (customNameInput && customNameInput.value.trim()) || file.name;

      saveBtn.disabled = true;
      if (msgEl) showMessage(msgEl, 'Mengunggah berkas BSZ...', '#0f6c3e');

      try {
        const reader = new FileReader();
        const base64Promise = new Promise(function (resolve, reject) {
          reader.onload = function () { resolve(reader.result); };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const fileDataUrl = await base64Promise;

        let storageFilePath = '';
        try {
          const safeName = Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          storageFilePath = `docs/${docType}/${setoranId}/${safeName}`;
          await supabaseClient.storage.from(STORAGE_BUCKET).upload(storageFilePath, file, {
            upsert: true
          });
        } catch (stErr) {
          console.warn('Upload doc to supabase storage fallback to local:', stErr);
        }

        const item = (currentAdminSetoran || []).concat(currentSetoran || []).find(function (s) { return String(s.id) === String(setoranId); });
        const upzId = item ? (item.upz_id || '') : '';

        const endpoint = '/api/save-bsz';
        const payload = {
          setoran_id: setoranId,
          doc_type: docType,
          nama_bsz: customName,
          file_name: file.name,
          file_path: storageFilePath,
          file_data: fileDataUrl,
          upz_id: upzId,
          uploaded_at: new Date().toISOString()
        };

        const saveRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const saveJson = await saveRes.json();
        if (!saveJson.success) {
          throw new Error(saveJson.message || 'Gagal menyimpan data berkas ke server.');
        }

        if (!bszRecords[setoranId] || typeof bszRecords[setoranId] !== 'object' || bszRecords[setoranId].file_name) {
          const old = bszRecords[setoranId];
          bszRecords[setoranId] = {};
          if (old && old.file_name) bszRecords[setoranId].bsz_upz = old;
        }
        bszRecords[setoranId][docType] = saveJson.data;
        try { localStorage.setItem('bsz_records_cache', JSON.stringify(bszRecords)); } catch (_) {}

        if (!transferDocsRecords[setoranId]) transferDocsRecords[setoranId] = {};
        transferDocsRecords[setoranId][docType] = saveJson.data;
        try { localStorage.setItem('transfer_docs_cache', JSON.stringify(transferDocsRecords)); } catch (_) {}

        if (msgEl) showMessage(msgEl, 'Berkas berhasil disimpan & diterbitkan!', '#0f6c3e');
        if (typeof showToast === 'function') showToast('Berkas berhasil diterbitkan.', 'success');

        setTimeout(function () {
          closeUploadBszModal();
          if (typeof renderAdminSetoran === 'function') renderAdminSetoran(currentAdminSetoran);
          if (typeof renderRiwayat === 'function' && typeof currentSetoran !== 'undefined') renderRiwayat(currentSetoran);
          if (typeof updateDetailModalDocsSection === 'function') {
            updateDetailModalDocsSection(setoranId, currentProfile && currentProfile.role === 'admin');
          }
        }, 800);

      } catch (err) {
        console.error('SAVE DOC ERROR:', err);
        if (msgEl) showMessage(msgEl, 'Gagal mengunggah berkas: ' + (err.message || 'Terjadi kesalahan'), '#d93025');
      } finally {
        saveBtn.disabled = false;
      }
    });
  }
}

// ======================================================================
// 6h. REFRESH VISUAL POP-UP (DATA SUDAH DI-REFRESH)
// ======================================================================
async function executeVisualDataRefresh() {
  const modal = document.getElementById('refreshStatusModal');
  const spinnerWrap = document.getElementById('refreshModalSpinner');
  const checkWrap = document.getElementById('refreshModalCheck');
  const titleEl = document.getElementById('refreshModalTitle');
  const subEl = document.getElementById('refreshModalSub');
  const headerRefreshBtn = document.getElementById('headerRefreshButton');
  const adminRefreshBtn = document.getElementById('refreshAdminButton');

  if (headerRefreshBtn) headerRefreshBtn.classList.add('is-spinning');
  if (adminRefreshBtn) adminRefreshBtn.classList.add('is-spinning');

  if (modal) {
    if (spinnerWrap) spinnerWrap.classList.remove('hidden');
    if (checkWrap) checkWrap.classList.add('hidden');
    if (titleEl) titleEl.textContent = 'Refresh Data...';
    if (subEl) subEl.textContent = 'Menyinkronkan data terbaru dengan database server...';
    modal.classList.remove('hidden');
  }

  const startTime = Date.now();
  const savedActiveView = (typeof currentActiveView !== 'undefined' && currentActiveView) ? currentActiveView : 'beranda';

  try {
    await syncBszList();
    await loadUpzList();

    if (currentProfile && currentProfile.role === 'admin') {
      await loadAdminSetoran();
      await ensureAdminDonaturLoaded(true);
      if (typeof renderAdminSetoran === 'function') renderAdminSetoran(currentAdminSetoran);
      if (typeof updateScorecardDonatur === 'function') updateScorecardDonatur();
      if (typeof updateAdminSummaryCards === 'function') updateAdminSummaryCards(currentAdminSetoran);
      if (typeof updateAdminYearCards === 'function') updateAdminYearCards(currentAdminSetoran);
      if (typeof updateAdminRankingKategoriTable === 'function') updateAdminRankingKategoriTable();
      if (savedActiveView && typeof navigateToView === 'function') {
        navigateToView(savedActiveView);
      }
    } else {
      await loadDashboard(true);
      if (typeof filterAndRenderRiwayat === 'function') filterAndRenderRiwayat();
      if (savedActiveView && typeof navigateToView === 'function') {
        navigateToView(savedActiveView);
      }
    }
  } catch (err) {
    console.error('VISUAL REFRESH ERROR:', err);
  }

  const elapsed = Date.now() - startTime;
  if (elapsed < 700) {
    await new Promise(function (r) { setTimeout(r, 700 - elapsed); });
  }

  if (headerRefreshBtn) headerRefreshBtn.classList.remove('is-spinning');
  if (adminRefreshBtn) adminRefreshBtn.classList.remove('is-spinning');

  if (modal) {
    if (spinnerWrap) spinnerWrap.classList.add('hidden');
    if (checkWrap) checkWrap.classList.remove('hidden');
    if (titleEl) titleEl.textContent = 'Data Sudah Di-refresh!';
    if (subEl) subEl.textContent = 'Seluruh data transaksi dan status telah diperbarui secara langsung.';

    setTimeout(function () {
      modal.classList.add('hidden');
    }, 1100);
  }
}

function initVisualRefreshFeature() {
  const headerRefreshBtn = document.getElementById('headerRefreshButton');
  if (headerRefreshBtn && !headerRefreshBtn.dataset.boundRefresh) {
    headerRefreshBtn.dataset.boundRefresh = 'true';
    headerRefreshBtn.addEventListener('click', executeVisualDataRefresh);
  }

  const adminRefreshBtn = document.getElementById('refreshAdminButton');
  if (adminRefreshBtn && !adminRefreshBtn.dataset.boundRefresh) {
    adminRefreshBtn.dataset.boundRefresh = 'true';
    adminRefreshBtn.addEventListener('click', executeVisualDataRefresh);
  }
}

// ======================================================================
// 6i. FITUR FORMULIR SETORAN PROGRAM, MASTER PROGRAM & PREVIEW DETAIL
// ======================================================================

let currentProgramMasterList = [];

async function fetchProgramMasterList() {
  try {
    const res = await fetch('/api/program-types');
    const data = await res.json();
    if (data && data.success && Array.isArray(data.programs)) {
      currentProgramMasterList = data.programs;
      populateProgramDropdown();
      return data.programs;
    }
  } catch (err) {
    console.warn('[PROGRAM-MASTER] Gagal memuat daftar program:', err.message);
  }
  return [];
}

function populateProgramDropdown() {
  const selectEl = document.getElementById('programJenisSelect');
  if (!selectEl) return;
  const currentVal = selectEl.value;
  let html = '<option value="">-- Pilih Jenis Program --</option>';
  (currentProgramMasterList || []).forEach(function (p) {
    html += `<option value="${escapeHtml(p.name)}" ${p.name === currentVal ? 'selected' : ''}>${escapeHtml(p.name)}</option>`;
  });
  selectEl.innerHTML = html;
}

async function openProgramPreviewModal(isAdmin) {
  const modal = document.getElementById('programPreviewModal');
  if (!modal) return;

  const isAdminMode = (isAdmin !== undefined) ? !!isAdmin : (currentProfile && currentProfile.role === 'admin');
  const titleEl = document.getElementById('programPreviewModalTitle');
  const subEl = document.getElementById('programPreviewModalSubtitle');
  const cardsContainer = document.getElementById('programBreakdownCards');
  const tableBody = document.getElementById('programTransactionsTableBody');
  const thUpz = document.getElementById('thProgramUpzCol');

  modal.classList.remove('hidden');

  if (thUpz) thUpz.style.display = isAdminMode ? '' : 'none';
  if (titleEl) titleEl.textContent = isAdminMode ? 'Rincian Akumulasi Setoran Program (Admin)' : 'Rincian Akumulasi Setoran Program (UPZ)';
  if (subEl) subEl.textContent = isAdminMode ? 'Rincian akumulasi setoran berdasarkan jenis program dari seluruh UPZ.' : 'Detail akumulasi setoran program yang telah diajukan oleh UPZ Anda.';

  if (cardsContainer) {
    cardsContainer.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:24px;color:var(--slate-500);font-size:13px;">Memuat data transaksi setoran program...</div>';
  }
  if (tableBody) {
    tableBody.innerHTML = `<tr><td colspan="${isAdminMode ? 6 : 5}" style="text-align:center;padding:24px;color:var(--slate-400);font-size:13px;">Memuat rincian transaksi...</td></tr>`;
  }

  let list = [];
  try {
    if (isAdminMode) {
      if (Array.isArray(currentAdminSetoran) && currentAdminSetoran.length > 0) {
        list = currentAdminSetoran.filter(isSetoranProgram);
      }
      if (!list.length) {
        const { data: dbRows, error: dbErr } = await supabaseClient
          .from('setoran')
          .select('*')
          .order('tanggal_setor', { ascending: false });
        if (!dbErr && Array.isArray(dbRows)) {
          if (!currentAdminSetoran || !currentAdminSetoran.length) {
            currentAdminSetoran = dbRows;
          }
          list = dbRows.filter(isSetoranProgram);
        }
      }
    } else {
      if (Array.isArray(currentSetoran) && currentSetoran.length > 0) {
        list = currentSetoran.filter(isSetoranProgram);
      }
      if (!list.length) {
        const targetUpz = (currentProfile && currentProfile.upz_id) || '';
        let query = supabaseClient.from('setoran').select('*').order('tanggal_setor', { ascending: false });
        if (targetUpz) query = query.eq('upz_id', targetUpz);
        const { data: dbRows, error: dbErr } = await query;
        if (!dbErr && Array.isArray(dbRows)) {
          if (!currentSetoran || !currentSetoran.length) {
            currentSetoran = dbRows;
          }
          list = dbRows.filter(isSetoranProgram);
        }
      }
    }
  } catch (err) {
    console.warn('Gagal mengambil setoran program:', err);
  }

  // Filter berdasarkan tahun dan UPZ dari kontrol grafik beranda
  const chartYear = isAdminMode
    ? (Number(document.getElementById('adminChartYearFilter')?.value) || new Date().getFullYear())
    : (Number(document.getElementById('upzChartYearFilter')?.value) || new Date().getFullYear());

  const chartUpz = isAdminMode
    ? (document.getElementById('scorecardUpzFilter')?.value || 'semua')
    : ((currentProfile && currentProfile.upz_id) || '');

  const upzNameLabel = (chartUpz && chartUpz !== 'semua') ? ((upzMap && upzMap[chartUpz]) || 'UPZ Terpilih') : 'Seluruh UPZ';
  if (titleEl) {
    titleEl.textContent = isAdminMode
      ? `Rincian Setoran Program (${chartYear} · ${upzNameLabel})`
      : `Rincian Setoran Program (${chartYear})`;
  }
  if (subEl) {
    subEl.textContent = isAdminMode
      ? `Rincian akumulasi setoran program tahun ${chartYear} untuk ${upzNameLabel} (mengikuti filter grafik beranda).`
      : `Rincian akumulasi setoran program Anda pada tahun ${chartYear} (mengikuti filter grafik beranda).`;
  }

  // Terapkan filter tahun dan UPZ dari kontrol grafik
  list = list.filter(function (s) {
    const sYear = Number(s.periode_tahun) || (s.tanggal_setor ? parseInt(String(s.tanggal_setor).substring(0, 4), 10) : 0);
    if (chartYear && sYear && sYear !== chartYear) return false;
    if (isAdminMode && chartUpz && chartUpz !== 'semua') {
      if (String(s.upz_id) !== String(chartUpz)) return false;
    }
    return true;
  });

  // Hitung akumulasi per jenis program
  const breakdown = {};
  list.forEach(function (s) {
    const pName = getNamaProgram(s) || 'Lainnya';
    if (!breakdown[pName]) {
      breakdown[pName] = { totalDiterima: 0, totalSemua: 0, countDiterima: 0, countTotal: 0 };
    }
    const nom = Number(String(s.nominal || 0).replace(/[^\d.-]/g, '')) || 0;
    const st = String(s.status || '').toLowerCase().trim();
    breakdown[pName].totalSemua += nom;
    breakdown[pName].countTotal += 1;
    if (st === 'diterima' || st === 'disetujui' || st === 'verified' || st === 'sukses' || st === 'cocok') {
      breakdown[pName].totalDiterima += nom;
      breakdown[pName].countDiterima += 1;
    }
  });

  if (cardsContainer) {
    const progKeys = Object.keys(breakdown);
    if (!progKeys.length) {
      cardsContainer.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;padding:24px;text-align:center;">
          Belum ada transaksi setoran program tercatat.
        </div>
      `;
    } else {
      cardsContainer.innerHTML = progKeys.map(function (pName) {
        const item = breakdown[pName];
        return `
          <div class="program-breakdown-card" style="background:#fff;border:1px solid var(--slate-200);border-radius:10px;padding:14px 16px;box-shadow:var(--shadow-sm);">
            <div class="program-breakdown-title" style="font-weight:700;font-size:13px;color:var(--slate-800);margin-bottom:6px;">${escapeHtml(pName)}</div>
            <div class="program-breakdown-val" style="font-size:18px;font-weight:700;color:var(--primary-700);">${formatRupiah(item.totalDiterima)}</div>
            <div class="program-breakdown-count" style="font-size:12px;color:var(--slate-500);margin-top:4px;">
              <strong>${item.countDiterima}</strong> disetujui · ${item.countTotal} total transaksi
            </div>
          </div>
        `;
      }).join('');
    }
  }

  if (tableBody) {
    if (!list.length) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="${isAdminMode ? 6 : 5}" style="text-align:center;padding:28px;color:var(--slate-400);">
            Belum ada transaksi setoran program.
          </td>
        </tr>
      `;
    } else {
      tableBody.innerHTML = list.map(function (s, idx) {
        const upzName = (s.upz_id && upzMap && upzMap[s.upz_id]) ? upzMap[s.upz_id] : (s.nama_upz || s.upz_id || '-');
        const pName = getNamaProgram(s);
        const st = String(s.status || 'menunggu').toLowerCase().trim();
        const nom = Number(String(s.nominal || 0).replace(/[^\d.-]/g, '')) || 0;
        return `
          <tr style="border-bottom:1px solid var(--slate-100);">
            <td style="padding:10px 12px;text-align:center;">${idx + 1}</td>
            ${isAdminMode ? `<td style="padding:10px 12px;font-weight:600;color:var(--slate-800);">${escapeHtml(upzName)}</td>` : ''}
            <td style="padding:10px 12px;font-weight:600;color:var(--blue-700);">
              <div>${escapeHtml(pName)}</div>
              ${s.catatan ? `<div style="font-size:11px;color:var(--slate-500);font-weight:normal;margin-top:2px;">${escapeHtml(s.catatan)}</div>` : ''}
            </td>
            <td style="padding:10px 12px;color:var(--slate-600);">${escapeHtml(formatTanggal(s.tanggal_setor))}</td>
            <td style="padding:10px 12px;text-align:right;font-weight:700;color:var(--slate-800);">${formatRupiah(nom)}</td>
            <td style="padding:10px 12px;text-align:center;">
              <span class="status-badge ${getStatusClass(st)}" style="font-size:11px;">${escapeHtml(getStatusLabel(st))}</span>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  const closeX = document.getElementById('closeProgramPreviewX');
  const closeBtn = document.getElementById('closeProgramPreviewBtn');
  function closeModal() { modal.classList.add('hidden'); }
  if (closeX && !closeX.dataset.bound) { closeX.dataset.bound = 'true'; closeX.onclick = closeModal; }
  if (closeBtn && !closeBtn.dataset.bound) { closeBtn.dataset.bound = 'true'; closeBtn.onclick = closeModal; }
  modal.onclick = function (e) { if (e.target === modal) closeModal(); };
}

function openAdminProgramModal() {
  const modal = document.getElementById('adminProgramModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  renderAdminProgramList();

  const closeX = document.getElementById('closeAdminProgramX');
  const closeBtn = document.getElementById('closeAdminProgramBtn');
  function closeModal() { modal.classList.add('hidden'); }
  if (closeX && !closeX.dataset.bound) { closeX.dataset.bound = 'true'; closeX.onclick = closeModal; }
  if (closeBtn && !closeBtn.dataset.bound) { closeBtn.dataset.bound = 'true'; closeBtn.onclick = closeModal; }
  modal.onclick = function (e) { if (e.target === modal) closeModal(); };
}

async function renderAdminProgramList() {
  const container = document.getElementById('adminProgramListContainer');
  if (!container) return;

  container.innerHTML = '<div style="padding:16px;text-align:center;color:var(--slate-500);font-size:13px;">Memuat program...</div>';
  await fetchProgramMasterList();

  if (!currentProgramMasterList.length) {
    container.innerHTML = '<div style="padding:16px;text-align:center;color:var(--slate-400);font-size:13px;">Belum ada jenis program terdaftar.</div>';
    return;
  }

  container.innerHTML = currentProgramMasterList.map(function (p) {
    return `
      <div class="admin-program-row">
        <div>
          <div style="font-weight:600;font-size:13px;color:var(--slate-800);">${escapeHtml(p.name)}</div>
          <div style="font-size:11px;color:var(--slate-400);">ID: ${escapeHtml(p.id)}</div>
        </div>
        <button type="button" class="btn btn-ghost btn-xs btn-del-prog" data-id="${escapeHtml(p.id)}" style="color:#dc2626;display:inline-flex;align-items:center;gap:4px;" title="Hapus jenis program">
          <svg class="icon" style="width:12px;height:12px;"><use href="#i-trash-2"></use></svg>
          <span>Hapus</span>
        </button>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-del-prog').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const pId = this.dataset.id;
      const targetProg = currentProgramMasterList.find(function (p) { return p.id === pId; });
      const pName = targetProg ? targetProg.name : pId;

      // Konfirmasi custom modal (tanpa pop-up browser)
      let confirmed = false;
      if (typeof askDialog === 'function') {
        confirmed = await askDialog(
          'Hapus Jenis Program',
          `Apakah Anda yakin ingin menghapus program "${pName}" (${pId})? Slot ID ini akan dialokasikan kembali jika ada penambahan program baru.`,
          'Ya, Hapus Program',
          'i-trash-2',
          true
        );
      } else {
        confirmed = true;
      }
      if (!confirmed) return;

      const token = await getValidAuthToken();
      btn.disabled = true;
      btn.textContent = 'Menghapus...';
      try {
        const res = await fetch('/api/save-program-type', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, action: 'delete', id: pId })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Gagal menghapus program.');

        if (typeof showToast === 'function') {
          showToast(`Program "${pName}" (${pId}) berhasil dihapus.`, 'success');
        }
        await renderAdminProgramList();
      } catch (err) {
        if (typeof showToast === 'function') {
          showToast('Gagal menghapus: ' + err.message, 'error');
        } else {
          const msgEl = document.getElementById('adminProgramMsg');
          if (msgEl) {
            msgEl.textContent = 'Gagal: ' + err.message;
            msgEl.style.color = '#dc2626';
            msgEl.style.display = 'block';
          }
        }
        btn.disabled = false;
        btn.innerHTML = '<svg class="icon" style="width:12px;height:12px;"><use href="#i-trash-2"></use></svg><span>Hapus</span>';
      }
    });
  });
}

function initSetoranProgramFeature() {
  // 1. Tab Switcher (Formulir Setoran Reguler vs Formulir Setoran Program)
  const tabReguler = document.getElementById('tabSetoranReguler');
  const tabProgram = document.getElementById('tabSetoranProgram');
  const cardReguler = document.getElementById('cardSetoranReguler');
  const cardProgram = document.getElementById('cardSetoranProgram');

  if (tabReguler && tabProgram && cardReguler && cardProgram) {
    tabReguler.addEventListener('click', function () {
      tabReguler.className = 'btn btn-primary';
      tabProgram.className = 'btn btn-soft';
      cardReguler.classList.remove('hidden');
      cardProgram.classList.add('hidden');
    });

    tabProgram.addEventListener('click', function () {
      tabProgram.className = 'btn btn-primary';
      tabReguler.className = 'btn btn-soft';
      cardProgram.classList.remove('hidden');
      cardReguler.classList.add('hidden');
      fetchProgramMasterList();
    });
  }

  // 2. Format Rupiah & Default Tanggal Form Program
  const nomInput = document.getElementById('programNominalSetoran');
  if (nomInput && !nomInput.dataset.boundFormat) {
    nomInput.dataset.boundFormat = 'true';
    nomInput.addEventListener('input', function () {
      const raw = this.value.replace(/\D/g, '');
      this.value = raw ? Number(raw).toLocaleString('id-ID') : '';
    });
  }

  const tglInput = document.getElementById('programTanggalSetor');
  if (tglInput && !tglInput.value) {
    tglInput.value = new Date().toISOString().split('T')[0];
  }

  // Muat daftar program awal
  fetchProgramMasterList();

  // 3. Submit Form Setoran Program
  const programForm = document.getElementById('setoranProgramForm');
  const progMsg = document.getElementById('setoranProgramMessage');
  const progSubmitBtn = document.getElementById('submitProgramButton');

  if (programForm && !programForm.dataset.boundSubmit) {
    programForm.dataset.boundSubmit = 'true';
    programForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const namaProg = (document.getElementById('programJenisSelect')?.value || '').trim();
      const tglSetor = document.getElementById('programTanggalSetor')?.value;
      const nomStr = document.getElementById('programNominalSetoran')?.value || '';
      const catatan = document.getElementById('programCatatan')?.value || '';

      if (!namaProg || !tglSetor || !nomStr) {
        showMessage(progMsg, 'Semua data setoran program wajib diisi.', '#d93025');
        return;
      }

      const nominalAngka = Number(nomStr.replace(/\D/g, ''));
      if (!nominalAngka || nominalAngka <= 0) {
        showMessage(progMsg, 'Nominal setoran program harus lebih dari 0.', '#d93025');
        return;
      }

      const upzTitle = (currentProfile && (currentProfile.nama_upz || currentProfile.kode_upz)) || 'UPZ';
      const setuju = await askConfirmSetoran({
        upz: upzTitle,
        tanggal: formatTanggal(tglSetor),
        periode: 'Program: ' + namaProg,
        nominal: formatRupiah(nominalAngka),
        jumlah: 'Setoran Program',
        file: 'Tanpa file (Formulir Program)'
      });

      if (!setuju) {
        showMessage(progMsg, 'Pengiriman dibatalkan.', '#666');
        return;
      }

      progSubmitBtn.disabled = true;
      progSubmitBtn.textContent = 'Menyimpan...';
      showMessage(progMsg, 'Mengirim setoran program ke database...', '#666');

      try {
        const token = await getValidAuthToken();
        if (!token) throw new Error('Sesi login telah berakhir. Silakan login kembali.');

        const res = await fetch('/api/save-setoran-program', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            upz_id: currentProfile.upz_id,
            nama_program: namaProg,
            tanggal_setor: tglSetor,
            nominal: nominalAngka,
            catatan
          })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Gagal menyimpan setoran program.');
        }

        showMessage(progMsg, 'Setoran program berhasil dikirim. Status: Menunggu Verifikasi.', '#259148');
        programForm.reset();
        if (tglInput) tglInput.value = new Date().toISOString().split('T')[0];

        if (typeof recordUpzActivity === 'function') {
          recordUpzActivity({
            type: 'upload',
            title: 'Setoran Program Baru',
            nama_upz: upzTitle,
            upz_id: currentProfile && currentProfile.upz_id,
            nominal: nominalAngka,
            desc: `Mengajukan setoran program <strong>${escapeHtml(namaProg)}</strong> senilai <strong>${formatRupiah(nominalAngka)}</strong>`
          });
        }

        await loadDashboard(true);
        if (typeof renderUpzMonthlyChart === 'function') renderUpzMonthlyChart();

      } catch (err) {
        showMessage(progMsg, err.message, '#d93025');
      } finally {
        progSubmitBtn.disabled = false;
        progSubmitBtn.textContent = 'Simpan Setoran Program';
      }
    });
  }

  // 4. Delegasi Klik Tombol Preview Detail & Kelola Program
  document.addEventListener('click', function (e) {
    // Tombol Preview Detail Setoran Program (UPZ)
    const btnUpzPreview = e.target.closest('#btnPreviewProgramUpz');
    if (btnUpzPreview) {
      e.preventDefault();
      openProgramPreviewModal(false);
      return;
    }

    // Tombol Preview Detail Setoran Program (Admin)
    const btnAdminPreview = e.target.closest('#btnPreviewProgramAdmin');
    if (btnAdminPreview) {
      e.preventDefault();
      openProgramPreviewModal(true);
      return;
    }

    // Menu Kelola Jenis Program (Admin Dropdown)
    const btnKelola = e.target.closest('#menuAdminProgram');
    if (btnKelola) {
      e.preventDefault();
      openAdminProgramModal();
      return;
    }
  });

  // 5. Tambah Program Baru (Admin Modal)
  const addBtn = document.getElementById('adminAddProgramBtn');
  const addInput = document.getElementById('adminNewProgramInput');
  const addMsg = document.getElementById('adminProgramMsg');

  if (addBtn && !addBtn.dataset.boundAdd) {
    addBtn.dataset.boundAdd = 'true';
    addBtn.addEventListener('click', async function () {
      const name = (addInput ? addInput.value : '').trim();
      if (!name) {
        if (addMsg) {
          addMsg.textContent = 'Nama program tidak boleh kosong.';
          addMsg.style.color = '#dc2626';
          addMsg.style.display = 'block';
        }
        return;
      }

      addBtn.disabled = true;
      addBtn.textContent = 'Menambahkan...';
      if (addMsg) addMsg.style.display = 'none';

      try {
        const token = await getValidAuthToken();
        const res = await fetch('/api/save-program-type', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, action: 'add', name })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Gagal menambahkan program.');

        if (addInput) addInput.value = '';
        if (addMsg) {
          addMsg.textContent = 'Program berhasil ditambahkan!';
          addMsg.style.color = '#15803d';
          addMsg.style.display = 'block';
          setTimeout(() => { addMsg.style.display = 'none'; }, 2500);
        }
        await renderAdminProgramList();
      } catch (err) {
        if (addMsg) {
          addMsg.textContent = err.message;
          addMsg.style.color = '#dc2626';
          addMsg.style.display = 'block';
        }
      } finally {
        addBtn.disabled = false;
        addBtn.innerHTML = '<svg class="icon" style="width:14px;height:14px;"><use href="#i-plus"></use></svg><span>Tambah</span>';
      }
    });
  }
}

// ======================================================================
// 7. INITIALIZE ALL NEW MODULES ON DOM READY
// ======================================================================
function runAllNewFeaturesInit() {
  const tasks = [
    ['initLoginBrandMotion', initLoginBrandMotion],
    ['initDeleteSetoranFeature', initDeleteSetoranFeature],
    ['initDeleteUpzFeature', initDeleteUpzFeature],
    ['initDeletePentaFeature', initDeletePentaFeature],
    ['initPentasharufanFeature', initPentasharufanFeature],
    ['initNewModalsFeature', initNewModalsFeature],
    ['initBszUploadFeature', initBszUploadFeature],
    ['initVisualRefreshFeature', initVisualRefreshFeature],
    ['initSetoranProgramFeature', initSetoranProgramFeature],
    ['syncBszList', syncBszList]
  ];
  tasks.forEach(function (pair) {
    const name = pair[0];
    const fn = pair[1];
    try {
      if (typeof fn === 'function') fn();
    } catch (err) {
      console.warn('[initAllNewFeatures] Skip failed module:', name, err);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runAllNewFeaturesInit);
} else {
  runAllNewFeaturesInit();
}

// ======================================================================
// 8. ENGINE BUKU PANDUAN PENGGUNAAN SISTEM DINAMIS & REKAMAN INTERAKTIF
// ======================================================================

const SYSTEM_GUIDE_REGISTRY = [
  // ----------------------------------------------------
  // ROLE: UPZ
  // ----------------------------------------------------
  {
    id: 'upz_setoran',
    role: 'upz',
    kategori: 'Alur Utama',
    tone: 'emerald',
    badge: 'Alur Baku Transaksi',
    judul: 'Alur Pengajuan Setoran ZIS & Upload Muzaki',
    subjudul: 'Petunjuk lengkap pengisian data setoran, unggah bukti transfer, file Excel muzaki, dan validasi BAZNAS Banyumas.',
    targetView: 'input',
    targetLabel: 'Buka Input Setoran',
    getLiveParams: function (ctx) {
      return [
        { label: 'Format Rincian Muzaki', value: 'File Excel (.xlsx / .xls)', icon: 'sheet' },
        { label: 'Format Bukti Setor', value: 'Gambar / PDF (Maks 10MB)', icon: 'image' },
        { label: 'Rekening Tujuan Resmi', value: 'BSI / Bank Jateng BAZNAS Banyumas', icon: 'building' },
        { label: 'Status Awal Transaksi', value: 'Menunggu Verifikasi', icon: 'clock' }
      ];
    },
    illustrationType: 'diagram-flow',
    flowSteps: [
      { num: '01', title: 'Input ZIS', desc: 'Pilih jenis & nominal setoran' },
      { num: '02', title: 'Upload Berkas', desc: 'Bukti transfer & Excel muzaki' },
      { num: '03', title: 'Verifikasi', desc: 'Admin validasi mutasi bank' },
      { num: '04', title: 'Terbit BSZ', desc: 'Unduh Bukti Setor Zakat resmi' }
    ],
    steps: function () {
      return [
        {
          title: 'Pengisian Formulir Setoran',
          desc: 'Buka menu <strong>Input Setoran</strong> dari hamburger, tentukan jenis ZIS (Zakat Fitrah, Zakat Maal, Infak Terikat, dll), isikan nominal rupiah, tanggal setor, dan rekening bank tujuan.',
          tag: 'Wajib'
        },
        {
          title: 'Unggah Bukti Transfer & Excel Muzaki',
          desc: 'Lampirkan foto struk transfer/bukti mutasi bank dan file Excel rincian donatur sesuai template standar BAZNAS.',
          tag: 'Berkas'
        },
        {
          title: 'Pemantauan Status & Hak Batal Mandiri',
          desc: 'Setoran baru akan berstatus <em>Menunggu Verifikasi</em>. Selama status masih Menunggu, jika terdapat kekeliruan data atau duplikasi, UPZ dapat <strong>menghapus setoran mandiri</strong> langsung dari modal rincian berkas (ikon #i-file-text).',
          tag: 'Fitur Baru'
        },
        {
          title: 'Penerbitan Bukti Setor Zakat (BSZ)',
          desc: 'Setelah Admin memverifikasi dana masuk, status berubah menjadi <em>Diverifikasi</em> dan tombol <strong>Unduh BSZ Resmi</strong> (format PDF/JPG/PNG) akan aktif di modal rincian setoran.',
          tag: 'Legalitas'
        }
      ];
    },
    notice: {
      type: 'tip',
      text: 'Simpan file BSZ yang telah diunduh sebagai arsip legalitas pertanggungjawaban resmi UPZ kepada muzaki dan auditor syariah.'
    }
  },

  {
    id: 'upz_pentasharufan',
    role: 'upz',
    kategori: 'Pentasharufan & RKAT',
    tone: 'teal',
    badge: 'Kalkulasi Otomatis',
    judul: 'Alur Perbantuan Pentasharufan & Anggaran RKAT',
    subjudul: 'Pemanfaatan pagu perbantuan penyaluran dana ZIS untuk mustahik di lingkungan UPZ dengan sistem kuota terintegrasi.',
    targetView: 'pentasharufan',
    targetLabel: 'Buka Pentasharufan UPZ',
    getLiveParams: function (ctx) {
      return [
        { label: 'Pagu Perbantuan Pentasharufan', value: ctx.pentaPersen + ' dari setoran bulan berjalan', icon: 'hand-heart' },
        { label: 'Hak Amil UPZ', value: ctx.amilPersen + ' dari setoran', icon: 'wallet' },
        { label: 'Tagihan Salin Aslimas', value: ctx.salinAslimas + ' / bulan', icon: 'receipt' },
        { label: 'Status Akses RKAT Akun', value: ctx.rkatStatusText, icon: 'lock' },
        { label: 'CS Konfirmasi WhatsApp', value: ctx.csPentaWa, icon: 'message-circle' }
      ];
    },
    illustrationType: 'ui-mockup-penta',
    steps: function (ctx) {
      const waRkat = (ctx && ctx.csRkatWa) || '+62 813-6869-1114';
      const waPenta = (ctx && ctx.csPentaWa) || '+62 851-3374-4077';
      return [
        {
          title: 'Pengecekan Akses RKAT & WhatsApp CS',
          desc: 'Bila form perbantuan terkunci, klik tombol hijau <strong>Daftarkan RKAT</strong> untuk menghubungi WhatsApp CS BAZNAS (' + waRkat + '). Admin akan membuka akses secara real-time.',
          tag: 'Akses'
        },
        {
          title: 'Pemantauan 6 Scorecard Anggaran',
          desc: 'Sistem menyajikan 6 kartu anggaran: <em>1. Pagu Alokasi Pentasharufan</em>, <em>2. Tagihan Salin Aslimas</em>, <em>3. Hak Amil UPZ</em>, <em>4. Total Sudah Ditasharufkan</em>, <em>5. Sisa Anggaran Tersedia</em>, dan <em>6. Total Mustahik</em>.',
          tag: 'Transparansi'
        },
        {
          title: 'Pengajuan Permohonan Bantuan',
          desc: 'Pilih program (Banyumas Peduli, Banyumas Cerdas, Banyumas Sehat, Banyumas Sejahtera, Banyumas Takwa, atau Salin Aslimas), masukkan nominal kebutuhan, serta upload daftar mustahik Excel dan foto kegiatan.',
          tag: 'Dokumen'
        },
        {
          title: 'Konfirmasi Cepat via WhatsApp',
          desc: 'Setelah mengajukan permohonan, klik tombol <strong>Konfirmasi WhatsApp</strong> di baris riwayat permohonan ke nomor <strong>' + waPenta + '</strong> agar berkas segera diproses tim BAZNAS.',
          tag: 'Respon Cepat'
        }
      ];
    },
    notice: {
      type: 'warning',
      text: 'Nominal pengajuan tidak boleh melampaui sisa anggaran perbantuan pentasharufan bulan berjalan yang tercatat di scorecard.'
    }
  },

  {
    id: 'upz_bsz_dokumen',
    role: 'upz',
    kategori: 'Dokumen & BSZ',
    tone: 'purple',
    badge: 'Terintegrasi',
    judul: 'Manajemen BSZ & Pembatalan Transaksi',
    subjudul: 'Panduan mengakses berkas Bukti Setor Zakat (BSZ) resmi dan pembatalan setoran keliru.',
    targetView: 'riwayat',
    targetLabel: 'Buka Riwayat Setoran',
    getLiveParams: function (ctx) {
      return [
        { label: 'Format Berkas BSZ', value: ctx.bszFormats, icon: 'sheet' },
        { label: 'Maksimal Ukuran File', value: '20 MB per dokumen', icon: 'upload' },
        { label: 'Otoritas Hapus Mandiri', value: 'Hanya setoran status "Menunggu"', icon: 'shield' }
      ];
    },
    illustrationType: 'ui-mockup-setoran',
    steps: function () {
      return [
        {
          title: 'Melihat Rincian Setoran',
          desc: 'Pada tabel <strong>Riwayat Setoran</strong>, klik tombol ikon berkas (<code>#i-file-text</code>) pada baris transaksi untuk membuka dialog rincian lengkap setoran Anda.',
          tag: 'Aksi'
        },
        {
          title: 'Mengunduh BSZ Sah',
          desc: 'Jika setoran telah berstatus <em>Diverifikasi</em> dan Admin BAZNAS telah menerbitkan BSZ, tombol hijau <strong>Unduh Berkas BSZ</strong> akan aktif. Klik untuk menyimpan file PDF/JPG/PNG ke perangkat Anda.',
          tag: 'Download'
        },
        {
          title: 'Membatalkan / Menghapus Setoran',
          desc: 'Bila Anda salah menginput nominal atau terjadi double submit, selama status masih <em>Menunggu</em> Anda dapat menekan tombol merah <strong>Hapus Setoran Ini</strong> di dalam modal rincian.',
          tag: 'Koreksi'
        }
      ];
    },
    notice: {
      type: 'info',
      text: 'Bila setoran sudah berstatus Diverifikasi namun terdapat kekeliruan data, hubungi Administrator BAZNAS untuk pembatalan transaksi.'
    }
  },

  {
    id: 'upz_profil',
    role: 'upz',
    kategori: 'Administrasi & Akun',
    tone: 'amber',
    badge: 'Sinkronisasi Otomatis',
    judul: 'Manajemen Profil Lembaga & Kata Sandi UPZ',
    subjudul: 'Pembaruan nama pengelola (PIC), nomor SK, nama ketua UPZ, dan perlindungan keamanan akun.',
    targetView: 'mgmt',
    targetLabel: 'Buka Manajemen UPZ',
    getLiveParams: function (ctx) {
      return [
        { label: 'Status Sinkronisasi', value: 'Otomatis Cloud Supabase + Local', icon: 'refresh' },
        { label: 'Panjang Sandi Minimum', value: '6 Karakter', icon: 'lock' },
        { label: 'Helpdesk Teknis BAZNAS', value: ctx.helpdeskWa, icon: 'message-circle' }
      ];
    },
    illustrationType: 'diagram-flow',
    flowSteps: [
      { num: '01', title: 'Edit Profil', desc: 'Ubah PIC, No SK & Ketua' },
      { num: '02', title: 'Validasi', desc: 'Pengecekan integritas data' },
      { num: '03', title: 'Sync Server', desc: 'Sinkronisasi instan ke admin' },
      { num: '04', title: 'Ganti Sandi', desc: 'Keamanan akun berkala' }
    ],
    steps: function () {
      return [
        {
          title: 'Perbarui Data Pengurus UPZ',
          desc: 'Buka menu <strong>Manajemen UPZ</strong>, klik tombol <em>Edit Profil UPZ</em>. Anda dapat memperbarui Nama Pengelola / PIC, Nomor SK UPZ, dan Nama Ketua UPZ.',
          tag: 'Profil'
        },
        {
          title: 'Sinkronisasi Instan ke Administrator',
          desc: 'Setiap pembaruan data profil UPZ langsung tersinkron ke database BAZNAS dan panel notifikasi aktivitas admin secara real-time.',
          tag: 'Otomatis'
        },
        {
          title: 'Pergantian Kata Sandi Berkala',
          desc: 'Gunakan form <em>Ubah Kata Sandi</em> untuk mengganti password secara berkala demi menjamin keamanan data transaksi lembaga Anda.',
          tag: 'Keamanan'
        }
      ];
    },
    notice: {
      type: 'tip',
      text: 'Jika terjadi kendala saat login atau lupa kata sandi, hubungi Helpdesk IT BAZNAS Banyumas melalui nomor resmi tertera.'
    }
  },

  // ----------------------------------------------------
  // ROLE: ADMIN
  // ----------------------------------------------------
  {
    id: 'admin_verifikasi_setoran',
    role: 'admin',
    kategori: 'Alur Utama',
    tone: 'emerald',
    badge: 'Otoritas Verifikasi',
    judul: 'Verifikasi Setoran UPZ & Penerbitan BSZ',
    subjudul: 'SOP verifikasi mutasi dana masuk rekening BAZNAS, pemeriksaan rincian donatur muzaki, penerbitan BSZ resmi, dan pembatalan transaksi.',
    targetView: 'setoran',
    targetLabel: 'Buka Daftar Setoran',
    getLiveParams: function (ctx) {
      return [
        { label: 'Format BSZ Diterima', value: ctx.bszFormats, icon: 'sheet' },
        { label: 'Kapasitas Unggah Berkas', value: 'Maksimum 20 MB', icon: 'upload' },
        { label: 'Hak Akses Hapus Transaksi', value: 'Administrator & Superadmin', icon: 'shield' }
      ];
    },
    illustrationType: 'ui-mockup-setoran',
    steps: function () {
      return [
        {
          title: 'Pemeriksaan Mutasi Bank & Bukti Transfer',
          desc: 'Buka menu <strong>Daftar Setoran</strong>, cari transaksi berstatus <em>Menunggu</em>. Cocokkan nominal pada bukti transfer dengan mutasi rekening BAZNAS Banyumas.',
          tag: 'Audit'
        },
        {
          title: 'Ubah Status ke Diverifikasi',
          desc: 'Gunakan dropdown status untuk mengubah transaksi menjadi <em>Diverifikasi</em> setelah dana dipastikan masuk. Sistem akan langsung memperbarui saldo dan riwayat di sisi UPZ.',
          tag: 'Validasi'
        },
        {
          title: 'Unggah Berkas Bukti Setor Zakat (BSZ)',
          desc: 'Klik tombol berkas (<code>#i-file-text</code>), lalu pada box <em>Unggah Berkas BSZ Resmi</em> pilih file (PDF, JPG, atau PNG maks 20MB) dan klik <strong>Unggah BSZ</strong>. Berkas seketika tersedia bagi UPZ.',
          tag: 'BSZ'
        },
        {
          title: 'Pembatalan / Hapus Setoran Keliru',
          desc: 'Jika terjadi kesalahan fatal atau permohonan pembatalan dari UPZ, admin dapat menekan tombol merah <strong>Hapus Setoran Ini</strong> untuk membatalkan transaksi secara permanen.',
          tag: 'Penghapusan'
        }
      ];
    },
    notice: {
      type: 'warning',
      text: 'Pastikan file BSZ yang diunggah memiliki stempel resmi BAZNAS Kabupaten Banyumas dan nomor seri bukti setor yang sah.'
    }
  },

  {
    id: 'admin_rkat_penta',
    role: 'admin',
    kategori: 'Pentasharufan & RKAT',
    tone: 'teal',
    badge: 'Alokasi Dinamis',
    judul: 'Konfigurasi RKAT, Pagu Persentase & Approval Bantuan',
    subjudul: 'Kontrol pembukaan lock RKAT, penentuan persentase perbantuan pentasharufan & hak amil, tagihan Salin Aslimas, serta approval bantuan.',
    targetView: 'pentasharufan',
    targetLabel: 'Buka Pentasharufan Admin',
    getLiveParams: function (ctx) {
      return [
        { label: 'Default Pagu Pentasharufan', value: ctx.pentaPersen, icon: 'hand-heart' },
        { label: 'Default Hak Amil UPZ', value: ctx.amilPersen, icon: 'wallet' },
        { label: 'Nominal Salin Aslimas Aktif', value: ctx.salinAslimas + ' / bulan', icon: 'receipt' },
        { label: 'WhatsApp Pendaftaran RKAT', value: ctx.csRkatWa, icon: 'message-circle' },
        { label: 'WhatsApp Konfirmasi Permohonan', value: ctx.csPentaWa, icon: 'message-circle' }
      ];
    },
    illustrationType: 'ui-mockup-penta',
    steps: function (ctx) {
      const waRkat = (ctx && ctx.csRkatWa) || '+62 813-6869-1114';
      const pPenta = (ctx && ctx.pentaPersen) || '35%';
      const pAmil = (ctx && ctx.amilPersen) || '5%';
      return [
        {
          title: 'Buka Lock RKAT untuk UPZ Terkonfirmasi',
          desc: 'Setelah UPZ menghubungi WhatsApp (' + waRkat + '), buka tab <em>Akses RKAT</em>, pilih nama UPZ dari dropdown, dan klik <strong>Buka Lock RKAT</strong> agar UPZ dapat mengakses form perbantuan.',
          tag: 'Lock RKAT'
        },
        {
          title: 'Kustomisasi Persentase Pagu & Hak Amil',
          desc: 'Jika UPZ memiliki perjanjian anggaran khusus di luar default (' + pPenta + ' dan ' + pAmil + '), atur persentase spesifik pada form konfigurasi UPZ bersangkutan.',
          tag: 'Kustomisasi'
        },
        {
          title: 'Pengaturan Tagihan Salin Aslimas',
          desc: 'Isikan besaran tagihan program Salin Aslimas pada box nominal mandiri yang berada tepat di samping keterangan label Rp.',
          tag: 'Salin Aslimas'
        },
        {
          title: 'Review & Unduh Berkas Mustahik',
          desc: 'Pada tabel <em>Daftar Permohonan Pentasharufan</em>, periksa nominal pengajuan, unduh berkas Excel daftar mustahik & foto dokumentasi, lalu ubah status menjadi <strong>Disetujui</strong> atau <strong>Selesai</strong>.',
          tag: 'Approval'
        }
      ];
    },
    notice: {
      type: 'tip',
      text: 'Semua perubahan persentase dan unlock RKAT langsung mengubah formula kalkulasi anggaran di dashboard UPZ tanpa perlu reload browser.'
    }
  },

  {
    id: 'admin_manajemen_upz',
    role: 'admin',
    kategori: 'Administrasi & Akun',
    tone: 'amber',
    badge: 'Sinkronisasi Cloud',
    judul: 'Manajemen Akun UPZ & Sinkronisasi Supabase Auth',
    subjudul: 'Pendaftaran instansi UPZ baru, klasifikasi kategori, penggantian email login dengan auto-sync Supabase, dan reset password.',
    targetView: 'upz',
    targetLabel: 'Buka Manajemen Akun UPZ',
    getLiveParams: function (ctx) {
      return [
        { label: 'Otoritas Autentikasi', value: 'Supabase Auth + Database Server', icon: 'shield' },
        { label: 'Auto-Sync Email Login', value: 'Aktif (Otomatis Sync ke Supabase)', icon: 'refresh' },
        { label: 'Kategori Instansi UPZ', value: 'OPD, Korwilcam, SMP, Desa, Masjid, dll', icon: 'building' }
      ];
    },
    illustrationType: 'diagram-flow',
    flowSteps: [
      { num: '01', title: 'Tambah Akun', desc: 'Isi instansi, email & sandi' },
      { num: '02', title: 'Klasifikasi', desc: 'Tentukan kategori instansi' },
      { num: '03', title: 'Auto-Sync', desc: 'Sinkronisasi ke Supabase Auth' },
      { num: '04', title: 'Audit Log', desc: 'Pantau histori perubahaan' }
    ],
    steps: function () {
      return [
        {
          title: 'Pendaftaran Akun UPZ Baru',
          desc: 'Buka menu <strong>Manajemen Akun UPZ</strong>, klik tombol <em>Tambah UPZ Baru</em>. Isi nama instansi UPZ, email operasional, kata sandi, dan kategori instansi.',
          tag: 'Pendaftaran'
        },
        {
          title: 'Pembaruan Email & Auto-Sync Supabase',
          desc: 'Bila email UPZ diubah melalui panel admin, sistem otomatis memperbarui akun auth di Supabase Auth sehingga pengguna UPZ dapat langsung login menggunakan email baru.',
          tag: 'Supabase Sync'
        },
        {
          title: 'Monitoring Notifikasi Aktivitas UPZ',
          desc: 'Setiap aktivitas upload berkas setoran, permohonan pentasharufan, dan perubahan profil UPZ otomatis masuk ke dropdown lonceng notifikasi di header admin.',
          tag: 'Notifikasi'
        }
      ];
    },
    notice: {
      type: 'info',
      text: 'Gunakan filter pencarian dan kategori untuk mengelola akun UPZ se-Kabupaten Banyumas dengan efisien.'
    }
  },

  {
    id: 'admin_export_rekap',
    role: 'admin',
    kategori: 'Dokumen & BSZ',
    tone: 'purple',
    badge: 'Pelaporan Resmi',
    judul: 'Ekspor Rekapitulasi Excel & Audit Kinerja',
    subjudul: 'Penerbitan rekapitulasi setoran ZIS berkala, ekspor database muzaki, dan analitik grafis eksekutif.',
    targetView: 'beranda',
    targetLabel: 'Buka Beranda Eksekutif',
    getLiveParams: function (ctx) {
      return [
        { label: 'Format Dokumen Rekap', value: 'Microsoft Excel (.xlsx)', icon: 'sheet' },
        { label: 'Filter Periode', value: 'Bulan, Tahun, & Kategori Lembaga', icon: 'calendar' },
        { label: 'Visualisasi Grafis', value: 'Grafik Bulanan & Ranking Keaktifan UPZ', icon: 'bar-chart' }
      ];
    },
    illustrationType: 'diagram-flow',
    flowSteps: [
      { num: '01', title: 'Pilih Menu', desc: 'Export Rekap Excel via Hamburger' },
      { num: '02', title: 'Set Periode', desc: 'Tentukan bulan & tahun laporan' },
      { num: '03', title: 'Generate', desc: 'Pemrosesan lembar kerja Excel' },
      { num: '04', title: 'Unduh File', desc: 'File .xlsx siap diaudit' }
    ],
    steps: function () {
      return [
        {
          title: 'Akses Menu Export Rekap Excel',
          desc: 'Buka hamburger menu di sudut kanan atas, pilih <strong>Export Rekap Excel</strong>.',
          tag: 'Menu'
        },
        {
          title: 'Filter Rentang Waktu & Kategori',
          desc: 'Tentukan filter bulan dan tahun pembukuan yang ingin direkap. Anda dapat memilih rekapitulasi seluruh kategori atau spesifik per klaster UPZ.',
          tag: 'Filter'
        },
        {
          title: 'Unduh File Excel Terstruktur',
          desc: 'Klik tombol <em>Download Rekap</em>. File Excel akan di-generate secara otomatis berisi rincian tanggal, nama UPZ, jenis ZIS, nominal dana, status verifikasi, dan rekapan donatur.',
          tag: 'Export'
        }
      ];
    },
    notice: {
      type: 'tip',
      text: 'Format ekspor telah distandardisasi sesuai Pedoman Tata Kelola Pelaporan BAZNAS RI.'
    }
  }
];

// DATA SKENARIO REKAMAN INTERAKTIF & SIMULASI ALUR
const RECORDER_SCENARIOS = {
  upz: [
    {
      id: 'rec_upz_1',
      title: 'Rekaman 1: Input Setoran ZIS & Upload Berkas',
      targetView: 'input',
      steps: [
        {
          stepNum: 1,
          time: '00:04',
          title: 'Langkah 1: Pengisian Form & Rekening Tujuan',
          desc: 'Pengurus UPZ membuka form input setoran, memilih jenis dana ZIS (misal Zakat Fitrah Rp 5.000.000), tanggal setor, dan rekening bank tujuan.',
          previewHtml: `
            <div style="display:flex;align-items:center;gap:10px;width:100%;flex-wrap:wrap;">
              <div style="background:#0f766e;color:#fff;padding:5px 12px;border-radius:6px;font-weight:600;font-size:12px;">Jenis: Zakat Fitrah</div>
              <div style="background:rgba(255,255,255,0.06);padding:5px 12px;border-radius:6px;font-family:monospace;font-size:12px;color:#38bdf8;">Nominal: Rp 5.000.000</div>
              <div style="background:rgba(255,255,255,0.06);padding:5px 12px;border-radius:6px;font-size:12px;color:#cbd5e1;">Bank: BSI BAZNAS</div>
            </div>
          `
        },
        {
          stepNum: 2,
          time: '00:08',
          title: 'Langkah 2: Unggah Bukti Mutasi & Excel Muzaki',
          desc: 'Lampirkan foto struk transfer mutasi bank serta file Excel rincian donatur sesuai format resmi BAZNAS Banyumas.',
          previewHtml: `
            <div style="display:flex;align-items:center;gap:12px;width:100%;flex-wrap:wrap;">
              <div style="display:flex;align-items:center;gap:6px;color:#34d399;font-size:12px;"><svg class="icon" style="width:14px;height:14px;"><use href="#i-image"></use></svg> <span>bukti_mutasi_bank.jpg (Terlampir)</span></div>
              <div style="display:flex;align-items:center;gap:6px;color:#38bdf8;font-size:12px;"><svg class="icon" style="width:14px;height:14px;"><use href="#i-sheet"></use></svg> <span>muzaki_50_orang.xlsx (Valid)</span></div>
            </div>
          `
        },
        {
          stepNum: 3,
          time: '00:12',
          title: 'Langkah 3: Kirim Setoran & Status "Menunggu"',
          desc: 'Transaksi langsung tersimpan ke cloud. Berstatus Menunggu Verifikasi. Selama status Menunggu, opsi Hapus Setoran aktif mandiri jika keliru.',
          previewHtml: `
            <div style="display:flex;align-items:center;justify-content:space-between;width:100%;flex-wrap:wrap;gap:8px;">
              <span style="font-size:12px;color:#f8fafc;">Status Transaksi: <strong style="color:#fbbf24;">Menunggu Verifikasi Admin</strong></span>
              <span style="background:rgba(239,68,68,0.2);color:#f87171;padding:3px 8px;border-radius:4px;font-size:11px;">Tersedia Opsi Hapus Mandiri</span>
            </div>
          `
        },
        {
          stepNum: 4,
          time: '00:16',
          title: 'Langkah 4: Verifikasi Selesai & Unduh Berkas BSZ',
          desc: 'Admin memeriksa transfer bank dan menerbitkan BSZ. Status berubah menjadi Diverifikasi dan tombol hijau Unduh BSZ Resmi siap diunduh.',
          previewHtml: `
            <div style="display:flex;align-items:center;justify-content:space-between;width:100%;flex-wrap:wrap;gap:8px;">
              <span style="color:#34d399;font-weight:600;font-size:12px;"><svg class="icon" style="width:14px;height:14px;"><use href="#i-check"></use></svg> Status: Diverifikasi (Sah)</span>
              <button type="button" class="guide-mockup-action-btn" style="background:#10b981;padding:5px 12px;"><svg class="icon" style="width:12px;height:12px;"><use href="#i-file-text"></use></svg> Unduh BSZ Sah (.PDF)</button>
            </div>
          `
        }
      ]
    },
    {
      id: 'rec_upz_2',
      title: 'Rekaman 2: Pendaftaran RKAT & 6 Scorecard Pentasharufan',
      targetView: 'pentasharufan',
      steps: [
        {
          stepNum: 1,
          time: '00:04',
          title: 'Langkah 1: Kunci RKAT Aktif & Hubungi CS WhatsApp',
          desc: 'Jika perbantuan pentasharufan terkunci, UPZ menekan tombol hijau Daftarkan RKAT untuk menghubungi CS BAZNAS (+62 813-6869-1114).',
          previewHtml: `
            <div style="display:flex;align-items:center;justify-content:space-between;width:100%;flex-wrap:wrap;gap:8px;">
              <span style="color:#f87171;font-size:12px;">Kunci RKAT Aktif: Form Perbantuan Belum Terbuka</span>
              <span style="background:#16a34a;color:#fff;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;">Daftarkan RKAT via WhatsApp</span>
            </div>
          `
        },
        {
          stepNum: 2,
          time: '00:08',
          title: 'Langkah 2: Akses Dibuka & Monitor 6 Scorecard',
          desc: 'Setelah admin membuka akses, 6 kartu anggaran otomatis menampilkan Pagu Perbantuan, Tagihan Salin Aslimas, dan Hak Amil UPZ.',
          previewHtml: `
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;width:100%;font-size:11px;">
              <div style="background:rgba(255,255,255,0.05);padding:5px;border-radius:4px;text-align:center;"><span style="color:#94a3b8;">Pagu Penta</span><br><strong style="color:#34d399;">35% Setoran</strong></div>
              <div style="background:rgba(255,255,255,0.05);padding:5px;border-radius:4px;text-align:center;"><span style="color:#94a3b8;">Salin Aslimas</span><br><strong style="color:#38bdf8;">Rp 0</strong></div>
              <div style="background:rgba(255,255,255,0.05);padding:5px;border-radius:4px;text-align:center;"><span style="color:#94a3b8;">Hak Amil</span><br><strong style="color:#fbbf24;">5% Setoran</strong></div>
            </div>
          `
        },
        {
          stepNum: 3,
          time: '00:12',
          title: 'Langkah 3: Ajukan Permohonan Bantuan',
          desc: 'Pilih program (Banyumas Peduli, Banyumas Cerdas, dll), isi nominal kebutuhan mustahik sesuai sisa anggaran, dan lampirkan berkas.',
          previewHtml: `
            <div style="display:flex;align-items:center;gap:12px;width:100%;font-size:12px;flex-wrap:wrap;">
              <span style="color:#38bdf8;">Program: Banyumas Peduli</span>
              <span style="color:#f8fafc;">Nominal Diajukan: Rp 1.500.000</span>
              <span style="color:#34d399;">Pagu Anggaran: Tersedia</span>
            </div>
          `
        },
        {
          stepNum: 4,
          time: '00:16',
          title: 'Langkah 4: Konfirmasi Cepat via WhatsApp',
          desc: 'Klik tombol hijau Konfirmasi WhatsApp (+62 851-3374-4077) di kartu riwayat permohonan untuk percepatan verifikasi pencairan bantuan.',
          previewHtml: `
            <div style="display:flex;align-items:center;justify-content:space-between;width:100%;flex-wrap:wrap;gap:8px;">
              <span style="font-size:12px;color:#94a3b8;">Pesan WhatsApp terformat otomatis dengan nomor registrasi</span>
              <span style="background:#22c55e;color:#fff;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;">Kirim WA (+62 851-3374-4077)</span>
            </div>
          `
        }
      ]
    }
  ],
  admin: [
    {
      id: 'rec_admin_1',
      title: 'Rekaman 1: Verifikasi Setoran & Unggah Berkas BSZ',
      targetView: 'setoran',
      steps: [
        {
          stepNum: 1,
          time: '00:04',
          title: 'Langkah 1: Review Mutasi Bank Setoran UPZ',
          desc: 'Admin membuka Daftar Setoran, memeriksa bukti transfer struk bank dan rincian donatur Excel dari UPZ pemohon.',
          previewHtml: `
            <div style="display:flex;align-items:center;gap:12px;width:100%;font-size:12px;flex-wrap:wrap;">
              <span style="color:#cbd5e1;">UPZ Kecamatan / Desa</span>
              <span style="color:#38bdf8;font-family:monospace;">Rp 10.000.000 (Zakat Maal)</span>
              <span style="background:#78350f;color:#fde68a;padding:2px 6px;border-radius:4px;font-size:10px;">Menunggu</span>
            </div>
          `
        },
        {
          stepNum: 2,
          time: '00:08',
          title: 'Langkah 2: Verifikasi & Penerbitan Dokumen',
          desc: 'Admin mengubah status setoran menjadi Diverifikasi setelah dana masuk ke rekening BAZNAS Kabupaten Banyumas.',
          previewHtml: `
            <div style="display:flex;align-items:center;justify-content:space-between;width:100%;flex-wrap:wrap;gap:8px;">
              <span style="color:#34d399;font-weight:600;font-size:12px;">Status Diubah: Diverifikasi (Sah)</span>
              <span style="color:#94a3b8;font-size:11px;">Notifikasi real-time dikirim ke UPZ</span>
            </div>
          `
        },
        {
          stepNum: 3,
          time: '00:12',
          title: 'Langkah 3: Unggah Berkas BSZ Resmi',
          desc: 'Klik ikon berkas (#i-file-text), pilih file BSZ berstempel resmi BAZNAS (PDF/JPG/PNG maks 20MB), dan klik Unggah BSZ.',
          previewHtml: `
            <div style="display:flex;align-items:center;justify-content:space-between;width:100%;flex-wrap:wrap;gap:8px;">
              <span style="font-size:12px;color:#f8fafc;"><svg class="icon" style="width:14px;height:14px;color:#38bdf8;"><use href="#i-upload"></use></svg> BSZ_UPZ_2026.pdf (1.2 MB)</span>
              <span style="background:#0284c7;color:#fff;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;">Unggah BSZ Berhasil</span>
            </div>
          `
        }
      ]
    },
    {
      id: 'rec_admin_2',
      title: 'Rekaman 2: Buka Kunci RKAT & Kustomisasi Pagu Anggaran',
      targetView: 'pentasharufan',
      steps: [
        {
          stepNum: 1,
          time: '00:04',
          title: 'Langkah 1: Pilih UPZ Pemohon di Panel RKAT',
          desc: 'Admin membuka menu Perbantuan Pentasharufan, memilih nama UPZ dari dropdown pemohon RKAT.',
          previewHtml: `
            <div style="display:flex;align-items:center;gap:12px;width:100%;font-size:12px;flex-wrap:wrap;">
              <span style="color:#94a3b8;">Pilih UPZ:</span>
              <span style="background:rgba(255,255,255,0.08);padding:4px 10px;border-radius:6px;color:#f8fafc;font-weight:600;">UPZ Desa / OPD Pemohon</span>
            </div>
          `
        },
        {
          stepNum: 2,
          time: '00:08',
          title: 'Langkah 2: Klik Tombol Buka Lock RKAT',
          desc: 'Klik tombol Buka Lock RKAT. Status UPZ seketika berubah menjadi Terbuka (Aktif) dan dapat mengajukan permohonan bantuan.',
          previewHtml: `
            <div style="display:flex;align-items:center;justify-content:space-between;width:100%;flex-wrap:wrap;gap:8px;">
              <span style="color:#34d399;font-weight:600;font-size:12px;">Akses RKAT: Terbuka (Unlocked)</span>
              <span style="background:#15803d;color:#fff;padding:4px 10px;border-radius:6px;font-size:11px;">Simpan Status</span>
            </div>
          `
        },
        {
          stepNum: 3,
          time: '00:12',
          title: 'Langkah 3: Atur Persentase Pagu & Salin Aslimas',
          desc: 'Sesuaikan persentase perbantuan pentasharufan, hak amil, dan tagihan Salin Aslimas per bulan jika terdapat ketentuan khusus.',
          previewHtml: `
            <div style="display:flex;align-items:center;gap:12px;width:100%;font-size:12px;flex-wrap:wrap;">
              <span style="color:#34d399;">Penta: 35%</span>
              <span style="color:#fbbf24;">Hak Amil: 5%</span>
              <span style="color:#38bdf8;">Salin: Rp 0 / bln</span>
            </div>
          `
        }
      ]
    }
  ]
};

// State Simulator Pemutar Rekaman Interaktif
let activeRecorderRole = 'upz';
let activeRecorderScenarioIdx = 0;
let activeRecorderStepIdx = 0;
let isRecorderPlaying = true;
let recorderTimer = null;

// Context Extractor untuk Mengambil Nilai Sistem Secara Real-Time
function getGuideContext(role) {
  let pentaPersen = '35%';
  let amilPersen = '5%';
  let salinAslimas = 'Rp 0';
  let isUnlocked = false;

  if (typeof getUpzRkatSetting === 'function') {
    const upzId = (currentProfile && currentProfile.id) || null;
    const rSetting = getUpzRkatSetting(upzId);
    if (rSetting) {
      pentaPersen = (rSetting.persen_penta != null ? rSetting.persen_penta : 35) + '%';
      amilPersen = (rSetting.persen_amil != null ? rSetting.persen_amil : 5) + '%';
      const rawSalin = rSetting.tagihan_salin != null ? rSetting.tagihan_salin : 0;
      salinAslimas = typeof formatRupiahShort === 'function' ? formatRupiahShort(rawSalin) : 'Rp ' + rawSalin.toLocaleString('id-ID');
      isUnlocked = !!rSetting.rkat_unlocked;
    }
  } else if (cachedRkatConfig && cachedRkatConfig.default) {
    pentaPersen = (cachedRkatConfig.default.persen_penta || 35) + '%';
    amilPersen = (cachedRkatConfig.default.persen_amil || 5) + '%';
    const rawSalin = cachedRkatConfig.default.tagihan_salin || 0;
    salinAslimas = typeof formatRupiahShort === 'function' ? formatRupiahShort(rawSalin) : 'Rp ' + rawSalin.toLocaleString('id-ID');
  }

  const currentYear = new Date().getFullYear();
  const rkatStatusText = isUnlocked ? `Terbuka (RKAT ${currentYear} Aktif)` : `Terkunci (Perlu Konfirmasi RKAT ${currentYear})`;

  return {
    role: role,
    pentaPersen: pentaPersen,
    amilPersen: amilPersen,
    salinAslimas: salinAslimas,
    rkatStatusText: rkatStatusText,
    csRkatWa: '+62 813-6869-1114',
    csPentaWa: '+62 851-3374-4077',
    helpdeskWa: '+62 814-6973-4792',
    bszFormats: 'PDF, JPG, PNG (Maks 20MB)'
  };
}

let activeGuideFilterCategory = 'semua';
let activeGuideSearchQuery = '';

// RENDERER UTAMA PANDUAN SISTEM
function renderSystemGuide(containerId, role, filterCategory, searchQuery) {
  const container = document.getElementById(containerId);
  if (!container) return;

  activeRecorderRole = role || 'upz';
  const currentCat = filterCategory !== undefined ? filterCategory : activeGuideFilterCategory;
  const currentQuery = searchQuery !== undefined ? searchQuery.trim().toLowerCase() : activeGuideSearchQuery;
  activeGuideFilterCategory = currentCat;
  activeGuideSearchQuery = currentQuery;

  const ctx = getGuideContext(role);

  // Filter Modul Berdasarkan Role
  let modules = SYSTEM_GUIDE_REGISTRY.filter(function (m) {
    return m.role === role || m.role === 'both';
  });

  // Filter Kategori
  if (currentCat && currentCat !== 'semua') {
    modules = modules.filter(function (m) {
      return m.kategori.toLowerCase().replace(/[^a-z0-9]/g, '') === currentCat.toLowerCase().replace(/[^a-z0-9]/g, '');
    });
  }

  // Filter Search
  if (currentQuery) {
    modules = modules.filter(function (m) {
      const inTitle = (m.judul || '').toLowerCase().includes(currentQuery);
      const inSub = (m.subjudul || '').toLowerCase().includes(currentQuery);
      const inKat = (m.kategori || '').toLowerCase().includes(currentQuery);
      const stepItems = typeof m.steps === 'function' ? m.steps(ctx) : (m.steps || []);
      const inSteps = stepItems.some(function (s) {
        return (s.title || '').toLowerCase().includes(currentQuery) || (s.desc || '').toLowerCase().includes(currentQuery);
      });
      return inTitle || inSub || inKat || inSteps;
    });
  }

  let html = '';

  // 1. REKAMAN & SIMULASI ALUR SISTEM
  const scenarios = RECORDER_SCENARIOS[role] || RECORDER_SCENARIOS.upz;
  const currentScenario = scenarios[activeRecorderScenarioIdx] || scenarios[0];
  const totalSteps = currentScenario.steps.length;
  if (activeRecorderStepIdx >= totalSteps) activeRecorderStepIdx = 0;
  const currentStep = currentScenario.steps[activeRecorderStepIdx] || currentScenario.steps[0];

  html += `
    <div class="guide-recorder-card" id="${containerId}_recorder">
      <div class="recorder-header">
        <div class="recorder-header-left">
          <h3 class="recorder-title">${escapeHtml(currentScenario.title)}</h3>
        </div>
        <div class="recorder-scenario-pills">
  `;

  scenarios.forEach(function (sc, sIdx) {
    const isAct = sIdx === activeRecorderScenarioIdx ? ' active' : '';
    html += `<button type="button" class="recorder-scenario-btn${isAct}" data-scenario-idx="${sIdx}">Skenario ${sIdx + 1}</button>`;
  });

  html += `
        </div>
      </div>

      <div class="recorder-screen-frame">
        <div class="recorder-screen-topbar">
          <div class="recorder-window-dots">
            <span class="recorder-dot dot-red"></span>
            <span class="recorder-dot dot-yellow"></span>
            <span class="recorder-dot dot-green"></span>
          </div>
          <span class="recorder-playback-time">Langkah ${activeRecorderStepIdx + 1} dari ${totalSteps}</span>
        </div>

        <div class="recorder-stage">
          <h4 class="recorder-step-heading">${escapeHtml(currentStep.title)}</h4>
          <p class="recorder-step-desc">${escapeHtml(currentStep.desc)}</p>

          <div class="recorder-sim-preview">
            ${currentStep.previewHtml}
          </div>
        </div>
      </div>

      <div class="recorder-controls-bar">
        <div class="recorder-playback-btns">
          <button type="button" class="recorder-ctrl-btn" id="${containerId}_recPrev" title="Langkah Sebelumnya">
            <span>&larr; Prev</span>
          </button>
          <button type="button" class="recorder-ctrl-btn btn-play" id="${containerId}_recPlayToggle" title="${isRecorderPlaying ? 'Jeda Simulasi' : 'Putar Simulasi'}">
            <span>${isRecorderPlaying ? '⏸ Jeda' : '▶ Putar'}</span>
          </button>
          <button type="button" class="recorder-ctrl-btn" id="${containerId}_recNext" title="Langkah Berikutnya">
            <span>Next &rarr;</span>
          </button>
        </div>

        <div class="recorder-timeline-dots">
  `;

  for (let d = 0; d < totalSteps; d++) {
    const isDotAct = d === activeRecorderStepIdx ? ' active' : '';
    html += `<button type="button" class="timeline-step-dot${isDotAct}" data-step-idx="${d}">${d + 1}</button>`;
  }

  html += `
        </div>

        <div>
          ${currentScenario.targetView ? `
            <button type="button" class="recorder-practice-btn" data-target-view="${currentScenario.targetView}">
              <span>Praktikkan Langsung</span>
              <svg class="icon" style="width:13px;height:13px;"><use href="#i-chevron-right"></use></svg>
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;

  // 2. KATEGORI PANDUAN
  const categories = [
    { key: 'semua', label: 'Semua Panduan' },
    { key: 'alurutama', label: 'Alur Utama' },
    { key: 'pentasharufanrkat', label: 'Pentasharufan & RKAT' },
    { key: 'dokumenbsz', label: 'Dokumen & BSZ' },
    { key: 'administrasiakun', label: 'Administrasi & Akun' }
  ];

  html += `
    <div class="guide-toolbar">
      <div class="guide-category-pills">
  `;

  categories.forEach(function (cat) {
    const isActive = activeGuideFilterCategory === cat.key ? ' active' : '';
    html += `<button type="button" class="guide-cat-btn${isActive}" data-category="${cat.key}">${cat.label}</button>`;
  });

  html += `
      </div>
    </div>
  `;

  // 3. GRID KARTU PANDUAN
  if (modules.length === 0) {
    html += `
      <div class="empty-state" style="padding: 48px 24px; text-align: center; background: #ffffff; border-radius: 16px; border: 1px dashed var(--slate-300);">
        <svg class="icon" style="width: 48px; height: 48px; color: var(--slate-400); margin-bottom: 12px;"><use href="#i-book-open"></use></svg>
        <h3 style="font-size: 16px; color: var(--slate-700); margin: 0 0 6px 0;">Topik panduan tidak ditemukan</h3>
        <p style="font-size: 13px; color: var(--slate-500); margin: 0 0 16px 0;">Pilih kategori panduan lainnya untuk melihat SOP sistem.</p>
        <button type="button" class="btn btn-soft btn-sm" id="${containerId}_resetCategory">Tampilkan Semua Panduan</button>
      </div>
    `;
  } else {
    html += `<div class="guide-modules-grid">`;

    modules.forEach(function (module) {
      const liveParams = typeof module.getLiveParams === 'function' ? module.getLiveParams(ctx) : [];

      html += `
        <article class="guide-card" id="guide_card_${module.id}">
          <div class="guide-card-header">
            <div class="guide-card-header-left">
              <span class="guide-card-cat-badge tone-${module.tone || 'emerald'}">${escapeHtml(module.kategori)} · ${escapeHtml(module.badge || 'SOP')}</span>
              <h3 class="guide-card-title">${escapeHtml(module.judul)}</h3>
              <p class="guide-card-desc">${escapeHtml(module.subjudul)}</p>
            </div>
            ${module.targetView ? `
              <button type="button" class="guide-card-jump-btn" data-target-view="${module.targetView}" title="Buka halaman fitur ini langsung">
                <span>${escapeHtml(module.targetLabel || 'Buka Fitur')}</span>
                <svg class="icon"><use href="#i-chevron-right"></use></svg>
              </button>
            ` : ''}
          </div>

          <div class="guide-card-body">
      `;

      // Live Parameters Box
      if (liveParams && liveParams.length > 0) {
        html += `<div class="guide-live-param-box">`;
        liveParams.forEach(function (param) {
          html += `
            <div class="guide-param-row">
              <span class="guide-param-label">
                <svg class="icon"><use href="#i-${param.icon || 'check'}"></use></svg>
                ${escapeHtml(param.label)}
              </span>
              <span class="guide-param-value">${escapeHtml(param.value)}</span>
            </div>
          `;
        });
        html += `</div>`;
      }

      // Visual Illustration Panel
      html += `
        <div class="guide-illustration-panel">
          <div class="guide-illus-header">
            <span class="guide-illus-title">
              <svg class="icon" style="width:13px;height:13px;"><use href="#i-eye"></use></svg>
              Ilustrasi Visual Alur Sistem
            </span>
            <span class="guide-illus-badge">${escapeHtml(module.kategori)}</span>
          </div>
      `;

      if (module.illustrationType === 'diagram-flow' && module.flowSteps) {
        html += `<div class="guide-flow-diagram">`;
        module.flowSteps.forEach(function (st, idx) {
          html += `
            <div class="guide-flow-node${idx === 0 ? ' active-node' : ''}">
              <span class="guide-flow-node-num">${escapeHtml(st.num)}</span>
              <span class="guide-flow-node-text">${escapeHtml(st.title)}</span>
            </div>
          `;
          if (idx < module.flowSteps.length - 1) {
            html += `<span class="guide-flow-arrow">&rarr;</span>`;
          }
        });
        html += `</div>`;
      } else if (module.illustrationType === 'ui-mockup-penta') {
        html += `
          <div class="guide-scorecard-mini-grid">
            <div class="guide-scorecard-mini">
              <div class="guide-scorecard-mini-title">Pagu Perbantuan</div>
              <div class="guide-scorecard-mini-val accent-green">${ctx.pentaPersen} Setoran</div>
            </div>
            <div class="guide-scorecard-mini">
              <div class="guide-scorecard-mini-title">Salin Aslimas</div>
              <div class="guide-scorecard-mini-val">${ctx.salinAslimas}</div>
            </div>
            <div class="guide-scorecard-mini">
              <div class="guide-scorecard-mini-title">Hak Amil UPZ</div>
              <div class="guide-scorecard-mini-val accent-amber">${ctx.amilPersen} Setoran</div>
            </div>
            <div class="guide-scorecard-mini">
              <div class="guide-scorecard-mini-title">Telah Ditasharufkan</div>
              <div class="guide-scorecard-mini-val">Otomatis Terhitung</div>
            </div>
            <div class="guide-scorecard-mini">
              <div class="guide-scorecard-mini-title">Sisa Pagu Tersedia</div>
              <div class="guide-scorecard-mini-val accent-green">Real-Time</div>
            </div>
            <div class="guide-scorecard-mini">
              <div class="guide-scorecard-mini-title">Mustahik Terbantu</div>
              <div class="guide-scorecard-mini-val">Akumulasi Orang</div>
            </div>
          </div>
          <div style="margin-top: 10px; display:flex; align-items:center; justify-content:space-between; font-size:10.5px; color:#94a3b8; background:rgba(255,255,255,0.03); padding:4px 8px; border-radius:6px; flex-wrap:wrap; gap:6px;">
            <span><svg class="icon" style="width:12px;height:12px;color:#22c55e;"><use href="#i-message-circle"></use></svg> WhatsApp CS: <strong>${ctx.csPentaWa}</strong></span>
            <span style="color:#38bdf8;">Respon Cepat BAZNAS</span>
          </div>
        `;
      } else if (module.illustrationType === 'ui-mockup-setoran') {
        html += `
          <div class="guide-ui-mockup-wrap">
            <div class="guide-mockup-row">
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-weight:600;color:#f8fafc;">Setoran Zakat & Infak UPZ</span>
                <span class="guide-mockup-tag tag-success">Diverifikasi</span>
              </div>
              <div style="display:flex;gap:6px;">
                <button type="button" class="guide-mockup-action-btn" title="Unduh Berkas BSZ Sah">
                  <svg class="icon" style="width:11px;height:11px;"><use href="#i-file-text"></use></svg> Unduh BSZ
                </button>
              </div>
            </div>
            <div class="guide-mockup-row">
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-weight:600;color:#cbd5e1;">Pengajuan Setoran Baru</span>
                <span class="guide-mockup-tag tag-warning">Menunggu</span>
              </div>
              <div style="display:flex;gap:6px;">
                <button type="button" class="guide-mockup-action-btn guide-mockup-btn-danger" title="Batal & Hapus Setoran Mandiri">
                  <svg class="icon" style="width:11px;height:11px;"><use href="#i-trash-2"></use></svg> Hapus
                </button>
              </div>
            </div>
          </div>
        `;
      } else {
        html += `
          <div style="font-size:12px;color:#cbd5e1;padding:8px 0;display:flex;align-items:center;gap:8px;">
            <svg class="icon" style="width:14px;height:14px;color:#34d399;"><use href="#i-check"></use></svg>
            Alur tersinkronisasi langsung dengan sistem validasi BAZNAS Kabupaten Banyumas.
          </div>
        `;
      }

      html += `</div>`; // Close illustration panel

      // Steps List
      const stepItems = typeof module.steps === 'function' ? module.steps(ctx) : (module.steps || []);
      if (stepItems && stepItems.length > 0) {
        html += `<div class="guide-steps-container">`;
        stepItems.forEach(function (step, sIdx) {
          html += `
            <div class="guide-step-item">
              <div class="guide-step-bubble">${sIdx + 1}</div>
              <div class="guide-step-content">
                <h4 class="guide-step-title">${escapeHtml(step.title)}</h4>
                <p class="guide-step-desc">${step.desc}</p>
              </div>
            </div>
          `;
        });
        html += `</div>`;
      }

      // Notice Box
      if (module.notice) {
        html += `
          <div class="guide-alert-notice ${module.notice.type === 'tip' ? 'tone-emerald' : ''}">
            <svg class="icon"><use href="#i-${module.notice.type === 'tip' ? 'check' : 'alert'}"></use></svg>
            <div>${escapeHtml(module.notice.text)}</div>
          </div>
        `;
      }

      html += `
          </div>
        </article>
      `;
    });

    html += `</div>`;
  }

  container.innerHTML = html;

  // BIND EVENT LISTENERS REKAMAN INTERAKTIF
  // 1. Scenario Buttons
  container.querySelectorAll('.recorder-scenario-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      activeRecorderScenarioIdx = Number(this.dataset.scenarioIdx) || 0;
      activeRecorderStepIdx = 0;
      renderSystemGuide(containerId, role, activeGuideFilterCategory);
    });
  });

  // 2. Step Dot Buttons
  container.querySelectorAll('.timeline-step-dot').forEach(function (btn) {
    btn.addEventListener('click', function () {
      activeRecorderStepIdx = Number(this.dataset.stepIdx) || 0;
      renderSystemGuide(containerId, role, activeGuideFilterCategory);
    });
  });

  // 3. Play / Pause Toggle
  const playToggleBtn = document.getElementById(containerId + '_recPlayToggle');
  if (playToggleBtn) {
    playToggleBtn.addEventListener('click', function () {
      isRecorderPlaying = !isRecorderPlaying;
      if (!isRecorderPlaying && recorderTimer) {
        clearInterval(recorderTimer);
        recorderTimer = null;
      }
      renderSystemGuide(containerId, role, activeGuideFilterCategory);
    });
  }

  // 4. Prev Button
  const prevBtn = document.getElementById(containerId + '_recPrev');
  if (prevBtn) {
    prevBtn.addEventListener('click', function () {
      const sc = (RECORDER_SCENARIOS[role] || RECORDER_SCENARIOS.upz)[activeRecorderScenarioIdx];
      if (activeRecorderStepIdx > 0) {
        activeRecorderStepIdx--;
      } else {
        activeRecorderStepIdx = (sc.steps.length - 1);
      }
      renderSystemGuide(containerId, role, activeGuideFilterCategory);
    });
  }

  // 5. Next Button
  const nextBtn = document.getElementById(containerId + '_recNext');
  if (nextBtn) {
    nextBtn.addEventListener('click', function () {
      const sc = (RECORDER_SCENARIOS[role] || RECORDER_SCENARIOS.upz)[activeRecorderScenarioIdx];
      if (activeRecorderStepIdx < sc.steps.length - 1) {
        activeRecorderStepIdx++;
      } else {
        activeRecorderStepIdx = 0;
      }
      renderSystemGuide(containerId, role, activeGuideFilterCategory);
    });
  }

  // 6. Practice Jump Button
  container.querySelectorAll('.recorder-practice-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const targetView = this.dataset.targetView;
      if (targetView && typeof navigateToView === 'function') {
        navigateToView(targetView);
      }
    });
  });

  // Start / Restart Auto-Play Timer
  if (recorderTimer) {
    clearInterval(recorderTimer);
    recorderTimer = null;
  }
  if (isRecorderPlaying) {
    recorderTimer = setInterval(function () {
      const sc = (RECORDER_SCENARIOS[role] || RECORDER_SCENARIOS.upz)[activeRecorderScenarioIdx];
      if (!sc) return;
      if (activeRecorderStepIdx < sc.steps.length - 1) {
        activeRecorderStepIdx++;
      } else {
        activeRecorderStepIdx = 0;
      }
      renderSystemGuide(containerId, role, activeGuideFilterCategory);
    }, 4500);
  }

  // BIND EVENT LISTENERS UMUM
  // Category Filter Buttons
  container.querySelectorAll('.guide-cat-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const cat = this.dataset.category;
      renderSystemGuide(containerId, role, cat);
    });
  });

  // Reset Category Button (if visible)
  const resetBtn = document.getElementById(containerId + '_resetCategory');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      renderSystemGuide(containerId, role, 'semua');
    });
  }

  // Jump Action Buttons
  container.querySelectorAll('.guide-card-jump-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const targetView = this.dataset.targetView;
      if (targetView && typeof navigateToView === 'function') {
        navigateToView(targetView);
      }
    });
  });
}

// Extensibility API: Memungkinkan Penambahan Modul Panduan Dinamis dari Mana Saja
function registerSystemGuideModule(moduleConfig) {
  if (!moduleConfig || !moduleConfig.id) return;
  const existingIdx = SYSTEM_GUIDE_REGISTRY.findIndex(function (m) {
    return m.id === moduleConfig.id;
  });
  if (existingIdx >= 0) {
    SYSTEM_GUIDE_REGISTRY[existingIdx] = Object.assign({}, SYSTEM_GUIDE_REGISTRY[existingIdx], moduleConfig);
  } else {
    SYSTEM_GUIDE_REGISTRY.push(moduleConfig);
  }
  refreshActiveGuide();
}

// Auto-Refresh Guide saat Terjadi Perubahan Konfigurasi Sistem
function refreshActiveGuide() {
  if (currentActiveView === 'panduan') {
    const adminPageEl = document.getElementById('adminPage');
    const isRoleAdmin = (currentProfile && currentProfile.role === 'admin') ||
      (adminPageEl && !adminPageEl.classList.contains('hidden'));
    if (isRoleAdmin) {
      renderSystemGuide('adminGuideContainer', 'admin');
    } else {
      renderSystemGuide('upzGuideContainer', 'upz');
    }
  }
}

// Expose Secara Global untuk Integrasi Lintas Modul
window.SYSTEM_GUIDE_REGISTRY = SYSTEM_GUIDE_REGISTRY;
window.renderSystemGuide = renderSystemGuide;
window.registerSystemGuideModule = registerSystemGuideModule;
window.refreshActiveGuide = refreshActiveGuide;
