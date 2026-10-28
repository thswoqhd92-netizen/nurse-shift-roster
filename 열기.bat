@echo off
chcp 65001 >nul
cd /d "%~dp0"

powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://127.0.0.1:8765/' | Out-Null; exit 0 } catch { exit 1 }" >nul 2>nul
if %errorlevel%==0 (
  start "" "http://127.0.0.1:8765/"
) else (
  start "" "%~dp0index.html"
)
