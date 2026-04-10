@echo off
title Claude Code Proxy
color 0A
echo.
echo  ===================================================
echo     Claude Code Proxy Server
echo     Starting on http://localhost:3002/
echo  ===================================================
echo.

:: Check if node is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERROR: Node.js is not installed or not in PATH.
    echo  Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Check if GROQ_API_KEY is set
if not defined GROQ_API_KEY (
    echo  WARNING: GROQ_API_KEY environment variable not set.
    echo  Set it before using Groq API.
    echo.
)

:: Start proxy
cd /d "%~dp0\package"
echo  [*] Starting proxy server...
echo.

node proxy.cjs

pause
