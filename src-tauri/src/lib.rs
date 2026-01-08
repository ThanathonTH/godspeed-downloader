//! Godspeed Downloader - Tauri Backend
//!
//! A modular Tauri v2 application for high-quality audio downloads.
//!
//! # Architecture
//! - `commands/` - Tauri command handlers
//! - `utils/` - Reusable utility functions
//! - `config.rs` - Application constants
//! - `error.rs` - Unified error handling

mod commands;
mod config;
mod error;
mod utils;

use commands::{app_update, downloader, engine, files};

/// Application entry point.
///
/// Initializes Tauri with all plugins and registers command handlers.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // === Plugins ===
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        // === Command Handlers ===
        .invoke_handler(tauri::generate_handler![
            // App Update
            app_update::check_app_update,
            app_update::install_app_update,
            // Engine Management
            engine::install_engine_update,
            // File Operations
            files::show_in_folder,
            // Download
            downloader::download_video,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
