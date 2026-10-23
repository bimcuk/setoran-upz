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

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method tidak diizinkan.' });
  }

  try {
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

    const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    if (sKey) {
      try {
        const aRes = await fetch(
          `${SUPABASE_URL}/rest/v1/audit_logs?module=eq.rkat_config&order=created_at.asc`,
          {
            headers: {
              'apikey': sKey,
              'Authorization': `Bearer ${sKey}`
            }
          }
        );
        if (aRes.ok) {
          const logs = await aRes.json();
          if (Array.isArray(logs)) {
            logs.forEach(l => {
              try {
                const p = typeof l.description === 'string' ? JSON.parse(l.description) : l.description;
                if (p && p.upz_id) {
                  if (!config.upz_settings) config.upz_settings = {};
                  config.upz_settings[p.upz_id] = Object.assign(
                    config.upz_settings[p.upz_id] || {},
                    p
                  );
                }
              } catch (_) {}
            });
          }
        }
      } catch (dbErr) {
        console.warn('[RKAT-CONFIG] Sync warning:', dbErr.message);
      }
    }

    // Auto-lock jika tahun telah berganti (RKAT berlaku 1 tahun berjalan)
    const currentYear = new Date().getFullYear();
    let hasExpired = false;
    if (config.upz_settings) {
      Object.keys(config.upz_settings).forEach(uid => {
        const s = config.upz_settings[uid];
        if (s && s.rkat_unlocked) {
          const unlockedYear = s.unlocked_year || (s.updated_at ? new Date(s.updated_at).getFullYear() : null);
          if (unlockedYear && Number(unlockedYear) !== currentYear) {
            s.rkat_unlocked = false;
            s.expired_year = Number(unlockedYear);
            s.unlocked_year = null;
            hasExpired = true;
          } else if (!s.unlocked_year && unlockedYear) {
            s.unlocked_year = Number(unlockedYear);
          }
        }
      });
      if (hasExpired) {
        try {
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        } catch (_) {}
      }
    }

    return res.status(200).json({ success: true, data: config });
  } catch (err) {
    console.error('[RKAT-CONFIG ERROR]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};
