@echo off
title Push ke GitHub bimcuk/setoran-upz
echo =======================================================
echo          MENGIRIM KODE KE GITHUB REPOSITORY            
echo               bimcuk/setoran-upz                       
echo =======================================================
echo.

set "PATH=C:\Program Files\Git\mingw64\bin;C:\Program Files\Git\cmd;%PATH%"

echo Menyiapkan file yang berubah...
git add -A
git diff --cached --quiet
if errorlevel 1 (
    echo Ditemukan perubahan file, membuat commit otomatis...
    git commit -m "update: sinkronisasi otomatis via push_to_github.bat"
) else (
    echo Tidak ada perubahan file baru untuk di-commit.
)

echo.
echo Menjalankan git push ke branch main...
git push origin main

echo.
echo =======================================================
echo Selesai! Cek pesan di atas.
echo =======================================================
pause
