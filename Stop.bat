@echo off
title Stop Claude Code
color 0C
echo.
echo  ===================================================
echo     Stopping Claude Code Proxy...
echo  ===================================================
echo.

:: Kill process on port 3002
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3002" ^| findstr "LISTENING"') do (
    echo  [*] Killing process %%a on port 3002...
    taskkill /F /PID %%a >nul 2>&1
)

:: Also kill any cmd windows with "Claude Proxy" in title
taskkill /FI "WINDOWTITLE eq Claude Proxy*" /F >nul 2>&1

echo.
echo  [OK] Proxy stopped.
echo.
pause
