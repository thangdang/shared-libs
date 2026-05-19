@echo off
REM ═══════════════════════════════════════════════════════════════
REM Stop All AI Engines — Graceful shutdown
REM ═══════════════════════════════════════════════════════════════

echo ═══ Stopping All AI Engines ═══
echo.

echo Stopping Python engines...
taskkill /F /FI "WINDOWTITLE eq TrendBrief-Engine*" 2>NUL
taskkill /F /FI "WINDOWTITLE eq SmartBuy-Engine*" 2>NUL
taskkill /F /FI "WINDOWTITLE eq CareMate-Engine*" 2>NUL
taskkill /F /FI "WINDOWTITLE eq FinTax-Engine*" 2>NUL
taskkill /F /FI "WINDOWTITLE eq Video-Engine*" 2>NUL
taskkill /F /FI "WINDOWTITLE eq Ollama-Watchdog*" 2>NUL

REM Kill uvicorn processes
taskkill /F /IM "uvicorn.exe" 2>NUL

echo.
echo Stopping Ollama...
taskkill /F /IM "ollama.exe" 2>NUL
taskkill /F /IM "ollama_llama_server.exe" 2>NUL

echo.
echo ═══ All engines stopped ═══
pause
