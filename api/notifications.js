const SUPABASE_URL = process.env.SUPABASE_URL || 'https://efmgvgqyzdbhmejigqyg.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_qhbns7HHepypJ2s3TiF-MQ_i_-bpaow';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function verifyUserToken(token) {
  if (!token) throw new Error('Token tidak ditemukan.');
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`
    }
  });

  if (!userRes.ok) throw new Error('Token tidak valid atau sudah kedaluwarsa.');
  return await userRes.json();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method tidak diizinkan.' });
  }

  try {
    let token = '';
    if (req.headers && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }
    if (!token && req.body) {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (_) { body = {}; }
      }
      token = body.token || '';
    }
    if (!token && req.query) {
      token = req.query.token || '';
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Token otentikasi wajib disertakan.' });
    }

    const user = await verifyUserToken(token);

    const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    const headers = {
      'apikey': sKey,
      'Authorization': `Bearer ${sKey}`
    };

    // 1. Ambil profil user untuk menentukan role & upz_id
    let role = 'upz';
    let userUpzId = null;
    try {
      const pRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`, { headers });
      const pRows = await pRes.json();
      if (Array.isArray(pRows) && pRows.length > 0) {
        role = pRows[0].role || 'upz';
        userUpzId = pRows[0].upz_id;
      }
    } catch (_) {}

    // 2. Ambil master nama UPZ untuk label notifikasi yang rapi
    const upzMap = {};
    try {
      const uRes = await fetch(`${SUPABASE_URL}/rest/v1/upz?select=id,nama_upz`, { headers });
      const uRows = await uRes.json();
      if (Array.isArray(uRows)) {
        uRows.forEach(u => { if (u.id) upzMap[u.id] = u.nama_upz; });
      }
    } catch (_) {}

    // 3. Ambil audit_logs aktivitas profil & akun terbaru
    const logsRes = await fetch(`${SUPABASE_URL}/rest/v1/audit_logs?module=eq.profile&order=created_at.desc&limit=50`, { headers });
    const logs = logsRes.ok ? await logsRes.json() : [];

    const notifs = [];

    (logs || []).forEach(l => {
      try {
        const desc = typeof l.description === 'string' ? JSON.parse(l.description) : l.description;
        if (!desc || typeof desc !== 'object') return;

        const upzId = desc.upz_id || '';
        const profileId = desc.profile_id || l.user_id || '';
        const namaUpz = upzMap[upzId] || desc.nama_upz || 'UPZ';
        const namaPengelola = escapeHtml(desc.nama_pengelola || desc.nama_lengkap || '-');
        const noSk = escapeHtml(desc.no_sk || '-');
        const namaKetua = escapeHtml(desc.nama_ketua || '-');
        const email = escapeHtml(desc.email || '');

        if (role === 'admin') {
          // Notifikasi untuk Admin: Semua aktivitas perubahan akun/profil UPZ
          notifs.push({
            id: 'audit_notif_' + l.id,
            type: 'perubahan',
            category: 'Perubahan Akun',
            title: 'Pembaruan Akun UPZ',
            nama_upz: namaUpz,
            upz_id: upzId,
            profile_id: profileId,
            desc: `Pembaruan data akun: Pengelola <strong>${namaPengelola}</strong>, Ketua <strong>${namaKetua}</strong>, SK <strong>${noSk}</strong>${email ? ' (Email: ' + email + ')' : ''}`,
            timestamp: l.created_at || new Date().toISOString(),
            status: 'info'
          });
        } else {
          // Notifikasi untuk UPZ: Jika perubahan dilakukan pada UPZ ini (cocokkan id, upz_id, atau email)
          const isMyProfile = (profileId && profileId === user.id) ||
                              (userUpzId && upzId && userUpzId === upzId) ||
                              (email && user.email && email.toLowerCase() === user.email.toLowerCase()) ||
                              (desc.cleanEmail && user.email && desc.cleanEmail.toLowerCase() === user.email.toLowerCase());
          if (isMyProfile) {
            notifs.push({
              id: 'audit_notif_' + l.id,
              type: 'perubahan',
              category: 'Informasi Profil',
              title: 'Informasi Profil UPZ Diperbarui',
              nama_upz: 'Admin BAZNAS / Sistem',
              upz_id: upzId,
              profile_id: profileId,
              desc: `Data profil resmi UPZ Anda telah diperbarui: Pengelola <strong>${namaPengelola}</strong>, Ketua <strong>${namaKetua}</strong>, SK <strong>${noSk}</strong>${email ? ' (Email login: ' + email + ')' : ''}.`,
              timestamp: l.created_at || new Date().toISOString(),
              status: 'info'
            });
          }
        }
      } catch (_) {}
    });

    return res.status(200).json({
      success: true,
      count: notifs.length,
      data: notifs
    });

  } catch (err) {
    console.error('[API NOTIFICATIONS ERROR]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};
