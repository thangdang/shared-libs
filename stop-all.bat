@echo off
echo ========================================
echo  Stopping Shared Services
echo ========================================
echo.

REM Stop Product Linker
echo Stopping Product Linker...
taskkill /FI "WINDOWTITLE eq Product-Linker" /F >nul 2>&1
if errorlevel 1 (
    echo [INFO] Product Linker was not running
) else (
    echo [OK] Product Linker stopped
)

echo.
echo ========================================
echo  All shared services stopped.
echo ========================================
pause
