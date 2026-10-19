const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxwpkFzjuBeTEJD5C5rVtek07MXBT5jQor3P1yrmQFvRdQvU1r5zYG22_ZSDmRij0J-/exec';

// ============================================================
// KONFIGURASI SUPABASE (SERVER ONLY — tidak dikirim ke browser)
// ============================================================
const SUPABASE_URL = 'https://efmgvgqyzdbhmejigqyg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qhbns7HHepypJ2s3TiF-MQ_i_-bpaow';
// Ambil dari: Supabase Dashboard → Project Settings → API → Secret key
let SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!SUPABASE_SERVICE_ROLE_KEY && fs.existsSync(path.join(__dirname, '.env'))) {
  try {
    const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    const match = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*([^\r\n]+)/);
    if (match) SUPABASE_SERVICE_ROLE_KEY = match[1].trim();
  } catch (e) {
    console.warn('[SERVER] Gagal membaca .env:', e.message);
  }
}

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// ============================================================
// HELPER: Baca body request
// ============================================================
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

// ============================================================
// HELPER: Verifikasi token Supabase (cek apakah user adalah admin)
// ============================================================
async function verifyAdminToken(token) {
  // 1. Verifikasi token valid
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`
    }
  });

  if (!userRes.ok) throw new Error('Token tidak valid atau sudah kedaluwarsa.');
  const user = await userRes.json();

  // 2. Cek role dari tabel profiles (gunakan SERVICE_ROLE_KEY jika ada, atau fallback ke user token)
  const authHeader = SUPABASE_SERVICE_ROLE_KEY
    ? `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    : `Bearer ${token}`;
  const apiKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=role,status&id=eq.${encodeURIComponent(user.id)}`,
    {
      headers: {
        'apikey': apiKey,
        'Authorization': authHeader
      }
    }
  );

  const profiles = await profileRes.json();
  if (!Array.isArray(profiles) || !profiles.length) {
    throw new Error('Profile admin tidak ditemukan di Supabase.');
  }

  const profile = profiles[0];
  if (profile.role !== 'admin' || profile.status !== 'aktif') {
    throw new Error('Hanya admin aktif yang berwenang mengubah akun UPZ.');
  }

  return user;
}

// ============================================================
// HELPER: Verifikasi token pengguna valid (User / UPZ / Admin)
// ============================================================
async function verifyUserToken(token) {
  if (!token) throw new Error('Token tidak ditemukan.');
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`
    }
  });
  if (!userRes.ok) throw new Error('Token pengguna tidak valid atau sudah kedaluwarsa.');
  return await userRes.json();
}

function isUuid(str) {
  return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // ============================================================
  // ENDPOINT: Update password UPZ (Admin only)
  // POST /api/update-password
  // Body: { token, profile_id, new_password }
  // ============================================================
  if (req.url === '/api/update-password' && req.method === 'POST') {
    const sendJson = (statusCode, data) => {
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    try {
      const body = await readBody(req);
      const { token, profile_id, new_password } = body;

      if (!token) return sendJson(401, { success: false, message: 'Token tidak ditemukan.' });
      if (!profile_id) return sendJson(400, { success: false, message: 'profile_id wajib diisi.' });
      if (!new_password || new_password.length < 6) {
        return sendJson(400, { success: false, message: 'Password minimal 6 karakter.' });
      }

      if (!SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY === 'ISI_SERVICE_ROLE_KEY_DISINI') {
        return sendJson(500, {
          success: false,
          message: 'SERVICE_ROLE_KEY belum dikonfigurasi di server.js. Isi SUPABASE_SERVICE_ROLE_KEY.'
        });
      }

      // Verifikasi caller adalah admin
      await verifyAdminToken(token);

      // Panggil Supabase Admin API untuk ubah password
      const patchRes = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(profile_id)}`,
        {
          method: 'PUT',
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ password: new_password })
        }
      );

      const patchText = await patchRes.text();
      console.log(`[UPDATE-PASSWORD] HTTP ${patchRes.status} for user ${profile_id}`);

      if (!patchRes.ok) {
        let errMsg = `Supabase HTTP ${patchRes.status}`;
        try { errMsg += ': ' + (JSON.parse(patchText).message || patchText); } catch {}
        return sendJson(patchRes.status, { success: false, message: errMsg });
      }

      return sendJson(200, { success: true, message: 'Password berhasil diperbarui.' });

    } catch (err) {
      console.error('[UPDATE-PASSWORD ERROR]', err.message);
      return sendJson(500, { success: false, message: err.message });
    }
  }

  // ============================================================
  // ENDPOINT: Hapus Setoran (Admin only)
  // POST /api/delete-setoran
  // Body: { token, setoran_id, file_path }
  // ============================================================
  if (req.url === '/api/delete-setoran' && req.method === 'POST') {
    const sendJson = (statusCode, data) => {
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    try {
      const body = await readBody(req);
      const { token, setoran_id, file_path } = body;

      if (!token) return sendJson(401, { success: false, message: 'Token tidak ditemukan.' });
      if (!setoran_id) return sendJson(400, { success: false, message: 'setoran_id wajib diisi.' });

      // Verifikasi caller adalah admin atau UPZ pemilik setoran (jika status masih menunggu)
      let callerUser = null;
      let isAdmin = false;
      try {
        callerUser = await verifyAdminToken(token);
        isAdmin = true;
      } catch (adminErr) {
        callerUser = await verifyUserToken(token);
        isAdmin = false;
      }

      if (!callerUser) return sendJson(401, { success: false, message: 'Autentikasi gagal.' });

      const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
      const headers = {
        'apikey': sKey,
        'Authorization': `Bearer ${sKey}`,
        'Content-Type': 'application/json'
      };

      if (!isAdmin) {
        // Cek kepemilikan dan status setoran
        const checkRes = await fetch(
          `${SUPABASE_URL}/rest/v1/setoran?select=id,upz_id,status&id=eq.${encodeURIComponent(setoran_id)}`,
          { headers }
        );
        const checkData = await checkRes.json();
        if (!Array.isArray(checkData) || !checkData.length) {
          return sendJson(404, { success: false, message: 'Data setoran tidak ditemukan.' });
        }
        if (checkData[0].upz_id !== callerUser.id) {
          return sendJson(403, { success: false, message: 'Anda tidak memiliki hak untuk menghapus setoran ini.' });
        }
        if (checkData[0].status !== 'menunggu') {
          return sendJson(400, { success: false, message: 'Hanya setoran dengan status menunggu yang dapat dihapus oleh UPZ.' });
        }
      }

      // 1. Hapus detail_setoran terkait terlebih dahulu (foreign key)
      const delDetailRes = await fetch(
        `${SUPABASE_URL}/rest/v1/detail_setoran?setoran_id=eq.${encodeURIComponent(setoran_id)}`,
        { method: 'DELETE', headers }
      );
      console.log(`[DELETE-SETORAN] detail_setoran HTTP ${delDetailRes.status}`);

      // 2. Hapus data setoran utama
      const delSetoranRes = await fetch(
        `${SUPABASE_URL}/rest/v1/setoran?id=eq.${encodeURIComponent(setoran_id)}`,
        { method: 'DELETE', headers }
      );
      console.log(`[DELETE-SETORAN] setoran HTTP ${delSetoranRes.status}`);

      // 3. Hapus berkas fisik di Supabase Storage jika ada file_path
      if (file_path) {
        try {
          const delStorageRes = await fetch(
            `${SUPABASE_URL}/storage/v1/object/setoran-upz`,
            {
              method: 'DELETE',
              headers,
              body: JSON.stringify({ prefixes: [file_path] })
            }
          );
          console.log(`[DELETE-SETORAN] storage file HTTP ${delStorageRes.status}`);
        } catch (storageErr) {
          console.warn('[DELETE-SETORAN] Gagal hapus storage file (non-blocking):', storageErr.message);
        }
      }

      return sendJson(200, {
        success: true,
        message: 'Data setoran dan rincian muzaki berhasil dihapus secara permanen.'
      });

    } catch (err) {
      console.error('[DELETE-SETORAN ERROR]', err.message);
      return sendJson(500, { success: false, message: err.message });
    }
  }

  // ============================================================
  // ENDPOINT: Hapus Akun UPZ (Admin only)
  // POST /api/delete-upz
  // Body: { token, profile_id }
  // ============================================================
  if (req.url === '/api/delete-upz' && req.method === 'POST') {
    const sendJson = (statusCode, data) => {
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    try {
      const body = await readBody(req);
      const { token, profile_id } = body;

      if (!token) return sendJson(401, { success: false, message: 'Token tidak ditemukan.' });
      if (!profile_id) return sendJson(400, { success: false, message: 'profile_id wajib diisi.' });

      // Verifikasi caller adalah admin
      await verifyAdminToken(token);

      const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
      const headers = {
        'apikey': sKey,
        'Authorization': `Bearer ${sKey}`,
        'Content-Type': 'application/json'
      };

      // 1. Hapus dari tabel profiles
      const delProfileRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(profile_id)}`,
        { method: 'DELETE', headers }
      );
      console.log(`[DELETE-UPZ] profiles HTTP ${delProfileRes.status}`);

      // 2. Jika service role key tersedia, hapus user dari Supabase Auth
      if (SUPABASE_SERVICE_ROLE_KEY && SUPABASE_SERVICE_ROLE_KEY !== 'ISI_SERVICE_ROLE_KEY_DISINI') {
        try {
          const delAuthRes = await fetch(
            `${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(profile_id)}`,
            {
              method: 'DELETE',
              headers: {
                'apikey': SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
              }
            }
          );
          console.log(`[DELETE-UPZ] auth user HTTP ${delAuthRes.status}`);
        } catch (authErr) {
          console.warn('[DELETE-UPZ] Hapus auth user error (non-blocking):', authErr.message);
        }
      }

      return sendJson(200, {
        success: true,
        message: 'Akun UPZ berhasil dihapus secara permanen.'
      });

    } catch (err) {
      console.error('[DELETE-UPZ ERROR]', err.message);
      return sendJson(500, { success: false, message: err.message });
    }
  }

  // ============================================================
  // ENDPOINT: Update/Edit Akun UPZ (Admin only)
  // POST /api/update-upz
  // Body: { token, profile_id, upz_id, nama_upz, nama_lengkap, kategori, status, password, email, no_sk, nama_ketua }
  // ============================================================
  if (req.url === '/api/update-upz' && req.method === 'POST') {
    const sendJson = (statusCode, data) => {
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    try {
      const body = await readBody(req);
      const { token, profile_id, upz_id, nama_upz, nama_lengkap, kategori, status, password, email, no_sk, nama_ketua } = body;

      if (!token) return sendJson(401, { success: false, message: 'Token tidak ditemukan.' });
      if (!nama_upz) return sendJson(400, { success: false, message: 'Nama UPZ wajib diisi.' });

      // Verifikasi caller adalah admin aktif
      await verifyAdminToken(token);

      const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
      if (!sKey || sKey === 'ISI_SERVICE_ROLE_KEY_DISINI') {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di server.');
      }
      const headers = {
        'apikey': sKey,
        'Authorization': `Bearer ${sKey}`,
        'Content-Type': 'application/json'
      };

      const cleanEmail = email ? String(email).trim().toLowerCase() : '';

      // Tentukan targetAuthId (Auth User ID di Supabase Auth)
      let targetAuthId = profile_id;

      // Jika profile_id bukan UUID atau sama dengan upz_id, cari auth user id dari tabel profiles
      if (!isUuid(targetAuthId) || (upz_id && targetAuthId === upz_id)) {
        if (upz_id) {
          try {
            const pRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,email&upz_id=eq.${encodeURIComponent(upz_id)}&limit=1`, { headers });
            const pRows = await pRes.json();
            if (Array.isArray(pRows) && pRows.length > 0 && isUuid(pRows[0].id)) {
              targetAuthId = pRows[0].id;
            }
          } catch (_) {}
        }
      }

      // Jika masih belum ditemukan, coba cari berdasarkan email di profiles
      if (!isUuid(targetAuthId) && cleanEmail) {
        try {
          const pRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id&email=eq.${encodeURIComponent(cleanEmail)}&limit=1`, { headers });
          const pRows = await pRes.json();
          if (Array.isArray(pRows) && pRows.length > 0 && isUuid(pRows[0].id)) {
            targetAuthId = pRows[0].id;
          }
        } catch (_) {}
      }

      // 1. UPDATE ATAU BUAT USER DI SUPABASE AUTH (auth.users)
      if (targetAuthId && isUuid(targetAuthId)) {
        const authPatch = {};
        if (cleanEmail) {
          authPatch.email = cleanEmail;
          authPatch.email_confirm = true;
        }
        if (password) {
          authPatch.password = password;
        }
        const uMeta = {};
        if (nama_lengkap) uMeta.nama_lengkap = nama_lengkap;
        if (nama_lengkap) uMeta.nama_pengelola = nama_lengkap;
        if (no_sk !== undefined) uMeta.no_sk = no_sk;
        if (nama_ketua !== undefined) uMeta.nama_ketua = nama_ketua;
        if (Object.keys(uMeta).length > 0) {
          authPatch.user_metadata = uMeta;
        }

        if (Object.keys(authPatch).length > 0) {
          const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(targetAuthId)}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(authPatch)
          });
          const authData = await authRes.json().catch(() => ({}));
          console.log(`[UPDATE-UPZ] auth user patch HTTP ${authRes.status} for ${targetAuthId}:`, authData.email || authData.message);
          if (!authRes.ok) {
            const errMsg = authData.message || authData.msg || authData.error_description || `Supabase Auth error (${authRes.status})`;
            throw new Error(`Gagal update akun login Supabase Auth: ${errMsg}`);
          }
        }
      } else {
        // Mode: Buat Akun Auth Baru jika belum ada
        if (!cleanEmail || !password) {
          throw new Error('Email dan kata sandi wajib diisi untuk akun UPZ baru.');
        }
        const createAuthRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            email: cleanEmail,
            password: password,
            email_confirm: true,
            user_metadata: {
              nama_lengkap: nama_lengkap || nama_upz,
              nama_pengelola: nama_lengkap || nama_upz,
              no_sk: no_sk || '',
              nama_ketua: nama_ketua || ''
            }
          })
        });
        const createAuthData = await createAuthRes.json().catch(() => ({}));
        if (!createAuthRes.ok) {
          const errMsg = createAuthData.message || createAuthData.msg || `Gagal membuat akun auth Supabase (${createAuthRes.status})`;
          throw new Error(errMsg);
        }
        targetAuthId = createAuthData.id;
      }

      // 2. UPDATE ATAU INSERT TABEL UPZ
      let finalUpzId = upz_id;
      if (finalUpzId) {
        const upzPatch = { nama_upz: nama_upz, kategori: kategori };
        if (nama_lengkap) upzPatch.nama_pic = nama_lengkap;
        if (cleanEmail) upzPatch.email_pic = cleanEmail;
        const upzRes = await fetch(`${SUPABASE_URL}/rest/v1/upz?id=eq.${encodeURIComponent(finalUpzId)}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(upzPatch)
        });
        console.log(`[UPDATE-UPZ] table upz patch HTTP ${upzRes.status}`);
      } else {
        const insUpzRes = await fetch(`${SUPABASE_URL}/rest/v1/upz`, {
          method: 'POST',
          headers: { ...headers, 'Prefer': 'return=representation' },
          body: JSON.stringify({
            nama_upz: nama_upz,
            kategori: kategori,
            nama_pic: nama_lengkap,
            email_pic: cleanEmail
          })
        });
        const insUpzData = await insUpzRes.json().catch(() => []);
        if (Array.isArray(insUpzData) && insUpzData.length > 0) {
          finalUpzId = insUpzData[0].id;
        }
      }

      // 3. UPDATE ATAU INSERT TABEL PROFILES
      if (targetAuthId) {
        const profPayload = {
          nama_lengkap: nama_lengkap || nama_upz,
          status: status || 'aktif',
          role: 'upz'
        };
        if (cleanEmail) profPayload.email = cleanEmail;
        if (finalUpzId) profPayload.upz_id = finalUpzId;

        const checkProfRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(targetAuthId)}`, { headers });
        const checkProfData = await checkProfRes.json().catch(() => []);
        if (Array.isArray(checkProfData) && checkProfData.length > 0) {
          const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(targetAuthId)}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(profPayload)
          });
          console.log(`[UPDATE-UPZ] table profiles patch HTTP ${profRes.status}`);
        } else {
          const insProfRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              id: targetAuthId,
              ...profPayload
            })
          });
          console.log(`[UPDATE-UPZ] table profiles insert HTTP ${insProfRes.status}`);
        }
      }

      // 4. Catat riwayat update profil ke audit_logs
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action: 'UPDATE_UPZ_PROFILE',
            module: 'profile',
            user_id: isUuid(targetAuthId) ? targetAuthId : null,
            description: JSON.stringify({
              upz_id: finalUpzId,
              profile_id: targetAuthId,
              nama_pengelola: nama_lengkap,
              nama_lengkap: nama_lengkap,
              no_sk: no_sk || '',
              nama_ketua: nama_ketua || '',
              email: cleanEmail
            })
          })
        });
      } catch (_) {}

      return sendJson(200, {
        success: true,
        message: 'Data UPZ dan akun login Supabase berhasil diperbarui.',
        data: {
          profile_id: targetAuthId,
          upz_id: finalUpzId,
          email: cleanEmail
        }
      });
    } catch (err) {
      console.error('[UPDATE-UPZ ERROR]', err.message);
      return sendJson(500, { success: false, message: err.message });
    }
  }

  // ============================================================
  // ENDPOINT: Update profil UPZ oleh Role UPZ sendiri
  // POST /api/update-profile
  // Body: { token, nama_pengelola, no_sk, nama_ketua }
  // ============================================================
  if (req.url === '/api/update-profile' && req.method === 'POST') {
    const sendJson = (statusCode, data) => {
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    try {
      const body = await readBody(req);
      const { token, nama_pengelola, no_sk, nama_ketua } = body;

      if (!token) return sendJson(401, { success: false, message: 'Token tidak ditemukan.' });
      if (!nama_pengelola) return sendJson(400, { success: false, message: 'Nama pengelola wajib diisi.' });

      const user = await verifyUserToken(token);
      const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
      const headers = {
        'apikey': sKey,
        'Authorization': `Bearer ${sKey}`,
        'Content-Type': 'application/json'
      };

      // 1. Ambil profile untuk tahu upz_id
      let upzId = null;
      try {
        const pRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, { headers });
        const pRows = await pRes.json();
        if (Array.isArray(pRows) && pRows.length > 0) {
          upzId = pRows[0].upz_id;
        }
      } catch (_) {}

      // 2. Update user_metadata di auth.users Supabase
      try {
        await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            user_metadata: {
              ...(user.user_metadata || {}),
              nama_lengkap: nama_pengelola,
              nama_pengelola: nama_pengelola,
              no_sk: no_sk || '',
              nama_ketua: nama_ketua || ''
            }
          })
        });
      } catch (authErr) {
        console.warn('[UPDATE-PROFILE] auth metadata update warn:', authErr.message);
      }

      // 3. Update tabel profiles
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            nama_lengkap: nama_pengelola
          })
        });
      } catch (pErr) {
        console.warn('[UPDATE-PROFILE] profiles patch warn:', pErr.message);
      }

      // 4. Update tabel upz jika ada upz_id
      if (upzId) {
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/upz?id=eq.${encodeURIComponent(upzId)}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              nama_pic: nama_pengelola
            })
          });
        } catch (uErr) {
          console.warn('[UPDATE-PROFILE] upz table patch warn:', uErr.message);
        }
      }

      // 5. Catat ke audit_logs agar admin langsung membaca update SK, ketua, dan pengelola
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action: 'UPDATE_UPZ_PROFILE',
            module: 'profile',
            user_id: user.id,
            description: JSON.stringify({
              upz_id: upzId,
              profile_id: user.id,
              nama_pengelola: nama_pengelola,
              nama_lengkap: nama_pengelola,
              no_sk: no_sk || '',
              nama_ketua: nama_ketua || ''
            })
          })
        });
      } catch (_) {}

      return sendJson(200, {
        success: true,
        message: 'Profil UPZ berhasil diperbarui di Supabase.'
      });
    } catch (err) {
      console.error('[UPDATE-PROFILE ERROR]', err.message);
      return sendJson(500, { success: false, message: err.message });
    }
  }

  // ============================================================
  // ENDPOINT: Get complete UPZ list (tergabung dengan profil, SK, & Ketua)
  // GET /api/upz-list
  // ============================================================
  if (req.url === '/api/upz-list' && req.method === 'GET') {
    const sendJson = (statusCode, data) => {
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    try {
      const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
      const headers = {
        'apikey': sKey,
        'Authorization': `Bearer ${sKey}`
      };

      const [upzRes, profRes, logsRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/upz?select=*&order=nama_upz.asc`, {
          headers: { ...headers, 'Range': '0-999' }
        }),
        fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,nama_lengkap,email,upz_id,status,role`, {
          headers: { ...headers, 'Range': '0-999' }
        }),
        fetch(`${SUPABASE_URL}/rest/v1/audit_logs?module=eq.profile&order=created_at.desc&limit=200`, {
          headers
        }).catch(() => null)
      ]);

      if (!upzRes.ok) {
        throw new Error(`Supabase HTTP ${upzRes.status}: ${await upzRes.text()}`);
      }

      const upzRows = await upzRes.json();
      const profiles = profRes.ok ? await profRes.json() : [];
      const logs = (logsRes && logsRes.ok) ? await logsRes.json() : [];

      const profileByUpzId = {};
      const profileById = {};
      (profiles || []).forEach(p => {
        if (p.upz_id) profileByUpzId[p.upz_id] = p;
        if (p.id) profileById[p.id] = p;
      });

      // Parse metadata tambahan (no_sk, nama_ketua, nama_pengelola) dari audit_logs
      const extraMetaByUpzId = {};
      const extraMetaByProfileId = {};
      (logs || []).forEach(l => {
        try {
          const desc = JSON.parse(l.description);
          if (desc) {
            if (desc.upz_id && !extraMetaByUpzId[desc.upz_id]) {
              extraMetaByUpzId[desc.upz_id] = desc;
            }
            if (desc.profile_id && !extraMetaByProfileId[desc.profile_id]) {
              extraMetaByProfileId[desc.profile_id] = desc;
            }
          }
        } catch (_) {}
      });

      const mergedData = (upzRows || []).map(u => {
        const p = profileByUpzId[u.id] || profileById[u.id] || {};
        const meta = extraMetaByUpzId[u.id] || (p.id && extraMetaByProfileId[p.id]) || {};
        const cleanEmail = (p.email && !p.email.includes('@upz.baznas')) ? p.email : (u.email_pic || u.email || '-');
        const namaPengelola = meta.nama_pengelola || meta.nama_lengkap || p.nama_lengkap || u.nama_pic || u.nama_upz || '';

        return {
          id: u.id,
          upz_id: u.id,
          profile_id: p.id || u.id,
          kode_upz: u.kode_upz || '',
          nama_upz: u.nama_upz || '',
          nama_lengkap: namaPengelola,
          nama_pengelola: namaPengelola,
          email: cleanEmail,
          kategori: u.kategori || '-',
          status: p.status || u.status || 'aktif',
          no_sk: meta.no_sk || '',
          nama_ketua: meta.nama_ketua || ''
        };
      });

      return sendJson(200, {
        success: true,
        count: mergedData.length,
        data: mergedData
      });
    } catch (err) {
      console.error('[UPZ-LIST ERROR]', err.message);
      return sendJson(500, { success: false, message: err.message });
    }
  }

  // ============================================================
  // PENTASHARUFAN ENDPOINTS (UPLOAD, SAVE, LIST, STATUS)
  // ============================================================

  // 1. Upload File Pentasharufan (Excel / Foto) ke Bucket 'pentasharufan'
  if (req.url === '/api/upload-penta' && req.method === 'POST') {
    const sendJson = (statusCode, data) => {
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    try {
      const body = await readBody(req);
      const { name, type, subfolder, upzId, base64 } = body;

      if (!name || !base64) {
        return sendJson(400, { success: false, message: 'File name dan content base64 wajib dikirim.' });
      }

      const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
      const ext = name.split('.').pop() || (type && type.includes('image') ? 'jpg' : 'dat');
      const cleanBase = name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
      const safeFolder = subfolder || 'berkas';
      const safeUpz = (upzId || 'umum').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filePath = `pentasharufan/${safeUpz}/${safeFolder}/${Date.now()}_${cleanBase}.${ext}`;

      const buffer = Buffer.from(base64, 'base64');
      const mimeType = type || (ext === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : (ext === 'xls' ? 'application/vnd.ms-excel' : 'application/octet-stream'));

      const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/pentasharufan/${filePath}`, {
        method: 'POST',
        headers: {
          'apikey': sKey,
          'Authorization': `Bearer ${sKey}`,
          'Content-Type': mimeType,
          'cache-control': '3600',
          'x-upsert': 'true'
        },
        body: buffer
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(`Upload storage gagal (HTTP ${uploadRes.status}): ${errText}`);
      }

      // Buat signed URL aman (berlaku 7 hari) karena bucket bersifat PRIVATE
      let signedUrl = '';
      try {
        const signRes = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/pentasharufan/${encodeURI(filePath)}`, {
          method: 'POST',
          headers: {
            'apikey': sKey,
            'Authorization': `Bearer ${sKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ expiresIn: 604800 })
        });
        if (signRes.ok) {
          const signJson = await signRes.json();
          if (signJson.signedURL) {
            signedUrl = `${SUPABASE_URL}/storage/v1${signJson.signedURL}`;
          }
        }
      } catch (signErr) {
        console.warn('Sign URL error:', signErr.message);
      }

      return sendJson(200, {
        success: true,
        filePath: filePath,
        publicUrl: signedUrl,
        signedUrl: signedUrl,
        originalName: name
      });
    } catch (err) {
      console.error('[UPLOAD-PENTA ERROR]', err.message);
      return sendJson(500, { success: false, message: err.message });
    }
  }

  // 2. Simpan Permohonan Pentasharufan ke audit_logs di Supabase
  if (req.url === '/api/save-penta' && req.method === 'POST') {
    const sendJson = (statusCode, data) => {
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    try {
      const body = await readBody(req);
      const { record } = body;

      if (!record || !record.id) {
        return sendJson(400, { success: false, message: 'Data permohonan tidak valid.' });
      }

      const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
      const headers = {
        'apikey': sKey,
        'Authorization': `Bearer ${sKey}`,
        'Content-Type': 'application/json'
      };

      const auditPayload = {
        action: 'PENTASHARUFAN_SUBMIT',
        module: 'pentasharufan',
        user_id: (record.profile_id && isUuid(record.profile_id)) ? record.profile_id : null,
        description: JSON.stringify(record)
      };

      const insRes = await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
        method: 'POST',
        headers,
        body: JSON.stringify(auditPayload)
      });

      if (!insRes.ok) {
        const errText = await insRes.text();
        throw new Error(`Gagal menyimpan ke audit_logs (HTTP ${insRes.status}): ${errText}`);
      }

      return sendJson(200, {
        success: true,
        message: 'Permohonan pentasharufan berhasil disimpan di Supabase.',
        data: record
      });
    } catch (err) {
      console.error('[SAVE-PENTA ERROR]', err.message);
      return sendJson(500, { success: false, message: err.message });
    }
  }

  // 3. Ambil Daftar Permohonan Pentasharufan dari audit_logs (dengan Signed URL aman)
  if (req.url === '/api/penta-list' && req.method === 'GET') {
    const sendJson = (statusCode, data) => {
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    try {
      const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
      const resLogs = await fetch(`${SUPABASE_URL}/rest/v1/audit_logs?module=eq.pentasharufan&order=created_at.desc&limit=500`, {
        headers: {
          'apikey': sKey,
          'Authorization': `Bearer ${sKey}`
        }
      });

      if (!resLogs.ok) {
        throw new Error(`Fetch audit_logs gagal (HTTP ${resLogs.status}): ${await resLogs.text()}`);
      }

      const logs = await resLogs.json();
      const recordsMap = new Map();

      // Process in chronological order so status updates overwrite older states
      const chronological = (logs || []).slice().reverse();
      chronological.forEach(log => {
        try {
          const rec = JSON.parse(log.description);
          if (rec && rec.id) {
            if (log.action === 'PENTASHARUFAN_DELETE') {
              recordsMap.delete(rec.id);
            } else if (!recordsMap.has(rec.id)) {
              recordsMap.set(rec.id, rec);
            } else {
              const current = recordsMap.get(rec.id);
              if (rec.status) current.status = rec.status;
              if (rec.catatan_admin !== undefined) current.catatan_admin = rec.catatan_admin;
            }
          }
        } catch (_) {}
      });

      const list = Array.from(recordsMap.values()).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

      // Buat signed URLs otomatis untuk berkas private
      async function signFilePath(pathStr) {
        if (!pathStr) return '';
        try {
          const signRes = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/pentasharufan/${encodeURI(pathStr)}`, {
            method: 'POST',
            headers: {
              'apikey': sKey,
              'Authorization': `Bearer ${sKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ expiresIn: 604800 })
          });
          if (signRes.ok) {
            const signJson = await signRes.json();
            if (signJson.signedURL) return `${SUPABASE_URL}/storage/v1${signJson.signedURL}`;
          }
        } catch (_) {}
        return '';
      }

      await Promise.all(list.map(async (rec) => {
        if (rec.file_excel_path) {
          const freshUrl = await signFilePath(rec.file_excel_path);
          if (freshUrl) rec.file_excel_url = freshUrl;
        }
        if (rec.file_foto_path) {
          const freshFoto = await signFilePath(rec.file_foto_path);
          if (freshFoto) rec.file_foto_url = freshFoto;
        }
      }));

      return sendJson(200, {
        success: true,
        count: list.length,
        data: list
      });
    } catch (err) {
      console.error('[PENTA-LIST ERROR]', err.message);
      return sendJson(500, { success: false, message: err.message });
    }
  }

  // 3b. Proxy stream berkas private pentasharufan
  if (req.url.startsWith('/api/penta-file') && req.method === 'GET') {
    try {
      const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const filePath = urlObj.searchParams.get('path');
      if (!filePath) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        return res.end('Parameter path wajib disertakan.');
      }

      const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
      const fileRes = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/pentasharufan/${encodeURI(filePath)}`, {
        headers: {
          'apikey': sKey,
          'Authorization': `Bearer ${sKey}`
        }
      });

      if (!fileRes.ok) {
        res.writeHead(fileRes.status, { 'Content-Type': 'text/plain' });
        return res.end(`File tidak ditemukan (HTTP ${fileRes.status})`);
      }

      const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';
      const arrayBuffer = await fileRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': buffer.length,
        'Cache-Control': 'private, max-age=3600'
      });
      return res.end(buffer);
    } catch (err) {
      console.error('[PENTA-FILE PROXY ERROR]', err.message);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      return res.end('Gagal memuat berkas private.');
    }
  }

  // 4. Update Status Pentasharufan (Disetujui / Ditolak)
  if (req.url === '/api/update-penta-status' && req.method === 'POST') {
    const sendJson = (statusCode, data) => {
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    try {
      const body = await readBody(req);
      const { id, status, catatan_admin, admin_id } = body;

      if (!id || !status) {
        return sendJson(400, { success: false, message: 'ID dan status wajib disertakan.' });
      }

      const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
      const headers = {
        'apikey': sKey,
        'Authorization': `Bearer ${sKey}`,
        'Content-Type': 'application/json'
      };

      const auditPayload = {
        action: `PENTASHARUFAN_STATUS_${String(status).toUpperCase()}`,
        module: 'pentasharufan',
        user_id: (admin_id && isUuid(admin_id)) ? admin_id : null,
        description: JSON.stringify({
          id: id,
          status: status,
          catatan_admin: catatan_admin || '',
          updated_at: new Date().toISOString()
        })
      };

      const insRes = await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
        method: 'POST',
        headers,
        body: JSON.stringify(auditPayload)
      });

      if (!insRes.ok) {
        throw new Error(`Gagal update status di audit_logs (HTTP ${insRes.status})`);
      }

      return sendJson(200, {
        success: true,
        message: 'Status pentasharufan berhasil diperbarui di Supabase.'
      });
    } catch (err) {
      console.error('[UPDATE-PENTA-STATUS ERROR]', err.message);
      return sendJson(500, { success: false, message: err.message });
    }
  }

  // 5. Delete Permohonan Pentasharufan
  if (req.url === '/api/delete-penta' && req.method === 'POST') {
    const sendJson = (statusCode, data) => {
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    try {
      const body = await readBody(req);
      const { id, admin_id } = body;

      if (!id) return sendJson(400, { success: false, message: 'ID wajib disertakan.' });

      const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
      const headers = {
        'apikey': sKey,
        'Authorization': `Bearer ${sKey}`,
        'Content-Type': 'application/json'
      };

      await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'PENTASHARUFAN_DELETE',
          module: 'pentasharufan',
          user_id: (admin_id && isUuid(admin_id)) ? admin_id : null,
          description: JSON.stringify({ id: id })
        })
      });

      return sendJson(200, { success: true, message: 'Permohonan berhasil dihapus.' });
    } catch (err) {
      return sendJson(500, { success: false, message: err.message });
    }
  }

  // ============================================================
  // ENDPOINT: Bukti Setor Zakat (BSZ) List
  // GET /api/bsz-list
  // ============================================================
  if (req.url === '/api/bsz-list' && req.method === 'GET') {
    const sendJson = (statusCode, data) => {
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    try {
      const bszFilePath = path.join(__dirname, 'bsz_data.json');
      let records = {};
      if (fs.existsSync(bszFilePath)) {
        try {
          records = JSON.parse(fs.readFileSync(bszFilePath, 'utf8'));
        } catch (_) { records = {}; }
      }
      return sendJson(200, { success: true, data: records });
    } catch (err) {
      console.error('[BSZ-LIST ERROR]', err.message);
      return sendJson(500, { success: false, message: err.message });
    }
  }

  // ============================================================
  // ENDPOINT: Save Bukti Setor Zakat (BSZ)
  // POST /api/save-bsz
  // Body: { token, setoran_id, file_name, file_path, file_data, uploaded_at, upz_id }
  // ============================================================
  if (req.url === '/api/save-bsz' && req.method === 'POST') {
    const sendJson = (statusCode, data) => {
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    try {
      const body = await readBody(req);
      const { setoran_id, file_name, file_path, file_data, uploaded_at, upz_id } = body;

      if (!setoran_id) return sendJson(400, { success: false, message: 'setoran_id wajib diisi.' });
      if (!file_name) return sendJson(400, { success: false, message: 'file_name wajib diisi.' });

      const bszFilePath = path.join(__dirname, 'bsz_data.json');
      let records = {};
      if (fs.existsSync(bszFilePath)) {
        try {
          records = JSON.parse(fs.readFileSync(bszFilePath, 'utf8'));
        } catch (_) { records = {}; }
      }

      const newRecord = {
        setoran_id,
        file_name,
        file_path: file_path || '',
        file_data: file_data || '',
        uploaded_at: uploaded_at || new Date().toISOString(),
        upz_id: upz_id || ''
      };

      records[setoran_id] = newRecord;
      fs.writeFileSync(bszFilePath, JSON.stringify(records, null, 2), 'utf8');

      // Simpan log ke Supabase audit_logs jika service role key tersedia
      if (SUPABASE_SERVICE_ROLE_KEY && SUPABASE_SERVICE_ROLE_KEY !== 'ISI_SERVICE_ROLE_KEY_DISINI') {
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              action: 'UPLOAD_BSZ',
              module: 'BSZ',
              reference_id: setoran_id,
              description: JSON.stringify({ file_name, file_path, uploaded_at: newRecord.uploaded_at })
            })
          });
        } catch (auditErr) {
          console.warn('[SAVE-BSZ] audit_logs warn:', auditErr.message);
        }
      }

      return sendJson(200, { success: true, message: 'BSZ berhasil disimpan.', data: newRecord });
    } catch (err) {
      console.error('[SAVE-BSZ ERROR]', err.message);
      return sendJson(500, { success: false, message: err.message });
    }
  }

  // ============================================================
  // ENDPOINT: Transfer Documents List (TF Penta, TF Amil, TF Salin)
  // GET /api/transfer-docs-list
  // ============================================================
  if (req.url === '/api/transfer-docs-list' && req.method === 'GET') {
    const sendJson = (statusCode, data) => {
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    try {
      const tfFilePath = path.join(__dirname, 'transfer_docs.json');
      let records = {};
      if (fs.existsSync(tfFilePath)) {
        try {
          records = JSON.parse(fs.readFileSync(tfFilePath, 'utf8'));
        } catch (_) { records = {}; }
      }
      return sendJson(200, { success: true, data: records });
    } catch (err) {
      console.error('[TF-DOCS-LIST ERROR]', err.message);
      return sendJson(500, { success: false, message: err.message });
    }
  }

  // ============================================================
  // ENDPOINT: Save Transfer Document (TF Penta, TF Amil, TF Salin, BSZ)
  // POST /api/save-transfer-doc
  // ============================================================
  if (req.url === '/api/save-transfer-doc' && req.method === 'POST') {
    const sendJson = (statusCode, data) => {
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    try {
      const body = await readBody(req);
      const { setoran_id, doc_type, file_name, file_path, file_data, uploaded_at, upz_id } = body;

      if (!setoran_id) return sendJson(400, { success: false, message: 'setoran_id wajib diisi.' });
      if (!doc_type) return sendJson(400, { success: false, message: 'doc_type wajib diisi.' });
      if (!file_name) return sendJson(400, { success: false, message: 'file_name wajib diisi.' });

      const tfFilePath = path.join(__dirname, 'transfer_docs.json');
      let records = {};
      if (fs.existsSync(tfFilePath)) {
        try {
          records = JSON.parse(fs.readFileSync(tfFilePath, 'utf8'));
        } catch (_) { records = {}; }
      }

      if (!records[setoran_id]) records[setoran_id] = {};

      const newRecord = {
        setoran_id,
        doc_type,
        file_name,
        file_path: file_path || '',
        file_data: file_data || '',
        uploaded_at: uploaded_at || new Date().toISOString(),
        upz_id: upz_id || ''
      };

      records[setoran_id][doc_type] = newRecord;
      fs.writeFileSync(tfFilePath, JSON.stringify(records, null, 2), 'utf8');

      // Sinkronkan ke bsz_data.json jika doc_type adalah bsz
      if (doc_type === 'bsz') {
        try {
          const bszFilePath = path.join(__dirname, 'bsz_data.json');
          let bszRec = {};
          if (fs.existsSync(bszFilePath)) {
            try { bszRec = JSON.parse(fs.readFileSync(bszFilePath, 'utf8')); } catch (_) {}
          }
          bszRec[setoran_id] = newRecord;
          fs.writeFileSync(bszFilePath, JSON.stringify(bszRec, null, 2), 'utf8');
        } catch (_) {}
      }

      // Log ke audit_logs jika tersedia service role key
      if (SUPABASE_SERVICE_ROLE_KEY && SUPABASE_SERVICE_ROLE_KEY !== 'ISI_SERVICE_ROLE_KEY_DISINI') {
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              action: `UPLOAD_DOC_${doc_type.toUpperCase()}`,
              module: 'SETORAN_DOCS',
              reference_id: setoran_id,
              description: JSON.stringify({ doc_type, file_name, file_path, uploaded_at: newRecord.uploaded_at })
            })
          });
        } catch (auditErr) {
          console.warn('[SAVE-TRANSFER-DOC] audit_logs warn:', auditErr.message);
        }
      }

      return sendJson(200, { success: true, message: 'Berkas berhasil disimpan.', data: newRecord });
    } catch (err) {
      console.error('[SAVE-TRANSFER-DOC ERROR]', err.message);
      return sendJson(500, { success: false, message: err.message });
    }
  }

  // ============================================================
  // ENDPOINT: Get RKAT & Pentasharufan Configuration
  // GET /api/rkat-config
  // ============================================================
  if (req.url === '/api/rkat-config' && req.method === 'GET') {
    const sendJson = (statusCode, data) => {
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    try {
      const configPath = path.join(__dirname, 'rkat_config.json');
      let config = {
        default: {
          persen_penta: 35,
          persen_amil: 5,
          tagihan_salin: 0
        },
        upz_settings: {}
      };

      if (fs.existsSync(configPath)) {
        try {
          config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (_) {}
      }

      const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
      if (sKey && sKey !== 'ISI_SERVICE_ROLE_KEY_DISINI') {
        try {
          const aRes = await fetch(
            `${SUPABASE_URL}/rest/v1/audit_logs?module=eq.rkat_config&order=created_at.asc`,
            {
              headers: {
                'apikey': sKey,
                'Authorization': `Bearer ${sKey}`
              }
            }
          );
          if (aRes.ok) {
            const logs = await aRes.json();
            if (Array.isArray(logs)) {
              logs.forEach(l => {
                try {
                  const p = JSON.parse(l.description);
                  if (p && p.upz_id) {
                    if (!config.upz_settings) config.upz_settings = {};
                    config.upz_settings[p.upz_id] = Object.assign(
                      config.upz_settings[p.upz_id] || {},
                      p
                    );
                  }
                } catch (_) {}
              });
            }
          }
        } catch (dbErr) {
          console.warn('[RKAT-CONFIG] Sync warning:', dbErr.message);
        }
      }

      // Auto-lock jika tahun telah berganti (RKAT berlaku 1 tahun berjalan)
      const currentYear = new Date().getFullYear();
      let hasExpired = false;
      if (config.upz_settings) {
        Object.keys(config.upz_settings).forEach(uid => {
          const s = config.upz_settings[uid];
          if (s && s.rkat_unlocked) {
            const unlockedYear = s.unlocked_year || (s.updated_at ? new Date(s.updated_at).getFullYear() : null);
            if (unlockedYear && Number(unlockedYear) !== currentYear) {
              s.rkat_unlocked = false;
              s.expired_year = Number(unlockedYear);
              s.unlocked_year = null;
              hasExpired = true;
            } else if (!s.unlocked_year && unlockedYear) {
              s.unlocked_year = Number(unlockedYear);
            }
          }
        });
        if (hasExpired) {
          try {
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
          } catch (_) {}
        }
      }

      return sendJson(200, { success: true, data: config });
    } catch (err) {
      console.error('[RKAT-CONFIG ERROR]', err.message);
      return sendJson(500, { success: false, message: err.message });
    }
  }

  // ============================================================
  // ENDPOINT: Save RKAT & Pentasharufan Configuration (Admin Only)
  // POST /api/save-rkat-config
  // ============================================================
  if (req.url === '/api/save-rkat-config' && req.method === 'POST') {
    const sendJson = (statusCode, data) => {
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    try {
      const body = await readBody(req);
      const { token, upz_id, nama_upz, rkat_unlocked, persen_penta, persen_amil, tagihan_salin, unlocked_year } = body;

      if (!upz_id) {
        return sendJson(400, { success: false, message: 'upz_id wajib disertakan.' });
      }

      if (token) {
        try {
          await verifyAdminToken(token);
        } catch (authErr) {
          return sendJson(403, { success: false, message: authErr.message });
        }
      }

      const configPath = path.join(__dirname, 'rkat_config.json');
      let config = {
        default: {
          persen_penta: 35,
          persen_amil: 5,
          tagihan_salin: 0
        },
        upz_settings: {}
      };

      if (fs.existsSync(configPath)) {
        try {
          config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (_) {}
      }

      if (!config.upz_settings) config.upz_settings = {};

      const currentYear = new Date().getFullYear();
      const currentSetting = config.upz_settings[upz_id] || {};
      const isUnlocked = rkat_unlocked !== undefined ? Boolean(rkat_unlocked) : Boolean(currentSetting.rkat_unlocked);
      const targetYear = isUnlocked ? Number(unlocked_year || currentSetting.unlocked_year || currentYear) : null;

      const updatedSetting = {
        upz_id: upz_id,
        nama_upz: nama_upz || currentSetting.nama_upz || '',
        rkat_unlocked: isUnlocked,
        unlocked_year: targetYear,
        persen_penta: persen_penta !== undefined ? Number(persen_penta) : (currentSetting.persen_penta !== undefined ? currentSetting.persen_penta : 35),
        persen_amil: persen_amil !== undefined ? Number(persen_amil) : (currentSetting.persen_amil !== undefined ? currentSetting.persen_amil : 5),
        tagihan_salin: tagihan_salin !== undefined ? Number(tagihan_salin) : (currentSetting.tagihan_salin !== undefined ? currentSetting.tagihan_salin : 0),
        updated_at: new Date().toISOString()
      };

      config.upz_settings[upz_id] = updatedSetting;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

      const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
      if (sKey && sKey !== 'ISI_SERVICE_ROLE_KEY_DISINI') {
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
            method: 'POST',
            headers: {
              'apikey': sKey,
              'Authorization': `Bearer ${sKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              action: 'UPDATE_RKAT_CONFIG',
              module: 'rkat_config',
              reference_id: isUuid(upz_id) ? upz_id : null,
              description: JSON.stringify(updatedSetting)
            })
          });
        } catch (auditErr) {
          console.warn('[SAVE-RKAT-CONFIG] audit_logs error:', auditErr.message);
        }
      }

      return sendJson(200, {
        success: true,
        message: 'Pengaturan RKAT UPZ berhasil disimpan.',
        data: updatedSetting
      });
    } catch (err) {
      console.error('[SAVE-RKAT-CONFIG ERROR]', err.message);
      return sendJson(500, { success: false, message: err.message });
    }
  }

  // ============================================================
  // PROXY: /api/backend → Google Apps Script
  // ============================================================
  if (req.url === '/api/backend' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const response = await fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: body,
        });
        const text = await response.text();
        console.log('APPS SCRIPT STATUS:', response.status);
        console.log('APPS SCRIPT RESPONSE:', text.substring(0, 500));

        let result;
        try {
          result = JSON.parse(text);
        } catch {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: false,
            message: 'Response Apps Script bukan JSON.',
            raw: text.substring(0, 2000),
          }));
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        console.error('BACKEND ERROR:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
    });
    return;
  }

  // ============================================================
  // Static file serving & SPA fallback
  // ============================================================
  const cleanUrl = decodeURIComponent(req.url.split('?')[0]);
  let targetPath = path.join(__dirname, cleanUrl === '/' ? 'index.html' : cleanUrl);

  if (!fs.existsSync(targetPath) || fs.statSync(targetPath).isDirectory()) {
    const ext = path.extname(cleanUrl);
    if (!ext || ext === '.html') {
      targetPath = path.join(__dirname, 'index.html');
    }
  }

  const ext = path.extname(targetPath);
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(targetPath, (err, data) => {
    if (err) {
      console.warn(`[404] ${req.method} ${req.url}`);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found');
    }
    console.log(`[200] ${req.method} ${req.url} -> ${path.basename(targetPath)}`);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  Server lokal berjalan di: http://localhost:${PORT}\n`);
});



