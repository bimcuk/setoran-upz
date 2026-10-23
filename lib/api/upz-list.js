const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://efmgvgqyzdbhmejigqyg.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_qhbns7HHepypJ2s3TiF-MQ_i_-bpaow';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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

    const [upzRes, profRes, logsRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/upz?select=*&order=nama_upz.asc`, {
        headers: { ...headers, 'Range': '0-999' }
      }),
      fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,nama_lengkap,email,upz_id,status,role`, {
        headers: { ...headers, 'Range': '0-999' }
      }),
      fetch(`${SUPABASE_URL}/rest/v1/audit_logs?module=eq.profile&order=created_at.desc&limit=300`, {
        headers
      }).catch(() => null)
    ]);

    let upzRows = [];
    if (upzRes.ok) {
      upzRows = await upzRes.json().catch(() => []);
    }
    if (!Array.isArray(upzRows) || upzRows.length === 0) {
      try {
        const masterPath = path.join(process.cwd(), 'assets', 'upz_master.json');
        if (fs.existsSync(masterPath)) {
          upzRows = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
        }
      } catch (_) {}
    }

    const profiles = (profRes && profRes.ok) ? await profRes.json() : [];
    const logs = (logsRes && logsRes.ok) ? await logsRes.json() : [];

    const profileByUpzId = {};
    const profileById = {};
    (profiles || []).forEach(p => {
      if (p.upz_id) profileByUpzId[p.upz_id] = p;
      if (p.id) profileById[p.id] = p;
    });

    const extraMetaByUpzId = {};
    const extraMetaByProfileId = {};
    (logs || []).forEach(l => {
      try {
        const desc = typeof l.description === 'string' ? JSON.parse(l.description) : l.description;
        if (desc && typeof desc === 'object') {
          if (desc.upz_id && !extraMetaByUpzId[desc.upz_id]) {
            extraMetaByUpzId[desc.upz_id] = desc;
          }
          if (desc.profile_id && !extraMetaByProfileId[desc.profile_id]) {
            extraMetaByProfileId[desc.profile_id] = desc;
          }
        }
      } catch (_) {}
    });

    const mergedData = (upzRows || []).map(u => {
      const p = profileByUpzId[u.id] || profileById[u.id] || {};
      const meta = extraMetaByUpzId[u.id] || (p.id && extraMetaByProfileId[p.id]) || {};
      const cleanEmail = (p.email && !p.email.includes('@upz.baznas')) ? p.email : (u.email_pic || u.email || '-');
      const namaPengelola = meta.nama_pengelola || meta.nama_lengkap || (p.nama_lengkap && p.nama_lengkap !== 'PIC' ? p.nama_lengkap : '') || u.nama_pic || (u.nama_lengkap && u.nama_lengkap !== 'PIC' ? u.nama_lengkap : '') || u.nama_upz || '';

      return {
        id: u.id,
        kode_upz: u.kode_upz || u.kode,
        nama_upz: u.nama_upz || u.nama,
        kategori: u.kategori || '-',
        status: u.status || 'aktif',
        nama_pengelola: namaPengelola,
        nama_lengkap: namaPengelola,
        nama_pic: u.nama_pic || namaPengelola,
        email: cleanEmail,
        email_pic: u.email_pic || cleanEmail,
        no_sk: meta.no_sk || u.no_sk || '',
        nama_ketua: meta.nama_ketua || u.nama_ketua || '',
        profile_id: p.id || ''
      };
    });

    return res.status(200).json({
      success: true,
      count: mergedData.length,
      data: mergedData
    });

  } catch (err) {
    console.error('[UPZ-LIST ERROR]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};
