@echo off
REM Build unified shared libraries (@winlux/core + winlux)
REM Usage: build-unified.bat

setlocal enabledelayedexpansion

echo ========================================
echo   Building Unified Shared Libraries
echo ========================================
echo.

REM Get script directory
set ROOT=%~dp0

REM ─── Build @winlux/core (TypeScript) ───
echo [1/2] Building @winlux/core (TypeScript)...
cd /d "%ROOT%core"

if not exist "node_modules" (
    echo   Installing dependencies...
    call npm install
)

echo   Compiling TypeScript...
call npm run build

if %ERRORLEVEL% neq 0 (
    echo   X @winlux/core build failed
    exit /b 1
)
echo   √ @winlux/core built successfully

REM ─── Build winlux (Python) ───
echo.
echo [2/2] Building winlux (Python)...
cd /d "%ROOT%winlux"

echo   Installing winlux package (editable)...
pip install -e ".[all]" --quiet

if %ERRORLEVEL% neq 0 (
    echo   X winlux installation failed
    exit /b 1
)
echo   √ winlux installed successfully

echo.
echo ========================================
echo   Build Complete!
echo ========================================
echo.
echo Usage in apps:
echo.
echo   TypeScript:
echo     import { TokenService, SepayProvider } from "@winlux/core";
echo     import { requireAuth } from "@winlux/core/auth";
echo.
echo   Python:
echo     from winlux import LLMClient, segment, CrawlEngine
echo     from winlux.llm import LiteAgent
echo.

endlocal
