-- =============================================================================
-- RALLY BADMINTON — 13_performance.sql
-- Tăng tốc truy vấn: chỉ mục cho tìm kiếm / phân trang và tối ưu danh sách thành viên.
--
-- Chạy SAU 00 → 12. Chạy lại an toàn (chỉ thêm chỉ mục, thay hàm cùng chữ ký).
-- Không đổi dữ liệu, không đổi quyền: hàm admin_list_members giữ nguyên kiểm tra quyền và kết quả.
-- =============================================================================

begin;

-- 1. Tìm kiếm "chứa chuỗi" (ilike '%…%') ---------------------------------------------------
-- B-tree không dùng được cho '%abc%', nên dùng chỉ mục trigram. pg_trgm có sẵn trên Supabase
-- (schema extensions); nếu dự án cũ đã cài ở schema khác thì dùng đúng schema đó.
create extension if not exists pg_trgm with schema extensions;

do $$
declare
  v_schema text;
begin
  select n.nspname into v_schema
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pg_trgm';

  execute format('create index if not exists customers_phone_trgm_idx on public.customers using gin (phone %I.gin_trgm_ops)', v_schema);
  execute format('create index if not exists customers_name_trgm_idx on public.customers using gin (full_name %I.gin_trgm_ops)', v_schema);
  execute format('create index if not exists member_profiles_name_trgm_idx on public.member_profiles using gin (full_name %I.gin_trgm_ops)', v_schema);
  execute format('create index if not exists member_profiles_phone_trgm_idx on public.member_profiles using gin (phone %I.gin_trgm_ops)', v_schema);
  execute format('create index if not exists products_name_trgm_idx on public.products using gin (name %I.gin_trgm_ops) where deleted_at is null', v_schema);
end;
$$;

-- 2. Danh sách sắp theo thời gian (trang admin) ---------------------------------------------
create index if not exists customers_created_idx on public.customers (created_at desc);
create index if not exists member_profiles_created_idx on public.member_profiles (created_at desc);
-- Nhật ký: sắp theo thời gian + id, có/không lọc theo bảng (BRIN cũ không giúp được ORDER BY … LIMIT).
create index if not exists audit_events_time_idx on public.audit_events (occurred_at desc, id desc);
create index if not exists audit_events_table_time_idx on public.audit_events (table_name, occurred_at desc, id desc);
-- Bảng lương: điều chỉnh theo tháng.
create index if not exists payroll_adjustments_month_idx on public.payroll_adjustments (month, created_at desc);

-- 3. Danh sách thành viên: chỉ đếm số đơn / tìm hồ sơ khách cho đúng trang đang xem ----------
-- Bản cũ tính booking_count cho MỌI thành viên khớp bộ lọc trước khi phân trang.
create or replace function public.admin_list_members(
  p_query text default null,
  p_filter text default 'all',
  p_limit integer default 50,
  p_offset integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_term text := nullif(btrim(regexp_replace(coalesce(p_query, ''), '[%_\\]', '', 'g')), '');
  v_digits text := regexp_replace(coalesce(p_query, ''), '\D', '', 'g');
  v_result jsonb;
begin
  if not private.can_view_members() then
    perform private.raise_error('PERMISSION_DENIED', 'booking.view');
  end if;
  with base as materialized (
    select m.user_id, m.full_name, m.phone, m.login_kind, m.points, m.lifetime_points, m.tier, m.is_locked,
           m.created_at, u.email, u.last_sign_in_at
      from public.member_profiles m
      join auth.users u on u.id = m.user_id
     where (v_term is null
            or m.full_name ilike '%' || v_term || '%'
            or (char_length(v_digits) >= 4 and m.phone like '%' || v_digits || '%')
            or (position('@' in v_term) > 0 and not private.member_is_alias_email(u.email) and u.email ilike '%' || v_term || '%'))
       and case coalesce(p_filter, 'all')
             when 'locked' then m.is_locked
             when 'silver' then m.tier = 'silver'
             when 'gold' then m.tier = 'gold'
             when 'diamond' then m.tier = 'diamond'
             when 'no_phone' then m.phone is null
             else true end
  ),
  page as (
    select b.*,
           (select count(*) from public.bookings bk where bk.member_user_id = b.user_id and bk.deleted_at is null) as booking_count,
           (select cu.id from public.customers cu where cu.auth_user_id = b.user_id) as customer_id
      from (select * from base order by created_at desc
            limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0)) b
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_id', x.user_id,
               'full_name', x.full_name,
               'phone', x.phone,
               'email', case when private.member_is_alias_email(x.email) then null else x.email end,
               'login_kind', x.login_kind,
               'points', x.points,
               'lifetime_points', x.lifetime_points,
               'tier', x.tier,
               'is_locked', x.is_locked,
               'booking_count', x.booking_count,
               'customer_id', x.customer_id,
               'last_sign_in_at', x.last_sign_in_at,
               'created_at', x.created_at) order by x.created_at desc)
        from page x), '[]'::jsonb),
    'summary', jsonb_build_object(
      'members', (select count(*) from public.member_profiles),
      'new_30d', (select count(*) from public.member_profiles where created_at > now() - interval '30 days'),
      'with_phone', (select count(*) from public.member_profiles where phone is not null),
      'locked', (select count(*) from public.member_profiles where is_locked)))
  into v_result;
  return v_result;
end;
$$;

revoke all on function public.admin_list_members(text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_members(text, text, integer, integer) to authenticated;

commit;

-- Cập nhật thống kê để bộ lập kế hoạch dùng chỉ mục mới ngay.
analyze public.customers;
analyze public.member_profiles;
analyze public.audit_events;
analyze public.payroll_adjustments;
analyze public.products;

notify pgrst, 'reload schema';
