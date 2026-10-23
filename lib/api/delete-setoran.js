const SUPABASE_URL = process.env.SUPABASE_URL || 'https://efmgvgqyzdbhmejigqyg.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_qhbns7HHepypJ2s3TiF-MQ_i_-bpaow';
let SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!SUPABASE_SERVICE_ROLE_KEY) {
  try {
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*([^\r\n]+)/);
      if (match) SUPABASE_SERVICE_ROLE_KEY = match[1].trim();
    }
  } catch (_) {}
}

async function verifyAdminToken(token) {
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`
    }
  });
  if (!userRes.ok) throw new Error('Token tidak valid.');
  const user = await userRes.json();
  const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=role,status&id=eq.${encodeURIComponent(user.id)}`,
    { headers: { 'apikey': sKey, 'Authorization': `Bearer ${sKey}` } }
  );
  const profiles = await profileRes.json();
  if (!Array.isArray(profiles) || !profiles.length || profiles[0].role !== 'admin') {
    throw new Error('Hanya admin yang berwenang.');
  }
  return user;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method tidak diizinkan.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
    }

    const { token, setoran_id, file_path } = body || {};
    if (!token) return res.status(401).json({ success: false, message: 'Token tidak ditemukan.' });
    if (!setoran_id) return res.status(400).json({ success: false, message: 'setoran_id wajib diisi.' });

    await verifyAdminToken(token);

    const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    const headers = {
      'apikey': sKey,
      'Authorization': `Bearer ${sKey}`,
      'Content-Type': 'application/json'
    };

    let targetFilePath = file_path;
    try {
      const checkRes = await fetch(
        `${SUPABASE_URL}/rest/v1/setoran?select=file_path&id=eq.${encodeURIComponent(setoran_id)}`,
        { headers }
      );
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (Array.isArray(checkData) && checkData.length && checkData[0].file_path && !targetFilePath) {
          targetFilePath = checkData[0].file_path;
        }
      }
    } catch (_) {}

    // 1. Hapus detail_setoran
    await fetch(
      `${SUPABASE_URL}/rest/v1/detail_setoran?setoran_id=eq.${encodeURIComponent(setoran_id)}`,
      { method: 'DELETE', headers }
    );

    // 2. Hapus setoran
    await fetch(
      `${SUPABASE_URL}/rest/v1/setoran?id=eq.${encodeURIComponent(setoran_id)}`,
      { method: 'DELETE', headers }
    );

    // 3. Hapus berkas dari storage bucket
    if (targetFilePath) {
      try {
        const cleanPath = targetFilePath.replace(/^setoran-upz\//, '');
        await fetch(`${SUPABASE_URL}/storage/v1/object/setoran-upz`, {
          method: 'DELETE',
          headers,
          body: JSON.stringify({ prefixes: [cleanPath] })
        });
      } catch (err) {
        console.warn('Storage delete warning:', err);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Setoran dan berkas berhasil dihapus permanen.'
    });
  } catch (err) {
    console.error('[API DELETE-SETORAN ERROR]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};
