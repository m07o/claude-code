@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0"
title Switch AI Provider

echo ============================================
echo   Claude Code Proxy — Switch Provider
echo ============================================
echo.

:: Read current provider from .env
set CURRENT=
for /f "tokens=2 delims==" %%a in ('findstr /b "PROVIDER=" package\.env') do set CURRENT=%%a
echo Current provider: %CURRENT%
echo.

echo Available providers:
echo   1. Groq (free tier)
echo   2. GitHub Models (free)
echo   3. Zhipu AI (GLM-5, GLM-5.1)
echo   4. MiniMax (MiniMax-2.7)
echo   5. Moonshot (Kimi-2.5)
echo   6. Ollama Cloud
echo   7. Custom (any API)
echo   8. Local (Ollama on this machine)
echo.

set /p CHOICE="Select provider (1-8): "

if "%CHOICE%"=="1" set NEW=groq
if "%CHOICE%"=="2" set NEW=github
if "%CHOICE%"=="3" set NEW=zhipu
if "%CHOICE%"=="4" set NEW=minimax
if "%CHOICE%"=="5" set NEW=moonshot
if "%CHOICE%"=="6" set NEW=ollama-cloud
if "%CHOICE%"=="7" set NEW=custom
if "%CHOICE%"=="8" set NEW=local

if not defined NEW (
    echo Invalid choice.
    pause
    exit /b 1
)

echo.
echo Switching from %CURRENT% to %NEW%...

:: Update .env - replace PROVIDER= line
powershell -Command "(Get-Content 'package\.env') -replace '^PROVIDER=.*', 'PROVIDER=%NEW%' | Set-Content 'package\.env'"

echo Done! PROVIDER is now: %NEW%
echo.
echo NOTE: Restart the proxy for changes to take effect.
echo.

pause
