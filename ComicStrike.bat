@echo off
chcp 65001 >nul
title ComicStrike Sunucusu
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js bulunamadi. https://nodejs.org adresinden LTS surumunu kur ve tekrar dene.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Ilk calistirma: paketler kuruluyor...
  call npm install || (pause & exit /b 1)
)

if not exist client\dist\index.html (
  echo Oyun derleniyor...
  call npm run build || (pause & exit /b 1)
)

call npm start
pause
