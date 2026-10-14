@echo off
title Auto-Sync UPZ (Watcher Aktif)
echo Mode Auto-Sync Aktif!
echo Setiap kali Anda Save (Ctrl+S) WEB UPZ.xlsx di Excel, data langsung otomatis tersinkron ke Supabase.
echo.
python "%~dp0sync_upz.py" --watch
pause
