# GS Runtime - Full Installation Script (Windows)
# Run this on a fresh machine to install everything
# Usage: powershell -ExecutionPolicy Bypass -File install-full.ps1

param(
    [switch]$SkipGitNexus,
    [switch]$SkipOpenCodeConfig
)

$ErrorActionPreference = "Continue"
$repoUrl = "https://github.com/your-user/gs.git"
$installDir = "$env:USERPROFILE\.gs"
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     GS Runtime - Full Installation       ║" -ForegroundColor Cyan
Write-Host "║  Superpowers Skills + GitNexus Bridge    ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── 1. Check Node.js ──
Write-Host "[1/7] Checking Node.js..." -ForegroundColor Cyan
try {
    $nodeVer = node --version 2>$null
    Write-Host "  ✓ Node.js $nodeVer" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Node.js not found!" -ForegroundColor Red
    Write-Host "  Install from: https://nodejs.org (v18+)" -ForegroundColor Yellow
    exit 1
}

# ── 2. Clone or use local repo ──
Write-Host "[2/7] Setting up GS repo..." -ForegroundColor Cyan
if (-not (Test-Path "$repoRoot\package.json")) {
    Write-Host "  Cloning from $repoUrl ..." -ForegroundColor Gray
    git clone $repoUrl $installDir 2>$null
    $repoRoot = $installDir
    if (-not (Test-Path "$repoRoot\package.json")) {
        Write-Host "  ✗ Cannot find GS package. Place this script in the GS repo directory." -ForegroundColor Red
        exit 1
    }
}

Push-Location $repoRoot

# ── 3. Superpowers Skills ──
Write-Host "[3/7] Installing Superpowers skills..." -ForegroundColor Cyan
$spDir = "$env:USERPROFILE\.config\opencode\skills"
$spSkillsDir = Join-Path $spDir "superpowers"
if (-not (Test-Path $spSkillsDir)) {
    Write-Host "  Cloning Superpowers repo..." -ForegroundColor Gray
    $spTmp = "$env:TEMP\superpowers-install"
    git clone --depth 1 https://github.com/obra/superpowers.git $spTmp 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        # Copy all superpowers skills
        $spSrcSkills = Join-Path $spTmp "skills"
        if (Test-Path $spSrcSkills) {
            Get-ChildItem $spSrcSkills -Directory | ForEach-Object {
                $destDir = Join-Path $spSkillsDir $_.Name
                if (-not (Test-Path $destDir)) {
                    Copy-Item $_.FullName $destDir -Recurse -Force
                }
            }
        }
        # Also copy agents/ as skills if needed
        $spSrcAgents = Join-Path $spTmp "agents"
        if (Test-Path $spSrcAgents) {
            Get-ChildItem $spSrcAgents -Directory | ForEach-Object {
                $destDir = Join-Path $spSkillsDir $_.Name
                if (-not (Test-Path $destDir)) {
                    Copy-Item $_.FullName $destDir -Recurse -Force
                }
            }
        }
        Remove-Item $spTmp -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  ✓ Superpowers skills installed" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Clone failed. Superpowers skills not installed." -ForegroundColor Yellow
    }
} else {
    Write-Host "  ✓ Superpowers skills already present" -ForegroundColor Green
}

# ── 4. GS repo (install dependencies & build) ──
Write-Host "[4/7] Installing dependencies..." -ForegroundColor Cyan
npm install 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ npm install failed" -ForegroundColor Red
    Pop-Location
    exit 1
}
Write-Host "  ✓ Dependencies installed" -ForegroundColor Green

Write-Host "      Building TypeScript..." -ForegroundColor Gray
npm run build 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Build failed" -ForegroundColor Red
    Pop-Location
    exit 1
}
Write-Host "  ✓ Build complete" -ForegroundColor Green

# ── 4b. Link globally ──
Write-Host "[4/7] Installing GS globally..." -ForegroundColor Cyan
npm link 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ⚠ npm link failed (may need admin)." -ForegroundColor Yellow
    Write-Host "    Run PowerShell as Administrator and retry." -ForegroundColor Yellow
} else {
    Write-Host "  ✓ GS installed globally" -ForegroundColor Green
}

Pop-Location

# ── 5. GitNexus ──
Write-Host "[5/7] Installing GitNexus..." -ForegroundColor Cyan
if (-not $SkipGitNexus) {
    $gnInstalled = $false
    try { $gnVer = gitnexus --version 2>$null; $gnInstalled = $true } catch {}
    if ($gnInstalled) {
        Write-Host "  ✓ GitNexus already installed" -ForegroundColor Green
    } else {
        npm install -g gitnexus@latest 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ GitNexus installed" -ForegroundColor Green
        } else {
            Write-Host "  ⚠ GitNexus install failed. Graph features disabled." -ForegroundColor Yellow
            Write-Host "    Try: npm install -g gitnexus@1.6.4-rc.48" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "  - Skipped" -ForegroundColor Gray
}

# ── 6. OpenCode config ──
Write-Host "[6/7] Configuring OpenCode..." -ForegroundColor Cyan
if (-not $SkipOpenCodeConfig) {
    $ocDir = "$env:USERPROFILE\.config\opencode"
    $ocConfig = Join-Path $ocDir "config.json"
    $skillDir = Join-Path $ocDir "skills\gs"

    New-Item -ItemType Directory -Force -Path $ocDir | Out-Null
    New-Item -ItemType Directory -Force -Path $skillDir | Out-Null

    # MCP Config
    $config = @{}
    if (Test-Path $ocConfig) {
        try { $config = Get-Content $ocConfig -Raw | ConvertFrom-Json -AsHashtable } catch {}
    }
    if (-not $config.mcp) { $config.mcp = @{} }
    
    $gsMCPCommand = @("node", "$repoRoot\dist\cli\index.js", "mcp-start")
    $config.mcp.gs = @{ type = "local"; command = $gsMCPCommand }
    $config.mcp.gitnexus = @{ type = "local"; command = @("gitnexus", "mcp") }
    
    $config | ConvertTo-Json -Depth 3 | Set-Content $ocConfig
    Write-Host "  ✓ MCP config written" -ForegroundColor Green

    # GS Skill
    Write-Host "[7/7] Registering GS skill..." -ForegroundColor Cyan
    $skillSrc = Join-Path $repoRoot "skills\gs\SKILL.md"
    if (Test-Path $skillSrc) {
        Copy-Item $skillSrc $skillDir -Force
        Write-Host "  ✓ GS skill registered" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║         Installation Complete!           ║" -ForegroundColor Cyan
    Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Next steps in ANY project:" -ForegroundColor White
    Write-Host "    gs init" -ForegroundColor Green
    Write-Host "    gs brainstorm 'describe your feature'" -ForegroundColor Green
    Write-Host "    opencode                                  # or: code ." -ForegroundColor Green
    Write-Host ""
    Write-Host "  The agent will auto-manage everything." -ForegroundColor Gray
}
