# GS Runtime - Windows Install Script
# Installs GS CLI + configures OpenCode

param(
    [switch]$SkipBuild,
    [switch]$SkipOpenCodeConfig
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "[gs] Installing GS Runtime..." -ForegroundColor Cyan
Write-Host ""

# Check Node.js
try {
    $nodeVersion = node --version 2>$null
    Write-Host "[gs] Node.js detected: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[gs] ERROR: Node.js >= 18 is required. Install from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host "[gs] Installing dependencies..." -ForegroundColor Cyan
Push-Location $repoRoot
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "[gs] ERROR: npm install failed" -ForegroundColor Red
    Pop-Location
    exit 1
}

# Build
if (-not $SkipBuild) {
    Write-Host "[gs] Building..." -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[gs] ERROR: Build failed" -ForegroundColor Red
        Pop-Location
        exit 1
    }
}

# Link globally
Write-Host "[gs] Linking globally..." -ForegroundColor Cyan
npm link
if ($LASTEXITCODE -ne 0) {
    Write-Host "[gs] WARN: npm link failed. You may need admin privileges." -ForegroundColor Yellow
    Write-Host "[gs] Try running PowerShell as Administrator and retry." -ForegroundColor Yellow
}

Pop-Location

# Configure OpenCode
if (-not $SkipOpenCodeConfig) {
    $opencodeConfigDir = "$env:USERPROFILE\.config\opencode"
    $opencodeConfigFile = Join-Path $opencodeConfigDir "config.json"

    if (-not (Test-Path $opencodeConfigDir)) {
        New-Item -ItemType Directory -Path $opencodeConfigDir -Force | Out-Null
    }

    $config = @{}
    if (Test-Path $opencodeConfigFile) {
        $existingContent = Get-Content $opencodeConfigFile -Raw
        if ($existingContent) {
            $config = $existingContent | ConvertFrom-Json -AsHashtable
        }
    }

    if (-not $config.ContainsKey("mcp")) {
        $config["mcp"] = @{}
    }

    $config["mcp"]["gs"] = @{
        type = "local"
        command = @("gs", "mcp-start")
    }

    $config | ConvertTo-Json -Depth 3 | Set-Content $opencodeConfigFile
    Write-Host "[gs] OpenCode MCP config written to: $opencodeConfigFile" -ForegroundColor Green
}

# Check GitNexus
try {
    $gnVersion = gitnexus --version 2>$null
    if ($gnVersion) {
        Write-Host "[gs] GitNexus detected: $gnVersion" -ForegroundColor Green
    }
} catch {
    Write-Host "[gs] WARN: GitNexus not found. Graph features will be disabled." -ForegroundColor Yellow
    Write-Host "[gs] Install with: npm install -g gitnexus" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[gs] ==========================================" -ForegroundColor Cyan
Write-Host "[gs] Installation complete!" -ForegroundColor Green
Write-Host "[gs] Next steps:" -ForegroundColor White
Write-Host "[gs]   cd your-project" -ForegroundColor White
Write-Host "[gs]   gs init" -ForegroundColor White
Write-Host "[gs]   gs agents-md" -ForegroundColor White
Write-Host "[gs]   gs brainstorm 'your feature'" -ForegroundColor White
Write-Host "[gs] ==========================================" -ForegroundColor Cyan
