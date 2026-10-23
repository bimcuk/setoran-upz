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

function isUuid(str) {
  return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
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

    const { id, admin_id } = body || {};

    if (!id) return res.status(400).json({ success: false, message: 'ID wajib disertakan.' });

    const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    const headers = {
      'apikey': sKey,
      'Authorization': `Bearer ${sKey}`,
      'Content-Type': 'application/json'
    };

    // 1. Cari berkas terkait permohonan di audit_logs untuk dihapus dari storage
    try {
      const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/audit_logs?module=eq.pentasharufan&description=like.*"${id}"*`, { headers });
      if (checkRes.ok) {
        const rows = await checkRes.json();
        const filesToDelete = [];
        (rows || []).forEach(r => {
          try {
            const d = typeof r.description === 'string' ? JSON.parse(r.description) : r.description;
            if (d && d.id === id) {
              if (d.file_excel_path) {
                filesToDelete.push(d.file_excel_path.replace(/^pentasharufan\//, ''));
              }
              if (d.foto_penyerahan_path) {
                filesToDelete.push(d.foto_penyerahan_path.replace(/^pentasharufan\//, ''));
              }
            }
          } catch (_) {}
        });

        if (filesToDelete.length > 0) {
          await fetch(`${SUPABASE_URL}/storage/v1/object/pentasharufan`, {
            method: 'DELETE',
            headers,
            body: JSON.stringify({ prefixes: filesToDelete })
          });
        }
      }
    } catch (storageErr) {
      console.warn('Hapus file pentasharufan storage warning:', storageErr);
    }

    // 2. Hapus log pengajuan lama dari audit_logs
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/audit_logs?module=eq.pentasharufan&description=like.*"${id}"*`, {
        method: 'DELETE',
        headers
      });
    } catch (delErr) {
      console.warn('Hapus audit_logs lama warning:', delErr);
    }

    // 3. Catat log PENTASHARUFAN_DELETE
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

    return res.status(200).json({ success: true, message: 'Permohonan berhasil dihapus.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
