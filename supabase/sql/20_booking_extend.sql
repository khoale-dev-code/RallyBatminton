-- =============================================================================
-- RALLY BADMINTON — 20_booking_extend.sql
-- Khách chơi thêm giờ: gia hạn đơn đặt sân ngay tại quầy, tính thêm tiền đúng bảng giá.
--
-- Chạy SAU 00 → 19. Chạy lại an toàn.
--
--   * court_extend_options(booking): sân còn trống tới mấy giờ + các lựa chọn +30 phút, +1 giờ… kèm tiền thêm.
--   * extend_booking(booking, new_end): kéo dài giờ kết thúc, cộng tiền phần thêm (giá theo khung giờ của phần thêm),
--     không đổi tiền cọc / giảm giá. Dùng được cho đơn đang giữ, đã xác nhận, đã nhận sân; đơn đã tự "hoàn tất"
--     chỉ ghi được phần giờ đã chơi (giờ kết thúc mới không vượt quá hiện tại).
--   Ví dụ: khách vãng lai đặt 18:00–19:00 (1 giờ), sân trống tới 21:00, khách chơi tới 20:00
--          → nhân viên bấm "+1 giờ" → đơn thành 18:00–20:00, tiền thêm theo giá khung 19:00–20:00.
-- =============================================================================

begin;

-- 1. Cho phép sửa giờ kết thúc của đơn đã nhận sân khi gia hạn (cờ chỉ bật trong extend_booking) -------
create or replace function private.bookings_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    if new.status not in ('held', 'confirmed') then
      raise exception using errcode = 'P0001', message = 'INVALID_INITIAL_STATUS';
    end if;
    new.status_changed_at := pg_catalog.now();
    if new.status = 'confirmed' then
      new.confirmed_at := coalesce(new.confirmed_at, pg_catalog.now());
      new.confirmed_by := coalesce(new.confirmed_by, v_actor);
    end if;
    return new;
  end if;

  if (new.id, new.code, new.branch_id, new.kind, new.source, new.created_at)
       is distinct from (old.id, old.code, old.branch_id, old.kind, old.source, old.created_at)
     or new.customer_id is distinct from old.customer_id
     or new.created_by is distinct from old.created_by
     or new.idempotency_key is distinct from old.idempotency_key then
    raise exception using errcode = 'P0001', message = 'BOOKING_IMMUTABLE_FIELD';
  end if;

  if ((new.court_id, new.during, new.subtotal_amount, new.discount_amount, new.deposit_amount)
        is distinct from (old.court_id, old.during, old.subtotal_amount, old.discount_amount, old.deposit_amount)
      or new.price_snapshot is distinct from old.price_snapshot)
     and old.status not in ('held', 'confirmed')
     -- Gia hạn giờ chơi (extend_booking) được sửa giờ kết thúc + tiền của đơn đã nhận sân / vừa hoàn tất.
     and not (old.status in ('checked_in', 'completed')
              and pg_catalog.current_setting('rally.booking_extend', true) = 'on'
              and new.court_id = old.court_id and lower(new.during) = lower(old.during)
              and upper(new.during) > upper(old.during)) then
    raise exception using errcode = 'P0001', message = 'BOOKING_NOT_EDITABLE';
  end if;

  if new.status is distinct from old.status then
    if not private.booking_transition_allowed(old.status, new.status) then
      raise exception using errcode = 'P0001', message = 'INVALID_STATUS_TRANSITION',
        detail = pg_catalog.format('%s -> %s', old.status, new.status);
    end if;
    new.status_changed_at := pg_catalog.now();
    case new.status
      when 'confirmed' then
        new.confirmed_at := pg_catalog.now();
        new.confirmed_by := coalesce(v_actor, new.confirmed_by);
      when 'checked_in' then
        new.checked_in_at := pg_catalog.now();
        new.checked_in_by := coalesce(v_actor, new.checked_in_by);
      when 'completed' then
        new.completed_at := pg_catalog.now();
      when 'cancelled' then
        new.cancelled_at := pg_catalog.now();
        new.cancelled_by := coalesce(v_actor, new.cancelled_by);
      else
        null;
    end case;
  end if;
  return new;
end;
$$;

-- 2. Sân còn trống tới mấy giờ + lựa chọn gia hạn kèm tiền ---------------------------------------
create or replace function public.court_extend_options(p_booking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.bookings;
  br record;
  v_end timestamptz;
  v_next timestamptz;
  v_close timestamptz;
  v_limit timestamptz;
  v_slot interval;
  v_opts jsonb := '[]'::jsonb;
  v_cand timestamptz;
  v_q record;
  i integer;
begin
  select * into v from public.bookings where id = p_booking_id;
  if not found then
    perform private.raise_error('BOOKING_NOT_FOUND');
  end if;
  if not ((select private.is_owner()) or private.staff_can(v.branch_id, 'booking.view')) then
    perform private.raise_error('PERMISSION_DENIED');
  end if;
  select b.timezone, b.slot_minutes, b.closes_at into br from public.branches b where b.id = v.branch_id;
  v_slot := make_interval(mins => br.slot_minutes);
  v_end := upper(v.during);
  -- Lượt kế tiếp trên cùng sân (đơn khách / khóa sân đang hiệu lực).
  select min(lower(b.during)) into v_next
    from public.bookings b
   where b.court_id = v.court_id and b.id <> v.id and b.deleted_at is null
     and lower(b.during) >= v_end
     and (b.status in ('confirmed', 'checked_in') or (b.status = 'held' and b.hold_expires_at > now()));
  -- Giờ đóng cửa của ngày chứa giờ kết thúc hiện tại (giờ địa phương).
  v_close := ((((v_end - interval '1 second') at time zone br.timezone)::date + br.closes_at) at time zone br.timezone);
  v_limit := least(coalesce(v_next, v_close), v_close, v_end + interval '6 hours');
  if v.status = 'completed' then
    v_limit := least(v_limit, now());
  end if;

  i := 1;
  loop
    v_cand := v_end + v_slot * i;
    exit when v_cand > v_limit or i > 12;
    begin
      select * into v_q from private.quote_court_price(v.court_id, tstzrange(v_end, v_cand, '[)'));
    exception when others then
      exit;  -- ngoài giờ mở cửa / chưa có bảng giá cho khung này
    end;
    v_opts := v_opts || jsonb_build_object('minutes', i * br.slot_minutes, 'ends_at', v_cand, 'amount', v_q.total_amount);
    i := i + 1;
  end loop;

  return jsonb_build_object(
    'booking_id', v.id, 'status', v.status, 'starts_at', lower(v.during), 'ends_at', v_end,
    'slot_minutes', br.slot_minutes,
    'free_until', v_limit, 'limit_reason', case when v_next is not null and v_next <= v_close then 'booking' else 'closing' end,
    'next_booking_at', v_next,
    'can_extend', v.kind = 'customer' and v.status in ('held', 'confirmed', 'checked_in', 'completed'),
    'options', v_opts);
end;
$$;

-- 3. Gia hạn giờ chơi -------------------------------------------------------------------------------
create or replace function public.extend_booking(p_booking_id uuid, p_new_end timestamptz, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.bookings;
  v_ext tstzrange;
  v_q record;
  v_minutes integer;
  v_snapshot jsonb;
begin
  v := private.lock_booking(p_booking_id);
  perform private.require_permission(v.branch_id, 'booking.operate');
  if v.kind <> 'customer' then
    perform private.raise_error('NOT_A_CUSTOMER_BOOKING');
  end if;
  if v.status not in ('held', 'confirmed', 'checked_in', 'completed') then
    perform private.raise_error('BOOKING_NOT_EDITABLE', v.status::text);
  end if;
  if p_new_end is null or p_new_end <= upper(v.during) then
    perform private.raise_error('EXTEND_END_INVALID');
  end if;
  if p_new_end > upper(v.during) + interval '6 hours' then
    perform private.raise_error('EXTEND_TOO_LONG');
  end if;
  -- Đơn đã tự hoàn tất: chỉ ghi phần giờ khách đã chơi, không giữ sân cho tương lai.
  if v.status = 'completed' and p_new_end > now() + interval '1 minute' then
    perform private.raise_error('EXTEND_COMPLETED_FUTURE');
  end if;
  if (select status from public.courts where id = v.court_id) <> 'active' then
    perform private.raise_error('COURT_UNAVAILABLE');
  end if;
  v_ext := tstzrange(upper(v.during), p_new_end, '[)');
  perform private.expire_overlapping_holds(v.court_id, v_ext);
  if exists (select 1 from public.bookings b
              where b.court_id = v.court_id and b.id <> v.id and b.deleted_at is null
                and b.status in ('held', 'confirmed', 'checked_in') and b.during && v_ext) then
    perform private.raise_error('SLOT_TAKEN');
  end if;
  -- Giá phần thêm theo đúng khung giờ của phần thêm (giờ vàng / thường…).
  select * into v_q from private.quote_court_price(v.court_id, v_ext);
  v_minutes := (extract(epoch from (p_new_end - upper(v.during))) / 60)::integer;

  -- Gộp bảng giá: cùng mức giá thì cộng phút / tiền.
  select coalesce(jsonb_agg(jsonb_build_object('rule_id', g.rule_id, 'price_per_hour', g.price_per_hour,
                                               'minutes', g.minutes, 'amount', g.amount) order by g.ord), '[]'::jsonb)
    into v_snapshot
    from (select x ->> 'rule_id' as rule_id, (x ->> 'price_per_hour')::numeric as price_per_hour,
                 sum((x ->> 'minutes')::integer) as minutes, sum((x ->> 'amount')::numeric) as amount, min(o) as ord
            from jsonb_array_elements(coalesce(v.price_snapshot, '[]'::jsonb) || coalesce(v_q.breakdown, '[]'::jsonb))
                 with ordinality as e(x, o)
           group by 1, 2) g;

  perform private.set_audit_reason(left(format('extend: +%s phút%s', v_minutes,
                                               coalesce(' · ' || nullif(btrim(p_note), ''), '')), 300));
  perform pg_catalog.set_config('rally.booking_extend', 'on', true);
  begin
    update public.bookings
       set during = tstzrange(lower(v.during), p_new_end, '[)'),
           subtotal_amount = v.subtotal_amount + v_q.total_amount,
           price_snapshot = v_snapshot
     where id = v.id;
  exception
    when exclusion_violation then
      perform private.raise_error('SLOT_TAKEN');
  end;
  perform pg_catalog.set_config('rally.booking_extend', 'off', true);
  return private.booking_json(v.id) || jsonb_build_object('extended_minutes', v_minutes, 'extra_amount', v_q.total_amount);
end;
$$;

revoke all on function public.court_extend_options(uuid) from public, anon;
revoke all on function public.extend_booking(uuid, timestamptz, text) from public, anon;
grant execute on function public.court_extend_options(uuid) to authenticated;
grant execute on function public.extend_booking(uuid, timestamptz, text) to authenticated;

commit;

notify pgrst, 'reload schema';
