//! Ngoài Windows: ứng dụng chỉ phát hành cho Windows. Bản debug có máy in giả để thử trên Linux / macOS:
//! đặt biến `RALLY_DESKTOP_FAKE_SPOOL=<thư mục>` → có một máy in "Máy in thử", lệnh thô được ghi ra file.

use std::sync::mpsc::Sender;

use super::{PrintError, PrinterInfo};

const FAKE_PRINTER: &str = "Máy in thử";

fn fake_spool() -> Option<std::path::PathBuf> {
    if !cfg!(debug_assertions) {
        return None;
    }
    std::env::var_os("RALLY_DESKTOP_FAKE_SPOOL").map(std::path::PathBuf::from)
}

pub fn list_printers() -> Result<Vec<PrinterInfo>, PrintError> {
    Ok(match fake_spool() {
        Some(_) => vec![PrinterInfo {
            name: FAKE_PRINTER.into(),
            is_default: true,
        }],
        None => Vec::new(),
    })
}

pub fn send_raw(printer: &str, bytes: &[u8]) -> Result<(), PrintError> {
    let dir = fake_spool().ok_or(PrintError::Unsupported)?;
    if printer != FAKE_PRINTER {
        return Err(PrintError::PrinterUnavailable(printer.into()));
    }
    std::fs::create_dir_all(&dir).map_err(|e| PrintError::Failed(e.to_string()))?;
    let n = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or_default();
    std::fs::write(dir.join(format!("raw-{n}.bin")), bytes)
        .map_err(|e| PrintError::Failed(e.to_string()))
}

/// In trang đang mở: chỉ WebView2 (Windows) có in không hộp thoại.
pub fn print_webview(
    _webview: &tauri::Webview,
    _printer: String,
    _copies: u8,
    done: Sender<Result<(), PrintError>>,
) -> Result<(), PrintError> {
    let _ = done.send(Err(PrintError::Unsupported));
    Ok(())
}
