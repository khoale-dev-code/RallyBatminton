-- =============================================================================
-- RALLY BADMINTON — 18_overtime.sql
-- Tăng ca có sự đồng ý của nhân viên + tính lương tăng ca riêng.
--
-- Chạy SAU 00 → 17 (17 là tùy chọn). Chạy lại an toàn.
--
-- Quy trình:
--   1. Chủ sân đề nghị tăng ca cho một ca: thêm bao nhiêu phút ngay sau giờ ra ca, giá tăng ca (đ/giờ), lý do.
--      Nếu nhân viên đã đồng ý trực tiếp tại sân, chủ sân ghi luôn "đã đồng ý".
--   2. Nhân viên mở "Ca & lương của tôi" → Đồng ý / Từ chối (trước khi hết khung giờ tăng ca).
--   3. Lương: phút làm SAU giờ ra ca theo lịch, tối đa bằng số phút tăng ca đã đồng ý, tính theo giá tăng ca;
--      phần còn lại tính giá thường như trước. Đề nghị bị từ chối / chưa trả lời / đã hủy → không tính giá tăng ca.
--   Ví dụ: ca 07:00–11:00 giá 25.000 đ/giờ, tăng ca 2 giờ giá 30.000 đ/giờ, quét ra lúc 13:00
--          → 4 giờ × 25.000 + 2 giờ × 30.000 = 160.000 đ.
-- =============================================================================

begin;

-- 1. Bảng đề nghị tăng ca ------------------------------------------------------------------
create table if not exists public.shift_overtime (
  id             uuid primary key default gen_random_uuid(),
  shift_id       uuid not null references public.shifts (id),
  employee_id    uuid not null references public.employees (id),
  branch_id      uuid not null references public.branches (id),
  minutes        smallint not null constraint shift_overtime_minutes check (minutes between 15 and 480 and minutes % 15 = 0),
  hourly_rate    integer not null constraint shift_overtime_rate check (hourly_rate between 1000 and 20000000),
  reason         text not null constraint shift_overtime_reason_len check (char_length(btrim(reason)) between 3 and 300),
  status         text not null default 'pending'
                   constraint shift_overtime_status check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  consent        text constraint shift_overtime_consent check (consent is null or consent in ('app', 'in_person')),
  requested_by   uuid references auth.users (id) on delete set null,
  requested_at   timestamptz not null default now(),
  responded_by   uuid references auth.users (id) on delete set null,
  responded_at   timestamptz,
  response_note  text constraint shift_overtime_note_len check (response_note is null or char_length(response_note) <= 300),
  updated_at     timestamptz not null default now(),
  constraint shift_overtime_accepted check (status <> 'accepted' or (consent is not null and responded_at is not null))
);
comment on table public.shift_overtime is 'Đề nghị tăng ca ngay sau một ca: số phút, giá tăng ca, nhân viên đồng ý / từ chối. Không xóa, chỉ đổi trạng thái.';
-- Mỗi ca chỉ có một đề nghị đang hiệu lực (chờ trả lời hoặc đã đồng ý).
create unique index if not exists shift_overtime_active_uidx on public.shift_overtime (shift_id)
  where status in ('pending', 'accepted');
create index if not exists shift_overtime_employee_idx on public.shift_overtime (employee_id, status);
create index if not exists shift_overtime_branch_idx on public.shift_overtime (branch_id, requested_at desc);

alter table public.shift_overtime enable row level security;
revoke all on public.shift_overtime from anon, authenticated;
grant select on public.shift_overtime to authenticated;
-- Giá tăng ca là thông tin lương: chỉ chủ sân và chính nhân viên đó đọc được. Ghi chỉ qua RPC.
drop policy if exists shift_overtime_read on public.shift_overtime;
create policy shift_overtime_read on public.shift_overtime
  for select to authenticated
  using ((select private.is_owner()) or employee_id = (select private.current_employee_id()));

drop trigger if exists touch_shift_overtime on public.shift_overtime;
create trigger touch_shift_overtime before update on public.shift_overtime
  for each row execute function private.touch_updated_at();
drop trigger if exists audit_shift_overtime on public.shift_overtime;
create trigger audit_shift_overtime after insert or update on public.shift_overtime
  for each row execute function private.audit_row_change('id', 'branch_id');
drop trigger if exists no_delete_shift_overtime on public.shift_overtime;
create trigger no_delete_shift_overtime before delete on public.shift_overtime
  for each row execute function private.forbid_hard_delete();

-- 2. Phút tăng ca thực làm của một ca --------------------------------------------------------
-- Phút sau giờ ra ca theo lịch (tính từ lúc vào nếu vào sau giờ ra ca), tối đa số phút đã đồng ý và tổng công.
create or replace function private.overtime_worked_minutes(
  p_checked_in timestamptz, p_checked_out timestamptz, p_scheduled_end timestamptz, p_approved integer, p_paid integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_checked_in is null or p_checked_out is null or coalesce(p_approved, 0) <= 0 then 0
    else greatest(0, least(
      p_approved,
      coalesce(p_paid, 0),
      floor(extract(epoch from (p_checked_out - greatest(p_scheduled_end, p_checked_in))) / 60)::integer))
  end;
$$;

-- 3. Chủ sân đề nghị tăng ca ------------------------------------------------------------------
create or replace function public.offer_overtime(
  p_shift_id uuid,
  p_minutes integer,
  p_hourly_rate integer,
  p_reason text,
  p_agreed_in_person boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.shifts;
  v_id uuid;
  v_ot_end timestamptz;
  v_status text;
begin
  perform private.require_owner();
  select * into v from public.shifts where id = p_shift_id and deleted_at is null for update;
  if not found then
    perform private.raise_error('SHIFT_NOT_FOUND');
  end if;
  if v.status not in ('scheduled', 'present') then
    perform private.raise_error('OVERTIME_SHIFT_NOT_WORKED');
  end if;
  if private.payroll_month_closed(v.work_date) then
    perform private.raise_error('PAYROLL_MONTH_CLOSED');
  end if;
  if p_minutes is null or p_minutes < 15 or p_minutes > 480 or p_minutes % 15 <> 0 then
    perform private.raise_error('OVERTIME_INVALID_MINUTES');
  end if;
  if p_hourly_rate is null or p_hourly_rate < 1000 or p_hourly_rate > 20000000 then
    perform private.raise_error('OVERTIME_INVALID_RATE');
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    perform private.raise_error('REASON_REQUIRED', 'Tối thiểu 3 ký tự');
  end if;
  v_ot_end := v.scheduled_end + make_interval(mins => p_minutes);
  if v_ot_end - v.scheduled_start > interval '16 hours' then
    perform private.raise_error('OVERTIME_TOO_LONG');
  end if;
  -- Hỏi qua ứng dụng thì phải còn thời gian để nhân viên trả lời.
  if not coalesce(p_agreed_in_person, false) and now() >= v_ot_end then
    perform private.raise_error('OVERTIME_WINDOW_PASSED');
  end if;
  if exists (select 1 from public.shifts o
              where o.employee_id = v.employee_id and o.id <> v.id and o.deleted_at is null and o.status <> 'cancelled'
                and o.scheduled_range && tstzrange(v.scheduled_end, v_ot_end, '[)')) then
    perform private.raise_error('OVERTIME_OVERLAPS_SHIFT');
  end if;
  if exists (select 1 from public.shift_overtime o where o.shift_id = v.id and o.status in ('pending', 'accepted')) then
    perform private.raise_error('OVERTIME_ALREADY_OFFERED');
  end if;

  v_status := case when coalesce(p_agreed_in_person, false) then 'accepted' else 'pending' end;
  perform private.set_audit_reason(case when v_status = 'accepted' then 'overtime_in_person' else 'overtime_offer' end);
  insert into public.shift_overtime (shift_id, employee_id, branch_id, minutes, hourly_rate, reason, status, consent,
                                     requested_by, responded_by, responded_at)
  values (v.id, v.employee_id, v.branch_id, p_minutes, p_hourly_rate, btrim(p_reason), v_status,
          case when v_status = 'accepted' then 'in_person' end,
          (select auth.uid()),
          case when v_status = 'accepted' then (select auth.uid()) end,
          case when v_status = 'accepted' then now() end)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'status', v_status, 'ends_at', v_ot_end);
end;
$$;

-- 4. Nhân viên đồng ý / từ chối ---------------------------------------------------------------
create or replace function public.respond_overtime(p_offer_id uuid, p_accept boolean, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.shift_overtime;
  v_end timestamptz;
  v_employee uuid := private.current_employee_id();
begin
  if (select auth.uid()) is null or v_employee is null then
    perform private.raise_error('STAFF_NOT_ALLOWED');
  end if;
  select * into o from public.shift_overtime where id = p_offer_id for update;
  if not found or o.employee_id <> v_employee then
    perform private.raise_error('OVERTIME_NOT_FOUND');
  end if;
  if o.status <> 'pending' then
    perform private.raise_error('OVERTIME_ALREADY_ANSWERED');
  end if;
  select s.scheduled_end + make_interval(mins => o.minutes) into v_end from public.shifts s where s.id = o.shift_id;
  if now() >= v_end then
    perform private.raise_error('OVERTIME_EXPIRED');
  end if;
  perform private.set_audit_reason(case when p_accept then 'overtime_accept' else 'overtime_decline' end);
  update public.shift_overtime
     set status = case when p_accept then 'accepted' else 'declined' end,
         consent = case when p_accept then 'app' end,
         responded_by = (select auth.uid()), responded_at = now(),
         response_note = left(nullif(btrim(coalesce(p_note, '')), ''), 300)
   where id = o.id;
  return jsonb_build_object('id', o.id, 'status', case when p_accept then 'accepted' else 'declined' end);
end;
$$;

-- 5. Chủ sân hủy đề nghị (giữ lịch sử) --------------------------------------------------------
create or replace function public.cancel_overtime(p_offer_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.shift_overtime;
  v_date date;
begin
  perform private.require_owner();
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    perform private.raise_error('REASON_REQUIRED', 'Tối thiểu 3 ký tự');
  end if;
  select * into o from public.shift_overtime where id = p_offer_id for update;
  if not found then
    perform private.raise_error('OVERTIME_NOT_FOUND');
  end if;
  if o.status not in ('pending', 'accepted') then
    perform private.raise_error('OVERTIME_ALREADY_ANSWERED');
  end if;
  select work_date into v_date from public.shifts where id = o.shift_id;
  if private.payroll_month_closed(v_date) then
    perform private.raise_error('PAYROLL_MONTH_CLOSED');
  end if;
  perform private.set_audit_reason('overtime_cancel: ' || btrim(p_reason));
  update public.shift_overtime
     set status = 'cancelled', response_note = left(btrim(p_reason), 300)
   where id = o.id;
  return jsonb_build_object('id', o.id, 'status', 'cancelled');
end;
$$;

revoke all on function private.overtime_worked_minutes(timestamptz, timestamptz, timestamptz, integer, integer) from public, anon;
revoke all on function public.offer_overtime(uuid, integer, integer, text, boolean) from public, anon;
revoke all on function public.respond_overtime(uuid, boolean, text) from public, anon;
revoke all on function public.cancel_overtime(uuid, text) from public, anon;
grant execute on function private.overtime_worked_minutes(timestamptz, timestamptz, timestamptz, integer, integer) to authenticated, service_role;
grant execute on function public.offer_overtime(uuid, integer, integer, text, boolean) to authenticated;
grant execute on function public.respond_overtime(uuid, boolean, text) to authenticated;
grant execute on function public.cancel_overtime(uuid, text) to authenticated;

-- 6. Phiếu lương lưu riêng phần tăng ca (đã gồm trong base_pay) --------------------------------
alter table public.payroll_lines add column if not exists overtime_minutes integer not null default 0;
alter table public.payroll_lines add column if not exists overtime_pay bigint not null default 0;
comment on column public.payroll_lines.overtime_pay is 'Tiền tăng ca (đã cộng trong base_pay).';

-- 7. Quét QR ra ca: tăng ca đã đồng ý kéo dài thời hạn ------------------------------------------
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
  -- Tăng ca đã đồng ý kéo dài thời hạn quét ra tương ứng.
  if v_now > v_shift.scheduled_end + interval '4 hours'
             + make_interval(mins => coalesce((select o.minutes from public.shift_overtime o
                                                where o.shift_id = v_shift.id and o.status = 'accepted' limit 1), 0)) then
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

-- 8. Chốt lương tháng: tách giá thường / giá tăng ca ----------------------------------------------
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
  perform 1 from public.shift_overtime o join public.shifts s on s.id = o.shift_id
   where s.work_date >= p_month and s.work_date < v_next for update of o;

  select count(*) into v_unresolved from public.shifts s
   where s.work_date >= p_month and s.work_date < v_next and s.deleted_at is null and s.status = 'scheduled';
  if v_unresolved > 0 then
    perform private.raise_error('UNRESOLVED_SHIFTS', v_unresolved::text);
  end if;

  drop table if exists pg_temp.rally_payroll_calc;
  create temporary table pg_temp.rally_payroll_calc (
    employee_id uuid primary key, shifts_count integer, paid_minutes integer, base_pay bigint, missing_rate integer,
    overtime_minutes integer not null default 0, overtime_pay bigint not null default 0
  ) on commit drop;
  truncate pg_temp.rally_payroll_calc;

  -- Phút sau giờ ra ca (trong phần tăng ca đã đồng ý) tính giá tăng ca; phần còn lại giá thường.
  insert into pg_temp.rally_payroll_calc (employee_id, shifts_count, paid_minutes, base_pay, missing_rate,
                                          overtime_minutes, overtime_pay)
  select s.employee_id,
         count(*) filter (where s.status = 'present')::integer,
         coalesce(sum(s.paid_minutes), 0)::integer,
         coalesce(sum(case
           when s.status <> 'present' then 0
           when r.pay_type = 'hourly' then round(r.hourly_rate::numeric * (s.paid_minutes - w.ot) / 60)
           else round(r.daily_rate::numeric * (s.paid_minutes - w.ot) / r.standard_day_minutes) end
           + case when s.status = 'present' then round(coalesce(o.hourly_rate, 0)::numeric * w.ot / 60) else 0 end), 0)::bigint,
         count(*) filter (where s.status = 'present' and r.id is null)::integer,
         coalesce(sum(w.ot) filter (where s.status = 'present'), 0)::integer,
         coalesce(sum(round(coalesce(o.hourly_rate, 0)::numeric * w.ot / 60)) filter (where s.status = 'present'), 0)::bigint
    from public.shifts s
    left join lateral (
      select pr.* from public.employee_pay_rates pr
       where pr.employee_id = s.employee_id and pr.effective_from <= s.work_date
       order by pr.effective_from desc limit 1) r on true
    left join lateral (
      select ov.minutes, ov.hourly_rate from public.shift_overtime ov
       where ov.shift_id = s.id and ov.status = 'accepted' limit 1) o on true
    cross join lateral (
      select private.overtime_worked_minutes(s.checked_in_at, s.checked_out_at, s.scheduled_end, o.minutes, s.paid_minutes) as ot) w
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
                                    shifts_count, paid_minutes, base_pay, adjustments_total,
                                    overtime_minutes, overtime_pay)
  select v_period, e.id, e.code, e.full_name, e.home_branch_id,
         c.shifts_count, c.paid_minutes, c.base_pay,
         coalesce((select sum(a.amount) from public.payroll_adjustments a
                    where a.employee_id = e.id and a.month = p_month and a.voided_at is null), 0),
         c.overtime_minutes, c.overtime_pay
    from pg_temp.rally_payroll_calc c
    join public.employees e on e.id = c.employee_id;

  return v_period;
end;
$$;

-- 9. Xem trước bảng lương: thêm cột tăng ca (đổi kiểu trả về nên phải drop trước) ----------------
drop function if exists public.preview_payroll_month(date);
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
  missing_rate_shifts integer,
  overtime_minutes integer,
  overtime_pay bigint,
  pending_overtime integer)
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
             when r.pay_type = 'hourly' then round(r.hourly_rate::numeric * (s.paid_minutes - w.ot) / 60)
             else round(r.daily_rate::numeric * (s.paid_minutes - w.ot) / r.standard_day_minutes) end
             + case when s.status = 'present' then round(coalesce(o.hourly_rate, 0)::numeric * w.ot / 60) else 0 end), 0)::bigint as gross,
           count(*) filter (where s.status = 'scheduled')::integer as n_unresolved,
           count(*) filter (where s.status = 'present' and r.id is null)::integer as n_missing,
           coalesce(sum(w.ot) filter (where s.status = 'present'), 0)::integer as ot_mins,
           coalesce(sum(round(coalesce(o.hourly_rate, 0)::numeric * w.ot / 60)) filter (where s.status = 'present'), 0)::bigint as ot_pay,
           count(p.id)::integer as n_pending
      from public.shifts s
      left join lateral (
        select pr.* from public.employee_pay_rates pr
         where pr.employee_id = s.employee_id and pr.effective_from <= s.work_date
         order by pr.effective_from desc limit 1) r on true
      left join lateral (
        select ov.minutes, ov.hourly_rate from public.shift_overtime ov
         where ov.shift_id = s.id and ov.status = 'accepted' limit 1) o on true
      left join lateral (
        select ov.id from public.shift_overtime ov
         where ov.shift_id = s.id and ov.status = 'pending' limit 1) p on true
      cross join lateral (
        select private.overtime_worked_minutes(s.checked_in_at, s.checked_out_at, s.scheduled_end, o.minutes, s.paid_minutes) as ot) w
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
         coalesce(c.n_unresolved, 0), coalesce(c.n_missing, 0),
         coalesce(c.ot_mins, 0), coalesce(c.ot_pay, 0), coalesce(c.n_pending, 0)
    from people p
    join public.employees e on e.id = p.emp
    left join calc c on c.emp = p.emp
    left join adj a on a.emp = p.emp
   order by e.code;
end;
$$;

revoke all on function public.preview_payroll_month(date) from public, anon;
grant execute on function public.preview_payroll_month(date) to authenticated;
revoke all on function public.close_payroll_month(date) from public, anon;
grant execute on function public.close_payroll_month(date) to authenticated;
revoke all on function public.scan_attendance_qr(text, text) from public, anon;
grant execute on function public.scan_attendance_qr(text, text) to authenticated;

commit;

notify pgrst, 'reload schema';
