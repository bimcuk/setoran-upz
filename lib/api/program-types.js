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

const DEFAULT_PROGRAMS = [
  { id: 'prog-1', name: 'Banyumas Peduli (Kemanusiaan & Bencana)', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'prog-2', name: 'Banyumas Makmur (Pemberdayaan Ekonomi)', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'prog-3', name: 'Banyumas Cerdas (Beasiswa & Pendidikan)', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'prog-4', name: 'Banyumas Sehat (Bantuan Layanan Kesehatan)', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'prog-5', name: 'Banyumas Dakwah & Advokasi', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'prog-6', name: 'BAZNAS Tanggap Bencana (BTB)', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'prog-7', name: 'Program Infaq Khusus / Terikat', created_at: '2026-01-01T00:00:00.000Z' }
];

function getConfigFile() {
  return path.join(process.cwd(), 'program_types.json');
}

function getNextProgramId(programs) {
  const used = new Set();
  (programs || []).forEach(p => {
    const m = String(p.id || '').match(/^prog-(\d+)$/);
    if (m) used.add(parseInt(m[1], 10));
  });
  let n = 1;
  while (used.has(n)) {
    n++;
  }
  return `prog-${n}`;
}

function sortPrograms(programs) {
  return (programs || []).slice().sort((a, b) => {
    const numA = parseInt((String(a.id || '').match(/^prog-(\d+)$/) || [0, 999999])[1], 10);
    const numB = parseInt((String(b.id || '').match(/^prog-(\d+)$/) || [0, 999999])[1], 10);
    return numA - numB;
  });
}

function loadLocalPrograms() {
  const file = getConfigFile();
  if (fs.existsSync(file)) {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Array.isArray(data) && data.length > 0) return sortPrograms(data);
    } catch (_) {}
  }
  return sortPrograms(DEFAULT_PROGRAMS.slice());
}

function saveLocalPrograms(programs) {
  try {
    const sorted = sortPrograms(programs);
    fs.writeFileSync(getConfigFile(), JSON.stringify(sorted, null, 2), 'utf8');
  } catch (_) {}
}

async function verifyAdmin(token) {
  if (!token) throw new Error('Token otentikasi diperlukan.');
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`
    }
  });
  if (!userRes.ok) throw new Error('Sesi kedaluwarsa. Silakan login kembali.');
  const user = await userRes.json();

  const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  const pRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=role,status&id=eq.${encodeURIComponent(user.id)}`, {
    headers: {
      'apikey': sKey,
      'Authorization': `Bearer ${sKey}`
    }
  });
  const profiles = await pRes.json();
  if (!Array.isArray(profiles) || !profiles.length || profiles[0].role !== 'admin') {
    throw new Error('Hanya admin yang berwenang mengelola master jenis program.');
  }
  return user;
}

module.exports = async function handler(req, res) {
  const method = req.method;

  // GET: Ambil daftar program
  if (method === 'GET') {
    try {
      let programs = loadLocalPrograms();
      const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
      if (sKey) {
        try {
          const aRes = await fetch(
            `${SUPABASE_URL}/rest/v1/audit_logs?module=eq.program_master&order=created_at.asc`,
            {
              headers: { 'apikey': sKey, 'Authorization': `Bearer ${sKey}` }
            }
          );
          if (aRes.ok) {
            const logs = await aRes.json();
            if (Array.isArray(logs) && logs.length > 0) {
              const progMap = new Map();
              programs.forEach(p => progMap.set(p.id, p));

              logs.forEach(l => {
                try {
                  const d = typeof l.description === 'string' ? JSON.parse(l.description) : l.description;
                  if (!d) return;
                  if (l.action === 'ADD_PROGRAM' && d.id && d.name) {
                    progMap.set(d.id, d);
                  } else if (l.action === 'DELETE_PROGRAM' && d.id) {
                    progMap.delete(d.id);
                  }
                } catch (_) {}
              });
              programs = Array.from(progMap.values());
              saveLocalPrograms(programs);
            }
          }
        } catch (supabaseErr) {
          console.warn('[PROGRAM-TYPES] Supabase audit fetch notice:', supabaseErr.message);
        }
      }

      return res.status(200).json({ success: true, programs });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // POST: Tambah atau hapus program (Role Admin)
  if (method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (_) { body = {}; }
      }

      const { token, action, name, id } = body || {};
      await verifyAdmin(token);

      let programs = loadLocalPrograms();

      if (action === 'delete') {
        if (!id) return res.status(400).json({ success: false, message: 'ID program wajib diisi untuk menghapus.' });
        programs = sortPrograms(programs.filter(p => p.id !== id));

        // Rekam ke Supabase audit_logs
        const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
        if (sKey) {
          await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
            method: 'POST',
            headers: { 'apikey': sKey, 'Authorization': `Bearer ${sKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'DELETE_PROGRAM',
              module: 'program_master',
              description: JSON.stringify({ id, deleted_at: new Date().toISOString() })
            })
          }).catch(() => {});
        }
      } else {
        // Add program
        const trimmedName = String(name || '').trim();
        if (!trimmedName) {
          return res.status(400).json({ success: false, message: 'Nama program tidak boleh kosong.' });
        }
        const exists = programs.some(p => p.name.toLowerCase() === trimmedName.toLowerCase());
        if (exists) {
          return res.status(400).json({ success: false, message: 'Jenis program sudah terdaftar.' });
        }

        const nextId = getNextProgramId(programs);
        const newProgram = {
          id: nextId,
          name: trimmedName,
          created_at: new Date().toISOString()
        };
        programs.push(newProgram);
        programs = sortPrograms(programs);

        // Rekam ke Supabase audit_logs
        const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
        if (sKey) {
          await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
            method: 'POST',
            headers: { 'apikey': sKey, 'Authorization': `Bearer ${sKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'ADD_PROGRAM',
              module: 'program_master',
              description: JSON.stringify(newProgram)
            })
          }).catch(() => {});
        }
      }

      saveLocalPrograms(programs);
      return res.status(200).json({ success: true, message: 'Data program berhasil diperbarui.', programs });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  return res.status(405).json({ success: false, message: 'Method tidak diizinkan.' });
};
