
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

const adminPage = document.getElementById('adminPage');
const adminSetoranContainer = document.getElementById('adminSetoranContainer');
const adminFilterStatus = document.getElementById('adminFilterStatus');
const adminMessage = document.getElementById('adminMessage');
const refreshAdminButton = document.getElementById('refreshAdminButton');

// ==================================================
// STATE
// ==================================================

let excelData = [];
let totalNominalExcel = 0;
let excelValid = false;
let currentProfile = null;
let currentSetoran = [];
let currentAdminSetoran = [];
let isSubmitting = false;
let isReadingExcel = false;
let isLoadingDashboard = false;
let isLoadingAdmin = false;

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
  return String(value ?? '').replace(/[&<>"']/g, function(char) {
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
    .filter(function(item) {
      return String(item.status || '').toLowerCase() === 'diterima';
    })
    .reduce(function(total, item) {
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
  return items.slice().sort(function(a, b) {
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dateB - dateA;
  });
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

  document.querySelectorAll('.upz-only').forEach(function(element) {
    element.classList.toggle('hidden', role !== 'upz');
  });

  if (adminPage) {
    adminPage.classList.toggle('hidden', role !== 'admin');
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

    renderRiwayat(setoran);
    showRolePage('upz');

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

function renderRiwayat(setoran) {
  const container = document.getElementById('riwayatContainer');
  if (!container) return;

  if (!setoran.length) {
    container.innerHTML =
      '<div class="empty-state">Belum ada data setoran.</div>';
    return;
  }

  container.innerHTML = setoran.map(function(item) {
    const tanggal = formatTanggal(item.tanggal_setor);
    const periode = item.periode_tahun
      ? getNamaBulan(item.periode_bulan) + ' ' + item.periode_tahun
      : '-';

    const status = String(item.status || 'menunggu').toLowerCase();
    const transactionId = escapeHtml(item.id || '');
    const fileName = escapeHtml(item.file_name || 'File Excel');

    return `
      <details class="riwayat-item"
        data-setoran-id="${transactionId}"
        style="margin-bottom:12px;">

        <summary class="riwayat-main"
          style="cursor:pointer;list-style-position:inside;padding:12px;">

          <div class="riwayat-nominal">${formatRupiah(item.nominal)}</div>

          <div class="riwayat-info">
            <div>Tanggal setor: <strong>${escapeHtml(tanggal)}</strong></div>
            <div>Periode: <strong>${escapeHtml(periode)}</strong></div>
          </div>

          <div class="status-badge ${getStatusClass(status)}">
            ${escapeHtml(getStatusLabel(status))}
          </div>
        </summary>

        <div class="riwayat-detail"
          data-detail-loaded="false"
          style="padding:14px;border-top:1px solid #eee;">

          <div style="margin-bottom:12px;">
            <strong>Rincian Donatur</strong>
          </div>

          <div class="detail-setoran-content">
            <p style="color:#777;">Buka transaksi untuk memuat rincian.</p>
          </div>

          <div style="margin-top:14px;">
            ${
              item.file_path
                ? `<button type="button"
                    class="download-excel-button"
                    data-download-id="${transactionId}">
                    Unduh Excel (${fileName})
                  </button>`
                : '<p style="font-size:13px;color:#777;">File Excel tidak tersedia.</p>'
            }
          </div>

          ${
            item.catatan
              ? `<div style="margin-top:12px;padding:10px;background:#fff8e6;border-radius:8px;">
                   <strong>Catatan verifikasi:</strong>
                   <div>${escapeHtml(item.catatan)}</div>
                 </div>`
              : ''
          }
        </div>
      </details>
    `;
  }).join('');

  container.querySelectorAll('details[data-setoran-id]').forEach(function(details) {
    details.addEventListener('toggle', async function() {
      if (!details.open) return;

      const detailBox = details.querySelector('.riwayat-detail');
      if (!detailBox || detailBox.dataset.detailLoaded === 'true') return;

      const content = detailBox.querySelector('.detail-setoran-content');
      content.innerHTML = '<p style="color:#777;">Memuat rincian donatur...</p>';

      try {
        const detail = await getDetailSetoran(details.dataset.setoranId);
        content.innerHTML = renderDetailSetoran(detail);
        detailBox.dataset.detailLoaded = 'true';
      } catch (error) {
        console.error('LOAD DETAIL RIWAYAT ERROR:', error);
        content.innerHTML = `
          <p style="color:#d93025;">${escapeHtml(error.message)}</p>
          <button type="button" class="retry-detail-button">Coba Lagi</button>
        `;

        const retry = content.querySelector('.retry-detail-button');
        if (retry) {
          retry.addEventListener('click', function() {
            detailBox.dataset.detailLoaded = 'false';
            details.open = false;
            details.open = true;
          });
        }
      }
    });
  });

  container.querySelectorAll('.download-excel-button').forEach(function(button) {
    button.addEventListener('click', async function(event) {
      event.preventDefault();
      event.stopPropagation();

      const item = currentSetoran.find(function(row) {
        return String(row.id) === String(button.dataset.downloadId);
      });

      if (!item || !item.file_path) {
        alert('Lokasi file Excel tidak ditemukan.');
        return;
      }

      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = 'Menyiapkan unduhan...';

      try {
        const { data, error } = await supabaseClient
          .storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(item.file_path, 60, { download: true });

        if (error) throw error;
        if (!data || !data.signedUrl) {
          throw new Error('Tautan unduhan tidak berhasil dibuat.');
        }

        const link = document.createElement('a');
        link.href = data.signedUrl;
        link.download = item.file_name || 'rincian-setoran.xlsx';
        link.target = '_blank';
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        link.remove();

      } catch (error) {
        console.error('DOWNLOAD EXCEL ERROR:', error);
        alert(
          'Gagal mengunduh file Excel. Pastikan file masih ada dan izin Storage sudah benar.\n\n' +
          error.message
        );
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    });
  });
}

// ==================================================
// RENDER DETAIL DONATUR
// ==================================================

function renderDetailSetoran(detail) {
  if (!detail || !detail.length) {
    return '<p class="empty-state">Rincian donatur tidak ditemukan.</p>';
  }

  const total = detail.reduce(function(sum, item) {
    return sum + Number(item.nominal || 0);
  }, 0);

  const rows = detail.map(function(item, index) {
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
    refreshAdminButton.textContent = 'Memuat...';
  }

  showMessage(adminMessage, 'Memuat daftar setoran...', '#666');

  try {
    const result = await callBackend('getAdminSetoran');
    const rows = Array.isArray(result.setoran) ? result.setoran : [];

    currentAdminSetoran = sortByCreatedAt(rows);

    updateAdminSummary(currentAdminSetoran);
    renderAdminSetoran(currentAdminSetoran);

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
      refreshAdminButton.textContent = 'Muat Ulang';
    }
  }
}

function updateAdminSummary(setoran) {
  const jumlahTransaksi = document.getElementById('adminJumlahTransaksi');
  const jumlahMenunggu = document.getElementById('adminJumlahMenunggu');
  const totalNominal = document.getElementById('adminTotalNominal');

  const menunggu = setoran.filter(function(item) {
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
}

function renderAdminSetoran(setoran) {
  if (!adminSetoranContainer) return;

  let filtered = setoran.slice();

  const filterStatus = adminFilterStatus
    ? adminFilterStatus.value
    : 'semua';

  if (filterStatus && filterStatus !== 'semua' && filterStatus !== 'all') {
    filtered = filtered.filter(function(item) {
      return String(item.status || '').toLowerCase() ===
        String(filterStatus).toLowerCase();
    });
  }

  if (!filtered.length) {
    adminSetoranContainer.innerHTML = `
      <div class="empty-state">
        Tidak ada setoran yang cocok dengan filter ini.
      </div>
    `;
    return;
  }

  adminSetoranContainer.innerHTML = filtered.map(function(item) {
    const id = escapeHtml(item.id || '');
    const status = String(item.status || 'menunggu').toLowerCase();
    const statusKecocokan = String(item.status_kecocokan || '').toLowerCase();
    const periode = getNamaBulan(item.periode_bulan) + ' ' +
      (item.periode_tahun || '');

    const isPending = status === 'menunggu';

    return `
      <details class="riwayat-item admin-riwayat-item"
        data-admin-setoran-id="${id}"
        style="margin-bottom:14px;">

        <summary class="riwayat-main"
          style="cursor:pointer;list-style-position:inside;padding:14px;">

          <div class="riwayat-nominal">${formatRupiah(item.nominal)}</div>

          <div class="riwayat-info">
            <div>Tanggal setor:
              <strong>${escapeHtml(formatTanggal(item.tanggal_setor))}</strong>
            </div>
            <div>Periode: <strong>${escapeHtml(periode)}</strong></div>
            <div style="font-size:12px;color:#777;word-break:break-all;">
              ID UPZ: ${escapeHtml(item.upz_id || '-')}
            </div>
          </div>

          <div class="status-badge ${getStatusClass(status)}">
            ${escapeHtml(getStatusLabel(status))}
          </div>
        </summary>

        <div style="padding:14px;border-top:1px solid #eee;">
          <div style="display:grid;gap:7px;margin-bottom:14px;">
            <div><strong>Waktu pengajuan:</strong>
              ${escapeHtml(formatTanggalWaktu(item.created_at))}
            </div>
            <div><strong>Status pemeriksaan nominal:</strong>
              ${escapeHtml(
                statusKecocokan === 'sesuai'
                  ? 'Sesuai'
                  : statusKecocokan === 'selisih'
                    ? 'Ada selisih'
                    : 'Belum tersedia'
              )}
            </div>
            <div><strong>File Excel:</strong>
              ${escapeHtml(item.file_name || 'Tidak tersedia')}
            </div>
            ${
              item.catatan
                ? `<div style="padding:10px;background:#fff8e6;border-radius:8px;">
                     <strong>Catatan:</strong><br>
                     ${escapeHtml(item.catatan)}
                   </div>`
                : ''
            }
          </div>

          <div class="admin-detail-content"
            data-detail-loaded="false"
            style="margin-bottom:14px;">
            <p style="color:#777;">Rincian donatur akan dimuat saat dibuka.</p>
          </div>

          ${
            item.file_path
              ? `<button type="button"
                  class="admin-download-button"
                  data-download-id="${id}">
                  Unduh File Excel
                </button>`
              : '<p style="font-size:13px;color:#777;">File Excel tidak tersedia.</p>'
          }

          ${
            isPending
              ? `
                <div style="margin-top:18px;padding-top:14px;border-top:1px solid #eee;">
                  <label for="catatan-${id}" style="display:block;margin-bottom:6px;">
                    Catatan verifikasi
                  </label>
                  <textarea
                    id="catatan-${id}"
                    class="admin-catatan"
                    data-catatan-id="${id}"
                    rows="3"
                    placeholder="Catatan wajib diisi jika setoran ditolak."
                    style="width:100%;box-sizing:border-box;margin-bottom:10px;"
                  ></textarea>

                  <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button type="button"
                      class="admin-verify-button"
                      data-keputusan="diterima"
                      data-setoran-id="${id}">
                      Terima Setoran
                    </button>

                    <button type="button"
                      class="admin-verify-button"
                      data-keputusan="ditolak"
                      data-setoran-id="${id}">
                      Tolak Setoran
                    </button>
                  </div>
                </div>
              `
              : ''
          }
        </div>
      </details>
    `;
  }).join('');

  bindAdminDetailEvents();
  bindAdminVerifyEvents();
  bindAdminDownloadEvents();
}

function bindAdminDetailEvents() {
  if (!adminSetoranContainer) return;

  adminSetoranContainer
    .querySelectorAll('details[data-admin-setoran-id]')
    .forEach(function(details) {
      details.addEventListener('toggle', async function() {
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
            retry.addEventListener('click', function() {
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
    .forEach(function(button) {
      button.addEventListener('click', async function() {
        const setoranId = button.dataset.setoranId;
        const keputusan = button.dataset.keputusan;
        const catatanElement = adminSetoranContainer.querySelector(
          '[data-catatan-id="' + setoranId + '"]'
        );
        const catatan = catatanElement ? catatanElement.value.trim() : '';

        if (keputusan === 'ditolak' && !catatan) {
          alert('Catatan wajib diisi jika setoran ditolak.');
          if (catatanElement) catatanElement.focus();
          return;
        }

        const konfirmasi = keputusan === 'diterima'
          ? 'Terima setoran ini? Nominalnya akan masuk ke total setoran terverifikasi.'
          : 'Tolak setoran ini? Nominalnya tidak akan masuk ke total setoran terverifikasi.';

        if (!window.confirm(konfirmasi)) return;

        const originalText = button.textContent;

        adminSetoranContainer
          .querySelectorAll(
            '.admin-verify-button[data-setoran-id="' + setoranId + '"]'
          )
          .forEach(function(el) {
            el.disabled = true;
          });

        button.textContent = 'Menyimpan...';
        showMessage(adminMessage, 'Menyimpan hasil verifikasi...', '#666');

        try {
          const result = await callBackend('verifikasiSetoran', {
            setoran_id: setoranId,
            keputusan: keputusan,
            catatan: catatan
          });

          showMessage(
            adminMessage,
            result.message || 'Verifikasi berhasil disimpan.',
            '#259148'
          );

          // Ambil ulang daftar setelah status berubah agar total langsung diperbarui.
          await loadAdminSetoran();

        } catch (error) {
          console.error('VERIFIKASI SETORAN ERROR:', error);

          showMessage(
            adminMessage,
            error.message || 'Verifikasi gagal.',
            '#d93025'
          );

          if (error.uncertainResult) {
            alert(
              error.message +
              '\n\nMuat ulang daftar setoran untuk memastikan status terbaru.'
            );
            await loadAdminSetoran();
          } else {
            button.disabled = false;
            button.textContent = originalText;

            adminSetoranContainer
              .querySelectorAll(
                '.admin-verify-button[data-setoran-id="' + setoranId + '"]'
              )
              .forEach(function(el) {
                el.disabled = false;
              });
          }
        }
      });
    });
}

function bindAdminDownloadEvents() {
  if (!adminSetoranContainer) return;

  adminSetoranContainer
    .querySelectorAll('.admin-download-button')
    .forEach(function(button) {
      button.addEventListener('click', async function() {
        const item = currentAdminSetoran.find(function(row) {
          return String(row.id) === String(button.dataset.downloadId);
        });

        if (!item || !item.file_path) {
          alert('Lokasi file tidak ditemukan.');
          return;
        }

        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = 'Menyiapkan unduhan...';

        try {
          const { data, error } = await supabaseClient
            .storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(item.file_path, 60, { download: true });

          if (error) throw error;
          if (!data || !data.signedUrl) {
            throw new Error('Tautan unduhan tidak berhasil dibuat.');
          }

          const link = document.createElement('a');
          link.href = data.signedUrl;
          link.download = item.file_name || 'rincian-setoran.xlsx';
          link.target = '_blank';
          link.rel = 'noopener';
          document.body.appendChild(link);
          link.click();
          link.remove();

        } catch (error) {
          console.error('ADMIN DOWNLOAD ERROR:', error);

          alert(
            'Unduhan gagal. Kebijakan Storage saat ini mungkin hanya mengizinkan UPZ mengakses folder miliknya.\n\n' +
            error.message
          );
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

if (adminFilterStatus) {
  adminFilterStatus.addEventListener('change', function() {
    renderAdminSetoran(currentAdminSetoran);
  });
}

if (refreshAdminButton) {
  refreshAdminButton.addEventListener('click', function() {
    loadAdminSetoran();
  });
}

// ==================================================
// LOGIN
// ==================================================

if (loginForm) {
  loginForm.addEventListener('submit', async function(event) {
    event.preventDefault();

    const emailElement = document.getElementById('email');
    const passwordElement = document.getElementById('password');

    const email = emailElement ? emailElement.value.trim() : '';
    const password = passwordElement ? passwordElement.value : '';

    if (loginButton) {
      loginButton.disabled = true;
      loginButton.textContent = 'Login...';
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
      showMessage(message, error.message, '#d93025');

    } finally {
      if (loginButton) {
        loginButton.disabled = false;
        loginButton.textContent = 'Login';
      }
    }
  });
}

// ==================================================
// LOGOUT
// ==================================================

if (logoutButton) {
  logoutButton.addEventListener('click', async function() {
    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;

      currentProfile = null;
      currentSetoran = [];
      currentAdminSetoran = [];

      showLogin();

      const email = document.getElementById('email');
      const password = document.getElementById('password');

      if (email) email.value = '';
      if (password) password.value = '';

      showMessage(message, '', '');

      if (loginButton) {
        loginButton.disabled = false;
        loginButton.textContent = 'Login';
      }

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
    } else {
      showLogin();
    }
  } catch (error) {
    console.error('SESSION ERROR:', error);
    showLogin();
  }
}

// ==================================================
// SUBMIT SETORAN UPZ
// ==================================================

if (setoranForm) {
  setoranForm.addEventListener('submit', async function(event) {
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
        .filter(function(row) {
          const nama = row[indexes.namaIndex];
          return nama !== undefined &&
            nama !== null &&
            String(nama).trim() !== '';
        })
        .map(function(row, index) {
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

      const totalDetail = detail.reduce(function(sum, item) {
        return sum + item.nominal;
      }, 0);

      if (Math.round(totalDetail * 100) !== Math.round(nominalAngka * 100)) {
        throw new Error('Total rincian Excel tidak sama dengan nominal setoran.');
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
// FORMAT NOMINAL SETORAN
// ==================================================

if (nominalSetoran) {
  nominalSetoran.addEventListener('input', function() {
    const angka = this.value.replace(/\D/g, '');

    if (!angka) {
      this.value = '';
      excelValid = false;

      if (excelData.length > 0) refreshExcelSummary();
      return;
    }

    this.value = Number(angka).toLocaleString('id-ID');

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

  const header = rows[0].map(function(cell) {
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

  rows.slice(1).forEach(function(row) {
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
  fileExcel.addEventListener('change', async function() {
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

  header.forEach(function(cell) {
    html += `<th>${escapeHtml(cell || '')}</th>`;
  });

  html += '</tr></thead><tbody>';

  previewRows.forEach(function(row) {
    html += '<tr>';

    header.forEach(function(_, index) {
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
// MULAI APLIKASI
// ==================================================

checkSession();
