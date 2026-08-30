@echo off
echo ========================================
echo   shared-libs - Setup
echo ========================================
echo.

cd /d "%~dp0"

REM ========================================
REM  TypeScript Core (@winlux/core)
REM ========================================
echo [1/2] Building @winlux/core (TypeScript)...
cd core
call npm install
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build @winlux/core
    pause
    exit /b 1
)
echo [OK] @winlux/core built
cd ..
echo.

REM ========================================
REM  Python winlux
REM ========================================
echo [2/2] Installing winlux (Python)...
cd winlux
if not exist venv (
    python -m venv venv
)
call venv\Scripts\activate
pip install -e ".[all]"
call deactivate
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install winlux
    pause
    exit /b 1
)
echo [OK] winlux installed
cd ..
echo.

echo ========================================
echo   shared-libs Setup Complete!
echo ========================================
echo.
echo Verify:
echo   node -e "require('./core/dist/auth'); console.log('OK')"
echo   cd winlux ^&^& venv\Scripts\activate ^&^& python -c "from winlux.llm import LLMClient; print('OK')"
echo.
pause
