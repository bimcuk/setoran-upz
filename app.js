
'use strict';

// ==================================================
// KONFIGURASI
// ==================================================

const SUPABASE_URL =
  'https://efmgvgqyzdbhmejigqyg.supabase.co';

const SUPABASE_ANON_KEY =
  'sb_publishable_qhbns7HHepypJ2s3TiF-MQ_i_-bpaow';

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

// ==================================================
// STATE
// ==================================================

let excelData = [];
let totalNominalExcel = 0;
let excelValid = false;
let currentProfile = null;
let isSubmitting = false;
let isReadingExcel = false;

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
      'Koneksi ke backend terputus. Hasil penyimpanan mungkin belum diketahui. ' +
      'Periksa dashboard dan riwayat sebelum mencoba mengirim ulang.'
    );
    networkError.uncertainResult = true;
    throw networkError;
  }

  const text = await response.text();
  let result;

  try {
    result = JSON.parse(text);
  } catch (error) {
    const parseError = new Error(
      'Backend memberikan respons yang tidak dapat dibaca. ' +
      'Periksa riwayat sebelum mencoba mengirim ulang.'
    );
    parseError.uncertainResult = true;
    console.error('BACKEND RAW RESPONSE:', text);
    throw parseError;
  }

  if (!response.ok || !result.success) {
    const backendError = new Error(
      result.message || 'Terjadi kesalahan pada server.'
    );

    // Respons kegagalan eksplisit berbeda dari koneksi yang terputus.
    backendError.backendRejected = true;
    backendError.backendResponse = result;

    throw backendError;
  }

  return result;
}

// ==================================================
// TAMPILAN LOGIN / DASHBOARD
// ==================================================

function showLogin() {
  if (loginPage) loginPage.classList.remove('hidden');
  if (dashboardPage) dashboardPage.classList.add('hidden');
}

function showDashboard() {
  if (loginPage) loginPage.classList.add('hidden');
  if (dashboardPage) dashboardPage.classList.remove('hidden');
}

// ==================================================
// LOAD DASHBOARD
// ==================================================

async function loadDashboard() {
  try {
    const result = await callBackend('getDashboard');

    console.log('GET DASHBOARD RESULT:', result);

    if (!result.profile) {
      throw new Error('Data profil tidak ditemukan dari backend.');
    }

    const profile = result.profile;

    if (profile.role !== 'upz' || !profile.upz_id) {
      throw new Error('Akun ini tidak terhubung ke UPZ.');
    }

    currentProfile = profile;

    const setoran = result.setoran || [];

    const userName = document.getElementById('userName');
    if (userName) {
      userName.textContent = profile.nama_lengkap || '-';
    }

    const upzName = document.getElementById('upzName');
    if (upzName) {
      upzName.textContent = profile.upz_id || '-';
    }

    const jumlahTransaksi = document.getElementById('jumlahTransaksi');
    if (jumlahTransaksi) {
      jumlahTransaksi.textContent = setoran.length;
    }

    const total = setoran.reduce(function(sum, item) {
      return sum + Number(item.nominal || 0);
    }, 0);

    const totalSetoran = document.getElementById('totalSetoran');
    if (totalSetoran) {
      totalSetoran.textContent = formatRupiah(total);
    }

    const statusTerakhir = document.getElementById('statusTerakhir');
    if (statusTerakhir) {
      statusTerakhir.textContent =
        setoran.length > 0 ? setoran[0].status || '-' : '-';
    }

    renderRiwayat(setoran);
    showDashboard();

    return true;

  } catch (error) {
    console.error('DASHBOARD ERROR:', error);
    showMessage(message, error.message, '#d93025');
    showLogin();
    return false;
  }
}

// ==================================================
// RENDER RIWAYAT
// ==================================================

function renderRiwayat(setoran) {
  const container = document.getElementById('riwayatContainer');
  if (!container) return;

  if (!setoran.length) {
    container.innerHTML = `
      <div class="empty-state">Belum ada data setoran.</div>
    `;
    return;
  }

  const namaBulan = [
    '',
    'Januari', 'Februari', 'Maret', 'April',
    'Mei', 'Juni', 'Juli', 'Agustus',
    'September', 'Oktober', 'November', 'Desember'
  ];

  container.innerHTML = setoran.map(function(item) {
    const tanggal = item.tanggal_setor
      ? new Date(item.tanggal_setor + 'T00:00:00')
          .toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })
      : '-';

    const bulan =
      namaBulan[Number(item.periode_bulan)] || '-';

    const periode = item.periode_tahun
      ? bulan + ' ' + item.periode_tahun
      : '-';

    const status = String(item.status || '-');
    let statusClass = 'status-menunggu';

    if (status === 'diterima') statusClass = 'status-diterima';
    if (status === 'ditolak') statusClass = 'status-ditolak';
    if (status === 'sesuai') statusClass = 'status-sesuai';
    if (status === 'selisih') statusClass = 'status-selisih';

    const statusLabel =
      status.charAt(0).toUpperCase() + status.slice(1);

    return `
      <div class="riwayat-item">
        <div class="riwayat-main">
          <div class="riwayat-nominal">
            ${formatRupiah(item.nominal)}
          </div>
          <div class="riwayat-info">
            <div>Setoran: <strong>${escapeHtml(tanggal)}</strong></div>
            <div>Periode: <strong>${escapeHtml(periode)}</strong></div>
          </div>
        </div>
        <div class="status-badge ${statusClass}">
          ${escapeHtml(statusLabel)}
        </div>
      </div>
    `;
  }).join('');
}

// ==================================================
// LOGIN
// ==================================================

if (loginForm) {
  loginForm.addEventListener('submit', async function(event) {
    event.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    loginButton.disabled = true;
    loginButton.textContent = 'Login...';
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
      showMessage(message, error.message, '#d93025');

    } finally {
      loginButton.disabled = false;
      loginButton.textContent = 'Login';
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
      showLogin();

      document.getElementById('email').value = '';
      document.getElementById('password').value = '';

      showMessage(message, '', '');
      loginButton.disabled = false;
      loginButton.textContent = 'Login';

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

checkSession();

// ==================================================
// SUBMIT SETORAN - SATU TRANSAKSI DATABASE
// ==================================================

if (setoranForm) {
  setoranForm.addEventListener('submit', async function(event) {
    event.preventDefault();

    // Pengaman terhadap pemanggilan submit berulang.
    if (isSubmitting) return;

    const tanggalSetor =
      document.getElementById('tanggalSetor').value;

    const periodeBulan =
      document.getElementById('periodeBulan').value;

    const periodeTahun =
      document.getElementById('periodeTahun').value;

    const nominalInput =
      document.getElementById('nominalSetoran').value;

    const file = fileExcel && fileExcel.files
      ? fileExcel.files[0]
      : null;

    if (!tanggalSetor || !periodeBulan ||
        !periodeTahun || !nominalInput) {
      showMessage(
        setoranMessage,
        'Semua data setoran wajib diisi.',
        '#d93025'
      );
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

    if (!currentProfile || !currentProfile.upz_id) {
      showMessage(
        setoranMessage,
        'Profil UPZ belum tersedia. Silakan login kembali.',
        '#d93025'
      );
      return;
    }

    if (isReadingExcel) {
      showMessage(
        setoranMessage,
        'Tunggu sampai pembacaan Excel selesai.',
        '#d93025'
      );
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

      if (!Number.isFinite(nominalAngka) || nominalAngka < 0) {
        throw new Error('Nominal setoran tidak valid.');
      }

      // Siapkan ulang rincian dari hasil pembacaan Excel.
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
              'Nominal muzaki pada baris data ' +
              (index + 1) + ' kosong.'
            );
          }

          const nominal = parseNominalExcel(nominalCell);

          if (!Number.isFinite(nominal) || nominal < 0) {
            throw new Error(
              'Nominal muzaki pada baris data ' +
              (index + 1) + ' tidak valid.'
            );
          }

          const jenisCell = row[indexes.jenisIndex];

          return {
            nama_muzaki: nama,
            nominal: nominal,
            jenis: jenisCell
              ? String(jenisCell).trim()
              : null
          };
        });

      if (!detail.length) {
        throw new Error('Data rincian muzaki tidak ditemukan.');
      }

      // Hitung ulang di browser sebagai pemeriksaan awal.
      const totalDetail = detail.reduce(function(sum, item) {
        return sum + item.nominal;
      }, 0);

      if (Math.round(totalDetail * 100) !==
          Math.round(nominalAngka * 100)) {
        throw new Error(
          'Total rincian Excel tidak sama dengan nominal setoran.'
        );
      }

      isSubmitting = true;
      setSubmitButtonState(true, 'Menyimpan...');
      showMessage(
        setoranMessage,
        'Mengupload file Excel...',
        '#666'
      );

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

        // SATU pemanggilan backend untuk setoran + semua detail.
        const response = await callBackend(
          'simpanSetoranLengkap',
          {
            tanggal_setor: tanggalSetor,
            periode_bulan: Number(periodeBulan),
            periode_tahun: Number(periodeTahun),
            nominal: nominalAngka,
            file_name: uploadedFile.originalName,
            file_path: uploadedFile.filePath,
            detail: detail
          }
        );

        transactionSaved = true;

        console.log(
          'SIMPAN SETORAN LENGKAP RESULT:',
          response
        );

        const result = response.result || {};

        showMessage(
          setoranMessage,
          'Setoran dan rincian berhasil disimpan. Status: ' +
            (result.status || 'tersimpan') +
            '.',
          '#259148'
        );

        // Reset form setelah server mengonfirmasi keberhasilan.
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

        // Hapus file hanya jika backend secara eksplisit menolak
        // transaksi. Jika koneksi putus, hasil transaksi tidak pasti.
        if (
          uploadedFile &&
          error.backendRejected &&
          !transactionSaved
        ) {
          try {
            await deleteExcelFromStorage(uploadedFile.filePath);
          } catch (cleanupError) {
            console.error(
              'CLEANUP FILE ERROR:',
              cleanupError
            );
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

      if (excelData.length > 0) {
        refreshExcelSummary();
      }

      return;
    }

    this.value = Number(angka).toLocaleString('id-ID');

    if (excelData.length > 0) {
      refreshExcelSummary();
    }
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

  if (typeof value === 'number') {
    return value;
  }

  let text = String(value)
    .trim()
    .replace(/rp/gi, '')
    .replace(/\s/g, '');

  if (!text) return 0;

  // Format angka Excel Indonesia, misalnya 1.250.000
  // atau Rp 1.250.000.
  if (/^-?\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, '');
  } else if (/^-?\d+,\d{1,2}$/.test(text)) {
    // Koma sebagai desimal jika nilainya berupa teks.
    text = text.replace(',', '.');
  } else if (/^-?\d+(\.\d+)?$/.test(text)) {
    // Angka polos atau desimal titik.
  } else {
    // Fallback untuk pemisah ribuan yang tercampur.
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

  const noIndex = header.indexOf('no');
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
    noIndex: noIndex,
    namaIndex: namaIndex,
    nominalIndex: nominalIndex,
    jenisIndex: jenisIndex
  };
}

// ==================================================
// UPLOAD EXCEL KE STORAGE
// ==================================================

async function uploadExcelToStorage(file, upzId, tahun, bulan) {
  if (!file) {
    throw new Error('File Excel tidak ditemukan.');
  }

  if (!upzId) {
    throw new Error('ID UPZ tidak ditemukan.');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Ukuran file Excel maksimal 5 MB.');
  }

  const lowerName = file.name.toLowerCase();
  const allowed = lowerName.endsWith('.xlsx') ||
    lowerName.endsWith('.xls');

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

    if (!nama || String(nama).trim() === '') {
      return;
    }

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
      'Terdapat selisih Rp ' +
      formatRupiahSimple(Math.abs(selisih)) + '.';
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
      <div style="
        display:flex;
        justify-content:space-between;
        gap:15px;
        margin-bottom:6px;
      ">
        <span>Total Data Muzaki</span>
        <strong>${jumlahData}</strong>
      </div>

      <div style="
        display:flex;
        justify-content:space-between;
        gap:15px;
        margin-bottom:6px;
      ">
        <span>Total Nominal Excel</span>
        <strong>Rp ${formatRupiahSimple(totalExcel)}</strong>
      </div>

      <div style="
        display:flex;
        justify-content:space-between;
        gap:15px;
        margin-bottom:8px;
      ">
        <span>Nominal Setoran</span>
        <strong>Rp ${formatRupiahSimple(nominal)}</strong>
      </div>

      <div style="
        padding-top:8px;
        border-top:1px solid #e5e5e5;
        color:${statusColor};
        font-weight:600;
      ">
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

    if (fileExcelInfo) {
      fileExcelInfo.textContent = 'Membaca file...';
    }

    try {
      const arrayBuffer = await file.arrayBuffer();

      const workbook = XLSX.read(arrayBuffer, {
        type: 'array'
      });

      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        throw new Error('Sheet Excel tidak ditemukan.');
      }

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
// RENDER PREVIEW EXCEL
// ==================================================

function renderExcelPreview(rows, indexes) {
  if (!rows || !rows.length || !excelPreview) return;

  const header = rows[0];
  const data = rows.slice(1);
  const previewRows = data.slice(0, 20);

  let html = `
    <table>
      <thead>
        <tr>
  `;

  header.forEach(function(cell) {
    html += `<th>${escapeHtml(cell || '')}</th>`;
  });

  html += `
        </tr>
      </thead>
      <tbody>
  `;

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

  html += `
      </tbody>
    </table>
  `;

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
