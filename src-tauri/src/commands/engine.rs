//! Engine management commands.
//!
//! Provides commands for downloading and installing engine updates (yt-dlp, ffmpeg, aria2c).

use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::PathBuf;

use crate::config::{DOWNLOAD_TIMEOUT_SECS, ENGINE_BINARIES};
use crate::error::AppError;
use crate::utils::zip::{copy_with_retry, extract_zip, find_file_recursive};

/// Resolve the binaries directory with fail-safe dev/prod mode detection.
///
/// Strategy:
/// 1. Production Mode: Return the executable directory
/// 2. Dev Mode: If running from target/debug, look for src-tauri folder
fn resolve_binaries_dir() -> Result<PathBuf, AppError> {
    // Get the current executable path
    let current_exe = std::env::current_exe()?;

    let exe_dir = current_exe
        .parent()
        .ok_or_else(|| AppError::logic("Failed to get executable directory"))?
        .to_path_buf();

    // Check if we're running in dev mode (path contains target/debug or target/release)
    let exe_path_str = exe_dir.to_string_lossy();
    let is_dev_mode = exe_path_str.contains("target\\debug")
        || exe_path_str.contains("target/debug")
        || exe_path_str.contains("target\\release")
        || exe_path_str.contains("target/release");

    if is_dev_mode {
        // Dev Mode: Look for src-tauri folder relative to project root
        let mut search_path = Some(exe_dir.clone());

        for _ in 0..5 {
            if let Some(ref path) = search_path {
                let src_tauri = path.join("src-tauri");
                if src_tauri.exists() {
                    return Ok(src_tauri);
                }
                search_path = path.parent().map(|p| p.to_path_buf());
            } else {
                break;
            }
        }

        // Fallback: Use CARGO_MANIFEST_DIR for dev builds
        if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
            return Ok(PathBuf::from(&manifest_dir));
        }

        // Last resort: just use exe_dir
        Ok(exe_dir)
    } else {
        // Production Mode: Return the executable directory
        Ok(exe_dir)
    }
}

/// Check if a binary file is currently locked/in use.
fn is_file_locked(path: &PathBuf) -> bool {
    if !path.exists() {
        return false;
    }

    // Try to open the file with exclusive write access
    match OpenOptions::new().write(true).open(path) {
        Ok(_) => false,
        Err(e) => {
            matches!(e.kind(), io::ErrorKind::PermissionDenied)
                || e.raw_os_error() == Some(32) // ERROR_SHARING_VIOLATION on Windows
                || e.raw_os_error() == Some(33) // ERROR_LOCK_VIOLATION on Windows
        }
    }
}

/// Download and install engine update from a remote ZIP file.
///
/// This command is self-healing: if binaries are missing or corrupted,
/// it will download fresh copies from the specified URL.
#[tauri::command]
pub async fn install_engine_update(url: String) -> Result<String, AppError> {
    // Step 0: Validate URL
    if url.is_empty() {
        return Err(AppError::logic("No update URL provided."));
    }

    // Step 1: Resolve the target directory
    let binaries_dir = resolve_binaries_dir()?;

    // Verify the directory exists (or create it)
    if !binaries_dir.exists() {
        fs::create_dir_all(&binaries_dir)?;
    }

    // Step 2: Check if any binaries are currently in use
    for binary in ENGINE_BINARIES {
        let binary_path = binaries_dir.join(binary);
        if is_file_locked(&binary_path) {
            return Err(AppError::logic(format!(
                "Cannot update: {} is currently in use. Please stop any active downloads and try again.",
                binary
            )));
        }
    }

    // Step 3: Download the ZIP file to a temporary location
    let temp_dir = std::env::temp_dir().join("godspeed_engine_update");

    // Clean up any previous failed attempts
    if temp_dir.exists() {
        let _ = fs::remove_dir_all(&temp_dir);
    }

    fs::create_dir_all(&temp_dir)?;

    let zip_path = temp_dir.join("engine.zip");

    // Download using async reqwest
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(DOWNLOAD_TIMEOUT_SECS))
        .build()
        .map_err(|e| AppError::logic(format!("Failed to create HTTP client: {}", e)))?;

    let response = client.get(&url).send().await?;

    if !response.status().is_success() {
        return Err(AppError::logic(format!(
            "Download failed with status: {} - {}",
            response.status(),
            response
                .status()
                .canonical_reason()
                .unwrap_or("Unknown error")
        )));
    }

    let bytes = response.bytes().await?;

    let mut zip_file =
        File::create(&zip_path).map_err(|e| AppError::logic(format!("Failed to create temp ZIP file: {}", e)))?;

    zip_file
        .write_all(&bytes)
        .map_err(|e| AppError::logic(format!("Failed to write ZIP file: {}", e)))?;

    drop(zip_file);

    // Step 4: Extract the ZIP file
    let extract_dir = temp_dir.join("extracted");
    extract_zip(&zip_path, &extract_dir)?;

    // Step 5: Copy extracted binaries to the target directory
    let mut updated_count = 0;
    let mut errors: Vec<String> = Vec::new();

    for binary_name in ENGINE_BINARIES {
        let target_path = binaries_dir.join(binary_name);

        // Search for the binary in extracted contents
        let source_path = find_file_recursive(&extract_dir, binary_name);

        if let Some(source) = source_path {
            match copy_with_retry(&source, &target_path, 3) {
                Ok(_) => {
                    updated_count += 1;
                }
                Err(e) => {
                    errors.push(format!("{}: {}", binary_name, e));
                }
            }
        }
    }

    // Step 6: Cleanup temp files
    let _ = fs::remove_dir_all(&temp_dir);

    // Step 7: Return result
    if !errors.is_empty() {
        return Err(AppError::logic(format!(
            "Updated {} binaries, but some failed: {}",
            updated_count,
            errors.join("; ")
        )));
    }

    if updated_count == 0 {
        return Err(AppError::logic(
            "No engine binaries found in the update package.",
        ));
    }

    Ok(format!(
        "Engine V12 updated successfully! {} binaries installed.",
        updated_count
    ))
}
