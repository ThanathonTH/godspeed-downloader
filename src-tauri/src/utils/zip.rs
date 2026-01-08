//! ZIP file extraction utilities.
//!
//! Provides reusable functions for extracting ZIP archives with proper
//! directory handling and error management.

use std::fs::{self, File};
use std::io;
use std::path::{Path, PathBuf};

use zip::ZipArchive;

use crate::error::AppError;

/// Extract a ZIP file to the specified destination directory.
///
/// Handles nested directories correctly, ensuring parent directories
/// exist before creating files.
///
/// # Arguments
/// * `source` - Path to the ZIP file
/// * `destination` - Directory to extract files into
///
/// # Returns
/// * `Ok(())` on success
/// * `Err(AppError)` on failure
pub fn extract_zip(source: &Path, destination: &Path) -> Result<(), AppError> {
    // Ensure destination directory exists
    fs::create_dir_all(destination)?;

    // Open the ZIP file
    let zip_file = File::open(source)?;
    let mut archive = ZipArchive::new(zip_file)?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;

        // Get the output path, skipping invalid entries
        let outpath = match file.enclosed_name() {
            Some(path) => destination.join(path),
            None => continue,
        };

        if file.is_dir() {
            // Create directory
            fs::create_dir_all(&outpath)?;
        } else {
            // Ensure parent directory exists
            if let Some(parent) = outpath.parent() {
                if !parent.exists() {
                    fs::create_dir_all(parent)?;
                }
            }

            // Extract file
            let mut outfile = File::create(&outpath)?;
            io::copy(&mut file, &mut outfile)?;

            // Set executable permissions on Unix
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                if let Some(mode) = file.unix_mode() {
                    fs::set_permissions(&outpath, fs::Permissions::from_mode(mode))?;
                }
            }
        }
    }

    Ok(())
}

/// Recursively find a file by name in a directory.
///
/// Searches the directory tree for a file with the exact filename.
///
/// # Arguments
/// * `dir` - Directory to search in
/// * `filename` - Name of the file to find
///
/// # Returns
/// * `Some(PathBuf)` if found
/// * `None` if not found
pub fn find_file_recursive(dir: &Path, filename: &str) -> Option<PathBuf> {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.file_name().map(|n| n == filename).unwrap_or(false) {
                return Some(path);
            } else if path.is_dir() {
                if let Some(found) = find_file_recursive(&path, filename) {
                    return Some(found);
                }
            }
        }
    }
    None
}

/// Copy a file with retry logic for handling temporary locks.
///
/// Useful on Windows where files may be temporarily locked by antivirus
/// or other processes.
///
/// # Arguments
/// * `source` - Source file path
/// * `target` - Target file path
/// * `max_retries` - Maximum number of retry attempts
///
/// # Returns
/// * `Ok(())` on success
/// * `Err(AppError)` on failure after all retries
pub fn copy_with_retry(source: &Path, target: &Path, max_retries: u32) -> Result<(), AppError> {
    let mut last_error = None;

    for attempt in 0..max_retries {
        match fs::copy(source, target) {
            Ok(_) => return Ok(()),
            Err(e) => {
                last_error = Some(e);

                // If it's a sharing violation, wait and retry
                if let Some(ref err) = last_error {
                    if err.raw_os_error() == Some(32) || err.raw_os_error() == Some(33) {
                        if attempt < max_retries - 1 {
                            std::thread::sleep(std::time::Duration::from_millis(500));
                            continue;
                        }
                    }
                }

                // For other errors, fail immediately
                break;
            }
        }
    }

    Err(last_error
        .map(AppError::Io)
        .unwrap_or_else(|| AppError::logic("Copy failed with unknown error")))
}
