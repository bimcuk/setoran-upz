const SUPABASE_URL = process.env.SUPABASE_URL || 'https://efmgvgqyzdbhmejigqyg.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_qhbns7HHepypJ2s3TiF-MQ_i_-bpaow';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method tidak diizinkan.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
    }

    const { token, nama_pengelola, no_sk, nama_ketua } = body || {};

    if (!token) return res.status(401).json({ success: false, message: 'Token tidak ditemukan.' });
    if (!nama_pengelola) return res.status(400).json({ success: false, message: 'Nama pengelola wajib diisi.' });

    const user = await verifyUserToken(token);

    // 1. Selalu perbarui user_metadata di auth.users (bisa langsung pakai token user jika service key belum ada)
    try {
      const authHeader = SUPABASE_SERVICE_ROLE_KEY
        ? `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        : `Bearer ${token}`;
      const authUrl = SUPABASE_SERVICE_ROLE_KEY
        ? `${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(user.id)}`
        : `${SUPABASE_URL}/auth/v1/user`;
      const authMethod = SUPABASE_SERVICE_ROLE_KEY ? 'PUT' : 'PUT';
      const authKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

      const metaPayload = {
        ...(user.user_metadata || {}),
        nama_lengkap: nama_pengelola,
        nama_pengelola: nama_pengelola,
        no_sk: no_sk !== undefined ? no_sk : (user.user_metadata?.no_sk || ''),
        nama_ketua: nama_ketua !== undefined ? nama_ketua : (user.user_metadata?.nama_ketua || '')
      };

      await fetch(authUrl, {
        method: authMethod,
        headers: {
          'apikey': authKey,
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(SUPABASE_SERVICE_ROLE_KEY ? { user_metadata: metaPayload } : { data: metaPayload })
      });
    } catch (authErr) {
      console.warn('[UPDATE-PROFILE] Auth metadata update warning:', authErr.message);
    }

    // 2. Jika SERVICE_ROLE_KEY tersedia, update tabel profiles, upz, dan audit_logs
    if (SUPABASE_SERVICE_ROLE_KEY) {
      const headers = {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      };

      // Cari upz_id dari profile
      let upzId = null;
      try {
        const pRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`, { headers });
        const pRows = await pRes.json();
        if (Array.isArray(pRows) && pRows.length > 0) {
          upzId = pRows[0].upz_id;
        }
      } catch (_) {}

      // Update tabel profiles
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ nama_lengkap: nama_pengelola })
        });
      } catch (pErr) {
        console.warn('[UPDATE-PROFILE] profiles patch error:', pErr.message);
      }

      // Update tabel upz
      if (upzId) {
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/upz?id=eq.${encodeURIComponent(upzId)}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ nama_pic: nama_pengelola })
          });
        } catch (uErr) {
          console.warn('[UPDATE-PROFILE] upz patch error:', uErr.message);
        }
      }

      // Catat ke audit_logs
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action: 'UPDATE_UPZ_PROFILE',
            module: 'profile',
            user_id: user.id,
            description: JSON.stringify({
              upz_id: upzId,
              profile_id: user.id,
              nama_pengelola: nama_pengelola,
              nama_lengkap: nama_pengelola,
              no_sk: no_sk || '',
              nama_ketua: nama_ketua || ''
            })
          })
        });
      } catch (logErr) {
        console.warn('[UPDATE-PROFILE] audit_logs error:', logErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Profil UPZ berhasil diperbarui dan disinkronkan ke Supabase.'
    });

  } catch (err) {
    console.error('[UPDATE-PROFILE ERROR]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};
