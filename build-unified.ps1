# Build unified shared libraries (@winlux/core + winlux)
# Usage: .\build-unified.ps1

$ErrorActionPreference = "Stop"
$ROOT = $PSScriptRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Building Unified Shared Libraries    " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ─── Build @winlux/core (TypeScript) ───
Write-Host "[1/2] Building @winlux/core (TypeScript)..." -ForegroundColor Yellow
Push-Location "$ROOT\core"

if (-not (Test-Path "node_modules")) {
    Write-Host "  Installing dependencies..." -ForegroundColor Gray
    npm install
}

Write-Host "  Compiling TypeScript..." -ForegroundColor Gray
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ @winlux/core built successfully" -ForegroundColor Green
} else {
    Write-Host "  ✗ @winlux/core build failed" -ForegroundColor Red
    Pop-Location
    exit 1
}

Pop-Location

# ─── Build winlux (Python) ───
Write-Host ""
Write-Host "[2/2] Building winlux (Python)..." -ForegroundColor Yellow
Push-Location "$ROOT\winlux"

# Check if we're in a virtual environment
if (-not $env:VIRTUAL_ENV) {
    Write-Host "  Warning: No active virtual environment detected" -ForegroundColor DarkYellow
    Write-Host "  Installing as editable in current Python environment..." -ForegroundColor Gray
}

Write-Host "  Installing winlux package (editable)..." -ForegroundColor Gray
pip install -e ".[all]" --quiet

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ winlux installed successfully" -ForegroundColor Green
} else {
    Write-Host "  ✗ winlux installation failed" -ForegroundColor Red
    Pop-Location
    exit 1
}

Pop-Location

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Build Complete!                      " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Usage in apps:" -ForegroundColor White
Write-Host ""
Write-Host "  TypeScript:" -ForegroundColor Yellow
Write-Host '    import { TokenService, SepayProvider } from "@winlux/core";' -ForegroundColor Gray
Write-Host '    import { requireAuth } from "@winlux/core/auth";' -ForegroundColor Gray
Write-Host ""
Write-Host "  Python:" -ForegroundColor Yellow
Write-Host '    from winlux import LLMClient, segment, CrawlEngine' -ForegroundColor Gray
Write-Host '    from winlux.llm import LiteAgent' -ForegroundColor Gray
Write-Host ""
