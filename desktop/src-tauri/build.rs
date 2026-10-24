fn main() {
    // Đổi máy chủ (RALLY_URL) → build lại.
    println!("cargo:rerun-if-env-changed=RALLY_URL");
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "desktop_info",
            "list_printers",
            "get_printer_settings",
            "save_printer_settings",
            "print_page",
            "open_cash_drawer",
        ]),
    ))
    .expect("tauri-build");
}
