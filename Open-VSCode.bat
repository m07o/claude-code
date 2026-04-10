@echo off
chcp 65001 >nul
cd /d "%~dp0"
where code >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: VS Code is not installed or not in PATH.
    pause
    exit /b 1
)
start "" code "%~dp0"
