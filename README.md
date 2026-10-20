# Rally Badminton

Hệ thống cho một thương hiệu sân cầu lông nhiều chi nhánh: website cho khách (xem chi nhánh, bảng giá, đặt sân không cần tài khoản, đồ uống/vật phẩm, thuê thiết bị) và trang quản trị cho chủ sân và nhân viên (lịch đặt sân, thu tiền, bán hàng, tồn kho, cho thuê, nhân sự, chấm công QR, bảng lương).

**Công nghệ:** Next.js 16 (App Router, Server Actions, `proxy.ts`), React 19, TypeScript strict (không dùng `any`), Tailwind CSS v4, Supabase (Auth, PostgreSQL + RLS, Storage, Realtime), Zod 4, Vitest.

---

## 1. Yêu cầu

| Thành phần | Phiên bản |
| --- | --- |
| Node.js | 20.9 trở lên (khuyến nghị 22 LTS) |
| npm | đi kèm Node |
| Supabase | Một project (gói Free dùng được) |
| Windows PowerShell | 5.1 hoặc PowerShell 7 (chỉ cần nếu dùng script cài đặt) |

## 2. Cài nhanh

1. Giải nén gói vào `D:\freetime\rally` (hoặc thư mục bất kỳ).
   - Nếu đã có dự án ở thư mục khác và muốn chép đè có kiểm soát, xem mục 7 (script PowerShell).
2. Tạo database trên Supabase (mục 3).
3. Tạo file `.env.local` (mục 4).
4. Chạy:

```powershell
cd D:\freetime\rally
npm install
npm run dev
```

Mở http://localhost:3000 (website khách) và http://localhost:3000/login (quản trị).

## 3. Database Supabase

Vào **Supabase Dashboard → SQL Editor**, mở từng file trong `supabase/sql/`, dán và bấm **Run** theo đúng thứ tự:

| Thứ tự | File | Bắt buộc | Nội dung |
| --- | --- | --- | --- |
| 1 | `00_init_schema.sql` | Có | Bảng, ràng buộc, chỉ mục, trigger, RLS, Storage bucket `public-media` |
| 2 | `01_core_rpc.sql` | Có | Hàm nghiệp vụ: giữ sân, xác nhận, thu tiền, bán hàng, kho, thuê, QR, chốt lương |
| 3 | `02_app_rpc.sql` | Có | Hàm phục vụ giao diện: danh mục công khai, tạo sản phẩm, phân quyền, xem trước lương |
| 4 | `03_jobs_optional.sql` | Không | Bật pg_cron: tự hết hạn giữ chỗ, tự hoàn tất đơn đã chơi xong |
| 5 | `04_seed_demo_optional.sql` | Không | Dữ liệu mẫu: 2 chi nhánh, 10 sân, bảng giá, đồ uống, đồ thuê |
| 6 | `05_product_details.sql` | Có | Quản lý sản phẩm: trích dẫn, đơn vị tính, nhãn, SEO, kênh bán (website/quầy), giá vốn, mã vạch; hàm tạo/sửa sản phẩm một lần lưu. Chạy lại an toàn |
| 7 | `06_product_tax.sql` | Có | Thuế sản phẩm: có/không chịu thuế, nhóm ngành nghề (thuế trực tiếp), mức VAT (khấu trừ), tên trên hóa đơn; cài đặt thuế thương hiệu; chụp thuế vào từng dòng đơn bán. Chạy sau 05 |
| 8 | `07_units_options.sql` | Có | Đơn vị tính quy đổi (lốc, thùng… trừ kho theo đơn vị cơ bản), tên thuộc tính biến thể (Kích thước, Màu sắc, Dung tích…); bán hàng/hủy đơn theo đơn vị. Chạy sau 06 |
| 9 | `08_seed_full_demo_optional.sql` | Không | Dữ liệu chạy thử đầy đủ (cần 04 + chủ sân): 40 khách, 8 nhân viên và lịch ca, bảng lương tháng trước đã chốt, lịch đặt sân 3 tuần (đã chơi, bỏ không đến, hủy hoàn cọc, sắp tới), đơn bán, phiếu thuê. Tính theo ngày chạy |
| 10 | `09_rental_pricing.sql` | Có | Cho thuê: giá theo hình thức (tại sân / hết trận / mang ra ngoài), gắn đồ thuê vào lượt đặt sân, vật cầm cọc khi mang về; phụ phí trả trễ tự tính (ân hạn, block, giá block, trần) và chỉ giảm khi có lý do. Chạy sau 07 |
| 11 | `10_seed_rental_demo_optional.sql` | Không | Dữ liệu chạy thử cho thuê (cần 04 + 09): gói hết trận / mang về và bảng cho thuê hôm nay (đang thuê, sắp hạn, ân hạn, trễ, đã trả có phụ phí) |
| 12 | `11_members.sql` | Có | Tài khoản thành viên cho khách (tùy chọn — vẫn đặt sân không cần đăng nhập): đăng ký SĐT/email/Google, đơn của tôi, nhận đơn cũ bằng mã + SĐT, điểm tích lũy & hạng (Bạc 300 · Vàng 1.000 · Kim cương 3.000 điểm; 1 điểm / 10.000đ). Tài khoản khách và nhân sự không trùng nhau. Chạy sau 09 |
| 13 | `12_branch_map.sql` | Có | Bản đồ Google nhúng cho từng chi nhánh (trang Giới thiệu `/about`). Dán mã iframe ở *Quản trị → Chi nhánh*; để trống thì tự hiện bản đồ theo địa chỉ. Chạy sau 11 |
| 14 | `13_performance.sql` | Nên chạy | Tăng tốc: chỉ mục tìm kiếm khách/thành viên/sản phẩm (pg_trgm), nhật ký, bảng lương; danh sách thành viên chỉ tính số đơn cho trang đang xem. Không đổi dữ liệu. Chạy sau 12 |
| 15 | `14_guest_phone_lookup.sql` | Có | Khách vãng lai quên mã đơn: tra bằng số điện thoại ở `/booking/lookup` (đơn hôm nay, sắp tới, lịch sử 6 tháng). Mã đơn che bớt; nhập đúng họ tên người đặt mới xem đầy đủ / tự hủy. Giới hạn số lần thử. Chạy sau 13 |
| 16 | `15_sepay_deposit.sql` | Có | Đặt cọc chuyển khoản qua SePay: mã VietQR sau khi giữ sân, tiền về là đơn tự xác nhận; trang *Giao dịch ngân hàng*; Tổng quan dòng tiền mới. Cần cấu hình SePay (mục 15). Chạy sau 14 |
| 17 | `16_alerts_reconcile.sql` | Nên chạy | Email báo chủ sân khi có giao dịch cần xử lý; đối soát dự phòng với SePay (ghi bù giao dịch webhook bị lọt). Xem mục 16. Chạy sau 15 |
| 18 | `17_reconcile_cron_optional.sql` | Không | Lịch đối soát mỗi 15 phút bằng Supabase Cron (cần tạo 2 secret trong Vault trước — xem đầu file). Chạy sau 16 |
| 19 | `18_overtime.sql` | Có | Tăng ca có sự đồng ý của nhân viên: chủ sân đề nghị ở lại thêm (giá tăng ca riêng), nhân viên Đồng ý / Từ chối; bảng lương tách tiền tăng ca. Xem mục 17. Chạy sau 16 |
| 20 | `19_staff_checkout.sql` | Có | Tổng quan riêng cho nhân viên (lương tạm tính, giờ công, đi trễ, tăng ca, thưởng/phạt); tên đồng nghiệp trên lịch ca; bán hàng chuyển khoản bằng mã QR SePay tự xác nhận. Xem mục 18. Chạy sau 18 |
| 21 | `20_booking_extend.sql` | Có | Khách chơi thêm giờ: gia hạn đơn đang chơi theo bước 30 phút, giới hạn bởi đơn kế tiếp trên sân / giờ đóng cửa, tính tiền phần thêm theo bảng giá. Xem mục 19. Chạy sau 19 |

**Đã cài Rally từ trước?** Chỉ cần chạy thêm `05_product_details.sql`, `06_product_tax.sql` rồi `07_units_options.sql` (không mất dữ liệu).

**Project Supabase đã có dữ liệu/cấu trúc cũ khác với Rally?** Chạy `supabase/sql/reset_xoa_du_lieu_cu.sql` trước (xóa toàn bộ schema `public` và `private`, giữ tài khoản đăng nhập và file ảnh). Thao tác không hoàn tác được — sao lưu trước.

Tạo tài khoản chủ sân đầu tiên:

1. **Authentication → Users → Add user → Create new user**: nhập email, mật khẩu, tick **Auto Confirm User**.
2. SQL Editor:

```sql
select private.bootstrap_first_owner('email-chu-san@vidu.vn', 'Tên chủ sân');
```

3. Kiểm tra cài đặt: chạy `supabase/tests/99_verify_schema.sql` — mọi dòng cột `ok` phải là `true` (riêng pg_cron là tùy chọn).

Cấu hình thêm trong Dashboard:

- **Authentication → URL Configuration → Site URL**: địa chỉ website (ví dụ `https://rally.vn`).
- **Authentication → Sign In / Providers → Email**: BẬT *Allow new users to sign up* (khách tự đăng ký thành viên bằng email). Tài khoản nhân viên vẫn do chủ sân tạo trong trang quản trị và đăng nhập ở trang riêng `/admin-login`.
- **Authentication → URL Configuration → Redirect URLs**: thêm `https://ten-mien-cua-ban/**` (và `http://localhost:3000/**` khi chạy máy) để Supabase cho chuyển về `/auth/callback`, `/auth/confirm`.
- Xem thêm mục **12. Tài khoản thành viên** để bật đăng nhập Google và sửa mẫu email.

Mỗi thay đổi database về sau được giao dưới dạng file SQL mới trong `supabase/sql/` để chạy trong SQL Editor. Các file đều chạy lại được an toàn.

## 4. Biến môi trường

Sao chép `.env.example` thành `.env.local`, điền theo **Project Settings → API Keys**:

| Biến | Ý nghĩa |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL project, dạng `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_…`) hoặc anon key |
| `SUPABASE_SECRET_KEY` | Secret key (`sb_secret_…`) hoặc service_role key. **Chỉ nằm trên máy chủ.** |
| `NEXT_PUBLIC_SITE_URL` | Địa chỉ website; dùng để tạo mã QR chấm công |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile chống spam form giữ sân. File mẫu dùng khóa thử nghiệm của Cloudflare; thay khóa thật khi chạy chính thức |
| `SEPAY_WEBHOOK_SECRET` / `SEPAY_WEBHOOK_API_KEY` | Khóa bảo mật webhook SePay (mục 15) |
| `SEPAY_API_TOKEN` | API Token ở SePay → API Access, để đối soát dự phòng (mục 16) |
| `RESEND_API_KEY`, `ALERT_EMAIL_FROM` | Gửi email cảnh báo cho chủ sân qua Resend (mục 16) |
| `CRON_SECRET` | Khóa bảo vệ đường dẫn chạy định kỳ `/api/cron/sepay-reconcile` |

Lưu ý về khóa bí mật:

- Không bao giờ đặt tiền tố `NEXT_PUBLIC_` cho `SUPABASE_SECRET_KEY`.
- Khóa bí mật chỉ được đọc trong `src/lib/supabase/secret.ts` (có `import 'server-only'`; nếu lỡ import vào code trình duyệt, build sẽ báo lỗi).
- Khóa bí mật chỉ dùng cho: giữ sân của khách (qua hàm database dành riêng), đăng nhập bằng số điện thoại, tạo/khóa tài khoản nhân viên. Mọi thao tác khác chạy bằng phiên đăng nhập của người dùng và chịu RLS.

## 5. Lệnh thường dùng

| Lệnh | Việc làm |
| --- | --- |
| `npm run dev` | Chạy môi trường phát triển |
| `npm run build` rồi `npm start` | Bản production chạy trên máy |
| `npm run check` | ESLint + kiểm tra kiểu TypeScript + unit test |
| `npm run format` | Định dạng mã bằng Prettier |

## 6. Triển khai Vercel

1. Đưa mã lên GitHub (file `.env.local` đã nằm trong `.gitignore`).
2. Vercel → **Add New Project** → chọn repo; framework Next.js tự nhận.
3. **Settings → Environment Variables**: thêm đủ các biến ở mục 4, với `NEXT_PUBLIC_SITE_URL` là tên miền thật và khóa Turnstile thật.
4. Deploy. Cập nhật lại **Site URL** trong Supabase Auth theo tên miền.

Ở production, form giữ sân bắt buộc xác minh Turnstile. Thiếu `TURNSTILE_SECRET_KEY` thì khách không giữ sân được — đây là chủ đích để chặn spam.

## 7. Script PowerShell (chép theo cụm chức năng)

Thư mục `scripts/install/` chứa script cho từng cụm. Mỗi script chép các file của cụm đó từ gói này vào dự án, có:

- `-ProjectRoot` (mặc định `D:\freetime\rally`)
- `-DryRun`: chỉ in kế hoạch, không ghi gì
- `-Force`: cho phép ghi đè file đang khác nội dung (bản cũ được sao lưu vào `.rally-backups\<thời điểm>\`)
- `-RollbackFrom <thư mục backup>`: trả dự án về đúng trạng thái trước lần cài đó

| Script | Cụm |
| --- | --- |
| `Install-01-Foundation.ps1` | Cấu hình dự án, thư viện dùng chung, giao diện cơ sở, `proxy.ts` |
| `Install-02-Database.ps1` | File SQL Supabase và tài liệu schema |
| `Install-03-PublicSite.ps1` | Website khách: chi nhánh, đặt sân, tra cứu đơn, đồ uống, thuê thiết bị |
| `Install-04-AdminCore.ps1` | Đăng nhập, khung quản trị, tổng quan, chi nhánh/sân/bảng giá, lịch đặt sân, khách hàng, cài đặt, nhật ký |
| `Install-05-Retail.ps1` | Quản lý sản phẩm, tồn kho, bán hàng tại quầy, đơn bán, cho thuê |
| `Install-06-HR.ps1` | Nhân viên, phân quyền, mức lương, lịch ca, chấm công QR, bảng lương |
| `Install-All.ps1` | Chạy lần lượt 01 → 06, tạo `.env.local` từ mẫu nếu chưa có, chạy `npm install` |

```powershell
# Xem trước
powershell -ExecutionPolicy Bypass -File .\scripts\install\Install-All.ps1 -ProjectRoot D:\freetime\rally -DryRun
# Cài
powershell -ExecutionPolicy Bypass -File .\scripts\install\Install-All.ps1 -ProjectRoot D:\freetime\rally
# Cài một cụm
powershell -ExecutionPolicy Bypass -File .\scripts\install\Install-05-Retail.ps1 -ProjectRoot D:\freetime\rally
```

Nếu giải nén thẳng vào thư mục dự án thì không cần chạy script chép file; chỉ cần `npm install`.

## 8. Phân quyền và bảo mật

- **Chủ sân (owner):** toàn quyền mọi chi nhánh.
- **Nhân viên:** quyền cấp riêng từng chi nhánh — xem lịch, xác nhận giữ chỗ, điều hành tại quầy, ghi nhận tiền, xem/quản lý sản phẩm, điều chỉnh kho, bán hàng, cho thuê, xem lịch ca. Quyền tiên quyết (ví dụ quyền xem) được database tự thêm.
- Quyền được kiểm tra **trong PostgreSQL** bằng Row Level Security và hàm `SECURITY DEFINER` có kiểm tra quyền. Menu ẩn/hiện trên giao diện chỉ là tiện ích; gọi thẳng API không vượt được RLS.
- Booking, tiền, kho, chấm công **chỉ ghi qua hàm database** (không có quyền INSERT/UPDATE trực tiếp).
- Dữ liệu lịch sử (đặt sân, thanh toán, đơn bán, phiếu thuê, ca làm) **không xóa cứng**: trigger chặn `DELETE`; hủy là đổi trạng thái kèm lý do. Sản phẩm, biến thể, nhân viên dùng xóa mềm (`deleted_at`, `status`).
- Bảng `audit_events` ghi lại thay đổi quan trọng, không sửa/xóa được; xem ở **Quản trị → Nhật ký thay đổi**.
- Mã QR chấm công đổi mỗi ~75 giây, hiệu lực 90 giây; database chỉ lưu SHA-256 của mã.
- Chống đặt trùng sân bằng exclusion constraint ở database; mọi thao tác tiền/đơn có khóa chống gửi trùng (idempotency key).

## 9. Quy trình chính

**Đặt sân (khách):** Chi nhánh → chọn ngày, sân, giờ bắt đầu và kết thúc → nhập tên, số điện thoại → giữ sân trong thời gian giữ chỗ → nhận mã đơn và hướng dẫn đặt cọc. Tra cứu/hủy tại **Tra cứu đơn** bằng mã + số điện thoại.

**Tại quầy:** Lịch đặt sân → mở đơn → Xác nhận → Ghi nhận tiền → Khách đã đến sân. Tạo đơn tại quầy, khóa sân bảo trì, đổi giờ/đổi sân, hủy (có chính sách hoàn tiền), ghi nhận hoàn tiền.

**Hàng hóa:** Quản lý sản phẩm (thêm/sửa trên một trang kiểu Haravan: ảnh, giá, giá vốn, phiên bản size/màu, mã vạch, tồn đầu kỳ, nhãn, SEO, kênh bán, gói giá thuê, combo) → Tồn kho (nhập hàng, điều chỉnh, kiểm kê, sổ kho) → Bán hàng (quầy POS) → Đơn bán (chủ sân hủy đơn, hàng tự hoàn kho) → Cho thuê (giao đồ, nhận trả, ghi hư/mất, thu phí trễ).

**Nhân sự:** Nhân viên (hồ sơ + tài khoản đăng nhập email hoặc số điện thoại + quyền theo chi nhánh + mức lương) → Lịch ca (hỗ trợ ca qua nửa đêm, lặp nhiều ngày) → Mã QR chấm công (mở trên máy tại quầy) → nhân viên quét bằng điện thoại để vào/ra ca → chủ sân điều chỉnh công (bắt buộc lý do) → Bảng lương (thưởng/khấu trừ, chốt tháng, tải CSV).

## 10. Cấu trúc thư mục

```
src/
  app/                 # Định tuyến App Router
    (site)/            # Website khách
    (auth)/login       # Đăng nhập
    (staff)/checkin    # Chấm công trên điện thoại
    admin/             # Trang quản trị
  features/<cụm>/      # Theo nghiệp vụ: queries.ts (đọc), actions.ts (Server Action),
                       # components/ (UI), hooks/ (logic client), lib/ (hàm thuần + test)
  components/          # UI dùng chung (form, nút, thẻ, ảnh, logo)
  hooks/               # Hook dùng chung
  lib/                 # Supabase client, phân quyền, định dạng, thời gian, kiểm tra dữ liệu
  proxy.ts             # Làm mới phiên đăng nhập, chặn truy cập trang quản trị khi chưa đăng nhập
supabase/sql/          # Migration SQL (chạy theo thứ tự)
supabase/tests/        # Kiểm tra sau cài đặt
scripts/install/       # Script PowerShell theo cụm chức năng
docs/                  # Phân tích schema
```

## 11. Ghi chú vận hành

- Múi giờ nghiệp vụ mặc định `Asia/Ho_Chi_Minh` (mỗi chi nhánh có cột `timezone`).
- Ảnh tải lên được nén WebP (tối đa 1600 px) trên trình duyệt trước khi gửi lên Storage.
- Lịch trống trên trang đặt sân cập nhật tức thời qua Supabase Realtime (broadcast), kèm làm mới định kỳ 60 giây.
- Chưa có cổng thanh toán online: tiền cọc/thanh toán do nhân viên ghi nhận thủ công (tiền mặt, chuyển khoản, thẻ, ví).

## 12. Tài khoản thành viên (`11_members.sql`)

**Đường dẫn**

| Ai | Trang |
| --- | --- |
| Khách | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/account` (tổng quan, đơn đặt sân, hồ sơ & bảo mật) |
| Chủ sân / nhân viên | **`/admin-login`** — link riêng, website không có nút vào trang quản trị. Lưu link này lại. |

- Tài khoản khách và tài khoản nhân sự tách hẳn: tài khoản nhân sự đăng nhập ở `/login` bị từ chối, tài khoản khách đăng nhập ở `/admin-login` cũng bị từ chối. Database chặn một user vừa là thành viên vừa là nhân sự.
- Đăng ký bằng **số điện thoại** (SĐT là tên đăng nhập) hoặc **email** (có thể thêm SĐT để đăng nhập bằng SĐT), hoặc **Google**. Ô mật khẩu có nút con mắt để hiện/ẩn, có thanh độ mạnh.
- **Quên mật khẩu**: tài khoản có email nhận liên kết đặt lại qua email. Tài khoản chỉ có SĐT (chưa dùng OTP) được chủ sân cấp **mật khẩu tạm** ở *Quản trị → Khách hàng → Thành viên*; khách bắt buộc đổi mật khẩu khi đăng nhập lại.
- **Tra cứu không cần mã**: trang Tra cứu đơn nhớ các đơn đã đặt/tra trên thiết bị (chỉ lưu trong trình duyệt của khách). Thành viên xem mọi đơn trong tài khoản. Biết SĐT thôi **không** xem được đơn — vì SĐT chưa được xác minh bằng OTP; đơn cũ chỉ vào tài khoản khi nhập đúng mã đơn + SĐT.
- Đặt sân khi đang đăng nhập: họ tên, SĐT tự điền; đơn tự gắn vào tài khoản; đơn **hoàn tất** được cộng điểm (1 điểm / 10.000đ, mỗi đơn 1 lần). Chủ sân cộng/trừ điểm tay kèm lý do; sổ điểm không sửa được.

**Bật đăng nhập Google** (không bắt buộc — chưa bật thì nút Google báo "chưa được bật"):

1. Google Cloud Console → *APIs & Services → Credentials → Create credentials → OAuth client ID* → loại **Web application**.
2. *Authorized redirect URIs*: `https://uzfjixzltpwycmpvnlkd.supabase.co/auth/v1/callback`.
3. Supabase → *Authentication → Sign In / Providers → Google*: bật, dán **Client ID** và **Client Secret**, lưu.

**Mẫu email (nên làm để liên kết mở được trên thiết bị khác)** — Supabase → *Authentication → Emails*:

- *Confirm signup*: đổi liên kết thành `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/account`
- *Reset password*: đổi liên kết thành `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`

Giữ mẫu mặc định vẫn chạy, nhưng khách phải mở liên kết trên đúng trình duyệt đã đăng ký. Email mặc định của Supabase giới hạn rất ít thư mỗi giờ — khi chạy thật nên cấu hình SMTP riêng (*Authentication → Emails → SMTP Settings*).

## 13. Tốc độ (web và quản trị)

Đã tối ưu sẵn trong code:

- **Trang công khai** (trang chủ, chi nhánh, vật phẩm, cho thuê, giới thiệu) đọc dữ liệu qua bộ nhớ đệm phía máy chủ (`src/lib/public-cache.ts`): gần như không gọi database. Khi chủ sân sửa ở trang quản trị, bộ đệm liên quan được xóa ngay (`invalidatePublic`), nên khách thấy thay đổi tức thì. Lịch trống sân vẫn luôn lấy trực tiếp.
- **Đăng nhập**: middleware chỉ đọc phiên trong cookie (không gọi mạng mỗi lần chuyển trang); quyền vẫn do RLS của database kiểm tra ở mọi truy vấn.
- **Trang quản trị**: các truy vấn độc lập chạy song song, chạy cùng lúc với bước kiểm tra quyền — hầu hết trang chỉ còn **1 lượt** tới database (trước đây 2–3, đầu tiên là 4–6).
- **Quyền nhân sự** (`my_staff_context`) được nhớ 60 giây trong máy chủ, khóa theo mã băm của chính token đăng nhập: chuyển trang không phải hỏi lại quyền. Đổi nhân viên / quyền / chi nhánh / mật khẩu thì xóa ngay; dữ liệu vẫn do RLS kiểm tra ở mọi truy vấn (`src/lib/auth/context-cache.ts`).
- **Menu quản trị** tải trước cả dữ liệu trang khi rê chuột / chạm vào mục (chỉ dùng lại trong 30 giây) — bấm vào thường hiện ngay.
- **Giao diện**: thanh tiến trình xanh ở đỉnh màn hình khi bấm chuyển trang, khung xương (skeleton) giữ bố cục khi đang tải, ô lọc/tìm kiếm ở quản trị và trang vật phẩm chuyển trang không tải lại toàn bộ.

Để chạy thật nhanh khi triển khai:

1. Chạy `13_performance.sql`.
2. Chọn **region Supabase gần Việt Nam** (Singapore — `ap-southeast-1`) và đặt Vercel Functions cùng vùng (*Project → Settings → Functions → Region*: `sin1`). Mỗi truy vấn đi xa (ví dụ sang Mỹ) tốn thêm ~200 ms.
3. Bật **JWT Signing Keys** bất đối xứng ở Supabase (*Project Settings → JWT Keys → Migrate*): xác minh đăng nhập ngay trên máy chủ, không cần hỏi lại Supabase.
4. Chạy bản build (`npm run build && npm start`, hoặc Vercel). `npm run dev` biên dịch từng trang lần đầu và chạy React chế độ phát triển nên chậm hơn nhiều (log `next.js: 1112ms` là thời gian biên dịch) — không dùng để đánh giá tốc độ.
5. Kiểm tra: *Cài đặt → Tốc độ máy chủ → Đo tốc độ*. Dưới ~30 ms là máy chủ web và database cùng vùng; trên ~150 ms là đang ở xa nhau (làm lại bước 2) — mỗi trang chờ ít nhất 1 lượt như vậy.

## 14. Tra cứu đơn bằng số điện thoại (khách vãng lai, `14_guest_phone_lookup.sql`)

Trang `/booking/lookup` có 2 tab: **Số điện thoại** (mặc định) và **Mã đơn**.

- Nhập số điện thoại đã dùng khi đặt (có xác minh chống bot Turnstile) → danh sách đơn chia **Hôm nay / Sắp tới / Lịch sử đặt sân** (6 tháng gần nhất, tối đa 40 đơn; gồm cả đơn đặt tại quầy theo số đó). Chỉ gồm đơn khách vãng lai — đơn đặt khi đăng nhập thành viên xem trong tài khoản (trang có nhắc số đơn đó).
- Danh sách chỉ để xem: mã đơn che giữa (`RB-W7••••9T`), người đặt chỉ hiện tên gọi. Bấm **Xem chi tiết** và nhập đúng họ tên người đặt (có dấu hay không dấu đều được) → hiện vé đầy đủ: mã đơn, thanh toán, chỉ đường, tự hủy. Nhờ vậy người chỉ biết số điện thoại của bạn không hủy được đơn của bạn.
- Giới hạn: mỗi số 10 lần tìm / giờ, mỗi thiết bị (IP băm) 30 lần / giờ; nhập sai họ tên tối đa 5 lần / giờ cho mỗi đơn. Hàm database chỉ máy chủ gọi được (service role).

## 15. Đặt cọc chuyển khoản tự động (SePay, `15_sepay_deposit.sql`)

**Khách:** giữ sân xong thấy ngay mã VietQR (số tiền cọc + nội dung = mã đơn không gạch, ví dụ `RB7K3M9Q2T`), có nút lưu ảnh QR và sao chép từng dòng; chọn được "Cọc" hoặc "Trả hết". Trang tự hỏi lại vài giây một lần — tiền về là hiện "Đã nhận cọc — đơn đã được xác nhận". Mã QR cũng có ở trang Tra cứu đơn và trang đơn của thành viên khi còn thiếu tiền.

**Hệ thống:** SePay báo giao dịch về `/api/webhooks/sepay` → kiểm tra chữ ký → ghi `bank_transactions` (chống trùng theo id SePay) → tìm mã đơn trong nội dung → ghi `payments` (hình thức *Chuyển khoản tự động (SePay)*) → đủ cọc thì xác nhận đơn. Giữ chỗ vừa hết hạn mà sân còn trống thì tự mở lại. Không khớp / đơn đã hủy / giờ đã có người khác / chuyển dư → vào **Quản trị → Giao dịch ngân hàng** để nhân viên gán tay vào đơn hoặc ghi cách đã xử lý.

**Cài đặt (một lần):**

1. Chạy `15_sepay_deposit.sql`.
2. *Quản trị → Cài đặt thương hiệu → Nhận cọc chuyển khoản*: nhập ngân hàng (tên viết tắt VietQR, ví dụ `MBBank`), số tài khoản, chủ tài khoản. Nếu SePay yêu cầu chữ bắt buộc trong nội dung (VietinBank cá nhân: `SEVQR`, để trống sẽ tự điền) thì nội dung khách chuyển thành `SEVQR RB7K3M9Q2T`. Chi nhánh dùng tài khoản riêng thì nhập ở *Chi nhánh → Tài khoản nhận cọc riêng*.
3. Trên [SePay](https://my.sepay.vn): liên kết tài khoản ngân hàng đó.
   - *Công ty → Cấu hình chung → Cấu trúc mã thanh toán*: tiền tố `RB`, hậu tố 8–8, kiểu **Số và chữ**.
   - *Webhooks → Thêm*: sự kiện **Tiền vào**, URL `https://<tên miền>/api/webhooks/sepay`, bảo mật **HMAC-SHA256** (khuyên dùng) hoặc **API Key**.
4. Thêm biến môi trường trên Vercel / `.env.local` (không có `NEXT_PUBLIC_`): `SEPAY_WEBHOOK_SECRET=<Secret Key HMAC>` hoặc `SEPAY_WEBHOOK_API_KEY=<API key>`. Chưa có khóa thì webhook từ chối mọi yêu cầu (an toàn mặc định).
5. Nên đặt *Giữ chỗ (phút)* của chi nhánh khoảng 15 để khách kịp chuyển.
6. Thử: dùng chế độ giả lập giao dịch của SePay (hoặc chuyển 2.000đ với nội dung là mã một đơn thử) — đơn chuyển sang "Đã xác nhận", giao dịch hiện ở *Giao dịch ngân hàng*.

**Tổng quan (`/admin`)** — một lần gọi database (`admin_dashboard`), hiện theo quyền người xem: thực thu hôm nay / theo kỳ (7–30–90 ngày, so với kỳ trước), tiền còn phải thu, đơn chờ cọc, biểu đồ dòng tiền theo ngày (sân / bán hàng / cho thuê), tỷ trọng theo nguồn và hình thức, việc cần xử lý (chờ cọc, giao dịch chưa khớp, thuê quá hạn, hết hàng, ca chưa chấm công), lịch sân hôm nay, giao dịch gần đây và tóm tắt các mảng khác. Chủ sân xem gộp mọi chi nhánh hoặc từng chi nhánh.

## 16. Báo chủ sân qua email & đối soát dự phòng (`16_alerts_reconcile.sql`)

**Email ngay khi có giao dịch cần xử lý.** Khi tiền vào mà hệ thống không tự xác nhận được đơn — giữ chỗ hết hạn và giờ đã có người khác đặt, đơn đã hủy, chuyển thiếu sau khi hết hạn, chuyển dư, nội dung thiếu / sai mã đơn — website gửi email cho chủ sân, ví dụ *"Khách Nguyễn Văn A chuyển 42.000 ₫ nhưng giờ đã có người đặt — cần liên hệ khách"*, kèm số điện thoại (bấm để gọi), sân, giờ chơi, nội dung chuyển khoản và nút mở *Giao dịch ngân hàng*. Nhiều giao dịch cùng lúc gộp một email; mỗi giao dịch chỉ báo một lần (`bank_transactions.alerted_at`). Email gửi sau khi đã trả lời SePay nên không làm chậm webhook; gửi lỗi thì lần đối soát sau gửi lại.

**Đối soát dự phòng.** Website tự hỏi SePay (API v1 `transactions/list`) giao dịch gần đây của mọi tài khoản nhận cọc, ghi bù giao dịch nào webhook bị lọt (website bảo trì, mạng lỗi…) bằng đúng hàm của webhook — giao dịch đã có thì bỏ qua (theo id SePay và mã tham chiếu ngân hàng), nên chạy bao nhiêu lần cũng an toàn. Lấy từ lần đối soát thành công trước (lùi 2 giờ), tối đa 3 ngày. Chủ sân xem lần chạy gần nhất và bấm **Đối soát ngay** ở *Giao dịch ngân hàng*.

**Cài đặt:**

1. Chạy `16_alerts_reconcile.sql`.
2. **Email (Resend):** đăng ký [resend.com](https://resend.com) → *API Keys → Create* → thêm biến `RESEND_API_KEY`. Chưa xác minh tên miền thì Resend chỉ gửi được tới email đã đăng ký Resend (người gửi mặc định `Rally <onboarding@resend.dev>`); muốn gửi tới email khác thì *Domains → Add domain*, thêm bản ghi DNS, rồi đặt `ALERT_EMAIL_FROM="Rally <thongbao@ten-mien-cua-ban>"`.
3. *Quản trị → Cài đặt thương hiệu → Báo cho chủ sân qua email*: nhập tối đa 5 email (trống = email tài khoản chủ sân), chọn loại cần báo, bấm **Gửi email thử**.
4. **Đối soát:** SePay → *API Access* → tạo **API Token** → thêm biến `SEPAY_API_TOKEN`. Thêm `CRON_SECRET` = chuỗi ngẫu nhiên dài (chỉ chữ và số, không có `$`).
5. Redeploy Vercel. `vercel.json` có sẵn lịch Vercel Cron 1 lần/ngày (gói Hobby chỉ cho 1 lần/ngày) làm lưới an toàn cuối.
6. **Mỗi 15 phút (khuyên dùng):** trong SQL Editor tạo 2 secret rồi chạy `17_reconcile_cron_optional.sql`:

```sql
select vault.create_secret('https://ten-mien-cua-ban', 'rally_site_url');
select vault.create_secret('<giá trị CRON_SECRET>', 'rally_cron_secret');
```

Kiểm tra lịch: `select * from cron.job where jobname = 'rally-sepay-reconcile';` — kết quả từng lần chạy hiện ở thanh *Đối soát dự phòng* trong *Giao dịch ngân hàng*.

**Thông báo nổi (snackbar):** mọi thao tác ở khu quản trị và nhân viên (tạo / lưu / xóa, bán hàng, cho thuê, nhân sự, đổi chi nhánh…) hiện thông báo nổi góc dưới; lỗi hiện lâu hơn và vẫn đánh dấu ô nhập sai trong form.

## 17. Lịch ca mới & tăng ca (`18_overtime.sql`)

**Lịch ca (kiểu Google Calendar):** cột giờ bên trái, mỗi ngày một cột, ô ca đặt đúng giờ bắt đầu – kết thúc; ca **trùng giờ** đứng cạnh nhau (cột hẹp chỉ hiện tên gọi + giờ vào). Mỗi nhân viên một màu nhận diện (bấm tên ở hàng chip để làm nổi bật ca của người đó). Ca **đang làm** tô xanh đặc; đến giờ mà **chưa vào ca** tô đỏ nhạt; ca đã qua làm mờ; tăng ca hiện phần kẻ sọc nối dưới ca. Vạch đỏ là giờ hiện tại (tự chạy mỗi 30 giây). Điện thoại: dải chọn ngày phía trên, xem một ngày đầy đủ. Dải **Đang trong ca** phía trên liệt kê ai đang làm tới mấy giờ.

**Xếp ca (chủ sân):** bấm **Xếp ca mới** hoặc bấm vào ô trống trên lịch (mở sẵn ngày và giờ đó).

1. *Ai làm?* — chọn một hoặc nhiều nhân viên (người chi nhánh này đứng trước; người chi nhánh khác bấm "+ N người"). Nhân viên chưa có mức lương được nhắc.
2. *Giờ làm* — bấm mẫu ca (Ca sáng / chiều / tối và các khung giờ hay dùng ở chi nhánh) hoặc chọn giờ vào, giờ ra, phút nghỉ. Giờ ra sớm hơn giờ vào = ca qua nửa đêm. Ca tối đa 16 giờ.
3. *Ngày nào?* — 1 ngày, cả tuần, T2–T6, cuối tuần, hoặc tự chọn khoảng ngày (tối đa 31 ngày) và các thứ lặp lại.
4. Khung **Xem trước** liệt kê từng ca sẽ tạo, tổng giờ công, ca trùng giờ (gạch đỏ). Ca trùng với ca đã có của nhân viên (kể cả ở chi nhánh khác) **được bỏ qua, các ca còn lại vẫn xếp**; thông báo cho biết bỏ qua ngày nào.

**Tăng ca:**

1. *Lịch ca → bấm vào ca → Tăng ca*: chọn ở lại thêm bao lâu (30 phút → 6 giờ, ngay sau giờ ra ca), giá tăng ca (đ/giờ) và lý do. Có nút gợi ý giá theo Bộ luật Lao động 2019 Điều 98 (ngày thường 150%, ngày nghỉ hằng tuần 200%, lễ tết 300% lương thường); nhập thấp hơn 150% thì hiện cảnh báo (vẫn lưu được — chủ sân tự quyết).
2. Nhân viên thấy đề nghị ở *Ca & lương của tôi* (menu có chấm đỏ đếm số đề nghị): giá, ở lại tới mấy giờ, nhận thêm bao nhiêu → **Đồng ý / Từ chối**, trả lời được tới hết khung tăng ca. Đã thỏa thuận miệng tại sân thì chủ sân tick **Nhân viên đã đồng ý trực tiếp** (ghi nhận ngay; ca đã qua thì chỉ dùng cách này).
3. Nhân viên đồng ý → quét QR ra ca lúc về (hạn quét ra kéo dài theo tăng ca).
4. **Tính lương:** phút làm **sau giờ ra ca theo lịch**, tối đa số phút đã đồng ý, tính giá tăng ca; phần còn lại giá thường như trước. Không đồng ý / chưa trả lời / đã hủy → không có giá tăng ca. Ví dụ ca 07:00–11:00 giá 25.000 đ/giờ, tăng ca 2 giờ giá 30.000 đ/giờ, quét ra 13:00 → 4 × 25.000 + 2 × 30.000 = **160.000 đ**; quét ra 12:30 → tăng ca 1g30 = 45.000 đ.
5. Bảng lương có cột **Trong đó tăng ca**, ô tổng **Tiền tăng ca**, cảnh báo đề nghị còn chờ trả lời; file CSV thêm *Phút tăng ca*, *Lương giờ thường*, *Tiền tăng ca*. Phiếu lương nhân viên ghi riêng phần tăng ca.

Đề nghị không xóa được, chỉ hủy (kèm lý do); mọi thay đổi ghi vào Nhật ký. Tháng đã chốt lương thì không đổi được tăng ca. Mức giá tăng ca chỉ chủ sân và chính nhân viên đó xem được.

## 18. Tài khoản nhân viên, thu tiền sân, chuyển khoản tại quầy (`19_staff_checkout.sql`)

**Tổng quan của nhân viên** (`/admin` khi đăng nhập bằng tài khoản nhân viên) — khác hẳn chủ sân: ca đang làm / ca kế tiếp, **lương tạm tính đến hôm nay**, giờ công (số ca đã làm, ca còn lại), **tăng ca** (số lần, giờ, tiền), **đi trễ** (số lần, tổng phút — tính khi quét QR vào ca muộn hơn 5 phút), **thưởng**, **phạt / khấu trừ**, vắng / nghỉ phép, bảng *Cách tính lương tháng* và các khoản thưởng / phạt kèm lý do; xem được các tháng trước. Lối tắt theo quyền: Thu tiền sân, Bán hàng, Cho thuê, Lịch đặt sân, Lịch ca.

**Lịch ca cho nhân viên:** cùng giao diện với chủ sân, hiện đủ tên đồng nghiệp (chỉ tên + mã, không lộ số điện thoại / lương). Nhân viên không có quyền "Xem lịch ca chi nhánh" vẫn mở được *Lịch ca* để xem ca của chính mình.

**Thu tiền sân** (*Vận hành → Thu tiền sân*, cần quyền thu tiền): danh sách đơn trong ngày, đơn đang chơi / hết giờ còn nợ lên đầu, tìm theo mã đơn / tên / SĐT. Mở đơn:

- **Chuyển khoản:** mã VietQR đúng số tiền còn nợ, nội dung là mã đơn (VietinBank tự thêm `SEVQR`). Khách chuyển xong → SePay báo về → màn hình tự chuyển "Đã thu đủ" (hỏi lại 3 giây/lần). Nếu đã thấy tiền trong app ngân hàng mà chưa xác nhận: ghi tay kèm mã giao dịch.
- **Tiền mặt:** nhập tiền khách đưa (nút nhanh 50k/100k/200k/500k) → hiện tiền thối.
- Thu xong: **In hóa đơn** (khổ 80mm, máy in nhiệt hoặc máy in thường). Ở trang chi tiết đơn cũng có nút *Thu tiền (QR / tiền mặt)* và *In hóa đơn*. Đơn đã xác nhận có nút *Khách đã đến — nhận sân*.

**Bán hàng chuyển khoản:** chọn *Chuyển khoản* và để trống mã giao dịch → bấm *Hiện mã QR* → đơn được ghi với khoản thu **chờ tiền về**, nội dung `RB…` do hệ thống cấp (cùng dạng mã đơn đặt sân nên không cần sửa cấu hình SePay). Tiền về → tự sang "Đã thu", in phiếu. Khách đổi ý → *Khách trả tiền mặt*; khách không chuyển → *Hủy đơn* (hàng tự trả về kho, nhân viên hủy được trong 24 giờ khi chưa thu tiền). Chuyển thiếu / dư → vào *Giao dịch ngân hàng* (mục Cần xử lý) và email báo chủ sân. Đơn chờ chuyển khoản chưa tính vào doanh thu ngày.

**Cho thuê:** nút **In phiếu** (không bắt buộc) ở trang phiếu thuê — khổ 80mm, có đồ thuê, giờ nhận / hạn trả, vật cầm cọc, tiền, quy định trả trễ, chỗ ký.

**Quản lý sản phẩm:** bỏ mục SEO khỏi form (dữ liệu SEO cũ vẫn giữ nguyên, không bị xóa).

## 19. Khách chơi thêm giờ (`20_booking_extend.sql`)

Ví dụ: khách vãng lai hỏi sân lúc 18:00, nhân viên đặt **18:00–19:00** tại quầy (*Thu tiền sân → Khách vãng lai — đặt tại quầy*). Sân trống tới 21:00, khách đánh tới 20:00.

1. Lúc khách ra về (hoặc khi khách báo muốn đánh thêm), nhân viên mở đơn ở *Thu tiền sân*. Khung **Giờ chơi** cho biết **sân trống tới mấy giờ** (tới đơn kế tiếp hoặc giờ đóng cửa) và các nút **+30 phút, +1 giờ, +1 giờ 30…** kèm giờ kết thúc và **tiền thêm** (tính theo bảng giá của khung giờ thêm — giờ cao điểm tính giá cao điểm).
2. Khách đã chơi quá giờ: hiện cảnh báo *"Khách đã chơi quá giờ 58 phút — gợi ý tính tới 20:00"* và nút gợi ý được tô sẵn. **Quá giờ không quá 10 phút** (thời gian dọn sân) thì không gợi ý tính thêm.
3. Bấm nút → xác nhận *Gia hạn* → tổng tiền đơn tăng, mã QR chuyển khoản tự đổi đúng số tiền mới, khách trả 1 lần cả giờ đặt + giờ thêm. Hóa đơn in ra có từng dòng giá.

Quy tắc:

- Chỉ gia hạn được khi sân còn trống: có đơn kế tiếp (kể cả đơn đang giữ chỗ chưa hết hạn) thì chỉ được kéo tới giờ đơn đó bắt đầu. Hết chỗ → báo "không gia hạn được trên sân này".
- Gia hạn theo bước của bảng giá (30 phút), tối đa **+6 giờ** mỗi lần.
- Đơn đã tự chuyển sang *Hoàn tất* (hết giờ) vẫn tính thêm được, nhưng **chỉ tới giờ hiện tại** (khách đã chơi rồi) — không đặt trước tương lai được trên đơn đã hoàn tất.
- Tiền cọc và giảm giá giữ nguyên; tiền đã thu không đổi, phần thêm là *Còn phải thu*.
- Cần quyền **Vận hành đặt sân**; mọi lần gia hạn ghi vào *Lịch sử thay đổi* (lý do "extend: +N phút"). Nút cũng có ở trang chi tiết đơn (*Lịch đặt sân*).
