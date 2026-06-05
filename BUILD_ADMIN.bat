@echo off
chcp 65001 > nul

:: ── Auto-elevation: si pas encore admin, se relancer en admin ────────────────
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Demande de privileges administrateur...
  powershell -Command "Start-Process -Verb RunAs -FilePath '%~f0' -WorkingDirectory '%~dp0'"
  exit /b
)

title HRM Stats - Compilation .exe (Administrateur)
color 0A
cd /d "%~dp0"

echo.
echo  ============================================================
echo   HRM Stats - Compilation (mode Administrateur)
echo   Hopital Regional de Mamou
echo  ============================================================
echo.

:: Fermer l'application si ouverte
echo  Fermeture de l'application en cours...
taskkill /F /IM "HRM Stats.exe" /T >nul 2>&1
taskkill /F /IM electron.exe /T >nul 2>&1
timeout /t 2 /nobreak >nul

:: Nettoyer le cache winCodeSign corrompu
echo  Nettoyage du cache de compilation...
if exist "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign" (
  rd /s /q "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign"
)

:: Vérifier les dépendances
if not exist "node_modules\electron\dist\electron.exe" (
  echo  Installation des dependances...
  call npm install
)

:: Préparer chart.js
if not exist "src\vendor" mkdir "src\vendor"
if not exist "src\vendor\chart.umd.js" (
  if exist "node_modules\chart.js\dist\chart.umd.js" (
    copy /Y "node_modules\chart.js\dist\chart.umd.js" "src\vendor\chart.umd.js" >nul
  )
)

:: Recompiler better-sqlite3 pour Electron
echo.
echo  Recompilation de better-sqlite3...
call npx @electron/rebuild -f -w better-sqlite3

:: Build
echo.
echo  Construction de l'installateur...
set CSC_IDENTITY_AUTO_DISCOVERY=false
call npm run build

if %errorlevel% neq 0 (
  echo.
  echo  [ERREUR] Compilation echouee.
  pause & exit /b 1
)

echo.
echo  ============================================================
echo   Succes ! Installateur cree dans : dist\
echo  ============================================================
echo.
if exist "dist\" start "" "dist\"
pause
