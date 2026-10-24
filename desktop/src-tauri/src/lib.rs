//! Rally Manager cho Windows: cửa sổ mở trang quản trị Rally trên máy chủ (giao diện luôn là bản mới nhất,
//! không lưu dữ liệu khách / doanh thu trên máy) + quyền in hóa đơn không hộp thoại và mở ngăn kéo tiền.
//!
//! An toàn:
//!  - Địa chỉ máy chủ gắn cứng lúc build (`config.rs`); cửa sổ chỉ ở trong tên miền Rally, link ngoài mở bằng
//!    trình duyệt của máy, giao thức lạ (file:, javascript:…) bị chặn.
//!  - Trang trên máy chủ Rally chỉ gọi được ĐÚNG các lệnh trong `commands.rs` (quyền `remote` khai báo bên dưới);
//!    không có quyền đọc / ghi file, chạy chương trình, hay plugin nào khác. Trang khác (kể cả iframe) không gọi được gì.
//!  - Công cụ nhà phát triển (DevTools) chỉ có trong bản debug.

mod commands;
mod config;
mod printing;
mod settings;

use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;

use tauri::ipc::CapabilityBuilder;
use tauri::webview::NewWindowResponse;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use url::Url;

use commands::DesktopState;
use config::NavDecision;

const MAIN_LABEL: &str = "main";
const DOC_PREFIX: &str = "doc-";

static DOC_COUNTER: AtomicU32 = AtomicU32::new(0);

fn open_external(url: &Url) {
    // Chỉ http(s) / mailto / tel tới đây (đã lọc ở config::decide_navigation).
    let _ = tauri_plugin_opener::open_url(url.as_str(), None::<&str>);
}

fn focus_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(MAIN_LABEL) {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// Tạo cửa sổ (chính hoặc cửa sổ hóa đơn / phiếu) với cùng quy tắc điều hướng.
fn build_window(
    app: &AppHandle,
    origin: &Url,
    label: &str,
    url: Url,
    size: (f64, f64),
) -> tauri::Result<WebviewWindow> {
    let nav_origin = origin.clone();
    let popup_origin = origin.clone();
    let popup_app = app.clone();
    let is_doc = label.starts_with(DOC_PREFIX);
    let builder = WebviewWindowBuilder::new(app, label, WebviewUrl::External(url))
        .title("Rally Manager")
        .inner_size(size.0, size.1)
        .min_inner_size(360.0, 520.0)
        .on_navigation(
            move |target| match config::decide_navigation(&nav_origin, target) {
                NavDecision::Allow => true,
                NavDecision::OpenExternal => {
                    open_external(target);
                    false
                }
                NavDecision::Block => false,
            },
        )
        // target="_blank" / window.open: trang Rally → cửa sổ Rally Manager mới (in hóa đơn, phiếu thuê…);
        // trang ngoài → trình duyệt của máy.
        .on_new_window(move |target, _features| {
            match config::decide_navigation(&popup_origin, &target) {
                NavDecision::Allow if config::same_origin(&popup_origin, &target) => {
                    let app = popup_app.clone();
                    let origin = popup_origin.clone();
                    tauri::async_runtime::spawn(async move {
                        let n = DOC_COUNTER.fetch_add(1, Ordering::Relaxed) + 1;
                        let _ = build_window(
                            &app,
                            &origin,
                            &format!("{DOC_PREFIX}{n}"),
                            target,
                            (720.0, 900.0),
                        );
                    });
                }
                NavDecision::OpenExternal => open_external(&target),
                _ => {}
            }
            NewWindowResponse::Deny
        });
    let builder = if is_doc {
        builder.on_document_title_changed(|w, title| {
            let _ = w.set_title(&title);
        })
    } else {
        builder
    };
    builder.build()
}

/// Quyền cho trang trên máy chủ Rally. Cửa sổ chính: in, máy in, ngăn kéo. Cửa sổ hóa đơn: chỉ in.
fn register_capabilities(app: &tauri::App, origin: &Url) -> tauri::Result<()> {
    let pattern = config::remote_pattern(origin);
    app.add_capability(
        CapabilityBuilder::new("rally-manager-main")
            .remote(pattern.clone())
            .local(false)
            .window(MAIN_LABEL)
            .permission("allow-desktop-info")
            .permission("allow-list-printers")
            .permission("allow-get-printer-settings")
            .permission("allow-save-printer-settings")
            .permission("allow-print-page")
            .permission("allow-open-cash-drawer"),
    )?;
    app.add_capability(
        CapabilityBuilder::new("rally-manager-documents")
            .remote(pattern)
            .local(false)
            .window(format!("{DOC_PREFIX}*"))
            .permission("allow-desktop-info")
            .permission("allow-get-printer-settings")
            .permission("allow-print-page"),
    )?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let origin = config::server_origin();
    tauri::Builder::default()
        // Mở lần hai → đưa cửa sổ đang mở lên trước (không mở hai phiên trên cùng máy quầy).
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            focus_main(app)
        }))
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_filter(|label| label == MAIN_LABEL)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            commands::desktop_info,
            commands::list_printers,
            commands::get_printer_settings,
            commands::save_printer_settings,
            commands::print_page,
            commands::open_cash_drawer,
        ])
        .setup(move |app| {
            let config_dir = app.path().app_config_dir()?;
            app.manage(DesktopState {
                settings: Mutex::new(settings::load(&config_dir)),
                last_drawer: Mutex::new(None),
                printing: Mutex::new(false),
            });
            register_capabilities(app, &origin)?;
            build_window(
                app.handle(),
                &origin,
                MAIN_LABEL,
                config::start_url(&origin),
                (1280.0, 820.0),
            )?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("không khởi động được Rally Manager");
}
