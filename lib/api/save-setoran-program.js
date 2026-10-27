const fs = require('fs');
const path = require('path');

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

async function verifyCaller(token) {
  if (!token) throw new Error('Token otentikasi diperlukan.');
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`
    }
  });
  if (!userRes.ok) throw new Error('Sesi login tidak valid atau kedaluwarsa.');
  const user = await userRes.json();

  const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  const pRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,role,status,upz_id&id=eq.${encodeURIComponent(user.id)}`, {
    headers: {
      'apikey': sKey,
      'Authorization': `Bearer ${sKey}`
    }
  });
  const profiles = await pRes.json();
  if (!Array.isArray(profiles) || !profiles.length) {
    throw new Error('Profil pengguna tidak ditemukan.');
  }
  const profile = profiles[0];
  if (profile.status !== 'aktif') {
    throw new Error('Akun Anda tidak aktif.');
  }
  return { user, profile };
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

    const { token, upz_id, nama_program, tanggal_setor, periode_bulan, periode_tahun, nominal, catatan } = body || {};

    const { user, profile } = await verifyCaller(token);

    const targetUpzId = profile.role === 'admin' ? (upz_id || profile.upz_id) : profile.upz_id;
    if (!targetUpzId) {
      return res.status(400).json({ success: false, message: 'ID UPZ tidak ditemukan.' });
    }

    const trimmedProgram = String(nama_program || '').trim();
    if (!trimmedProgram) {
      return res.status(400).json({ success: false, message: 'Jenis program wajib dipilih.' });
    }

    if (!tanggal_setor) {
      return res.status(400).json({ success: false, message: 'Tanggal setor wajib diisi.' });
    }

    const nominalAngka = Number(nominal);
    if (!Number.isFinite(nominalAngka) || nominalAngka <= 0) {
      return res.status(400).json({ success: false, message: 'Nominal setoran program harus lebih dari 0.' });
    }

    // Hitung periode jika tidak dikirim
    const tglObj = new Date(tanggal_setor);
    const bln = Number(periode_bulan) || (tglObj.getMonth() + 1);
    const thn = Number(periode_tahun) || tglObj.getFullYear();

    const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    const headers = {
      'apikey': sKey,
      'Authorization': `Bearer ${sKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };

    const newRecord = {
      upz_id: targetUpzId,
      tanggal_setor: tanggal_setor,
      periode_bulan: bln,
      periode_tahun: thn,
      nominal: nominalAngka,
      file_name: `[PROGRAM] ${trimmedProgram}`,
      file_path: null,
      status: 'menunggu',
      catatan: catatan ? `PROGRAM: ${trimmedProgram} | ${String(catatan).trim()}` : `PROGRAM: ${trimmedProgram}`,
      created_by: user.id,
      status_kecocokan: 'cocok'
    };

    const insRes = await fetch(`${SUPABASE_URL}/rest/v1/setoran`, {
      method: 'POST',
      headers,
      body: JSON.stringify(newRecord)
    });

    if (!insRes.ok) {
      const errText = await insRes.text();
      throw new Error(`Gagal menyimpan setoran ke Supabase (HTTP ${insRes.status}): ${errText}`);
    }

    const insertedData = await insRes.json();
    const insertedItem = Array.isArray(insertedData) ? insertedData[0] : insertedData;

    // Catat log ke Supabase audit_logs
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'SETORAN_PROGRAM_SUBMIT',
          module: 'setoran_program',
          reference_id: insertedItem.id,
          user_id: user.id,
          description: JSON.stringify({
            setoran_id: insertedItem.id,
            upz_id: targetUpzId,
            nama_program: trimmedProgram,
            nominal: nominalAngka,
            tanggal_setor,
            periode_bulan: bln,
            periode_tahun: thn,
            catatan: catatan || ''
          })
        })
      });
    } catch (auditErr) {
      console.warn('[SETORAN-PROGRAM] audit_logs record notice:', auditErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Setoran program berhasil diajukan.',
      result: insertedItem
    });

  } catch (err) {
    console.error('[SAVE-SETORAN-PROGRAM ERROR]', err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};
