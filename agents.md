Kita akan melanjutkan pengembangan project web UPZ BAZNAS Kabupaten Banyumas yang sudah berjalan.

Sebelum melakukan perubahan apa pun, pelajari seluruh struktur repository dan pahami hubungan antara frontend, backend, database, autentikasi, dan penyimpanan file.

Konteks project:
- Frontend menggunakan JavaScript dan terhubung dengan Supabase.
- Deployment frontend menggunakan GitHub dan Vercel.
- Backend memakai endpoint `/api/backend` yang meneruskan aksi ke Google Apps Script.
- Database Supabase menyimpan data UPZ, setoran, dan detail setoran.
- File Excel setoran disimpan di Supabase Storage.
- Terdapat halaman UPZ dan halaman admin dengan hak akses berbeda.

Kondisi terakhir yang sudah berhasil:
- Admin dapat melihat pengajuan setoran.
- Admin dapat menerima atau menolak setoran.
- Proses verifikasi sudah diuji dan berhasil.
- Status setoran meliputi `menunggu`, `diterima`, dan `ditolak`.
- Total nominal setoran di dashboard UPZ dan admin hanya boleh menghitung setoran dengan status `diterima`.
- Setoran berstatus `menunggu` atau `ditolak` tidak boleh menambah total nominal.
- Jumlah transaksi tetap menghitung seluruh pengajuan, kecuali ada aturan lain yang sudah ditetapkan dalam project.

Aturan kerja:
1. Jangan langsung mengubah kode sebelum memahami implementasi yang sudah ada.
2. Jangan menulis ulang seluruh aplikasi jika perubahan lokal sudah cukup.
3. Pertahankan fitur, tampilan, integrasi, dan alur kerja yang sudah berfungsi.
4. Jangan mengubah skema database, kebijakan RLS, RPC, atau konfigurasi deployment tanpa alasan yang jelas.
5. Jangan mengarang nama tabel, kolom, fungsi, endpoint, atau environment variable. Periksa kode dan konfigurasi yang benar-benar ada.
6. Jangan pernah menampilkan atau meminta secret key, password, token, atau kredensial produksi.
7. Sebelum mengubah file, jelaskan temuan dan rencana perubahan.
8. Setelah perubahan, periksa kemungkinan error, dampak terhadap fitur lain, dan cara pengujian.
9. Utamakan solusi yang sederhana dan mudah dipelihara.

Tugas pertama:
Lakukan audit awal tanpa mengubah file. Jelaskan:
- Struktur project dan fungsi setiap file penting.
- Alur login dan autentikasi.
- Alur pengajuan, penyimpanan, dan verifikasi setoran.
- Cara dashboard menghitung nominal setoran.
- Integrasi Supabase, Google Apps Script, dan Vercel.
- Fitur yang sudah ada, potensi masalah, dan bagian yang perlu dikonfirmasi.

Akhiri dengan ringkasan kondisi project dan rekomendasi langkah berikutnya. Jangan mulai implementasi sampai saya menyetujuinya.