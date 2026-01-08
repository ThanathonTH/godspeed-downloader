# setup-binaries.ps1
# Automated setup script for Tauri sidecar binaries (yt-dlp, FFmpeg, Aria2)
# Run this script once to download and prepare all dependencies

$ErrorActionPreference = "Stop"

# Configuration
$BinariesDir = Join-Path $PSScriptRoot "src-tauri\binaries"
$TempDir = Join-Path $env:TEMP "tauri-binaries-setup"
$TargetTriple = "x86_64-pc-windows-msvc"

# Helper function for logging
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $color = switch ($Level) {
        "INFO" { "Cyan" }
        "SUCCESS" { "Green" }
        "WARNING" { "Yellow" }
        "ERROR" { "Red" }
        default { "White" }
    }
    Write-Host "[$timestamp] [$Level] $Message" -ForegroundColor $color
}

# Helper function for downloading files with progress
function Get-FileWithProgress {
    param(
        [string]$Url,
        [string]$OutFile,
        [string]$Description
    )
    
    Write-Log "Downloading $Description..."
    Write-Log "URL: $Url"
    
    try {
        $ProgressPreference = 'SilentlyContinue'  # Speeds up Invoke-WebRequest
        Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing
        $ProgressPreference = 'Continue'
        
        $fileSize = (Get-Item $OutFile).Length / 1MB
        Write-Log "Downloaded $Description ({0:N2} MB)" -f $fileSize -Level "SUCCESS"
    }
    catch {
        throw "Failed to download $Description from $Url`: $_"
    }
}

# ============================================================================
# STEP 1: Create Binaries Directory
# ============================================================================
Write-Log "=" * 60
Write-Log "STEP 1: Creating binaries directory"
Write-Log "=" * 60

if (Test-Path $BinariesDir) {
    Write-Log "Binaries directory already exists: $BinariesDir" -Level "INFO"
}
else {
    New-Item -ItemType Directory -Path $BinariesDir -Force | Out-Null
    Write-Log "Created binaries directory: $BinariesDir" -Level "SUCCESS"
}

# Create temp directory for downloads
if (Test-Path $TempDir) {
    Remove-Item -Path $TempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $TempDir -Force | Out-Null
Write-Log "Created temp directory: $TempDir"

# ============================================================================
# STEP 2: Download yt-dlp
# ============================================================================
Write-Log ""
Write-Log "=" * 60
Write-Log "STEP 2: Downloading yt-dlp"
Write-Log "=" * 60

try {
    # Get the latest release URL from GitHub API
    Write-Log "Fetching latest yt-dlp release info from GitHub..."
    $ytdlpRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest" -UseBasicParsing
    $ytdlpVersion = $ytdlpRelease.tag_name
    Write-Log "Latest yt-dlp version: $ytdlpVersion"
    
    $ytdlpUrl = $ytdlpRelease.assets | Where-Object { $_.name -eq "yt-dlp.exe" } | Select-Object -ExpandProperty browser_download_url
    
    if (-not $ytdlpUrl) {
        throw "Could not find yt-dlp.exe in the latest release assets"
    }
    
    $ytdlpTempPath = Join-Path $TempDir "yt-dlp.exe"
    $ytdlpFinalPath = Join-Path $BinariesDir "yt-dlp-$TargetTriple.exe"
    
    Get-FileWithProgress -Url $ytdlpUrl -OutFile $ytdlpTempPath -Description "yt-dlp.exe"
    
    # Move and rename to target location
    Move-Item -Path $ytdlpTempPath -Destination $ytdlpFinalPath -Force
    Write-Log "Installed yt-dlp to: $ytdlpFinalPath" -Level "SUCCESS"
}
catch {
    Write-Log "Failed to download yt-dlp: $_" -Level "ERROR"
    throw
}

# ============================================================================
# STEP 3: Download FFmpeg (gyan.dev release-essentials)
# ============================================================================
Write-Log ""
Write-Log "=" * 60
Write-Log "STEP 3: Downloading FFmpeg (release-essentials)"
Write-Log "=" * 60

try {
    # gyan.dev provides a consistent URL for the latest release-essentials
    $ffmpegUrl = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
    $ffmpegZipPath = Join-Path $TempDir "ffmpeg-release-essentials.zip"
    $ffmpegExtractPath = Join-Path $TempDir "ffmpeg-extract"
    
    Get-FileWithProgress -Url $ffmpegUrl -OutFile $ffmpegZipPath -Description "FFmpeg release-essentials"
    
    # Extract the zip
    Write-Log "Extracting FFmpeg archive..."
    Expand-Archive -Path $ffmpegZipPath -DestinationPath $ffmpegExtractPath -Force
    
    # Find ffmpeg.exe in the extracted folder (it's in a versioned subfolder)
    $ffmpegExe = Get-ChildItem -Path $ffmpegExtractPath -Recurse -Filter "ffmpeg.exe" | Select-Object -First 1
    
    if (-not $ffmpegExe) {
        throw "Could not find ffmpeg.exe in the extracted archive"
    }
    
    Write-Log "Found ffmpeg.exe at: $($ffmpegExe.FullName)"
    
    $ffmpegFinalPath = Join-Path $BinariesDir "ffmpeg-$TargetTriple.exe"
    Move-Item -Path $ffmpegExe.FullName -Destination $ffmpegFinalPath -Force
    Write-Log "Installed FFmpeg to: $ffmpegFinalPath" -Level "SUCCESS"
    
    # Cleanup
    Write-Log "Cleaning up FFmpeg temporary files..."
    Remove-Item -Path $ffmpegZipPath -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $ffmpegExtractPath -Recurse -Force -ErrorAction SilentlyContinue
}
catch {
    Write-Log "Failed to download/extract FFmpeg: $_" -Level "ERROR"
    throw
}

# ============================================================================
# STEP 4: Download Aria2
# ============================================================================
Write-Log ""
Write-Log "=" * 60
Write-Log "STEP 4: Downloading Aria2"
Write-Log "=" * 60

try {
    # Get the latest release URL from GitHub API
    Write-Log "Fetching latest Aria2 release info from GitHub..."
    $aria2Release = Invoke-RestMethod -Uri "https://api.github.com/repos/aria2/aria2/releases/latest" -UseBasicParsing
    $aria2Version = $aria2Release.tag_name
    Write-Log "Latest Aria2 version: $aria2Version"
    
    # Find the win-64bit zip asset
    $aria2Asset = $aria2Release.assets | Where-Object { $_.name -match "win-64bit.*\.zip$" } | Select-Object -First 1
    
    if (-not $aria2Asset) {
        throw "Could not find Windows 64-bit zip in the latest Aria2 release assets"
    }
    
    $aria2Url = $aria2Asset.browser_download_url
    $aria2ZipPath = Join-Path $TempDir "aria2-win64.zip"
    $aria2ExtractPath = Join-Path $TempDir "aria2-extract"
    
    Get-FileWithProgress -Url $aria2Url -OutFile $aria2ZipPath -Description "Aria2 Windows 64-bit"
    
    # Extract the zip
    Write-Log "Extracting Aria2 archive..."
    Expand-Archive -Path $aria2ZipPath -DestinationPath $aria2ExtractPath -Force
    
    # Find aria2c.exe in the extracted folder
    $aria2Exe = Get-ChildItem -Path $aria2ExtractPath -Recurse -Filter "aria2c.exe" | Select-Object -First 1
    
    if (-not $aria2Exe) {
        throw "Could not find aria2c.exe in the extracted archive"
    }
    
    Write-Log "Found aria2c.exe at: $($aria2Exe.FullName)"
    
    $aria2FinalPath = Join-Path $BinariesDir "aria2c-$TargetTriple.exe"
    Move-Item -Path $aria2Exe.FullName -Destination $aria2FinalPath -Force
    Write-Log "Installed Aria2 to: $aria2FinalPath" -Level "SUCCESS"
    
    # Cleanup
    Write-Log "Cleaning up Aria2 temporary files..."
    Remove-Item -Path $aria2ZipPath -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $aria2ExtractPath -Recurse -Force -ErrorAction SilentlyContinue
}
catch {
    Write-Log "Failed to download/extract Aria2: $_" -Level "ERROR"
    throw
}

# ============================================================================
# FINAL CLEANUP & SUMMARY
# ============================================================================
Write-Log ""
Write-Log "=" * 60
Write-Log "CLEANUP & SUMMARY"
Write-Log "=" * 60

# Remove temp directory
if (Test-Path $TempDir) {
    Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Log "Removed temp directory"
}

# List installed binaries
Write-Log ""
Write-Log "Installed binaries:" -Level "SUCCESS"
Get-ChildItem -Path $BinariesDir -Filter "*.exe" | ForEach-Object {
    $size = $_.Length / 1MB
    Write-Log ("  - {0} ({1:N2} MB)" -f $_.Name, $size) -Level "SUCCESS"
}

Write-Log ""
Write-Log "=" * 60
Write-Log "All sidecar binaries have been set up successfully!" -Level "SUCCESS"
Write-Log "You can now build your Tauri application." -Level "SUCCESS"
Write-Log "=" * 60
