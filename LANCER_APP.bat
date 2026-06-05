@echo off
chcp 65001 > nul
title HRM Stats
cd /d "%~dp0"

if not exist "node_modules" (
  echo Les dependances ne sont pas installees.
  echo Lancez d'abord INSTALLER.bat
  pause
  exit /b 1
)

npm start
