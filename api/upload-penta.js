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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method tidak diizinkan.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
    }

    const { name, type, subfolder, upzId, base64 } = body || {};

    if (!name || !base64) {
      return res.status(400).json({ success: false, message: 'File name dan content base64 wajib dikirim.' });
    }

    const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    const ext = name.split('.').pop() || (type && type.includes('image') ? 'jpg' : 'dat');
    const cleanBase = name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    const safeFolder = subfolder || 'berkas';
    const safeUpz = (upzId || 'umum').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = `${safeUpz}/${safeFolder}/${Date.now()}_${cleanBase}.${ext}`;

    const buffer = Buffer.from(base64, 'base64');
    const mimeType = type || (ext === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : (ext === 'xls' ? 'application/vnd.ms-excel' : 'application/octet-stream'));

    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/pentasharufan/${encodeURI(filePath)}`, {
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

    return res.status(200).json({
      success: true,
      filePath: filePath,
      publicUrl: signedUrl,
      signedUrl: signedUrl,
      originalName: name
    });
  } catch (err) {
    console.error('[UPLOAD-PENTA ERROR]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};
