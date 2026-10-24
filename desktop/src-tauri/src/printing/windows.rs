//! Windows: máy in qua Print Spooler (winspool), in trang qua WebView2 (không hộp thoại).

use std::sync::mpsc::Sender;

use webview2_com::Microsoft::Web::WebView2::Win32::{
    ICoreWebView2Environment6, ICoreWebView2PrintSettings2, ICoreWebView2_16,
    COREWEBVIEW2_PRINT_STATUS, COREWEBVIEW2_PRINT_STATUS_PRINTER_UNAVAILABLE,
    COREWEBVIEW2_PRINT_STATUS_SUCCEEDED,
};
use webview2_com::PrintCompletedHandler;
use windows::core::{Interface, HSTRING, PCWSTR, PWSTR};
use windows::Win32::Graphics::Printing::{
    ClosePrinter, EndDocPrinter, EndPagePrinter, EnumPrintersW, GetDefaultPrinterW, OpenPrinterW,
    StartDocPrinterW, StartPagePrinter, WritePrinter, DOC_INFO_1W, PRINTER_ENUM_CONNECTIONS,
    PRINTER_ENUM_LOCAL, PRINTER_HANDLE, PRINTER_INFO_4W,
};

use super::{PrintError, PrinterInfo};

/// Lề giấy (inch) — khớp `@page { margin: 4mm }` của trang in.
const MARGIN_INCH: f64 = 4.0 / 25.4;

fn win_err(e: windows::core::Error) -> PrintError {
    PrintError::Failed(format!("{} (0x{:08X})", e.message(), e.code().0))
}

fn default_printer() -> Option<String> {
    unsafe {
        let mut len = 0u32;
        let _ = GetDefaultPrinterW(None, &mut len);
        if len == 0 {
            return None;
        }
        let mut buf = vec![0u16; len as usize];
        if !GetDefaultPrinterW(Some(PWSTR(buf.as_mut_ptr())), &mut len).as_bool() {
            return None;
        }
        let end = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
        Some(String::from_utf16_lossy(&buf[..end]))
    }
}

pub fn list_printers() -> Result<Vec<PrinterInfo>, PrintError> {
    let flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;
    let mut needed = 0u32;
    let mut returned = 0u32;
    unsafe {
        // Lần 1: hỏi kích thước bộ đệm (trả lỗi "bộ đệm nhỏ" là bình thường).
        let _ = EnumPrintersW(flags, PCWSTR::null(), 4, None, &mut needed, &mut returned);
    }
    if needed == 0 {
        return Ok(Vec::new());
    }
    // Bộ đệm u64 để đúng căn lề của PRINTER_INFO_4W.
    let mut storage = vec![0u64; (needed as usize).div_ceil(8)];
    let bytes = unsafe {
        std::slice::from_raw_parts_mut(storage.as_mut_ptr().cast::<u8>(), needed as usize)
    };
    unsafe {
        EnumPrintersW(
            flags,
            PCWSTR::null(),
            4,
            Some(bytes),
            &mut needed,
            &mut returned,
        )
    }
    .map_err(win_err)?;
    let infos = unsafe {
        std::slice::from_raw_parts(
            storage.as_ptr().cast::<PRINTER_INFO_4W>(),
            returned as usize,
        )
    };
    let default = default_printer();
    let mut list: Vec<PrinterInfo> = infos
        .iter()
        .filter(|i| !i.pPrinterName.is_null())
        .filter_map(|i| unsafe { i.pPrinterName.to_string() }.ok())
        .map(|name| PrinterInfo {
            is_default: default.as_deref() == Some(name.as_str()),
            name,
        })
        .collect();
    list.sort_by(|a, b| {
        b.is_default
            .cmp(&a.is_default)
            .then_with(|| a.name.cmp(&b.name))
    });
    Ok(list)
}

struct Printer(PRINTER_HANDLE);

impl Drop for Printer {
    fn drop(&mut self) {
        unsafe {
            let _ = ClosePrinter(self.0);
        }
    }
}

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

fn write_job(printer: &Printer, bytes: &[u8], datatype: &str) -> Result<(), PrintError> {
    let mut doc = wide("Rally Manager");
    let mut kind = wide(datatype);
    let info = DOC_INFO_1W {
        pDocName: PWSTR(doc.as_mut_ptr()),
        pOutputFile: PWSTR::null(),
        pDatatype: PWSTR(kind.as_mut_ptr()),
    };
    unsafe {
        if StartDocPrinterW(printer.0, 1, &info) == 0 {
            return Err(win_err(windows::core::Error::from_thread()));
        }
        let result = (|| {
            StartPagePrinter(printer.0).ok().map_err(win_err)?;
            let mut written = 0u32;
            let len = u32::try_from(bytes.len())
                .map_err(|_| PrintError::Failed("Dữ liệu quá lớn".into()))?;
            WritePrinter(printer.0, bytes.as_ptr().cast(), len, &mut written)
                .ok()
                .map_err(win_err)?;
            let _ = EndPagePrinter(printer.0);
            if written != len {
                return Err(PrintError::Failed("Máy in không nhận đủ dữ liệu".into()));
            }
            Ok(())
        })();
        let _ = EndDocPrinter(printer.0);
        result
    }
}

/// Gửi lệnh thô (ESC/POS) tới máy in.
pub fn send_raw(printer: &str, bytes: &[u8]) -> Result<(), PrintError> {
    let name = HSTRING::from(printer);
    let mut handle = PRINTER_HANDLE::default();
    unsafe { OpenPrinterW(&name, &mut handle, None) }
        .map_err(|_| PrintError::PrinterUnavailable(printer.into()))?;
    let opened = Printer(handle);
    // Trình điều khiển kiểu cũ nhận "RAW"; trình điều khiển XPS (v4) cần "XPS_PASS".
    write_job(&opened, bytes, "RAW").or_else(|_| write_job(&opened, bytes, "XPS_PASS"))
}

fn status_result(
    hr: windows::core::Result<()>,
    status: COREWEBVIEW2_PRINT_STATUS,
    printer: &str,
) -> Result<(), PrintError> {
    hr.map_err(win_err)?;
    if status == COREWEBVIEW2_PRINT_STATUS_SUCCEEDED {
        Ok(())
    } else if status == COREWEBVIEW2_PRINT_STATUS_PRINTER_UNAVAILABLE {
        Err(PrintError::PrinterUnavailable(printer.into()))
    } else {
        Err(PrintError::Failed(format!(
            "WebView2 print status {}",
            status.0
        )))
    }
}

/// In trang đang mở trong cửa sổ ra máy in đã chọn, không hiện hộp thoại (dùng CSS @media print của trang).
pub fn print_webview(
    webview: &tauri::Webview,
    printer: String,
    copies: u8,
    done: Sender<Result<(), PrintError>>,
) -> Result<(), PrintError> {
    let fail = done.clone();
    webview
        .with_webview(move |pw| {
            let started = (|| -> windows::core::Result<()> {
                unsafe {
                    let core: ICoreWebView2_16 = pw.controller().CoreWebView2()?.cast()?;
                    let env: ICoreWebView2Environment6 = pw.environment().cast()?;
                    let settings = env.CreatePrintSettings()?;
                    settings.SetShouldPrintHeaderAndFooter(false)?;
                    settings.SetShouldPrintBackgrounds(true)?;
                    settings.SetMarginTop(MARGIN_INCH)?;
                    settings.SetMarginBottom(MARGIN_INCH)?;
                    settings.SetMarginLeft(MARGIN_INCH)?;
                    settings.SetMarginRight(MARGIN_INCH)?;
                    let settings2: ICoreWebView2PrintSettings2 = settings.cast()?;
                    settings2.SetPrinterName(&HSTRING::from(printer.as_str()))?;
                    settings2.SetCopies(i32::from(copies))?;
                    let name = printer.clone();
                    let handler = PrintCompletedHandler::create(Box::new(move |hr, status| {
                        let _ = done.send(status_result(hr, status, &name));
                        Ok(())
                    }));
                    core.Print(&settings, &handler)
                }
            })();
            if let Err(e) = started {
                let _ = fail.send(Err(win_err(e)));
            }
        })
        .map_err(|e| PrintError::Failed(e.to_string()))
}
