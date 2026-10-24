//! Địa chỉ máy chủ Rally mà ứng dụng được phép mở, và quyết định điều hướng.
//!
//! Địa chỉ được gắn cứng lúc build (biến môi trường `RALLY_URL`), không đọc từ file cấu hình trên máy —
//! người dùng / phần mềm lạ không thể trỏ ứng dụng (và quyền in / mở ngăn kéo) sang trang khác.

use url::Url;

/// Máy chủ mặc định khi build không đặt `RALLY_URL`.
pub const DEFAULT_SERVER: &str = "https://rally-eight-tau.vercel.app";

/// Trang mở khi khởi động.
pub const START_PATH: &str = "/admin";

/// Đọc và kiểm tra địa chỉ máy chủ. Chỉ chấp nhận HTTPS; HTTP chỉ cho máy nội bộ khi `allow_local_http`
/// (bản debug, để thử với `npm run dev`).
pub fn parse_server(raw: &str, allow_local_http: bool) -> Result<Url, String> {
    let url = Url::parse(raw.trim()).map_err(|e| format!("RALLY_URL không hợp lệ: {e}"))?;
    let host = url.host_str().unwrap_or_default().to_ascii_lowercase();
    match url.scheme() {
        "https" if !host.is_empty() => {}
        "http" if allow_local_http && (host == "localhost" || host == "127.0.0.1") => {}
        _ => return Err(format!("RALLY_URL phải là https:// (nhận: {raw})")),
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err("RALLY_URL không được chứa tài khoản / mật khẩu".into());
    }
    // Chỉ giữ origin: đường dẫn / tham số trong RALLY_URL bị bỏ qua.
    Url::parse(&url.origin().ascii_serialization()).map_err(|e| e.to_string())
}

/// Máy chủ của bản build này.
pub fn server_origin() -> Url {
    let raw = option_env!("RALLY_URL")
        .filter(|s| !s.trim().is_empty())
        .unwrap_or(DEFAULT_SERVER);
    match parse_server(raw, cfg!(debug_assertions)) {
        Ok(url) => url,
        // Lỗi cấu hình lúc build: dùng máy chủ mặc định thay vì mở địa chỉ lạ.
        Err(_) => Url::parse(DEFAULT_SERVER).expect("DEFAULT_SERVER hợp lệ"),
    }
}

pub fn start_url(origin: &Url) -> Url {
    origin.join(START_PATH).expect("START_PATH hợp lệ")
}

/// Mẫu địa chỉ cho quyền gọi lệnh từ trang web (cú pháp URLPattern của Tauri).
pub fn remote_pattern(origin: &Url) -> String {
    format!("{}/*", origin.origin().ascii_serialization())
}

pub fn same_origin(a: &Url, b: &Url) -> bool {
    a.origin() == b.origin()
}

#[derive(Debug, PartialEq, Eq)]
pub enum NavDecision {
    /// Mở trong cửa sổ Rally Manager.
    Allow,
    /// Mở bằng trình duyệt mặc định của máy (Google Maps, trang pháp lý ngoài, mạng xã hội…).
    OpenExternal,
    /// Chặn hẳn (file:, javascript:, giao thức lạ).
    Block,
}

/// Quyết định khi trang muốn chuyển sang địa chỉ khác (cửa sổ chính hoặc cửa sổ mới).
pub fn decide_navigation(origin: &Url, target: &Url) -> NavDecision {
    if same_origin(origin, target) {
        return NavDecision::Allow;
    }
    match target.scheme() {
        "about" if target.path() == "blank" => NavDecision::Allow,
        // Tệp tải xuống do chính trang Rally tạo (xuất CSV…).
        "blob" => match Url::parse(target.path()) {
            Ok(inner) if same_origin(origin, &inner) => NavDecision::Allow,
            _ => NavDecision::Block,
        },
        // Trang cục bộ của ứng dụng (màn hình chờ).
        "tauri" => NavDecision::Allow,
        "http" | "https" if target.host_str() == Some("tauri.localhost") => NavDecision::Allow,
        "http" | "https" | "mailto" | "tel" => NavDecision::OpenExternal,
        _ => NavDecision::Block,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn u(s: &str) -> Url {
        Url::parse(s).unwrap()
    }

    #[test]
    fn server_must_be_https() {
        assert_eq!(
            parse_server("https://rally.vn/admin?x=1", false)
                .unwrap()
                .as_str(),
            "https://rally.vn/"
        );
        assert!(parse_server("http://rally.vn", false).is_err());
        assert!(parse_server("http://localhost:3000", false).is_err());
        assert!(parse_server("http://localhost:3000", true).is_ok());
        assert!(parse_server("http://10.0.0.5:3000", true).is_err());
        assert!(parse_server("https://user:pw@rally.vn", false).is_err());
        assert!(parse_server("file:///C:/x.html", true).is_err());
        assert!(parse_server("javascript:alert(1)", true).is_err());
    }

    #[test]
    fn default_server_is_valid() {
        let o = server_origin();
        assert_eq!(o.scheme(), "https");
        assert_eq!(start_url(&o).path(), "/admin");
        assert_eq!(
            remote_pattern(&o),
            format!("{}/*", o.origin().ascii_serialization())
        );
    }

    #[test]
    fn navigation_rules() {
        let o = u("https://rally.vn");
        assert_eq!(
            decide_navigation(&o, &u("https://rally.vn/admin/pos")),
            NavDecision::Allow
        );
        assert_eq!(
            decide_navigation(&o, &u("https://rally.vn:443/x")),
            NavDecision::Allow
        );
        assert_eq!(decide_navigation(&o, &u("about:blank")), NavDecision::Allow);
        assert_eq!(
            decide_navigation(&o, &u("blob:https://rally.vn/3f2a")),
            NavDecision::Allow
        );
        assert_eq!(
            decide_navigation(&o, &u("blob:https://evil.com/3f2a")),
            NavDecision::Block
        );
        assert_eq!(
            decide_navigation(&o, &u("https://rally.vn.evil.com/")),
            NavDecision::OpenExternal
        );
        assert_eq!(
            decide_navigation(&o, &u("http://rally.vn/")),
            NavDecision::OpenExternal
        );
        assert_eq!(
            decide_navigation(&o, &u("https://maps.google.com/?q=1")),
            NavDecision::OpenExternal
        );
        assert_eq!(
            decide_navigation(&o, &u("tel:0900000000")),
            NavDecision::OpenExternal
        );
        assert_eq!(
            decide_navigation(&o, &u("file:///C:/Windows/win.ini")),
            NavDecision::Block
        );
        assert_eq!(
            decide_navigation(&o, &u("javascript:alert(1)")),
            NavDecision::Block
        );
        assert_eq!(
            decide_navigation(&o, &u("ms-settings:printers")),
            NavDecision::Block
        );
        assert_eq!(
            decide_navigation(&o, &u("http://tauri.localhost/index.html")),
            NavDecision::Allow
        );
    }
}
