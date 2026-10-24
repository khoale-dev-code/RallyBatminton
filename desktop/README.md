# Rally Manager cho Windows (Tauri 2)

Cửa sổ Windows mở **trang quản trị Rally trên máy chủ** (`RALLY_URL` + `/admin`) và thêm đúng hai khả năng mà trình duyệt không có:
in hóa đơn không hộp thoại, mở ngăn kéo tiền. Không có giao diện riêng, không có database trên máy — website deploy bản mới thì
ứng dụng dùng ngay bản mới (Rally Manager báo "Có phiên bản mới").

```
desktop/
  package.json            @tauri-apps/cli (chỉ dùng để build)
  dist/index.html         màn hình chờ (Tauri bắt buộc có thư mục giao diện cục bộ)
  src-tauri/
    tauri.conf.json       tên, biểu tượng, bộ cài NSIS (cài cho người dùng hiện tại, tiếng Việt)
    build.rs              khai báo 6 lệnh → Tauri sinh quyền allow-<lệnh>
    src/config.rs         địa chỉ máy chủ (gắn lúc build), quy tắc điều hướng
    src/lib.rs            cửa sổ, quyền "remote" cho tên miền Rally, cửa sổ hóa đơn
    src/commands.rs       desktop_info, list_printers, get/save_printer_settings, print_page, open_cash_drawer
    src/settings.rs       cài đặt máy in của máy này (%APPDATA%\vn.rally.manager\printer-settings.json)
    src/printing/         Windows: winspool (lệnh thô ESC/POS), WebView2 Print (không hộp thoại)
```

## Build

| Cách | Lệnh | Bộ cài |
| --- | --- | --- |
| GitHub Actions (khuyến nghị) | *Actions → Rally Manager (Windows) → Run workflow*; hoặc đẩy tag `manager-v1.0.0` | Artifacts / Release |
| Máy Windows | Cài Rust (rustup) + Visual Studio Build Tools (C++), rồi `npm install`, `npm run build` | `src-tauri\target\release\bundle\nsis\` |

Máy chủ khác mặc định (`https://rally-eight-tau.vercel.app`): đặt biến môi trường `RALLY_URL` lúc build (chỉ nhận `https://`;
bản debug nhận thêm `http://localhost`). Không đọc địa chỉ từ file trên máy → không ai trỏ ứng dụng (và quyền máy in) sang trang khác.

Thử khi phát triển: `RALLY_URL=http://localhost:3000 npm run dev` (bản debug có DevTools). Kiểm thử Rust: `npm run check`.

## An toàn

- **Điều hướng**: cửa sổ chỉ ở trong origin của `RALLY_URL`. Link http(s) / mailto / tel ngoài → trình duyệt mặc định; file:, javascript:,
  giao thức lạ → chặn. `target="_blank"` trong Rally → cửa sổ Rally Manager mới (hóa đơn, phiếu thuê).
- **Quyền gọi lệnh** (Tauri ACL, `lib.rs`): chỉ trang có URL khớp `RALLY_URL/*`. Cửa sổ chính: cả 6 lệnh. Cửa sổ hóa đơn: chỉ
  `desktop_info`, `get_printer_settings`, `print_page`. Không cấp plugin / lệnh hệ thống nào (không đọc file, không chạy chương trình,
  không đóng / mở cửa sổ). Trang khác, iframe khác origin: không gọi được gì. Đã kiểm thử: lệnh plugin và lệnh không được cấp bị từ chối.
- **Tham số**: tên máy in phải nằm trong danh sách máy in của Windows; số bản 1–3; chân ngăn kéo 0/1; mở ngăn kéo cách nhau ≥ 1,5 giây;
  một lệnh in tại một thời điểm, chờ tối đa 60 giây.
- **Nhật ký**: web ghi `cash_drawer_events` trên máy chủ trước khi gọi `open_cash_drawer`; mở tay mà ghi lỗi → không mở.
- DevTools chỉ có ở bản debug. Bộ cài chưa ký số (SmartScreen sẽ hỏi lần đầu); muốn bỏ cảnh báo cần chứng thư ký mã (code signing)
  và cấu hình `bundle.windows.signCommand`.

## In ấn

- `print_page` in **trang đang mở** bằng WebView2 `Print` tới máy in đã chọn: dùng phần `@media print` của trang (phiếu 72mm, lề 4mm),
  nên mẫu hóa đơn sửa ở web là áp dụng ngay. Tiếng Việt in bằng font Windows như khi in từ trình duyệt.
- `open_cash_drawer` gửi `ESC p m 25 250` (RAW, máy dùng driver XPS thì `XPS_PASS`) tới máy in nối ngăn kéo.
- Lỗi: `NO_PRINTER` / `UNSUPPORTED` → web mở hộp thoại in; `PRINTER_UNAVAILABLE` / `PRINT_FAILED` → báo lỗi.
