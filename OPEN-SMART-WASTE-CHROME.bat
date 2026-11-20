@echo off
setlocal
title Smart Waste — Chrome

set "URL=http://localhost/Waste2/frontend/index.html"
set "XAMPP=C:\xampp"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"

if not exist "%XAMPP%\apache_start.bat" (
  echo Apache XAMPP tidak ditemukan di %XAMPP%.
  pause
  exit /b 1
)

if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" (
  echo Google Chrome tidak ditemukan.
  pause
  exit /b 1
)

powershell -NoProfile -Command "if (-not (Test-NetConnection -ComputerName localhost -Port 80 -InformationLevel Quiet)) { Start-Process -FilePath '%XAMPP%\apache_start.bat' -WindowStyle Hidden }"
timeout /t 2 /nobreak >nul
start "" "%CHROME%" "%URL%"
