const SUPABASE_URL =
  'https://efmgvgqyzdbhmejigqyg.supabase.co';

const SUPABASE_ANON_KEY =
  'sb_publishable_qhbns7HHepypJ2s3TiF-MQ_i_-bpaow';

const APPS_SCRIPT_URL =
  '/api/backend';


const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );


// ==================================================
// ELEMENT
// ==================================================

const loginPage =
  document.getElementById('loginPage');

const dashboardPage =
  document.getElementById('dashboardPage');

const loginForm =
  document.getElementById('loginForm');

const loginButton =
  document.getElementById('loginButton');

const message =
  document.getElementById('message');

const logoutButton =
  document.getElementById('logoutButton');


// ==================================================
// FORMAT RUPIAH
// ==================================================

function formatRupiah(value) {

  const number =
    Number(value || 0);

  return new Intl.NumberFormat(
    'id-ID',
    {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }
  ).format(number);

}


// ==================================================
// CALL BACKEND
// ==================================================

async function callBackend(
  action,
  payload = {}
) {

  const {
    data: { session },
    error
  } =
    await supabaseClient
      .auth
      .getSession();


  if (error || !session) {

    throw new Error(
      'Session login tidak ditemukan.'
    );

  }


  const response =
    await fetch(
      APPS_SCRIPT_URL,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json'
        },

        body: JSON.stringify({

          action: action,

          token:
            session.access_token,

          payload: payload

        })
      }
    );


  const result =
    await response.json();


  if (!result.success) {

    throw new Error(
      result.message ||
      'Terjadi kesalahan pada server.'
    );

  }


  return result;

}


// ==================================================
// TAMPILKAN LOGIN
// ==================================================

function showLogin() {

  loginPage
    .classList
    .remove('hidden');

  dashboardPage
    .classList
    .add('hidden');

}


// ==================================================
// TAMPILKAN DASHBOARD
// ==================================================

function showDashboard() {

  loginPage
    .classList
    .add('hidden');

  dashboardPage
    .classList
    .remove('hidden');

}


// ==================================================
// LOAD DASHBOARD
// ==================================================

async function loadDashboard() {

  try {

    const result =
      await callBackend(
        'getDashboard'
      );


    const profile =
      result.profile;

    const setoran =
      result.setoran || [];


    // USER

    document.getElementById(
      'userName'
    ).textContent =
      profile.nama_lengkap;


    // UPZ

    document.getElementById(
      'upzName'
    ).textContent =
      profile.upz_id;


    // JUMLAH TRANSAKSI

    document.getElementById(
      'jumlahTransaksi'
    ).textContent =
      setoran.length;


    // TOTAL SETORAN

    const total =
      setoran.reduce(
        (
          sum,
          item
        ) =>
          sum +
          Number(
            item.nominal || 0
          ),
        0
      );


    document.getElementById(
      'totalSetoran'
    ).textContent =
      formatRupiah(total);


    // STATUS TERAKHIR

    const status =
      setoran.length > 0
        ? setoran[0].status
        : '-';


    document.getElementById(
      'statusTerakhir'
    ).textContent =
      status;


    // RIWAYAT

    renderRiwayat(
      setoran
    );


    showDashboard();


  } catch (error) {

    console.error(
      'DASHBOARD ERROR:',
      error
    );

    message.textContent =
      error.message;

    message.style.color =
      'red';

    showLogin();

  }

}


// ==================================================
// RENDER RIWAYAT
// ==================================================

function renderRiwayat(setoran) {

  const container =
    document.getElementById(
      'riwayatContainer'
    );


  if (!setoran.length) {

    container.innerHTML = `
      <div class="empty-state">
        Belum ada data setoran.
      </div>
    `;

    return;

  }


  const namaBulan = [
    '',
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember'
  ];


  container.innerHTML =
    setoran.map(
      item => {

        const tanggal =
          item.tanggal_setor
            ? new Date(
                item.tanggal_setor +
                'T00:00:00'
              ).toLocaleDateString(
                'id-ID',
                {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                }
              )
            : '-';


        const bulan =
          namaBulan[
            Number(
              item.periode_bulan
            )
          ] || '-';


        const periode =
          item.periode_tahun
            ? `${bulan} ${item.periode_tahun}`
            : '-';


        const status =
          item.status || '-';


        let statusClass =
          'status-menunggu';


        if (
          status === 'diterima'
        ) {

          statusClass =
            'status-diterima';

        }


        if (
          status === 'ditolak'
        ) {

          statusClass =
            'status-ditolak';

        }


        if (
          status === 'sesuai'
        ) {

          statusClass =
            'status-sesuai';

        }


        if (
          status === 'selisih'
        ) {

          statusClass =
            'status-selisih';

        }


        const statusLabel =
          status.charAt(0).toUpperCase() +
          status.slice(1);


        return `

          <div class="riwayat-item">

            <div class="riwayat-main">

              <div class="riwayat-nominal">
                ${formatRupiah(item.nominal)}
              </div>

              <div class="riwayat-info">

                <div>
                  Setoran:
                  <strong>${tanggal}</strong>
                </div>

                <div>
                  Periode:
                  <strong>${periode}</strong>
                </div>

              </div>

            </div>


            <div
              class="status-badge ${statusClass}"
            >
              ${statusLabel}
            </div>

          </div>

        `;

      }
    ).join('');

}


// ==================================================
// LOGIN
// ==================================================

loginForm.addEventListener(
  'submit',
  async function(event) {

    event.preventDefault();


    const email =
      document
        .getElementById(
          'email'
        )
        .value
        .trim();


    const password =
      document
        .getElementById(
          'password'
        )
        .value;


    loginButton.disabled =
      true;

    loginButton.textContent =
      'Login...';

    message.textContent =
      '';


    const {
      data,
      error
    } =
      await supabaseClient
        .auth
        .signInWithPassword({

          email:
            email,

          password:
            password

        });


    if (error) {

      message.textContent =
        error.message;

      message.style.color =
        'red';

      loginButton.disabled =
        false;

      loginButton.textContent =
        'Login';

      return;

    }


    message.textContent =
      'Login berhasil.';

    message.style.color =
      '#259148';


    loginButton.textContent =
      'Berhasil';


    await loadDashboard();

  }
);


// ==================================================
// LOGOUT
// ==================================================

logoutButton.addEventListener(
  'click',
  async function() {

    await supabaseClient
      .auth
      .signOut();


    showLogin();


    document
      .getElementById(
        'email'
      )
      .value = '';


    document
      .getElementById(
        'password'
      )
      .value = '';


    message.textContent =
      '';


    loginButton.disabled =
      false;


    loginButton.textContent =
      'Login';

  }
);


// ==================================================
// CEK SESSION SAAT HALAMAN DIBUKA
// ==================================================

async function checkSession() {

  const {
    data: { session }
  } =
    await supabaseClient
      .auth
      .getSession();


  if (session) {

    await loadDashboard();

  } else {

    showLogin();

  }

}


checkSession();


// ==================================================
// FORM INPUT SETORAN
// ==================================================

const setoranForm =
  document.getElementById(
    'setoranForm'
  );


if (setoranForm) {

  setoranForm.addEventListener(
    'submit',
    async function(event) {

      event.preventDefault();


      const button =
        document.getElementById(
          'submitSetoranButton'
        );


      const message =
        document.getElementById(
          'setoranMessage'
        );


      const tanggalSetor =
        document.getElementById(
          'tanggalSetor'
        ).value;


      const periodeBulan =
        document.getElementById(
          'periodeBulan'
        ).value;


      const periodeTahun =
        document.getElementById(
          'periodeTahun'
        ).value;


      const nominal =
        document.getElementById(
          'nominalSetoran'
        ).value;


      // VALIDASI

      if (
        !tanggalSetor ||
        !periodeBulan ||
        !periodeTahun ||
        !nominal
      ) {

        if (!fileExcel.files.length) {
          message.textContent =
            'Rincian muzaki dalam Excel wajib diupload.';
          message.style.color = '#d93025';
          return;
        }
        
        if (!excelValid) {
          message.textContent =
            'Total nominal Excel belum sesuai dengan Nominal Setoran.';
          message.style.color = '#d93025';
          return;
        }
        
        message.textContent =
          'Semua data wajib diisi.';

        message.style.color =
          '#d93025';

        return;

      }


      try {

        // LOADING

        button.disabled =
          true;

        button.textContent =
          'Menyimpan...';


        message.textContent =
          'Mengirim data setoran...';

        message.style.color =
          '#666';


        // NOMINAL
        // 500.000 -> 500000

        const nominalAngka =
          Number(
            nominal.replace(
              /\./g,
              ''
            )
          );


        // KIRIM KE BACKEND

        const result =
          await callBackend(
            'createSetoran',
            {
              tanggal_setor:
                tanggalSetor,

              periode_bulan:
                Number(
                  periodeBulan
                ),

              periode_tahun:
                Number(
                  periodeTahun
                ),

              nominal:
                nominalAngka
            }
          );


        // BERHASIL

        message.textContent =
          'Setoran berhasil disimpan.';

        message.style.color =
          '#259148';


        // RESET FORM

        setoranForm.reset();


        // RELOAD DASHBOARD

        await loadDashboard();


      } catch (error) {

        console.error(
          'CREATE SETORAN ERROR:',
          error
        );


        message.textContent =
          error.message ||
          'Gagal menyimpan setoran.';

        message.style.color =
          '#d93025';


      } finally {

        button.disabled =
          false;

        button.textContent =
          'Simpan Setoran';

      }

    }
  );

}


// ==================================================
// FORMAT NOMINAL SETORAN
// ==================================================

const nominalSetoran = document.getElementById('nominalSetoran');

if (nominalSetoran) {

  nominalSetoran.addEventListener('input', function() {

    let angka =
      this.value.replace(/\D/g, '');

    if (!angka) {

      this.value = '';

      if (totalNominalExcel > 0) {
        renderExcelSummary(
          totalNominalExcel,
          excelData.length - 1,
          0
        );
      }

      return;
    }

    this.value =
      Number(angka).toLocaleString('id-ID');

    if (totalNominalExcel > 0) {

      const calculation =
        calculateExcelTotal(
          excelData,
          validateExcelFormat(excelData)
        );

      renderExcelSummary(
        totalNominalExcel,
        calculation.jumlahData,
        calculation.nominalKosong
      );

    }

  });
}

// ==================================================
// PREVIEW EXCEL MUZAKI
// ==================================================
const fileExcel = document.getElementById('fileExcel');
const fileExcelInfo = document.getElementById('fileExcelInfo');
const excelPreview = document.getElementById('excelPreview');

let excelData = [];
let totalNominalExcel = 0;
let excelValid = false;


function parseNominalExcel(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  // Kalau Excel membaca angka sebagai number
  if (typeof value === 'number') {
    return value;
  }

  // Kalau Excel membaca sebagai text
  let text = String(value)
    .trim()
    .replace(/rp/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '');

  if (!text) {
    return 0;
  }

  const number = Number(text);

  return isNaN(number) ? 0 : number;
}


function formatRupiahSimple(value) {
  return Number(value || 0).toLocaleString('id-ID');
}


function validateExcelFormat(rows) {

  if (!rows.length) {
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


function calculateExcelTotal(rows, indexes) {

  let total = 0;
  let jumlahData = 0;
  let nominalKosong = 0;

  rows.slice(1).forEach(function(row) {

    const nama = row[indexes.namaIndex];

    // Abaikan baris kosong
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

    total += nominal;
  });

  return {
    total: total,
    jumlahData: jumlahData,
    nominalKosong: nominalKosong
  };
}


function renderExcelSummary(totalExcel, jumlahData, nominalKosong) {

  const nominalInput = document.getElementById('nominalSetoran');

  if (!nominalInput) return;

  const nominalSetoran = Number(
    nominalInput.value.replace(/\./g, '')
  ) || 0;

  const selisih = totalExcel - nominalSetoran;
  
  excelValid =
  nominalSetoran > 0 &&
  nominalKosong === 0 &&
  selisih === 0;

  let statusText = '';
  let statusColor = '#666';

  if (nominalSetoran === 0) {

    statusText =
      'Isi Nominal Setoran untuk membandingkan dengan Excel.';

  } else if (nominalKosong > 0) {

    statusText =
      `⚠️ Ada ${nominalKosong} data yang nominalnya kosong.`;

    statusColor = '#b54708';

  } else if (selisih === 0) {

    statusText =
      '✅ Nominal Excel sesuai dengan Nominal Setoran.';

    statusColor = '#18753a';

  } else {

    statusText =
      `⚠️ Terdapat selisih Rp ${formatRupiahSimple(Math.abs(selisih))}.`;

    statusColor = '#b54708';
  }

  let summary = document.getElementById('excelSummary');

  if (!summary) {

    summary = document.createElement('div');
    summary.id = 'excelSummary';

    excelPreview.parentNode.insertBefore(
      summary,
      excelPreview
    );
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
        <strong>Rp ${formatRupiahSimple(nominalSetoran)}</strong>
      </div>

      <div style="
        padding-top:8px;
        border-top:1px solid #e5e5e5;
        color:${statusColor};
        font-weight:600;
      ">
        ${statusText}
      </div>

    </div>
  `;
}


if (fileExcel) {

  fileExcel.addEventListener('change', async function() {

    const file = this.files[0];

    if (!file) {

      fileExcelInfo.textContent =
        'Belum ada file dipilih.';

      excelPreview.style.display = 'none';
      excelPreview.innerHTML = '';

      const summary =
        document.getElementById('excelSummary');

      if (summary) {
        summary.remove();
      }

      excelData = [];
      totalNominalExcel = 0;

      return;
    }

    fileExcelInfo.textContent =
      'Membaca file...';

    try {

      const arrayBuffer =
        await file.arrayBuffer();

      const workbook =
        XLSX.read(arrayBuffer, {
          type: 'array'
        });

      const sheetName =
        workbook.SheetNames[0];

      if (!sheetName) {
        throw new Error(
          'Sheet Excel tidak ditemukan.'
        );
      }

      const worksheet =
        workbook.Sheets[sheetName];

      const rows =
        XLSX.utils.sheet_to_json(
          worksheet,
          {
            header: 1,
            defval: ''
          }
        );

      const indexes =
        validateExcelFormat(rows);

      const calculation =
        calculateExcelTotal(
          rows,
          indexes
        );

      excelData = rows;

      totalNominalExcel =
        calculation.total;

      fileExcelInfo.textContent =
        `${file.name} • ${calculation.jumlahData} data`;

      renderExcelPreview(
        rows,
        indexes
      );

      renderExcelSummary(
        calculation.total,
        calculation.jumlahData,
        calculation.nominalKosong
      );

    } catch (error) {

      console.error(
        'EXCEL ERROR:',
        error
      );

      fileExcelInfo.textContent =
        'Gagal membaca file Excel.';

      excelPreview.style.display =
        'block';

      excelPreview.innerHTML = `
        <div style="
          padding:15px;
          color:#d93025;
        ">
          ${error.message}
        </div>
      `;

      const summary =
        document.getElementById('excelSummary');

      if (summary) {
        summary.remove();
      }

      excelData = [];
      totalNominalExcel = 0;
    }
  });
}


function renderExcelPreview(rows, indexes) {

  if (!rows.length) return;

  const header = rows[0];
  const data = rows.slice(1);

  let html = `
    <table>
      <thead>
        <tr>
  `;

  header.forEach(function(cell) {

    html += `
      <th>${cell || ''}</th>
    `;

  });

  html += `
        </tr>
      </thead>
      <tbody>
  `;

  const previewRows =
    data.slice(0, 20);

  previewRows.forEach(function(row) {

    html += '<tr>';

    header.forEach(function(_, index) {

      let value =
        row[index] !== undefined
          ? row[index]
          : '';

      // Format khusus kolom Nominal
      if (
        index === indexes.nominalIndex &&
        value !== ''
      ) {
        value =
          'Rp ' +
          formatRupiahSimple(
            parseNominalExcel(value)
          );
      }

      html += `
        <td>${value}</td>
      `;

    });

    html += '</tr>';

  });

  html += `
      </tbody>
    </table>
  `;

  if (data.length > 20) {

    html += `
      <div style="
        padding:12px;
        font-size:12px;
        color:#777;
      ">
        Menampilkan 20 dari ${data.length} data.
      </div>
    `;

  }

  excelPreview.innerHTML = html;

  excelPreview.style.display =
    'block';
}
