# Rally — Checklist trước khi chạy thật (Security & Privacy Upgrade 2026)

Bảo vệ 4 lớp (chống bot, giữ sân ảo, 2 lớp, phục hồi): [`docs/SECURITY-4-LOP.md`](SECURITY-4-LOP.md).

Căn cứ: Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 và Nghị định 356/2025/NĐ-CP (hiệu lực 01/01/2026).
Ký hiệu: ✅ hệ thống đã làm sẵn · 👤 chủ sân phải tự làm / xác nhận.

| # | Hạng mục | Hệ thống đã làm | Chủ sân cần làm |
| --- | --- | --- | --- |
| 1 | Văn bản pháp lý công khai ở chân trang | ✅ 4 văn bản `/legal/*`, có phiên bản, ngày hiệu lực, lịch sử | 👤 Rà soát nội dung bản nháp (nên nhờ luật sư), điền tên doanh nghiệp / địa chỉ / đầu mối dữ liệu ở *Cài đặt → Pháp lý & dữ liệu cá nhân*, đăng phiên bản chính thức |
| 2 | Chính sách hủy sân & hoàn cọc khớp cấu hình | ✅ Bảng đọc trực tiếp cấu hình từng chi nhánh, cùng công thức với lúc khách hủy | 👤 Kiểm tra giữ chỗ / % cọc / mốc hoàn ở *Chi nhánh* đúng ý; xác nhận cam kết "hoàn trong 3 ngày làm việc" trong văn bản |
| 3 | Thu thập tối thiểu, đúng mục đích | ✅ Đặt sân chỉ họ tên + SĐT; vật cầm cọc chỉ ghi loại giấy tờ; mã băm tự xóa 1 ngày; đơn trên trình duyệt tự xóa 30 ngày | 👤 Dặn nhân viên không ghi số CCCD / thông tin nhạy cảm vào ghi chú |
| 4 | Đồng ý nhận tin tách riêng, không chọn sẵn | ✅ Form đặt sân và đăng ký: 2 ô riêng, không chọn sẵn; lưu bằng chứng theo phiên bản | 👤 Chỉ gửi tin khuyến mãi cho khách có `Nhận tin = Có` |
| 5 | Cookie theo dõi chỉ chạy khi đồng ý | ✅ Hiện chỉ dùng cookie cần thiết, không có công cụ theo dõi; CSP chặn script lạ | 👤 Nếu thêm Google Analytics / Meta Pixel: phải thêm hộp đồng ý cookie và cập nhật Chính sách cookie **trước** |
| 6 | Turnstile xác minh ở máy chủ, khóa production | ✅ Siteverify + action + hostname; production thiếu khóa thì từ chối | 👤 Thay khóa thử nghiệm bằng khóa thật trên Vercel (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`), thêm tên miền thật vào widget ở Cloudflare |
| 7 | RLS theo từng vai trò | ✅ RLS mọi bảng; anon không ghi trực tiếp bảng nào; script `supabase/tests/98_security_audit.sql` | 👤 Chạy `98_security_audit.sql` trên Supabase thật — không còn dòng `WARN`; chạy `99_verify_schema.sql` — mọi dòng `t` |
| 8 | Webhook SePay xác thực + lũy đẳng | ✅ HMAC-SHA256 trên dữ liệu gốc + timestamp ±5 phút (hoặc API Key); unique (provider, mã giao dịch); nhật ký mọi lần gọi | 👤 Chọn HMAC ở SePay, đặt `SEPAY_WEBHOOK_SECRET`; (tùy chọn) `SEPAY_ALLOWED_IPS`; bật đối soát dự phòng (mục 16) |
| 9 | Khóa bí mật không lộ | ✅ Khóa chỉ dùng ở máy chủ (`server-only`); `npm run check:secrets` quét bản build | 👤 Chạy `npm run build && npm run check:secrets` trước mỗi lần deploy; không commit `.env.local`; đổi khóa ngay nếu nghi lộ |
| 10 | Bàn phím, focus, alt, tương phản | ✅ Rà soát axe-core WCAG 2.1 AA các trang khách, đã sửa lỗi tìm thấy | 👤 Thử nhanh bằng bàn phím (Tab) trên điện thoại / máy tính khi đổi giao diện |
| 11 | Bản quyền ảnh, nội dung quảng cáo, phản hồi thật | — | 👤 Giữ giấy phép / nguồn của mọi ảnh trong `public/images`; không đăng đánh giá, lời khen không có thật |
| 12 | Backup, migration, rollback | ✅ SQL chạy lại an toàn; patch `.ps1` có `-Rollback`; dữ liệu lịch sử chỉ soft-delete | 👤 Bật Point-in-Time Recovery / backup hằng ngày ở Supabase; sao lưu trước khi chạy SQL mới |
| 13 | Kiểm thử đặt sân, thanh toán, hủy, hoàn tiền | ✅ Kiểm thử tự động (unit + SQL + trình duyệt) cho các luồng chính | 👤 Đặt thử 1 đơn thật trên production: giữ sân → chuyển khoản → tự xác nhận → hủy → hoàn tiền |
| 14 | Xác thực 2 lớp cho quản trị | ✅ MFA (TOTP) kiểm ở database; khóa đăng nhập sai nhiều lần | 👤 Chạy `23_security_hardening.sql`; bật 2 lớp cho mình → bật *Bắt buộc* cho chủ sân, rồi nhân viên (*Quản trị → Bảo mật*). Bật 2 lớp cho tài khoản Vercel, Supabase, GitHub, email |
| 15 | Chống giữ sân ảo | ✅ Giới hạn theo thiết bị / SĐT / sức chứa chi nhánh, tự trả sân hết hạn, cảnh báo email | 👤 Xem lại ngưỡng sau 1–2 tuần chạy thật; nhân viên biết cách đánh dấu khách *Tin cậy* khi bị chặn nhầm |
| 16 | Vercel Firewall & khẩn cấp | ✅ Chặn đường dẫn dò lỗ hổng trong `proxy.ts` | 👤 Tạo quy tắc theo `docs/SECURITY-4-LOP.md` (Bypass webhook/cron trước, rồi Deny dò lỗ hổng, Rate limit POST, Bot Protection *Log* → *Challenge*); biết cách bật Attack Mode |
| 17 | Rally Manager & thông báo đẩy | ✅ PWA không lưu dữ liệu trên máy; thông báo theo quyền, không có tên / SĐT khách | 👤 Chạy `24_push_notifications.sql`; `npm run push:keys` → thêm 3 biến vào Vercel; cài Rally Manager + bật thông báo trên máy quầy / điện thoại chủ sân, bấm *Gửi thử* |

## Việc định kỳ

- **Mỗi ngày làm việc**: mở *Quản trị → Dữ liệu cá nhân*, phản hồi yêu cầu mới trong 2 ngày làm việc.
- **Mỗi tháng**: xem *Nhật ký thông báo thanh toán* (có lần "Bị từ chối" lạ?), chạy `98_security_audit.sql`.
- **Mỗi tuần / quý**: sao lưu độc lập, diễn tập khôi phục — xem `docs/SECURITY-4-LOP.md`.
- **Khi có sự cố lộ dữ liệu**: xử lý ngay, báo cơ quan chuyên trách trong 72 giờ khi pháp luật yêu cầu, thông báo khách bị ảnh hưởng; ghi biên bản.

## Cần tư vấn pháp lý

- **Chuyển dữ liệu ra nước ngoài**: Supabase / Vercel có thể đặt máy chủ ngoài Việt Nam — kiểm tra nghĩa vụ hồ sơ đánh giá tác động chuyển dữ liệu ra nước ngoài theo Luật 91/2025 và Nghị định 356/2025 (hoặc chọn vùng máy chủ phù hợp).
- Hộ kinh doanh / doanh nghiệp siêu nhỏ, nhỏ có thể được miễn hoặc lùi một số nghĩa vụ (đánh giá tác động, nhân sự bảo vệ dữ liệu) — trừ khi xử lý dữ liệu nhạy cảm hoặc số lượng lớn. Xác nhận với luật sư.
