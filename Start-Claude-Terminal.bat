@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   Claude Code — Terminal
echo ============================================
echo.
echo Opening new terminal for Claude Code...
echo Make sure the proxy is running on port 3002.
echo.
start cmd /k "cd /d "%~dp0" && title Claude Code && echo Type 'claude' to start Claude Code && echo."
