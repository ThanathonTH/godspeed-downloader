use std::fs::{self, File};
use std::io::{self, Write};
use std::path::PathBuf;
use std::process::Command;
use tauri::AppHandle;
use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;
use zip::ZipArchive;

/// Engine binary filenames (Windows)
const ENGINE_BINARIES: &[&str] = &[
    "yt-dlp-x86_64-pc-windows-msvc.exe",
    "aria2c-x86_64-pc-windows-msvc.exe",
    "ffmpeg-x86_64-pc-windows-msvc.exe",
];

/// Resolve the binaries directory with robust dev/prod mode detection.
/// 
/// Strategy:
/// 1. Dev Mode: Look for `src-tauri/` folder containing existing binaries
/// 2. Prod Mode: Use Tauri's resource_dir or locate folder with current yt-dlp.exe
fn resolve_binaries_dir(app: &AppHandle) -> Result<PathBuf, String> {
    // Strategy 1: Try Tauri's resource directory (production mode)
    if let Ok(resource_dir) = app.path().resource_dir() {
        // In production, binaries are typically in the resource directory
        let prod_bin_path = resource_dir.clone();
        if prod_bin_path.join("yt-dlp-x86_64-pc-windows-msvc.exe").exists() {
            return Ok(prod_bin_path);
        }
        
        // Also check for a 'binaries' subfolder
        let binaries_subfolder = resource_dir.join("binaries");
        if binaries_subfolder.join("yt-dlp-x86_64-pc-windows-msvc.exe").exists() {
            return Ok(binaries_subfolder);
        }
    }
    
    // Strategy 2: Dev Mode - Look for src-tauri folder relative to current exe
    if let Ok(current_exe) = std::env::current_exe() {
        // Walk up the directory tree looking for src-tauri
        let mut search_path = current_exe.parent().map(|p| p.to_path_buf());
        
        // Search up to 5 levels (should be enough for typical Tauri dev setup)
        for _ in 0..5 {
            if let Some(ref path) = search_path {
                // Check for src-tauri folder at this level
                let src_tauri = path.join("src-tauri");
                if src_tauri.join("yt-dlp-x86_64-pc-windows-msvc.exe").exists() {
                    return Ok(src_tauri);
                }
                
                // Check for binaries subfolder in src-tauri
                let binaries_folder = src_tauri.join("binaries");
                if binaries_folder.join("yt-dlp-x86_64-pc-windows-msvc.exe").exists() {
                    return Ok(binaries_folder);
                }
                
                // Check if current path itself has the binaries (dev mode sidecars)
                if path.join("yt-dlp-x86_64-pc-windows-msvc.exe").exists() {
                    return Ok(path.clone());
                }
                
                // Move up one directory
                search_path = path.parent().map(|p| p.to_path_buf());
            } else {
                break;
            }
        }
    }
    
    // Strategy 3: Fallback - Check workspace root (for development)
    // This handles the case where we're running from the target/ directory
    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        let manifest_path = PathBuf::from(&manifest_dir);
        if manifest_path.join("yt-dlp-x86_64-pc-windows-msvc.exe").exists() {
            return Ok(manifest_path);
        }
        
        let binaries_folder = manifest_path.join("binaries");
        if binaries_folder.exists() {
            return Ok(binaries_folder);
        }
    }
    
    Err("Could not locate the engine binaries directory. Please reinstall the application.".to_string())
}

/// Check if a binary file is currently locked/in use.
fn is_file_locked(path: &PathBuf) -> bool {
    if !path.exists() {
        return false; // Non-existent files aren't locked
    }
    
    // Try to open the file with exclusive write access
    match fs::OpenOptions::new()
        .write(true)
        .open(path)
    {
        Ok(_) => false, // Successfully opened - not locked
        Err(e) => {
            // Check for common "file in use" error kinds
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
fn install_engine_update(app: AppHandle, url: String) -> Result<String, String> {
    // Step 0: Validate URL
    if url.is_empty() {
        return Err("No update URL provided.".to_string());
    }
    
    // Step 1: Resolve the target directory
    let binaries_dir = resolve_binaries_dir(&app)?;
    
    // Verify the directory exists (or create it)
    if !binaries_dir.exists() {
        fs::create_dir_all(&binaries_dir)
            .map_err(|e| format!("Failed to create binaries directory: {}", e))?;
    }
    
    // Step 2: Check if any binaries are currently in use
    for binary in ENGINE_BINARIES {
        let binary_path = binaries_dir.join(binary);
        if is_file_locked(&binary_path) {
            return Err(format!(
                "Cannot update: {} is currently in use. Please stop any active downloads and try again.",
                binary
            ));
        }
    }
    
    // Step 3: Download the ZIP file to a temporary location
    let temp_dir = std::env::temp_dir().join("godspeed_engine_update");
    
    // Clean up any previous failed attempts
    if temp_dir.exists() {
        let _ = fs::remove_dir_all(&temp_dir);
    }
    
    fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;
    
    let zip_path = temp_dir.join("engine.zip");
    
    // Download using blocking reqwest
    let response = reqwest::blocking::get(&url)
        .map_err(|e| format!("Failed to download engine update: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!(
            "Download failed with status: {} - {}",
            response.status(),
            response.status().canonical_reason().unwrap_or("Unknown error")
        ));
    }
    
    let bytes = response.bytes()
        .map_err(|e| format!("Failed to read download response: {}", e))?;
    
    let mut zip_file = File::create(&zip_path)
        .map_err(|e| format!("Failed to create temp ZIP file: {}", e))?;
    
    zip_file.write_all(&bytes)
        .map_err(|e| format!("Failed to write ZIP file: {}", e))?;
    
    drop(zip_file); // Close the file handle
    
    // Step 4: Extract the ZIP file
    let extract_dir = temp_dir.join("extracted");
    fs::create_dir_all(&extract_dir)
        .map_err(|e| format!("Failed to create extraction directory: {}", e))?;
    
    let zip_file = File::open(&zip_path)
        .map_err(|e| format!("Failed to open ZIP file: {}", e))?;
    
    let mut archive = ZipArchive::new(zip_file)
        .map_err(|e| format!("Invalid ZIP file: {}", e))?;
    
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("Failed to read ZIP entry: {}", e))?;
        
        let outpath = match file.enclosed_name() {
            Some(path) => extract_dir.join(path),
            None => continue, // Skip invalid paths
        };
        
        if file.is_dir() {
            fs::create_dir_all(&outpath)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        } else {
            // Ensure parent directory exists
            if let Some(parent) = outpath.parent() {
                if !parent.exists() {
                    fs::create_dir_all(parent)
                        .map_err(|e| format!("Failed to create parent directory: {}", e))?;
                }
            }
            
            let mut outfile = File::create(&outpath)
                .map_err(|e| format!("Failed to create output file: {}", e))?;
            
            io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("Failed to extract file: {}", e))?;
        }
    }
    
    // Step 5: Copy extracted binaries to the target directory
    let mut updated_count = 0;
    let mut errors: Vec<String> = Vec::new();
    
    // Look for binaries in extracted folder (might be in root or subfolder)
    for binary_name in ENGINE_BINARIES {
        let target_path = binaries_dir.join(binary_name);
        
        // Search for the binary in extracted contents
        let source_path = find_file_recursive(&extract_dir, binary_name);
        
        if let Some(source) = source_path {
            // Perform the copy with error handling
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
        return Err(format!(
            "Updated {} binaries, but some failed: {}",
            updated_count,
            errors.join("; ")
        ));
    }
    
    if updated_count == 0 {
        return Err("No engine binaries found in the update package.".to_string());
    }
    
    Ok(format!(
        "Engine V12 updated successfully! {} binaries installed.",
        updated_count
    ))
}

/// Recursively find a file by name in a directory.
fn find_file_recursive(dir: &PathBuf, filename: &str) -> Option<PathBuf> {
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
fn copy_with_retry(source: &PathBuf, target: &PathBuf, max_retries: u32) -> Result<(), String> {
    let mut last_error = String::new();
    
    for attempt in 0..max_retries {
        match fs::copy(source, target) {
            Ok(_) => return Ok(()),
            Err(e) => {
                last_error = e.to_string();
                
                // If it's a sharing violation, wait and retry
                if e.raw_os_error() == Some(32) || e.raw_os_error() == Some(33) {
                    if attempt < max_retries - 1 {
                        std::thread::sleep(std::time::Duration::from_millis(500));
                        continue;
                    }
                }
                
                // For other errors, fail immediately
                return Err(last_error);
            }
        }
    }
    
    Err(last_error)
}

/// Show a file in Windows Explorer with the file highlighted/selected.
/// Uses: explorer /select,"C:\Path\To\File.mp3"
#[tauri::command]
async fn show_in_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| format!("Failed to open explorer: {}", e))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        // Fallback for non-Windows: just open the parent directory
        if let Some(parent) = std::path::Path::new(&path).parent() {
            Command::new("xdg-open")
                .arg(parent)
                .spawn()
                .map_err(|e| format!("Failed to open folder: {}", e))?;
        }
    }

    Ok(())
}

#[tauri::command]
async fn download_video(
    app: AppHandle,
    url: String,
    output_path: String,
    quality: String,
) -> Result<String, String> {
    // Map quality string to exact bitrate for yt-dlp/FFmpeg
    // Using explicit bitrate values for precision enforcement
    let audio_bitrate = match quality.as_str() {
        "128k" => "128K",
        "192k" => "192K",
        "256k" => "256K",
        "320k" => "320K",
        _ => "320K", // Default to highest quality
    };

    // Build the output template - use proper path formatting
    let output_template = format!("{}/%(title)s.%(ext)s", output_path);

    // Build the yt-dlp sidecar command with:
    // - High-performance parallel download (aria2c)
    // - Windows filesystem safety (--windows-filenames, --trim-filenames)
    // - Precision bitrate enforcement
    let sidecar_command = app
        .shell()
        .sidecar("yt-dlp")
        .map_err(|e| format!("Failed to create sidecar command: {}", e))?
        .args([
            // === SAFETY FLAGS ===
            "--no-playlist",          // Prevent accidental playlist downloads
            "--windows-filenames",    // Strip Windows-reserved chars (: ? | < > " * \)
                                      // Keeps non-English chars (Thai, Japanese, etc.)
            "--trim-filenames", "200", // Limit filename to 200 chars (260 - path room)
            
            // === OUTPUT CONFIG ===
            "-o", &output_template,
            
            // === AUDIO EXTRACTION ===
            "--extract-audio",
            "--audio-format", "mp3",
            "--audio-quality", audio_bitrate, // Exact bitrate: 128K, 192K, 256K, 320K
            
            // === HIGH-PERFORMANCE DOWNLOAD ===
            "--external-downloader", "aria2c",
            "--external-downloader-args", "-x 16 -k 1M", // 16 connections, 1MB chunks
            
            // === TARGET URL ===
            &url,
        ]);

    // Spawn the command and get the receiver for events
    let (mut rx, _child) = sidecar_command
        .spawn()
        .map_err(|e| format!("Failed to spawn yt-dlp: {}", e))?;

    // Track the final output file path
    let mut final_file_path: Option<String> = None;

    // Listen for stdout/stderr events and emit progress to frontend
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line) => {
                let line_str = String::from_utf8_lossy(&line).to_string();

                // Try to capture the final destination path
                // yt-dlp outputs: [ExtractAudio] Destination: C:\path\to\file.mp3
                if line_str.contains("Destination:") {
                    if let Some(path_start) = line_str.find("Destination:") {
                        let path = line_str[path_start + 12..].trim().to_string();
                        // Only keep the MP3 path (final output)
                        if path.ends_with(".mp3") {
                            final_file_path = Some(path.clone());
                        }
                    }
                }

                // Emit all meaningful output for terminal display
                if !line_str.trim().is_empty() {
                    let _ = app.emit("download-progress", &line_str);
                }
            }
            CommandEvent::Stderr(line) => {
                let line_str = String::from_utf8_lossy(&line).to_string();

                // Also check stderr for Destination (yt-dlp sometimes uses it)
                if line_str.contains("Destination:") {
                    if let Some(path_start) = line_str.find("Destination:") {
                        let path = line_str[path_start + 12..].trim().to_string();
                        if path.ends_with(".mp3") {
                            final_file_path = Some(path.clone());
                        }
                    }
                }

                // Emit stderr output (yt-dlp often outputs progress here)
                if !line_str.trim().is_empty() {
                    let _ = app.emit("download-progress", &line_str);
                }
            }
            CommandEvent::Terminated(status) => {
                if status.code == Some(0) {
                    // Send completion with the file path
                    if let Some(ref path) = final_file_path {
                        let _ = app.emit("download-complete", path.clone());
                    }
                    let _ = app.emit("download-progress", "Download completed!");
                } else {
                    let _ = app.emit(
                        "download-progress",
                        format!("[ERROR] Process exited with code: {:?}", status.code),
                    );
                }
            }
            _ => {}
        }
    }

    // Return the final file path or a success message
    Ok(final_file_path.unwrap_or_else(|| "Download completed".to_string()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![download_video, show_in_folder, install_engine_update])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
