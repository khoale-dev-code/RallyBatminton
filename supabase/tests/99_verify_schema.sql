-- =============================================================================
-- RALLY BADMINTON — 99_verify_schema.sql
-- Kiểm tra CHỈ ĐỌC sau khi chạy 00 + 01 + 02 + 05 + 06 + 07 + 09 (+ 03). Không thay đổi dữ liệu.
-- Chạy trong SQL Editor: mọi dòng cột "ok" phải là true.
-- =============================================================================
with checks as (
  select 1 as n, 'Đủ bảng nghiệp vụ trong public (34 của 00 + bảng của các file sau đã chạy)' as check_name,
         (select count(*) from pg_class c join pg_namespace s on s.oid = c.relnamespace
           where s.nspname = 'public' and c.relkind = 'r')
           = 34 + (select count(*) from unnest(array['product_units', 'member_profiles', 'member_point_ledger', 'bank_transactions',
                     'notification_settings', 'reconcile_runs', 'shift_overtime', 'attendance_settings',
                     'attendance_fix_requests', 'attendance_kiosks', 'legal_documents', 'privacy_consents',
                     'data_subject_requests', 'data_retention_policies', 'payment_webhook_events',
                     'security_settings', 'security_events', 'customer_hold_policies',
                     'push_subscriptions', 'push_preferences']) t(name)
                   where to_regclass('public.' || t.name) is not null) as ok,
         (select count(*)::text from pg_class c join pg_namespace s on s.oid = c.relnamespace
           where s.nspname = 'public' and c.relkind = 'r') as detail
  union all
  select 2, 'RLS bật trên mọi bảng public',
         not exists (select 1 from pg_class c join pg_namespace s on s.oid = c.relnamespace
                      where s.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
         coalesce((select string_agg(c.relname, ', ') from pg_class c join pg_namespace s on s.oid = c.relnamespace
                    where s.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity), 'ok')
  union all
  select 3, 'Không có 2 policy permissive trùng (role, lệnh)',
         not exists (
           select 1 from pg_policies pp
           cross join lateral unnest(pp.roles) r(role)
           cross join lateral unnest(case when pp.cmd = 'ALL' then array['SELECT','INSERT','UPDATE','DELETE'] else array[pp.cmd] end) c(cmd)
           where pp.schemaname = 'public' and pp.permissive = 'PERMISSIVE'
           group by pp.tablename, r.role, c.cmd having count(*) > 1),
         (select count(*)::text || ' policies' from pg_policies where schemaname = 'public')
  union all
  select 4, 'Mọi hàm public/private cố định search_path',
         not exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
                      where s.nspname in ('public', 'private')
                        and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%')),
         'ok'
  union all
  select 5, 'anon chỉ gọi được 4 RPC đọc công khai (+ kiosk_issue_qr sau 21)',
         (select array_agg(p.proname order by p.proname) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
           where s.nspname = 'public' and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute') and p.proname <> 'kiosk_issue_qr')
         = array['get_branch_busy_slots', 'list_catalog', 'list_published_branches', 'quote_booking']::name[],
         (select string_agg(p.proname, ', ') from pg_proc p join pg_namespace s on s.oid = p.pronamespace
           where s.nspname = 'public' and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute'))
  union all
  select 6, 'authenticated KHÔNG gọi được RPC chỉ dành cho server',
         not has_function_privilege('authenticated', 'public.create_guest_booking_hold(uuid,timestamptz,timestamptz,text,text,text,text)', 'execute')
         and not has_function_privilege('authenticated', 'public.resolve_staff_login(text)', 'execute'),
         'create_guest_booking_hold, resolve_staff_login'
  union all
  select 7, 'anon không đọc được bookings/customers/payments',
         not has_table_privilege('anon', 'public.bookings', 'select')
         and not has_table_privilege('anon', 'public.customers', 'select')
         and not has_table_privilege('anon', 'public.payments', 'select'),
         'ok'
  union all
  select 8, 'Không ai INSERT/UPDATE trực tiếp bookings/payments (chỉ RPC)',
         not has_table_privilege('authenticated', 'public.bookings', 'insert')
         and not has_table_privilege('authenticated', 'public.bookings', 'update')
         and not has_table_privilege('authenticated', 'public.payments', 'insert'),
         'ok'
  union all
  select 9, 'Khóa chống đặt trùng sân tồn tại',
         exists (select 1 from pg_constraint where conname = 'bookings_no_overlap' and contype = 'x'),
         'bookings_no_overlap'
  union all
  select 10, 'Bucket ảnh public-media tồn tại',
         exists (select 1 from storage.buckets where id = 'public-media'),
         'storage.buckets'
  union all
  select 11, 'Đã có owner đang hoạt động',
         exists (select 1 from public.staff_accounts where role = 'owner' and is_active),
         'Chạy: select private.bootstrap_first_owner(''email'', ''Tên'');'
  union all
  select 13, 'Đã chạy 05_product_details.sql (quản lý sản phẩm)',
         exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'products' and column_name = 'show_on_website')
         and exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
                      where s.nspname = 'public' and p.proname in ('create_product_full', 'update_product_full')
                      having count(*) = 2),
         'products.show_on_website, create_product_full, update_product_full'
  union all
  select 14, 'Khách và nhân viên không đọc trực tiếp được giá vốn',
         not has_column_privilege('anon', 'public.product_variants', 'cost_price', 'select')
         and not has_column_privilege('authenticated', 'public.product_variants', 'cost_price', 'select')
         and has_function_privilege('authenticated', 'public.get_variant_costs(uuid)', 'execute')
         and not has_function_privilege('anon', 'public.get_variant_costs(uuid)', 'execute'),
         'product_variants.cost_price → get_variant_costs()'
  union all
  select 15, 'Đã chạy 06_product_tax.sql (thuế sản phẩm)',
         exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'products' and column_name = 'taxable')
         and exists (select 1 from pg_trigger where tgname = 'sale_lines_tax' and not tgisinternal),
         'products.taxable, trigger sale_lines_tax'
  union all
  select 16, 'Đã chạy 07_units_options.sql (đơn vị tính, thuộc tính biến thể)',
         to_regclass('public.product_units') is not null
         and exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = 'sale_lines' and column_name = 'unit_conversion'),
         'product_units, sale_lines.unit_conversion'
  union all
  select 17, 'Đã chạy 09_rental_pricing.sql (giá thuê tại sân/mang về, phụ phí trễ)',
         exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'rentals' and column_name = 'overtime_block_price')
         and to_regprocedure('private.rental_overtime(timestamptz, timestamptz, integer, integer, integer, integer, integer)') is not null
         and (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
               where s.nspname = 'public' and p.proname in ('checkout_rental', 'return_rental')) = 2,
         'rentals.overtime_*, private.rental_overtime, 1 bản checkout_rental/return_rental'
  union all
  select 18, 'Đã chạy 11_members.sql (tài khoản thành viên, điểm, hạng)',
         to_regclass('public.member_profiles') is not null
         and to_regclass('public.member_point_ledger') is not null
         and exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = 'bookings' and column_name = 'member_user_id')
         and not has_function_privilege('authenticated', 'public.resolve_member_login(text)', 'execute')
         and not has_column_privilege('authenticated', 'public.member_profiles', 'staff_note', 'select'),
         'member_profiles, member_point_ledger, bookings.member_user_id; RPC máy chủ không mở cho trình duyệt'
  union all
  select 19, 'Đã chạy 12_branch_map.sql (bản đồ Google nhúng cho chi nhánh)',
         exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'branches' and column_name = 'map_embed_url')
         and exists (select 1 from pg_constraint where conname = 'branches_map_embed_fmt'),
         'branches.map_embed_url + ràng buộc chỉ nhận link nhúng Google Maps'
  union all
  select 20, 'Đã chạy 13_performance.sql (chỉ mục tăng tốc)',
         exists (select 1 from pg_extension where extname = 'pg_trgm')
         and exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'customers_phone_trgm_idx')
         and exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'audit_events_time_idx'),
         'pg_trgm + chỉ mục tìm kiếm khách/thành viên/sản phẩm, nhật ký, bảng lương'
  union all
  select 21, 'Đã chạy 14_guest_phone_lookup.sql (tra cứu đơn bằng số điện thoại)',
         to_regprocedure('public.lookup_guest_bookings_by_phone(text,text)') is not null
         and to_regprocedure('public.reveal_guest_booking(uuid,text,text,text)') is not null
         and not has_function_privilege('anon', 'public.lookup_guest_bookings_by_phone(text,text)', 'execute')
         and not has_function_privilege('anon', 'public.reveal_guest_booking(uuid,text,text,text)', 'execute'),
         'RPC tra theo SĐT + xác nhận họ tên; chỉ máy chủ gọi được'
  union all
  select 22, 'Đã chạy 15_sepay_deposit.sql (cọc chuyển khoản SePay, tổng quan)',
         to_regclass('public.bank_transactions') is not null
         and to_regprocedure('public.record_sepay_transaction(jsonb)') is not null
         and to_regprocedure('public.admin_dashboard(uuid,integer)') is not null
         and not has_function_privilege('anon', 'public.record_sepay_transaction(jsonb)', 'execute')
         and not has_function_privilege('authenticated', 'public.record_sepay_transaction(jsonb)', 'execute'),
         'bank_transactions + webhook RPC chỉ máy chủ gọi được + admin_dashboard'
  union all
  select 23, 'Đã chạy 16_alerts_reconcile.sql (email cảnh báo, đối soát SePay)',
         to_regclass('public.notification_settings') is not null
         and to_regclass('public.reconcile_runs') is not null
         and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bank_transactions' and column_name = 'alerted_at')
         and to_regprocedure('public.service_pending_alerts(integer)') is not null
         and not has_function_privilege('authenticated', 'public.service_pending_alerts(integer)', 'execute')
         and not has_function_privilege('anon', 'public.service_reconcile_start(text)', 'execute'),
         'notification_settings (chỉ chủ sân) + reconcile_runs + hàm chỉ máy chủ gọi được'
  union all
  select 24, 'Đã chạy 18_overtime.sql (tăng ca có đồng ý, lương tăng ca)',
         to_regclass('public.shift_overtime') is not null
         and to_regprocedure('public.offer_overtime(uuid,integer,integer,text,boolean)') is not null
         and to_regprocedure('public.respond_overtime(uuid,boolean,text)') is not null
         and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'payroll_lines' and column_name = 'overtime_pay')
         and not has_function_privilege('anon', 'public.offer_overtime(uuid,integer,integer,text,boolean)', 'execute'),
         'shift_overtime + RPC đề nghị / trả lời / hủy + cột tăng ca trong phiếu lương'
  union all
  select 25, 'Đã chạy 19_staff_checkout.sql (tổng quan nhân viên, chuyển khoản tại quầy)',
         to_regprocedure('public.my_month_summary(date)') is not null
         and to_regprocedure('public.shift_people(uuid,date,date)') is not null
         and to_regprocedure('public.sale_transfer_status(uuid)') is not null
         and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bank_transactions' and column_name = 'sale_id')
         and not has_function_privilege('anon', 'public.my_month_summary(date)', 'execute'),
         'my_month_summary + shift_people + bán hàng chờ chuyển khoản SePay'
  union all
  select 26, 'Đã chạy 20_booking_extend.sql (khách chơi thêm giờ)',
         to_regprocedure('public.court_extend_options(uuid)') is not null
         and to_regprocedure('public.extend_booking(uuid,timestamptz,text)') is not null
         and exists (select 1 from pg_proc where oid = 'private.bookings_before_write()'::regprocedure and prosrc like '%rally.booking_extend%')
         and not has_function_privilege('anon', 'public.extend_booking(uuid,timestamptz,text)', 'execute'),
         'court_extend_options + extend_booking + trigger cho phép kéo dài đơn đang chơi'
  union all
  select 27, 'Đã chạy 21_attendance_rules.sql (quy tắc chấm công, sửa giờ, máy quầy)',
         to_regclass('public.attendance_settings') is not null
         and to_regclass('public.attendance_fix_requests') is not null
         and to_regprocedure('public.request_attendance_fix(uuid,text,timestamptz,text)') is not null
         and to_regprocedure('public.kiosk_issue_qr(text,text)') is not null
         and exists (select 1 from pg_trigger where tgname = 'shifts_zz_paid' and tgrelid = 'public.shifts'::regclass)
         and not has_function_privilege('anon', 'public.decide_attendance_fix(uuid,boolean,text)', 'execute'),
         'attendance_settings + yêu cầu sửa giờ + công theo khung ca + máy quầy không cần đăng nhập'
  union all
  select 28, 'Đã chạy 22_privacy_security.sql (bảo vệ dữ liệu cá nhân & bảo mật)',
         to_regclass('public.legal_documents') is not null
         and to_regclass('public.privacy_consents') is not null
         and to_regclass('public.data_subject_requests') is not null
         and to_regprocedure('public.create_guest_booking_hold_v2(uuid,timestamptz,timestamptz,text,text,text,text,text,boolean,text,text,text)') is not null
         and to_regprocedure('public.anonymize_customer(uuid,uuid,text)') is not null
         and exists (select 1 from public.legal_documents where code = 'privacy')
         and not has_function_privilege('anon', 'public.service_submit_data_request(text,text,text,text,text,text,uuid,text)', 'execute')
         and not has_table_privilege('anon', 'public.privacy_consents', 'SELECT')
         and not has_table_privilege('anon', 'public.customers', 'INSERT'),
         'văn bản pháp lý có phiên bản + bằng chứng đồng ý + yêu cầu dữ liệu + ẩn danh hóa + anon không ghi bảng'
  union all
  select 29, 'Đã chạy 23_security_hardening.sql (chống giữ sân ảo, khóa đăng nhập sai, xác thực 2 lớp)',
         to_regclass('public.security_settings') is not null
         and to_regclass('public.security_events') is not null
         and to_regclass('public.customer_hold_policies') is not null
         and to_regclass('private.hold_attempts') is not null
         and to_regprocedure('public.service_login_check(text,text,text)') is not null
         and to_regprocedure('private.mfa_satisfied(public.app_role)') is not null
         and pg_get_functiondef('private.is_owner()'::regprocedure) like '%mfa_satisfied%'
         and pg_get_functiondef('public.create_guest_booking_hold_v2(uuid,timestamptz,timestamptz,text,text,text,text,text,boolean,text,text,text)'::regprocedure) like '%HOLDS_BUSY%'
         and exists (select 1 from pg_trigger where tgname = 'payment_webhook_events_watch')
         and not has_table_privilege('anon', 'public.security_settings', 'SELECT')
         and not has_function_privilege('anon', 'public.service_login_record(text,text,text,boolean)', 'execute'),
         'ngưỡng chống lạm dụng + sự kiện an ninh + khóa đăng nhập + MFA kiểm ở is_owner / permitted_branch_ids'
  union all
  select 30, 'Đã chạy 24_push_notifications.sql (thông báo đẩy Rally Manager)',
         to_regclass('public.push_subscriptions') is not null
         and to_regclass('public.push_preferences') is not null
         and to_regclass('private.push_outbox') is not null
         and to_regprocedure('public.service_claim_push(integer)') is not null
         and exists (select 1 from pg_trigger where tgname = 'bookings_push')
         and exists (select 1 from pg_trigger where tgname = 'bank_transactions_push')
         and not private.push_endpoint_allowed('https://evil.example.com/x')
         and not has_function_privilege('anon', 'public.register_push_subscription(text,text,text,text)', 'execute')
         and not has_function_privilege('authenticated', 'public.service_claim_push(integer)', 'execute'),
         'thiết bị nhận thông báo + hàng đợi + chỉ gửi tới dịch vụ đẩy chính thức'
  union all
  select 12, 'pg_cron (tùy chọn)',
         true,
         case when exists (select 1 from pg_extension where extname = 'pg_cron')
              then 'đã bật — xem job: select * from cron.job where jobname like ''rally-%'';'
              else 'chưa bật (không bắt buộc) — chạy 03_jobs_optional.sql nếu muốn' end
)
select n, check_name, ok, detail from checks order by n;
