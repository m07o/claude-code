@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Merge Dev to Main

echo ============================================
echo   Merge Dev Branch to Main
echo ============================================
echo.
echo This will:
echo   1. Switch to main branch
echo   2. Pull latest changes
echo   3. Merge dev into main
echo   4. Push to GitHub
echo.
set /p CONFIRM="Are you sure? (y/n): "

if /i not "%CONFIRM%"=="y" (
    echo Cancelled.
    pause
    exit /b 1
)

echo.
echo Switching to main...
git checkout main
git pull origin main

echo.
echo Merging dev...
git merge dev

echo.
echo Pushing to GitHub...
git push origin main

echo.
echo Done! Dev branch merged into main.
echo.
pause
