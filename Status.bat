@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0"
title Proxy Status

echo ============================================
echo   Claude Code Proxy — Status
echo ============================================
echo.

:: Show provider
echo [Provider]
for /f "tokens=2 delims==" %%a in ('findstr /b "PROVIDER=" package\.env') do echo   Active: %%a
echo.

:: Show API keys (masked)
echo [API Keys]
for /f "tokens=1,2 delims==" %%a in ('findstr "_API_KEY\|_TOKEN" package\.env ^| findstr /v "^#"') do (
    set "key=%%a"
    set "val=%%b"
    if "!val!"=="" (
        echo   !key!: NOT SET
    ) else if "!val!"=="your_groq_api_key_here" (
        echo   !key!: NOT SET
    ) else if "!val!"=="your_github_token_here" (
        echo   !key!: NOT SET
    ) else if "!val!"=="your_zhipu_api_key_here" (
        echo   !key!: NOT SET
    ) else if "!val!"=="your_minimax_api_key_here" (
        echo   !key!: NOT SET
    ) else if "!val!"=="your_moonshot_api_key_here" (
        echo   !key!: NOT SET
    ) else if "!val!"=="your_ollama_api_key_here" (
        echo   !key!: NOT SET
    ) else if "!val!"=="your_api_key_here" (
        echo   !key!: NOT SET
    ) else (
        echo   !key!: ***SET
    )
)

:: Show local model
echo.
echo [Local Model]
for /f "tokens=2 delims==" %%a in ('findstr "LOCAL_MODEL_NAME" package\.env') do echo   Model: %%a
for /f "tokens=2 delims==" %%a in ('findstr "LOCAL_MODEL_ENABLED" package\.env') do echo   Enabled: %%a

:: Show port
echo.
echo [Server]
for /f "tokens=2 delims==" %%a in ('findstr /b "PORT=" package\.env') do echo   Port: %%a

echo.
echo ============================================
pause
