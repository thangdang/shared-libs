@echo off
REM ═══════════════════════════════════════════════════════════════
REM  WinLux AI — Deploy to VPS
REM  Uploads packages + extracts + restarts PM2 services
REM  Run AFTER package-all.bat
REM ═══════════════════════════════════════════════════════════════

echo.
echo ╔══════════════════════════════════════════╗
echo ║  WinLux AI — Deploy to VPS              ║
echo ╚══════════════════════════════════════════╝
echo.

REM ─── Configuration ───────────────────────────────────────
set VPS_USER=root
set VPS_IP=YOUR_VPS_IP
set VPS_DIR=/opt/winlux
set ROOT=%~dp0..\..
set PACKAGES=%ROOT%\deploy-packages

REM ─── Check packages exist ────────────────────────────────
if not exist "%PACKAGES%\smartbuy-service.tar.gz" (
    echo ERROR: Packages not found. Run package-all.bat first.
    pause
    exit /b 1
)

echo VPS: %VPS_USER%@%VPS_IP%:%VPS_DIR%
echo.

REM ─── Upload all packages ─────────────────────────────────
echo [1/3] Uploading packages to VPS...
scp %PACKAGES%\*.tar.gz %VPS_USER%@%VPS_IP%:%VPS_DIR%/packages/
echo       ✓ Uploaded

REM ─── Extract + Restart on VPS ────────────────────────────
echo [2/3] Extracting and restarting services on VPS...
ssh %VPS_USER%@%VPS_IP% "cd %VPS_DIR% && bash deploy-extract.sh"
echo       ✓ Deployed

REM ─── Verify health ───────────────────────────────────────
echo [3/3] Verifying health endpoints...
ssh %VPS_USER%@%VPS_IP% "cd %VPS_DIR% && bash verify-health.sh"

echo.
echo ╔══════════════════════════════════════════╗
echo ║  ✓ DEPLOYMENT COMPLETE                  ║
echo ╚══════════════════════════════════════════╝
echo.
pause
