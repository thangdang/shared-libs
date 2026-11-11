# SHARED-004:  Deployment Script (No AI Mode)
# 
# Deploys all apps with AI features disabled.
# Usage:  .\deploy-no-ai.ps1 -Environment dev|staging|prod -Apps all|app1,app2

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("dev", "staging", "prod")]
    [string]$Environment,
    
    [Parameter(Mandatory=$false)]
    [string]$Apps = "all",
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipBuild,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipTests,
    
    [Parameter(Mandatory=$false)]
    [switch]$DryRun
)

# ============================================================================
# Configuration
# ============================================================================

$ErrorActionPreference = "Stop"

$ALL_APPS = @(
    "trend-brief-ai",
    "smartbuy-ai",
    "fin-tax-ai",
    "doctorcar-ai",
    "caremate-ai"
)

$APP_PORTS = @{
    "trend-brief-ai" = @{ service = 3001; ui = 4201 }
    "smartbuy-ai" = @{ service = 3002; ui = 4202 }
    "fin-tax-ai" = @{ service = 3003; ui = 4203 }
    "doctorcar-ai" = @{ service = 3004; ui = 4204 }
    "caremate-ai" = @{ service = 3005; ui = 4205 }
}

$WORKSPACE_ROOT = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent

# ============================================================================
# Helper Functions
# ============================================================================

function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Cyan
}

function Write-Step {
    param([string]$Message)
    Write-Host "[STEP] $Message" -ForegroundColor Yellow
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Gray
}

function Get-AppsToDeply {
    if ($Apps -eq "all") {
        return $ALL_APPS
    }
    return $Apps -split ","
}

function Test-DockerComposeFile {
    param([string]$AppPath)
    $composeFile = Join-Path $AppPath "docker-compose.no-ai.yml"
    return Test-Path $composeFile
}

function Get-EnvFile {
    param([string]$AppPath, [string]$Env)
    $envFile = Join-Path $AppPath ".env.$Env.no-ai"
    if (-not (Test-Path $envFile)) {
        # Fall back to standard env file
        $envFile = Join-Path $AppPath ".env.$Env"
    }
    return $envFile
}

# ============================================================================
# Build Functions
# ============================================================================

function Build-App {
    param([string]$AppName, [string]$AppPath)
    
    Write-Step "Building $AppName..."
    
    $servicePath = Join-Path $AppPath "$($AppName.Replace('-ai', 'ai'))-service"
    $uiPath = Join-Path $AppPath "$($AppName.Replace('-ai', 'ai'))-ui"
    
    # Build service
    if (Test-Path $servicePath) {
        Write-Info "Building service..."
        Push-Location $servicePath
        try {
            if (Test-Path "package.json") {
                npm ci --silent
                npm run build --silent
            }
            elseif (Test-Path "requirements.txt") {
                # Python service
                pip install -r requirements.txt -q
            }
            Write-Success "Service built"
        }
        finally {
            Pop-Location
        }
    }
    
    # Build UI
    if (Test-Path $uiPath) {
        Write-Info "Building UI..."
        Push-Location $uiPath
        try {
            npm ci --silent
            npm run build -- --configuration=production 2>&1 | Out-Null
            Write-Success "UI built"
        }
        finally {
            Pop-Location
        }
    }
}

function Run-Tests {
    param([string]$AppName, [string]$AppPath)
    
    Write-Step "Running tests for $AppName..."
    
    $servicePath = Join-Path $AppPath "$($AppName.Replace('-ai', 'ai'))-service"
    
    if (Test-Path $servicePath) {
        Push-Location $servicePath
        try {
            if (Test-Path "package.json") {
                $result = npm test --silent 2>&1
                if ($LASTEXITCODE -ne 0) {
                    throw "Tests failed for $AppName"
                }
            }
            Write-Success "Tests passed"
        }
        finally {
            Pop-Location
        }
    }
}

# ============================================================================
# Docker Functions
# ============================================================================

function Deploy-WithDocker {
    param([string]$AppName, [string]$AppPath, [string]$Env)
    
    Write-Step "Deploying $AppName with Docker..."
    
    $composeFile = Join-Path $AppPath "docker-compose.no-ai.yml"
    $envFile = Get-EnvFile -AppPath $AppPath -Env $Env
    
    if (-not (Test-Path $composeFile)) {
        Write-Error "docker-compose.no-ai.yml not found for $AppName"
        return $false
    }
    
    Push-Location $AppPath
    try {
        # Build images
        Write-Info "Building Docker images..."
        $buildCmd = "docker-compose -f docker-compose.no-ai.yml build"
        if ($DryRun) {
            Write-Info "[DRY RUN] Would run:  $buildCmd"
        }
        else {
            Invoke-Expression $buildCmd
        }
        
        # Deploy
        Write-Info "Starting containers..."
        $upCmd = "docker-compose -f docker-compose.no-ai.yml up -d"
        if (Test-Path $envFile) {
            $upCmd = "docker-compose -f docker-compose.no-ai.yml --env-file $envFile up -d"
        }
        
        if ($DryRun) {
            Write-Info "[DRY RUN] Would run:  $upCmd"
        }
        else {
            Invoke-Expression $upCmd
        }
        
        Write-Success "$AppName deployed"
        return $true
    }
    catch {
        Write-Error "Failed to deploy $AppName:  $_"
        return $false
    }
    finally {
        Pop-Location
    }
}

function Get-ContainerHealth {
    param([string]$AppName)
    
    $containers = docker ps --filter "name=$AppName" --format "{{.Names}}:{{.Status}}"
    return $containers
}

# ============================================================================
# Main Deployment Flow
# ============================================================================

function Main {
    Write-Header "No-AI Deployment Script"
    Write-Info "Environment:  $Environment"
    Write-Info "Apps:  $Apps"
    Write-Info "Skip Build:  $SkipBuild"
    Write-Info "Skip Tests:  $SkipTests"
    Write-Info "Dry Run:  $DryRun"
    Write-Host ""
    
    $appsToDeply = Get-AppsToDeply
    $successCount = 0
    $failCount = 0
    
    foreach ($app in $appsToDeply) {
        Write-Header "Deploying $app"
        
        $appPath = Join-Path $WORKSPACE_ROOT $app
        
        if (-not (Test-Path $appPath)) {
            Write-Error "App path not found:  $appPath"
            $failCount++
            continue
        }
        
        # Check for docker-compose file
        if (-not (Test-DockerComposeFile -AppPath $appPath)) {
            Write-Error "No docker-compose.no-ai.yml found for $app"
            $failCount++
            continue
        }
        
        # Build
        if (-not $SkipBuild) {
            try {
                Build-App -AppName $app -AppPath $appPath
            }
            catch {
                Write-Error "Build failed:  $_"
                $failCount++
                continue
            }
        }
        
        # Tests
        if (-not $SkipTests) {
            try {
                Run-Tests -AppName $app -AppPath $appPath
            }
            catch {
                Write-Error "Tests failed:  $_"
                $failCount++
                continue
            }
        }
        
        # Deploy
        $success = Deploy-WithDocker -AppName $app -AppPath $appPath -Env $Environment
        if ($success) {
            $successCount++
        }
        else {
            $failCount++
        }
    }
    
    # Summary
    Write-Header "Deployment Summary"
    Write-Info "Total Apps:  $($appsToDeply.Count)"
    Write-Success "Successful:  $successCount"
    if ($failCount -gt 0) {
        Write-Error "Failed:  $failCount"
    }
    
    # Health check
    if (-not $DryRun -and $successCount -gt 0) {
        Write-Header "Container Health"
        foreach ($app in $appsToDeply) {
            $health = Get-ContainerHealth -AppName $app
            if ($health) {
                Write-Info "$app:"
                $health | ForEach-Object { Write-Info "  $_" }
            }
        }
    }
    
    if ($failCount -gt 0) {
        exit 1
    }
}

# Run main
Main
