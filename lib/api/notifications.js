const path = require('path');
const fs = require('fs');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://efmgvgqyzdbhmejigqyg.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_qhbns7HHepypJ2s3TiF-MQ_i_-bpaow';
let SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  try {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*([^\r\n]+)/);
      if (match) SUPABASE_SERVICE_ROLE_KEY = match[1].trim();
    }
  } catch (_) {}
}

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
    let bodyObj = {};
    if (req.body) {
      bodyObj = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch (_) { return {}; } })() : req.body;
    }

    let token = '';
    if (req.headers && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }
    if (!token && bodyObj && bodyObj.token) {
      token = bodyObj.token;
    }
    if (!token && req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Token otentikasi wajib disertakan.' });
    }

    const user = await verifyUserToken(token);

    const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    const headers = {
      'apikey': sKey,
      'Authorization': `Bearer ${sKey}`,
      'Content-Type': 'application/json'
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

    // 1b. Handle aksi hapus notifikasi (delete_all atau delete_one) agar persisten di Supabase
    const action = bodyObj && bodyObj.action;
    if (action === 'delete_all') {
      const clearedAt = bodyObj.cleared_at || new Date().toISOString();
      const deletedIds = Array.isArray(bodyObj.deleted_ids) ? bodyObj.deleted_ids.slice(0, 500) : [];
      await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'CLEAR_ALL_NOTIFICATIONS',
          module: 'notifications_state',
          user_id: user.id,
          description: JSON.stringify({
            user_id: user.id,
            role,
            cleared_at: clearedAt,
            deleted_ids: deletedIds
          })
        })
      }).catch(() => {});

      return res.status(200).json({
        success: true,
        message: 'Semua notifikasi berhasil dihapus secara permanen.',
        cleared_at: clearedAt
      });
    }

    if (action === 'delete_one' && bodyObj.notif_id) {
      await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'DELETE_NOTIFICATION',
          module: 'notifications_state',
          user_id: user.id,
          description: JSON.stringify({
            user_id: user.id,
            role,
            notif_id: String(bodyObj.notif_id),
            deleted_at: new Date().toISOString()
          })
        })
      }).catch(() => {});

      return res.status(200).json({
        success: true,
        message: 'Notifikasi berhasil dihapus.'
      });
    }

    // 2. Ambil state penghapusan notifikasi milik user ini dari audit_logs
    let latestClearedAtMs = 0;
    let latestClearedAtIso = null;
    const deletedIdsSet = new Set();
    try {
      const stateRes = await fetch(
        `${SUPABASE_URL}/rest/v1/audit_logs?module=eq.notifications_state&user_id=eq.${encodeURIComponent(user.id)}&order=id.asc&limit=100`,
        { headers }
      );
      if (stateRes.ok) {
        const stateLogs = await stateRes.json();
        if (Array.isArray(stateLogs)) {
          stateLogs.forEach(sl => {
            try {
              const sd = typeof sl.description === 'string' ? JSON.parse(sl.description) : (sl.description || {});
              if (sl.action === 'CLEAR_ALL_NOTIFICATIONS') {
                const ts = new Date(sd.cleared_at || sl.created_at || 0).getTime();
                if (ts > latestClearedAtMs) {
                  latestClearedAtMs = ts;
                  latestClearedAtIso = sd.cleared_at || sl.created_at;
                }
                if (Array.isArray(sd.deleted_ids)) {
                  sd.deleted_ids.forEach(id => deletedIdsSet.add(String(id)));
                }
              } else if (sl.action === 'DELETE_NOTIFICATION' && sd.notif_id) {
                deletedIdsSet.add(String(sd.notif_id));
              }
            } catch (_) {}
          });
        }
      }
    } catch (_) {}

    // 3. Ambil master nama UPZ untuk label notifikasi yang rapi
    const upzMap = {};
    try {
      const uRes = await fetch(`${SUPABASE_URL}/rest/v1/upz?select=id,nama_upz`, { headers });
      const uRows = await uRes.json();
      if (Array.isArray(uRows)) {
        uRows.forEach(u => { if (u.id) upzMap[u.id] = u.nama_upz; });
      }
    } catch (_) {}

    // 4. Ambil audit_logs aktivitas profil, rkat, setoran terbaru (kecuali notifications_state)
    const logsRes = await fetch(`${SUPABASE_URL}/rest/v1/audit_logs?module=neq.notifications_state&order=created_at.desc&limit=50`, { headers });
    const logs = logsRes.ok ? await logsRes.json() : [];

    const notifs = [];

    (logs || []).forEach(l => {
      try {
        const notifId = 'audit_notif_' + l.id;
        if (deletedIdsSet.has(notifId)) return;

        const logTimeMs = new Date(l.created_at || 0).getTime();
        if (latestClearedAtMs > 0 && logTimeMs > 0 && logTimeMs <= latestClearedAtMs) {
          return;
        }

        const desc = typeof l.description === 'string' ? JSON.parse(l.description) : (l.description || {});
        if (!desc || typeof desc !== 'object') return;

        const upzId = desc.upz_id || l.reference_id || '';
        const profileId = desc.profile_id || l.user_id || '';
        const namaUpz = upzMap[upzId] || desc.nama_upz || 'UPZ';
        const namaPengelola = escapeHtml(desc.nama_pengelola || desc.nama_lengkap || '-');
        const noSk = escapeHtml(desc.no_sk || '-');
        const namaKetua = escapeHtml(desc.nama_ketua || '-');
        const email = escapeHtml(desc.email || '');

        if (l.module === 'profile' || l.action === 'UPDATE_UPZ_PROFILE' || l.action === 'DELETE_UPZ') {
          if (role === 'admin') {
            notifs.push({
              id: notifId,
              type: 'perubahan',
              category: 'Manajemen Akun UPZ',
              title: l.action === 'DELETE_UPZ' ? 'Akun UPZ Dihapus' : 'Pembaruan Akun UPZ',
              nama_upz: namaUpz,
              upz_id: upzId,
              profile_id: profileId,
              desc: l.action === 'DELETE_UPZ'
                ? `Akun UPZ <strong>${namaUpz}</strong> telah dihapus permanen.`
                : `Pembaruan data: ${desc.kode_upz ? 'Kode <strong>' + escapeHtml(desc.kode_upz) + '</strong>, ' : ''}Pengelola <strong>${namaPengelola}</strong>, Ketua <strong>${namaKetua}</strong>, SK <strong>${noSk}</strong>${email ? ' (Email: ' + email + ')' : ''}`,
              timestamp: l.created_at || new Date().toISOString(),
              status: l.action === 'DELETE_UPZ' ? 'warning' : 'info'
            });
          } else {
            const isMyProfile = (profileId && profileId === user.id) ||
                                (userUpzId && upzId && userUpzId === upzId) ||
                                (email && user.email && email.toLowerCase() === user.email.toLowerCase()) ||
                                (desc.cleanEmail && user.email && desc.cleanEmail.toLowerCase() === user.email.toLowerCase());
            if (isMyProfile) {
              notifs.push({
                id: notifId,
                type: 'perubahan',
                category: 'Informasi Profil',
                title: 'Informasi Profil UPZ Diperbarui',
                nama_upz: 'Admin BAZNAS / Sistem',
                upz_id: upzId,
                profile_id: profileId,
                desc: `Data profil resmi UPZ Anda telah diperbarui: ${desc.kode_upz ? 'Kode <strong>' + escapeHtml(desc.kode_upz) + '</strong>, ' : ''}Pengelola <strong>${namaPengelola}</strong>, Ketua <strong>${namaKetua}</strong>, SK <strong>${noSk}</strong>${email ? ' (Email: ' + email + ')' : ''}.`,
                timestamp: l.created_at || new Date().toISOString(),
                status: 'info'
              });
            }
          }
        } else if (l.module === 'rkat_config' || l.action === 'UPDATE_RKAT_CONFIG') {
          if (role === 'admin') {
            const salinCount = Array.isArray(desc.salin_bulan_transfer) ? desc.salin_bulan_transfer.length : 0;
            notifs.push({
              id: notifId,
              type: 'rkat',
              category: 'Pengaturan RKAT',
              title: 'Pembaruan RKAT & Salin Aslimas',
              nama_upz: namaUpz,
              upz_id: upzId,
              profile_id: profileId,
              desc: `Pengaturan RKAT ${namaUpz} diperbarui: Pentasharufan <strong>${desc.persen_penta ?? 35}%</strong>, Hak Amil <strong>${desc.persen_amil ?? 5}%</strong>, Salin Aslimas ditransfer <strong>${salinCount} bulan</strong>${desc.tahun ? ' (Tahun ' + desc.tahun + ')' : ''}.`,
              timestamp: l.created_at || new Date().toISOString(),
              status: 'info'
            });
          }
        } else if (l.module === 'setoran' || l.action === 'DELETE_SETORAN' || l.action === 'VERIFIKASI_SETORAN') {
          if (role === 'admin') {
            let actTitle = 'Aktivitas Setoran';
            let actDesc = `Aktivitas setoran diproses.`;
            if (l.action === 'DELETE_SETORAN') {
              actTitle = 'Penghapusan Setoran';
              actDesc = `Setoran #${desc.setoran_id || '-'} berhasil dihapus permanen.`;
            } else if (l.action === 'VERIFIKASI_SETORAN') {
              actTitle = 'Verifikasi Setoran';
              actDesc = `Setoran #${desc.setoran_id || '-'} (${namaUpz}) diverifikasi dengan status: <strong>${desc.status || '-'}</strong>.`;
            }
            notifs.push({
              id: notifId,
              type: 'setoran',
              category: 'Setoran Zakat',
              title: actTitle,
              nama_upz: namaUpz,
              upz_id: upzId,
              profile_id: profileId,
              desc: actDesc,
              timestamp: l.created_at || new Date().toISOString(),
              status: l.action === 'DELETE_SETORAN' ? 'warning' : 'info'
            });
          }
        }
      } catch (_) {}
    });

    return res.status(200).json({
      success: true,
      count: notifs.length,
      data: notifs,
      cleared_at: latestClearedAtIso,
      deleted_ids: Array.from(deletedIdsSet)
    });

  } catch (err) {
    console.error('[API NOTIFICATIONS ERROR]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};
