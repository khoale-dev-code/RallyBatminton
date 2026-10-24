//! In ấn trên máy quầy: liệt kê máy in, gửi lệnh thô (mở ngăn kéo), in trang đang mở không cần hộp thoại.

pub mod escpos;

use serde::Serialize;

#[cfg(windows)]
mod windows;
#[cfg(windows)]
pub use self::windows::{list_printers, print_webview, send_raw};

#[cfg(not(windows))]
mod other;
#[cfg(not(windows))]
pub use self::other::{list_printers, print_webview, send_raw};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrinterInfo {
    pub name: String,
    pub is_default: bool,
}

/// Lỗi in, kèm mã để trang web hiện thông báo phù hợp.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PrintError {
    /// Hệ điều hành này không hỗ trợ.
    #[cfg_attr(windows, allow(dead_code))]
    Unsupported,
    /// Máy in không tồn tại / offline / hết giấy (Windows báo).
    PrinterUnavailable(String),
    /// Lỗi khác.
    Failed(String),
}
