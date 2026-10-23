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
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ success: false, message: 'Query path wajib disertakan.' });
    }

    const cleanPath = filePath.startsWith('pentasharufan/') ? filePath.replace(/^pentasharufan\//, '') : filePath;
    const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

    const fileRes = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/pentasharufan/${encodeURI(cleanPath)}`, {
      headers: {
        'apikey': sKey,
        'Authorization': `Bearer ${sKey}`
      }
    });

    if (!fileRes.ok) {
      return res.status(fileRes.status).send(`Gagal mengambil berkas: HTTP ${fileRes.status}`);
    }

    const cType = fileRes.headers.get('content-type') || 'application/octet-stream';
    const cDisp = fileRes.headers.get('content-disposition') || `inline; filename="${encodeURIComponent(cleanPath.split('/').pop())}"`;

    res.setHeader('Content-Type', cType);
    res.setHeader('Content-Disposition', cDisp);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    const buffer = Buffer.from(await fileRes.arrayBuffer());
    return res.status(200).send(buffer);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
