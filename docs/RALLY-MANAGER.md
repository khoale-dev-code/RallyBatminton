# Rally Manager — lộ trình phần mềm quản lý sân

Rally Manager là **trang quản trị hiện tại được cài thành ứng dụng** (PWA) trên máy tính quầy, điện thoại, máy tính bảng.
Không viết lại website, không thêm database riêng: website, Rally Manager và mọi thiết bị dùng chung Next.js + Supabase trên cloud.

```
Rally Website (khách đặt sân)  ─┐
Rally Manager (quầy, chủ sân)  ─┼─ HTTPS ─ Next.js (Vercel) ─ Supabase (Postgres + Auth + RLS + Realtime)
Rally Manager trên điện thoại ─┘                               SePay webhook → server
```

## Giai đoạn 1 — PWA (đã làm, bản vá v21)

| Thành phần | Làm gì | File |
| --- | --- | --- |
| Web App Manifest | Tên "Rally Manager", biểu tượng, mở `/admin` dạng cửa sổ riêng, lối tắt Lịch đặt sân / Thu tiền / Bán hàng. **Chỉ khu quản trị khai báo** — khách trên website không thấy lời mời cài | `public/manager.webmanifest`, `src/app/admin/layout.tsx`, `src/app/(admin-auth)/layout.tsx` |
| Biểu tượng | 192, 512, maskable 512, Apple 180, lối tắt 96 | `public/icons/manager-*.png` |
| Service Worker | Chỉ lưu tài nguyên tĩnh có mã băm (`/_next/static/`) và trang "Mất kết nối". **Không lưu trang, dữ liệu trang (RSC), API, Server Action** → không có dữ liệu khách / doanh thu trên máy. Mở trang luôn lấy từ máy chủ (ngoại lệ duy nhất: trang Quầy bán để bán khi mất mạng — mục 2c) | `public/rally-sw.js` |
| Trang mất kết nối | Hiện khi mở ứng dụng lúc không có mạng; tự tải lại khi có mạng | `public/offline.html` |
| Trạng thái kết nối | Thanh đỏ "Mất kết nối Internet…"; **chặn gửi form** khi mất mạng (không để thao tác treo rồi tự gửi lại → không thu tiền / đặt sân hai lần); có mạng lại → tải dữ liệu mới | `src/features/manager/components/manager-runtime.tsx` |
| Đồng bộ | Nghe sự kiện realtime `branch:<id>:availability` (đã có sẵn, không chứa dữ liệu cá nhân) → làm mới Tổng quan / Lịch đặt sân / Thu tiền sân khi khách đặt online, SePay xác nhận cọc, nhân viên khác thao tác. Để máy lâu (> 2 phút) rồi quay lại → tải mới. Database vẫn là nơi quyết định (khóa trùng giờ, chống ghi trùng) | như trên |
| Cập nhật | So mã phiên bản với `/api/version` (khi quay lại cửa sổ, mỗi 5 phút, khi có mạng lại) → "Đã có phiên bản mới — Tải lại" | `src/app/api/version/route.ts`, `next.config.ts` (`NEXT_PUBLIC_RALLY_BUILD`) |
| Cài đặt | Trang *Quản trị → Cài Rally Manager*: nút cài (Chrome / Edge), hướng dẫn iPhone / Android / máy tính | `src/app/admin/app/page.tsx` |
| Máy dùng chung | Mở trang đăng nhập (sau khi đăng xuất) → xóa bộ nhớ đệm của ứng dụng và dữ liệu tạm của phiên | `signed-out-cleanup.tsx` |

**Khi mất Internet** (quyết định từ đầu): xem lịch → cảnh báo dữ liệu có thể cũ; tạo đơn / thu tiền → không gửi; thanh toán → chỉ webhook ở máy chủ xác nhận; dữ liệu khách → không đọc từ bộ nhớ máy.
Chưa làm bán hàng / đặt sân offline hoàn toàn: cần đồng bộ và giải quyết xung đột (đơn tại quầy offline trùng giờ với đơn online) — là một module riêng (Offline POS) nếu thật sự cần.

### Kiểm tra trước khi giao cho chủ sân

| Kiểm tra | Kết quả mong muốn |
| --- | --- |
| Cài trên Windows (Chrome / Edge) | Có biểu tượng, mở cửa sổ riêng, vào thẳng `/admin` |
| Cài trên điện thoại (Android Chrome, iPhone Safari) | Có biểu tượng trên màn hình chính |
| Đăng nhập nhân viên / 2 lớp | Đúng quyền, đúng chi nhánh |
| Khách đặt online lúc đang mở Lịch đặt sân | Lịch tự cập nhật trong vài giây |
| Rút dây mạng | Thanh đỏ hiện; bấm Lưu / Thu tiền → báo chưa gửi; cắm lại → tự tải mới |
| Mở ứng dụng lúc không có mạng | Trang "Không có kết nối Internet" |
| Deploy bản mới | Ứng dụng đang mở báo "Có phiên bản mới" |
| Đăng xuất trên máy dùng chung | Người sau không thấy dữ liệu phiên trước |
| Điện thoại / máy tính bảng | Không tràn ngang, nút đủ lớn |

## Giai đoạn 2

### 2a. Thông báo đẩy (đã làm, bản vá v22 — `24_push_notifications.sql`, docs/HUONG-DAN-KY-THUAT.md mục 25)

```
bookings / bank_transactions / security_events ─trigger→ private.push_outbox (hàng đợi)
        ↓ (sau khi giữ sân, webhook SePay, cảnh báo bảo mật, Rally Manager thấy lịch đổi, cron đêm)
Next.js dispatchPendingPush ─web-push (VAPID, mã hóa aes128gcm)→ Google / Mozilla / Apple / Microsoft → thiết bị
        ↓
service worker (rally-sw.js) hiện thông báo → bấm → /admin/go → đúng chi nhánh, đúng trang
```

- Người nhận tính ở database theo vai trò + quyền chi nhánh + lựa chọn cá nhân (`push_preferences`).
- Thiết bị (`push_subscriptions`) chỉ nhận địa chỉ của dịch vụ đẩy chính thức (chặn ở database và ở máy chủ) — không thể dùng máy chủ Rally gửi yêu cầu tới địa chỉ tùy ý.
- 404 / 410 từ dịch vụ đẩy (thiết bị gỡ ứng dụng / tắt thông báo) → ngừng gửi tới thiết bị đó; 5 lỗi liên tiếp → ngừng.
- Nội dung không có tên / số điện thoại khách. Trigger lỗi không làm hỏng giao dịch gốc.
- Kiểm thử: SQL (người nhận theo quyền, lựa chọn, 410, gửi thử), trình duyệt (service worker hiện thông báo, đường dẫn lạ bị thay bằng /admin), dịch vụ đẩy giả lập giải mã đúng nội dung đã mã hóa.

### 2b. Ứng dụng Windows — Tauri (đã làm, bản vá v23 — `desktop/`, `25_cash_drawer.sql`, docs/HUONG-DAN-KY-THUAT.md mục 26)

```
Rally Manager.exe (Tauri 2, WebView2) ── mở https://<RALLY_URL>/admin (giao diện + dữ liệu vẫn từ máy chủ)
   │  chỉ trang trên RALLY_URL gọi được 6 lệnh:
   ├─ print_page        → WebView2 Print tới máy in đã chọn, không hộp thoại (mẫu @media print của trang)
   ├─ open_cash_drawer  → ESC/POS "ESC p" qua Windows Print Spooler (RAW) tới máy in nối ngăn kéo
   └─ list_printers / get / save_printer_settings / desktop_info
web: thu tiền mặt xong → log_cash_drawer_open (database kiểm quyền, ghi nhật ký) → open_cash_drawer
```

| Thành phần | Làm gì | File |
| --- | --- | --- |
| Cửa sổ & điều hướng | Chỉ ở trong tên miền Rally (gắn lúc build), link ngoài mở bằng trình duyệt, giao thức lạ bị chặn; hóa đơn mở cửa sổ riêng | `desktop/src-tauri/src/{config,lib}.rs` |
| Quyền | Tauri ACL "remote": cửa sổ chính 6 lệnh, cửa sổ hóa đơn chỉ in; không plugin / lệnh hệ thống nào | `desktop/src-tauri/src/lib.rs`, `build.rs` |
| In / ngăn kéo | WebView2 `Print` (không hộp thoại), winspool RAW `ESC p` | `desktop/src-tauri/src/printing/` |
| Cài đặt máy in | Lưu trên từng máy (`%APPDATA%\vn.rally.manager`) | `settings.rs`, `src/features/desktop/components/desktop-panel.tsx` |
| Web | `printPage()` thay `window.print()` (nút In, phiếu POS, hóa đơn, phiếu thuê); tự mở ngăn kéo khi thu tiền mặt; nút *Ngăn kéo* ở quầy bán | `src/features/desktop/*`, `use-pos.ts`, `checkout-terminal.tsx`, `pos-header.tsx` |
| Nhật ký | `cash_drawer_events` (chỉ thêm, hiện trong Nhật ký thay đổi) | `supabase/sql/25_cash_drawer.sql` |
| Build | GitHub Actions (windows-latest) → bộ cài NSIS; hoặc build trên máy Windows | `.github/workflows/rally-manager-windows.yml` |

Kiểm thử: Rust (điều hướng, cài đặt, lệnh ESC/POS) + chạy thật ứng dụng (bản Linux debug, máy in giả) — quyền theo cửa sổ / origin,
chặn điều hướng lạ, lệnh plugin bị từ chối; build kiểm tra mã Windows (`cargo check --target x86_64-pc-windows-msvc`).
**Chưa kiểm thử trên máy Windows thật với máy in nhiệt thật** — làm theo checklist dòng 18 trước khi dùng.

### 2c. Bán hàng khi mất mạng (đã làm, bản vá v24 — `26_offline_pos.sql`, docs/HUONG-DAN-KY-THUAT.md mục 27)

```
mất mạng ─ quầy bán: tiền mặt, không thông tin khách → IndexedDB "rally-offline-pos" (mã chống trùng = mã đơn, giờ bán thật)
           phiếu in mã tạm TAM-…, ngăn kéo vẫn mở (nhật ký ghi khi gửi được), tồn trên màn hình trừ đơn chờ
có mạng ─ ManagerRuntime / quầy bán gửi theo thứ tự giờ bán (Web Locks: một tab gửi) → record_offline_sale
           ok → xóa khỏi máy; mất mạng / treo 15s → giữ lại; giá đổi / hết hàng / quá 72h → "cần xử lý"
```

| Thành phần | File |
| --- | --- |
| Hàng đợi trên máy, đồng bộ, kiểm tra | `src/features/pos/offline/{lib,store,sync}.ts`, `lib.test.ts` |
| Trạng thái kết nối dùng chung | `src/features/manager/lib/connectivity.ts`, `manager-runtime.tsx` (cho form `data-offline-ok`, hỏi khi đăng xuất) |
| Giao diện | `offline-queue-panel.tsx`, `cart-panel.tsx` (khóa hình thức khác tiền mặt), `receipt-view.tsx` (phiếu tạm), `use-pos.ts` |
| Mở lại khi mất mạng | `public/rally-sw.js` — ngoại lệ duy nhất: lưu trang `/admin/pos` (mạng trước, bản lưu khi mất mạng; đăng xuất xóa) |
| Máy chủ | `record_offline_sale`, `recordOfflineSaleAction` (người gửi = người bán) |

### 2c. Tùy nhu cầu (chưa làm)

- **Ký số bộ cài** (bỏ cảnh báo SmartScreen) và **tự cập nhật ứng dụng Windows** (Tauri updater) — giao diện đã tự cập nhật từ máy chủ, chỉ cần khi đổi phần vỏ (`desktop/`).
- **Thông báo trong ứng dụng Windows** (thông báo hệ điều hành) — hiện dùng thông báo đẩy trên Chrome / Edge / điện thoại.

## Khi nào cần máy chủ riêng / nhiều chủ sân

- **Chỉ dùng cho Rally**: giữ Vercel + Supabase, cài PWA trên máy quầy — đơn giản và rẻ nhất.
- **Bán Rally cho nhiều chủ sân độc lập (SaaS)**: hệ thống hiện là *một thương hiệu nhiều chi nhánh*; chưa tách dữ liệu giữa các doanh nghiệp khác nhau. Cần thêm `tenant` (doanh nghiệp) vào mọi bảng + RLS theo tenant, đăng ký / giấy phép, cấu hình riêng (thương hiệu, SePay, pháp lý), thanh toán thuê bao. Tự chạy máy chủ (Docker / Node.js) thì phải lo reverse proxy (Nginx), HTTPS, sao lưu, giám sát 24/7.

## Quy trình phát triển lâu dài

Nên chuyển dần từ cập nhật bằng file `.ps1` sang Git:
1. Mã nguồn trên Git (GitHub riêng tư) — lịch sử từng thay đổi, quay lại bản cũ dễ.
2. Nhánh / Pull Request → Vercel tự tạo bản xem thử (Preview) nối Supabase thử nghiệm.
3. Kiểm tra `npm run check`, `npm run build`, `npm run check:secrets`, `98_security_audit.sql` trước khi gộp.
4. Gộp vào nhánh chính → Vercel triển khai production; Rally Manager trên các máy tự báo bản mới.
5. Theo dõi sau phát hành; lỗi thì *Instant Rollback* trên Vercel.

File `.ps1` vẫn hữu ích để cài môi trường / chạy kiểm tra, nhưng không nên là nơi duy nhất lưu lịch sử mã nguồn.
