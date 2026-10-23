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
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method tidak diizinkan.' });
  }

  try {
    const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    const resLogs = await fetch(`${SUPABASE_URL}/rest/v1/audit_logs?module=eq.pentasharufan&order=created_at.asc`, {
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

    (logs || []).forEach(log => {
      try {
        const rec = typeof log.description === 'string' ? JSON.parse(log.description) : log.description;
        if (!rec || !rec.id) return;

        if (log.action === 'PENTASHARUFAN_DELETE') {
          recordsMap.delete(rec.id);
          return;
        }

        if (log.action === 'PENTASHARUFAN_SUBMIT') {
          if (rec.nama_upz || rec.nominal || rec.jenis_program) {
            recordsMap.set(rec.id, rec);
          }
          return;
        }

        if (recordsMap.has(rec.id)) {
          const current = recordsMap.get(rec.id);
          if (rec.status) current.status = rec.status;
          if (rec.catatan_admin !== undefined) current.catatan_admin = rec.catatan_admin;
        } else if (rec.nama_upz && (rec.nominal || rec.jenis_program)) {
          recordsMap.set(rec.id, rec);
        }
      } catch (_) {}
    });

    const list = Array.from(recordsMap.values())
      .filter(r => r && r.id && (r.nama_upz || r.nominal || r.jenis_program))
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    async function signFilePath(pathStr) {
      if (!pathStr) return '';
      try {
        const cleanPath = pathStr.startsWith('pentasharufan/') ? pathStr.replace(/^pentasharufan\//, '') : pathStr;
        const signRes = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/pentasharufan/${encodeURI(cleanPath)}`, {
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

    return res.status(200).json({
      success: true,
      count: list.length,
      data: list
    });
  } catch (err) {
    console.error('[PENTA-LIST ERROR]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};
