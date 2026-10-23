const fs = require('fs');
const path = require('path');

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
    throw new Error('Hanya admin aktif yang berwenang mengubah konfigurasi RKAT.');
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

    const { token, upz_id, nama_upz, rkat_unlocked, persen_penta, persen_amil, tagihan_salin, salin_bulan_transfer, salin_bulanan, unlocked_year } = body || {};

    if (!upz_id) {
      return res.status(400).json({ success: false, message: 'upz_id wajib disertakan.' });
    }

    if (token) {
      try {
        await verifyAdminToken(token);
      } catch (authErr) {
        return res.status(403).json({ success: false, message: authErr.message });
      }
    }

    const configPath = path.join(process.cwd(), 'rkat_config.json');
    let config = {
      default: {
        persen_penta: 35,
        persen_amil: 5,
        tagihan_salin: 0
      },
      upz_settings: {}
    };

    if (fs.existsSync(configPath)) {
      try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch (_) {}
    }

    if (!config.upz_settings) config.upz_settings = {};

    const currentYear = new Date().getFullYear();
    const currentSetting = config.upz_settings[upz_id] || {};
    const isUnlocked = rkat_unlocked !== undefined ? Boolean(rkat_unlocked) : Boolean(currentSetting.rkat_unlocked);
    const targetYear = isUnlocked ? Number(unlocked_year || currentSetting.unlocked_year || currentYear) : null;

    let cleanSalinBulanan = [];
    if (Array.isArray(salin_bulanan) && salin_bulanan.length > 0) {
      cleanSalinBulanan = salin_bulanan.slice(0, 12).map((item, idx) => ({
        bulan: idx + 1,
        nominal: Math.max(0, Number(item.nominal) || 0),
        transfer: Boolean(item.transfer)
      }));
    } else if (Array.isArray(currentSetting.salin_bulanan) && currentSetting.salin_bulanan.length > 0) {
      cleanSalinBulanan = currentSetting.salin_bulanan;
    } else {
      const sTransfer = Array.isArray(salin_bulan_transfer) ? salin_bulan_transfer.map(Number) : (Array.isArray(currentSetting.salin_bulan_transfer) ? currentSetting.salin_bulan_transfer : []);
      const sNominal = tagihan_salin !== undefined ? Number(tagihan_salin) : (Number(currentSetting.tagihan_salin) || 0);
      for (let m = 1; m <= 12; m++) {
        cleanSalinBulanan.push({
          bulan: m,
          nominal: sNominal,
          transfer: sTransfer.includes(m)
        });
      }
    }

    const transferredMonths = cleanSalinBulanan.filter(x => x.transfer).map(x => x.bulan);
    const totalSalinTransferred = cleanSalinBulanan.filter(x => x.transfer).reduce((sum, x) => sum + x.nominal, 0);

    const updatedSetting = {
      upz_id: upz_id,
      nama_upz: nama_upz || currentSetting.nama_upz || '',
      rkat_unlocked: isUnlocked,
      unlocked_year: targetYear,
      persen_penta: persen_penta !== undefined ? Number(persen_penta) : (currentSetting.persen_penta !== undefined ? currentSetting.persen_penta : 35),
      persen_amil: persen_amil !== undefined ? Number(persen_amil) : (currentSetting.persen_amil !== undefined ? currentSetting.persen_amil : 5),
      tagihan_salin: totalSalinTransferred,
      salin_bulan_transfer: transferredMonths,
      salin_bulanan: cleanSalinBulanan,
      updated_at: new Date().toISOString()
    };

    config.upz_settings[upz_id] = updatedSetting;
    try {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    } catch (_) {}

    const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    if (sKey) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
          method: 'POST',
          headers: {
            'apikey': sKey,
            'Authorization': `Bearer ${sKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'UPDATE_RKAT_CONFIG',
            module: 'rkat_config',
            reference_id: isUuid(upz_id) ? upz_id : null,
            description: JSON.stringify(updatedSetting)
          })
        });
      } catch (auditErr) {
        console.warn('[SAVE-RKAT-CONFIG] audit_logs error:', auditErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Pengaturan RKAT UPZ berhasil disimpan.',
      data: updatedSetting
    });
  } catch (err) {
    console.error('[SAVE-RKAT-CONFIG ERROR]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};
