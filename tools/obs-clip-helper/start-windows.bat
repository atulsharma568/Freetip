@echo off
rem Starts the Freetip OBS clip helper. Double-click this file.
cd /d "%~dp0"
if not exist config.json (
  echo config.json is missing. Copy config.example.json to config.json and fill it in.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing, one moment...
  call npm install
)
node src\main.mjs
pause
