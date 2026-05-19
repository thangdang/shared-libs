@echo off
REM ═══════════════════════════════════════════════════════════════
REM Start All AI Engines + Ollama — Windows Auto-Start
REM Add to Task Scheduler: trigger at user login
REM ═══════════════════════════════════════════════════════════════

echo ═══ WinLux AI Engines — Auto Start ═══
echo %date% %time%
echo.

REM ─── Configuration ───
REM Update these paths to match your local setup
SET BASE_DIR=C:\Users\evtxd01\learn_python
SET OLLAMA_PATH=C:\Users\evtxd01\AppData\Local\Programs\Ollama\ollama.exe
SET PYTHON=python
SET LOG_DIR=%BASE_DIR%\logs
SET WATCHDOG_SCRIPT=%BASE_DIR%\shared-libs\deploy\windows\ollama-watchdog.py

REM Create log directory
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

REM ─── Step 1: Start Ollama ───
echo [1/7] Starting Ollama...
tasklist /FI "IMAGENAME eq ollama.exe" 2>NUL | find /I "ollama.exe" >NUL
if %ERRORLEVEL% == 0 (
    echo   Already running.
) else (
    start /MIN "Ollama" "%OLLAMA_PATH%" serve
    echo   Started. Waiting 15s for model loading...
    timeout /t 15 /nobreak >NUL
)

REM Verify Ollama is ready
curl -s http://localhost:11434/api/tags >NUL 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo   WARNING: Ollama not responding. Waiting 15s more...
    timeout /t 15 /nobreak >NUL
)
echo   Ollama ready.
echo.

REM ─── Step 2: Start TrendBrief AI Engine (port 8000) ───
echo [2/7] Starting TrendBrief AI Engine :8000...
start /MIN "TrendBrief-Engine" cmd /c "cd /d %BASE_DIR%\trend-brief-ai\trendbriefai-engine && %PYTHON% -m uvicorn app:app --host 0.0.0.0 --port 8000 > %LOG_DIR%\trendbriefai-engine.log 2>&1"
timeout /t 3 /nobreak >NUL

REM ─── Step 3: Start SmartBuy AI Engine (port 8001) ───
echo [3/7] Starting SmartBuy AI Engine :8001...
start /MIN "SmartBuy-Engine" cmd /c "cd /d %BASE_DIR%\smartbuy-ai\smartbuy-ai-engine && %PYTHON% -m uvicorn app:app --host 0.0.0.0 --port 8001 > %LOG_DIR%\smartbuy-engine.log 2>&1"
timeout /t 3 /nobreak >NUL

REM ─── Step 4: Start CareMate AI Engine (port 8002) ───
echo [4/7] Starting CareMate AI Engine :8002...
start /MIN "CareMate-Engine" cmd /c "cd /d %BASE_DIR%\caremate-ai\caremate-ai-engine && %PYTHON% -m uvicorn app:app --host 0.0.0.0 --port 8002 > %LOG_DIR%\caremate-engine.log 2>&1"
timeout /t 3 /nobreak >NUL

REM ─── Step 5: Start FIN Tax AI Engine (port 5000) ───
echo [5/7] Starting FIN Tax AI Engine :5000...
start /MIN "FinTax-Engine" cmd /c "cd /d %BASE_DIR%\fin-tax-ai\fin-tax-ai-engine && %PYTHON% -m uvicorn app.main:app --host 0.0.0.0 --port 5000 > %LOG_DIR%\fintax-engine.log 2>&1"
timeout /t 3 /nobreak >NUL

REM ─── Step 6: Start Childhood Video Engine (port 5001) ───
echo [6/7] Starting Childhood Video Engine :5001...
start /MIN "Video-Engine" cmd /c "cd /d %BASE_DIR%\ai-video-engine\childhood-video-engine && %PYTHON% app.py > %LOG_DIR%\video-engine.log 2>&1"
timeout /t 3 /nobreak >NUL

REM ─── Step 7: Start Ollama Watchdog ───
echo [7/7] Starting Ollama Watchdog...
start /MIN "Ollama-Watchdog" cmd /c "%PYTHON% %WATCHDOG_SCRIPT% > %LOG_DIR%\ollama-watchdog.log 2>&1"

echo.
echo ═══ All engines started ═══
echo.
echo Logs: %LOG_DIR%
echo.
echo Services:
echo   Ollama          : http://localhost:11434
echo   TrendBrief      : http://localhost:8000
echo   SmartBuy        : http://localhost:8001
echo   CareMate        : http://localhost:8002
echo   FIN Tax         : http://localhost:5000
echo   Video Engine    : http://localhost:5001
echo.
echo Press any key to close this window (engines continue running)...
pause >NUL
