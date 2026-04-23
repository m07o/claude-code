@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   Claude Code in VS Code
echo ============================================
echo.
echo Make sure:
echo   1. Cline extension is installed in VS Code
echo   2. Proxy is running (run Start.bat first)
echo   3. In Cline settings:
echo      - Provider: Anthropic
echo      - API Key: any
echo      - Base URL: http://localhost:3002
echo.
where code >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: VS Code is not installed.
    pause
    exit /b 1
)
start "" code "%~dp0"
