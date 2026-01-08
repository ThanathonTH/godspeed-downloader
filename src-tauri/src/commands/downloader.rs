//! Video download commands.
//!
//! Provides the main download_video command using yt-dlp sidecar.

use tauri::AppHandle;
use tauri::Emitter;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

use crate::config::{get_audio_bitrate, EVENT_DOWNLOAD_COMPLETE, EVENT_DOWNLOAD_PROGRESS, YT_DLP_SIDECAR};
use crate::error::AppError;

/// Download a video/audio from URL using yt-dlp.
///
/// Uses aria2c for high-performance parallel downloading and FFmpeg
/// for audio extraction and conversion.
#[tauri::command]
pub async fn download_video(
    app: AppHandle,
    url: String,
    output_path: String,
    quality: String,
) -> Result<String, AppError> {
    // Map quality string to exact bitrate
    let audio_bitrate = get_audio_bitrate(&quality);

    // Build the output template
    let output_template = format!("{}/%(title)s.%(ext)s", output_path);

    // Build the yt-dlp sidecar command
    let sidecar_command = app
        .shell()
        .sidecar(YT_DLP_SIDECAR)
        .map_err(|e| AppError::tauri(format!("Failed to create sidecar command: {}", e)))?
        .args([
            // === SAFETY FLAGS ===
            "--no-playlist",
            "--windows-filenames",
            "--trim-filenames",
            "200",
            // === OUTPUT CONFIG ===
            "-o",
            &output_template,
            // === AUDIO EXTRACTION ===
            "--extract-audio",
            "--audio-format",
            "mp3",
            "--audio-quality",
            audio_bitrate,
            // === HIGH-PERFORMANCE DOWNLOAD ===
            "--external-downloader",
            "aria2c",
            "--external-downloader-args",
            "-x 16 -k 1M",
            // === TARGET URL ===
            &url,
        ]);

    // Spawn the command and get the receiver for events
    let (mut rx, _child) = sidecar_command
        .spawn()
        .map_err(|e| AppError::tauri(format!("Failed to spawn yt-dlp: {}", e)))?;

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
                    let _ = app.emit(EVENT_DOWNLOAD_PROGRESS, &line_str);
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
                    let _ = app.emit(EVENT_DOWNLOAD_PROGRESS, &line_str);
                }
            }
            CommandEvent::Terminated(status) => {
                if status.code == Some(0) {
                    // Send completion with the file path
                    if let Some(ref path) = final_file_path {
                        let _ = app.emit(EVENT_DOWNLOAD_COMPLETE, path.clone());
                    }
                    let _ = app.emit(EVENT_DOWNLOAD_PROGRESS, "Download completed!");
                } else {
                    let _ = app.emit(
                        EVENT_DOWNLOAD_PROGRESS,
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
