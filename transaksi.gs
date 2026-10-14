
function simpanSetoranLengkap(token, profile, data) {
  if (!profile || profile.status !== 'aktif') {
    throw new Error('Akun tidak aktif.');
  }

  if (profile.role !== 'upz' || !profile.upz_id) {
    throw new Error('Hanya akun UPZ aktif yang dapat membuat setoran.');
  }

  if (!data || !Array.isArray(data.detail) || data.detail.length === 0) {
    throw new Error('Rincian Excel belum tersedia.');
  }

  const payload = {
    p_tanggal_setor: data.tanggal_setor,
    p_periode_bulan: Number(data.periode_bulan),
    p_periode_tahun: Number(data.periode_tahun),
    p_nominal: Number(data.nominal),
    p_file_name: data.file_name || null,
    p_file_path: data.file_path || null,
    p_detail: data.detail.map(function (item) {
      return {
        nama_muzaki: String(item.nama_muzaki || '').trim(),
        nominal: Number(item.nominal),
        jenis: item.jenis ? String(item.jenis).trim() : null
      };
    })
  };

  const url =
    CONFIG.SUPABASE_URL +
    '/rest/v1/rpc/simpan_setoran_lengkap';

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: {
      apikey: CONFIG.SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  const responseText = response.getContentText();

  if (status < 200 || status >= 300) {
    throw new Error(
      'Gagal menyimpan transaksi. Supabase HTTP ' +
      status + ': ' + responseText
    );
  }

  const result = JSON.parse(responseText);
  return typeof result === 'string' ? JSON.parse(result) : result;
}


function verifikasiSetoranAdmin(token, setoranId, keputusan, catatan) {
  if (!setoranId) {
    throw new Error('ID setoran wajib diisi.');
  }

  if (!['diterima', 'ditolak'].includes(keputusan)) {
    throw new Error('Keputusan harus diterima atau ditolak.');
  }

  if (keputusan === 'ditolak' && !String(catatan || '').trim()) {
    throw new Error('Catatan wajib diisi jika setoran ditolak.');
  }

  const url =
    CONFIG.SUPABASE_URL +
    '/rest/v1/rpc/verifikasi_setoran_admin';

  const payload = {
    p_setoran_id: setoranId,
    p_keputusan: keputusan,
    p_catatan: catatan || null
  };

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: {
      apikey: CONFIG.SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  const text = response.getContentText();

  if (status < 200 || status >= 300) {
    throw new Error(
      'Gagal memverifikasi setoran. Supabase HTTP ' +
      status + ': ' + text
    );
  }

  const result = JSON.parse(text);
  return typeof result === 'string' ? JSON.parse(result) : result;
}


function getAdminSetoranSummary(token) {
  const url =
    CONFIG.SUPABASE_URL +
    '/rest/v1/setoran' +
    '?select=id,upz_id,tanggal_setor,periode_bulan,periode_tahun,nominal,status,status_kecocokan,catatan,file_name,file_path,created_at' +
    '&order=created_at.desc';

  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      apikey: CONFIG.SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + token
    },
    muteHttpExceptions: true
  });

  const httpStatus = response.getResponseCode();
  const responseText = response.getContentText();

  if (httpStatus !== 200) {
    throw new Error(
      'Gagal mengambil daftar setoran admin. Supabase HTTP ' +
      httpStatus + ': ' + responseText
    );
  }

  return JSON.parse(responseText);
}