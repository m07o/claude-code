@echo off
title Stop Claude Code
color 0C
echo.
echo  ===================================================
echo     Stopping Claude Code Proxy...
echo  ===================================================
echo.

:: Kill all node processes running proxy.js
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo  [*] Killing process %%a (port 3000)...
    taskkill /F /PID %%a >nul 2>&1
)

:: Also kill any cmd windows with "Claude Proxy" in title
taskkill /FI "WINDOWTITLE eq Claude Proxy*" /F >nul 2>&1

echo.
echo  [OK] Proxy stopped.
echo.
pause
