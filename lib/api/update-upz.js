const SUPABASE_URL = process.env.SUPABASE_URL || 'https://efmgvgqyzdbhmejigqyg.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_qhbns7HHepypJ2s3TiF-MQ_i_-bpaow';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function isUuid(str) {
  return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

async function verifyAdminToken(token) {
  if (!token) throw new Error('Token tidak ditemukan.');
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`
    }
  });

  if (!userRes.ok) throw new Error('Token tidak valid atau sudah kedaluwarsa.');
  const user = await userRes.json();

  const authHeader = SUPABASE_SERVICE_ROLE_KEY
    ? `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    : `Bearer ${token}`;
  const apiKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=role,status&id=eq.${encodeURIComponent(user.id)}`,
    {
      headers: {
        'apikey': apiKey,
        'Authorization': authHeader
      }
    }
  );

  const profiles = await profileRes.json();
  if (!Array.isArray(profiles) || !profiles.length) {
    throw new Error('Profile admin tidak ditemukan di Supabase.');
  }

  const profile = profiles[0];
  if (profile.role !== 'admin' || profile.status !== 'aktif') {
    throw new Error('Hanya admin aktif yang berwenang mengubah akun UPZ.');
  }

  return user;
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

    const { token, profile_id, upz_id, kode_upz, nama_upz, nama_lengkap, kategori, status, password, email, no_sk, nama_ketua } = body || {};

    if (!token) return res.status(401).json({ success: false, message: 'Token tidak ditemukan.' });
    if (!nama_upz) return res.status(400).json({ success: false, message: 'Nama UPZ wajib diisi.' });

    await verifyAdminToken(token);

    if (!SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY belum disetel di Environment Variables server/Vercel.');
    }
    const sKey = SUPABASE_SERVICE_ROLE_KEY;

    const headers = {
      'apikey': sKey,
      'Authorization': `Bearer ${sKey}`,
      'Content-Type': 'application/json'
    };

    const cleanEmail = email ? String(email).trim().toLowerCase() : '';
    let targetAuthId = profile_id;

    if (!isUuid(targetAuthId) || (upz_id && targetAuthId === upz_id)) {
      if (upz_id) {
        try {
          const pRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,email&upz_id=eq.${encodeURIComponent(upz_id)}&limit=1`, { headers });
          const pRows = await pRes.json();
          if (Array.isArray(pRows) && pRows.length > 0 && isUuid(pRows[0].id)) {
            targetAuthId = pRows[0].id;
          }
        } catch (_) {}
      }
    }

    if (!isUuid(targetAuthId) && cleanEmail) {
      try {
        const pRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id&email=eq.${encodeURIComponent(cleanEmail)}&limit=1`, { headers });
        const pRows = await pRes.json();
        if (Array.isArray(pRows) && pRows.length > 0 && isUuid(pRows[0].id)) {
          targetAuthId = pRows[0].id;
        }
      } catch (_) {}
    }

    // 1. UPDATE ATAU BUAT USER DI SUPABASE AUTH (auth.users)
    if (targetAuthId && isUuid(targetAuthId)) {
      const authPatch = {};
      if (cleanEmail) {
        authPatch.email = cleanEmail;
        authPatch.email_confirm = true;
      }
      if (password) {
        authPatch.password = password;
      }
      const uMeta = {};
      if (nama_lengkap) uMeta.nama_lengkap = nama_lengkap;
      if (nama_lengkap) uMeta.nama_pengelola = nama_lengkap;
      if (no_sk !== undefined) uMeta.no_sk = no_sk;
      if (nama_ketua !== undefined) uMeta.nama_ketua = nama_ketua;
      if (Object.keys(uMeta).length > 0) {
        authPatch.user_metadata = uMeta;
      }

      if (Object.keys(authPatch).length > 0) {
        const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(targetAuthId)}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(authPatch)
        });
        const authData = await authRes.json().catch(() => ({}));
        if (!authRes.ok) {
          const errMsg = authData.message || authData.msg || authData.error_description || `Supabase Auth error (${authRes.status})`;
          throw new Error(`Gagal update akun login Supabase Auth: ${errMsg}`);
        }
      }
    } else {
      if (!cleanEmail || !password) {
        throw new Error('Email dan kata sandi wajib diisi untuk akun UPZ baru.');
      }
      const createAuthRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: cleanEmail,
          password: password,
          email_confirm: true,
          user_metadata: {
            nama_lengkap: nama_lengkap || nama_upz,
            nama_pengelola: nama_lengkap || nama_upz,
            no_sk: no_sk || '',
            nama_ketua: nama_ketua || ''
          }
        })
      });
      const createAuthData = await createAuthRes.json().catch(() => ({}));
      if (!createAuthRes.ok) {
        const errMsg = createAuthData.message || createAuthData.msg || `Gagal membuat akun auth Supabase (${createAuthRes.status})`;
        throw new Error(errMsg);
      }
      targetAuthId = createAuthData.id;
    }

    // 2. UPDATE ATAU INSERT TABEL UPZ
    let finalUpzId = upz_id;
    if (finalUpzId) {
      const upzPatch = { nama_upz: nama_upz, kategori: kategori };
      if (kode_upz !== undefined) upzPatch.kode_upz = String(kode_upz).trim();
      if (nama_lengkap) upzPatch.nama_pic = nama_lengkap;
      if (cleanEmail) upzPatch.email_pic = cleanEmail;
      await fetch(`${SUPABASE_URL}/rest/v1/upz?id=eq.${encodeURIComponent(finalUpzId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(upzPatch)
      });
    } else {
      const insUpzRes = await fetch(`${SUPABASE_URL}/rest/v1/upz`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify({
          nama_upz: nama_upz,
          kode_upz: kode_upz ? String(kode_upz).trim() : (cleanEmail ? cleanEmail.split('@')[0] : ''),
          kategori: kategori,
          nama_pic: nama_lengkap,
          email_pic: cleanEmail
        })
      });
      const insUpzData = await insUpzRes.json().catch(() => []);
      if (Array.isArray(insUpzData) && insUpzData.length > 0) {
        finalUpzId = insUpzData[0].id;
      }
    }

    // 3. UPDATE ATAU INSERT TABEL PROFILES
    if (targetAuthId) {
      const profPayload = {
        nama_lengkap: nama_lengkap || nama_upz,
        status: status || 'aktif',
        role: 'upz'
      };
      if (cleanEmail) profPayload.email = cleanEmail;
      if (finalUpzId) profPayload.upz_id = finalUpzId;

      const checkProfRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(targetAuthId)}`, { headers });
      const checkProfData = await checkProfRes.json().catch(() => []);
      if (Array.isArray(checkProfData) && checkProfData.length > 0) {
        await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(targetAuthId)}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(profPayload)
        });
      } else {
        await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            id: targetAuthId,
            ...profPayload
          })
        });
      }
    }

    // 4. Catat riwayat update profil ke audit_logs
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'UPDATE_UPZ_PROFILE',
          module: 'profile',
          user_id: isUuid(targetAuthId) ? targetAuthId : null,
          description: JSON.stringify({
            upz_id: finalUpzId,
            kode_upz: kode_upz ? String(kode_upz).trim() : '',
            profile_id: targetAuthId,
            nama_pengelola: nama_lengkap,
            nama_lengkap: nama_lengkap,
            no_sk: no_sk || '',
            nama_ketua: nama_ketua || '',
            email: cleanEmail
          })
        })
      });
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: 'Data UPZ dan akun login Supabase berhasil diperbarui.',
      data: {
        profile_id: targetAuthId,
        upz_id: finalUpzId,
        email: cleanEmail
      }
    });

  } catch (error) {
    console.error('API UPDATE UPZ ERROR:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
