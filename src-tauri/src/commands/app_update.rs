//! App update commands.
//!
//! Provides commands for checking and installing application updates
//! via GitHub Releases API.

use std::fs::File;
use std::io::Write;

use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

use crate::config::{DOWNLOAD_TIMEOUT_SECS, GITHUB_API_URL, UPDATE_MSI_FILENAME, USER_AGENT};
use crate::error::AppError;

/// Response structure for update check results.
#[derive(serde::Serialize)]
pub struct UpdateInfo {
    pub update_available: bool,
    pub latest_version: String,
    pub download_url: String,
}

/// GitHub API response structures.
#[derive(serde::Deserialize)]
struct GitHubRelease {
    tag_name: String,
    assets: Vec<GitHubAsset>,
}

#[derive(serde::Deserialize)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
}

/// Check for app updates via GitHub Releases API.
///
/// Fetches the latest release from GitHub and compares with the current version.
/// Returns update availability and download URL for the MSI installer.
#[tauri::command]
pub async fn check_app_update(current_version: String) -> Result<UpdateInfo, AppError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| AppError::logic(format!("Failed to create HTTP client: {}", e)))?;

    let response = client
        .get(GITHUB_API_URL)
        .header("User-Agent", USER_AGENT)
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(AppError::logic(format!(
            "GitHub API error: {} - {}",
            response.status(),
            response
                .status()
                .canonical_reason()
                .unwrap_or("Unknown error")
        )));
    }

    let release: GitHubRelease = response.json().await?;

    // Clean version strings for comparison (remove 'v' prefix if present)
    let latest_clean = release.tag_name.trim_start_matches('v').to_string();
    let current_clean = current_version.trim_start_matches('v').to_string();

    // Find the MSI asset URL
    let download_url = release
        .assets
        .iter()
        .find(|asset| asset.name.ends_with(".msi"))
        .map(|asset| asset.browser_download_url.clone())
        .unwrap_or_default();

    // Compare versions (simple string comparison works for semver)
    let update_available = latest_clean != current_clean && !latest_clean.is_empty();

    Ok(UpdateInfo {
        update_available,
        latest_version: latest_clean,
        download_url,
    })
}

/// Download and install an app update from the given MSI URL.
///
/// Downloads the MSI installer to a temp directory and opens it with the
/// system's default handler, allowing Windows to show the installation UI.
/// Does NOT force app exit - lets the user/installer handle that.
#[tauri::command]
pub async fn install_app_update(app: AppHandle, url: String) -> Result<String, AppError> {
    if url.is_empty() {
        return Err(AppError::logic("No download URL provided."));
    }

    // Step 1: Create temp directory for the download
    let temp_dir = std::env::temp_dir();
    let msi_path = temp_dir.join(UPDATE_MSI_FILENAME);

    // Clean up any previous download
    if msi_path.exists() {
        let _ = std::fs::remove_file(&msi_path);
    }

    // Step 2: Download the MSI file
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(DOWNLOAD_TIMEOUT_SECS))
        .build()
        .map_err(|e| AppError::logic(format!("Failed to create HTTP client: {}", e)))?;

    let response = client
        .get(&url)
        .header("User-Agent", USER_AGENT)
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(AppError::logic(format!(
            "Download failed: {} - {}",
            response.status(),
            response
                .status()
                .canonical_reason()
                .unwrap_or("Unknown error")
        )));
    }

    let bytes = response.bytes().await?;

    let mut file =
        File::create(&msi_path).map_err(|e| AppError::logic(format!("Failed to create MSI file: {}", e)))?;

    file.write_all(&bytes)
        .map_err(|e| AppError::logic(format!("Failed to write MSI file: {}", e)))?;

    drop(file); // Ensure file handle is released

    // Step 3: Open the MSI file with the system's default handler
    // This will show the Windows Installer UI to the user
    app.opener()
        .open_path(msi_path.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| AppError::tauri(format!("Failed to open installer: {}", e)))?;

    // DO NOT force app.exit() here - let the user/installer handle closure
    // The installer will prompt the user to close the app if needed

    Ok(format!(
        "Installer launched! Please follow the installation prompts. File: {}",
        msi_path.display()
    ))
}
