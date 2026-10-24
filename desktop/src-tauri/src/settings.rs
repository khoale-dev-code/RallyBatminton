//! Cài đặt máy in / ngăn kéo tiền của RIÊNG máy này (lưu trong thư mục cấu hình của ứng dụng trên Windows,
//! không gửi lên máy chủ). Máy quầy khác nhau có máy in khác nhau.

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

const FILE_NAME: &str = "printer-settings.json";
const MAX_NAME_LEN: usize = 256;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PrinterSettings {
    /// Máy in hóa đơn (tên trong Windows). Trống = in qua hộp thoại như trình duyệt.
    pub receipt_printer: Option<String>,
    /// Số bản in mỗi lần (1–3).
    pub copies: u8,
    /// Có ngăn kéo tiền nối vào máy in (cổng RJ11 "DK" của máy in hóa đơn).
    pub drawer_enabled: bool,
    /// Máy in điều khiển ngăn kéo. Trống = dùng máy in hóa đơn.
    pub drawer_printer: Option<String>,
    /// Chân kích ngăn kéo: 0 (chân 2, phổ biến) hoặc 1 (chân 5).
    pub drawer_pin: u8,
    /// Tự mở ngăn kéo sau khi thu tiền mặt.
    pub auto_open_drawer: bool,
}

impl Default for PrinterSettings {
    fn default() -> Self {
        Self {
            receipt_printer: None,
            copies: 1,
            drawer_enabled: false,
            drawer_printer: None,
            drawer_pin: 0,
            auto_open_drawer: true,
        }
    }
}

fn clean_name(name: Option<String>) -> Option<String> {
    name.map(|n| n.trim().to_string()).filter(|n| !n.is_empty())
}

impl PrinterSettings {
    /// Chuẩn hóa và kiểm tra. `known` = danh sách máy in hiện có (None = không kiểm tra được, vd. ngoài Windows).
    pub fn validated(self, known: Option<&[String]>) -> Result<Self, String> {
        let mut s = self;
        s.receipt_printer = clean_name(s.receipt_printer);
        s.drawer_printer = clean_name(s.drawer_printer);
        for name in [&s.receipt_printer, &s.drawer_printer]
            .into_iter()
            .flatten()
        {
            if name.chars().count() > MAX_NAME_LEN || name.chars().any(char::is_control) {
                return Err("Tên máy in không hợp lệ.".into());
            }
            if let Some(list) = known {
                if !list.iter().any(|k| k == name) {
                    return Err(format!("Không tìm thấy máy in \"{name}\" trên máy này."));
                }
            }
        }
        if !(1..=3).contains(&s.copies) {
            return Err("Số bản in phải từ 1 đến 3.".into());
        }
        if s.drawer_pin > 1 {
            return Err("Chân ngăn kéo chỉ là 0 hoặc 1.".into());
        }
        if s.drawer_enabled && s.drawer_target().is_none() {
            return Err("Chọn máy in nối với ngăn kéo tiền.".into());
        }
        Ok(s)
    }

    /// Máy in dùng để mở ngăn kéo.
    pub fn drawer_target(&self) -> Option<&str> {
        self.drawer_printer
            .as_deref()
            .or(self.receipt_printer.as_deref())
    }
}

pub fn settings_path(config_dir: &Path) -> PathBuf {
    config_dir.join(FILE_NAME)
}

/// Đọc cài đặt; file hỏng / thiếu → mặc định (không làm ứng dụng không mở được).
pub fn load(config_dir: &Path) -> PrinterSettings {
    fs::read_to_string(settings_path(config_dir))
        .ok()
        .and_then(|raw| serde_json::from_str::<PrinterSettings>(&raw).ok())
        .and_then(|s| s.validated(None).ok())
        .unwrap_or_default()
}

pub fn save(config_dir: &Path, settings: &PrinterSettings) -> Result<(), String> {
    fs::create_dir_all(config_dir).map_err(|e| e.to_string())?;
    let raw = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    // Ghi file tạm rồi đổi tên: mất điện giữa chừng không làm hỏng file cũ.
    let target = settings_path(config_dir);
    let tmp = target.with_extension("json.tmp");
    fs::write(&tmp, raw).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &target).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn printers() -> Vec<String> {
        vec!["XP-80C".into(), "Microsoft Print to PDF".into()]
    }

    #[test]
    fn validates_names_and_ranges() {
        let known = printers();
        let ok = PrinterSettings {
            receipt_printer: Some("  XP-80C ".into()),
            drawer_enabled: true,
            ..Default::default()
        };
        let s = ok.validated(Some(&known)).unwrap();
        assert_eq!(s.receipt_printer.as_deref(), Some("XP-80C"));
        assert_eq!(s.drawer_target(), Some("XP-80C"));

        let missing = PrinterSettings {
            receipt_printer: Some("Máy lạ".into()),
            ..Default::default()
        };
        assert!(missing.validated(Some(&known)).is_err());

        let copies = PrinterSettings {
            copies: 0,
            ..Default::default()
        };
        assert!(copies.validated(None).is_err());
        let copies = PrinterSettings {
            copies: 4,
            ..Default::default()
        };
        assert!(copies.validated(None).is_err());

        let pin = PrinterSettings {
            drawer_pin: 2,
            ..Default::default()
        };
        assert!(pin.validated(None).is_err());

        let no_target = PrinterSettings {
            drawer_enabled: true,
            ..Default::default()
        };
        assert!(no_target.validated(None).is_err());

        let control = PrinterSettings {
            receipt_printer: Some("a\u{0}b".into()),
            ..Default::default()
        };
        assert!(control.validated(None).is_err());

        let blank = PrinterSettings {
            receipt_printer: Some("   ".into()),
            ..Default::default()
        };
        assert_eq!(blank.validated(Some(&known)).unwrap().receipt_printer, None);
    }

    #[test]
    fn separate_drawer_printer() {
        let s = PrinterSettings {
            receipt_printer: Some("XP-80C".into()),
            drawer_printer: Some("Microsoft Print to PDF".into()),
            drawer_enabled: true,
            ..Default::default()
        };
        assert_eq!(
            s.validated(Some(&printers())).unwrap().drawer_target(),
            Some("Microsoft Print to PDF")
        );
    }

    #[test]
    fn load_save_roundtrip_and_corrupt_file() {
        let dir = std::env::temp_dir().join(format!("rally-settings-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        assert_eq!(load(&dir), PrinterSettings::default());
        let s = PrinterSettings {
            receipt_printer: Some("XP-80C".into()),
            copies: 2,
            ..Default::default()
        };
        save(&dir, &s).unwrap();
        assert_eq!(load(&dir), s);
        fs::write(settings_path(&dir), "{not json").unwrap();
        assert_eq!(load(&dir), PrinterSettings::default());
        // Thiếu trường → giá trị mặc định cho trường đó.
        fs::write(settings_path(&dir), r#"{"receiptPrinter":"XP-80C"}"#).unwrap();
        assert_eq!(load(&dir).copies, 1);
        fs::write(settings_path(&dir), r#"{"copies":9}"#).unwrap();
        assert_eq!(load(&dir), PrinterSettings::default());
        let _ = fs::remove_dir_all(&dir);
    }
}
