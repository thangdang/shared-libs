@echo off
REM ═══════════════════════════════════════════════════════════════
REM  WinLux AI — Package All Services for Deployment
REM  Creates tar.gz packages ready to upload to VPS
REM  Run AFTER build-all.bat
REM ═══════════════════════════════════════════════════════════════

echo.
echo ╔══════════════════════════════════════════╗
echo ║  WinLux AI — Package for Deployment     ║
echo ╚══════════════════════════════════════════╝
echo.

set ROOT=%~dp0..\..
set OUT=%ROOT%\deploy-packages
cd /d %ROOT%

REM Create output directory
if not exist "%OUT%" mkdir "%OUT%"

echo Packaging services...

REM ─── Shared Services ─────────────────────────────────────
echo   [shared] auth-service...
cd shared-libs\auth-service
tar -czf "%OUT%\auth-service.tar.gz" dist\ node_modules\ package.json
cd ..\..

echo   [shared] payment-service...
cd shared-libs\payment-service
tar -czf "%OUT%\payment-service.tar.gz" dist\ node_modules\ package.json
cd ..\..

REM ─── SmartBuy ────────────────────────────────────────────
echo   [smartbuy] service...
cd smartbuy-ai\smartbuy-service
tar -czf "%OUT%\smartbuy-service.tar.gz" dist\ node_modules\ package.json
cd ..\..

echo   [smartbuy] web...
cd smartbuy-ai\smartbuy-web
tar -czf "%OUT%\smartbuy-web.tar.gz" dist\
cd ..\..

echo   [smartbuy] zalo...
cd smartbuy-ai\smartbuy-zalo
tar -czf "%OUT%\smartbuy-zalo.tar.gz" dist\ node_modules\ package.json
cd ..\..

REM ─── TrendBrief ──────────────────────────────────────────
echo   [trendbriefai] service...
cd trend-brief-ai\trendbriefai-service
tar -czf "%OUT%\trendbriefai-service.tar.gz" dist\ node_modules\ package.json
cd ..\..

echo   [trendbriefai] web...
cd trend-brief-ai\trendbriefai-web
tar -czf "%OUT%\trendbriefai-web.tar.gz" dist\
cd ..\..

echo   [trendbriefai] zalo...
cd trend-brief-ai\trendbriefai-zalo
tar -czf "%OUT%\trendbriefai-zalo.tar.gz" dist\ node_modules\ package.json
cd ..\..

REM ─── CareMate ────────────────────────────────────────────
echo   [caremate] service...
cd caremate-ai\caremate-service
tar -czf "%OUT%\caremate-service.tar.gz" dist\ node_modules\ package.json
cd ..\..

echo   [caremate] ui...
cd caremate-ai\caremate-ui
tar -czf "%OUT%\caremate-ui.tar.gz" dist\
cd ..\..

echo   [caremate] zalo...
cd caremate-ai\caremate-zalo
tar -czf "%OUT%\caremate-zalo.tar.gz" dist\ node_modules\ package.json
cd ..\..

REM ─── FIN Tax ─────────────────────────────────────────────
echo   [fintax] service...
cd fin-tax-ai\fin-tax-service
tar -czf "%OUT%\fintax-service.tar.gz" dist\ node_modules\ package.json
cd ..\..

echo   [fintax] ui...
cd fin-tax-ai\fin-tax-ui
tar -czf "%OUT%\fintax-ui.tar.gz" dist\
cd ..\..

echo   [fintax] zalo...
cd fin-tax-ai\fintax-zalo
tar -czf "%OUT%\fintax-zalo.tar.gz" dist\ node_modules\ package.json
cd ..\..

REM ─── Doctor Car ──────────────────────────────────────────
echo   [doctorcar] service...
cd doctor-car-ai\doctor-car-service
tar -czf "%OUT%\doctorcar-service.tar.gz" dist\ node_modules\ package.json
cd ..\..

echo   [doctorcar] ui...
cd doctor-car-ai\doctor-car-ui
tar -czf "%OUT%\doctorcar-ui.tar.gz" dist\
cd ..\..

echo   [doctorcar] zalo...
cd doctor-car-ai\doctor-car-zalo
tar -czf "%OUT%\doctorcar-zalo.tar.gz" dist\ node_modules\ package.json
cd ..\..

REM ─── Backoffice + Video Engine ───────────────────────────
echo   [backoffice] service...
cd backoffice-ai\backoffice-service
tar -czf "%OUT%\backoffice-service.tar.gz" dist\ node_modules\ package.json
cd ..\..

echo   [backoffice] ui...
cd backoffice-ai\backoffice-ui
tar -czf "%OUT%\backoffice-ui.tar.gz" dist\
cd ..\..

echo   [childhood] service...
cd ai-video-engine\childhood-service
tar -czf "%OUT%\childhood-service.tar.gz" dist\ node_modules\ package.json
cd ..\..

echo   [childhood] zalo...
cd ai-video-engine\childhood-zalo
tar -czf "%OUT%\childhood-zalo.tar.gz" dist\ node_modules\ package.json
cd ..\..

echo.
echo ╔══════════════════════════════════════════╗
echo ║  ✓ ALL PACKAGES CREATED                 ║
echo ╚══════════════════════════════════════════╝
echo.
echo Packages location: %OUT%
echo.
dir /b "%OUT%\*.tar.gz" | find /c ".tar.gz"
echo packages total
echo.
echo Next: Run deploy-to-vps.bat
pause
