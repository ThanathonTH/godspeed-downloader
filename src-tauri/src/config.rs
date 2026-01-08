//! Application configuration constants.
//!
//! Centralizes all hardcoded values for easy maintenance and testing.

/// GitHub API URL for checking releases.
pub const GITHUB_API_URL: &str =
    "https://api.github.com/repos/ThanathonTH/godspeed-downloader/releases/latest";

/// User-Agent header for HTTP requests (required by GitHub API).
pub const USER_AGENT: &str = "godspeed-app";

/// Download timeout in seconds (10 minutes for slow connections).
pub const DOWNLOAD_TIMEOUT_SECS: u64 = 600;

/// MSI installer filename for app updates.
pub const UPDATE_MSI_FILENAME: &str = "Godspeed_Update.msi";

// =============================================================================
// Event Names
// =============================================================================

/// Event emitted when download progress updates.
pub const EVENT_DOWNLOAD_PROGRESS: &str = "download-progress";

/// Event emitted when download completes successfully.
pub const EVENT_DOWNLOAD_COMPLETE: &str = "download-complete";

// =============================================================================
// Engine Binaries (Platform-Specific)
// =============================================================================

/// Engine binary filenames for Windows.
#[cfg(target_os = "windows")]
pub const ENGINE_BINARIES: &[&str] = &[
    "yt-dlp-x86_64-pc-windows-msvc.exe",
    "aria2c-x86_64-pc-windows-msvc.exe",
    "ffmpeg-x86_64-pc-windows-msvc.exe",
];

/// Engine binary filenames for Unix-like systems.
#[cfg(not(target_os = "windows"))]
pub const ENGINE_BINARIES: &[&str] = &["yt-dlp", "aria2c", "ffmpeg"];

/// yt-dlp sidecar name (without extension, Tauri handles platform suffix).
pub const YT_DLP_SIDECAR: &str = "yt-dlp";

// =============================================================================
// Audio Quality Settings
// =============================================================================

/// Map quality string to exact bitrate for yt-dlp/FFmpeg.
pub fn get_audio_bitrate(quality: &str) -> &'static str {
    match quality {
        "128k" => "128K",
        "192k" => "192K",
        "256k" => "256K",
        "320k" => "320K",
        _ => "320K", // Default to highest quality
    }
}
