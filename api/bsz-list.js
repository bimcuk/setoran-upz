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
    const headers = {
      'apikey': sKey,
      'Authorization': `Bearer ${sKey}`
    };

    const resLogs = await fetch(`${SUPABASE_URL}/rest/v1/audit_logs?module=eq.BSZ&order=created_at.asc`, { headers });
    const records = {};

    if (resLogs.ok) {
      const logs = await resLogs.json();
      (logs || []).forEach(log => {
        try {
          const d = typeof log.description === 'string' ? JSON.parse(log.description) : log.description;
          if (d && d.setoran_id) {
            const typeKey = (d.doc_type === 'bsz_nama') ? 'bsz_nama' : 'bsz_upz';
            if (!records[d.setoran_id] || typeof records[d.setoran_id] !== 'object' || records[d.setoran_id].file_name) {
              const old = records[d.setoran_id];
              records[d.setoran_id] = {};
              if (old && old.file_name) records[d.setoran_id].bsz_upz = old;
            }
            records[d.setoran_id][typeKey] = d;
          }
        } catch (_) {}
      });
    }

    return res.status(200).json({ success: true, data: records });
  } catch (err) {
    console.error('[API BSZ-LIST ERROR]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};
