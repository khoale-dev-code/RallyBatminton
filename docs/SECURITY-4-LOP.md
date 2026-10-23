# Rally — Bảo vệ 4 lớp

Không hệ thống nào chặn được 100% tấn công. Mục tiêu: **khó phá thành công, phát hiện sớm, thiệt hại nhỏ, khôi phục nhanh**.
Ký hiệu: ✅ đã có sẵn trong code / database · 👤 chủ sân cấu hình hoặc làm định kỳ.

| Lớp | Bảo vệ cái gì | Ở đâu |
| --- | --- | --- |
| 1. Chặn tấn công từ Internet | DDoS, bot, dò lỗ hổng, truy cập bất thường | Vercel Firewall + `src/proxy.ts` + Turnstile |
| 2. Bảo vệ nghiệp vụ đặt sân | Giữ sân ảo, spam đơn, gian lận cọc / hoàn tiền | Database (`23_security_hardening.sql`, `15_sepay_deposit.sql`) |
| 3. Bảo vệ tài khoản & dữ liệu | Quyền admin, thông tin khách, thanh toán | Supabase RLS + xác thực 2 lớp + khóa đăng nhập sai |
| 4. Phục hồi sau sự cố | Phát hiện, cảnh báo, sao lưu, khôi phục | Sự kiện an ninh + email, nhật ký, backup Supabase |

## Nguy cơ → cách bảo vệ

| Nguy cơ | Cách bảo vệ | Trạng thái |
| --- | --- | --- |
| DDoS làm website ngừng hoạt động | Vercel tự giảm thiểu DDoS (mọi gói, miễn phí); Attack Mode khi bị tấn công có chủ đích | ✅ tự động · 👤 bật Attack Mode khi cần |
| Bot dò lỗ hổng (`/.env`, `/wp-admin`, `*.php`…) | `src/proxy.ts` trả 404 ngay, không tốn lượt gọi database; quy tắc WAF chặn ở biên | ✅ · 👤 quy tắc WAF |
| **Bot giữ sân ảo** (chiếm hết giờ trống) | Giới hạn theo thiết bị + SĐT + sức chứa chi nhánh, tự trả sân hết hạn, khóa trùng giờ ở database, cảnh báo | ✅ |
| Dò mật khẩu admin | Khóa tài khoản sau 5 lần sai / 15 phút, khóa mạng sai hàng loạt, **xác thực 2 lớp** bắt buộc ở database | ✅ · 👤 bật 2 lớp |
| Đánh cắp thông tin khách | RLS mọi bảng, anon không ghi trực tiếp bảng nào, khóa `service_role` chỉ ở máy chủ | ✅ |
| Giả mạo thanh toán | Webhook SePay HMAC + timestamp, đối chiếu số tiền / mã đơn, mỗi giao dịch ghi một lần, cảnh báo khi bị gọi sai khóa | ✅ |
| Nhân viên sửa giá, hủy / hoàn tiền trái phép | Phân quyền theo chi nhánh; sửa giá, hoàn tiền, hủy giao dịch, đổi quyền chỉ chủ sân; nhật ký thay đổi mọi bảng chính | ✅ |
| Xóa dữ liệu, phá hệ thống | Soft-delete, chặn xóa cứng ở database; sao lưu độc lập; bảo vệ tài khoản Vercel / Supabase / GitHub | ✅ · 👤 sao lưu, 2 lớp cho tài khoản nền tảng |
| Spam yêu cầu làm tăng chi phí | Cache dữ liệu công khai, Turnstile, giới hạn tần suất; Vercel Spend Management | ✅ · 👤 bật cảnh báo chi phí |

---

## Lớp 1 — Chặn tấn công từ Internet

### Có sẵn
- **DDoS**: Vercel tự giảm thiểu cho mọi deployment, không cần cấu hình.
- **Đường dẫn dò lỗ hổng** (`/.env`, `/.git`, `/wp-admin`, `/wp-login.php`, `*.php`, `*.sql`, `/phpmyadmin`…) → 404 ngay trong `src/proxy.ts` (`src/lib/probe-path.ts`).
- **Turnstile** (Cloudflare) xác minh ở máy chủ cho giữ sân, tra cứu, đăng ký, gửi yêu cầu dữ liệu. Không cần chuyển website sang Cloudflare.
- Header bảo mật: CSP, HSTS, COOP, X-Frame-Options.

### 👤 Cấu hình Vercel Firewall (Dashboard → Project → Firewall)
Gói Hobby có **3 quy tắc tùy chỉnh** (trong đó 1 quy tắc giới hạn tốc độ); gói Pro nhiều hơn và có *Persistent actions* (chặn IP vi phạm trong N phút).
Luôn tạo quy tắc với hành động **Log** trước, xem lưu lượng 10 phút, rồi mới đổi sang Deny / Challenge.
Có thể gõ mô tả tiếng Anh vào ô *Describe rule* để Vercel tự tạo quy tắc.

1. **Cho qua webhook và lịch chạy** (đặt TRÊN CÙNG) — hành động *Bypass*:
   `Path starts with /api/webhooks/` OR `Path starts with /api/cron/`.
   Lý do: SePay / Vercel Cron không phải trình duyệt, không giải được thử thách JavaScript.
2. **Chặn dò lỗ hổng** — *Deny*, mô tả:
   `Block requests where path ends with .env, .php, .sql, .bak or path contains /wp-admin, /wp-login, /.git, /phpmyadmin`
3. **Giới hạn tốc độ thao tác** — *Rate limit* 30 yêu cầu / 60 giây / IP, hết hạn mức → 429:
   `Method is POST` AND `Path does not start with /admin` AND `Path does not start with /api/webhooks`.
   (Server Action của Next.js là POST. Trang quản trị loại ra để nhân viên tại quầy dùng chung Wi-Fi không bị chặn.)
4. **Bot Management → Bot Protection**: chọn *Log* trước một tuần; nếu không chặn nhầm khách thì chuyển *Challenge*. Quy tắc 1 phải có trước.
5. **AI Bots**: *Log* (hoặc *Deny* nếu không muốn bị thu thập nội dung).
6. **Firewall alerts** + **Spend Management** (gói Pro): nhận email khi lưu lượng / chi phí tăng bất thường.

Ngưỡng phải hiệu chỉnh theo lưu lượng thật để không chặn nhầm khách dùng chung Wi-Fi quán hoặc mạng di động (nhiều người chung một IP).

### Khi bị DDoS / bot quy mô lớn — biện pháp khẩn cấp
1. Vercel → Firewall → Bot Management → **Attack Mode: Enable**. Miễn phí mọi gói; khách phải qua thử thách trình duyệt. Bot tìm kiếm đã xác minh và Cron / Functions của chính dự án vẫn qua được.
2. SePay có thể bị chặn trong lúc bật Attack Mode → tiền cọc vẫn về tài khoản; sau đó vào *Quản trị → Giao dịch ngân hàng → Đối soát ngay* (hoặc chờ lịch đối soát) để tự khớp đơn.
3. Nếu bot đang giữ sân ảo: *Quản trị → Bảo mật → Tạm dừng đặt sân online* (khách thấy thông báo, nhân viên vẫn đặt tại quầy).
4. Hết tấn công: tắt Attack Mode, mở lại đặt sân online.

---

## Lớp 2 — Bảo vệ nghiệp vụ đặt sân (quan trọng nhất)

OWASP gọi đây là *Denial of Inventory*: bot không cần phá server, chỉ cần giữ hết giờ trống là khách thật không đặt được. Với Rally, tài nguyên đó là **khung giờ sân**.

Mọi kiểm tra nằm **trong database** (`create_guest_booking_hold_v2`), không thể lách bằng cách gọi thẳng API:

| Nguyên tắc | Cách làm | Mặc định (đổi ở *Quản trị → Bảo mật*) |
| --- | --- | --- |
| 1. Giới hạn giữ chỗ chưa thanh toán | Theo **thiết bị / mạng** (mã băm IP, không lưu IP thật): số lượt đang giữ, số lượt / giờ, số SĐT khác nhau / ngày. Theo **SĐT**: 4 lượt / giờ, 2 lượt đang giữ | 3 đang giữ · 6 / giờ · 4 SĐT / ngày |
| 2. Tự trả sân khi hết hạn | Giờ trống không tính lượt giữ đã quá hạn; lượt mới tự hủy lượt hết hạn chồng giờ; hằng đêm đánh dấu hết hạn. Thời gian giữ theo chi nhánh (công bố trong Chính sách hủy sân) | 10 phút / chi nhánh |
| 3. Khóa giao dịch ở database | Ràng buộc `bookings_no_overlap` (exclusion constraint): hai người bấm cùng giờ cùng sân → chỉ một người giữ được. Khóa tuần tự theo SĐT / thiết bị / chi nhánh để không lách giới hạn bằng gửi song song | luôn bật |
| 4. Phát hiện bất thường, tăng xác minh theo rủi ro | SĐT **giữ rồi bỏ** (để hết hạn, không cọc) ≥ 2 lần / 7 ngày → chỉ giữ 1 lượt, thời gian giữ 7 phút; ≥ 5 lần → tạm chặn giữ online (tự hết khi qua 7 ngày). **Sức chứa chi nhánh**: tối đa (số sân × 3, ít nhất 6) lượt giữ chờ thanh toán cùng lúc — chặn tấn công dùng nhiều SĐT / nhiều mạng | 2 / 5 lần · 7 phút · ×3, tối thiểu 6 |

**Không cấm vĩnh viễn.** Hủy chủ động không bị tính; giới hạn tự hết sau cửa sổ ngày. Khách quen bị chặn nhầm:
nhân viên có quyền *thao tác đặt sân* mở *Khách hàng → hồ sơ khách → Giữ sân online → Tin cậy* (ghi lý do, chọn thời hạn). Khách *Tin cậy* không bị tính vào mọi giới hạn tự động.
Ngược lại có thể *Tạm chặn giữ online* một số điện thoại phá rối. Mọi thay đổi ghi nhật ký.

Bị chặn → khách thấy lời nhắn gọi chi nhánh; chủ sân nhận email khi có dấu hiệu lạm dụng (thiết bị vượt giới hạn, SĐT bị chặn, chi nhánh chạm sức chứa).

Gian lận cọc / hoàn tiền:
- Đơn chỉ chuyển "đã xác nhận" khi **máy chủ** nhận webhook SePay hợp lệ (HMAC) và **số tiền + mã đơn khớp**; trình duyệt báo "đã chuyển" không có tác dụng.
- Mỗi mã giao dịch ngân hàng chỉ ghi một lần (ràng buộc duy nhất). Chuyển thiếu / dư / sau hạn → trạng thái *Cần xử lý* + email.
- Hoàn tiền, hủy giao dịch: chỉ chủ sân, bắt buộc lý do, số tiền hoàn ≤ đã thu, có nhật ký. Nên bật *bắt buộc 2 lớp cho chủ sân* để lộ mật khẩu cũng không hoàn tiền được.

---

## Lớp 3 — Bảo vệ tài khoản và dữ liệu

### Xác thực 2 lớp (MFA, ứng dụng Google / Microsoft Authenticator)
TOTP của Supabase miễn phí và bật sẵn cho mọi dự án. Cách triển khai an toàn, không tự khóa mình:

1. Chủ sân: *Quản trị → Bảo mật → Bật xác thực 2 lớp* → quét QR → nhập mã 6 số.
2. Đăng xuất, đăng nhập lại (nhập mã) → *Bắt buộc xác thực 2 lớp → Chủ sân* → Lưu. Database từ chối bật mục này nếu phiên chưa nhập mã.
3. Báo nhân viên chuẩn bị điện thoại → bật *Nhân viên*. Nhân viên chưa cài sẽ được dẫn tới trang cài ở lần đăng nhập tới.

Khi đã bắt buộc, **database** (hàm `is_owner()` / `permitted_branch_ids()` mà mọi RLS dùng) chỉ cấp quyền cho phiên `aal2`. Kẻ có mật khẩu nhưng không có điện thoại không đọc / sửa được dữ liệu nào, kể cả khi gọi thẳng API Supabase.

Nhân viên mất điện thoại: chủ sân (đang ở phiên 2 lớp) bấm *Đặt lại* ở mục *Tài khoản quản trị*.
**Chủ sân mất điện thoại** (khôi phục khẩn cấp): Supabase Dashboard → SQL Editor:
```sql
update public.security_settings set require_owner_mfa = false where id;
```
rồi Authentication → Users → tài khoản chủ sân → xóa MFA factor; đăng nhập và cài lại ngay.

### Có sẵn
- **Khóa đăng nhập sai**: 5 lần sai / 15 phút → khóa tài khoản đó 15 phút; một mạng sai 30 lần / 15 phút → khóa mạng đó (dò mật khẩu hàng loạt). Áp dụng cả đăng nhập quản trị, tài khoản thành viên và nhập mã 2 lớp. Không lộ tài khoản có tồn tại hay không.
- RLS mọi bảng; anon không ghi trực tiếp bảng nào (`98_security_audit.sql` kiểm tra).
- Khóa bí mật (`SUPABASE_SECRET_KEY`, `SEPAY_WEBHOOK_SECRET`, `TURNSTILE_SECRET_KEY`…) chỉ dùng ở máy chủ (`server-only`); `npm run check:secrets` quét bản build.
- Phân quyền theo chi nhánh + từng quyền; mỗi nhân viên một tài khoản (không dùng chung).

### 👤 Việc của chủ sân
- Bật 2 lớp cho **tài khoản Vercel, Supabase, GitHub, email chủ sân** — kẻ chiếm được các tài khoản này vượt qua mọi lớp trong code.
- Không chia sẻ tài khoản chủ sân; giữ ít tài khoản owner nhất có thể (`98_security_audit.sql` dòng 10).
- Đổi khóa ngay khi nghi lộ (xem *Sự cố* bên dưới).

---

## Lớp 4 — Phục hồi sau sự cố

### Cảnh báo cho người vận hành (không làm phiền khách)
*Quản trị → Bảo mật → Sự kiện an ninh* + email (cần `RESEND_API_KEY`; người nhận = *Cài đặt thương hiệu → Email cảnh báo*, trống thì email chủ sân):

| Sự kiện | Mức | Gửi email |
| --- | --- | --- |
| Chi nhánh chạm giới hạn lượt giữ chờ thanh toán | Nghiêm trọng | Có |
| Thiết bị / mạng giữ sân quá nhiều; SĐT bị tạm chặn | Cần chú ý | Có |
| Tài khoản quản trị bị khóa do sai mật khẩu | Cần chú ý | Có |
| Một mạng sai mật khẩu hàng loạt | Nghiêm trọng | Có |
| Webhook thanh toán sai khóa ≥ 3 lần / 10 phút | Nghiêm trọng | Có |
| Gỡ / tắt xác thực 2 lớp, tạm dừng đặt sân | Cần chú ý | Có |
| Bật 2 lớp, nhân viên đổi chế độ giữ sân của khách | Thông tin | Không |

Sự kiện cùng loại + cùng đối tượng trong 1 giờ được gộp (đếm số lần). Lịch hằng đêm gửi bù email chưa gửi được và dọn dấu vết cũ.
Thêm: Vercel Firewall alerts, Spend Management, Supabase usage alerts (Dashboard → Organization → Billing).

### 👤 Sao lưu
- **Supabase gói Pro**: sao lưu tự động hằng ngày (giữ 7 ngày). Thêm **Point-in-Time Recovery** (add-on trả phí) để khôi phục tới gần đúng thời điểm sự cố. Gói Free không có bản sao lưu tải về — cần tự sao lưu.
- **Sao lưu độc lập** (ngoài Supabase), ít nhất mỗi tuần và trước mỗi lần chạy SQL mới — máy Windows cài *PostgreSQL client tools* (cùng phiên bản lớn với Supabase):
  ```powershell
  $d = Get-Date -Format yyyyMMdd
  pg_dump "postgresql://postgres.[project-ref]:[mật-khẩu-db]@[host-pooler]:5432/postgres" -Fc --no-owner -f "D:\rally-backup\rally-$d.dump"
  ```
  Chuỗi kết nối: Supabase → Project Settings → Database → Connection string (Session pooler). Lưu file ở ổ mã hóa / két ngoài, **không** đưa lên Git. Ảnh trong Storage sao lưu riêng (tải thư mục bucket).
- **Diễn tập khôi phục mỗi quý**: tạo project Supabase mới → `pg_restore --no-owner -d "<chuỗi kết nối project mới>" rally-YYYYMMDD.dump` → trỏ bản chạy thử (Vercel Preview) vào project mới → kiểm tra đặt sân, đăng nhập. Sao lưu chưa từng khôi phục thử = chưa có sao lưu.
- Bảo vệ tài khoản triển khai: 2 lớp cho Vercel / GitHub / Supabase; chỉ chủ sân có quyền Owner.

### Kịch bản sự cố

**Bot giữ sân ảo** — email "chạm giới hạn" / "thiết bị giữ quá nhiều":
1. *Lịch đặt sân*: xem các lượt *Giữ chỗ* bất thường (cùng giờ, tên lạ). Hết hạn tự trả sân; có thể hủy thủ công.
2. Nặng: *Bảo mật → Tạm dừng đặt sân online* + Vercel Attack Mode. Siết ngưỡng (vd. thiết bị 1 lượt đang giữ).
3. Khách thật bị chặn nhầm gọi đến → hồ sơ khách → *Tin cậy*.

**Nghi lộ mật khẩu / tài khoản admin**: đổi mật khẩu → *Bảo mật* xem sự kiện đăng nhập → bật bắt buộc 2 lớp → *Nhật ký thay đổi* xem tài khoản đó đã sửa gì → khóa tài khoản nhân viên nếu cần (*Nhân viên → hồ sơ → mục Tài khoản*).

**Nghi lộ khóa bí mật** (`SUPABASE_SECRET_KEY`, `SEPAY_WEBHOOK_SECRET`…): tạo khóa mới (Supabase → API Keys; SePay → Webhook) → cập nhật Vercel Environment Variables → Redeploy → thu hồi khóa cũ → xem *Nhật ký thông báo thanh toán* và *Nhật ký thay đổi* trong khoảng thời gian bị lộ.

**Webhook giả** (email "webhook bị từ chối"): đơn không bị xác nhận sai (đã chặn). Nếu chính bạn vừa đổi khóa ở SePay → cập nhật `SEPAY_WEBHOOK_SECRET` cho khớp. Nếu không → cân nhắc `SEPAY_ALLOWED_IPS` và chặn IP trong Vercel Firewall.

**Dữ liệu bị xóa / sửa sai hàng loạt**: dữ liệu lịch sử chỉ soft-delete nên phần lớn khôi phục được bằng *Nhật ký thay đổi*. Nặng: khôi phục bằng PITR / bản sao lưu (khôi phục vào project mới, đối chiếu rồi mới chuyển). Ghi biên bản.

**Lộ dữ liệu cá nhân khách**: xử lý theo `docs/GO-LIVE-CHECKLIST.md` (báo cơ quan chuyên trách trong 72 giờ khi pháp luật yêu cầu, thông báo khách bị ảnh hưởng).

---

## Việc định kỳ
- **Mỗi ngày**: xem email cảnh báo; *Bảo mật → Sự kiện* có mục chưa xem.
- **Mỗi tuần**: sao lưu độc lập (`pg_dump`).
- **Mỗi tháng**: chạy `supabase/tests/98_security_audit.sql` (không còn `WARN`), xem Vercel Firewall traffic, rà danh sách tài khoản quản trị.
- **Mỗi quý**: diễn tập khôi phục; rà ngưỡng chống lạm dụng theo lưu lượng thật; đổi mật khẩu tài khoản chủ sân.
