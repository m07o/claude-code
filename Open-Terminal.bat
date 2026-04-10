@echo off
chcp 65001 >nul
cd /d "%~dp0"
start cmd /k "cd /d "%~dp0" && title Claude Code Proxy — Terminal && echo Project: %~dp0 && echo Type 'npm run proxy' to start the proxy."
