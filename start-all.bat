@echo off
echo ========================================
echo  Shared Services Startup
echo ========================================
echo.

REM Check MongoDB
echo Checking MongoDB...
mongosh --eval "db.runCommand({ping:1})" --quiet >nul 2>&1
if errorlevel 1 (
    echo [ERROR] MongoDB is not reachable on localhost:27017
    echo Please start MongoDB first.
    pause
    exit /b 1
)
echo [OK] MongoDB is running

REM Check Redis
echo Checking Redis...
redis-cli ping >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Redis is not reachable on localhost:6379
    echo Please start Redis first.
    pause
    exit /b 1
)
echo [OK] Redis is running

REM Check Ollama (non-critical)
echo Checking Ollama...
curl -s http://localhost:11434/api/tags >nul 2>&1
if errorlevel 1 (
    echo [WARN] Ollama is not running on :11434
    echo LLM client will use fallback chain.
) else (
    echo [OK] Ollama is running
)

echo.

REM Start Product Linker
echo Starting Product Linker on :9004...
start "Product-Linker" cmd /c "cd /d %~dp0product-linker && python -m uvicorn product_linker.api:app --host 0.0.0.0 --port 9004"

echo.
echo ========================================
echo  All shared services started!
echo ========================================
echo.
echo Product Linker: http://localhost:9004
echo Health check:   http://localhost:9004/api/health
echo.
pause
