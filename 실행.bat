@echo off
chcp 65001 >nul
cd /d "%~dp0"

set PORT=8765
set URL=http://127.0.0.1:%PORT%/

where python >nul 2>nul
if errorlevel 1 goto no_python

powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://127.0.0.1:8765/' | Out-Null; exit 0 } catch { exit 1 }" >nul 2>nul
if errorlevel 1 (
  start "간호사 근무표" /min /D "%~dp0" python -m http.server %PORT% --bind 127.0.0.1
  powershell -NoProfile -Command "Start-Sleep -Seconds 1" >nul
)

start "" "%URL%"
goto end

:no_python
start "" "%~dp0index.html"

:end
