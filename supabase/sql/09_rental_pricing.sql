-- =============================================================================
-- RALLY BADMINTON — 09_rental_pricing.sql
-- Giá thuê theo HÌNH THỨC + PHỤ PHÍ TRẢ TRỄ tính tự động ở database.
--
-- Chạy SAU 00 → 07 (08 tùy chọn). Chạy lại an toàn.
--
-- 1. Gói giá thuê có hình thức:
--      * usage   : on_site (dùng tại sân) | take_out (mang ra ngoài)  → giá khác nhau
--      * billing : duration (theo thời lượng: 1 giờ, 2 giờ, 1 ngày…) | session (theo trận: hết giờ sân)
--    Ví dụ: Vợt Astrox 77 — "Hết trận" tại sân 50.000đ; "1 giờ" tại sân 30.000đ; "1 ngày" mang về 120.000đ.
-- 2. Chính sách trả trễ trên từng gói (chụp lại vào phiếu khi giao đồ):
--      * grace_minutes          : ân hạn — trễ trong khoảng này không tính phí
--      * overtime_block_minutes : quá ân hạn thì tính theo block (làm tròn LÊN), đếm từ giờ hẹn trả
--      * overtime_block_price   : giá 1 block / 1 món; để trống = tự tính theo tỉ lệ giá gói
--      * overtime_cap           : trần phụ phí / 1 món (tùy chọn)
--    Ví dụ: thuê 1 giờ 30.000đ (block 30 phút = 15.000đ, ân hạn 10 phút), trả sau 2 giờ
--           → trễ 60 phút → 2 block → phụ phí 30.000đ/món.
-- 3. Thuê theo trận gắn với lượt đặt sân: hạn trả = giờ kết thúc sân; khách gia hạn sân thì hạn trả
--    tự lùi theo. Mang ra ngoài bắt buộc ghi vật cầm cọc (CCCD, tiền cọc…).
-- 4. Nhận trả: database tự tính phụ phí tại thời điểm nhận; nhân viên chỉ được GIẢM khi ghi lý do.
-- =============================================================================

begin;

-- 1. Kiểu dữ liệu ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'rental_usage' and typnamespace = 'public'::regnamespace) then
    create type public.rental_usage as enum ('on_site', 'take_out');
  end if;
  if not exists (select 1 from pg_type where typname = 'rental_billing' and typnamespace = 'public'::regnamespace) then
    create type public.rental_billing as enum ('duration', 'session');
  end if;
end $$;

-- 2. Gói giá thuê ------------------------------------------------------------------------------
alter table public.rental_rates
  add column if not exists usage public.rental_usage not null default 'on_site',
  add column if not exists billing public.rental_billing not null default 'duration',
  add column if not exists grace_minutes integer,
  add column if not exists overtime_block_minutes integer,
  add column if not exists overtime_block_price integer,
  add column if not exists overtime_cap integer;

comment on column public.rental_rates.usage is 'on_site: dùng tại sân; take_out: mang ra ngoài (bắt buộc cầm cọc).';
comment on column public.rental_rates.billing is 'duration: theo thời lượng; session: theo trận (hạn trả = giờ kết thúc sân của lượt đặt).';
comment on column public.rental_rates.grace_minutes is 'Ân hạn trả trễ (phút) — trễ trong khoảng này không tính phụ phí.';
comment on column public.rental_rates.overtime_block_minutes is 'Quá ân hạn: tính phụ phí theo block (làm tròn lên), đếm từ giờ hẹn trả.';
comment on column public.rental_rates.overtime_block_price is 'Giá 1 block cho 1 món. NULL = tự tính theo tỉ lệ giá gói.';
comment on column public.rental_rates.overtime_cap is 'Trần phụ phí trễ cho 1 món (NULL = không giới hạn).';

-- Mặc định hợp lý theo hình thức & thời lượng.
create or replace function private.rental_default_policy(
  p_usage public.rental_usage, p_billing public.rental_billing, p_duration integer,
  out grace_minutes integer, out block_minutes integer)
language sql
immutable
set search_path = ''
as $$
  select
    case when p_billing = 'session' then 15
         when p_usage = 'take_out' and p_duration >= 1440 then 60
         when p_usage = 'take_out' then 30
         else 10 end,
    case when p_duration >= 1440 then 720
         when p_duration > 240 then 60
         else 30 end;
$$;

-- Giá block tự tính: tỉ lệ theo giá gói, làm tròn lên 1.000đ.
create or replace function private.rental_auto_block_price(p_price integer, p_duration integer, p_block integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when coalesce(p_price, 0) <= 0 then 0
              else (ceil(p_price::numeric * p_block / greatest(p_duration, 1) / 1000) * 1000)::integer end;
$$;

create or replace function private.rental_rates_fill()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v record;
begin
  select * into v from private.rental_default_policy(new.usage, new.billing, new.duration_minutes);
  new.grace_minutes := coalesce(new.grace_minutes, v.grace_minutes);
  new.overtime_block_minutes := coalesce(new.overtime_block_minutes, v.block_minutes);
  return new;
end;
$$;

drop trigger if exists rental_rates_fill on public.rental_rates;
create trigger rental_rates_fill before insert or update on public.rental_rates
  for each row execute function private.rental_rates_fill();

update public.rental_rates r
   set grace_minutes = coalesce(r.grace_minutes, d.grace_minutes),
       overtime_block_minutes = coalesce(r.overtime_block_minutes, d.block_minutes)
  from public.rental_rates x
  cross join lateral private.rental_default_policy(x.usage, x.billing, x.duration_minutes) d
 where x.id = r.id and (r.grace_minutes is null or r.overtime_block_minutes is null);

alter table public.rental_rates
  alter column grace_minutes set not null,
  alter column overtime_block_minutes set not null;

alter table public.rental_rates drop constraint if exists rental_rates_product_duration_key;
alter table public.rental_rates drop constraint if exists rental_rates_kind_key;
alter table public.rental_rates
  add constraint rental_rates_kind_key unique (product_id, usage, billing, duration_minutes);
alter table public.rental_rates drop constraint if exists rental_rates_policy;
alter table public.rental_rates add constraint rental_rates_policy check (
  grace_minutes between 0 and 240
  and overtime_block_minutes between 5 and 1440
  and (overtime_block_price is null or overtime_block_price between 0 and 100000000)
  and (overtime_cap is null or overtime_cap between 0 and 100000000));
alter table public.rental_rates drop constraint if exists rental_rates_session_on_site;
alter table public.rental_rates add constraint rental_rates_session_on_site check (billing <> 'session' or usage = 'on_site');

-- 3. Phiếu thuê: chụp lại hình thức & chính sách ----------------------------------------------
alter table public.rentals
  add column if not exists usage public.rental_usage not null default 'on_site',
  add column if not exists billing public.rental_billing not null default 'duration',
  add column if not exists booking_id uuid references public.bookings (id),
  add column if not exists collateral text,
  add column if not exists grace_minutes integer,
  add column if not exists overtime_block_minutes integer,
  add column if not exists overtime_block_price integer,
  add column if not exists overtime_cap integer,
  add column if not exists late_minutes integer,
  add column if not exists late_fee_auto integer not null default 0,
  add column if not exists late_fee_reason text;

comment on column public.rentals.collateral is 'Vật cầm cọc khi mang ra ngoài: CCCD, bằng lái, tiền cọc…';
comment on column public.rentals.late_fee_auto is 'Phụ phí trễ hệ thống tự tính lúc nhận trả; late_fee là số thực thu (≤ tự tính khi có lý do giảm).';

create index if not exists rentals_booking_idx on public.rentals (booking_id) where booking_id is not null;

create or replace function private.rentals_fill()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v record;
  v_booking public.bookings;
begin
  if tg_op = 'INSERT' then
    select * into v from private.rental_default_policy(new.usage, new.billing, new.duration_minutes);
    new.grace_minutes := coalesce(new.grace_minutes, v.grace_minutes);
    new.overtime_block_minutes := coalesce(new.overtime_block_minutes, v.block_minutes);
    new.overtime_block_price := coalesce(new.overtime_block_price,
      private.rental_auto_block_price(new.unit_price, new.duration_minutes, new.overtime_block_minutes));
  end if;
  if new.billing = 'session' and new.usage <> 'on_site' then
    perform private.raise_error('RENTAL_SESSION_ON_SITE');
  end if;
  if new.booking_id is not null and (tg_op = 'INSERT' or new.booking_id is distinct from old.booking_id) then
    select * into v_booking from public.bookings where id = new.booking_id;
    if not found or v_booking.branch_id <> new.branch_id or v_booking.kind <> 'customer' then
      perform private.raise_error('RENTAL_BOOKING_INVALID');
    end if;
    if new.usage <> 'on_site' then
      perform private.raise_error('RENTAL_BOOKING_TAKE_OUT');
    end if;
  end if;
  new.collateral := nullif(btrim(coalesce(new.collateral, '')), '');
  return new;
end;
$$;

drop trigger if exists rentals_fill on public.rentals;
create trigger rentals_fill before insert or update on public.rentals
  for each row execute function private.rentals_fill();

-- Phiếu cũ: chính sách mặc định tại sân, theo thời lượng.
update public.rentals r
   set grace_minutes = coalesce(r.grace_minutes, 10),
       overtime_block_minutes = coalesce(r.overtime_block_minutes, 30),
       overtime_block_price = coalesce(r.overtime_block_price,
         private.rental_auto_block_price(r.unit_price, r.duration_minutes, coalesce(r.overtime_block_minutes, 30))),
       late_fee_auto = case when r.late_fee_auto = 0 then r.late_fee else r.late_fee_auto end
 where r.grace_minutes is null or r.overtime_block_minutes is null or r.overtime_block_price is null;

alter table public.rentals
  alter column grace_minutes set not null,
  alter column overtime_block_minutes set not null,
  alter column overtime_block_price set not null;

alter table public.rentals drop constraint if exists rentals_policy;
alter table public.rentals add constraint rentals_policy check (
  grace_minutes between 0 and 240
  and overtime_block_minutes between 5 and 1440
  and overtime_block_price between 0 and 100000000
  and (overtime_cap is null or overtime_cap between 0 and 100000000)
  and (late_minutes is null or late_minutes >= 0)
  and late_fee_auto >= 0
  and (collateral is null or char_length(collateral) <= 120)
  and (late_fee_reason is null or char_length(late_fee_reason) between 3 and 200));

-- 4. Tính phụ phí ------------------------------------------------------------------------------
-- Công thức (giống src/lib/rental-fee.ts):
--   trễ = số phút nguyên từ hạn trả đến lúc trả; trễ ≤ ân hạn → 0
--   block = ceil(trễ / độ dài block); phí = block × giá block × số món; có trần thì ≤ trần × số món
create or replace function private.rental_overtime(
  p_due timestamptz, p_at timestamptz, p_quantity integer,
  p_grace integer, p_block integer, p_block_price integer, p_cap integer,
  out late_minutes integer, out blocks integer, out fee bigint)
language plpgsql
immutable
set search_path = ''
as $$
begin
  late_minutes := greatest(0, floor(extract(epoch from (p_at - p_due)) / 60))::integer;
  if late_minutes <= coalesce(p_grace, 0) then
    blocks := 0;
    fee := 0;
    return;
  end if;
  blocks := ceil(late_minutes::numeric / greatest(p_block, 1))::integer;
  fee := blocks::bigint * p_block_price * p_quantity;
  if p_cap is not null then
    fee := least(fee, p_cap::bigint * p_quantity);
  end if;
end;
$$;

-- Hạn trả thực tế: thuê theo trận đi theo giờ kết thúc sân (khách gia hạn sân thì hạn trả lùi theo).
create or replace function private.rental_effective_due(p_rental public.rentals)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case
    when p_rental.billing = 'session' and p_rental.booking_id is not null then
      greatest(p_rental.due_at, coalesce((
        select upper(b.during) from public.bookings b
         where b.id = p_rental.booking_id and b.status in ('confirmed', 'checked_in', 'completed')), p_rental.due_at))
    else p_rental.due_at end;
$$;

-- Xem trước phụ phí (đọc theo RLS của người gọi — chỉ nhân viên có quyền cho thuê ở chi nhánh đó).
create or replace function public.rental_overtime_preview(p_rental_id uuid, p_at timestamptz default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v public.rentals;
  v_due timestamptz;
  v_at timestamptz := coalesce(p_at, now());
  v_o record;
begin
  select * into v from public.rentals where id = p_rental_id;
  if not found then
    perform private.raise_error('RENTAL_NOT_FOUND');
  end if;
  v_due := private.rental_effective_due(v);
  if v.status <> 'out' then
    v_at := coalesce(v.returned_at, v_at);
  end if;
  select * into v_o from private.rental_overtime(v_due, v_at, v.quantity, v.grace_minutes,
                                                 v.overtime_block_minutes, v.overtime_block_price, v.overtime_cap);
  return jsonb_build_object(
    'due_at', v_due, 'at', v_at, 'late_minutes', v_o.late_minutes, 'blocks', v_o.blocks, 'fee', v_o.fee,
    'grace_minutes', v.grace_minutes, 'block_minutes', v.overtime_block_minutes,
    'block_price', v.overtime_block_price, 'cap', v.overtime_cap, 'quantity', v.quantity);
end;
$$;

-- 5. Giao đồ ---------------------------------------------------------------------------------------
drop function if exists public.checkout_rental(uuid, uuid, uuid, integer, text, text, uuid, boolean, public.payment_method, text, text, text);

create or replace function public.checkout_rental(
  p_branch_id uuid,
  p_product_id uuid,
  p_rate_id uuid,
  p_quantity integer,
  p_customer_phone text,
  p_customer_name text,
  p_variant_id uuid default null,
  p_collect_payment boolean default true,
  p_payment_method public.payment_method default 'cash',
  p_payment_reference text default null,
  p_note text default null,
  p_idempotency_key text default null,
  p_booking_id uuid default null,
  p_collateral text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products;
  v_rate public.rental_rates;
  v_existing public.rentals;
  v_booking public.bookings;
  v_variant uuid;
  v_customer uuid;
  v_rental uuid;
  v_line record;
  v_line_id uuid;
  v_fee bigint;
  v_due timestamptz;
begin
  perform private.require_permission(p_branch_id, 'rental.operate');
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    perform private.raise_error('IDEMPOTENCY_KEY_REQUIRED');
  end if;
  select * into v_existing from public.rentals where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.branch_id <> p_branch_id or v_existing.product_id <> p_product_id then
      perform private.raise_error('IDEMPOTENCY_CONFLICT');
    end if;
    return jsonb_build_object('rental_id', v_existing.id, 'code', v_existing.code, 'replayed', true);
  end if;
  if p_quantity is null or p_quantity not between 1 and 50 then
    perform private.raise_error('INVALID_QUANTITY');
  end if;

  select * into v_product from public.products
   where id = p_product_id and kind = 'rental' and is_active and deleted_at is null;
  if not found then
    perform private.raise_error('RENTAL_UNAVAILABLE');
  end if;
  select * into v_rate from public.rental_rates
   where id = p_rate_id and product_id = p_product_id and is_active;
  if not found then
    perform private.raise_error('RENTAL_RATE_UNAVAILABLE');
  end if;

  -- Gắn lượt đặt sân (chỉ khi dùng tại sân): đúng chi nhánh, đã xác nhận/đang chơi, chưa kết thúc.
  if p_booking_id is not null then
    if v_rate.usage <> 'on_site' then
      perform private.raise_error('RENTAL_BOOKING_TAKE_OUT');
    end if;
    select * into v_booking from public.bookings where id = p_booking_id;
    if not found or v_booking.branch_id <> p_branch_id or v_booking.kind <> 'customer' then
      perform private.raise_error('RENTAL_BOOKING_INVALID');
    end if;
    if v_booking.status not in ('confirmed', 'checked_in') or upper(v_booking.during) <= now()
       or lower(v_booking.during) > now() + interval '60 minutes' then
      perform private.raise_error('RENTAL_BOOKING_NOT_ACTIVE');
    end if;
  end if;
  if v_rate.usage = 'take_out' and char_length(btrim(coalesce(p_collateral, ''))) < 2 then
    perform private.raise_error('RENTAL_COLLATERAL_REQUIRED');
  end if;

  if v_product.is_bundle then
    if p_variant_id is not null then
      perform private.raise_error('BUNDLE_VARIANT_FORBIDDEN');
    end if;
    if not exists (select 1 from public.bundle_components where bundle_product_id = p_product_id) then
      perform private.raise_error('BUNDLE_EMPTY');
    end if;
  else
    if p_variant_id is not null then
      select v.id into v_variant from public.product_variants v
       where v.id = p_variant_id and v.product_id = p_product_id and v.is_active and v.deleted_at is null;
    elsif (select count(*) from public.product_variants v
            where v.product_id = p_product_id and v.is_active and v.deleted_at is null) = 1 then
      select v.id into v_variant from public.product_variants v
       where v.product_id = p_product_id and v.is_active and v.deleted_at is null;
    else
      perform private.raise_error('VARIANT_REQUIRED');
    end if;
    if v_variant is null then
      perform private.raise_error('VARIANT_NOT_FOUND');
    end if;
  end if;

  -- Khách: nhập SĐT thì dùng SĐT; bỏ trống mà có lượt đặt sân thì lấy khách của lượt đặt.
  if btrim(coalesce(p_customer_phone, '')) = '' and v_booking.id is not null then
    v_customer := v_booking.customer_id;
  else
    v_customer := private.upsert_customer(p_customer_phone, p_customer_name);
  end if;

  v_due := case
    when v_rate.billing = 'session' and v_booking.id is not null
      then greatest(upper(v_booking.during), now() + interval '15 minutes')
    else now() + make_interval(mins => v_rate.duration_minutes) end;

  insert into public.rentals (branch_id, customer_id, product_id, rate_label, duration_minutes, unit_price,
                             quantity, due_at, note, idempotency_key, created_by,
                             usage, billing, booking_id, collateral,
                             grace_minutes, overtime_block_minutes, overtime_block_price, overtime_cap)
  values (p_branch_id, v_customer, p_product_id, v_rate.label, v_rate.duration_minutes, v_rate.price,
          p_quantity, v_due, nullif(btrim(coalesce(p_note, '')), ''), p_idempotency_key, (select auth.uid()),
          v_rate.usage, v_rate.billing, v_booking.id, p_collateral,
          v_rate.grace_minutes, v_rate.overtime_block_minutes,
          coalesce(v_rate.overtime_block_price,
                   private.rental_auto_block_price(v_rate.price, v_rate.duration_minutes, v_rate.overtime_block_minutes)),
          v_rate.overtime_cap)
  returning id, rental_fee into v_rental, v_fee;

  -- Combo => tách thành biến thể thành phần; khóa theo thứ tự variant_id. CHECK on_hand >= 0 chống phát vượt.
  for v_line in
    select x.variant_id, sum(x.qty)::integer as qty
      from (
        select bc.component_variant_id as variant_id, bc.quantity * p_quantity as qty
          from public.bundle_components bc
         where v_product.is_bundle and bc.bundle_product_id = p_product_id
        union all
        select v_variant, p_quantity where not v_product.is_bundle
      ) x
     group by x.variant_id
     order by x.variant_id
  loop
    insert into public.rental_lines (rental_id, variant_id, quantity)
    values (v_rental, v_line.variant_id, v_line.qty)
    returning id into v_line_id;
    insert into public.stock_movements (branch_id, variant_id, quantity_delta, reason, rental_line_id)
    values (p_branch_id, v_line.variant_id, -v_line.qty, 'rental_out', v_line_id);
  end loop;

  if p_collect_payment and v_fee > 0 then
    perform private.insert_payment(null, null, v_rental, 'charge', p_payment_method, v_fee,
                                   p_payment_reference, null, 'rental:' || p_idempotency_key);
  end if;

  return jsonb_build_object('rental_id', v_rental,
                            'code', (select code from public.rentals where id = v_rental),
                            'rental_fee', v_fee,
                            'due_at', v_due);
end;
$$;

-- 6. Nhận trả ---------------------------------------------------------------------------------------
-- p_late_fee NULL = thu đúng phụ phí tự tính. Nhập số nhỏ hơn (giảm/miễn) phải có p_late_fee_reason.
drop function if exists public.return_rental(uuid, jsonb, integer, integer, text);

create or replace function public.return_rental(
  p_rental_id uuid,
  p_lines jsonb default null,
  p_late_fee integer default null,
  p_damage_fee integer default 0,
  p_note text default null,
  p_late_fee_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.rentals;
  v_line public.rental_lines;
  v_ret integer;
  v_dmg integer;
  v_lost integer;
  v_input jsonb;
  v_o record;
  v_late integer;
  v_reason text := nullif(btrim(coalesce(p_late_fee_reason, '')), '');
begin
  select * into v from public.rentals where id = p_rental_id for update;
  if not found then
    perform private.raise_error('RENTAL_NOT_FOUND');
  end if;
  perform private.require_permission(v.branch_id, 'rental.operate');
  if v.status <> 'out' then
    perform private.raise_error('RENTAL_NOT_OUT', v.status::text);
  end if;
  if coalesce(p_late_fee, 0) < 0 or coalesce(p_damage_fee, 0) < 0 then
    perform private.raise_error('INVALID_FEE');
  end if;

  select * into v_o from private.rental_overtime(private.rental_effective_due(v), now(), v.quantity, v.grace_minutes,
                                                 v.overtime_block_minutes, v.overtime_block_price, v.overtime_cap);
  v_late := coalesce(p_late_fee, v_o.fee::integer);
  if v_late < v_o.fee and (v_reason is null or char_length(v_reason) < 3) then
    perform private.raise_error('LATE_FEE_REASON_REQUIRED', v_o.fee::text);
  end if;
  if v_late = v_o.fee then
    v_reason := null;
  end if;

  for v_line in select * from public.rental_lines where rental_id = v.id order by variant_id for update loop
    v_input := null;
    if p_lines is not null then
      select x.value into v_input
        from jsonb_array_elements(p_lines) as x(value)
       where (x.value ->> 'variant_id')::uuid = v_line.variant_id
       limit 1;
    end if;
    v_dmg := coalesce((v_input ->> 'damaged')::integer, 0);
    v_lost := coalesce((v_input ->> 'lost')::integer, 0);
    v_ret := coalesce((v_input ->> 'returned')::integer, v_line.quantity - v_dmg - v_lost);
    if v_ret < 0 or v_dmg < 0 or v_lost < 0 or v_ret + v_dmg + v_lost <> v_line.quantity then
      perform private.raise_error('RETURN_QUANTITY_MISMATCH', v_line.variant_id::text);
    end if;
    update public.rental_lines
       set returned_quantity = v_ret, damaged_quantity = v_dmg, lost_quantity = v_lost
     where id = v_line.id;
    if v_ret > 0 then
      insert into public.stock_movements (branch_id, variant_id, quantity_delta, reason, rental_line_id)
      values (v.branch_id, v_line.variant_id, v_ret, 'rental_return', v_line.id);
    end if;
  end loop;

  update public.rentals
     set status = 'returned', returned_at = now(), returned_by = (select auth.uid()),
         late_minutes = v_o.late_minutes, late_fee_auto = v_o.fee::integer,
         late_fee = v_late, late_fee_reason = v_reason,
         damage_fee = coalesce(p_damage_fee, 0),
         note = coalesce(nullif(btrim(coalesce(p_note, '')), ''), note)
   where id = v.id;

  return jsonb_build_object('rental_id', v.id, 'status', 'returned',
                            'late_minutes', v_o.late_minutes, 'late_fee_auto', v_o.fee, 'late_fee', v_late,
                            'extra_fees', v_late + coalesce(p_damage_fee, 0));
end;
$$;

-- 7. Tạo sản phẩm kèm gói thuê (thêm hình thức & chính sách vào rental_rates) ------------------------
-- Thay câu insert gói thuê trong create_product_full bằng hàm dùng chung.
create or replace function private.insert_rental_rates(p_product_id uuid, p_rates jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if jsonb_typeof(p_rates) <> 'array' then
    return;
  end if;
  insert into public.rental_rates (product_id, label, duration_minutes, price, usage, billing,
                                   grace_minutes, overtime_block_minutes, overtime_block_price, overtime_cap)
  select p_product_id, btrim(x.value ->> 'label'), (x.value ->> 'duration_minutes')::integer, (x.value ->> 'price')::integer,
         coalesce(x.value ->> 'usage', 'on_site')::public.rental_usage,
         coalesce(x.value ->> 'billing', 'duration')::public.rental_billing,
         (x.value ->> 'grace_minutes')::integer, (x.value ->> 'overtime_block_minutes')::integer,
         (x.value ->> 'overtime_block_price')::integer, (x.value ->> 'overtime_cap')::integer
    from jsonb_array_elements(p_rates) as x(value);
end;
$$;
grant execute on function private.insert_rental_rates(uuid, jsonb) to authenticated;

do $$
declare
  v_src text;
  -- So khớp mềm (khoảng trắng/xuống dòng CRLF bất kỳ) đoạn tạo gói thuê cũ trong create_product_full.
  v_pattern text := 'insert into public\.rental_rates \(product_id, label, duration_minutes, price\)\s+select v_id,.*?as x\(value\);';
begin
  select pg_get_functiondef('public.create_product_full(jsonb)'::regprocedure) into v_src;
  if position('private.insert_rental_rates' in v_src) > 0 then
    return;  -- đã thay
  end if;
  if v_src !~ v_pattern then
    raise exception 'Không tìm thấy đoạn tạo gói thuê trong create_product_full — hãy chạy 06_product_tax.sql trước.';
  end if;
  execute regexp_replace(v_src, v_pattern, 'perform private.insert_rental_rates(v_id, p -> ''rental_rates'');');
end $$;

-- 8. Quyền -------------------------------------------------------------------------------------------
revoke all on function public.checkout_rental(uuid, uuid, uuid, integer, text, text, uuid, boolean, public.payment_method, text, text, text, uuid, text) from public, anon;
revoke all on function public.return_rental(uuid, jsonb, integer, integer, text, text) from public, anon;
revoke all on function public.rental_overtime_preview(uuid, timestamptz) from public, anon;
grant execute on function public.checkout_rental(uuid, uuid, uuid, integer, text, text, uuid, boolean, public.payment_method, text, text, text, uuid, text) to authenticated;
grant execute on function public.return_rental(uuid, jsonb, integer, integer, text, text) to authenticated;
grant execute on function public.rental_overtime_preview(uuid, timestamptz) to authenticated;
grant execute on function private.rental_overtime(timestamptz, timestamptz, integer, integer, integer, integer, integer) to authenticated;
grant execute on function private.rental_effective_due(public.rentals) to authenticated;
grant execute on function private.rental_default_policy(public.rental_usage, public.rental_billing, integer) to authenticated;
grant execute on function private.rental_auto_block_price(integer, integer, integer) to authenticated;

commit;

-- Báo PostgREST (API Supabase) nạp lại cấu trúc để thấy cột/quan hệ mới ngay.
notify pgrst, 'reload schema';

-- Kiểm tra nhanh:
--   select usage, billing, label, price, grace_minutes, overtime_block_minutes, overtime_block_price from public.rental_rates;
--   select * from private.rental_overtime(now() - interval '60 minutes', now(), 1, 10, 30, 15000, null);  -- 2 block, 30.000đ
