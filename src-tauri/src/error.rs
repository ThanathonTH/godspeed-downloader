//! Unified error handling for the Godspeed Downloader application.
//!
//! Uses `thiserror` for ergonomic error definitions and implements
//! `serde::Serialize` to provide clean JSON responses to the frontend.

use serde::Serialize;
use thiserror::Error;

/// Application-wide error type that can be serialized to JSON for frontend consumption.
#[derive(Debug, Error)]
pub enum AppError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    #[error("ZIP extraction error: {0}")]
    Zip(#[from] zip::result::ZipError),

    #[error("Tauri error: {0}")]
    Tauri(String),

    #[error("{0}")]
    Logic(String),
}

/// JSON-serializable error response for the frontend.
#[derive(Serialize)]
struct ErrorResponse {
    code: String,
    message: String,
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let (code, message) = match self {
            AppError::Io(e) => ("IO_ERROR".to_string(), e.to_string()),
            AppError::Network(e) => ("NETWORK_ERROR".to_string(), e.to_string()),
            AppError::Zip(e) => ("ZIP_ERROR".to_string(), e.to_string()),
            AppError::Tauri(msg) => ("TAURI_ERROR".to_string(), msg.clone()),
            AppError::Logic(msg) => ("LOGIC_ERROR".to_string(), msg.clone()),
        };

        ErrorResponse { code, message }.serialize(serializer)
    }
}

impl AppError {
    /// Create a logic error from any displayable type.
    pub fn logic<T: ToString>(msg: T) -> Self {
        AppError::Logic(msg.to_string())
    }

    /// Create a Tauri error from any displayable type.
    pub fn tauri<T: ToString>(msg: T) -> Self {
        AppError::Tauri(msg.to_string())
    }
}

// Note: AppError implements Serialize, so Tauri automatically converts it
// to InvokeError via its blanket impl: `impl<T: Serialize> From<T> for InvokeError`
