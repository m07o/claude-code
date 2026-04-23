@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Quick Test

echo ============================================
echo   Claude Code Proxy — Quick Test
echo ============================================
echo.

:: Read current provider
for /f "tokens=2 delims==" %%a in ('findstr /b "PROVIDER=" package\.env') do echo Active Provider: %%a
echo.
echo Sending test request...
echo.

curl -s -X POST http://localhost:3002/v1/messages -H "Content-Type: application/json" -H "x-api-key: test" -d "{\"model\":\"claude-sonnet-4\",\"max_tokens\":50,\"messages\":[{\"role\":\"user\",\"content\":\"Say hello in one word\"}],\"stream\":false}"

echo.
echo.
echo Test complete.
pause
