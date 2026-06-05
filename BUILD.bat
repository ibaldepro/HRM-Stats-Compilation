@echo off
chcp 65001 > nul
title HRM Stats - Compilation .exe
color 0A
cd /d "%~dp0"

echo.
echo  ============================================================
echo   HRM Stats - Compilation de l'installateur Windows
echo   Hopital Regional de Mamou
echo  ============================================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
  echo  [ERREUR] Node.js non detecte. Lancez d'abord INSTALLER.bat
  pause & exit /b 1
)

:: Fermer l'application si ouverte
echo  [0/4] Fermeture de HRM Stats si ouverte...
taskkill /F /IM "HRM Stats.exe" /T >nul 2>&1
taskkill /F /IM electron.exe /T >nul 2>&1
timeout /t 2 /nobreak >nul

:: Installer les dependances si besoin
echo  [1/4] Verification des dependances...
if not exist "node_modules\electron\dist\electron.exe" (
  call npm install
  if %errorlevel% neq 0 ( echo [ERREUR] npm install echoue. & pause & exit /b 1 )
)

:: Patch builder-util pour accepter le code retour 2 de 7-zip (avertissement symlinks macOS)
echo  [2/4] Application du correctif de compatibilite Windows...
node -e "
  const fs=require('fs'), f='node_modules/builder-util/out/util.js';
  let c=fs.readFileSync(f,'utf8');
  const old='if (code === 0) {';
  const patch='if (code === 0 || code === 2) { // 7-zip warning on Windows = treat as success';
  if(c.includes(patch)){console.log('  Correctif deja applique.');}
  else if(c.includes(old)){fs.writeFileSync(f,c.replace(old,patch));console.log('  Correctif applique avec succes.');}
  else{console.log('  AVERTISSEMENT: Impossible de localiser le point de patch.');}
"

:: Préparer chart.js dans src/vendor/
echo  [3/4] Preparation des ressources...
if not exist "src\vendor" mkdir "src\vendor"
if not exist "src\vendor\chart.umd.js" (
  if exist "node_modules\chart.js\dist\chart.umd.js" (
    copy /Y "node_modules\chart.js\dist\chart.umd.js" "src\vendor\chart.umd.js" >nul
    echo  chart.js copie dans src/vendor/
  )
)

:: Nettoyer le cache winCodeSign (laisse une extraction propre a chaque build)
if exist "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign" (
  rd /s /q "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign" 2>nul
)

:: Build
echo  [4/4] Construction de l'installateur (.exe)...
echo.
set CSC_IDENTITY_AUTO_DISCOVERY=false
set CSC_LINK=
call npm run build

if %errorlevel% neq 0 (
  echo.
  echo  [ERREUR] La compilation a echoue.
  echo  Conseil : lancez BUILD_ADMIN.bat (clic droit -> Executer en tant qu'administrateur)
  pause & exit /b 1
)

echo.
echo  ============================================================
echo   Succes !
echo  ============================================================
echo.
echo  Installateur : dist\HRM Stats Setup 1.0.0.exe  (^~79 MB)
echo.
echo  Copiez ce fichier sur n'importe quel PC Windows 10/11
echo  et double-cliquez pour installer sans avoir besoin de Node.js.
echo.
if exist "dist\" start "" "dist\"
pause
