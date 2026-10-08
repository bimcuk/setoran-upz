const SUPABASE_URL = 'https://efmgvgqyzdbhmejigqyg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qhbns7HHepypJ2s3TiF-MQ_i_-bpaow';

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
  } = await supabaseClient
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
    document.getElementById('riwayatContainer');


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
    setoran.map(item => {

      const tanggal = item.tanggal_setor
        ? new Date(
            item.tanggal_setor + 'T00:00:00'
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
          Number(item.periode_bulan)
        ] || '-';


      const periode =
        item.periode_tahun
          ? `${bulan} ${item.periode_tahun}`
          : '-';


      const status =
        item.status || '-';


      let statusClass = 'status-menunggu';


      if (status === 'diterima') {
        statusClass = 'status-diterima';
      }

      if (status === 'ditolak') {
        statusClass = 'status-ditolak';
      }

      if (status === 'sesuai') {
        statusClass = 'status-sesuai';
      }

      if (status === 'selisih') {
        statusClass = 'status-selisih';
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

    }).join('');

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

// =========================
// FORM INPUT SETORAN
// =========================

const setoranForm = document.getElementById('setoranForm');

if (setoranForm) {

  setoranForm.addEventListener('submit', async function (event) {

    event.preventDefault();

    const button = document.getElementById('submitSetoranButton');
    const message = document.getElementById('setoranMessage');

    const tanggalSetor =
      document.getElementById('tanggalSetor').value;

    const periodeBulan =
      document.getElementById('periodeBulan').value;

    const periodeTahun =
      document.getElementById('periodeTahun').value;

    const nominal =
      document.getElementById('nominalSetoran').value;


    // Validasi sederhana
    if (
      !tanggalSetor ||
      !periodeBulan ||
      !periodeTahun ||
      !nominal
    ) {

      message.textContent =
        'Semua data wajib diisi.';

      message.style.color = '#d93025';

      return;
    }


    try {

      // Loading
      button.disabled = true;
      button.textContent = 'Menyimpan...';

      message.textContent = 'Mengirim data setoran...';
      message.style.color = '#666';


      // Kirim ke backend
      const result = await callBackend(
        'createSetoran',
        {
          tanggal_setor: tanggalSetor,
          periode_bulan: Number(periodeBulan),
          periode_tahun: Number(periodeTahun),
          nominal: Number(nominal.replace(/\./g, '')
        }
      );


      // Berhasil
      message.textContent =
        'Setoran berhasil disimpan.';

      message.style.color = '#259148';


      // Reset form
      setoranForm.reset();


      // Reload dashboard
      await loadDashboard();


    } catch (error) {

      console.error(
        'CREATE SETORAN ERROR:',
        error
      );

      message.textContent =
        error.message || 'Gagal menyimpan setoran.';

      message.style.color = '#d93025';


    } finally {

      button.disabled = false;
      button.textContent = 'Simpan Setoran';

    }

  });

}

// =========================
// FORMAT NOMINAL SETORAN
// =========================

const nominalSetoran =
  document.getElementById('nominalSetoran');

if (nominalSetoran) {

  nominalSetoran.addEventListener(
    'input',
    function () {

      let angka =
        this.value.replace(/\D/g, '');

      if (!angka) {
        this.value = '';
        return;
      }

      this.value =
        Number(angka).toLocaleString('id-ID');

    }
  );

}

// =========================
// PREVIEW EXCEL MUZAKI
// =========================

const fileExcel =
  document.getElementById('fileExcel');

const fileExcelInfo =
  document.getElementById('fileExcelInfo');

const excelPreview =
  document.getElementById('excelPreview');


if (fileExcel) {

  fileExcel.addEventListener(
    'change',
    async function () {

      const file = this.files[0];

      if (!file) {

        fileExcelInfo.textContent =
          'Belum ada file dipilih.';

        excelPreview.style.display =
          'none';

        excelPreview.innerHTML =
          '';

        return;
      }


      fileExcelInfo.textContent =
        'Membaca file...';


      try {

        const arrayBuffer =
          await file.arrayBuffer();


        const workbook =
          XLSX.read(
            arrayBuffer,
            {
              type: 'array'
            }
          );


        const sheetName =
          workbook.SheetNames[0];


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


        if (!rows.length) {

          throw new Error(
            'File Excel kosong.'
          );

        }


        fileExcelInfo.textContent =
          `${file.name} • ${rows.length - 1} data`;


        renderExcelPreview(rows);


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
          <div
            style="
              padding: 15px;
              color: #d93025;
            "
          >
            ${error.message}
          </div>
        `;

      }

    }
  );

}


// =========================
// RENDER PREVIEW EXCEL
// =========================

function renderExcelPreview(rows) {

  if (!rows.length) {
    return;
  }


  const header =
    rows[0];


  const data =
    rows.slice(1);


  let html = `
    <table>
      <thead>
        <tr>
  `;


  header.forEach(
    function (cell) {

      html += `
        <th>
          ${cell || ''}
        </th>
      `;

    }
  );


  html += `
        </tr>
      </thead>
      <tbody>
  `;


  // Tampilkan maksimal 20 baris
  const previewRows =
    data.slice(0, 20);


  previewRows.forEach(
    function (row) {

      html += '<tr>';


      header.forEach(
        function (_, index) {

          html += `
            <td>
              ${row[index] || ''}
            </td>
          `;

        }
      );


      html += '</tr>';

    }
  );


  html += `
      </tbody>
    </table>
  `;


  if (data.length > 20) {

    html += `
      <div
        style="
          padding: 12px;
          font-size: 12px;
          color: #777;
        "
      >
        Menampilkan 20 dari
        ${data.length}
        data.
      </div>
    `;

  }


  excelPreview.innerHTML =
    html;


  excelPreview.style.display =
    'block';

}
