@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0"
title Set API Key

echo ============================================
echo   Claude Code Proxy — Set API Key
echo ============================================
echo.

echo Which provider do you want to set the API key for?
echo.
echo   1. Groq (GROQ_API_KEY)
echo   2. GitHub Models (GITHUB_MODELS_TOKEN)
echo   3. Zhipu AI (ZHIPU_API_KEY)
echo   4. MiniMax (MINIMAX_API_KEY)
echo   5. Moonshot (MOONSHOT_API_KEY)
echo   6. Ollama Cloud (OLLAMA_CLOUD_API_KEY)
echo   7. Custom (CUSTOM_API_KEY)
echo.

set /p CHOICE="Select provider (1-7): "

echo.
set /p APIKEY="Enter API key: "

if "%APIKEY%"=="" (
    echo No key entered.
    pause
    exit /b 1
)

if "%CHOICE%"=="1" (
    powershell -Command "(Get-Content 'package\.env') -replace '^GROQ_API_KEY=.*', 'GROQ_API_KEY=%APIKEY%' | Set-Content 'package\.env'"
    echo GROQ_API_KEY updated.
)
if "%CHOICE%"=="2" (
    powershell -Command "(Get-Content 'package\.env') -replace '^GITHUB_MODELS_TOKEN=.*', 'GITHUB_MODELS_TOKEN=%APIKEY%' | Set-Content 'package\.env'"
    echo GITHUB_MODELS_TOKEN updated.
)
if "%CHOICE%"=="3" (
    powershell -Command "(Get-Content 'package\.env') -replace '^ZHIPU_API_KEY=.*', 'ZHIPU_API_KEY=%APIKEY%' | Set-Content 'package\.env'"
    echo ZHIPU_API_KEY updated.
)
if "%CHOICE%"=="4" (
    powershell -Command "(Get-Content 'package\.env') -replace '^MINIMAX_API_KEY=.*', 'MINIMAX_API_KEY=%APIKEY%' | Set-Content 'package\.env'"
    echo MINIMAX_API_KEY updated.
)
if "%CHOICE%"=="5" (
    powershell -Command "(Get-Content 'package\.env') -replace '^MOONSHOT_API_KEY=.*', 'MOONSHOT_API_KEY=%APIKEY%' | Set-Content 'package\.env'"
    echo MOONSHOT_API_KEY updated.
)
if "%CHOICE%"=="6" (
    powershell -Command "(Get-Content 'package\.env') -replace '^OLLAMA_CLOUD_API_KEY=.*', 'OLLAMA_CLOUD_API_KEY=%APIKEY%' | Set-Content 'package\.env'"
    echo OLLAMA_CLOUD_API_KEY updated.
)
if "%CHOICE%"=="7" (
    powershell -Command "(Get-Content 'package\.env') -replace '^CUSTOM_API_KEY=.*', 'CUSTOM_API_KEY=%APIKEY%' | Set-Content 'package\.env'"
    echo CUSTOM_API_KEY updated.
)

echo.
echo Done! Restart the proxy for changes to take effect.
pause
