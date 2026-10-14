#!/usr/bin/env python3
"""
Script Import Massal Akun UPZ ke Supabase
BAZNAS Kabupaten Banyumas

Fitur:
- Murni menggunakan library bawaan Python (Standard Library: zipfile, xml, urllib, concurrent.futures)
- Tidak butuh 'pip install' apapun
- Tidak menghapus akun admin atau user testing yang sudah ada di Supabase
- Idempotent: jika akun sudah pernah dibuat, otomatis diskip / diupdate tanpa error duplikat
- Cepat: menggunakan multi-threading (5 worker bersamaan)
- Dilengkapi mode --dry-run untuk uji coba tanpa mengubah data di Supabase
"""

import os
import sys
import json
import zipfile
import xml.etree.ElementTree as ET
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

SUPABASE_URL = "https://efmgvgqyzdbhmejigqyg.supabase.co"
EXCEL_PATH = os.path.join(os.path.dirname(__file__), "WEB UPZ.xlsx")

# Thread-safe counters
lock = threading.Lock()
stats = {
    "total": 0,
    "success": 0,
    "skipped": 0,
    "failed": 0,
    "errors": []
}

def load_env():
    """Membaca file .env sederhana jika ada"""
    env_file = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_file):
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ[key.strip()] = val.strip().strip("'\"")

def read_excel_rows(file_path):
    """Membaca isi file WEB UPZ.xlsx menggunakan zipfile & XML bawaan Python"""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File {file_path} tidak ditemukan!")

    with zipfile.ZipFile(file_path, "r") as z:
        # 1. Ambil shared strings
        shared_strings = []
        if "xl/sharedStrings.xml" in z.namelist():
            sst_tree = ET.fromstring(z.read("xl/sharedStrings.xml"))
            for si in sst_tree.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si"):
                t = "".join([elem.text for elem in si.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t") if elem.text])
                shared_strings.append(t)

        # 2. Ambil data sheet1
        sheet_tree = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
        ns = {"ns": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
        rows = sheet_tree.findall(".//ns:row", ns)

        data = []
        for idx, r in enumerate(rows):
            if idx == 0:
                continue  # Lewati header (baris 1)

            cells = {}
            for c in r.findall("ns:c", ns):
                ref = c.attrib.get("r", "")
                col = "".join([ch for ch in ref if ch.isalpha()])
                t = c.attrib.get("t")
                v_elem = c.find("ns:v", ns)
                val = v_elem.text if v_elem is not None else ""
                if t == "s" and val.isdigit():
                    idx_val = int(val)
                    if idx_val < len(shared_strings):
                        val = shared_strings[idx_val]
                cells[col] = val.strip()

            row_num = r.attrib.get("r", str(idx + 1))
            nama_upz = cells.get("A", "")
            nama_lengkap = cells.get("B", "") or "PIC"
            password = cells.get("C", "")
            kode = cells.get("D", "")
            email = cells.get("E", "").lower()
            role = cells.get("F", "upz").lower()
            kategori = cells.get("G", "")
            keterangan = cells.get("H", "")

            if nama_upz and email:
                data.append({
                    "row_num": row_num,
                    "nama_upz": nama_upz,
                    "nama_lengkap": nama_lengkap,
                    "password": password,
                    "kode": kode,
                    "email": email,
                    "role": role,
                    "kategori": kategori,
                    "keterangan": keterangan
                })
        return data

def api_request(method, endpoint, payload=None, service_role_key="", prefer=None):
    """Fungsi pembantu HTTP request ke Supabase REST / Auth API"""
    url = f"{SUPABASE_URL}{endpoint}"
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
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
            err_json = json.loads(err_body)
        except Exception:
            err_json = {"raw": err_body}
        return err_json, e.code
    except Exception as e:
        return {"error": str(e)}, 500

def process_single_upz(item, service_role_key, dry_run=False):
    """Memproses 1 akun: buat user auth -> buat/cek upz -> simpan profil"""
    email = item["email"]
    password = item["password"]
    nama_upz = item["nama_upz"]
    nama_lengkap = item["nama_lengkap"]
    kode = item["kode"]
    kategori = item["kategori"]
    row_num = item["row_num"]

    if dry_run:
        with lock:
            stats["success"] += 1
            print(f"[{stats['success']}/{stats['total']}] [DRY-RUN] Valid: {email} | {nama_upz} ({kategori})")
        return

    try:
        user_id = None
        # 1. BUAT AUTH USER DI SUPABASE
        user_payload = {
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {
                "nama_lengkap": nama_lengkap
            }
        }
        auth_res, auth_status = api_request("POST", "/auth/v1/admin/users", user_payload, service_role_key)

        if auth_status in (200, 201):
            user_id = auth_res.get("id")
        elif auth_status == 422:
            # Akun kemungkinan sudah terdaftar sebelumnya
            msg = auth_res.get("message") or auth_res.get("msg") or str(auth_res)
            if "already" in msg.lower() or "registered" in msg.lower():
                # Cari user ID yang sudah ada dari profiles
                find_res, find_status = api_request("GET", f"/rest/v1/profiles?email=eq.{urllib.parse.quote(email)}&select=id,upz_id", None, service_role_key)
                if find_status == 200 and isinstance(find_res, list) and len(find_res) > 0:
                    user_id = find_res[0].get("id")
                else:
                    # Lewati jika sudah ada tapi tidak bisa diupdate
                    with lock:
                        stats["skipped"] += 1
                        print(f"[-] [SKIP] Baris {row_num}: {email} sudah terdaftar di Supabase Auth.")
                    return
            else:
                raise Exception(f"Gagal buat auth: {msg}")
        else:
            raise Exception(f"Gagal buat auth (HTTP {auth_status}): {auth_res}")

        if not user_id:
            raise Exception("User ID Supabase tidak didapatkan.")

        # 2. CEK / INSERT MASTER DATA UPZ
        upz_id = None
        # Cek apakah data UPZ dengan nama atau kode ini sudah ada di tabel upz
        check_query = f"/rest/v1/upz?nama_upz=eq.{urllib.parse.quote(nama_upz)}&select=id"
        check_res, check_status = api_request("GET", check_query, None, service_role_key)
        if check_status == 200 and isinstance(check_res, list) and len(check_res) > 0:
            upz_id = check_res[0].get("id")
        else:
            # Coba insert dengan kode_upz
            upz_payload = {
                "nama_upz": nama_upz,
                "kode_upz": kode,
                "kategori": kategori,
                "status": "aktif"
            }
            ins_res, ins_status = api_request("POST", "/rest/v1/upz", upz_payload, service_role_key, prefer="return=representation")
            if ins_status in (200, 201) and isinstance(ins_res, list) and len(ins_res) > 0:
                upz_id = ins_res[0].get("id")
            elif ins_status == 400:
                # Jika kolom kode_upz belum ada di skema, fallback tanpa kode_upz
                upz_payload.pop("kode_upz", None)
                ins_res2, ins_status2 = api_request("POST", "/rest/v1/upz", upz_payload, service_role_key, prefer="return=representation")
                if ins_status2 in (200, 201) and isinstance(ins_res2, list) and len(ins_res2) > 0:
                    upz_id = ins_res2[0].get("id")
                else:
                    raise Exception(f"Gagal insert tabel upz: {ins_res2}")
            else:
                raise Exception(f"Gagal insert tabel upz: {ins_res}")

        # 3. UPSERT KE TABEL PROFILES
        prof_payload = {
            "id": user_id,
            "nama_lengkap": nama_lengkap,
            "role": "upz",
            "status": "aktif",
            "upz_id": upz_id,
            "email": email
        }
        prof_res, prof_status = api_request("POST", "/rest/v1/profiles", prof_payload, service_role_key, prefer="resolution=merge-duplicates")
        if prof_status not in (200, 201, 204):
            # Coba tanpa kolom email jika tabel profiles tidak punya kolom email
            prof_payload.pop("email", None)
            prof_res2, prof_status2 = api_request("POST", "/rest/v1/profiles", prof_payload, service_role_key, prefer="resolution=merge-duplicates")
            if prof_status2 not in (200, 201, 204):
                raise Exception(f"Gagal upsert profiles: {prof_res2}")

        with lock:
            stats["success"] += 1
            idx = stats["success"] + stats["skipped"] + stats["failed"]
            print(f"[{idx}/{stats['total']}] [OK] {email} -> {nama_upz}")

    except Exception as e:
        with lock:
            stats["failed"] += 1
            err_msg = f"Baris {row_num} ({email}): {str(e)}"
            stats["errors"].append(err_msg)
            print(f"[X] [GAGAL] {err_msg}")

def main():
    print("=" * 65)
    print("      IMPORT MASSAL AKUN UPZ BAZNAS KABUPATEN BANYUMAS       ")
    print("=" * 65)

    dry_run = "--dry-run" in sys.argv
    if dry_run:
        print("[INFO] Berjalan dalam mode DRY-RUN (tidak mengirim ke database).\n")

    # Ambil key dari .env atau environment
    load_env()
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()

    if not dry_run and not service_role_key:
        print("\n[PERHATIAN] SERVICE_ROLE_KEY Supabase belum terdeteksi.")
        print("Silakan masukkan Service Role Key Supabase Anda:")
        print("(Dapat dilihat di: Dashboard Supabase -> Project Settings -> API -> service_role)")
        service_role_key = input("Key: ").strip()

    if not dry_run and not service_role_key:
        print("[ERROR] Service Role Key wajib diisi untuk melakukan import. Dibatalkan.")
        sys.exit(1)

    print(f"\n[1/3] Membaca file: {EXCEL_PATH}...")
    try:
        items = read_excel_rows(EXCEL_PATH)
    except Exception as e:
        print(f"[ERROR] Gagal membaca Excel: {e}")
        sys.exit(1)

    stats["total"] = len(items)
    print(f"[2/3] Ditemukan {stats['total']} baris data UPZ siap diproses.")

    if not dry_run:
        print(f"[3/3] Memulai import massal ke Supabase (5 threads simultan)...")
        print("      *Catatan: Akun admin dan user testing yang sudah ada TIDAK AKAN disentuh.*")
        print("-" * 65)
    else:
        print(f"[3/3] Simulasi validasi data...")
        print("-" * 65)

    # Jalankan dengan ThreadPoolExecutor
    workers = 1 if dry_run else 5
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(process_single_upz, item, service_role_key, dry_run) for item in items]
        for f in as_completed(futures):
            pass

    print("-" * 65)
    print("\n" + "=" * 65)
    print("                        HASIL IMPORT                         ")
    print("=" * 65)
    print(f"Total Baris   : {stats['total']}")
    print(f"Berhasil      : {stats['success']}")
    print(f"Dilewati      : {stats['skipped']} (akun sudah ada sebelumnya)")
    print(f"Gagal         : {stats['failed']}")

    if stats["errors"]:
        print("\nRincian Error:")
        for err in stats["errors"][:10]:
            print(f" - {err}")
        if len(stats["errors"]) > 10:
            print(f" ...dan {len(stats['errors']) - 10} error lainnya.")
    else:
        print("\nStatus: SEMUA PROSES BERJALAN LANCAR!")
    print("=" * 65)

if __name__ == "__main__":
    main()
