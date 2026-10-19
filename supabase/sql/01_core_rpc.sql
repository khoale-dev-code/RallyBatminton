-- =============================================================================
-- RALLY BADMINTON — 01_core_rpc.sql
-- RPC nghiệp vụ (chạy SAU 00_init_schema.sql). File này chạy lại được nhiều lần
-- (create or replace) để cập nhật logic mà không đụng dữ liệu.
--
-- Nguyên tắc:
--   * SECURITY DEFINER + search_path = '' + tên đầy đủ schema.
--   * Kiểm tra quyền NGAY ĐẦU hàm bằng private.staff_can / private.is_owner.
--   * Mọi thao tác tiền/kho/booking là atomic, có khóa thứ tự cố định, idempotency key.
--   * Lỗi trả về dạng mã ổn định (message = 'SLOT_TAKEN', ...) để Next.js dịch sang tiếng Việt.
--   * EXECUTE chỉ cấp đúng vai trò cần (cuối file).
-- =============================================================================

begin;

-- =============================================================================
-- A. HÀM NỘI BỘ
-- =============================================================================

create or replace function private.raise_error(p_code text, p_detail text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = p_code, detail = coalesce(p_detail, '');
end;
$$;

create or replace function private.require_permission(p_branch_id uuid, p_permission public.app_permission)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    perform private.raise_error('AUTH_REQUIRED');
  end if;
  if not private.staff_can(p_branch_id, p_permission) then
    perform private.raise_error('PERMISSION_DENIED', p_permission::text);
  end if;
end;
$$;

create or replace function private.require_owner()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.is_owner() then
    perform private.raise_error('OWNER_REQUIRED');
  end if;
end;
$$;

create or replace function private.require_service_role()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if (select auth.role()) is distinct from 'service_role' then
    perform private.raise_error('SERVER_ONLY');
  end if;
end;
$$;

create or replace function private.set_audit_reason(p_reason text)
returns void
language sql
set search_path = ''
as $$
  select set_config('rally.audit_reason', left(btrim(coalesce(p_reason, '')), 300), true);
$$;

-- Chuẩn hóa SĐT di động VN về dạng 0xxxxxxxxx (chấp nhận +84 / 84 / dấu cách / chấm / gạch).
create or replace function private.normalize_vn_phone(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  with cleaned as (
    select regexp_replace(coalesce(p_phone, ''), '[\s.\-()]', '', 'g') as v
  ), local_form as (
    select case
      when v like '+84%' then '0' || substr(v, 4)
      when v ~ '^84[35789][0-9]{8}$' then '0' || substr(v, 3)
      else v end as v
    from cleaned
  )
  select case when v ~ '^0[35789][0-9]{8}$' then v else null end from local_form;
$$;

create or replace function private.upsert_customer(p_phone text, p_full_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := private.normalize_vn_phone(p_phone);
  v_name text := btrim(coalesce(p_full_name, ''));
  v_id uuid;
begin
  if v_phone is null then
    perform private.raise_error('INVALID_PHONE');
  end if;
  if char_length(v_name) not between 2 and 80 then
    perform private.raise_error('INVALID_NAME');
  end if;
  insert into public.customers as c (phone, full_name)
  values (v_phone, v_name)
  on conflict (phone) do update
    set full_name = case when char_length(btrim(c.full_name)) < 2 then excluded.full_name else c.full_name end
  returning c.id into v_id;
  return v_id;
end;
$$;

-- Báo giá theo từng ô thời gian, ưu tiên: giá riêng sân > giá mặc định; priority cao hơn thắng.
create or replace function private.quote_court_price(
  p_court_id uuid,
  p_during tstzrange,
  out branch_id uuid,
  out total_amount integer,
  out deposit_amount integer,
  out breakdown jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_court record;
  v_slot interval;
  v_local_start timestamp;
  v_local_end timestamp;
  v_missing integer;
  v_outside integer;
  v_total numeric;
begin
  select c.id, c.branch_id, c.status, c.deleted_at,
         b.timezone, b.slot_minutes, b.opens_at, b.closes_at, b.deposit_percent
    into v_court
    from public.courts c
    join public.branches b on b.id = c.branch_id
   where c.id = p_court_id;
  if not found then
    perform private.raise_error('COURT_NOT_FOUND');
  end if;

  if p_during is null or isempty(p_during) or lower_inf(p_during) or upper_inf(p_during) then
    perform private.raise_error('INVALID_RANGE');
  end if;

  v_slot := make_interval(mins => v_court.slot_minutes);
  v_local_start := lower(p_during) at time zone v_court.timezone;
  v_local_end := upper(p_during) at time zone v_court.timezone;
  if extract(second from v_local_start) <> 0 or extract(second from v_local_end) <> 0
     or extract(minute from v_local_start)::integer % v_court.slot_minutes <> 0
     or extract(minute from v_local_end)::integer % v_court.slot_minutes <> 0
     or (extract(epoch from (upper(p_during) - lower(p_during)))::bigint % (v_court.slot_minutes * 60)) <> 0 then
    perform private.raise_error('RANGE_NOT_ALIGNED', v_court.slot_minutes::text || ' phút');
  end if;

  with slots as (
    select s.slot_start,
           (s.slot_start at time zone v_court.timezone) as local_start
      from generate_series(lower(p_during), upper(p_during) - v_slot, v_slot) as s(slot_start)
  ), slot_bounds as (
    select sl.slot_start,
           sl.local_start,
           sl.local_start::time as t_start,
           case when (sl.local_start + v_slot)::time = time '00:00' then time '24:00'
                else (sl.local_start + v_slot)::time end as t_end,
           extract(isodow from sl.local_start)::integer as iso_dow
      from slots sl
  ), priced as (
    select sb.*, r.rule_id, r.price_per_hour
      from slot_bounds sb
      left join lateral (
        select pr.id as rule_id, pr.price_per_hour
          from public.price_rules pr
         where pr.branch_id = v_court.branch_id
           and (pr.court_id = p_court_id or pr.court_id is null)
           and pr.is_active and pr.deleted_at is null
           and (pr.days_mask::integer & (1 << (sb.iso_dow - 1))) <> 0
           and pr.starts_at <= sb.t_start and pr.ends_at >= sb.t_end
           and (pr.valid_from is null or pr.valid_from <= sb.local_start::date)
           and (pr.valid_until is null or pr.valid_until >= sb.local_start::date)
         order by (pr.court_id is not null) desc, pr.priority desc, pr.created_at, pr.id
         limit 1
      ) r on true
  )
  select count(*) filter (where p.t_start < v_court.opens_at or p.t_end > v_court.closes_at),
         count(*) filter (where p.rule_id is null),
         sum(p.price_per_hour * v_court.slot_minutes / 60.0),
         (select jsonb_agg(g.item order by g.first_slot)
            from (select min(p2.slot_start) as first_slot,
                         jsonb_build_object(
                           'rule_id', p2.rule_id,
                           'price_per_hour', p2.price_per_hour,
                           'minutes', count(*) * v_court.slot_minutes,
                           'amount', round(sum(p2.price_per_hour * v_court.slot_minutes / 60.0))) as item
                    from priced p2
                   group by p2.rule_id, p2.price_per_hour) g)
    into v_outside, v_missing, v_total, breakdown
    from priced p;

  if v_outside > 0 then
    perform private.raise_error('OUTSIDE_OPENING_HOURS');
  end if;
  if v_missing > 0 then
    perform private.raise_error('NO_PRICE_RULE');
  end if;

  branch_id := v_court.branch_id;
  total_amount := (round(v_total / 1000.0) * 1000)::integer;
  deposit_amount := least(total_amount,
                          (ceil(total_amount * v_court.deposit_percent / 100.0 / 1000.0) * 1000)::integer);
end;
$$;

-- Kiểm tra độ dài & cửa sổ đặt. p_staff = true: quầy được đặt sát giờ và xa hơn (180 ngày).
create or replace function private.validate_booking_range(p_court_id uuid, p_during tstzrange, p_staff boolean)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v record;
  v_minutes integer;
begin
  select b.slot_minutes, b.min_booking_minutes, b.max_booking_minutes, b.booking_window_days, b.status as branch_status,
         c.status as court_status, c.deleted_at
    into v
    from public.courts c join public.branches b on b.id = c.branch_id
   where c.id = p_court_id;
  if not found or v.deleted_at is not null or v.court_status <> 'active' then
    perform private.raise_error('COURT_UNAVAILABLE');
  end if;
  if not p_staff and v.branch_status <> 'published' then
    perform private.raise_error('BRANCH_UNAVAILABLE');
  end if;
  if p_during is null or isempty(p_during) or lower_inf(p_during) or upper_inf(p_during) then
    perform private.raise_error('INVALID_RANGE');
  end if;
  v_minutes := (extract(epoch from (upper(p_during) - lower(p_during))) / 60)::integer;
  if v_minutes < v.min_booking_minutes or v_minutes > v.max_booking_minutes then
    perform private.raise_error('INVALID_DURATION',
      v.min_booking_minutes::text || '-' || v.max_booking_minutes::text || ' phút');
  end if;
  if p_staff then
    if lower(p_during) < now() - make_interval(mins => v.slot_minutes)
       or lower(p_during) > now() + interval '180 days' then
      perform private.raise_error('OUTSIDE_BOOKING_WINDOW');
    end if;
  else
    if lower(p_during) <= now()
       or lower(p_during) > now() + make_interval(days => v.booking_window_days) then
      perform private.raise_error('OUTSIDE_BOOKING_WINDOW');
    end if;
  end if;
end;
$$;

create or replace function private.booking_net_paid(p_booking_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(case when p.kind = 'charge' then p.amount else -p.amount end), 0)::bigint
    from public.payments p
   where p.booking_id = p_booking_id and p.status = 'succeeded';
$$;

create or replace function private.booking_json(p_booking_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'booking_id', b.id,
    'code', b.code,
    'status', b.status,
    'branch_id', b.branch_id,
    'court_id', b.court_id,
    'starts_at', lower(b.during),
    'ends_at', upper(b.during),
    'total_amount', b.total_amount,
    'deposit_amount', b.deposit_amount,
    'paid_amount', private.booking_net_paid(b.id),
    'hold_expires_at', b.hold_expires_at,
    'refund_entitlement', b.refund_entitlement)
  from public.bookings b
  where b.id = p_booking_id;
$$;

-- Khóa & lấy booking; trả lỗi rõ ràng nếu không có.
create or replace function private.lock_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.bookings;
begin
  select * into v from public.bookings where id = p_booking_id and deleted_at is null for update;
  if not found then
    perform private.raise_error('BOOKING_NOT_FOUND');
  end if;
  return v;
end;
$$;

-- Hủy giữ chỗ đã hết hạn đang chồng lên khung giờ (để exclusion constraint không chặn oan).
create or replace function private.expire_overlapping_holds(p_court_id uuid, p_during tstzrange)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.set_audit_reason('system: hold expired');
  update public.bookings
     set status = 'expired'
   where court_id = p_court_id
     and status = 'held'
     and hold_expires_at <= now()
     and during && p_during;
  perform private.set_audit_reason(null);
end;
$$;

-- =============================================================================
-- B. RPC CÔNG KHAI (website khách)
-- =============================================================================

-- Danh sách chi nhánh + số sân + giá thấp nhất trong MỘT truy vấn (thay N+1 cũ).
create or replace function public.list_published_branches()
returns table (
  id uuid, slug text, name text, address_line text, district text, city text,
  opens_at time, closes_at time, cover_image_path text,
  active_court_count integer, min_price_per_hour integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select b.id, b.slug, b.name, b.address_line, b.district, b.city,
         b.opens_at, b.closes_at, b.cover_image_path,
         coalesce(c.cnt, 0)::integer,
         p.min_price
    from public.branches b
    left join lateral (
      select count(*) as cnt from public.courts c
       where c.branch_id = b.id and c.status = 'active' and c.deleted_at is null) c on true
    left join lateral (
      select min(r.price_per_hour) as min_price from public.price_rules r
       where r.branch_id = b.id and r.is_active and r.deleted_at is null
         and (r.valid_until is null or r.valid_until >= current_date)) p on true
   where b.status = 'published' and b.deleted_at is null
   order by b.name;
$$;

-- Các khoảng đã bận (không chứa thông tin khách). Tối đa 31 ngày mỗi lần gọi.
create or replace function public.get_branch_busy_slots(p_branch_id uuid, p_from timestamptz, p_to timestamptz)
returns table (court_id uuid, starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > interval '31 days' then
    perform private.raise_error('INVALID_RANGE');
  end if;
  if not exists (
    select 1 from public.branches b
     where b.id = p_branch_id and b.deleted_at is null
       and (b.status = 'published' or private.staff_can(b.id, 'booking.view'))) then
    perform private.raise_error('BRANCH_UNAVAILABLE');
  end if;
  return query
    select bk.court_id, lower(bk.during), upper(bk.during)
      from public.bookings bk
     where bk.branch_id = p_branch_id
       and bk.during && tstzrange(p_from, p_to, '[)')
       and bk.status in ('held', 'confirmed', 'checked_in')
       and (bk.status <> 'held' or bk.hold_expires_at > now())
     order by bk.court_id, lower(bk.during);
end;
$$;

create or replace function public.quote_booking(p_court_id uuid, p_starts_at timestamptz, p_ends_at timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q record;
  v_staff boolean;
  v_branch uuid;
begin
  select c.branch_id into v_branch from public.courts c where c.id = p_court_id;
  v_staff := v_branch is not null and private.staff_can(v_branch, 'booking.view');
  perform private.validate_booking_range(p_court_id, tstzrange(p_starts_at, p_ends_at, '[)'), v_staff);
  select * into v_q from private.quote_court_price(p_court_id, tstzrange(p_starts_at, p_ends_at, '[)'));
  return jsonb_build_object(
    'total_amount', v_q.total_amount,
    'deposit_amount', v_q.deposit_amount,
    'breakdown', v_q.breakdown);
end;
$$;

-- Giữ sân không cần đăng nhập. CHỈ gọi từ server Next.js (service_role) sau khi đã xác minh Turnstile.
create or replace function public.create_guest_booking_hold(
  p_court_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_contact_name text,
  p_phone text,
  p_customer_note text default null,
  p_idempotency_key text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_range tstzrange := tstzrange(p_starts_at, p_ends_at, '[)');
  v_phone text := private.normalize_vn_phone(p_phone);
  v_customer uuid;
  v_q record;
  v_hold_minutes integer;
  v_existing public.bookings;
  v_id uuid;
  v_constraint text;
begin
  perform private.require_service_role();
  if v_phone is null then
    perform private.raise_error('INVALID_PHONE');
  end if;

  if p_idempotency_key is not null then
    select * into v_existing from public.bookings where idempotency_key = p_idempotency_key;
    if found then
      if v_existing.court_id = p_court_id and v_existing.during = v_range then
        return private.booking_json(v_existing.id) || jsonb_build_object('replayed', true);
      end if;
      perform private.raise_error('IDEMPOTENCY_CONFLICT');
    end if;
  end if;

  perform private.validate_booking_range(p_court_id, v_range, false);

  -- Tuần tự hóa theo số điện thoại (kể cả khác chi nhánh) để giới hạn lạm dụng chính xác.
  perform pg_advisory_xact_lock(hashtext('rally.guest_phone'), hashtext(v_phone));
  v_customer := private.upsert_customer(v_phone, p_contact_name);

  if (select count(*) from public.bookings b
       where b.customer_id = v_customer and b.source = 'online'
         and b.created_at > now() - interval '1 hour') >= 4 then
    perform private.raise_error('RATE_LIMITED');
  end if;
  if (select count(*) from public.bookings b
       where b.customer_id = v_customer and b.status = 'held' and b.hold_expires_at > now()) >= 2 then
    perform private.raise_error('TOO_MANY_HOLDS');
  end if;

  perform private.expire_overlapping_holds(p_court_id, v_range);
  select * into v_q from private.quote_court_price(p_court_id, v_range);
  select b.hold_minutes into v_hold_minutes from public.branches b where b.id = v_q.branch_id;

  begin
    insert into public.bookings (
      branch_id, court_id, kind, source, status, during, customer_id, contact_name,
      hold_expires_at, subtotal_amount, deposit_amount, price_snapshot, customer_note, idempotency_key)
    values (
      v_q.branch_id, p_court_id, 'customer', 'online', 'held', v_range, v_customer, btrim(p_contact_name),
      now() + make_interval(mins => v_hold_minutes), v_q.total_amount, v_q.deposit_amount, v_q.breakdown,
      nullif(btrim(coalesce(p_customer_note, '')), ''), p_idempotency_key)
    returning id into v_id;
  exception
    when exclusion_violation then
      perform private.raise_error('SLOT_TAKEN');
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'bookings_idempotency_uidx' then
        perform private.raise_error('IDEMPOTENCY_CONFLICT');
      end if;
      perform private.raise_error('TRY_AGAIN');
  end;

  return private.booking_json(v_id);
end;
$$;

-- Khách tra cứu đơn: cần ĐÚNG cả mã đơn và số điện thoại (không lộ đơn người khác).
create or replace function public.lookup_guest_booking(p_code text, p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.require_service_role();
  select private.booking_json(b.id) || jsonb_build_object(
           'branch_name', br.name,
           'branch_address', br.address_line,
           'court_name', c.name,
           'contact_name', b.contact_name)
    into v_result
    from public.bookings b
    join public.customers cu on cu.id = b.customer_id
    join public.courts c on c.id = b.court_id
    join public.branches br on br.id = b.branch_id
   where b.code = upper(btrim(p_code))
     and cu.phone = private.normalize_vn_phone(p_phone)
     and b.deleted_at is null;
  if v_result is null then
    perform private.raise_error('BOOKING_NOT_FOUND');
  end if;
  return v_result;
end;
$$;

-- Tính số tiền được hoàn theo chính sách chi nhánh dựa trên số tiền THỰC ĐÃ THU.
create or replace function private.refund_entitlement(p_booking public.bookings, p_waive boolean)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_paid bigint := private.booking_net_paid(p_booking.id);
  v_hours numeric := extract(epoch from (lower(p_booking.during) - now())) / 3600.0;
  v_branch public.branches;
begin
  if v_paid <= 0 then
    return 0;
  end if;
  if p_waive then
    return v_paid::integer;
  end if;
  select * into v_branch from public.branches where id = p_booking.branch_id;
  if v_hours >= v_branch.free_cancel_hours then
    return v_paid::integer;
  elsif v_hours >= v_branch.partial_refund_hours then
    return (floor(v_paid * v_branch.partial_refund_percent / 100.0 / 1000.0) * 1000)::integer;
  end if;
  return 0;
end;
$$;

create or replace function public.cancel_guest_booking(p_code text, p_phone text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v public.bookings;
begin
  perform private.require_service_role();
  select b.id into v_id
    from public.bookings b join public.customers cu on cu.id = b.customer_id
   where b.code = upper(btrim(p_code)) and cu.phone = private.normalize_vn_phone(p_phone);
  if v_id is null then
    perform private.raise_error('BOOKING_NOT_FOUND');
  end if;
  v := private.lock_booking(v_id);
  if v.status not in ('held', 'confirmed') then
    perform private.raise_error('INVALID_STATUS', v.status::text);
  end if;
  if lower(v.during) <= now() then
    perform private.raise_error('CANCELLATION_CLOSED');
  end if;
  perform private.set_audit_reason('guest cancel');
  update public.bookings
     set status = 'cancelled',
         status_reason = coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'Khách tự hủy'),
         refund_entitlement = private.refund_entitlement(v, false)
   where id = v.id;
  return private.booking_json(v.id);
end;
$$;

-- =============================================================================
-- C. RPC ĐIỀU HÀNH BOOKING (Owner / Staff theo quyền)
-- =============================================================================

create or replace function public.confirm_booking(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.bookings;
begin
  v := private.lock_booking(p_booking_id);
  perform private.require_permission(v.branch_id, 'booking.confirm');
  if v.status = 'confirmed' then
    return private.booking_json(v.id) || jsonb_build_object('already_confirmed', true);
  end if;
  if v.status <> 'held' then
    perform private.raise_error('NOT_HELD', v.status::text);
  end if;
  if v.hold_expires_at <= clock_timestamp() then
    perform private.raise_error('HOLD_EXPIRED');
  end if;
  update public.bookings set status = 'confirmed' where id = v.id;
  return private.booking_json(v.id);
end;
$$;

create or replace function public.create_counter_booking(
  p_court_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_phone text,
  p_contact_name text,
  p_internal_note text default null,
  p_discount_amount integer default 0,
  p_hold_only boolean default false,
  p_idempotency_key text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_range tstzrange := tstzrange(p_starts_at, p_ends_at, '[)');
  v_branch uuid;
  v_customer uuid;
  v_q record;
  v_hold_minutes integer;
  v_existing public.bookings;
  v_id uuid;
begin
  select c.branch_id into v_branch from public.courts c where c.id = p_court_id;
  if v_branch is null then
    perform private.raise_error('COURT_NOT_FOUND');
  end if;
  perform private.require_permission(v_branch, 'booking.operate');
  if coalesce(p_discount_amount, 0) <> 0 and not private.is_owner() then
    perform private.raise_error('DISCOUNT_OWNER_ONLY');
  end if;

  if p_idempotency_key is not null then
    select * into v_existing from public.bookings where idempotency_key = p_idempotency_key;
    if found then
      if v_existing.court_id = p_court_id and v_existing.during = v_range then
        return private.booking_json(v_existing.id) || jsonb_build_object('replayed', true);
      end if;
      perform private.raise_error('IDEMPOTENCY_CONFLICT');
    end if;
  end if;

  perform private.validate_booking_range(p_court_id, v_range, true);
  v_customer := private.upsert_customer(p_phone, p_contact_name);
  perform private.expire_overlapping_holds(p_court_id, v_range);
  select * into v_q from private.quote_court_price(p_court_id, v_range);
  if coalesce(p_discount_amount, 0) < 0 or coalesce(p_discount_amount, 0) > v_q.total_amount then
    perform private.raise_error('INVALID_DISCOUNT');
  end if;
  select b.hold_minutes into v_hold_minutes from public.branches b where b.id = v_branch;

  begin
    insert into public.bookings (
      branch_id, court_id, kind, source, status, during, customer_id, contact_name, hold_expires_at,
      subtotal_amount, discount_amount, deposit_amount, price_snapshot, internal_note, idempotency_key, created_by)
    values (
      v_branch, p_court_id, 'customer', 'counter',
      case when p_hold_only then 'held'::public.booking_status else 'confirmed'::public.booking_status end,
      v_range, v_customer, btrim(p_contact_name),
      case when p_hold_only then now() + make_interval(mins => v_hold_minutes) end,
      v_q.total_amount, coalesce(p_discount_amount, 0),
      least(v_q.deposit_amount, v_q.total_amount - coalesce(p_discount_amount, 0)),
      v_q.breakdown, nullif(btrim(coalesce(p_internal_note, '')), ''), p_idempotency_key, (select auth.uid()))
    returning id into v_id;
  exception
    when exclusion_violation then
      perform private.raise_error('SLOT_TAKEN');
    when unique_violation then
      perform private.raise_error('IDEMPOTENCY_CONFLICT');
  end;
  return private.booking_json(v_id);
end;
$$;

create or replace function public.reschedule_booking(
  p_booking_id uuid,
  p_court_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.bookings;
  v_range tstzrange := tstzrange(p_starts_at, p_ends_at, '[)');
  v_new_branch uuid;
  v_q record;
begin
  v := private.lock_booking(p_booking_id);
  perform private.require_permission(v.branch_id, 'booking.operate');
  if v.kind <> 'customer' then
    perform private.raise_error('NOT_A_CUSTOMER_BOOKING');
  end if;
  if v.status not in ('held', 'confirmed') then
    perform private.raise_error('BOOKING_NOT_EDITABLE', v.status::text);
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    perform private.raise_error('REASON_REQUIRED');
  end if;
  select c.branch_id into v_new_branch from public.courts c where c.id = p_court_id;
  if v_new_branch is distinct from v.branch_id then
    perform private.raise_error('CROSS_BRANCH_MOVE_FORBIDDEN');
  end if;
  perform private.validate_booking_range(p_court_id, v_range, true);
  perform private.expire_overlapping_holds(p_court_id, v_range);
  select * into v_q from private.quote_court_price(p_court_id, v_range);

  perform private.set_audit_reason('reschedule: ' || p_reason);
  begin
    update public.bookings
       set court_id = p_court_id,
           during = v_range,
           subtotal_amount = v_q.total_amount,
           discount_amount = least(v.discount_amount, v_q.total_amount),
           deposit_amount = least(v_q.deposit_amount, v_q.total_amount - least(v.discount_amount, v_q.total_amount)),
           price_snapshot = v_q.breakdown
     where id = v.id;
  exception
    when exclusion_violation then
      perform private.raise_error('SLOT_TAKEN');
  end;
  return private.booking_json(v.id);
end;
$$;

create or replace function public.cancel_booking(p_booking_id uuid, p_reason text, p_waive_policy boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.bookings;
  v_is_owner boolean;
begin
  v := private.lock_booking(p_booking_id);
  perform private.require_permission(v.branch_id, 'booking.operate');
  v_is_owner := private.is_owner();
  if p_waive_policy and not v_is_owner then
    perform private.raise_error('WAIVE_OWNER_ONLY');
  end if;
  if v.status not in ('held', 'confirmed') then
    perform private.raise_error('INVALID_STATUS', v.status::text);
  end if;
  if lower(v.during) <= now() and not v_is_owner then
    perform private.raise_error('CANCELLATION_CLOSED');
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    perform private.raise_error('REASON_REQUIRED');
  end if;
  perform private.set_audit_reason('cancel: ' || p_reason);
  update public.bookings
     set status = 'cancelled',
         status_reason = btrim(p_reason),
         refund_entitlement = case when v.kind = 'block' then null
                                   else private.refund_entitlement(v, p_waive_policy) end
   where id = v.id;
  return private.booking_json(v.id);
end;
$$;

create or replace function public.check_in_booking(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.bookings;
begin
  v := private.lock_booking(p_booking_id);
  perform private.require_permission(v.branch_id, 'booking.operate');
  if v.status = 'checked_in' then
    return private.booking_json(v.id);
  end if;
  if v.status <> 'confirmed' or v.kind <> 'customer' then
    perform private.raise_error('INVALID_STATUS', v.status::text);
  end if;
  if now() < lower(v.during) - interval '30 minutes' or now() >= upper(v.during) then
    perform private.raise_error('CHECKIN_WINDOW_CLOSED');
  end if;
  update public.bookings set status = 'checked_in' where id = v.id;
  return private.booking_json(v.id);
end;
$$;

create or replace function public.mark_booking_no_show(p_booking_id uuid, p_reason text default 'Khách không đến')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.bookings;
begin
  v := private.lock_booking(p_booking_id);
  perform private.require_permission(v.branch_id, 'booking.operate');
  if v.status <> 'confirmed' or v.kind <> 'customer' then
    perform private.raise_error('INVALID_STATUS', v.status::text);
  end if;
  if now() < lower(v.during) then
    perform private.raise_error('NOT_STARTED_YET');
  end if;
  perform private.set_audit_reason('no_show');
  update public.bookings
     set status = 'no_show', status_reason = coalesce(nullif(btrim(p_reason), ''), 'Khách không đến')
   where id = v.id;
  return private.booking_json(v.id);
end;
$$;

-- Khóa sân (bảo trì, sự kiện). Dùng chung khóa chống trùng với booking.
create or replace function public.create_court_block(
  p_court_id uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch uuid;
  v_range tstzrange := tstzrange(p_starts_at, p_ends_at, '[)');
  v_id uuid;
begin
  select c.branch_id into v_branch from public.courts c where c.id = p_court_id and c.deleted_at is null;
  if v_branch is null then
    perform private.raise_error('COURT_NOT_FOUND');
  end if;
  perform private.require_permission(v_branch, 'booking.operate');
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    perform private.raise_error('REASON_REQUIRED');
  end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at
     or p_ends_at - p_starts_at > interval '31 days' then
    perform private.raise_error('INVALID_RANGE');
  end if;
  perform private.expire_overlapping_holds(p_court_id, v_range);
  begin
    insert into public.bookings (branch_id, court_id, kind, source, status, during, internal_note, created_by)
    values (v_branch, p_court_id, 'block', 'system', 'confirmed', v_range, btrim(p_reason), (select auth.uid()))
    returning id into v_id;
  exception
    when exclusion_violation then
      perform private.raise_error('SLOT_TAKEN', 'Khung giờ đã có booking, hãy dời hoặc hủy trước.');
  end;
  return private.booking_json(v_id);
end;
$$;

-- =============================================================================
-- D. TIỀN: ghi nhận thu, hoàn, hủy giao dịch
-- =============================================================================

create or replace function private.insert_payment(
  p_booking_id uuid, p_sale_id uuid, p_rental_id uuid,
  p_kind public.payment_kind, p_method public.payment_method, p_amount bigint,
  p_reference text, p_note text, p_idempotency_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.payments;
  v_id uuid;
  v_constraint text;
  v_ref text := nullif(left(btrim(coalesce(p_reference, '')), 100), '');
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    perform private.raise_error('IDEMPOTENCY_KEY_REQUIRED');
  end if;
  select * into v_existing from public.payments where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.booking_id is not distinct from p_booking_id
       and v_existing.sale_id is not distinct from p_sale_id
       and v_existing.rental_id is not distinct from p_rental_id
       and v_existing.amount = p_amount and v_existing.kind = p_kind then
      return v_existing.id;   -- gửi lại cùng yêu cầu => trả kết quả cũ
    end if;
    perform private.raise_error('IDEMPOTENCY_CONFLICT');
  end if;
  if p_method = 'gateway' then
    perform private.raise_error('GATEWAY_VIA_WEBHOOK_ONLY');
  end if;
  begin
    insert into public.payments (booking_id, sale_id, rental_id, kind, method, status, amount,
                                 reference, note, idempotency_key, recorded_by)
    values (p_booking_id, p_sale_id, p_rental_id, p_kind, p_method, 'succeeded', p_amount,
            v_ref, nullif(btrim(coalesce(p_note, '')), ''), p_idempotency_key, (select auth.uid()))
    returning id into v_id;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'payments_manual_reference_uidx' then
        perform private.raise_error('DUPLICATE_REFERENCE');
      end if;
      perform private.raise_error('IDEMPOTENCY_CONFLICT');
    when check_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'payments_reference_required' then
        perform private.raise_error('REFERENCE_REQUIRED');
      end if;
      perform private.raise_error('INVALID_PAYMENT', v_constraint);
  end;
  return v_id;
end;
$$;

create or replace function public.record_booking_payment(
  p_booking_id uuid,
  p_amount bigint,
  p_method public.payment_method,
  p_reference text default null,
  p_note text default null,
  p_idempotency_key text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.bookings;
  v_existing uuid;
  v_payment uuid;
begin
  v := private.lock_booking(p_booking_id);
  perform private.require_permission(v.branch_id, 'payment.record');
  -- Gửi lại cùng idempotency key => trả kết quả cũ trước khi kiểm tra số dư.
  select id into v_existing from public.payments where idempotency_key = p_idempotency_key;
  if v_existing is null then
    if v.kind <> 'customer' or v.status not in ('held', 'confirmed', 'checked_in', 'completed') then
      perform private.raise_error('INVALID_STATUS', v.status::text);
    end if;
    if v.status = 'held' and v.hold_expires_at <= now() then
      perform private.raise_error('HOLD_EXPIRED');
    end if;
    if p_amount is null or p_amount <= 0 then
      perform private.raise_error('INVALID_AMOUNT');
    end if;
    if private.booking_net_paid(v.id) + p_amount > v.total_amount then
      perform private.raise_error('AMOUNT_EXCEEDS_BALANCE');
    end if;
  end if;
  v_payment := private.insert_payment(v.id, null, null, 'charge', p_method, p_amount, p_reference, p_note, p_idempotency_key);
  return private.booking_json(v.id) || jsonb_build_object('payment_id', v_payment);
end;
$$;

create or replace function public.record_booking_refund(
  p_booking_id uuid,
  p_amount bigint,
  p_method public.payment_method,
  p_reason text,
  p_reference text default null,
  p_idempotency_key text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.bookings;
  v_payment uuid;
begin
  perform private.require_owner();
  v := private.lock_booking(p_booking_id);
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    perform private.raise_error('REASON_REQUIRED');
  end if;
  if not exists (select 1 from public.payments where idempotency_key = p_idempotency_key) then
    if p_amount is null or p_amount <= 0 or p_amount > private.booking_net_paid(v.id) then
      perform private.raise_error('REFUND_EXCEEDS_PAID');
    end if;
  end if;
  v_payment := private.insert_payment(v.id, null, null, 'refund', p_method, p_amount, p_reference, p_reason, p_idempotency_key);
  return private.booking_json(v.id) || jsonb_build_object('payment_id', v_payment);
end;
$$;

create or replace function public.void_payment(p_payment_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.payments;
begin
  perform private.require_owner();
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    perform private.raise_error('REASON_REQUIRED');
  end if;
  select * into v from public.payments where id = p_payment_id for update;
  if not found then
    perform private.raise_error('PAYMENT_NOT_FOUND');
  end if;
  if v.status = 'voided' then
    return jsonb_build_object('payment_id', v.id, 'status', v.status);
  end if;
  perform private.set_audit_reason('void payment: ' || p_reason);
  update public.payments
     set status = 'voided', voided_at = now(), voided_by = (select auth.uid()), void_reason = btrim(p_reason)
   where id = v.id;
  return jsonb_build_object('payment_id', v.id, 'status', 'voided');
end;
$$;

-- =============================================================================
-- E. KHO & BÁN HÀNG
-- =============================================================================

create or replace function public.adjust_stock(
  p_branch_id uuid,
  p_variant_id uuid,
  p_quantity_delta integer,
  p_reason public.stock_reason,
  p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance integer;
begin
  perform private.require_permission(p_branch_id, 'inventory.adjust');
  if p_reason not in ('opening', 'purchase', 'adjustment', 'damage', 'loss') then
    perform private.raise_error('INVALID_STOCK_REASON');
  end if;
  if p_quantity_delta is null or p_quantity_delta = 0 then
    perform private.raise_error('INVALID_QUANTITY');
  end if;
  if p_reason in ('opening', 'purchase') and p_quantity_delta < 0
     or p_reason in ('damage', 'loss') and p_quantity_delta > 0 then
    perform private.raise_error('INVALID_QUANTITY_SIGN');
  end if;
  if not exists (select 1 from public.product_variants v join public.products p on p.id = v.product_id
                 where v.id = p_variant_id and v.deleted_at is null and not p.is_bundle) then
    perform private.raise_error('VARIANT_NOT_FOUND');
  end if;
  insert into public.inventory_levels (branch_id, variant_id)
  values (p_branch_id, p_variant_id)
  on conflict (branch_id, variant_id) do nothing;

  insert into public.stock_movements (branch_id, variant_id, quantity_delta, reason, note)
  values (p_branch_id, p_variant_id, p_quantity_delta, p_reason, nullif(btrim(coalesce(p_note, '')), ''))
  returning balance_after into v_balance;
  return jsonb_build_object('branch_id', p_branch_id, 'variant_id', p_variant_id, 'on_hand', v_balance);
end;
$$;

create or replace function public.record_stock_count(
  p_branch_id uuid, p_variant_id uuid, p_counted_quantity integer, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_on_hand integer;
  v_delta integer;
begin
  perform private.require_permission(p_branch_id, 'inventory.adjust');
  if p_counted_quantity is null or p_counted_quantity < 0 then
    perform private.raise_error('INVALID_QUANTITY');
  end if;
  select on_hand into v_on_hand from public.inventory_levels
   where branch_id = p_branch_id and variant_id = p_variant_id for update;
  if not found then
    perform private.raise_error('VARIANT_NOT_STOCKED_AT_BRANCH');
  end if;
  v_delta := p_counted_quantity - v_on_hand;
  if v_delta <> 0 then
    insert into public.stock_movements (branch_id, variant_id, quantity_delta, reason, note)
    values (p_branch_id, p_variant_id, v_delta, 'count_correction', coalesce(nullif(btrim(p_note), ''), 'Kiểm kê'));
  end if;
  return jsonb_build_object('on_hand', p_counted_quantity, 'delta', v_delta);
end;
$$;

-- p_lines: [{"variant_id": "...", "quantity": 2}, ...]  — giá luôn lấy từ database.
create or replace function public.record_sale(
  p_branch_id uuid,
  p_lines jsonb,
  p_payment_method public.payment_method,
  p_payment_reference text default null,
  p_discount_amount bigint default 0,
  p_customer_phone text default null,
  p_customer_name text default null,
  p_note text default null,
  p_idempotency_key text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.sales;
  v_sale uuid;
  v_customer uuid;
  v_subtotal bigint := 0;
  v_line record;
  v_line_id uuid;
  v_total bigint;
begin
  perform private.require_permission(p_branch_id, 'sale.record');
  if coalesce(p_discount_amount, 0) <> 0 and not private.is_owner() then
    perform private.raise_error('DISCOUNT_OWNER_ONLY');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    perform private.raise_error('IDEMPOTENCY_KEY_REQUIRED');
  end if;
  select * into v_existing from public.sales where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.branch_id <> p_branch_id then
      perform private.raise_error('IDEMPOTENCY_CONFLICT');
    end if;
    return jsonb_build_object('sale_id', v_existing.id, 'code', v_existing.code,
                              'total_amount', v_existing.total_amount, 'replayed', true);
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) not between 1 and 30 then
    perform private.raise_error('INVALID_LINES');
  end if;

  if p_customer_phone is not null and btrim(p_customer_phone) <> '' then
    v_customer := private.upsert_customer(p_customer_phone, coalesce(p_customer_name, 'Khách lẻ'));
  end if;

  insert into public.sales (branch_id, customer_id, subtotal_amount, discount_amount, note, idempotency_key, sold_by)
  values (p_branch_id, v_customer, 0, 0, nullif(btrim(coalesce(p_note, '')), ''), p_idempotency_key, (select auth.uid()))
  returning id into v_sale;

  -- Gộp dòng trùng biến thể, xử lý theo thứ tự variant_id để khóa nhất quán (tránh deadlock).
  for v_line in
    select l.variant_id, sum(l.quantity)::integer as quantity
      from jsonb_to_recordset(p_lines) as l(variant_id uuid, quantity integer)
     group by l.variant_id
     order by l.variant_id
  loop
    declare
      v_name text;
      v_label text;
      v_price integer;
    begin
      if v_line.variant_id is null or v_line.quantity is null or v_line.quantity not between 1 and 1000 then
        perform private.raise_error('INVALID_LINES');
      end if;
      select p.name,
             nullif(concat_ws(' / ', v.size_label, v.color_label), ''),
             coalesce(v.price_override, p.base_price)
        into v_name, v_label, v_price
        from public.product_variants v
        join public.products p on p.id = v.product_id
       where v.id = v_line.variant_id
         and v.is_active and v.deleted_at is null
         and p.kind = 'sale' and p.is_active and p.deleted_at is null;
      if not found or v_price is null then
        perform private.raise_error('PRODUCT_UNAVAILABLE', v_line.variant_id::text);
      end if;
      insert into public.sale_lines (sale_id, variant_id, product_name, variant_label, quantity, unit_price)
      values (v_sale, v_line.variant_id, v_name, v_label, v_line.quantity, v_price)
      returning id into v_line_id;
      insert into public.stock_movements (branch_id, variant_id, quantity_delta, reason, sale_line_id)
      values (p_branch_id, v_line.variant_id, -v_line.quantity, 'sale', v_line_id);
      v_subtotal := v_subtotal + v_line.quantity::bigint * v_price;
    end;
  end loop;

  if coalesce(p_discount_amount, 0) < 0 or coalesce(p_discount_amount, 0) > v_subtotal then
    perform private.raise_error('INVALID_DISCOUNT');
  end if;
  update public.sales
     set subtotal_amount = v_subtotal, discount_amount = coalesce(p_discount_amount, 0)
   where id = v_sale
  returning total_amount into v_total;

  if v_total > 0 then
    perform private.insert_payment(null, v_sale, null, 'charge', p_payment_method, v_total,
                                   p_payment_reference, null, 'sale:' || p_idempotency_key);
  end if;

  return jsonb_build_object('sale_id', v_sale,
                            'code', (select code from public.sales where id = v_sale),
                            'total_amount', v_total);
end;
$$;

create or replace function public.void_sale(p_sale_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.sales;
  v_line record;
begin
  perform private.require_owner();
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    perform private.raise_error('REASON_REQUIRED');
  end if;
  select * into v from public.sales where id = p_sale_id for update;
  if not found then
    perform private.raise_error('SALE_NOT_FOUND');
  end if;
  if v.status = 'voided' then
    return jsonb_build_object('sale_id', v.id, 'status', v.status);
  end if;
  perform private.set_audit_reason('void sale: ' || p_reason);
  for v_line in select * from public.sale_lines where sale_id = v.id order by variant_id loop
    insert into public.stock_movements (branch_id, variant_id, quantity_delta, reason, sale_line_id, note)
    values (v.branch_id, v_line.variant_id, v_line.quantity, 'sale_void', v_line.id, left(p_reason, 300));
  end loop;
  update public.payments
     set status = 'voided', voided_at = now(), voided_by = (select auth.uid()), void_reason = btrim(p_reason)
   where sale_id = v.id and status in ('pending', 'succeeded');
  update public.sales
     set status = 'voided', voided_at = now(), voided_by = (select auth.uid()), void_reason = btrim(p_reason)
   where id = v.id;
  return jsonb_build_object('sale_id', v.id, 'status', 'voided');
end;
$$;

-- =============================================================================
-- F. CHO THUÊ THIẾT BỊ
-- =============================================================================

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
  p_idempotency_key text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products;
  v_rate public.rental_rates;
  v_existing public.rentals;
  v_variant uuid;
  v_customer uuid;
  v_rental uuid;
  v_line record;
  v_line_id uuid;
  v_fee bigint;
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

  v_customer := private.upsert_customer(p_customer_phone, p_customer_name);
  insert into public.rentals (branch_id, customer_id, product_id, rate_label, duration_minutes, unit_price,
                             quantity, due_at, note, idempotency_key, created_by)
  values (p_branch_id, v_customer, p_product_id, v_rate.label, v_rate.duration_minutes, v_rate.price,
          p_quantity, now() + make_interval(mins => v_rate.duration_minutes),
          nullif(btrim(coalesce(p_note, '')), ''), p_idempotency_key, (select auth.uid()))
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
                            'due_at', (select due_at from public.rentals where id = v_rental));
end;
$$;

-- p_lines (tùy chọn): [{"variant_id": "...", "returned": 1, "damaged": 0, "lost": 0}]; bỏ trống = trả đủ.
create or replace function public.return_rental(
  p_rental_id uuid,
  p_lines jsonb default null,
  p_late_fee integer default 0,
  p_damage_fee integer default 0,
  p_note text default null)
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
         late_fee = coalesce(p_late_fee, 0), damage_fee = coalesce(p_damage_fee, 0),
         note = coalesce(nullif(btrim(coalesce(p_note, '')), ''), note)
   where id = v.id;

  return jsonb_build_object('rental_id', v.id, 'status', 'returned',
                            'extra_fees', coalesce(p_late_fee, 0) + coalesce(p_damage_fee, 0));
end;
$$;

create or replace function public.record_rental_payment(
  p_rental_id uuid,
  p_amount bigint,
  p_method public.payment_method,
  p_reference text default null,
  p_note text default null,
  p_idempotency_key text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.rentals;
  v_paid bigint;
  v_payment uuid;
begin
  select * into v from public.rentals where id = p_rental_id for update;
  if not found then
    perform private.raise_error('RENTAL_NOT_FOUND');
  end if;
  perform private.require_permission(v.branch_id, 'rental.operate');
  if not exists (select 1 from public.payments where idempotency_key = p_idempotency_key) then
    select coalesce(sum(case when kind = 'charge' then amount else -amount end), 0) into v_paid
      from public.payments where rental_id = v.id and status = 'succeeded';
    if p_amount is null or p_amount <= 0
       or v_paid + p_amount > v.rental_fee + v.late_fee + v.damage_fee then
      perform private.raise_error('AMOUNT_EXCEEDS_BALANCE');
    end if;
  end if;
  v_payment := private.insert_payment(null, null, v.id, 'charge', p_method, p_amount, p_reference, p_note, p_idempotency_key);
  return jsonb_build_object('rental_id', v.id, 'payment_id', v_payment);
end;
$$;

-- =============================================================================
-- G. CHẤM CÔNG QR & BẢNG LƯƠNG
-- =============================================================================

-- Server sinh token ngẫu nhiên (24 byte hex), hiển thị QR, chỉ gửi SHA-256 vào đây.
create or replace function public.issue_attendance_qr(p_branch_id uuid, p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expires timestamptz;
begin
  perform private.require_owner();
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    perform private.raise_error('INVALID_QR_HASH');
  end if;
  if not exists (select 1 from public.branches where id = p_branch_id and deleted_at is null) then
    perform private.raise_error('BRANCH_NOT_FOUND');
  end if;
  perform pg_advisory_xact_lock(hashtext('rally.qr'), hashtext(p_branch_id::text));
  delete from public.attendance_qr_tokens where branch_id = p_branch_id or expires_at < clock_timestamp();
  v_expires := clock_timestamp() + interval '90 seconds';
  insert into public.attendance_qr_tokens (token_hash, branch_id, expires_at, created_by)
  values (p_token_hash, p_branch_id, v_expires, (select auth.uid()));
  return jsonb_build_object('expires_at', v_expires);
end;
$$;

create or replace function public.scan_attendance_qr(p_token text, p_event text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_employee uuid;
  v_branch uuid;
  v_shift public.shifts;
begin
  if (select auth.uid()) is null then
    perform private.raise_error('AUTH_REQUIRED');
  end if;
  if p_event not in ('checkin', 'checkout') or p_token is null or p_token !~ '^[0-9a-f]{48}$' then
    perform private.raise_error('INVALID_QR_REQUEST');
  end if;
  select sa.employee_id into v_employee
    from public.staff_accounts sa
    join public.employees e on e.id = sa.employee_id and e.status = 'active'
   where sa.user_id = (select auth.uid()) and sa.is_active and not sa.must_change_password;
  if v_employee is null then
    perform private.raise_error('STAFF_NOT_ALLOWED');
  end if;

  select q.branch_id into v_branch
    from public.attendance_qr_tokens q
   where q.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
     and q.expires_at > v_now;
  if v_branch is null then
    perform private.raise_error('QR_EXPIRED_OR_INVALID');
  end if;

  perform pg_advisory_xact_lock(hashtext('rally.qr_scan'), hashtext(v_employee::text));

  if p_event = 'checkin' then
    if exists (select 1 from public.shifts s
                where s.employee_id = v_employee and s.checked_in_at is not null
                  and s.checked_out_at is null and s.deleted_at is null) then
      perform private.raise_error('ALREADY_CHECKED_IN');
    end if;
    select * into v_shift from public.shifts s
     where s.employee_id = v_employee and s.branch_id = v_branch
       and s.status = 'scheduled' and s.checked_in_at is null and s.deleted_at is null
       and v_now >= s.scheduled_start - interval '60 minutes'
       and v_now < s.scheduled_end
     order by s.scheduled_start
     limit 1
     for update;
    if not found then
      perform private.raise_error('NO_ELIGIBLE_SHIFT');
    end if;
    perform private.set_audit_reason('qr_checkin');
    update public.shifts set checked_in_at = v_now where id = v_shift.id;
    return jsonb_build_object('event', 'checkin', 'shift_id', v_shift.id, 'at', v_now);
  end if;

  select * into v_shift from public.shifts s
   where s.employee_id = v_employee and s.branch_id = v_branch
     and s.checked_in_at is not null and s.checked_out_at is null and s.deleted_at is null
   for update;
  if not found then
    perform private.raise_error('NO_OPEN_CHECKIN');
  end if;
  if v_now < v_shift.checked_in_at + interval '1 minute' then
    perform private.raise_error('CHECKOUT_TOO_SOON');
  end if;
  if v_now > v_shift.scheduled_end + interval '4 hours' then
    perform private.raise_error('CHECKOUT_TOO_LATE', 'Liên hệ chủ sân để điều chỉnh công.');
  end if;
  perform private.set_audit_reason('qr_checkout');
  update public.shifts
     set checked_out_at = v_now, status = 'present', actual_break_minutes = v_shift.break_minutes
   where id = v_shift.id;
  return jsonb_build_object('event', 'checkout', 'shift_id', v_shift.id, 'at', v_now,
                            'paid_minutes', (select paid_minutes from public.shifts where id = v_shift.id));
end;
$$;

-- ĐƯỜNG DUY NHẤT để owner sửa công: bắt buộc lý do, ghi audit trước/sau.
create or replace function public.owner_adjust_attendance(
  p_shift_id uuid,
  p_status public.attendance_status,
  p_reason text,
  p_checked_in_at timestamptz default null,
  p_checked_out_at timestamptz default null,
  p_actual_break_minutes integer default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.shifts;
begin
  perform private.require_owner();
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    perform private.raise_error('REASON_REQUIRED', 'Tối thiểu 5 ký tự');
  end if;
  select * into v from public.shifts where id = p_shift_id and deleted_at is null for update;
  if not found then
    perform private.raise_error('SHIFT_NOT_FOUND');
  end if;
  perform private.set_audit_reason('owner_adjust: ' || p_reason);
  if p_status = 'present' then
    update public.shifts
       set status = 'present',
           checked_in_at = coalesce(p_checked_in_at, v.checked_in_at, v.scheduled_start),
           checked_out_at = coalesce(p_checked_out_at, v.checked_out_at, v.scheduled_end),
           actual_break_minutes = coalesce(p_actual_break_minutes, v.break_minutes)
     where id = v.id;
  else
    update public.shifts
       set status = p_status, checked_in_at = null, checked_out_at = null, actual_break_minutes = 0
     where id = v.id;
  end if;
  return (select jsonb_build_object('shift_id', s.id, 'status', s.status, 'paid_minutes', s.paid_minutes)
            from public.shifts s where s.id = v.id);
end;
$$;

create or replace function public.close_payroll_month(p_month date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period uuid;
  v_unresolved integer;
  v_missing_rate integer;
  v_negative integer;
  v_next date;
begin
  perform private.require_owner();
  if p_month is null or p_month <> date_trunc('month', p_month)::date then
    perform private.raise_error('INVALID_MONTH');
  end if;
  if p_month >= date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh')::date then
    perform private.raise_error('MONTH_NOT_COMPLETED');
  end if;
  v_next := (p_month + interval '1 month')::date;
  perform pg_advisory_xact_lock(hashtext('rally.payroll_close'), hashtext(p_month::text));
  if exists (select 1 from public.payroll_periods where month = p_month) then
    perform private.raise_error('MONTH_ALREADY_CLOSED');
  end if;

  -- Khóa toàn bộ ca & điều chỉnh của tháng để không ai sửa trong lúc chốt.
  perform 1 from public.shifts s where s.work_date >= p_month and s.work_date < v_next for update;
  perform 1 from public.payroll_adjustments a where a.month = p_month for update;

  select count(*) into v_unresolved from public.shifts s
   where s.work_date >= p_month and s.work_date < v_next and s.deleted_at is null and s.status = 'scheduled';
  if v_unresolved > 0 then
    perform private.raise_error('UNRESOLVED_SHIFTS', v_unresolved::text);
  end if;

  create temporary table if not exists pg_temp.rally_payroll_calc (
    employee_id uuid primary key, shifts_count integer, paid_minutes integer, base_pay bigint, missing_rate integer
  ) on commit drop;
  truncate pg_temp.rally_payroll_calc;

  insert into pg_temp.rally_payroll_calc (employee_id, shifts_count, paid_minutes, base_pay, missing_rate)
  select s.employee_id,
         count(*) filter (where s.status = 'present')::integer,
         coalesce(sum(s.paid_minutes), 0)::integer,
         coalesce(sum(case
           when s.status <> 'present' then 0
           when r.pay_type = 'hourly' then round(r.hourly_rate::numeric * s.paid_minutes / 60)
           else round(r.daily_rate::numeric * s.paid_minutes / r.standard_day_minutes) end), 0)::bigint,
         count(*) filter (where s.status = 'present' and r.id is null)::integer
    from public.shifts s
    left join lateral (
      select pr.* from public.employee_pay_rates pr
       where pr.employee_id = s.employee_id and pr.effective_from <= s.work_date
       order by pr.effective_from desc limit 1) r on true
   where s.work_date >= p_month and s.work_date < v_next and s.deleted_at is null
   group by s.employee_id;

  select coalesce(sum(missing_rate), 0) into v_missing_rate from pg_temp.rally_payroll_calc;
  if v_missing_rate > 0 then
    perform private.raise_error('MISSING_PAY_RATE', v_missing_rate::text || ' ca');
  end if;

  -- Nhân viên chỉ có điều chỉnh (không có ca) vẫn có dòng lương.
  insert into pg_temp.rally_payroll_calc (employee_id, shifts_count, paid_minutes, base_pay, missing_rate)
  select distinct a.employee_id, 0, 0, 0, 0 from public.payroll_adjustments a
   where a.month = p_month and a.voided_at is null
  on conflict (employee_id) do nothing;

  select count(*) into v_negative
    from pg_temp.rally_payroll_calc c
    left join lateral (select coalesce(sum(a.amount), 0) as total from public.payroll_adjustments a
                        where a.employee_id = c.employee_id and a.month = p_month and a.voided_at is null) adj on true
   where c.base_pay + adj.total < 0;
  if v_negative > 0 then
    perform private.raise_error('NEGATIVE_NET_PAY', v_negative::text);
  end if;

  insert into public.payroll_periods (month, closed_by) values (p_month, (select auth.uid()))
  returning id into v_period;

  insert into public.payroll_lines (period_id, employee_id, employee_code, employee_name, branch_id,
                                    shifts_count, paid_minutes, base_pay, adjustments_total)
  select v_period, e.id, e.code, e.full_name, e.home_branch_id,
         c.shifts_count, c.paid_minutes, c.base_pay,
         coalesce((select sum(a.amount) from public.payroll_adjustments a
                    where a.employee_id = e.id and a.month = p_month and a.voided_at is null), 0)
    from pg_temp.rally_payroll_calc c
    join public.employees e on e.id = c.employee_id;

  return v_period;
end;
$$;

-- =============================================================================
-- H. TÀI KHOẢN NHÂN VIÊN
-- =============================================================================

-- Thông tin cổng nhân viên: vai trò + quyền HIỆU LỰC theo chi nhánh (đúng như RLS đánh giá).
create or replace function public.my_staff_context()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'user_id', sa.user_id,
    'role', sa.role,
    'display_name', sa.display_name,
    'employee_id', sa.employee_id,
    'is_active', sa.is_active,
    'must_change_password', sa.must_change_password,
    'branches', coalesce((
      select jsonb_agg(jsonb_build_object('branch_id', x.branch_id, 'name', b.name, 'slug', b.slug,
                                          'permissions', x.permissions) order by b.name)
        from (
          select bid as branch_id, array_agg(perm order by perm) as permissions
            from unnest(enum_range(null::public.app_permission)) as perm
            cross join lateral unnest(private.permitted_branch_ids(perm)) as bid
           group by bid
        ) x
        join public.branches b on b.id = x.branch_id), '[]'::jsonb))
  from public.staff_accounts sa
  where sa.user_id = (select auth.uid());
$$;

-- Đăng nhập bằng SĐT: server đổi bí danh SĐT -> email rồi gọi signInWithPassword.
-- Trả null nếu không có (server luôn báo lỗi chung để chống dò tài khoản).
create or replace function public.resolve_staff_login(p_login text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_login text := btrim(coalesce(p_login, ''));
  v_phone text;
  v_email text;
begin
  perform private.require_service_role();
  if position('@' in v_login) > 0 then
    select u.email into v_email
      from auth.users u join public.staff_accounts sa on sa.user_id = u.id and sa.is_active
     where lower(u.email) = lower(v_login);
    return v_email;
  end if;
  v_phone := private.normalize_vn_phone(v_login);
  if v_phone is null then
    return null;
  end if;
  select u.email into v_email
    from public.staff_accounts sa join auth.users u on u.id = sa.user_id
   where sa.login_phone = '+84' || substr(v_phone, 2) and sa.is_active;
  return v_email;
end;
$$;

create or replace function public.service_mark_password_changed(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_service_role();
  update public.staff_accounts set must_change_password = false where user_id = p_user_id;
end;
$$;

create or replace function public.branch_publish_checklist(p_branch_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_owner();
  return coalesce(private.branch_publish_problems(p_branch_id), array['BRANCH_NOT_FOUND']);
end;
$$;

-- =============================================================================
-- I. TÁC VỤ ĐỊNH KỲ (gọi bằng pg_cron — xem 03_jobs_optional.sql)
-- =============================================================================

create or replace function public.expire_stale_holds()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform private.set_audit_reason('system: hold expired');
  update public.bookings set status = 'expired'
   where status = 'held' and hold_expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- checked_in: hoàn tất ngay khi hết giờ; confirmed: sau 24h nếu không ai đánh dấu no-show.
create or replace function public.complete_finished_bookings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform private.set_audit_reason('system: auto complete');
  update public.bookings set status = 'completed'
   where (status = 'checked_in' and upper(during) <= now())
      or (status = 'confirmed' and upper(during) <= now() - interval '24 hours');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- =============================================================================
-- J. CẤP QUYỀN EXECUTE — mặc định Supabase cấp cho anon/authenticated, thu hồi rồi cấp lại đúng vai trò
-- =============================================================================
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_owner() to authenticated, service_role;
grant execute on function private.permitted_branch_ids(public.app_permission) to authenticated, service_role;
grant execute on function private.staff_can(uuid, public.app_permission) to authenticated, service_role;
grant execute on function private.current_employee_id() to authenticated, service_role;
grant execute on function private.permission_prerequisite(public.app_permission) to authenticated, service_role;
grant execute on function private.random_code(text, integer) to service_role;

revoke all on function public.list_published_branches() from public;
revoke all on function public.get_branch_busy_slots(uuid, timestamptz, timestamptz) from public;
revoke all on function public.quote_booking(uuid, timestamptz, timestamptz) from public;
revoke all on function public.create_guest_booking_hold(uuid, timestamptz, timestamptz, text, text, text, text) from public, anon, authenticated;
revoke all on function public.lookup_guest_booking(text, text) from public, anon, authenticated;
revoke all on function public.cancel_guest_booking(text, text, text) from public, anon, authenticated;
revoke all on function public.confirm_booking(uuid) from public, anon;
revoke all on function public.create_counter_booking(uuid, timestamptz, timestamptz, text, text, text, integer, boolean, text) from public, anon;
revoke all on function public.reschedule_booking(uuid, uuid, timestamptz, timestamptz, text) from public, anon;
revoke all on function public.cancel_booking(uuid, text, boolean) from public, anon;
revoke all on function public.check_in_booking(uuid) from public, anon;
revoke all on function public.mark_booking_no_show(uuid, text) from public, anon;
revoke all on function public.create_court_block(uuid, timestamptz, timestamptz, text) from public, anon;
revoke all on function public.record_booking_payment(uuid, bigint, public.payment_method, text, text, text) from public, anon;
revoke all on function public.record_booking_refund(uuid, bigint, public.payment_method, text, text, text) from public, anon;
revoke all on function public.void_payment(uuid, text) from public, anon;
revoke all on function public.adjust_stock(uuid, uuid, integer, public.stock_reason, text) from public, anon;
revoke all on function public.record_stock_count(uuid, uuid, integer, text) from public, anon;
revoke all on function public.record_sale(uuid, jsonb, public.payment_method, text, bigint, text, text, text, text) from public, anon;
revoke all on function public.void_sale(uuid, text) from public, anon;
revoke all on function public.checkout_rental(uuid, uuid, uuid, integer, text, text, uuid, boolean, public.payment_method, text, text, text) from public, anon;
revoke all on function public.return_rental(uuid, jsonb, integer, integer, text) from public, anon;
revoke all on function public.record_rental_payment(uuid, bigint, public.payment_method, text, text, text) from public, anon;
revoke all on function public.issue_attendance_qr(uuid, text) from public, anon;
revoke all on function public.scan_attendance_qr(text, text) from public, anon;
revoke all on function public.owner_adjust_attendance(uuid, public.attendance_status, text, timestamptz, timestamptz, integer) from public, anon;
revoke all on function public.close_payroll_month(date) from public, anon;
revoke all on function public.my_staff_context() from public, anon;
revoke all on function public.resolve_staff_login(text) from public, anon, authenticated;
revoke all on function public.service_mark_password_changed(uuid) from public, anon, authenticated;
revoke all on function public.branch_publish_checklist(uuid) from public, anon;
revoke all on function public.expire_stale_holds() from public, anon, authenticated;
revoke all on function public.complete_finished_bookings() from public, anon, authenticated;

-- Khách (anon) + người dùng đăng nhập
grant execute on function public.list_published_branches() to anon, authenticated;
grant execute on function public.get_branch_busy_slots(uuid, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.quote_booking(uuid, timestamptz, timestamptz) to anon, authenticated;

-- Chỉ server (service_role)
grant execute on function public.create_guest_booking_hold(uuid, timestamptz, timestamptz, text, text, text, text) to service_role;
grant execute on function public.lookup_guest_booking(text, text) to service_role;
grant execute on function public.cancel_guest_booking(text, text, text) to service_role;
grant execute on function public.resolve_staff_login(text) to service_role;
grant execute on function public.service_mark_password_changed(uuid) to service_role;
grant execute on function public.expire_stale_holds() to service_role;
grant execute on function public.complete_finished_bookings() to service_role;

-- Owner/Staff (quyền chi tiết kiểm tra bên trong hàm)
grant execute on function public.confirm_booking(uuid) to authenticated;
grant execute on function public.create_counter_booking(uuid, timestamptz, timestamptz, text, text, text, integer, boolean, text) to authenticated;
grant execute on function public.reschedule_booking(uuid, uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.cancel_booking(uuid, text, boolean) to authenticated;
grant execute on function public.check_in_booking(uuid) to authenticated;
grant execute on function public.mark_booking_no_show(uuid, text) to authenticated;
grant execute on function public.create_court_block(uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.record_booking_payment(uuid, bigint, public.payment_method, text, text, text) to authenticated;
grant execute on function public.record_booking_refund(uuid, bigint, public.payment_method, text, text, text) to authenticated;
grant execute on function public.void_payment(uuid, text) to authenticated;
grant execute on function public.adjust_stock(uuid, uuid, integer, public.stock_reason, text) to authenticated;
grant execute on function public.record_stock_count(uuid, uuid, integer, text) to authenticated;
grant execute on function public.record_sale(uuid, jsonb, public.payment_method, text, bigint, text, text, text, text) to authenticated;
grant execute on function public.void_sale(uuid, text) to authenticated;
grant execute on function public.checkout_rental(uuid, uuid, uuid, integer, text, text, uuid, boolean, public.payment_method, text, text, text) to authenticated;
grant execute on function public.return_rental(uuid, jsonb, integer, integer, text) to authenticated;
grant execute on function public.record_rental_payment(uuid, bigint, public.payment_method, text, text, text) to authenticated;
grant execute on function public.issue_attendance_qr(uuid, text) to authenticated;
grant execute on function public.scan_attendance_qr(text, text) to authenticated;
grant execute on function public.owner_adjust_attendance(uuid, public.attendance_status, text, timestamptz, timestamptz, integer) to authenticated;
grant execute on function public.close_payroll_month(date) to authenticated;
grant execute on function public.my_staff_context() to authenticated;
grant execute on function public.branch_publish_checklist(uuid) to authenticated;

commit;
