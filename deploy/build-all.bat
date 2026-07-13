@echo off
REM ═══════════════════════════════════════════════════════════════
REM  WinLux AI — Build All Services (Run on LOCAL server)
REM  Builds all Node.js services + Angular UIs + Zalo services
REM  Output: dist/ folders ready for deployment
REM ═══════════════════════════════════════════════════════════════

echo.
echo ╔══════════════════════════════════════════╗
echo ║  WinLux AI — Build All Services         ║
echo ╚══════════════════════════════════════════╝
echo.

set ROOT=%~dp0..\..
cd /d %ROOT%

REM ─── Shared Services ─────────────────────────────────────
echo [1/7] Building shared services...
cd shared-libs\auth-service && call npm install && call npm run build && cd ..\..
cd shared-libs\payment-service && call npm install && call npm run build && cd ..\..
echo       ✓ Shared services built

REM ─── SmartBuy AI ─────────────────────────────────────────
echo [2/7] Building SmartBuy AI...
cd smartbuy-ai\smartbuy-service && call npm install && call npm run build && cd ..\..
cd smartbuy-ai\smartbuy-web && call npm install && call npm run build && cd ..\..
cd smartbuy-ai\smartbuy-zalo && call npm install && call npm run build && cd ..\..
echo       ✓ SmartBuy AI built

REM ─── TrendBrief AI ──────────────────────────────────────
echo [3/7] Building TrendBrief AI...
cd trend-brief-ai\trendbriefai-service && call npm install && call npm run build && cd ..\..
cd trend-brief-ai\trendbriefai-web && call npm install && call npm run build && cd ..\..
cd trend-brief-ai\trendbriefai-zalo && call npm install && call npm run build && cd ..\..
echo       ✓ TrendBrief AI built

REM ─── CareMate AI ────────────────────────────────────────
echo [4/7] Building CareMate AI...
cd caremate-ai\caremate-service && call npm install && call npm run build && cd ..\..
cd caremate-ai\caremate-ui && call npm install && call npm run build && cd ..\..
cd caremate-ai\caremate-zalo && call npm install && call npm run build && cd ..\..
echo       ✓ CareMate AI built

REM ─── FIN Tax AI ─────────────────────────────────────────
echo [5/7] Building FIN Tax AI...
cd fin-tax-ai\fin-tax-service && call npm install && call npm run build && cd ..\..
cd fin-tax-ai\fin-tax-ui && call npm install && call npm run build && cd ..\..
cd fin-tax-ai\fintax-zalo && call npm install && call npm run build && cd ..\..
echo       ✓ FIN Tax AI built

REM ─── Doctor Car AI ──────────────────────────────────────
echo [6/7] Building Doctor Car AI...
cd doctor-car-ai\doctor-car-service && call npm install && call npm run build && cd ..\..
cd doctor-car-ai\doctor-car-ui && call npm install && call npm run build && cd ..\..
cd doctor-car-ai\doctor-car-zalo && call npm install && call npm run build && cd ..\..
echo       ✓ Doctor Car AI built

REM ─── Backoffice + Video Engine ──────────────────────────
echo [7/7] Building Backoffice + Video Engine...
cd backoffice-ai\backoffice-service && call npm install && call npm run build && cd ..\..
cd backoffice-ai\backoffice-ui && call npm install && call npm run build && cd ..\..
cd ai-video-engine\childhood-service && call npm install && call npm run build && cd ..\..
cd ai-video-engine\childhood-zalo && call npm install && call npm run build && cd ..\..
echo       ✓ Backoffice + Video Engine built

echo.
echo ╔══════════════════════════════════════════╗
echo ║  ✓ ALL BUILDS COMPLETE                  ║
echo ╚══════════════════════════════════════════╝
echo.
echo Next: Run deploy-to-vps.bat to upload to VPS
pause
