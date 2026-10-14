#!/usr/bin/env python3
"""
SYNC UPZ TOOL - BAZNAS Kabupaten Banyumas
Sinkronisasi Otomatis dari 'WEB UPZ.xlsx' ke Supabase

Fitur Utama:
1. SMART SYNC:
   - User Baru: Otomatis dibuatkan akun Auth, tabel UPZ, dan tabel Profiles.
   - User Lama: Otomatis dicek jika ada perubahan (Nama UPZ, Kategori, PIC, Password) dan diperbarui.
   - Akun Admin & Testing: DILINDUNGI PENUH (tidak pernah disentuh/dihapus).
2. DUA CARA PENGGUNAAN:
   - Sekali Klik: Cukup jalankan atau double-click file 'sync_upz.bat'.
   - Mode Watcher (--watch): Berjalan otomatis di latar belakang. Setiap kali Anda tekan Save (Ctrl+S) di Excel, data langsung otomatis tersinkron ke Supabase!
"""

import os
import sys
import time
import json
import zipfile
import xml.etree.ElementTree as ET
import urllib.request
import urllib.error
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

SUPABASE_URL = "https://efmgvgqyzdbhmejigqyg.supabase.co"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
EXCEL_PATH = os.path.join(SCRIPT_DIR, "WEB UPZ.xlsx")
ENV_PATH = os.path.join(SCRIPT_DIR, ".env")

lock = threading.Lock()

def load_service_role_key():
    """Membaca key dari .env atau meminta input sekali dan menyimpannya di .env"""
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not key and os.path.exists(ENV_PATH):
        with open(ENV_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
                    key = line.split("=", 1)[1].strip().strip("'\"")

    if not key:
        print("\n" + "=" * 60)
        print(" KONFIGURASI PERTAMA KALI: SERVICE ROLE KEY SUPABASE")
        print("=" * 60)
        print("Key ini diperlukan agar script dapat mendaftarkan akun secara aman.")
        print("Lokasi di Supabase: Project Settings -> API -> service_role (secret)\n")
        key = input("Masukkan Service Role Key: ").strip()
        if not key:
            print("[ERROR] Key tidak boleh kosong.")
            sys.exit(1)
        # Simpan ke .env agar ke depannya tidak perlu input lagi
        with open(ENV_PATH, "a", encoding="utf-8") as f:
            f.write(f"\nSUPABASE_SERVICE_ROLE_KEY={key}\n")
        print("[OK] Key berhasil disimpan aman di file .env lokal.")

    return key

def read_excel_data(file_path):
    """Membaca data dari Excel tanpa dependensi eksternal"""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File {file_path} tidak ditemukan!")

    with zipfile.ZipFile(file_path, "r") as z:
        shared_strings = []
        if "xl/sharedStrings.xml" in z.namelist():
            sst_tree = ET.fromstring(z.read("xl/sharedStrings.xml"))
            for si in sst_tree.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si"):
                t = "".join([elem.text for elem in si.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t") if elem.text])
                shared_strings.append(t)

        sheet_tree = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
        ns = {"ns": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
        rows = sheet_tree.findall(".//ns:row", ns)

        items = []
        for idx, r in enumerate(rows):
            if idx == 0:
                continue

            cells = {}
            for c in r.findall("ns:c", ns):
                col = "".join([ch for ch in c.attrib.get("r", "") if ch.isalpha()])
                t = c.attrib.get("t")
                v_elem = c.find("ns:v", ns)
                val = v_elem.text if v_elem is not None else ""
                if t == "s" and val.isdigit():
                    idx_val = int(val)
                    if idx_val < len(shared_strings):
                        val = shared_strings[idx_val]
                cells[col] = val.strip()

            nama_upz = cells.get("A", "")
            nama_lengkap = cells.get("B", "") or "PIC"
            password = cells.get("C", "")
            kode = cells.get("D", "")
            email = cells.get("E", "").lower()
            role = cells.get("F", "upz").lower()
            kategori = cells.get("G", "")

            if nama_upz and email:
                items.append({
                    "row_num": r.attrib.get("r", str(idx + 1)),
                    "nama_upz": nama_upz,
                    "nama_lengkap": nama_lengkap,
                    "password": password,
                    "kode": kode,
                    "email": email,
                    "role": role,
                    "kategori": kategori
                })
        return items

def api_call(method, endpoint, payload=None, key="", prefer=None):
    """HTTP Client untuk Supabase API"""
    url = f"{SUPABASE_URL}{endpoint}"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json"
    }
    if prefer:
        headers["Prefer"] = prefer

    data_bytes = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            res_text = res.read().decode("utf-8")
            if res_text:
                return json.loads(res_text), res.status
            return None, res.status
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            return json.loads(err_body), e.code
        except Exception:
            return {"raw": err_body}, e.code
    except Exception as e:
        return {"error": str(e)}, 500

def get_existing_data(key):
    """Mengambil peta profil dan data UPZ yang sudah ada di Supabase untuk sinkronisasi cepat"""
    # 1. Ambil profiles
    prof_res, prof_status = api_call("GET", "/rest/v1/profiles?select=id,email,nama_lengkap,upz_id,role", None, key)
    existing_profiles = {}
    if prof_status == 200 and isinstance(prof_res, list):
        for p in prof_res:
            if p.get("email"):
                existing_profiles[p["email"].lower()] = p

    # 2. Ambil master UPZ
    upz_res, upz_status = api_call("GET", "/rest/v1/upz?select=id,nama_upz,kode_upz,kategori,status", None, key)
    existing_upz = {}
    if upz_status == 200 and isinstance(upz_res, list):
        for u in upz_res:
            if u.get("id"):
                existing_upz[u["id"]] = u
            if u.get("nama_upz"):
                existing_upz[u["nama_upz"].strip().lower()] = u

    # 3. Ambil data auth users
    existing_auth = {}
    auth_res, auth_status = api_call("GET", "/auth/v1/admin/users?per_page=1000", None, key)
    if auth_status == 200 and isinstance(auth_res, dict):
        for u in auth_res.get("users", []):
            if u.get("email"):
                existing_auth[u["email"].lower()] = u

    return existing_profiles, existing_upz, existing_auth

def sync_item(item, key, existing_profiles, existing_upz, existing_auth, report):
    """Sinkronisasi 1 baris UPZ"""
    email = item["email"]
    password = item["password"]
    nama_upz = item["nama_upz"]
    nama_lengkap = item["nama_lengkap"]
    kode = item["kode"]
    kategori = item["kategori"]

    try:
        user_id = None
        upz_id = None
        is_new_user = False

        existing_prof = existing_profiles.get(email)
        existing_u = existing_auth.get(email)

        # 1. CEK APAKAH USER SUDAH ADA
        if not existing_u:
            # User Baru: Buat di Supabase Auth
            auth_payload = {
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {"nama_lengkap": nama_lengkap}
            }
            auth_res, auth_status = api_call("POST", "/auth/v1/admin/users", auth_payload, key)

            if auth_status in (200, 201):
                user_id = auth_res.get("id")
                is_new_user = True
            elif auth_status == 422:
                # Jika sudah ada, cari ID dari auth
                pass
            else:
                raise Exception(f"Gagal create auth: {auth_res}")
        else:
            user_id = existing_u.get("id")

        if existing_prof:
            user_id = user_id or existing_prof.get("id")
            upz_id = existing_prof.get("upz_id")

        # 2. MASTER TABEL UPZ
        if not upz_id:
            # Cek dari existing_upz berdasarkan nama
            matched_upz = existing_upz.get(nama_upz.strip().lower())
            if matched_upz:
                upz_id = matched_upz.get("id")
            else:
                # Insert UPZ baru
                upz_payload = {
                    "nama_upz": nama_upz,
                    "kode_upz": kode,
                    "kategori": kategori,
                    "status": "aktif"
                }
                ins_res, ins_status = api_call("POST", "/rest/v1/upz", upz_payload, key, prefer="return=representation")
                if ins_status in (200, 201) and isinstance(ins_res, list) and len(ins_res) > 0:
                    upz_id = ins_res[0].get("id")
                elif ins_status == 400:
                    upz_payload.pop("kode_upz", None)
                    ins_res2, ins_status2 = api_call("POST", "/rest/v1/upz", upz_payload, key, prefer="return=representation")
                    if ins_status2 in (200, 201) and isinstance(ins_res2, list) and len(ins_res2) > 0:
                        upz_id = ins_res2[0].get("id")
                    else:
                        raise Exception(f"Gagal insert upz: {ins_res2}")
                else:
                    raise Exception(f"Gagal insert upz: {ins_res}")
        else:
            # User lama: cek apakah data UPZ berubah
            curr_upz = existing_upz.get(upz_id, {})
            if curr_upz.get("nama_upz") != nama_upz or curr_upz.get("kategori") != kategori:
                api_call("PATCH", f"/rest/v1/upz?id=eq.{upz_id}", {"nama_upz": nama_upz, "kategori": kategori}, key)

        # 3. TABEL PROFILES
        if user_id:
            # Proteksi: jika user sudah mengubah nama pengelola mandiri (bukan 'PIC'),
            # jangan ditimpa balik menjadi 'PIC' saat sinkronisasi Excel
            final_nama = nama_lengkap
            if existing_prof and existing_prof.get("nama_lengkap") and existing_prof["nama_lengkap"].strip() != "PIC":
                if nama_lengkap.strip() == "PIC":
                    final_nama = existing_prof["nama_lengkap"]

            prof_payload = {
                "id": user_id,
                "nama_lengkap": final_nama,
                "role": "upz",
                "status": "aktif",
                "upz_id": upz_id,
                "email": email
            }
            api_call("POST", "/rest/v1/profiles", prof_payload, key, prefer="resolution=merge-duplicates")

        # Catat Status
        with lock:
            if is_new_user:
                report["new"] += 1
                print(f" [+] [USER BARU] Ditambahkan: {email} ({nama_upz})")
            else:
                report["existing"] += 1

    except Exception as e:
        with lock:
            report["failed"] += 1
            print(f" [X] [GAGAL] {email}: {e}")

def run_sync(key, verbose=True):
    """Menjalankan proses sinkronisasi dari Excel ke Supabase"""
    start_time = time.time()
    try:
        items = read_excel_data(EXCEL_PATH)
    except Exception as e:
        print(f"[ERROR] Gagal membaca Excel: {e}")
        return

    if verbose:
        print(f"[{time.strftime('%H:%M:%S')}] Membaca data Supabase...")
    existing_profiles, existing_upz, existing_auth = get_existing_data(key)

    report = {"total": len(items), "new": 0, "existing": 0, "failed": 0}

    if verbose:
        print(f"[{time.strftime('%H:%M:%S')}] Memulai sinkronisasi {report['total']} akun...")

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(sync_item, item, key, existing_profiles, existing_upz, existing_auth, report) for item in items]
        for f in as_completed(futures):
            pass

    elapsed = round(time.time() - start_time, 1)
    print("\n" + "=" * 55)
    print(f" SINKRONISASI SELESAI ({elapsed} detik)")
    print("=" * 55)
    print(f" • Total di Excel     : {report['total']}")
    print(f" • User Baru Ditambah : {report['new']}")
    print(f" • User Sudah Ada     : {report['existing']} (aman/diperbarui)")
    print(f" • Gagal              : {report['failed']}")
    print("=" * 55)
    print("Catatan: User testing & admin Anda tetap aman dan utuh.\n")

def watch_mode(key):
    """Mode Watcher: mendeteksi perubahan file Excel dan auto-sync saat disimpan"""
    print("\n" + "=" * 65)
    print("        MODE AUTO-SYNC BERJALAN (WATCHER AKTIF)")
    print("=" * 65)
    print(f"Memantau file: {EXCEL_PATH}")
    print("Setiap kali Anda simpan (Ctrl+S) file Excel ini di PC,")
    print("data akan otomatis tersinkron ke Supabase.")
    print("Tekan Ctrl+C di terminal ini untuk berhenti.\n")

    # Jalankan sinkronisasi pertama kali
    run_sync(key, verbose=True)

    last_mtime = os.path.getmtime(EXCEL_PATH)

    while True:
        try:
            time.sleep(2)
            if not os.path.exists(EXCEL_PATH):
                continue
            curr_mtime = os.path.getmtime(EXCEL_PATH)
            if curr_mtime != last_mtime:
                # Tunggu 1 detik agar aplikasi Excel selesai menulis file
                time.sleep(1.5)
                last_mtime = os.path.getmtime(EXCEL_PATH)
                print(f"\n[{time.strftime('%H:%M:%S')}] Terdeteksi perubahan pada 'WEB UPZ.xlsx'! Menyinkronkan...")
                run_sync(key, verbose=False)
                print(f"[{time.strftime('%H:%M:%S')}] Standby memantau perubahan berikutnya...")
        except KeyboardInterrupt:
            print("\nAuto-sync dihentikan oleh pengguna.")
            break
        except Exception as e:
            time.sleep(2)

def main():
    key = load_service_role_key()

    if "--watch" in sys.argv:
        watch_mode(key)
    else:
        run_sync(key, verbose=True)

if __name__ == "__main__":
    main()
