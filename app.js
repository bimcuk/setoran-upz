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

function renderRiwayat(
  setoran
) {

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


  container.innerHTML =
    setoran.map(
      item => `

        <div
          style="
            padding: 14px 0;
            border-bottom:
              1px solid #eee;
          "
        >

          <div>
            <strong>
              ${formatRupiah(
                item.nominal
              )}
            </strong>
          </div>

          <div
            style="
              margin-top: 4px;
              font-size: 13px;
              color: #777;
            "
          >
            ${item.tanggal_setor || '-'}
            ·
            ${item.status || '-'}
          </div>

        </div>

      `
    )
    .join('');

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
