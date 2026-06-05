@echo off
chcp 65001 > nul
title HRM Stats - Build ZIP portable
color 0B
cd /d "%~dp0"

echo.
echo  ============================================================
echo   HRM Stats - Build ZIP portable (sans droits admin)
echo  ============================================================
echo.
echo  Cette methode ne necessite pas de droits administrateur.
echo  Elle cree un dossier zip que l'utilisateur extrait et lance.
echo.

:: Fermer l'app
taskkill /F /IM electron.exe /T >nul 2>&1
timeout /t 2 /nobreak >nul

:: Préparer vendor
if not exist "src\vendor" mkdir "src\vendor"
if not exist "src\vendor\chart.umd.js" (
  copy /Y "node_modules\chart.js\dist\chart.umd.js" "src\vendor\chart.umd.js" >nul 2>&1
)

:: Build ZIP (pas d'icone rcedit = pas de winCodeSign)
set CSC_IDENTITY_AUTO_DISCOVERY=false
call node_modules\.bin\electron-builder --win zip --x64 --config.win.icon=

if %errorlevel% neq 0 (
  echo  [ERREUR] Build ZIP echoue.
  pause & exit /b 1
)

echo.
echo  ============================================================
echo   ZIP cree dans dist\
echo  ============================================================
echo.
echo  Pour utiliser :
echo   1. Copier le .zip sur le PC cible
echo   2. Extraire dans un dossier (ex: C:\HRM Stats\)
echo   3. Double-cliquer sur "HRM Stats.exe" dans le dossier extrait
echo.
if exist "dist\" start "" "dist\"
pause
