@echo off
REM MongoDB Optimization Script Launcher
REM Usage: mongodb_optimize.bat [options]
REM
REM Examples:
REM   mongodb_optimize.bat --check
REM   mongodb_optimize.bat --full
REM   mongodb_optimize.bat --archive --execute

setlocal

REM Find Python environment
set VENV_PATH=C:\Users\evtxd01\learn_python\shared-libs\winlux\.venv
set SCRIPT_PATH=%~dp0mongodb_optimize.py

if exist "%VENV_PATH%\Scripts\python.exe" (
    echo Using virtual environment: %VENV_PATH%
    "%VENV_PATH%\Scripts\python.exe" "%SCRIPT_PATH%" %*
) else (
    echo Using system Python
    python "%SCRIPT_PATH%" %*
)

endlocal
