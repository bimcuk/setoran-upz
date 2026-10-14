
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
    toast.innerHTML = `${iconSvg}<div><div style="font-weight:700;font-size:13px;">${escapeHtml(titleOrMessage)}</div><div style="font-size:12px;opacity:0.9;font-weight:400;margin-top:2px;">${escapeHtml(description)}</div></div>`;
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

// ==================================================
// SISTEM NOTIFIKASI AKTIVITAS UPZ (ROLE ADMIN)
// ==================================================

let adminNotifications = [];
let adminReadNotifIds = new Set();
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

  // 1. Dari data setoran admin (Upload berkas & setoran baru)
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

  // 2. Dari riwayat aktivitas perubahan UPZ (nama pengelola / profil mandiri)
  try {
    const actLogs = JSON.parse(localStorage.getItem('upz_activity_logs_v1') || '[]');
    if (Array.isArray(actLogs)) {
      actLogs.forEach(function (log) {
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
      });
    }
  } catch (_) {}

  // Urutkan dari notifikasi terbaru
  notifs.sort(function (a, b) {
    const timeA = new Date(a.timestamp).getTime() || 0;
    const timeB = new Date(b.timestamp).getTime() || 0;
    return timeB - timeA;
  });

  adminNotifications = notifs;
  renderAdminNotificationUI();
}

function renderAdminNotificationUI() {
  const badge = document.getElementById('adminNotifBadge');
  const unreadPill = document.getElementById('notifUnreadPill');
  const listEl = document.getElementById('adminNotifList');
  if (!listEl) return;

  const unreadCount = adminNotifications.filter(function (n) { return !n.read; }).length;

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
    const isUnread = !n.read;
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
      <div class="notif-item ${isUnread ? 'unread' : ''}" data-notif-id="${escapeHtml(n.id)}" data-type="${escapeHtml(n.type)}" data-upz-name="${escapeHtml(n.nama_upz || '')}" data-setoran-id="${escapeHtml(n.setoran_id || '')}">
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
        ${isUnread ? '<div class="notif-unread-dot" title="Belum dibaca"></div>' : ''}
      </div>
    `;
  });

  listEl.innerHTML = html;

  // Click on item
  listEl.querySelectorAll('.notif-item').forEach(function (el) {
    el.addEventListener('click', function () {
      const notifId = el.dataset.notifId;
      const type = el.dataset.type;
      const upzName = el.dataset.upzName;
      const setoranId = el.dataset.setoranId;

      if (notifId) {
        adminReadNotifIds.add(notifId);
        saveReadNotifIds();
        renderAdminNotificationUI();
      }

      // Close dropdown
      const dropdown = document.getElementById('adminNotifDropdown');
      if (dropdown) dropdown.classList.add('hidden');
      const btn = document.getElementById('adminNotifButton');
      if (btn) btn.setAttribute('aria-expanded', 'false');

      // Navigate
      if (type === 'upload') {
        if (typeof navigateToView === 'function') navigateToView('setoran');
        if (setoranId) {
          setTimeout(function () {
            const card = document.querySelector(`[data-admin-setoran-id="${setoranId}"]`);
            if (card) {
              card.scrollIntoView({ behavior: 'smooth', block: 'center' });
              card.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
              card.style.boxShadow = '0 0 0 3px rgba(37, 145, 72, 0.4)';
              card.style.borderColor = '#259148';
              setTimeout(function () {
                card.style.boxShadow = '';
                card.style.borderColor = '';
              }, 3000);
            }
          }, 350);
        }
      } else if (type === 'perubahan') {
        if (typeof navigateToView === 'function') navigateToView('upz');
        if (upzName) {
          setTimeout(function () {
            const searchInput = document.getElementById('upzMgmtSearch');
            if (searchInput) {
              searchInput.value = upzName;
              upzMgmtCurrentPage = 1;
              renderUpzMgmtTable();
            }
          }, 250);
        }
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
  const refreshBtn = document.getElementById('refreshNotifsBtn');
  const tabs = document.querySelectorAll('.notif-tabs .notif-tab');

  if (btn && dropdown) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      const isHidden = dropdown.classList.contains('hidden');
      dropdown.classList.toggle('hidden', !isHidden);
      btn.setAttribute('aria-expanded', String(isHidden));
    });
  }

  // Close when clicking outside
  document.addEventListener('click', function (e) {
    if (!dropdown || dropdown.classList.contains('hidden')) return;
    if (!dropdown.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
      dropdown.classList.add('hidden');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }
  });

  // Close on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dropdown && !dropdown.classList.contains('hidden')) {
      dropdown.classList.add('hidden');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }
  });

  // Mark all as read
  if (markAllBtn) {
    markAllBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      adminNotifications.forEach(function (n) {
        adminReadNotifIds.add(n.id);
      });
      saveReadNotifIds();
      renderAdminNotificationUI();
      showToast('Semua notifikasi ditandai sudah dibaca', 'success');
    });
  }

  // Refresh
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async function (e) {
      e.stopPropagation();
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = '<span class="spinner" style="width:12px;height:12px;" aria-hidden="true"></span>';
      try {
        await loadAdminSetoran();
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

async function callBackend(action, payload = {}) {
  const {
    data: { session },
    error: sessionError
  } = await supabaseClient.auth.getSession();

  if (sessionError || !session) {
    throw new Error('Sesi login tidak ditemukan. Silakan login kembali.');
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
        token: session.access_token,
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
// TAMPILAN HALAMAN
// ==================================================

function showLogin() {
  if (loginPage) loginPage.classList.remove('hidden');
  if (dashboardPage) dashboardPage.classList.add('hidden');
}

function showDashboard() {
  if (loginPage) loginPage.classList.add('hidden');
  if (dashboardPage) dashboardPage.classList.remove('hidden');
}

function showRolePage(role) {
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

  // Tampilkan tombol & sistem notifikasi khusus role admin
  const notifWrap = document.getElementById('adminNotificationWrap');
  if (notifWrap) {
    notifWrap.classList.toggle('hidden', role !== 'admin');
  }

  if (role === 'admin') {
    initAdminNotificationSystem();
    initAdminRealtimeNotifications();
    syncAdminNotifications();
  }

  // Tampilkan halaman Beranda secara default saat role terbuka
  if (typeof navigateToView === 'function') {
    navigateToView('beranda');
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

// ==================================================
// LOAD DASHBOARD BERDASARKAN ROLE
// ==================================================

async function loadDashboard() {
  if (isLoadingDashboard) return false;

  isLoadingDashboard = true;

  try {
    const profileResult = await callBackend('test');
    const profile = profileResult.profile;

    if (!profile) {
      throw new Error('Data profil tidak ditemukan dari backend.');
    }

    if (profile.status !== 'aktif') {
      throw new Error('Akun belum aktif. Silakan hubungi administrator.');
    }

    currentProfile = profile;

    // DASHBOARD ADMIN
    if (profile.role === 'admin') {
      const userName = document.getElementById('userName');
      if (userName) {
        userName.textContent = profile.nama_lengkap || 'Administrator';
      }

      const upzName = document.getElementById('upzName');
      if (upzName) upzName.textContent = 'Administrator';

      showRolePage('admin');
      await loadAdminSetoran();
      loadUpzList().catch(function(e) { console.warn('Preload UPZ list:', e); });
      return true;
    }

    // DASHBOARD UPZ
    if (profile.role !== 'upz' || !profile.upz_id) {
      throw new Error('Akun ini tidak terhubung ke UPZ.');
    }

    const result = await callBackend('getDashboard');

    if (!result.profile) {
      throw new Error('Data profil UPZ tidak ditemukan.');
    }

    currentProfile = result.profile;

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

    const setoran = sortByCreatedAt(
      Array.isArray(result.setoran) ? result.setoran : []
    );

    currentSetoran = setoran;

    const nameElement = document.getElementById('userName');
    if (nameElement) {
      nameElement.textContent = currentProfile.nama_lengkap || '-';
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

    // TOTAL SETORAN UPZ HANYA MENGHITUNG STATUS DITERIMA.
    const total = hitungTotalTerverifikasi(setoran);

    const totalSetoran = document.getElementById('totalSetoran');
    if (totalSetoran) {
      totalSetoran.textContent = formatRupiah(total);
    }

    const jumlahDonatur = document.getElementById('jumlahDonatur');

    if (jumlahDonatur) {
      jumlahDonatur.textContent = '...';

      if (setoran.length && setoran[0].id) {
        try {
          const detailTerakhir = await getDetailSetoran(setoran[0].id);
          jumlahDonatur.textContent =
            detailTerakhir.length.toLocaleString('id-ID');
        } catch (detailError) {
          console.error('HITUNG DONATUR ERROR:', detailError);
          jumlahDonatur.textContent = '-';
        }
      } else {
        jumlahDonatur.textContent = '0';
      }
    }

    populateUpzTahunFilter(setoran);
    filterAndRenderRiwayat();
    showRolePage('upz');

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

    return true;

  } catch (error) {
    console.error('DASHBOARD ERROR:', error);
    showMessage(message, error.message, '#d93025');
    showLogin();
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
    return `<article class="riwayat-item" data-setoran-id="${id}"><div class="riwayat-main"><div class="riwayat-nominal">${formatRupiah(item.nominal)}</div><div class="riwayat-info"><div>Tanggal setor: <strong>${escapeHtml(formatTanggal(item.tanggal_setor))}</strong></div><div>Periode: <strong>${escapeHtml(getNamaBulan(item.periode_bulan) + ' ' + (item.periode_tahun || '-'))}</strong></div></div><div class="status-badge ${getStatusClass(status)}">${escapeHtml(getStatusLabel(status))}</div><div class="riwayat-actions"><button type="button" class="btn btn-soft history-preview-button" data-preview-id="${id}"><svg class="icon"><use href="#i-eye"></use></svg><span>Preview</span></button>${item.file_path ? `<button type="button" class="btn btn-ghost download-excel-button" data-download-id="${id}"><svg class="icon"><use href="#i-download"></use></svg><span>Unduh</span></button>` : ''}</div></div></article>`;
  }).join('') + renderPagination('upz', upzCurrentPage, totalPages);
  bindHistoryPreviewEvents(container, false);
  bindHistoryDownloadEvents(container, false);
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
}

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
  });
  if (!item || !detailModal) return;
  const status = String(item.status || 'menunggu').toLowerCase();
  detailModalSubtitle.textContent = (isAdmin ? (upzMap[item.upz_id] || item.upz_id || '-') + ' · ' : '') + formatTanggal(item.tanggal_setor);
  detailModalMeta.innerHTML = '<div class="meta-item"><label>Nominal</label><div>' + escapeHtml(formatRupiah(item.nominal)) + '</div></div>' +
    '<div class="meta-item"><label>Periode</label><div>' + escapeHtml(getNamaBulan(item.periode_bulan) + ' ' + item.periode_tahun) + '</div></div>' +
    '<div class="meta-item"><label>Status</label><div><span class="status-badge ' + getStatusClass(status) + '">' + escapeHtml(getStatusLabel(status)) + '</span></div></div>' +
    '<div class="meta-item"><label>File</label><div class="text-break">' + escapeHtml(item.file_name || 'Tidak tersedia') + '</div></div>';
  detailModalBody.innerHTML = '<p class="empty-state">Memuat rincian donatur...</p>';
  detailModalVerify.classList.toggle('hidden', !(isAdmin && status === 'menunggu'));
  detailDownloadButton.classList.toggle('hidden', !item.file_path);
  detailModal.classList.remove('hidden');
  try {
    detailModalBody.innerHTML = renderDetailSetoran(await getDetailSetoran(item.id));
  } catch (error) {
    detailModalBody.innerHTML = '<p class="form-message" style="color:#dc2626">' + escapeHtml(error.message) + '</p>';
  }
  activeDetailItem = item;
  detailDownloadButton.onclick = function () {
    const source = (isAdmin ? adminSetoranContainer : document.getElementById('riwayatContainer')).querySelector('[data-download-id="' + CSS.escape(String(item.id)) + '"]');
    if (source) source.click();
  };
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
  const jumlahUpzEl = document.getElementById('adminJumlahUpz');

  const menunggu = setoran.filter(function (item) {
    return String(item.status || '').toLowerCase() === 'menunggu';
  });

  // TOTAL ADMIN HANYA MENGHITUNG STATUS DITERIMA.
  const total = hitungTotalTerverifikasi(setoran);

  if (jumlahTransaksi) {
    jumlahTransaksi.textContent = setoran.length.toLocaleString('id-ID');
  }

  if (jumlahMenunggu) {
    jumlahMenunggu.textContent = menunggu.length.toLocaleString('id-ID');
  }

  if (totalNominal) {
    totalNominal.textContent = formatRupiah(total);
  }

  if (jumlahUpzEl) {
    const uniqueUpz = new Set(
      setoran.map(function (item) { return item.upz_id; }).filter(Boolean)
    );
    jumlahUpzEl.textContent = uniqueUpz.size.toLocaleString('id-ID');
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
    return `<article class="riwayat-item admin-riwayat-item" data-admin-setoran-id="${id}"><div class="riwayat-main"><div class="riwayat-nominal">${formatRupiah(item.nominal)}</div><div class="riwayat-info"><div><strong>${escapeHtml(namaUpz)}</strong></div><div>Tanggal setor: <strong>${escapeHtml(formatTanggal(item.tanggal_setor))}</strong></div><div>Periode: <strong>${escapeHtml(getNamaBulan(item.periode_bulan) + ' ' + (item.periode_tahun || '-'))}</strong></div></div><div class="status-badge ${getStatusClass(status)}">${escapeHtml(getStatusLabel(status))}</div><div class="riwayat-actions"><button type="button" class="btn btn-soft history-preview-button" data-preview-id="${id}"><svg class="icon"><use href="#i-eye"></use></svg><span>Preview</span></button>${item.file_path ? `<button type="button" class="btn btn-ghost admin-download-button" data-download-id="${id}"><svg class="icon"><use href="#i-download"></use></svg><span>Unduh</span></button>` : ''}</div></div>${isPending ? `<div class="admin-verify-inline"><label for="catatan-${id}">Catatan verifikasi</label><textarea id="catatan-${id}" class="admin-catatan" data-catatan-id="${id}" rows="2" placeholder="Catatan wajib diisi jika ditolak."></textarea><div class="verify-actions"><button type="button" class="admin-verify-button btn btn-primary" data-keputusan="diterima" data-setoran-id="${id}">Terima</button><button type="button" class="admin-verify-button btn btn-danger" data-keputusan="ditolak" data-setoran-id="${id}">Tolak</button></div></div>` : ''}</article>`;
  }).join('') + renderPagination('admin', adminCurrentPage, totalPages);
  bindHistoryPreviewEvents(adminSetoranContainer, true);
  bindAdminVerifyEvents();
  bindAdminDownloadEvents();
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

  const pointItems = document.querySelectorAll('.brand-point-item');

  let i = 0;
  let j = 0;

  function typeL1() {
    if (i < line1.length) {
      elL1.textContent += line1.charAt(i);
      i++;
      setTimeout(typeL1, 40);
    } else {
      setTimeout(typeL2, 160);
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
      const { error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) throw error;

      const loaded = await loadDashboard();

      if (loaded) {
        showMessage(message, 'Login berhasil.', '#259148');
      }

    } catch (error) {
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

function askDialog(title, text, confirmText, iconId) {
  const modal = document.getElementById('dialogModal');
  if (!modal) return Promise.resolve(window.confirm(text));
  document.getElementById('dialogTitle').textContent = title;
  document.getElementById('dialogMessage').textContent = text;
  document.getElementById('dialogConfirmButton').textContent = confirmText || 'Ya, Lanjutkan';
  document.getElementById('dialogIcon').innerHTML = '<svg class="icon"><use href="#' + (iconId || 'i-alert') + '"></use></svg>';
  modal.classList.remove('hidden');
  return new Promise(function (resolve) {
    const yes = document.getElementById('dialogConfirmButton');
    const no = document.getElementById('dialogCancelButton');
    function done(result) {
      modal.classList.add('hidden');
      yes.removeEventListener('click', onYes); no.removeEventListener('click', onNo);
      resolve(result);
    }
    function onYes() { done(true); }
    function onNo() { done(false); }
    yes.addEventListener('click', onYes); no.addEventListener('click', onNo);
  });
}

if (logoutButton) {
  logoutButton.addEventListener('click', async function () {
    if (!await askDialog('Keluar dari akun?', 'Sesi Anda akan diakhiri pada perangkat ini.', 'Ya, Logout', 'i-logout')) return;
    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;
      currentProfile = null;
      currentSetoran = [];
      currentAdminSetoran = [];
      const notifWrap = document.getElementById('adminNotificationWrap');
      if (notifWrap) notifWrap.classList.add('hidden');
      const notifDrop = document.getElementById('adminNotifDropdown');
      if (notifDrop) notifDrop.classList.add('hidden');
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
      await loadDashboard();
      if (typeof _tryShowKategoriBadge === 'function') {
        _tryShowKategoriBadge();
      }
    } else {
      showLogin();
    }
  } catch (error) {
    console.error('SESSION ERROR:', error);
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
    // 1. Ambil data dari tabel upz (master unit pengumpul zakat)
    let upzRows = [];
    try {
      const { data: uData, error: uErr } = await supabaseClient
        .from('upz')
        .select('id, kode_upz, nama_upz, kategori, status');
      if (!uErr && Array.isArray(uData) && uData.length > 0) {
        upzRows = uData;
      }
    } catch (e) {
      console.warn('Fetch tabel upz warning:', e);
    }

    // 2. Ambil data profiles (dengan penanganan aman jika kolom email tidak ada)
    let profiles = [];
    try {
      const { data: pData, error: pErr } = await supabaseClient
        .from('profiles')
        .select('id, nama_lengkap, email, status, upz_id, role');
      if (!pErr && Array.isArray(pData)) {
        profiles = pData;
      } else {
        const { data: pData2, error: pErr2 } = await supabaseClient
          .from('profiles')
          .select('id, nama_lengkap, status, upz_id, role');
        if (!pErr2 && Array.isArray(pData2)) {
          profiles = pData2;
        }
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

    // Gabungkan data tabel upz
    if (upzRows.length > 0) {
      allUpzList = upzRows.map(function (u) {
        const p = profileByUpzId[u.id] || {};
        return {
          profile_id: p.id || u.id,
          upz_id: u.id,
          nama_lengkap: p.nama_lengkap || u.nama_upz || '',
          email: p.email || (u.kode_upz ? u.kode_upz.toLowerCase() + '@upz.baznas' : '-'),
          status: p.status || u.status || 'aktif',
          nama_upz: u.nama_upz || u.kode_upz || '',
          kategori: u.kategori || '-'
        };
      });
    } else if (upzProfiles.length > 0) {
      allUpzList = upzProfiles.map(function (p) {
        return {
          profile_id: p.id,
          upz_id: p.upz_id || p.id,
          nama_lengkap: p.nama_lengkap || '',
          email: p.email || '-',
          status: p.status || 'aktif',
          nama_upz: p.nama_lengkap || 'UPZ',
          kategori: '-'
        };
      });
    } else {
      // Gunakan direktori UPZ Kabupaten Banyumas bawaan
      allUpzList = DEFAULT_UPZ_DATA.map(function (item) {
        return {
          profile_id: item.id,
          upz_id: item.id,
          nama_lengkap: item.nama_lengkap,
          email: item.email,
          status: item.status,
          nama_upz: item.nama_upz,
          kategori: item.kategori
        };
      });
    }

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

    // Sinkronisasi upzMap agar dropdown dan nama UPZ di seluruh sistem terisi
    allUpzList.forEach(function (u) {
      if (u.upz_id && (!upzMap || !upzMap[u.upz_id])) {
        upzMap[u.upz_id] = u.nama_upz;
      }
    });

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
          <th>Kategori</th>
          <th>Status</th>
          <th style="text-align:center;width:90px;">Aksi</th>
        </tr>
      </thead>
      <tbody>`;

  pageItems.forEach(function (u, i) {
    const statusClass = u.status === 'aktif' ? 'upz-status-aktif' : 'upz-status-nonaktif';
    const rowNum = startIdx + i + 1;
    html += `<tr>
      <td style="color:var(--slate-400);font-size:12px;font-weight:600;">${rowNum}</td>
      <td>
        <div class="nama-upz">${escapeHtml(u.nama_upz || '-')}</div>
      </td>
      <td>
        <div style="font-weight:600;color:var(--slate-800);">${escapeHtml(u.nama_lengkap || '-')}</div>
        <div class="email-upz">${escapeHtml(u.email || '-')}</div>
      </td>
      <td>${renderKategoriChip(u.kategori)}</td>
      <td><span class="upz-status-badge ${statusClass}">${escapeHtml(u.status || 'aktif')}</span></td>
      <td style="text-align:center;">
        <button type="button" class="btn btn-soft btn-sm upz-edit-btn"
          data-profile-id="${escapeHtml(u.profile_id)}"
          data-upz-id="${escapeHtml(u.upz_id || '')}"
          data-nama="${escapeHtml(u.nama_lengkap)}"
          data-email="${escapeHtml(u.email)}"
          data-nama-upz="${escapeHtml(u.nama_upz)}"
          data-kategori="${escapeHtml(u.kategori)}"
          data-status="${escapeHtml(u.status)}">
          <svg class="icon" style="width:14px;height:14px;"><use href="#i-edit"></use></svg> Edit
        </button>
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
          <span style="font-size:12px;color:var(--slate-500);">Ke hal:</span>
          <input type="number" id="upzJumpInput" class="upz-jump-input" min="1" max="${totalPages}" value="${upzMgmtCurrentPage}" title="Ketik nomor halaman">
          <button type="submit" class="btn btn-soft btn-sm" style="padding:0 10px;height:34px;">Buka</button>
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
        nama: btn.dataset.nama,
        email: btn.dataset.email,
        nama_upz: btn.dataset.namaUpz,
        kategori: btn.dataset.kategori,
        status: btn.dataset.status
      });
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
        if (!profileId) {
          // Mode: TAMBAH UPZ BARU
          await callBackend('createUpz', {
            email: email,
            password: password,
            nama: nama,
            nama_upz: namaUpz,
            kategori: kategori
          });
        } else {
          // Mode: EDIT UPZ LAMA
          if (upzId) {
            const { error: upzErr } = await supabaseClient
              .from('upz')
              .update({ nama_upz: namaUpz, kategori: kategori })
              .eq('id', upzId);
            if (upzErr) throw upzErr;
          }

          const profileUpdate = { nama_lengkap: nama, status: status };
          const { error: profErr } = await supabaseClient
            .from('profiles')
            .update(profileUpdate)
            .eq('id', profileId);
          if (profErr) throw profErr;

          if (password) {
            await callBackend('updateUpzPassword', {
              profile_id: profileId,
              email: email,
              new_password: password
            });
          }
        }

        if (msgEl) { msgEl.textContent = 'Data berhasil disimpan!'; msgEl.style.color = '#259148'; }
        await loadUpzList();
        // Reload upzMap untuk filter admin
        await loadAdminSetoran();
        setTimeout(closeUpzFormModal, 1200);
      } catch (err) {
        console.error('SAVE UPZ ERROR:', err);
        if (msgEl) { msgEl.textContent = 'Gagal menyimpan: ' + err.message; msgEl.style.color = '#d93025'; }
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

  if (namaEl) namaEl.textContent = profile.nama_upz || profile.nama_lengkap || '-';
  if (kodeEl) kodeEl.textContent = profile.kode_upz || '-';
  if (katEl) katEl.textContent = profile.kategori || 'UPZ';
  if (pengelolaEl) pengelolaEl.textContent = profile.nama_lengkap || '-';
  if (emailEl) emailEl.textContent = profile.email || '-';
  if (statusEl) {
    statusEl.textContent = (profile.status || 'aktif').toUpperCase();
    statusEl.className = (profile.status === 'aktif' || !profile.status) ? 'badge badge-success' : 'badge badge-danger';
  }

  // Coba ambil email aktif dari sesi Supabase
  if (supabaseClient && supabaseClient.auth) {
    supabaseClient.auth.getSession().then(function (res) {
      const sess = res && res.data && res.data.session;
      if (sess && sess.user && sess.user.email && emailEl) {
        emailEl.textContent = sess.user.email;
      }
    }).catch(function () {});
  }
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
// UBAH NAMA PENGELOLA MANDIRI (ROLE UPZ)
// ==================================================
(function setupEditPengelola() {
  const modal = document.getElementById('editPengelolaModal');
  const openBtn = document.getElementById('openEditPengelolaModalBtn');
  const quickBtn = document.getElementById('btnQuickEditPengelola');
  const closeX = document.getElementById('editPengelolaModalCloseX');
  const cancelBtn = document.getElementById('editPengelolaModalCancel');
  const form = document.getElementById('editPengelolaForm');
  const inputNama = document.getElementById('inputNamaPengelola');
  const msgEl = document.getElementById('editPengelolaMsg');
  const saveBtn = document.getElementById('editPengelolaModalSave');

  if (!modal) return;

  function openModal() {
    if (inputNama) {
      inputNama.value = (currentProfile && currentProfile.nama_lengkap) ? currentProfile.nama_lengkap : '';
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
      if (msgEl) showMessage(msgEl, 'Menyimpan nama pengelola...', '#0f6c3e');

      try {
        // 1. Update tabel profiles di Supabase
        const { error: profErr } = await supabaseClient
          .from('profiles')
          .update({ nama_lengkap: newNama })
          .eq('id', currentProfile.id);

        if (profErr) throw profErr;

        // 2. Update user_metadata di Supabase Auth jika didukung
        try {
          if (supabaseClient.auth && supabaseClient.auth.updateUser) {
            await supabaseClient.auth.updateUser({
              data: { nama_lengkap: newNama }
            });
          }
        } catch (authErr) {
          console.warn('Update user metadata auth warning:', authErr);
        }

        // 3. Update state lokal dan tampilan UI
        currentProfile.nama_lengkap = newNama;

        const pengelolaEl = document.getElementById('upzMgmtProfilePengelola');
        if (pengelolaEl) pengelolaEl.textContent = newNama;

        const userNameEl = document.getElementById('userName');
        if (userNameEl) userNameEl.textContent = newNama;

        if (msgEl) showMessage(msgEl, 'Nama pengelola berhasil diperbarui!', '#0f6c3e');

        recordUpzActivity({
          type: 'perubahan',
          title: 'Perubahan Nama Pengelola',
          nama_upz: (currentProfile && (currentProfile.nama_upz || currentProfile.nama_lengkap)) || 'UPZ',
          upz_id: currentProfile && currentProfile.upz_id,
          nama_pengelola: newNama,
          desc: `Nama pengelola diubah menjadi <strong>${escapeHtml(newNama)}</strong>`
        });

        setTimeout(function () {
          closeModal();
        }, 900);

      } catch (err) {
        console.error('UPDATE NAMA PENGELOLA ERROR:', err);
        if (msgEl) showMessage(msgEl, 'Gagal memperbarui nama: ' + (err.message || 'Terjadi kesalahan.'), '#d93025');
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
    return st === 'diterima' || st === 'disetujui' || st === 'verified' || st === 'sukses';
  });

  populateUpzDonaturTahunFilter(accepted);

  if (!accepted.length) {
    upzDonaturCache = { upzId: currentProfile.upz_id, loaded: true, donors: [] };
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
    const currentYear = new Date().getFullYear();
    const donorMap = {};
    const upzSourceList = (allUpzList && allUpzList.length > 0) ? allUpzList : DEFAULT_UPZ_DATA;

    upzSourceList.slice(0, 12).forEach(function (u, idx) {
      const muzakiNames = [
        `Muzaki ASN ${u.nama_upz}`,
        `Keluarga Besar ${u.nama_upz}`,
        `Donatur Rutin ${u.nama_upz}`
      ];
      muzakiNames.forEach(function (mName, mIdx) {
        const key = `${u.upz_id || u.id}__${mName.toLowerCase()}`;
        donorMap[key] = {
          key: key,
          nama: mName,
          upz_id: u.upz_id || u.id,
          nama_upz: u.nama_upz,
          kategori: u.kategori || '-',
          donations: {}
        };
        donorMap[key].donations[currentYear] = {};
        const nowMonth = new Date().getMonth() + 1;
        for (let m = 1; m <= nowMonth; m++) {
          if ((idx + m + mIdx) % 2 === 0 || m === nowMonth) {
            donorMap[key].donations[currentYear][m] = {
              nominal: 150000 + (idx * 50000),
              jenis: 'Zakat / Infak'
            };
          }
        }
      });
    });

    adminDonaturCache = {
      loaded: true,
      donors: Object.values(donorMap).sort(function (a, b) {
        const c = a.nama_upz.localeCompare(b.nama_upz);
        return c !== 0 ? c : a.nama.localeCompare(b.nama);
      })
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

        if (!donorMap[key]) {
          donorMap[key] = {
            key: key,
            nama: rawName,
            upz_id: upzId,
            nama_upz: (upzMap && upzMap[upzId]) || 'UPZ',
            kategori: upzKategoriMap[upzId] || '-',
            donations: {}
          };
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

        if (!donorMap[key]) {
          donorMap[key] = {
            key: key,
            nama: upzTitle + ' (Setoran Terverifikasi)',
            upz_id: upzId,
            nama_upz: upzTitle,
            kategori: upzKategoriMap[upzId] || '-',
            donations: {}
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
  const countEl = document.getElementById('adminTotalDonaturScorecard');
  const titleEl = document.getElementById('scorecardDonaturTitle');
  const subEl = document.getElementById('scorecardDonaturSub');
  if (!countEl) return;

  await ensureAdminDonaturLoaded();

  const donors = adminDonaturCache.donors || [];
  let count = 0;
  if (!upzId || upzId === 'semua') {
    count = donors.length;
    if (titleEl) titleEl.textContent = 'Akumulasi Donatur';
    if (subEl) subEl.textContent = 'Total donatur dari seluruh UPZ';
  } else {
    const upzName = (upzMap && upzMap[upzId]) || 'UPZ Terpilih';
    const upzDonors = donors.filter(function (d) { return d.upz_id === upzId; });
    count = upzDonors.length;
    if (titleEl) titleEl.textContent = 'Donatur ' + (upzName.length > 20 ? upzName.slice(0, 18) + '...' : upzName);
    if (subEl) subEl.textContent = `Donatur terdaftar pada ${upzName}`;
  }
  countEl.textContent = count.toLocaleString('id-ID');
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

  // Scorecard UPZ filter listener
  const scorecardUpzFilter = document.getElementById('scorecardUpzFilter');
  if (scorecardUpzFilter) {
    scorecardUpzFilter.addEventListener('change', function () {
      updateScorecardDonatur(this.value);
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

  const yearSet = new Set([currentYear]);
  currentAdminSetoran.forEach(function (item) {
    if (item.periode_tahun) yearSet.add(Number(item.periode_tahun));
  });
  const years = Array.from(yearSet).sort(function (a, b) { return b - a; });

  if (yearSelect && (!yearSelect.options.length || yearSelect.dataset.populated !== 'true' || forcedYear)) {
    const curVal = forcedYear || (yearSelect.value ? Number(yearSelect.value) : years[0]);
    yearSelect.innerHTML = years.map(function (y) {
      return `<option value="${y}" ${y === curVal ? 'selected' : ''}>${y}</option>`;
    }).join('');
    yearSelect.dataset.populated = 'true';
  }

  const selectedYear = Number((yearSelect && yearSelect.value) ? yearSelect.value : (forcedYear || years[0]));

  const yearLabel = document.getElementById('adminChartYearLabel');
  if (yearLabel) yearLabel.textContent = selectedYear;

  const dataDiterima = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const dataMenunggu = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  currentAdminSetoran.forEach(function (item) {
    if (Number(item.periode_tahun) === selectedYear) {
      const m = Number(item.periode_bulan) - 1;
      if (m >= 0 && m < 12) {
        const nominal = Number(item.nominal || 0);
        const status = String(item.status || '').toLowerCase();
        if (status === 'diterima') {
          dataDiterima[m] += nominal;
        } else if (status === 'menunggu') {
          dataMenunggu[m] += nominal;
        }
      }
    }
  });

  const totalYear = dataDiterima.reduce(function (a, b) { return a + b; }, 0);
  const avgMonth = Math.round(totalYear / 12);

  let maxMonthIdx = 0;
  let maxMonthVal = 0;
  dataDiterima.forEach(function (val, idx) {
    if (val > maxMonthVal) {
      maxMonthVal = val;
      maxMonthIdx = idx;
    }
  });

  const totalEl = document.getElementById('adminChartTotalYear');
  if (totalEl) totalEl.textContent = formatRupiah(totalYear);

  const avgEl = document.getElementById('adminChartAvgMonth');
  if (avgEl) avgEl.textContent = formatRupiah(avgMonth);

  const peakEl = document.getElementById('adminChartPeakMonth');
  if (peakEl) {
    peakEl.textContent = maxMonthVal > 0
      ? BULAN_NAMES[maxMonthIdx + 1] + ' (' + formatRupiahSimple(maxMonthVal) + ')'
      : '-';
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
          label: 'Terverifikasi (Diterima)',
          data: dataDiterima,
          backgroundColor: 'rgba(25, 135, 84, 0.85)',
          hoverBackgroundColor: 'rgba(15, 108, 62, 1)',
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
  const years = Array.from(yearSet).sort(function (a, b) { return b - a; });

  if (yearSelect && (!yearSelect.options.length || yearSelect.dataset.populated !== 'true' || forcedYear)) {
    const curVal = forcedYear || (yearSelect.value ? Number(yearSelect.value) : years[0]);
    yearSelect.innerHTML = years.map(function (y) {
      return `<option value="${y}" ${y === curVal ? 'selected' : ''}>${y}</option>`;
    }).join('');
    yearSelect.dataset.populated = 'true';
  }

  const selectedYear = Number((yearSelect && yearSelect.value) ? yearSelect.value : (forcedYear || years[0]));

  const yearLabel = document.getElementById('upzChartYearLabel');
  if (yearLabel) yearLabel.textContent = selectedYear;

  const dataDiterima = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const dataMenunggu = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  currentSetoran.forEach(function (item) {
    if (Number(item.periode_tahun) === selectedYear) {
      const m = Number(item.periode_bulan) - 1;
      if (m >= 0 && m < 12) {
        const nominal = Number(item.nominal || 0);
        const status = String(item.status || '').toLowerCase();
        if (status === 'diterima') {
          dataDiterima[m] += nominal;
        } else if (status === 'menunggu') {
          dataMenunggu[m] += nominal;
        }
      }
    }
  });

  const totalYear = dataDiterima.reduce(function (a, b) { return a + b; }, 0);
  const avgMonth = Math.round(totalYear / 12);

  let maxMonthIdx = 0;
  let maxMonthVal = 0;
  dataDiterima.forEach(function (val, idx) {
    if (val > maxMonthVal) {
      maxMonthVal = val;
      maxMonthIdx = idx;
    }
  });

  const totalEl = document.getElementById('upzChartTotalYear');
  if (totalEl) totalEl.textContent = formatRupiah(totalYear);

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
          label: 'Diterima BAZNAS',
          data: dataDiterima,
          backgroundColor: 'rgba(25, 135, 84, 0.85)',
          hoverBackgroundColor: 'rgba(15, 108, 62, 1)',
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
function navigateToView(viewName) {
  currentActiveView = viewName;
  const adminPageEl = document.getElementById('adminPage');
  const isRoleAdmin = (currentProfile && currentProfile.role === 'admin') ||
    (adminPageEl && !adminPageEl.classList.contains('hidden'));

  if (isRoleAdmin) {
    const adminViews = {
      beranda: document.getElementById('adminViewBeranda'),
      setoran: document.getElementById('adminViewSetoran'),
      donatur: document.getElementById('adminViewDonatur'),
      upz: document.getElementById('adminViewUpz')
    };

    Object.keys(adminViews).forEach(function (key) {
      if (adminViews[key]) {
        adminViews[key].classList.toggle('hidden', key !== viewName);
      }
    });

    if (viewName === 'beranda') {
      renderAdminMonthlyChart();
    } else if (viewName === 'donatur') {
      const donaturSec = document.getElementById('adminDonaturManagement');
      if (donaturSec) donaturSec.classList.remove('hidden');
      loadAdminDonaturMatrix(true);
    } else if (viewName === 'upz') {
      const upzSec = document.getElementById('adminUpzManagement');
      if (upzSec) upzSec.classList.remove('hidden');
      loadUpzList();
    }
  } else {
    const upzViews = {
      beranda: document.getElementById('upzViewBeranda'),
      input: document.getElementById('upzViewInput'),
      donatur: document.getElementById('upzViewDonatur'),
      riwayat: document.getElementById('upzViewRiwayat'),
      mgmt: document.getElementById('upzViewMgmt')
    };

    Object.keys(upzViews).forEach(function (key) {
      if (upzViews[key]) {
        upzViews[key].classList.toggle('hidden', key !== viewName);
      }
    });

    if (viewName === 'beranda') {
      renderUpzMonthlyChart();
    } else if (viewName === 'donatur') {
      loadUpzDonaturMatrix();
    } else if (viewName === 'mgmt') {
      populateUpzMgmtProfile(currentProfile);
    }
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
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
    refreshBtn.addEventListener('click', async function () {
      if (refreshBtn.classList.contains('is-spinning')) return;
      refreshBtn.classList.add('is-spinning');
      refreshBtn.disabled = true;

      try {
        if (currentProfile && currentProfile.role === 'admin') {
          await loadAdminSetoran();
          if (currentActiveView === 'donatur') {
            await loadAdminDonaturMatrix(true);
          } else if (currentActiveView === 'upz') {
            await loadUpzList();
          } else {
            renderAdminMonthlyChart();
          }
        } else {
          await loadDashboard();
          if (currentActiveView === 'donatur') {
            await loadUpzDonaturMatrix(true);
          } else if (currentActiveView === 'mgmt') {
            populateUpzMgmtProfile(currentProfile);
          } else {
            renderUpzMonthlyChart();
          }
        }
      } catch (err) {
        console.error('REFRESH ERROR:', err);
      } finally {
        setTimeout(function () {
          refreshBtn.classList.remove('is-spinning');
          refreshBtn.disabled = false;
        }, 500);
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