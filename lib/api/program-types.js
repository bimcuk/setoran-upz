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
    const m = String(p.id || '').match(/^prog-(\d+)$/i);
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
    const mA = String(a.id || '').match(/(\d+)/);
    const mB = String(b.id || '').match(/(\d+)/);
    const numA = mA ? parseInt(mA[1], 10) : 999999;
    const numB = mB ? parseInt(mB[1], 10) : 999999;
    if (numA !== numB) return numA - numB;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

function loadLocalPrograms() {
  const file = getConfigFile();
  if (fs.existsSync(file)) {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Array.isArray(data)) return sortPrograms(data);
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

async function loadSyncedPrograms() {
  const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  if (sKey) {
    try {
      const aRes = await fetch(
        `${SUPABASE_URL}/rest/v1/audit_logs?module=eq.program_master&order=id.asc`,
        {
          headers: { 'apikey': sKey, 'Authorization': `Bearer ${sKey}` }
        }
      );
      if (aRes.ok) {
        const logs = await aRes.json();
        if (Array.isArray(logs) && logs.length > 0) {
          const progMap = new Map();
          DEFAULT_PROGRAMS.forEach(p => progMap.set(p.id, { ...p }));

          logs.forEach(l => {
            try {
              const d = typeof l.description === 'string' ? JSON.parse(l.description) : l.description;
              if (!d) return;

              if (Array.isArray(d.programs)) {
                progMap.clear();
                d.programs.forEach(item => {
                  if (item && item.id && item.name) {
                    progMap.set(item.id, item);
                  }
                });
                return;
              }

              if (l.action === 'ADD_PROGRAM' && d.id && d.name) {
                progMap.set(d.id, {
                  id: d.id,
                  name: d.name,
                  created_at: d.created_at || l.created_at || new Date().toISOString()
                });
              } else if (l.action === 'DELETE_PROGRAM' && d.id) {
                progMap.delete(d.id);
              } else if ((l.action === 'EDIT_PROGRAM' || l.action === 'UPDATE_PROGRAM') && d.id && d.name) {
                const prev = (d.old_id && progMap.get(d.old_id)) || progMap.get(d.id) || {};
                if (d.old_id && d.old_id !== d.id) {
                  progMap.delete(d.old_id);
                }
                progMap.set(d.id, {
                  id: d.id,
                  name: d.name,
                  created_at: prev.created_at || d.created_at || l.created_at || new Date().toISOString(),
                  updated_at: d.updated_at || l.created_at || new Date().toISOString()
                });
              }
            } catch (_) {}
          });

          const synced = sortPrograms(Array.from(progMap.values()));
          saveLocalPrograms(synced);
          return synced;
        }
      }
    } catch (supabaseErr) {
      console.warn('[PROGRAM-TYPES] Supabase audit fetch notice:', supabaseErr.message);
    }
  }
  return loadLocalPrograms();
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
      const programs = await loadSyncedPrograms();
      return res.status(200).json({ success: true, programs });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // POST: Tambah, edit, atau hapus program (Role Admin)
  if (method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (_) { body = {}; }
      }

      const { token, action, name, id, old_id, new_id } = body || {};
      const adminUser = await verifyAdmin(token);

      let programs = await loadSyncedPrograms();
      const sKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

      if (action === 'delete') {
        if (!id) return res.status(400).json({ success: false, message: 'ID program wajib diisi untuk menghapus.' });
        programs = sortPrograms(programs.filter(p => p.id !== id));

        if (sKey) {
          await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
            method: 'POST',
            headers: { 'apikey': sKey, 'Authorization': `Bearer ${sKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'DELETE_PROGRAM',
              module: 'program_master',
              user_id: adminUser.id || null,
              description: JSON.stringify({
                id,
                deleted_at: new Date().toISOString(),
                programs
              })
            })
          }).catch(() => {});
        }
      } else if (action === 'edit') {
        const targetOldId = String(old_id || id || '').trim();
        const targetNewId = String(new_id || id || '').trim();
        const trimmedName = String(name || '').trim();

        if (!targetOldId) {
          return res.status(400).json({ success: false, message: 'ID program asal tidak ditemukan.' });
        }
        if (!targetNewId) {
          return res.status(400).json({ success: false, message: 'ID program tidak boleh kosong (Contoh: prog-1).' });
        }
        if (!trimmedName) {
          return res.status(400).json({ success: false, message: 'Nama program tidak boleh kosong.' });
        }

        const idx = programs.findIndex(p => p.id === targetOldId);
        if (idx === -1) {
          return res.status(404).json({ success: false, message: `Program dengan ID "${targetOldId}" tidak ditemukan.` });
        }

        const duplicateId = programs.some((p, i) => i !== idx && String(p.id).toLowerCase() === targetNewId.toLowerCase());
        if (duplicateId) {
          return res.status(400).json({ success: false, message: `ID program "${targetNewId}" sudah digunakan oleh program lain.` });
        }

        const duplicateName = programs.some((p, i) => i !== idx && String(p.name).toLowerCase() === trimmedName.toLowerCase());
        if (duplicateName) {
          return res.status(400).json({ success: false, message: `Nama program "${trimmedName}" sudah terdaftar.` });
        }

        const oldProg = programs[idx];
        const updatedProg = {
          ...oldProg,
          id: targetNewId,
          name: trimmedName,
          updated_at: new Date().toISOString()
        };
        programs[idx] = updatedProg;
        programs = sortPrograms(programs);

        if (sKey) {
          await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
            method: 'POST',
            headers: { 'apikey': sKey, 'Authorization': `Bearer ${sKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'EDIT_PROGRAM',
              module: 'program_master',
              user_id: adminUser.id || null,
              description: JSON.stringify({
                old_id: oldProg.id,
                id: updatedProg.id,
                old_name: oldProg.name,
                name: updatedProg.name,
                updated_at: updatedProg.updated_at,
                programs
              })
            })
          }).catch(() => {});

          // Sinkronkan juga ke tabel setoran di Supabase jika nama program berubah
          if (oldProg.name && oldProg.name !== updatedProg.name) {
            try {
              const oldFileName = `[PROGRAM] ${oldProg.name}`;
              const newFileName = `[PROGRAM] ${updatedProg.name}`;
              await fetch(
                `${SUPABASE_URL}/rest/v1/setoran?file_name=eq.${encodeURIComponent(oldFileName)}`,
                {
                  method: 'PATCH',
                  headers: { 'apikey': sKey, 'Authorization': `Bearer ${sKey}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ file_name: newFileName })
                }
              );
            } catch (_) {}
          }
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

        const customId = String(id || '').trim();
        let finalId = customId || getNextProgramId(programs);
        if (customId) {
          const idExists = programs.some(p => String(p.id).toLowerCase() === customId.toLowerCase());
          if (idExists) {
            return res.status(400).json({ success: false, message: `ID program "${customId}" sudah digunakan.` });
          }
        }

        const newProgram = {
          id: finalId,
          name: trimmedName,
          created_at: new Date().toISOString()
        };
        programs.push(newProgram);
        programs = sortPrograms(programs);

        if (sKey) {
          await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
            method: 'POST',
            headers: { 'apikey': sKey, 'Authorization': `Bearer ${sKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'ADD_PROGRAM',
              module: 'program_master',
              user_id: adminUser.id || null,
              description: JSON.stringify({
                ...newProgram,
                programs
              })
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
