@echo off
setlocal
title SmartWaste Waste 2

set "ROOT=%~dp0"
cd /d "%ROOT%"
set "LAN_IP="
for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "Get-NetIPConfiguration -InterfaceAlias 'Wi-Fi' -ErrorAction SilentlyContinue ^| Select-Object -ExpandProperty IPv4Address ^| Select-Object -First 1 -ExpandProperty IPAddress"`) do set "LAN_IP=%%I"

set "XAMPP=C:\xampp"
if not exist "%XAMPP%\mysql_start.bat" (
  echo XAMPP tidak ditemukan di %XAMPP%.
  echo Pastikan XAMPP sudah terpasang, lalu coba lagi.
  pause
  exit /b 1
)

echo Menyalakan MySQL dan Apache XAMPP...
start "SmartWaste MySQL" /min "%XAMPP%\mysql_start.bat"
start "SmartWaste Apache" /min "%XAMPP%\apache_start.bat"

timeout /t 2 /nobreak >nul
start "" "http://localhost/Waste2/frontend/index.html"
echo SmartWaste sudah dijalankan melalui XAMPP.
echo Web user  : http://localhost/Waste2/frontend/index.html
echo API       : http://localhost/Waste2/backend-php/index.php/health
if defined LAN_IP (
  echo URL Wi-Fi : http://%LAN_IP%/Waste2/frontend/index.html
  echo API Wi-Fi : http://%LAN_IP%/Waste2/backend-php/index.php/health
  echo Android BASE_URL: http://%LAN_IP%/Waste2/backend-php/index.php/
) else (
  echo URL Wi-Fi tidak terdeteksi. Pastikan laptop terhubung ke Wi-Fi.
)
echo Android di laptop lain: gunakan IP Wi-Fi laptop ini, bukan 10.0.2.2.
echo.
pause
