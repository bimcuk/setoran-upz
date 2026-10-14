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
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'ISI_SERVICE_ROLE_KEY_DISINI';

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



