//! Lệnh trang Rally gọi được (chỉ trang trên máy chủ Rally — xem `lib.rs`, quyền `remote`).
//! Mọi tham số từ trang web đều được kiểm tra lại ở đây; không có lệnh nào chạy chương trình / đọc file tùy ý.

use std::sync::mpsc;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Manager, State, Webview};

use crate::printing::{self, escpos, PrintError, PrinterInfo};
use crate::settings::{self, PrinterSettings};

/// Thời gian chờ tối đa cho một lần in.
const PRINT_TIMEOUT: Duration = Duration::from_secs(60);
/// Khoảng cách tối thiểu giữa hai lần mở ngăn kéo (chống bấm liên tục).
const DRAWER_COOLDOWN: Duration = Duration::from_millis(1500);

pub struct DesktopState {
    pub settings: Mutex<PrinterSettings>,
    pub last_drawer: Mutex<Option<Instant>>,
    pub printing: Mutex<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandError {
    pub code: &'static str,
    pub message: String,
}

impl CommandError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

impl From<PrintError> for CommandError {
    fn from(e: PrintError) -> Self {
        match e {
            PrintError::Unsupported => {
                Self::new("UNSUPPORTED", "Máy này không hỗ trợ in trực tiếp.")
            }
            PrintError::PrinterUnavailable(name) => Self::new(
                "PRINTER_UNAVAILABLE",
                format!("Máy in \"{name}\" không sẵn sàng (tắt, rút cáp, hết giấy?)."),
            ),
            PrintError::Failed(msg) => Self::new("PRINT_FAILED", msg),
        }
    }
}

type CmdResult<T> = Result<T, CommandError>;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopInfo {
    pub app_version: String,
    pub platform: &'static str,
    pub silent_print: bool,
}

#[tauri::command]
pub fn desktop_info(app: AppHandle) -> DesktopInfo {
    DesktopInfo {
        app_version: app.package_info().version.to_string(),
        platform: std::env::consts::OS,
        silent_print: cfg!(windows),
    }
}

#[tauri::command]
pub async fn list_printers() -> CmdResult<Vec<PrinterInfo>> {
    tauri::async_runtime::spawn_blocking(printing::list_printers)
        .await
        .map_err(|e| CommandError::new("PRINT_FAILED", e.to_string()))?
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn get_printer_settings(state: State<'_, DesktopState>) -> PrinterSettings {
    state.settings.lock().map(|s| s.clone()).unwrap_or_default()
}

#[tauri::command]
pub async fn save_printer_settings(
    app: AppHandle,
    state: State<'_, DesktopState>,
    settings: PrinterSettings,
) -> CmdResult<PrinterSettings> {
    let known: Vec<String> = tauri::async_runtime::spawn_blocking(printing::list_printers)
        .await
        .map_err(|e| CommandError::new("PRINT_FAILED", e.to_string()))?
        .map_err(CommandError::from)?
        .into_iter()
        .map(|p| p.name)
        .collect();
    let checked = settings
        .validated(Some(&known))
        .map_err(|m| CommandError::new("INVALID_SETTINGS", m))?;
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| CommandError::new("SAVE_FAILED", e.to_string()))?;
    settings::save(&dir, &checked).map_err(|m| CommandError::new("SAVE_FAILED", m))?;
    if let Ok(mut current) = state.settings.lock() {
        *current = checked.clone();
    }
    Ok(checked)
}

struct PrintingGuard<'a>(&'a Mutex<bool>);

impl Drop for PrintingGuard<'_> {
    fn drop(&mut self) {
        if let Ok(mut busy) = self.0.lock() {
            *busy = false;
        }
    }
}

/// In trang đang mở (phần `@media print` của trang) ra máy in hóa đơn đã chọn, không hộp thoại.
/// Chưa chọn máy in → lỗi NO_PRINTER (trang tự mở hộp thoại in như trình duyệt).
#[tauri::command]
pub async fn print_page(webview: Webview, state: State<'_, DesktopState>) -> CmdResult<()> {
    let (printer, copies) = {
        let s = state
            .settings
            .lock()
            .map_err(|_| CommandError::new("PRINT_FAILED", "Cài đặt bị khóa"))?;
        match s.receipt_printer.clone() {
            Some(p) => (p, s.copies),
            None => {
                return Err(CommandError::new(
                    "NO_PRINTER",
                    "Chưa chọn máy in hóa đơn cho máy này.",
                ))
            }
        }
    };
    {
        let mut busy = state
            .printing
            .lock()
            .map_err(|_| CommandError::new("PRINT_FAILED", "Cài đặt bị khóa"))?;
        if *busy {
            return Err(CommandError::new("PRINT_BUSY", "Đang in, chờ một chút."));
        }
        *busy = true;
    }
    let _guard = PrintingGuard(&state.printing);
    let (tx, rx) = mpsc::channel();
    printing::print_webview(&webview, printer, copies, tx)?;
    tauri::async_runtime::spawn_blocking(move || rx.recv_timeout(PRINT_TIMEOUT))
        .await
        .map_err(|e| CommandError::new("PRINT_FAILED", e.to_string()))?
        .map_err(|_| CommandError::new("PRINT_FAILED", "Máy in không phản hồi."))?
        .map_err(CommandError::from)
}

/// Mở ngăn kéo tiền qua máy in hóa đơn. Trang web ghi nhật ký lên máy chủ TRƯỚC khi gọi lệnh này.
#[tauri::command]
pub async fn open_cash_drawer(state: State<'_, DesktopState>) -> CmdResult<()> {
    let (printer, pin) = {
        let s = state
            .settings
            .lock()
            .map_err(|_| CommandError::new("PRINT_FAILED", "Cài đặt bị khóa"))?;
        if !s.drawer_enabled {
            return Err(CommandError::new(
                "NO_DRAWER",
                "Máy này chưa bật ngăn kéo tiền.",
            ));
        }
        match s.drawer_target() {
            Some(p) => (p.to_string(), s.drawer_pin),
            None => {
                return Err(CommandError::new(
                    "NO_DRAWER",
                    "Chưa chọn máy in nối ngăn kéo.",
                ))
            }
        }
    };
    {
        let mut last = state
            .last_drawer
            .lock()
            .map_err(|_| CommandError::new("PRINT_FAILED", "Cài đặt bị khóa"))?;
        if last.is_some_and(|t| t.elapsed() < DRAWER_COOLDOWN) {
            return Err(CommandError::new("DRAWER_BUSY", "Ngăn kéo vừa mở."));
        }
        *last = Some(Instant::now());
    }
    let bytes = escpos::drawer_pulse(pin);
    tauri::async_runtime::spawn_blocking(move || printing::send_raw(&printer, &bytes))
        .await
        .map_err(|e| CommandError::new("PRINT_FAILED", e.to_string()))?
        .map_err(CommandError::from)
}
