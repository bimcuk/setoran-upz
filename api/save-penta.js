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

    const { record } = body || {};

    if (!record || !record.id) {
      return res.status(400).json({ success: false, message: 'Data permohonan tidak valid.' });
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

    return res.status(200).json({
      success: true,
      message: 'Permohonan pentasharufan berhasil disimpan di Supabase.',
      data: record
    });
  } catch (err) {
    console.error('[SAVE-PENTA ERROR]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};
