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

  // 2. Cek role dari tabel profiles
  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=role,status&id=eq.${user.id}`,
    {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`
      }
    }
  );

  const profiles = await profileRes.json();
  if (!Array.isArray(profiles) || !profiles.length) {
    throw new Error('Profile tidak ditemukan.');
  }

  const profile = profiles[0];
  if (profile.role !== 'admin' || profile.status !== 'aktif') {
    throw new Error('Hanya admin aktif yang dapat mengubah password UPZ.');
  }

  return user;
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

      // Verifikasi caller adalah admin
      await verifyAdminToken(token);

      const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
      const headers = {
        'apikey': sKey,
        'Authorization': `Bearer ${sKey}`,
        'Content-Type': 'application/json'
      };

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
  // ENDPOINT: Get complete UPZ list (602+ records)
  // GET /api/upz-list
  // ============================================================
  if (req.url === '/api/upz-list' && req.method === 'GET') {
    const sendJson = (statusCode, data) => {
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    try {
      const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
      const response = await fetch(`${SUPABASE_URL}/rest/v1/upz?select=*&order=nama_upz.asc`, {
        headers: {
          'apikey': sKey,
          'Authorization': `Bearer ${sKey}`,
          'Range': '0-999'
        }
      });

      if (!response.ok) {
        throw new Error(`Supabase HTTP ${response.status}: ${await response.text()}`);
      }

      const rows = await response.json();
      return sendJson(200, {
        success: true,
        count: Array.isArray(rows) ? rows.length : 0,
        data: rows
      });
    } catch (err) {
      console.error('[UPZ-LIST ERROR]', err.message);
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
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  Server lokal berjalan di: http://localhost:${PORT}\n`);
});



