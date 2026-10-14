@echo off
title Sinkronisasi UPZ ke Supabase
echo Menjalankan sinkronisasi dari WEB UPZ.xlsx ke Supabase...
python "%~dp0sync_upz.py"
echo.
pause
