@echo off
title Easy Proxy
for /f "tokens=2*" %%a in ('reg query "HKLM\Software\7-Zip" /v "Path"') do (set zip=%%b7z.exe)
:main
cls
echo ================================================================
echo 1. Manifest V2
echo 2. Manifest V3
echo ================================================================
set /p act=^> 
if [%act%] equ [1] call :archive "2"
if [%act%] equ [2] call :archive "3"
goto :main
:archive
for /f "usebackq skip=3 tokens=1,2 delims=,: " %%a in (mv%~1\manifest.json) do (if %%~a equ version set output=easyproxy_mv%~1-%%~b.zip)
"%zip%" a "%output%" "%~dp0mv2\*" >nul
if %~1 equ 2 goto :exit
"%zip%" u "%output%" -ux2 "%~dp0mv3\*" >nul
:exit
echo.
echo The program has built the extension for "Manifest V%~1"
echo.
echo The output file: "%output%"
timeout /t 5
set act=
goto :main
