@echo off
REM ═══════════════════════════════════════════════════════════════
REM Secrets Backup — Encrypted backup of all .env files
REM Requires: 7-Zip installed (default path: C:\Program Files\7-Zip\7z.exe)
REM Usage: backup-secrets.bat
REM ═══════════════════════════════════════════════════════════════

echo ═══ Secrets Backup ═══
echo %date% %time%
echo.

REM ─── Configuration ───
SET BASE_DIR=C:\Users\evtxd01\learn_python
SET BACKUP_DIR=%BASE_DIR%\backups\secrets
SET SEVEN_ZIP="C:\Program Files\7-Zip\7z.exe"
SET TIMESTAMP=%date:~-4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%
SET TIMESTAMP=%TIMESTAMP: =0%
SET ARCHIVE_NAME=secrets-backup-%TIMESTAMP%.7z
SET TEMP_DIR=%TEMP%\secrets-backup-temp

REM Password for encryption (change this!)
SET /P BACKUP_PASSWORD="Enter backup password: "

if "%BACKUP_PASSWORD%"=="" (
    echo ERROR: Password cannot be empty.
    exit /b 1
)

REM Create directories
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
mkdir "%TEMP_DIR%"

echo.
echo Collecting .env files...

REM ─── Collect all .env files ───
SET COUNT=0

REM TrendBrief
if exist "%BASE_DIR%\trend-brief-ai\.env" (
    copy "%BASE_DIR%\trend-brief-ai\.env" "%TEMP_DIR%\trend-brief-ai.env" >NUL
    SET /A COUNT+=1
)
if exist "%BASE_DIR%\trend-brief-ai\trendbriefai-service\.env" (
    copy "%BASE_DIR%\trend-brief-ai\trendbriefai-service\.env" "%TEMP_DIR%\trendbriefai-service.env" >NUL
    SET /A COUNT+=1
)
if exist "%BASE_DIR%\trend-brief-ai\trendbriefai-engine\.env" (
    copy "%BASE_DIR%\trend-brief-ai\trendbriefai-engine\.env" "%TEMP_DIR%\trendbriefai-engine.env" >NUL
    SET /A COUNT+=1
)

REM SmartBuy
if exist "%BASE_DIR%\smartbuy-ai\.env" (
    copy "%BASE_DIR%\smartbuy-ai\.env" "%TEMP_DIR%\smartbuy-ai.env" >NUL
    SET /A COUNT+=1
)
if exist "%BASE_DIR%\smartbuy-ai\smartbuy-service\.env" (
    copy "%BASE_DIR%\smartbuy-ai\smartbuy-service\.env" "%TEMP_DIR%\smartbuy-service.env" >NUL
    SET /A COUNT+=1
)
if exist "%BASE_DIR%\smartbuy-ai\smartbuy-ai-engine\.env" (
    copy "%BASE_DIR%\smartbuy-ai\smartbuy-ai-engine\.env" "%TEMP_DIR%\smartbuy-engine.env" >NUL
    SET /A COUNT+=1
)

REM CareMate
if exist "%BASE_DIR%\caremate-ai\.env" (
    copy "%BASE_DIR%\caremate-ai\.env" "%TEMP_DIR%\caremate-ai.env" >NUL
    SET /A COUNT+=1
)
if exist "%BASE_DIR%\caremate-ai\caremate-service\.env" (
    copy "%BASE_DIR%\caremate-ai\caremate-service\.env" "%TEMP_DIR%\caremate-service.env" >NUL
    SET /A COUNT+=1
)
if exist "%BASE_DIR%\caremate-ai\caremate-ai-engine\.env" (
    copy "%BASE_DIR%\caremate-ai\caremate-ai-engine\.env" "%TEMP_DIR%\caremate-engine.env" >NUL
    SET /A COUNT+=1
)

REM FIN Tax
if exist "%BASE_DIR%\fin-tax-ai\.env" (
    copy "%BASE_DIR%\fin-tax-ai\.env" "%TEMP_DIR%\fin-tax-ai.env" >NUL
    SET /A COUNT+=1
)
if exist "%BASE_DIR%\fin-tax-ai\fin-tax-service\.env" (
    copy "%BASE_DIR%\fin-tax-ai\fin-tax-service\.env" "%TEMP_DIR%\fintax-service.env" >NUL
    SET /A COUNT+=1
)
if exist "%BASE_DIR%\fin-tax-ai\fin-tax-ai-engine\.env" (
    copy "%BASE_DIR%\fin-tax-ai\fin-tax-ai-engine\.env" "%TEMP_DIR%\fintax-engine.env" >NUL
    SET /A COUNT+=1
)

REM AI Video Engine
if exist "%BASE_DIR%\ai-video-engine\.env" (
    copy "%BASE_DIR%\ai-video-engine\.env" "%TEMP_DIR%\ai-video-engine.env" >NUL
    SET /A COUNT+=1
)
if exist "%BASE_DIR%\ai-video-engine\childhood-service\.env" (
    copy "%BASE_DIR%\ai-video-engine\childhood-service\.env" "%TEMP_DIR%\childhood-service.env" >NUL
    SET /A COUNT+=1
)
if exist "%BASE_DIR%\ai-video-engine\childhood-video-engine\.env" (
    copy "%BASE_DIR%\ai-video-engine\childhood-video-engine\.env" "%TEMP_DIR%\video-engine.env" >NUL
    SET /A COUNT+=1
)

REM Shared Libs
if exist "%BASE_DIR%\shared-libs\deploy\.telegram.env" (
    copy "%BASE_DIR%\shared-libs\deploy\.telegram.env" "%TEMP_DIR%\telegram.env" >NUL
    SET /A COUNT+=1
)

REM Backoffice
if exist "%BASE_DIR%\backoffice-ai\backoffice-service\.env" (
    copy "%BASE_DIR%\backoffice-ai\backoffice-service\.env" "%TEMP_DIR%\backoffice-service.env" >NUL
    SET /A COUNT+=1
)

echo Collected %COUNT% .env files.
echo.

REM ─── Create encrypted archive ───
echo Creating encrypted archive...
%SEVEN_ZIP% a -t7z -mhe=on -p%BACKUP_PASSWORD% "%BACKUP_DIR%\%ARCHIVE_NAME%" "%TEMP_DIR%\*" >NUL 2>&1

if %ERRORLEVEL% == 0 (
    echo.
    echo ✓ Backup created: %BACKUP_DIR%\%ARCHIVE_NAME%
    for %%A in ("%BACKUP_DIR%\%ARCHIVE_NAME%") do echo   Size: %%~zA bytes
) else (
    echo.
    echo ✗ ERROR: Failed to create archive.
    echo   Make sure 7-Zip is installed at: %SEVEN_ZIP%
)

REM ─── Cleanup temp files ───
rmdir /s /q "%TEMP_DIR%" 2>NUL

REM ─── Delete old backups (keep last 5) ───
echo.
echo Cleaning old backups (keeping last 5)...
for /f "skip=5 delims=" %%F in ('dir /b /o-d "%BACKUP_DIR%\secrets-backup-*.7z" 2^>NUL') do (
    del "%BACKUP_DIR%\%%F"
    echo   Deleted: %%F
)

echo.
echo ═══ Backup Complete ═══
echo.
pause
