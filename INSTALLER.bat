@echo off
chcp 65001 > nul
title HRM Stats - Installation
color 0B

echo.
echo  ============================================================
echo   HRM Stats - Installation
echo   Hopital Regional de Mamou
echo  ============================================================
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo  [ERREUR] Node.js n'est pas installe.
  echo.
  echo  Veuillez telecharger et installer Node.js LTS depuis :
  echo  https://nodejs.org
  echo.
  pause
  exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo  [OK] Node.js detecte : %NODE_VER%
echo.

cd /d "%~dp0"

echo  Etape 1/2 : Installation des dependances...
call npm install
if %errorlevel% neq 0 (
  echo  [ERREUR] npm install a echoue.
  pause
  exit /b 1
)

echo.
echo  Etape 2/2 : Compilation du module base de donnees...
call npx @electron/rebuild -f -w better-sqlite3
if %errorlevel% neq 0 (
  echo  [AVERTISSEMENT] La recompilation a echoue. Tentative alternative...
  call npx electron-rebuild -f -w better-sqlite3
)

echo.
echo  ============================================================
echo   Installation terminee avec succes !
echo  ============================================================
echo.
echo  Double-cliquez sur LANCER_APP.bat pour demarrer.
echo.
pause
