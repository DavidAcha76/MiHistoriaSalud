@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-celular.ps1" %*
set "BUILD_EXIT=%ERRORLEVEL%"
if "%~1"=="" pause
exit /b %BUILD_EXIT%
