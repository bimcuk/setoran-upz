function doGet(e) {
  return jsonResponse({
    success: true,
    message: 'API Setoran UPZ BAZNAS Banyumas aktif',
    timestamp: new Date().toISOString()
  });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('Request tidak berisi data.');
    }

    const body = JSON.parse(e.postData.contents);

    if (!body.token) {
      throw new Error('Token tidak ditemukan.');
    }

    // VERIFIKASI USER SUPABASE
    const user = getSupabaseUser(body.token);

    // AMBIL PROFILE USER
    const profile = getMyProfile(body.token, user.id);

    // ACTION: TEST
    if (body.action === 'test') {
      return jsonResponse({
        success: true,
        message: 'User dan profile berhasil diverifikasi',
        user: {
          id: user.id,
          email: user.email
        },
        profile: {
          nama_lengkap: profile.nama_lengkap,
          role: profile.role,
          upz_id: profile.upz_id,
          status: profile.status
        }
      });
    }

    // ACTION: GET DASHBOARD UPZ
    if (body.action === 'getDashboard') {
      if (profile.status !== 'aktif') {
        throw new Error('Akun tidak aktif.');
      }

      if (profile.role !== 'upz') {
        throw new Error('Dashboard ini khusus untuk akun UPZ.');
      }

      if (!profile.upz_id) {
        throw new Error('Akun UPZ belum terhubung ke UPZ.');
      }

      const upzInfo = getUpzData(body.token, profile.upz_id);

      const setoran = getSetoranSummary(
        body.token,
        profile.upz_id
      );

      return jsonResponse({
        success: true,
        profile: {
          id: profile.id,
          nama_lengkap: profile.nama_lengkap,
          role: profile.role,
          upz_id: profile.upz_id,
          status: profile.status,
          nama_upz: upzInfo ? upzInfo.nama_upz : null,
          kode_upz: upzInfo ? upzInfo.kode_upz : null
        },
        setoran: setoran
      });
    }

    // ACTION: SIMPAN SETORAN + DETAIL DALAM SATU TRANSAKSI
    if (body.action === 'simpanSetoranLengkap') {
      if (profile.status !== 'aktif') {
        throw new Error('Akun tidak aktif.');
      }

      if (profile.role !== 'upz' || !profile.upz_id) {
        throw new Error(
          'Hanya akun UPZ aktif yang terhubung ke UPZ yang dapat membuat setoran.'
        );
      }

      const result = simpanSetoranLengkap(
        body.token,
        profile,
        body.payload || {}
      );

      return jsonResponse({
        success: true,
        message: 'Setoran dan rincian berhasil disimpan.',
        result: result
      });
    }


    // ACTION: AMBIL DAFTAR SETORAN UNTUK ADMIN
    if (body.action === 'getAdminSetoran') {
      if (profile.status !== 'aktif' || profile.role !== 'admin') {
        throw new Error(
          'Hanya akun admin aktif yang dapat melihat daftar verifikasi.'
        );
      }

      const setoran = getAdminSetoranSummary(body.token);

      return jsonResponse({
        success: true,
        message: 'Daftar setoran berhasil diambil.',
        setoran: setoran
      });
    }
    
    // ACTION: VERIFIKASI SETORAN OLEH ADMIN
    if (body.action === 'verifikasiSetoran') {
      if (profile.status !== 'aktif' || profile.role !== 'admin') {
        throw new Error(
          'Hanya akun admin aktif yang dapat memverifikasi setoran.'
        );
      }

      const payload = body.payload || {};

      const result = verifikasiSetoranAdmin(
        body.token,
        payload.setoran_id,
        payload.keputusan,
        payload.catatan
      );

      return jsonResponse({
        success: true,
        message: 'Verifikasi setoran berhasil diproses.',
        result: result
      });
    }

    // ACTION: UPDATE PASSWORD UPZ (ADMIN ONLY)
    if (body.action === 'updateUpzPassword') {
      if (profile.status !== 'aktif' || profile.role !== 'admin') {
        throw new Error('Hanya admin yang dapat mengubah password UPZ.');
      }

      const payload = body.payload || {};

      if (!payload.profile_id || !payload.new_password) {
        throw new Error('profile_id dan new_password wajib diisi.');
      }

      if (String(payload.new_password).length < 6) {
        throw new Error('Password minimal 6 karakter.');
      }

      const result = updateUserPassword(payload.profile_id, payload.new_password);

      return jsonResponse({
        success: true,
        message: 'Password berhasil diperbarui.',
        result: result
      });
    }

    // ACTION: TAMBAH UPZ BARU (ADMIN ONLY)
    if (body.action === 'createUpz') {
      if (profile.status !== 'aktif' || profile.role !== 'admin') {
        throw new Error('Hanya admin yang dapat menambahkan UPZ baru.');
      }

      const payload = body.payload || {};
      const result = createUpzUser(payload);

      return jsonResponse({
        success: true,
        message: 'UPZ baru berhasil ditambahkan.',
        result: result
      });
    }

    throw new Error(
      'Action tidak dikenali: ' + String(body.action || '(kosong)')
    );

  } catch (error) {
    return jsonResponse({
      success: false,
      message: error && error.message
        ? error.message
        : String(error)
    });
  }
}


// ========================================
// JSON RESPONSE
// ========================================

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}


// ========================================
// TEST KONEKSI SUPABASE
// ========================================

function testSupabase() {
  const url =
    CONFIG.SUPABASE_URL +
    '/rest/v1/upz?select=id,kode_upz,nama_upz,status';

  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      apikey: CONFIG.SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + CONFIG.SUPABASE_ANON_KEY
    },
    muteHttpExceptions: true
  });

  Logger.log('HTTP STATUS: ' + response.getResponseCode());
  Logger.log(response.getContentText());
}


// ========================================
// VERIFIKASI USER SUPABASE
// ========================================

function getSupabaseUser(token) {
  const url = CONFIG.SUPABASE_URL + '/auth/v1/user';

  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      apikey: CONFIG.SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + token
    },
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  const text = response.getContentText();

  if (status !== 200) {
    throw new Error(
      'Token tidak valid. Supabase HTTP ' +
      status + ': ' + text
    );
  }

  return JSON.parse(text);
}


// ========================================
// AMBIL PROFILE USER
// ========================================

function getMyProfile(token, userId) {
  const url =
    CONFIG.SUPABASE_URL +
    '/rest/v1/profiles' +
    '?select=id,nama_lengkap,role,upz_id,status' +
    '&id=eq.' +
    encodeURIComponent(userId);

  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      apikey: CONFIG.SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + token
    },
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  const text = response.getContentText();

  if (status !== 200) {
    throw new Error(
      'Gagal mengambil profile. Supabase HTTP ' +
      status + ': ' + text
    );
  }

  const profiles = JSON.parse(text);

  if (!Array.isArray(profiles) || profiles.length === 0) {
    throw new Error('Profile user tidak ditemukan.');
  }

  return profiles[0];
}


// ========================================
// AMBIL DATA SETORAN UNTUK DASHBOARD
// ========================================

function getSetoranSummary(token, upzId) {
  const url =
    CONFIG.SUPABASE_URL +
    '/rest/v1/setoran' +
    '?select=id,tanggal_setor,periode_bulan,periode_tahun,nominal,status,catatan,file_name,file_path,created_at' +
    '&upz_id=eq.' +
    encodeURIComponent(upzId) +
    '&order=created_at.desc';

  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      apikey: CONFIG.SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + token
    },
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  const text = response.getContentText();

  if (status !== 200) {
    throw new Error(
      'Gagal mengambil setoran. Supabase HTTP ' +
      status + ': ' + text
    );
  }

  return JSON.parse(text);
}


// ========================================
// AMBIL DATA DETAIL UPZ (NAMA & KODE)
// ========================================

function getUpzData(token, upzId) {
  if (!upzId) return null;

  const url =
    CONFIG.SUPABASE_URL +
    '/rest/v1/upz' +
    '?select=id,kode_upz,nama_upz,status' +
    '&id=eq.' +
    encodeURIComponent(upzId);

  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      apikey: CONFIG.SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + token
    },
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();

  if (status !== 200) {
    return null;
  }

  const list = JSON.parse(response.getContentText());
  return Array.isArray(list) && list.length > 0 ? list[0] : null;
}


// ========================================
// UPDATE PASSWORD USER (ADMIN API)
// Menggunakan service_role key untuk akses Admin Auth API
// ========================================

function updateUserPassword(userId, newPassword) {
  if (!userId || typeof userId !== 'string' || userId === 'undefined') {
    throw new Error(
      'userId wajib diisi dengan UUID user Supabase yang valid. ' +
      'Fungsi ini dipanggil otomatis dari web app, jangan dijalankan langsung via tombol Run di Apps Script tanpa parameter.'
    );
  }
  if (!newPassword) {
    throw new Error('newPassword wajib diisi.');
  }

  if (!CONFIG.SERVICE_ROLE_KEY || CONFIG.SERVICE_ROLE_KEY === 'ISI_SERVICE_ROLE_KEY_DISINI') {
    throw new Error(
      'SERVICE_ROLE_KEY belum dikonfigurasi di config.gs. ' +
      'Isi dengan service_role key dari Supabase Dashboard → Project Settings → API.'
    );
  }

  const url = CONFIG.SUPABASE_URL + '/auth/v1/admin/users/' + encodeURIComponent(userId);

  const response = UrlFetchApp.fetch(url, {
    method: 'PUT',
    headers: {
      'apikey': CONFIG.SERVICE_ROLE_KEY,
      'Authorization': 'Bearer ' + CONFIG.SERVICE_ROLE_KEY,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({ password: newPassword }),
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  const text = (response.getContentText() || '').trim();

  Logger.log('UPDATE PASSWORD STATUS: HTTP ' + status + ' -> ' + text);

  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      Logger.log('Response bukan JSON valid: ' + text);
    }
  }

  if (status < 200 || status >= 300) {
    const errorMsg = (data && (data.message || data.error_description || data.msg)) || text || ('HTTP ' + status);
    throw new Error('Gagal mengubah password (Supabase HTTP ' + status + '): ' + errorMsg);
  }

  Logger.log('PASSWORD UPDATED untuk user: ' + userId);
  return data || { success: true };
}


// ========================================
// TAMBAH UPZ BARU (ADMIN API)
// 1. Buat user auth di Supabase
// 2. Insert ke tabel upz
// 3. Insert ke tabel profiles
// ========================================

function createUpzUser(data) {
  if (!CONFIG.SERVICE_ROLE_KEY || CONFIG.SERVICE_ROLE_KEY === 'ISI_SERVICE_ROLE_KEY_DISINI') {
    throw new Error('SERVICE_ROLE_KEY belum dikonfigurasi di config.gs.');
  }

  const email = (data.email || '').trim();
  const password = data.password || '';
  const nama = (data.nama || '').trim();
  const namaUpz = (data.nama_upz || '').trim();
  const kategori = (data.kategori || '').trim();

  if (!email || !password || !nama || !namaUpz || !kategori) {
    throw new Error('Email, password, nama, nama UPZ, dan kategori wajib diisi.');
  }

  if (password.length < 6) {
    throw new Error('Password minimal 6 karakter.');
  }

  // 1. Buat Auth User
  const authUrl = CONFIG.SUPABASE_URL + '/auth/v1/admin/users';
  const authRes = UrlFetchApp.fetch(authUrl, {
    method: 'POST',
    headers: {
      'apikey': CONFIG.SERVICE_ROLE_KEY,
      'Authorization': 'Bearer ' + CONFIG.SERVICE_ROLE_KEY,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { nama_lengkap: nama }
    }),
    muteHttpExceptions: true
  });

  const authStatus = authRes.getResponseCode();
  const authText = (authRes.getContentText() || '').trim();
  let authData = null;
  try { authData = JSON.parse(authText); } catch (_) {}

  if (authStatus < 200 || authStatus >= 300) {
    const msg = (authData && (authData.message || authData.msg || authData.error_description)) || authText || ('HTTP ' + authStatus);
    throw new Error('Gagal membuat user auth di Supabase: ' + msg);
  }

  const newUserId = authData.id;

  // 2. Insert ke tabel upz
  const upzUrl = CONFIG.SUPABASE_URL + '/rest/v1/upz';
  const upzRes = UrlFetchApp.fetch(upzUrl, {
    method: 'POST',
    headers: {
      'apikey': CONFIG.SERVICE_ROLE_KEY,
      'Authorization': 'Bearer ' + CONFIG.SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    payload: JSON.stringify({
      nama_upz: namaUpz,
      kategori: kategori
    }),
    muteHttpExceptions: true
  });

  const upzText = (upzRes.getContentText() || '').trim();
  let upzList = [];
  try { upzList = JSON.parse(upzText); } catch (_) {}
  const newUpzId = (Array.isArray(upzList) && upzList.length > 0) ? upzList[0].id : null;

  // 3. Insert ke tabel profiles
  const profUrl = CONFIG.SUPABASE_URL + '/rest/v1/profiles';
  UrlFetchApp.fetch(profUrl, {
    method: 'POST',
    headers: {
      'apikey': CONFIG.SERVICE_ROLE_KEY,
      'Authorization': 'Bearer ' + CONFIG.SERVICE_ROLE_KEY,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({
      id: newUserId,
      nama_lengkap: nama,
      role: 'upz',
      status: 'aktif',
      upz_id: newUpzId,
      email: email
    }),
    muteHttpExceptions: true
  });

  Logger.log('UPZ BARU BERHASIL DIBUAT: user=' + newUserId + ', upz=' + newUpzId);
  return { userId: newUserId, upzId: newUpzId };
}
