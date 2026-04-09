@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Opening project in VS Code...
where code >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: VS Code is not installed or not in PATH.
    echo Please install VS Code from https://code.visualstudio.com/
    pause
    exit /b 1
)
start "" code "%~dp0"
echo Done.
