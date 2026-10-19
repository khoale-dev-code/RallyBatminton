-- =============================================================================
-- RALLY BADMINTON — 02_app_rpc.sql   (BẮT BUỘC, chạy sau 00 và 01)
-- Bổ sung phục vụ giao diện Next.js. Chạy lại được nhiều lần.
--   * brand_settings.payment_instructions: hướng dẫn đặt cọc hiển thị sau khi giữ sân
--   * list_catalog            : danh mục công khai có lọc + phân trang tại database
--   * create_product          : tạo sản phẩm + biến thể mặc định trong 1 giao dịch
--   * set_staff_permissions   : thay toàn bộ quyền của 1 nhân viên tại 1 chi nhánh (tự thêm quyền tiên quyết)
--   * preview_payroll_month   : xem trước bảng lương trước khi chốt
--   * payroll_periods_read    : nhân viên đọc được kỳ lương có phiếu của mình
-- Các hàm SECURITY INVOKER: RLS của người gọi vẫn áp dụng đầy đủ.
-- =============================================================================

begin;

alter table public.brand_settings
  add column if not exists payment_instructions text
    constraint brand_payment_instructions_len check (payment_instructions is null or char_length(payment_instructions) <= 1000),
  add column if not exists address_line text
    constraint brand_address_len check (address_line is null or char_length(address_line) <= 250);

-- -----------------------------------------------------------------------------
-- Danh mục công khai: lọc theo loại / nhóm / chi nhánh / từ khóa, phân trang tại DB
-- -----------------------------------------------------------------------------
create or replace function public.list_catalog(
  p_kind public.product_kind,
  p_category_slug text default null,
  p_branch_id uuid default null,
  p_search text default null,
  p_limit integer default 24,
  p_offset integer default 0)
returns table (
  id uuid,
  name text,
  slug text,
  kind public.product_kind,
  is_bundle boolean,
  brand_name text,
  description text,
  category_name text,
  category_slug text,
  min_price integer,
  max_price integer,
  compare_at_price integer,
  cover_path text,
  available_quantity bigint,
  total_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select nullif(btrim(coalesce(p_search, '')), '') as term,
           least(greatest(coalesce(p_limit, 24), 1), 60) as lim,
           greatest(coalesce(p_offset, 0), 0) as off
  ),
  base as (
    select p.*, c.name as cat_name, c.slug as cat_slug
      from public.products p
      left join public.product_categories c on c.id = p.category_id
     where p.kind = p_kind and p.is_active and p.deleted_at is null
       and (p_category_slug is null or c.slug = p_category_slug)
       and ((select term from params) is null
            or p.name ilike '%' || replace(replace((select term from params), '%', '\%'), '_', '\_') || '%'
            or coalesce(p.brand_name, '') ilike '%' || replace(replace((select term from params), '%', '\%'), '_', '\_') || '%')
  ),
  variant_stock as (
    select v.product_id, v.id as variant_id,
           coalesce(sum(il.on_hand) filter (where il.is_listed and (p_branch_id is null or il.branch_id = p_branch_id)), 0) as on_hand,
           bool_or(il.is_listed and (p_branch_id is null or il.branch_id = p_branch_id)) as listed
      from public.product_variants v
      left join public.inventory_levels il on il.variant_id = v.id
     where v.is_active and v.deleted_at is null
     group by v.product_id, v.id
  ),
  single_stock as (
    select vs.product_id, sum(vs.on_hand) as qty, bool_or(coalesce(vs.listed, false)) as listed
      from variant_stock vs group by vs.product_id
  ),
  bundle_stock as (
    select bc.bundle_product_id as product_id,
           min(floor(coalesce(vs.on_hand, 0) / bc.quantity))::bigint as qty,
           bool_and(coalesce(vs.listed, false)) as listed
      from public.bundle_components bc
      left join variant_stock vs on vs.variant_id = bc.component_variant_id
     group by bc.bundle_product_id
  ),
  prices as (
    select b.id as product_id,
           case when b.kind = 'sale' then
             (select min(coalesce(v.price_override, b.base_price)) from public.product_variants v
               where v.product_id = b.id and v.is_active and v.deleted_at is null)
           else (select min(r.price) from public.rental_rates r where r.product_id = b.id and r.is_active) end as min_price,
           case when b.kind = 'sale' then
             (select max(coalesce(v.price_override, b.base_price)) from public.product_variants v
               where v.product_id = b.id and v.is_active and v.deleted_at is null)
           else (select max(r.price) from public.rental_rates r where r.product_id = b.id and r.is_active) end as max_price
      from base b
  ),
  joined as (
    select b.id, b.name, b.slug, b.kind, b.is_bundle, b.brand_name, b.description,
           b.cat_name, b.cat_slug, pr.min_price, pr.max_price, b.compare_at_price,
           (select ph.storage_path from public.product_photos ph
             where ph.product_id = b.id order by ph.is_cover desc, ph.sort_order, ph.created_at limit 1) as cover_path,
           case when b.is_bundle then coalesce(bs.qty, 0) else coalesce(ss.qty, 0) end as available_quantity,
           case when b.is_bundle then coalesce(bs.listed, false) else coalesce(ss.listed, false) end as listed
      from base b
      join prices pr on pr.product_id = b.id
      left join single_stock ss on ss.product_id = b.id
      left join bundle_stock bs on bs.product_id = b.id
     where pr.min_price is not null
  )
  select j.id, j.name, j.slug, j.kind, j.is_bundle, j.brand_name, j.description, j.cat_name, j.cat_slug,
         j.min_price, j.max_price, j.compare_at_price, j.cover_path, j.available_quantity,
         count(*) over () as total_count
    from joined j
   where j.listed
   order by j.available_quantity = 0, j.name
   limit (select lim from params) offset (select off from params);
$$;

-- -----------------------------------------------------------------------------
-- Tạo sản phẩm + biến thể mặc định (atomic, RLS catalog.edit áp dụng)
-- -----------------------------------------------------------------------------
create or replace function public.create_product(
  p_kind public.product_kind,
  p_name text,
  p_sku text,
  p_category_id uuid default null,
  p_base_price integer default null,
  p_description text default null,
  p_brand_name text default null,
  p_is_bundle boolean default false)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.products (kind, name, category_id, base_price, description, brand_name, is_bundle, created_by)
  values (p_kind, btrim(p_name), p_category_id, p_base_price, nullif(btrim(coalesce(p_description, '')), ''),
          nullif(btrim(coalesce(p_brand_name, '')), ''), coalesce(p_is_bundle, false), (select auth.uid()))
  returning id into v_id;

  insert into public.product_variants (product_id, sku, is_default)
  values (v_id, upper(btrim(p_sku)), true);
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Gán quyền theo chi nhánh (thay thế toàn bộ, tự thêm quyền tiên quyết)
-- -----------------------------------------------------------------------------
create or replace function public.set_staff_permissions(
  p_user_id uuid,
  p_branch_id uuid,
  p_permissions public.app_permission[])
returns public.app_permission[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_final public.app_permission[];
begin
  select coalesce(array_agg(distinct x order by x), '{}')
    into v_final
    from (
      select unnest(coalesce(p_permissions, '{}')) as x
      union
      select private.permission_prerequisite(y) from unnest(coalesce(p_permissions, '{}')) y
    ) s
   where x is not null;

  delete from public.staff_branch_permissions
   where user_id = p_user_id and branch_id = p_branch_id and permission <> all (v_final);

  insert into public.staff_branch_permissions (user_id, branch_id, permission, granted_by)
  select p_user_id, p_branch_id, x, (select auth.uid()) from unnest(v_final) x
  on conflict (user_id, branch_id, permission) do nothing;
  return v_final;
end;
$$;

-- -----------------------------------------------------------------------------
-- Xem trước bảng lương tháng (cùng công thức với close_payroll_month)
-- -----------------------------------------------------------------------------
create or replace function public.preview_payroll_month(p_month date)
returns table (
  employee_id uuid,
  employee_code text,
  employee_name text,
  shifts_count integer,
  paid_minutes integer,
  base_pay bigint,
  adjustments_total bigint,
  net_pay bigint,
  unresolved_shifts integer,
  missing_rate_shifts integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_next date;
begin
  perform private.require_owner();
  if p_month is null or p_month <> date_trunc('month', p_month)::date then
    perform private.raise_error('INVALID_MONTH');
  end if;
  v_next := (p_month + interval '1 month')::date;
  return query
  with calc as (
    select s.employee_id as emp,
           count(*) filter (where s.status = 'present')::integer as n_present,
           coalesce(sum(s.paid_minutes), 0)::integer as mins,
           coalesce(sum(case
             when s.status <> 'present' or r.id is null then 0
             when r.pay_type = 'hourly' then round(r.hourly_rate::numeric * s.paid_minutes / 60)
             else round(r.daily_rate::numeric * s.paid_minutes / r.standard_day_minutes) end), 0)::bigint as gross,
           count(*) filter (where s.status = 'scheduled')::integer as n_unresolved,
           count(*) filter (where s.status = 'present' and r.id is null)::integer as n_missing
      from public.shifts s
      left join lateral (
        select pr.* from public.employee_pay_rates pr
         where pr.employee_id = s.employee_id and pr.effective_from <= s.work_date
         order by pr.effective_from desc limit 1) r on true
     where s.work_date >= p_month and s.work_date < v_next and s.deleted_at is null
     group by s.employee_id
  ), adj as (
    select a.employee_id as emp, sum(a.amount)::bigint as total
      from public.payroll_adjustments a
     where a.month = p_month and a.voided_at is null
     group by a.employee_id
  ), people as (
    select emp from calc union select emp from adj
  )
  select e.id, e.code, e.full_name,
         coalesce(c.n_present, 0), coalesce(c.mins, 0), coalesce(c.gross, 0),
         coalesce(a.total, 0), coalesce(c.gross, 0) + coalesce(a.total, 0),
         coalesce(c.n_unresolved, 0), coalesce(c.n_missing, 0)
    from people p
    join public.employees e on e.id = p.emp
    left join calc c on c.emp = p.emp
    left join adj a on a.emp = p.emp
   order by e.code;
end;
$$;

revoke all on function public.list_catalog(public.product_kind, text, uuid, text, integer, integer) from public;
revoke all on function public.create_product(public.product_kind, text, text, uuid, integer, text, text, boolean) from public, anon;
revoke all on function public.set_staff_permissions(uuid, uuid, public.app_permission[]) from public, anon;
revoke all on function public.preview_payroll_month(date) from public, anon;

grant execute on function public.list_catalog(public.product_kind, text, uuid, text, integer, integer) to anon, authenticated;
grant execute on function public.create_product(public.product_kind, text, text, uuid, integer, text, text, boolean) to authenticated;
grant execute on function public.set_staff_permissions(uuid, uuid, public.app_permission[]) to authenticated;
grant execute on function public.preview_payroll_month(date) to authenticated;

-- -----------------------------------------------------------------------------
-- Nhân viên xem được tháng của phiếu lương của chính mình (trang "Ca & lương của tôi").
-- -----------------------------------------------------------------------------
drop policy if exists payroll_periods_read on public.payroll_periods;
create policy payroll_periods_read on public.payroll_periods
  for select to authenticated
  using (
    (select private.is_owner())
    or exists (select 1 from public.payroll_lines pl
                where pl.period_id = payroll_periods.id
                  and pl.employee_id = (select private.current_employee_id())));

commit;
