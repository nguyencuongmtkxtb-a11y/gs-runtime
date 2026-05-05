# GS Runtime - Full Installation Script (Windows)
# Run this on a fresh machine to install everything
# Usage: powershell -ExecutionPolicy Bypass -File install-full.ps1

param(
    [switch]$SkipGitNexus,
    [switch]$SkipSuperpowers,
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

# ── 0. Fix Execution Policy ──
Write-Host "[0/7] Setting PowerShell execution policy..." -ForegroundColor Cyan
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force 2>&1 | Out-Null
Write-Host "  ✓ Execution policy set (RemoteSigned)" -ForegroundColor Green

# ── 1. Check Node.js ──
Write-Host "[1/7] Checking Node.js..." -ForegroundColor Cyan
$nodeVer = $null
$nodeVer = node --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  X Node.js not found!" -ForegroundColor Red
    Write-Host "  Install from: https://nodejs.org (v18+)" -ForegroundColor Yellow
    exit 1
}
Write-Host "  ✓ Node.js $nodeVer" -ForegroundColor Green

# ── 2. Clone or use local repo ──
Write-Host "[2/7] Setting up GS repo..." -ForegroundColor Cyan
if (-not (Test-Path "$repoRoot\package.json")) {
    Write-Host "  Cloning from $repoUrl ..." -ForegroundColor Gray
    git clone $repoUrl $installDir 2>&1 | Out-Null
    $repoRoot = $installDir
    if (-not (Test-Path "$repoRoot\package.json")) {
        Write-Host "  X Cannot find GS package. Place this script in the GS repo directory." -ForegroundColor Red
        exit 1
    }
}

Push-Location $repoRoot

# ── 3. Superpowers Skills ──
Write-Host "[3/7] Installing Superpowers skills..." -ForegroundColor Cyan
if (-not $SkipSuperpowers) {
    $spSkillsDir = "$env:USERPROFILE\.config\opencode\skills\superpowers"
    if (-not (Test-Path $spSkillsDir)) {
        $spOk = $false
        $spTmp = "$env:TEMP\superpowers-install"

        # Try git clone first
        $gitOk = $false
        git --version 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { $gitOk = $true }

        if ($gitOk) {
            Write-Host "  Cloning via git..." -ForegroundColor Gray
            git clone --depth 1 https://github.com/obra/superpowers.git $spTmp 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) { $spOk = $true }
        }

        # Fallback: download zip
        if (-not $spOk) {
            Write-Host "  Downloading zip..." -ForegroundColor Gray
            $spZip = "$env:TEMP\superpowers.zip"
            try {
                Invoke-WebRequest -Uri "https://github.com/obra/superpowers/archive/refs/heads/main.zip" -OutFile $spZip -ErrorAction Stop
                Expand-Archive -Path $spZip -DestinationPath $spTmp -Force -ErrorAction Stop
                $spExtracted = Get-ChildItem $spTmp -Directory | Select-Object -First 1
                if ($spExtracted) {
                    $spTmp = $spExtracted.FullName
                    $spOk = $true
                }
            } catch { }
        }

        if ($spOk) {
            New-Item -ItemType Directory -Force -Path $spSkillsDir | Out-Null
            # Copy skills/
            $spSrcSkills = Join-Path $spTmp "skills"
            if (Test-Path $spSrcSkills) {
                Get-ChildItem $spSrcSkills -Directory | ForEach-Object {
                    $destDir = Join-Path $spSkillsDir $_.Name
                    if (-not (Test-Path $destDir)) {
                        Copy-Item $_.FullName $destDir -Recurse -Force
                    }
                }
            }
            # Copy agents/ if present
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
            Remove-Item "$env:TEMP\superpowers.zip" -Force -ErrorAction SilentlyContinue
            Write-Host "  ✓ Superpowers skills installed" -ForegroundColor Green
        } else {
            Write-Host "  ! Superpowers install failed (no git, no network)." -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ✓ Superpowers skills already present" -ForegroundColor Green
    }
} else {
    Write-Host "  - Skipped" -ForegroundColor Gray
}

# ── 4. GS repo (install dependencies & build) ──
Write-Host "[4/7] Installing dependencies..." -ForegroundColor Cyan

# Try pnpm first, fall back to npm
$pm = "npm"
pnpm --version 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) { $pm = "pnpm" }

if ($pm -eq "pnpm") {
    pnpm install 2>&1 | Out-Null
} else {
    npm install 2>&1 | Out-Null
}
if ($LASTEXITCODE -ne 0) {
    Write-Host "  X Dependencies install failed" -ForegroundColor Red
    Pop-Location
    exit 1
}
Write-Host "  ✓ Dependencies installed (via $pm)" -ForegroundColor Green

Write-Host "      Building TypeScript..." -ForegroundColor Gray
npm run build 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  X Build failed" -ForegroundColor Red
    Pop-Location
    exit 1
}
Write-Host "  ✓ Build complete" -ForegroundColor Green

# ── 4b. Link globally ──
Write-Host "[4/7] Installing GS globally..." -ForegroundColor Cyan
npm link 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ! npm link failed (may need admin)." -ForegroundColor Yellow
    Write-Host "    Run PowerShell as Administrator and retry." -ForegroundColor Yellow
} else {
    Write-Host "  ✓ GS installed globally" -ForegroundColor Green
}

Pop-Location

# ── 5. GitNexus ──
Write-Host "[5/7] Installing GitNexus..." -ForegroundColor Cyan
if (-not $SkipGitNexus) {
    $gnInstalled = $false
    $gnVer = gitnexus --version 2>&1
    if ($LASTEXITCODE -eq 0) { $gnInstalled = $true }

    if ($gnInstalled) {
        Write-Host "  ✓ GitNexus already installed (v$gnVer)" -ForegroundColor Green
    } else {
        Write-Host "  Installing gitnexus@1.6.4-rc.48 ..." -ForegroundColor Gray
        npm install -g gitnexus@1.6.4-rc.48 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  RC install failed, trying latest stable..." -ForegroundColor Yellow
            npm install -g gitnexus@latest 2>&1 | Out-Null
        }
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ GitNexus installed" -ForegroundColor Green
        } else {
            Write-Host "  ! GitNexus install failed. Graph features disabled." -ForegroundColor Yellow
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
    $odSkillDir = Join-Path $ocDir "skills\od-bridge"

    New-Item -ItemType Directory -Force -Path $ocDir | Out-Null
    New-Item -ItemType Directory -Force -Path $skillDir | Out-Null
    New-Item -ItemType Directory -Force -Path $odSkillDir | Out-Null

    # MCP Config
    $config = @{}
    if (Test-Path $ocConfig) {
        try { $config = Get-Content $ocConfig -Raw | ConvertFrom-Json -AsHashtable } catch { }
    }
    if (-not $config.mcp) { $config.mcp = @{} }

    $gsMCPCommand = @("node", "$repoRoot\dist\cli\index.js", "mcp-start")
    $config.mcp.gs = @{ type = "local"; command = $gsMCPCommand }
    $config.mcp.gitnexus = @{ type = "local"; command = @("gitnexus", "mcp") }

    $config | ConvertTo-Json -Depth 3 | Set-Content $ocConfig
    Write-Host "  ✓ MCP config written" -ForegroundColor Green

    # ── 7. Register GS + od-bridge skills ──
    Write-Host "[7/7] Registering GS + od-bridge skills..." -ForegroundColor Cyan

    $skillSrc = Join-Path $repoRoot "skills\gs\SKILL.md"
    if (Test-Path $skillSrc) {
        Copy-Item $skillSrc $skillDir -Force
        Write-Host "  ✓ GS skill registered" -ForegroundColor Green
    }

    $odSkillSrc = Join-Path $repoRoot "skills\od-bridge\SKILL.md"
    if (Test-Path $odSkillSrc) {
        Copy-Item $odSkillSrc $odSkillDir -Force
        Write-Host "  ✓ od-bridge skill registered" -ForegroundColor Green
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
