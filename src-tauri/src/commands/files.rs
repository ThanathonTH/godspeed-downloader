//! File operations command.
//!
//! Provides commands for file system interactions like showing files in explorer.

use std::process::Command;

use crate::error::AppError;

/// Show a file in the system file explorer with the file highlighted/selected.
///
/// Platform-specific behavior:
/// - Windows: Uses `explorer /select,"path"` to highlight the file
/// - Linux: Uses `xdg-open` on the parent directory
/// - macOS: Uses `open -R` to reveal the file
#[tauri::command]
pub async fn show_in_folder(path: String) -> Result<(), AppError> {
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| AppError::logic(format!("Failed to open explorer: {}", e)))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| AppError::logic(format!("Failed to open Finder: {}", e)))?;
    }

    #[cfg(target_os = "linux")]
    {
        // Fallback for Linux: open the parent directory
        if let Some(parent) = std::path::Path::new(&path).parent() {
            Command::new("xdg-open")
                .arg(parent)
                .spawn()
                .map_err(|e| AppError::logic(format!("Failed to open folder: {}", e)))?;
        }
    }

    Ok(())
}
