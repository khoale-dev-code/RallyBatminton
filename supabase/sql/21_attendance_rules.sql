-- =============================================================================
-- RALLY BADMINTON — 21_attendance_rules.sql
-- Chấm công công bằng & chặt chẽ: chỉ trả công trong khung đã duyệt, quy trình "yêu cầu sửa giờ",
-- tự đóng ca quên ra, máy quầy riêng (không cần tài khoản chủ sân), nhiều màn hình mã QR.
--
-- Chạy SAU 00 → 20. Chạy lại an toàn. Tháng đã chốt lương KHÔNG bị tính lại.
--
-- Công thức công một ca (status = present):
--   Bắt đầu  = muộn hơn của (giờ vào, giờ bắt đầu ca)                  → đến sớm không được trả thêm
--   Kết thúc = sớm hơn của (giờ ra, giờ kết thúc ca + tăng ca đã đồng ý) → quên ra rồi quay lại quét không được trả thêm
--   Chủ sân "Trả theo giờ thực tế" (actual_time_decision = 'approved') → dùng đúng giờ vào / ra.
--   Phút công = Kết thúc − Bắt đầu − phút nghỉ.  Đi trễ = giờ vào > giờ bắt đầu + ân hạn (cài đặt).
--   Giờ quét QR thật luôn được lưu riêng (scanned_in_at / scanned_out_at) để đối chiếu.
-- =============================================================================

begin;

-- 1. Cài đặt chấm công (một dòng) -----------------------------------------------------------
create table if not exists public.attendance_settings (
  id                      boolean primary key default true constraint attendance_settings_singleton check (id),
  late_grace_minutes      smallint not null default 10 constraint att_late_grace check (late_grace_minutes between 0 and 60),
  late_out_review_minutes smallint not null default 30 constraint att_late_out check (late_out_review_minutes between 5 and 240),
  fix_request_hours       smallint not null default 24 constraint att_fix_hours check (fix_request_hours between 1 and 168),
  forgot_warn_count       smallint not null default 3 constraint att_forgot_warn check (forgot_warn_count between 1 and 31),
  qr_ttl_seconds          smallint not null default 45 constraint att_qr_ttl check (qr_ttl_seconds between 20 and 180),
  auto_close_forgotten    boolean not null default true,
  updated_at              timestamptz not null default now(),
  updated_by              uuid references auth.users (id) on delete set null
);
comment on table public.attendance_settings is 'Quy tắc chấm công (một dòng): ân hạn đi trễ, ngưỡng ra ca trễ cần xem lại, hạn gửi yêu cầu sửa giờ, thời gian sống mã QR.';
insert into public.attendance_settings (id) values (true) on conflict (id) do nothing;

alter table public.attendance_settings enable row level security;
revoke all on public.attendance_settings from anon, authenticated;
grant select on public.attendance_settings to authenticated;
drop policy if exists attendance_settings_read on public.attendance_settings;
create policy attendance_settings_read on public.attendance_settings for select to authenticated using (true);
drop trigger if exists touch_attendance_settings on public.attendance_settings;
create trigger touch_attendance_settings before update on public.attendance_settings
  for each row execute function private.touch_updated_at();
drop trigger if exists audit_attendance_settings on public.attendance_settings;
create trigger audit_attendance_settings after insert or update on public.attendance_settings
  for each row execute function private.audit_row_change('id', '-');

create or replace function private.att_settings()
returns public.attendance_settings
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s from public.attendance_settings s where s.id limit 1),
    row(true, 10, 30, 24, 3, 45, true, now(), null)::public.attendance_settings);
$$;

create or replace function public.update_attendance_settings(
  p_late_grace_minutes integer,
  p_late_out_review_minutes integer,
  p_fix_request_hours integer,
  p_forgot_warn_count integer,
  p_qr_ttl_seconds integer,
  p_auto_close_forgotten boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_owner();
  perform private.set_audit_reason('Đổi quy tắc chấm công');
  insert into public.attendance_settings as s (id, late_grace_minutes, late_out_review_minutes, fix_request_hours,
                                               forgot_warn_count, qr_ttl_seconds, auto_close_forgotten, updated_by)
  values (true, p_late_grace_minutes, p_late_out_review_minutes, p_fix_request_hours,
          p_forgot_warn_count, p_qr_ttl_seconds, coalesce(p_auto_close_forgotten, true), (select auth.uid()))
  on conflict (id) do update set
    late_grace_minutes = excluded.late_grace_minutes,
    late_out_review_minutes = excluded.late_out_review_minutes,
    fix_request_hours = excluded.fix_request_hours,
    forgot_warn_count = excluded.forgot_warn_count,
    qr_ttl_seconds = excluded.qr_ttl_seconds,
    auto_close_forgotten = excluded.auto_close_forgotten,
    updated_by = excluded.updated_by;
  return to_jsonb(private.att_settings());
end;
$$;

-- 2. Ca làm: lưu giờ quét thật, nguồn giờ vào/ra, quyết định "trả theo giờ thực tế" ------------
alter table public.shifts add column if not exists scanned_in_at timestamptz;
alter table public.shifts add column if not exists scanned_out_at timestamptz;
alter table public.shifts add column if not exists in_source text;
alter table public.shifts add column if not exists out_source text;
alter table public.shifts add column if not exists actual_time_decision text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shifts_in_source') then
    alter table public.shifts add constraint shifts_in_source check (in_source is null or in_source in ('qr', 'request', 'owner'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'shifts_out_source') then
    alter table public.shifts add constraint shifts_out_source
      check (out_source is null or out_source in ('qr', 'request', 'owner', 'auto'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'shifts_actual_decision') then
    alter table public.shifts add constraint shifts_actual_decision
      check (actual_time_decision is null or actual_time_decision in ('approved', 'kept'));
  end if;
  -- Công tính lương không còn là cột tự sinh (cần tăng ca + quyết định của chủ sân) → trigger tính.
  if exists (select 1 from pg_attribute where attrelid = 'public.shifts'::regclass
              and attname = 'paid_minutes' and attgenerated = 's') then
    alter table public.shifts alter column paid_minutes drop expression;
  end if;
end $$;
alter table public.shifts alter column paid_minutes set default 0;
update public.shifts set paid_minutes = 0 where paid_minutes is null;
alter table public.shifts alter column paid_minutes set not null;
comment on column public.shifts.scanned_in_at is 'Giờ quét QR vào ca thật (không đổi khi chủ sân sửa / duyệt yêu cầu).';
comment on column public.shifts.actual_time_decision is 'approved = trả theo giờ vào/ra thực tế (bỏ giới hạn khung ca); kept = đã xem, giữ theo khung.';
comment on column public.shifts.paid_minutes is 'Phút công tính lương = khung đã duyệt (xem 21_attendance_rules.sql). Trigger tính, không sửa tay.';

-- 3. Công thức công ---------------------------------------------------------------------------
create or replace function private.shift_paid_minutes(
  p_status public.attendance_status,
  p_in timestamptz, p_out timestamptz,
  p_start timestamptz, p_end timestamptz,
  p_break integer, p_overtime integer, p_decision text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_status <> 'present' or p_in is null or p_out is null then 0
    else greatest(0, floor(extract(epoch from (
           (case when p_decision = 'approved' then p_out
                 else least(p_out, p_end + make_interval(mins => greatest(coalesce(p_overtime, 0), 0))) end)
         - (case when p_decision = 'approved' then p_in else greatest(p_in, p_start) end))) / 60)::integer
         - coalesce(p_break, 0))
  end;
$$;

create or replace function private.accepted_overtime_minutes(p_shift_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select o.minutes::integer from public.shift_overtime o
                    where o.shift_id = p_shift_id and o.status = 'accepted' limit 1), 0);
$$;

create or replace function private.shifts_compute_paid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.paid_minutes := private.shift_paid_minutes(
    new.status, new.checked_in_at, new.checked_out_at, new.scheduled_start, new.scheduled_end,
    new.actual_break_minutes,
    case when tg_op = 'INSERT' then 0 else private.accepted_overtime_minutes(new.id) end,
    new.actual_time_decision);
  return new;
end;
$$;
drop trigger if exists shifts_zz_paid on public.shifts;
create trigger shifts_zz_paid before insert or update on public.shifts
  for each row execute function private.shifts_compute_paid();

-- Tăng ca được đồng ý / hủy → tính lại công của ca đó.
create or replace function private.shift_overtime_recompute()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status or new.minutes is distinct from old.minutes then
    update public.shifts s set paid_minutes = s.paid_minutes
     where s.id = new.shift_id and s.status = 'present' and not private.payroll_month_closed(s.work_date);
  end if;
  return null;
end;
$$;
drop trigger if exists shift_overtime_zz_recompute on public.shift_overtime;
create trigger shift_overtime_zz_recompute after insert or update on public.shift_overtime
  for each row execute function private.shift_overtime_recompute();

-- Tính lại công các tháng CHƯA chốt theo công thức mới (tháng đã chốt giữ nguyên số đã trả).
select private.set_audit_reason('system: tính lại công theo khung giờ duyệt (21)');
update public.shifts s
   set paid_minutes = private.shift_paid_minutes(s.status, s.checked_in_at, s.checked_out_at, s.scheduled_start,
                                                 s.scheduled_end, s.actual_break_minutes,
                                                 private.accepted_overtime_minutes(s.id), s.actual_time_decision)
 where not private.payroll_month_closed(s.work_date)
   and s.paid_minutes is distinct from private.shift_paid_minutes(
         s.status, s.checked_in_at, s.checked_out_at, s.scheduled_start, s.scheduled_end, s.actual_break_minutes,
         private.accepted_overtime_minutes(s.id), s.actual_time_decision);
select private.set_audit_reason(null);

-- 4. Quét QR: lưu giờ quét thật + nguồn -------------------------------------------------------
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
  v_cfg public.attendance_settings := private.att_settings();
  v_ot integer;
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
    update public.shifts set checked_in_at = v_now, scanned_in_at = v_now, in_source = 'qr' where id = v_shift.id;
    return jsonb_build_object(
      'event', 'checkin', 'shift_id', v_shift.id, 'at', v_now,
      'late_minutes', greatest(0, floor(extract(epoch from (v_now - v_shift.scheduled_start)) / 60))::integer,
      'late', v_now > v_shift.scheduled_start + make_interval(mins => v_cfg.late_grace_minutes));
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
  v_ot := private.accepted_overtime_minutes(v_shift.id);
  if v_now > v_shift.scheduled_end + interval '4 hours' + make_interval(mins => v_ot) then
    perform private.raise_error('CHECKOUT_TOO_LATE', 'Gửi yêu cầu sửa giờ ra hoặc liên hệ chủ sân.');
  end if;
  perform private.set_audit_reason('qr_checkout');
  update public.shifts
     set checked_out_at = v_now, scanned_out_at = v_now, out_source = 'qr', status = 'present',
         actual_break_minutes = v_shift.break_minutes
   where id = v_shift.id;
  return jsonb_build_object(
    'event', 'checkout', 'shift_id', v_shift.id, 'at', v_now,
    'paid_minutes', (select paid_minutes from public.shifts where id = v_shift.id),
    'capped', v_now > v_shift.scheduled_end + make_interval(mins => v_ot + v_cfg.late_out_review_minutes));
end;
$$;

-- Chủ sân sửa công: ghi nguồn 'owner' (giữ nguyên quy tắc lý do bắt buộc).
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
           in_source = case when p_checked_in_at is not null or v.checked_in_at is null then 'owner' else v.in_source end,
           out_source = case when p_checked_out_at is not null or v.checked_out_at is null then 'owner' else v.out_source end,
           actual_break_minutes = coalesce(p_actual_break_minutes, v.break_minutes)
     where id = v.id;
  else
    update public.shifts
       set status = p_status, checked_in_at = null, checked_out_at = null, actual_break_minutes = 0,
           in_source = null, out_source = null, actual_time_decision = null
     where id = v.id;
  end if;
  return (select jsonb_build_object('shift_id', s.id, 'status', s.status, 'paid_minutes', s.paid_minutes)
            from public.shifts s where s.id = v.id);
end;
$$;

-- Chủ sân: trả theo giờ thực tế (ở lại làm thật) hoặc giữ theo khung ca.
create or replace function public.decide_actual_time(p_shift_id uuid, p_decision text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.shifts;
begin
  perform private.require_owner();
  if p_decision is not null and p_decision not in ('approved', 'kept') then
    perform private.raise_error('INVALID_DECISION');
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    perform private.raise_error('REASON_REQUIRED', 'Tối thiểu 3 ký tự');
  end if;
  select * into v from public.shifts where id = p_shift_id and deleted_at is null for update;
  if not found then
    perform private.raise_error('SHIFT_NOT_FOUND');
  end if;
  if v.status <> 'present' then
    perform private.raise_error('SHIFT_NOT_PRESENT');
  end if;
  perform private.set_audit_reason(
    case p_decision when 'approved' then 'Trả theo giờ thực tế: ' when 'kept' then 'Giữ công theo khung ca: '
                    else 'Bỏ quyết định giờ thực tế: ' end || p_reason);
  update public.shifts set actual_time_decision = p_decision where id = v.id;
  return (select jsonb_build_object('shift_id', s.id, 'paid_minutes', s.paid_minutes, 'decision', s.actual_time_decision)
            from public.shifts s where s.id = v.id);
end;
$$;

-- 5. Yêu cầu sửa giờ (nhân viên quên quét) ----------------------------------------------------
create table if not exists public.attendance_fix_requests (
  id            uuid primary key default gen_random_uuid(),
  shift_id      uuid not null references public.shifts (id),
  employee_id   uuid not null references public.employees (id),
  branch_id     uuid not null references public.branches (id),
  kind          text not null constraint att_fix_kind check (kind in ('in', 'out')),
  claimed_at    timestamptz not null,
  recorded_at   timestamptz,
  reason        text not null constraint att_fix_reason check (char_length(btrim(reason)) between 5 and 300),
  status        text not null default 'pending'
                  constraint att_fix_status check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at    timestamptz not null default now(),
  decided_by    uuid references auth.users (id) on delete set null,
  decided_at    timestamptz,
  decision_note text constraint att_fix_note check (decision_note is null or char_length(decision_note) <= 300),
  updated_at    timestamptz not null default now(),
  constraint att_fix_decided check (status in ('pending', 'cancelled') or decided_at is not null)
);
comment on table public.attendance_fix_requests is 'Nhân viên khai giờ vào/ra thật khi quên quét QR; chủ sân duyệt / từ chối. Không xóa.';
create unique index if not exists att_fix_pending_uidx on public.attendance_fix_requests (shift_id, kind) where status = 'pending';
create index if not exists att_fix_status_idx on public.attendance_fix_requests (status, created_at desc);
create index if not exists att_fix_employee_idx on public.attendance_fix_requests (employee_id, created_at desc);

alter table public.attendance_fix_requests enable row level security;
revoke all on public.attendance_fix_requests from anon, authenticated;
grant select on public.attendance_fix_requests to authenticated;
drop policy if exists att_fix_read on public.attendance_fix_requests;
create policy att_fix_read on public.attendance_fix_requests
  for select to authenticated
  using ((select private.is_owner()) or employee_id = (select private.current_employee_id()));
drop trigger if exists touch_att_fix on public.attendance_fix_requests;
create trigger touch_att_fix before update on public.attendance_fix_requests
  for each row execute function private.touch_updated_at();
drop trigger if exists audit_att_fix on public.attendance_fix_requests;
create trigger audit_att_fix after insert or update on public.attendance_fix_requests
  for each row execute function private.audit_row_change('id', 'branch_id');
drop trigger if exists no_delete_att_fix on public.attendance_fix_requests;
create trigger no_delete_att_fix before delete on public.attendance_fix_requests
  for each row execute function private.forbid_hard_delete();

create or replace function public.request_attendance_fix(p_shift_id uuid, p_kind text, p_claimed_at timestamptz, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_emp uuid := private.current_employee_id();
  v public.shifts;
  v_cfg public.attendance_settings := private.att_settings();
  v_ot integer;
  v_id uuid;
begin
  if v_emp is null then
    perform private.raise_error('STAFF_NOT_ALLOWED');
  end if;
  if p_kind not in ('in', 'out') or p_claimed_at is null then
    perform private.raise_error('INVALID_FIX_REQUEST');
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    perform private.raise_error('REASON_REQUIRED', 'Tối thiểu 5 ký tự');
  end if;
  select * into v from public.shifts where id = p_shift_id and deleted_at is null for update;
  if not found or v.employee_id <> v_emp then
    perform private.raise_error('SHIFT_NOT_FOUND');
  end if;
  if v.status not in ('scheduled', 'present') then
    perform private.raise_error('SHIFT_NOT_WORKABLE');
  end if;
  if private.payroll_month_closed(v.work_date) then
    perform private.raise_error('PAYROLL_MONTH_CLOSED');
  end if;
  if v_now > v.scheduled_end + make_interval(hours => v_cfg.fix_request_hours) then
    perform private.raise_error('FIX_REQUEST_TOO_LATE', v_cfg.fix_request_hours::text);
  end if;
  if p_claimed_at > v_now then
    perform private.raise_error('FIX_CLAIM_IN_FUTURE');
  end if;
  v_ot := private.accepted_overtime_minutes(v.id);

  if p_kind = 'in' then
    -- Giờ đến thật: trong khoảng được phép quét vào, và SỚM HƠN giờ đang ghi (nếu đã có).
    if p_claimed_at < v.scheduled_start - interval '60 minutes' or p_claimed_at >= v.scheduled_end
       or (v.checked_in_at is not null and p_claimed_at >= v.checked_in_at)
       or (v.checked_out_at is not null and p_claimed_at >= v.checked_out_at) then
      perform private.raise_error('FIX_CLAIM_OUT_OF_RANGE');
    end if;
  else
    -- Ca còn đang diễn ra và chưa ra ca: quét mã RA CA, không cần yêu cầu.
    if v.checked_out_at is null and v_now < v.scheduled_end then
      perform private.raise_error('FIX_SCAN_INSTEAD');
    end if;
    if v.checked_in_at is null
       and not exists (select 1 from public.attendance_fix_requests r
                        where r.shift_id = v.id and r.kind = 'in' and r.status = 'pending') then
      perform private.raise_error('FIX_NEEDS_CHECKIN');
    end if;
    if (v.checked_in_at is not null and p_claimed_at <= v.checked_in_at)
       or p_claimed_at > v.scheduled_end + interval '4 hours' + make_interval(mins => v_ot)
       or p_claimed_at is not distinct from v.checked_out_at then
      perform private.raise_error('FIX_CLAIM_OUT_OF_RANGE');
    end if;
  end if;

  perform private.set_audit_reason('Yêu cầu sửa giờ ' || case p_kind when 'in' then 'vào' else 'ra' end || ': ' || p_reason);
  insert into public.attendance_fix_requests (shift_id, employee_id, branch_id, kind, claimed_at, recorded_at, reason)
  values (v.id, v.employee_id, v.branch_id, p_kind, p_claimed_at,
          case p_kind when 'in' then v.checked_in_at else v.checked_out_at end, btrim(p_reason))
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'status', 'pending');
exception when unique_violation then
  perform private.raise_error('FIX_ALREADY_PENDING');
  return null;
end;
$$;

create or replace function public.cancel_attendance_fix(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.set_audit_reason('Nhân viên rút yêu cầu sửa giờ');
  update public.attendance_fix_requests
     set status = 'cancelled'
   where id = p_request_id and status = 'pending' and employee_id = private.current_employee_id();
  if not found then
    perform private.raise_error('FIX_NOT_PENDING');
  end if;
end;
$$;

create or replace function public.decide_attendance_fix(p_request_id uuid, p_approve boolean, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.attendance_fix_requests;
  v public.shifts;
  v_ot integer;
  v_in timestamptz;
  v_out timestamptz;
begin
  perform private.require_owner();
  select * into r from public.attendance_fix_requests where id = p_request_id for update;
  if not found or r.status <> 'pending' then
    perform private.raise_error('FIX_NOT_PENDING');
  end if;
  select * into v from public.shifts where id = r.shift_id and deleted_at is null for update;
  if not found then
    perform private.raise_error('SHIFT_NOT_FOUND');
  end if;
  if private.payroll_month_closed(v.work_date) then
    perform private.raise_error('PAYROLL_MONTH_CLOSED');
  end if;
  if not coalesce(p_approve, false) and char_length(btrim(coalesce(p_note, ''))) < 3 then
    perform private.raise_error('REASON_REQUIRED', 'Ghi lý do từ chối');
  end if;

  perform private.set_audit_reason(
    case when p_approve then 'Duyệt' else 'Từ chối' end || ' yêu cầu sửa giờ ' ||
    case r.kind when 'in' then 'vào' else 'ra' end || ': ' || r.reason ||
    coalesce(' — ' || nullif(btrim(p_note), ''), ''));
  update public.attendance_fix_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         decided_by = (select auth.uid()), decided_at = clock_timestamp(), decision_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = r.id;

  if p_approve then
    v_ot := private.accepted_overtime_minutes(v.id);
    v_in := case when r.kind = 'in' then r.claimed_at else v.checked_in_at end;
    v_out := case when r.kind = 'out' then r.claimed_at else v.checked_out_at end;
    if v_in is not null and v_out is not null and v_out <= v_in then
      perform private.raise_error('FIX_CLAIM_OUT_OF_RANGE', 'Giờ ra phải sau giờ vào');
    end if;
    update public.shifts
       set checked_in_at = v_in,
           in_source = case when r.kind = 'in' then 'request' else in_source end,
           checked_out_at = v_out,
           out_source = case when r.kind = 'out' then 'request' else out_source end,
           status = case when v_in is not null and v_out is not null then 'present' else status end,
           actual_break_minutes = case when v_in is not null and v_out is not null and status <> 'present'
                                       then break_minutes else actual_break_minutes end,
           -- Chủ sân duyệt giờ ra muộn hơn khung = đồng ý trả phần nhân viên ở lại làm thật.
           actual_time_decision = case
             when r.kind = 'out' and r.claimed_at > v.scheduled_end + make_interval(mins => v_ot) then 'approved'
             else actual_time_decision end
     where id = v.id;
  end if;
  return (select jsonb_build_object('id', r.id, 'approved', coalesce(p_approve, false), 'paid_minutes', s.paid_minutes)
            from public.shifts s where s.id = v.id);
end;
$$;

-- 6. Tự đóng ca quên ra + đề nghị tăng ca hết hạn -----------------------------------------------
create or replace function private.close_forgotten_shifts()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_cfg public.attendance_settings := private.att_settings();
  v_closed integer := 0;
  v_expired integer := 0;
  v record;
begin
  perform pg_advisory_xact_lock(hashtext('rally.close_forgotten'));
  -- Đề nghị tăng ca chưa trả lời mà khung tăng ca đã qua → hết hạn (không tính giá tăng ca).
  perform private.set_audit_reason('system: đề nghị tăng ca hết hạn — nhân viên chưa trả lời');
  update public.shift_overtime o
     set status = 'cancelled', response_note = coalesce(o.response_note, 'Hết hạn — nhân viên chưa trả lời')
    from public.shifts s
   where s.id = o.shift_id and o.status = 'pending'
     and s.scheduled_end + make_interval(mins => o.minutes) < v_now
     and not private.payroll_month_closed(s.work_date);
  get diagnostics v_expired = row_count;

  if v_cfg.auto_close_forgotten then
    perform private.set_audit_reason('system: tự đóng ca — nhân viên quên quét ra ca');
    for v in
      select s.id, s.checked_in_at, s.scheduled_end, s.break_minutes, private.accepted_overtime_minutes(s.id) as ot
        from public.shifts s
       where s.checked_in_at is not null and s.checked_out_at is null and s.deleted_at is null
         and not private.payroll_month_closed(s.work_date)
         and v_now > s.scheduled_end + interval '4 hours' + make_interval(mins => private.accepted_overtime_minutes(s.id))
       for update of s skip locked
    loop
      update public.shifts
         set checked_out_at = greatest(v.scheduled_end + make_interval(mins => v.ot), v.checked_in_at + interval '1 minute'),
             out_source = 'auto', status = 'present', actual_break_minutes = v.break_minutes
       where id = v.id;
      v_closed := v_closed + 1;
    end loop;
  end if;
  return jsonb_build_object('closed', v_closed, 'expired_offers', v_expired);
end;
$$;

create or replace function public.close_forgotten_shifts()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_owner();
  return private.close_forgotten_shifts();
end;
$$;

create or replace function public.service_close_forgotten_shifts()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_service_role();
  return private.close_forgotten_shifts();
end;
$$;

-- 7. Không chốt lương khi còn yêu cầu sửa giờ chưa xử lý ----------------------------------------
create or replace function private.payroll_periods_check_fixes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pending integer;
begin
  select count(*) into v_pending
    from public.attendance_fix_requests r
    join public.shifts s on s.id = r.shift_id
   where r.status = 'pending' and s.work_date >= new.month and s.work_date < (new.month + interval '1 month')::date;
  if v_pending > 0 then
    raise exception using errcode = 'P0001', message = 'PENDING_ATTENDANCE_FIXES', detail = v_pending::text;
  end if;
  return new;
end;
$$;
drop trigger if exists payroll_periods_check_fixes on public.payroll_periods;
create trigger payroll_periods_check_fixes before insert on public.payroll_periods
  for each row execute function private.payroll_periods_check_fixes();

-- 8. Hàng đợi duyệt của chủ sân -----------------------------------------------------------------
create or replace function public.attendance_review_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cfg public.attendance_settings := private.att_settings();
begin
  perform private.require_owner();
  return jsonb_build_object(
    'pending_fixes', (select count(*) from public.attendance_fix_requests where status = 'pending'),
    'late_outs', (
      select count(*) from public.shifts s
       where s.status = 'present' and s.deleted_at is null and s.out_source = 'qr' and s.actual_time_decision is null
         and s.work_date >= (now() at time zone 'Asia/Ho_Chi_Minh')::date - 45
         and not private.payroll_month_closed(s.work_date)
         and s.checked_out_at > s.scheduled_end
               + make_interval(mins => private.accepted_overtime_minutes(s.id) + v_cfg.late_out_review_minutes)));
end;
$$;

create or replace function public.attendance_review_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cfg public.attendance_settings := private.att_settings();
  v_month date := date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_since date := (now() at time zone 'Asia/Ho_Chi_Minh')::date - 45;
begin
  perform private.require_owner();
  return jsonb_build_object(
    'settings', to_jsonb(v_cfg),
    'fixes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'kind', r.kind, 'claimed_at', r.claimed_at, 'recorded_at', r.recorded_at, 'reason', r.reason,
               'created_at', r.created_at, 'shift_id', s.id, 'scheduled_start', s.scheduled_start,
               'scheduled_end', s.scheduled_end, 'scanned_in_at', s.scanned_in_at, 'scanned_out_at', s.scanned_out_at,
               'employee_id', e.id, 'employee_name', e.full_name, 'employee_code', e.code,
               'branch_name', b.name, 'timezone', b.timezone,
               'month_fixes', (select count(*) from public.attendance_fix_requests x
                                join public.shifts xs on xs.id = x.shift_id
                               where x.employee_id = r.employee_id and x.status = 'approved'
                                 and xs.work_date >= date_trunc('month', s.work_date)::date
                                 and xs.work_date < (date_trunc('month', s.work_date) + interval '1 month')::date))
             order by r.created_at)
        from public.attendance_fix_requests r
        join public.shifts s on s.id = r.shift_id
        join public.employees e on e.id = r.employee_id
        join public.branches b on b.id = r.branch_id
       where r.status = 'pending'), '[]'::jsonb),
    'late_outs', coalesce((
      select jsonb_agg(jsonb_build_object(
               'shift_id', s.id, 'scheduled_start', s.scheduled_start, 'scheduled_end', s.scheduled_end,
               'checked_in_at', s.checked_in_at, 'checked_out_at', s.checked_out_at, 'paid_minutes', s.paid_minutes,
               'overtime_minutes', o.ot, 'employee_name', e.full_name, 'employee_code', e.code,
               'branch_name', b.name, 'timezone', b.timezone)
             order by s.scheduled_start desc)
        from public.shifts s
        cross join lateral (select private.accepted_overtime_minutes(s.id) as ot) o
        join public.employees e on e.id = s.employee_id
        join public.branches b on b.id = s.branch_id
       where s.status = 'present' and s.deleted_at is null and s.out_source = 'qr' and s.actual_time_decision is null
         and s.work_date >= v_since and not private.payroll_month_closed(s.work_date)
         and s.checked_out_at > s.scheduled_end + make_interval(mins => o.ot + v_cfg.late_out_review_minutes)), '[]'::jsonb),
    'auto_closed', coalesce((
      select jsonb_agg(jsonb_build_object(
               'shift_id', s.id, 'scheduled_start', s.scheduled_start, 'scheduled_end', s.scheduled_end,
               'checked_in_at', s.checked_in_at, 'checked_out_at', s.checked_out_at,
               'employee_name', e.full_name, 'employee_code', e.code, 'branch_name', b.name, 'timezone', b.timezone)
             order by s.scheduled_start desc)
        from public.shifts s
        join public.employees e on e.id = s.employee_id
        join public.branches b on b.id = s.branch_id
       where s.out_source = 'auto' and s.deleted_at is null and s.work_date >= (now() at time zone 'Asia/Ho_Chi_Minh')::date - 14),
      '[]'::jsonb),
    'frequent', coalesce((
      select jsonb_agg(jsonb_build_object('employee_id', t.employee_id, 'employee_name', e.full_name,
                                          'employee_code', e.code, 'count', t.n) order by t.n desc)
        from (select r.employee_id, count(*) as n
                from public.attendance_fix_requests r
                join public.shifts s on s.id = r.shift_id
               where r.status = 'approved' and s.work_date >= v_month
               group by r.employee_id
              having count(*) >= v_cfg.forgot_warn_count) t
        join public.employees e on e.id = t.employee_id), '[]'::jsonb));
end;
$$;

-- 9. Tổng quan tháng của nhân viên: ân hạn theo cài đặt + số lần quên chấm công ----------------
create or replace function public.my_month_summary(p_month date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_emp uuid := private.current_employee_id();
  v_next date;
  v_result jsonb;
  v_cfg public.attendance_settings := private.att_settings();
  v_grace interval;
begin
  if v_emp is null then
    perform private.raise_error('STAFF_NOT_ALLOWED');
  end if;
  if p_month is null or p_month <> date_trunc('month', p_month)::date then
    perform private.raise_error('INVALID_MONTH');
  end if;
  v_next := (p_month + interval '1 month')::date;
  v_grace := make_interval(mins => v_cfg.late_grace_minutes);
  with s as (
    select sh.*, r.pay_type, r.hourly_rate, r.daily_rate, r.standard_day_minutes, r.id as rate_id,
           o.minutes as ot_approved, o.hourly_rate as ot_rate,
           private.overtime_worked_minutes(sh.checked_in_at, sh.checked_out_at, sh.scheduled_end, o.minutes, sh.paid_minutes) as ot
      from public.shifts sh
      left join lateral (
        select pr.* from public.employee_pay_rates pr
         where pr.employee_id = sh.employee_id and pr.effective_from <= sh.work_date
         order by pr.effective_from desc limit 1) r on true
      left join lateral (
        select ov.minutes, ov.hourly_rate from public.shift_overtime ov
         where ov.shift_id = sh.id and ov.status = 'accepted' limit 1) o on true
     where sh.employee_id = v_emp and sh.work_date >= p_month and sh.work_date < v_next and sh.deleted_at is null
  ), calc as (
    select
      count(*) filter (where status = 'present') as shifts_done,
      count(*) filter (where status = 'scheduled' and scheduled_start > now()) as shifts_upcoming,
      coalesce(sum(extract(epoch from (scheduled_end - scheduled_start)) / 60 - break_minutes)
               filter (where status = 'scheduled' and scheduled_start > now()), 0)::integer as upcoming_minutes,
      count(*) filter (where status = 'absent') as absent_count,
      count(*) filter (where status = 'leave') as leave_count,
      coalesce(sum(paid_minutes), 0)::integer as paid_minutes,
      count(*) filter (where checked_in_at > scheduled_start + v_grace) as late_count,
      coalesce(sum(greatest(0, floor(extract(epoch from (checked_in_at - scheduled_start)) / 60)))
               filter (where checked_in_at > scheduled_start + v_grace), 0)::integer as late_minutes,
      count(*) filter (where out_source = 'auto') as forgot_checkout_count,
      count(*) filter (where status = 'present' and ot > 0) as overtime_count,
      coalesce(sum(ot) filter (where status = 'present'), 0)::integer as overtime_minutes,
      coalesce(sum(round(coalesce(ot_rate, 0)::numeric * ot / 60)) filter (where status = 'present'), 0)::bigint as overtime_pay,
      coalesce(sum(case
        when status <> 'present' or rate_id is null then 0
        when pay_type = 'hourly' then round(hourly_rate::numeric * (paid_minutes - ot) / 60)
        else round(daily_rate::numeric * (paid_minutes - ot) / standard_day_minutes) end), 0)::bigint as regular_pay,
      count(*) filter (where status = 'present' and rate_id is null) as missing_rate
    from s
  ), fixes as (
    select count(*) filter (where r.status = 'approved') as forgot_count,
           count(*) filter (where r.status = 'pending') as pending_fixes
      from public.attendance_fix_requests r
      join public.shifts sh on sh.id = r.shift_id
     where r.employee_id = v_emp and sh.work_date >= p_month and sh.work_date < v_next
  ), adj as (
    select coalesce(sum(amount) filter (where amount > 0), 0)::bigint as bonus,
           coalesce(-sum(amount) filter (where amount < 0), 0)::bigint as penalty,
           coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'amount', a.amount, 'reason', a.reason, 'created_at', a.created_at)
                              order by a.created_at desc), '[]'::jsonb) as items
      from public.payroll_adjustments a
     where a.employee_id = v_emp and a.month = p_month and a.voided_at is null
  )
  select jsonb_build_object(
           'month', p_month,
           'closed', private.payroll_month_closed(p_month),
           'shifts_done', c.shifts_done, 'shifts_upcoming', c.shifts_upcoming, 'upcoming_minutes', c.upcoming_minutes,
           'absent_count', c.absent_count, 'leave_count', c.leave_count,
           'paid_minutes', c.paid_minutes, 'late_count', c.late_count, 'late_minutes', c.late_minutes,
           'late_grace_minutes', v_cfg.late_grace_minutes,
           'forgot_count', f.forgot_count, 'pending_fixes', f.pending_fixes,
           'forgot_checkout_count', c.forgot_checkout_count,
           'overtime_count', c.overtime_count, 'overtime_minutes', c.overtime_minutes, 'overtime_pay', c.overtime_pay,
           'regular_pay', c.regular_pay, 'bonus', a.bonus, 'penalty', a.penalty,
           'net_pay', c.regular_pay + c.overtime_pay + a.bonus - a.penalty,
           'missing_rate', c.missing_rate, 'adjustments', a.items,
           'pending_overtime', (select count(*) from public.shift_overtime ov join public.shifts sh on sh.id = ov.shift_id
                                 where ov.employee_id = v_emp and ov.status = 'pending'
                                   and sh.scheduled_end + make_interval(mins => ov.minutes) > now()))
    into v_result
    from calc c cross join adj a cross join fixes f;
  return v_result;
end;
$$;

-- 10. Mã QR: nhiều màn hình cùng lúc, thời gian sống theo cài đặt -------------------------------
alter table public.attendance_qr_tokens alter column created_by drop not null;
alter table public.attendance_qr_tokens add column if not exists kiosk_id uuid;

create or replace function private.issue_qr_token(p_branch_id uuid, p_token_hash text, p_by uuid, p_kiosk uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expires timestamptz;
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    perform private.raise_error('INVALID_QR_HASH');
  end if;
  if not exists (select 1 from public.branches where id = p_branch_id and deleted_at is null) then
    perform private.raise_error('BRANCH_NOT_FOUND');
  end if;
  perform pg_advisory_xact_lock(hashtext('rally.qr'), hashtext(p_branch_id::text));
  -- Chỉ dọn mã đã hết hạn (trước đây xóa mọi mã của chi nhánh → màn hình thứ hai làm hỏng màn hình thứ nhất).
  delete from public.attendance_qr_tokens where expires_at < clock_timestamp();
  -- Chặn tạo ồ ạt: tối đa 30 mã còn hiệu lực mỗi chi nhánh, bỏ mã cũ nhất.
  delete from public.attendance_qr_tokens
   where token_hash in (select token_hash from public.attendance_qr_tokens where branch_id = p_branch_id
                         order by created_at desc offset 29);
  v_expires := clock_timestamp() + make_interval(secs => (private.att_settings()).qr_ttl_seconds);
  insert into public.attendance_qr_tokens (token_hash, branch_id, expires_at, created_by, kiosk_id)
  values (p_token_hash, p_branch_id, v_expires, p_by, p_kiosk);
  return v_expires;
end;
$$;

create or replace function public.issue_attendance_qr(p_branch_id uuid, p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_owner();
  return jsonb_build_object('expires_at', private.issue_qr_token(p_branch_id, p_token_hash, (select auth.uid()), null));
end;
$$;

-- 11. Máy quầy: link riêng chỉ hiện mã QR, không cần đăng nhập chủ sân ---------------------------
create table if not exists public.attendance_kiosks (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid not null references public.branches (id),
  name         text not null constraint attendance_kiosk_name check (char_length(btrim(name)) between 2 and 60),
  token_hash   text not null unique constraint attendance_kiosk_hash check (token_hash ~ '^[a-f0-9]{64}$'),
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at   timestamptz,
  updated_at   timestamptz not null default now()
);
comment on table public.attendance_kiosks is 'Máy quầy hiện mã QR chấm công. Chỉ lưu SHA-256 của khóa thiết bị; thu hồi bất cứ lúc nào.';
alter table public.attendance_kiosks enable row level security;
revoke all on public.attendance_kiosks from anon, authenticated;
grant select (id, branch_id, name, created_at, last_seen_at, revoked_at) on public.attendance_kiosks to authenticated;
drop policy if exists attendance_kiosks_read on public.attendance_kiosks;
create policy attendance_kiosks_read on public.attendance_kiosks for select to authenticated using ((select private.is_owner()));
drop trigger if exists touch_attendance_kiosks on public.attendance_kiosks;
create trigger touch_attendance_kiosks before update on public.attendance_kiosks
  for each row execute function private.touch_updated_at();
drop trigger if exists audit_attendance_kiosks on public.attendance_kiosks;
create trigger audit_attendance_kiosks after insert or update of name, revoked_at on public.attendance_kiosks
  for each row execute function private.audit_row_change('id', 'branch_id');
drop trigger if exists no_delete_attendance_kiosks on public.attendance_kiosks;
create trigger no_delete_attendance_kiosks before delete on public.attendance_kiosks
  for each row execute function private.forbid_hard_delete();

create or replace function public.create_attendance_kiosk(p_branch_id uuid, p_name text, p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require_owner();
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    perform private.raise_error('INVALID_QR_HASH');
  end if;
  if not exists (select 1 from public.branches where id = p_branch_id and deleted_at is null) then
    perform private.raise_error('BRANCH_NOT_FOUND');
  end if;
  perform private.set_audit_reason('Thêm máy quầy chấm công');
  insert into public.attendance_kiosks (branch_id, name, token_hash, created_by)
  values (p_branch_id, btrim(p_name), p_token_hash, (select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.revoke_attendance_kiosk(p_kiosk_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_owner();
  perform private.set_audit_reason('Thu hồi máy quầy chấm công');
  update public.attendance_kiosks set revoked_at = now() where id = p_kiosk_id and revoked_at is null;
  delete from public.attendance_qr_tokens where kiosk_id = p_kiosk_id;
end;
$$;

-- Gọi từ trang /kiosk/<khóa> (không đăng nhập). Khóa thiết bị 48 ký tự hex, chỉ so mã băm.
create or replace function public.kiosk_issue_qr(p_device_token text, p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  k public.attendance_kiosks;
  v_expires timestamptz;
begin
  if p_device_token is null or p_device_token !~ '^[0-9a-f]{48}$' then
    perform private.raise_error('KIOSK_INVALID');
  end if;
  select * into k from public.attendance_kiosks
   where token_hash = encode(sha256(convert_to(p_device_token, 'UTF8')), 'hex') and revoked_at is null;
  if not found then
    perform private.raise_error('KIOSK_INVALID');
  end if;
  v_expires := private.issue_qr_token(k.branch_id, p_token_hash, null, k.id);
  update public.attendance_kiosks set last_seen_at = now() where id = k.id
     and (last_seen_at is null or last_seen_at < now() - interval '5 minutes');
  return jsonb_build_object('expires_at', v_expires, 'branch_name', (select name from public.branches where id = k.branch_id),
                            'kiosk_name', k.name);
end;
$$;

-- 12. Quyền gọi hàm ----------------------------------------------------------------------------
revoke all on function private.att_settings() from public, anon, authenticated;
revoke all on function private.close_forgotten_shifts() from public, anon, authenticated;
revoke all on function private.issue_qr_token(uuid, text, uuid, uuid) from public, anon, authenticated;

revoke all on function public.update_attendance_settings(integer, integer, integer, integer, integer, boolean) from public, anon;
revoke all on function public.scan_attendance_qr(text, text) from public, anon;
revoke all on function public.owner_adjust_attendance(uuid, public.attendance_status, text, timestamptz, timestamptz, integer) from public, anon;
revoke all on function public.decide_actual_time(uuid, text, text) from public, anon;
revoke all on function public.request_attendance_fix(uuid, text, timestamptz, text) from public, anon;
revoke all on function public.cancel_attendance_fix(uuid) from public, anon;
revoke all on function public.decide_attendance_fix(uuid, boolean, text) from public, anon;
revoke all on function public.close_forgotten_shifts() from public, anon;
revoke all on function public.service_close_forgotten_shifts() from public, anon, authenticated;
revoke all on function public.attendance_review_counts() from public, anon;
revoke all on function public.attendance_review_queue() from public, anon;
revoke all on function public.my_month_summary(date) from public, anon;
revoke all on function public.issue_attendance_qr(uuid, text) from public, anon;
revoke all on function public.create_attendance_kiosk(uuid, text, text) from public, anon;
revoke all on function public.revoke_attendance_kiosk(uuid) from public, anon;
revoke all on function public.kiosk_issue_qr(text, text) from public;

grant execute on function public.update_attendance_settings(integer, integer, integer, integer, integer, boolean) to authenticated;
grant execute on function public.scan_attendance_qr(text, text) to authenticated;
grant execute on function public.owner_adjust_attendance(uuid, public.attendance_status, text, timestamptz, timestamptz, integer) to authenticated;
grant execute on function public.decide_actual_time(uuid, text, text) to authenticated;
grant execute on function public.request_attendance_fix(uuid, text, timestamptz, text) to authenticated;
grant execute on function public.cancel_attendance_fix(uuid) to authenticated;
grant execute on function public.decide_attendance_fix(uuid, boolean, text) to authenticated;
grant execute on function public.close_forgotten_shifts() to authenticated;
grant execute on function public.service_close_forgotten_shifts() to service_role;
grant execute on function public.attendance_review_counts() to authenticated;
grant execute on function public.attendance_review_queue() to authenticated;
grant execute on function public.my_month_summary(date) to authenticated;
grant execute on function public.issue_attendance_qr(uuid, text) to authenticated;
grant execute on function public.create_attendance_kiosk(uuid, text, text) to authenticated;
grant execute on function public.revoke_attendance_kiosk(uuid) to authenticated;
grant execute on function public.kiosk_issue_qr(text, text) to anon, authenticated;

commit;
