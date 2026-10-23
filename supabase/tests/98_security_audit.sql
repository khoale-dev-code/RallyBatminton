-- =============================================================================
-- 98_security_audit.sql — KIỂM TOÁN PHÂN QUYỀN (chỉ đọc, chạy bao nhiêu lần cũng được)
-- Supabase → SQL Editor → dán toàn bộ → Run. Mọi dòng "WARN" cần xem lại; "INFO" để tham khảo.
-- Kiểm: RLS từng bảng, quyền của anon / authenticated, policy mở cho anon, hàm SECURITY DEFINER thiếu
-- search_path, hàm anon gọi được, hàm service_* lộ cho người dùng, view vượt RLS, bucket công khai.
-- =============================================================================
with
public_tables as (
  select c.oid, c.relname, c.relrowsecurity as rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
),
-- Bảng được thiết kế cho khách chưa đăng nhập đọc công khai (dữ liệu không định danh).
anon_read_allowed(relname) as (
  values ('brand_settings'), ('branches'), ('courts'), ('court_photos'), ('court_surfaces'), ('amenities'),
         ('branch_amenities'), ('price_rules'), ('products'), ('product_variants'), ('product_categories'),
         ('product_images'), ('product_units'), ('product_options'), ('product_option_values'), ('rental_rates'),
         ('bundle_components'), ('inventory_levels'), ('product_photos'), ('legal_documents'), ('data_retention_policies')
),
checks as (
  -- 1. Bảng public phải bật RLS
  select 1 as n, 'RLS bật' as check_name, t.relname::text as object,
         case when t.rls then 'OK' else 'WARN' end as status,
         case when t.rls then '' else 'Bảng chưa bật Row Level Security — ai có quyền bảng là đọc / ghi được' end as detail
  from public_tables t
  union all
  -- 2. Quyền của anon trên bảng: chỉ được SELECT trên bảng công khai
  select 2, 'Quyền anon trên bảng', t.relname::text,
         case when not has_table_privilege('anon', t.oid, 'SELECT,INSERT,UPDATE,DELETE') then 'OK'
              when t.relname in (select relname from anon_read_allowed)
                   and not has_table_privilege('anon', t.oid, 'INSERT,UPDATE,DELETE') then 'OK'
              else 'WARN' end,
         concat_ws(', ',
           case when has_table_privilege('anon', t.oid, 'SELECT') then 'SELECT' end,
           case when has_table_privilege('anon', t.oid, 'INSERT') then 'INSERT' end,
           case when has_table_privilege('anon', t.oid, 'UPDATE') then 'UPDATE' end,
           case when has_table_privilege('anon', t.oid, 'DELETE') then 'DELETE' end)
  from public_tables t
  union all
  -- 3. Policy áp dụng cho anon / public (mọi người)
  select 3, 'Policy mở cho anon', p.tablename || '.' || p.policyname,
         case when p.tablename in (select relname from anon_read_allowed) and p.cmd = 'SELECT' then 'OK' else 'WARN' end,
         p.cmd || ' cho ' || array_to_string(p.roles, ',')
  from pg_policies p
  where p.schemaname = 'public' and (p.roles && array['anon', 'public']::name[])
  union all
  -- 4. Bảng nhạy cảm: authenticated không được ghi trực tiếp (chỉ qua hàm RPC kiểm tra quyền)
  select 4, 'Ghi trực tiếp bảng nhạy cảm', t.relname::text,
         case when has_table_privilege('authenticated', t.oid, 'INSERT,DELETE') then 'WARN' else 'OK' end,
         'authenticated ' || concat_ws(',', case when has_table_privilege('authenticated', t.oid, 'INSERT') then 'INSERT' end,
                                             case when has_table_privilege('authenticated', t.oid, 'DELETE') then 'DELETE' end)
  from public_tables t
  where t.relname in ('privacy_consents', 'data_subject_requests', 'legal_documents', 'payment_webhook_events',
                      'audit_events', 'bank_transactions', 'payments', 'member_point_ledger')
  union all
  -- 5. Hàm SECURITY DEFINER phải cố định search_path (chống chiếm quyền qua schema giả)
  select 5, 'SECURITY DEFINER có search_path', n.nspname || '.' || p.proname,
         case when p.proconfig is not null and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%') then 'OK' else 'WARN' end,
         coalesce(array_to_string(p.proconfig, ' '), 'không đặt search_path')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where p.prosecdef and n.nspname in ('public', 'private')
  union all
  -- 6. Hàm khách chưa đăng nhập gọi được
  select 6, 'Hàm anon gọi được', p.proname::text,
         case when p.proname in ('list_published_branches', 'get_branch_busy_slots', 'quote_booking', 'list_catalog', 'kiosk_issue_qr')
              then 'OK' else 'WARN' end,
         pg_get_function_identity_arguments(p.oid)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute')
  union all
  -- 7. Hàm chỉ dành cho máy chủ (service_*) không được cấp cho người dùng đăng nhập
  select 7, 'Hàm service_* chỉ cho máy chủ', p.proname::text,
         case when has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute')
              then 'WARN' else 'OK' end,
         pg_get_function_identity_arguments(p.oid)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'service\_%'
  union all
  -- 8. View trong public chạy bằng quyền người tạo sẽ vượt RLS
  select 8, 'View tôn trọng RLS', c.relname::text,
         case when coalesce((select option_value from pg_options_to_table(c.reloptions) where option_name = 'security_invoker'), 'false') in ('true', 'on')
                   or not has_table_privilege('anon', c.oid, 'SELECT') and not has_table_privilege('authenticated', c.oid, 'SELECT')
              then 'OK' else 'WARN' end,
         'security_invoker=' || coalesce((select option_value from pg_options_to_table(c.reloptions) where option_name = 'security_invoker'), 'false')
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v'
  union all
  -- 9. Bucket lưu trữ công khai (ai có link là xem được) — chỉ nên chứa ảnh sân / sản phẩm
  select 9, 'Bucket công khai', b.id::text, 'INFO', 'public = ' || b.public::text || ' — không lưu giấy tờ / dữ liệu cá nhân ở đây'
  from storage.buckets b
  where b.public
  union all
  -- 10. Tài khoản chủ sân
  select 10, 'Số chủ sân đang hoạt động', 'staff_accounts', case when count(*) between 1 and 3 then 'OK' else 'WARN' end,
         count(*)::text || ' tài khoản owner — mỗi tài khoản có toàn quyền, giữ ít nhất có thể'
  from public.staff_accounts where role = 'owner' and is_active
)
select n, check_name, object, status, detail
from checks
order by case status when 'WARN' then 0 when 'INFO' then 1 else 2 end, n, object;
