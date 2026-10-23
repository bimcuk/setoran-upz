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

    const { setoran_id, doc_type, nama_bsz, file_name, file_path, file_data, uploaded_at, upz_id } = body || {};

    if (!setoran_id) return res.status(400).json({ success: false, message: 'setoran_id wajib diisi.' });
    if (!file_name) return res.status(400).json({ success: false, message: 'file_name wajib diisi.' });

    const typeKey = (doc_type === 'bsz_nama') ? 'bsz_nama' : 'bsz_upz';

    const newRecord = {
      setoran_id,
      doc_type: typeKey,
      nama_bsz: (nama_bsz || file_name).trim(),
      file_name,
      file_path: file_path || '',
      file_data: file_data || '',
      uploaded_at: uploaded_at || new Date().toISOString(),
      upz_id: upz_id || ''
    };

    const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    const headers = {
      'apikey': sKey,
      'Authorization': `Bearer ${sKey}`,
      'Content-Type': 'application/json'
    };

    const logRecord = Object.assign({}, newRecord);
    if (logRecord.file_path && logRecord.file_data && logRecord.file_data.length > 500000) {
      logRecord.file_data = '';
    }

    await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: typeKey === 'bsz_nama' ? 'UPLOAD_BSZ_NAMA' : 'UPLOAD_BSZ_UPZ',
        module: 'BSZ',
        reference_id: setoran_id,
        description: JSON.stringify(logRecord)
      })
    });

    return res.status(200).json({ success: true, message: 'BSZ berhasil disimpan.', data: newRecord });
  } catch (err) {
    console.error('[API SAVE-BSZ ERROR]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};
