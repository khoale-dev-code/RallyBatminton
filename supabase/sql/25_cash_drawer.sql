-- =============================================================================
-- RALLY BADMINTON — 25_cash_drawer.sql
-- Nhật ký mở ngăn kéo tiền (Rally Manager cho Windows).
--
-- Chạy SAU 00 → 24. Chạy lại an toàn.
--
--   * Mỗi lần ngăn kéo được mở từ Rally Manager (sau khi thu tiền mặt, hoặc nhân viên bấm "Mở ngăn kéo")
--     → một dòng: ai, chi nhánh nào, lúc nào, vì sao (mã đơn), máy nào.
--   * Mở tay ("manual") phải ghi nhật ký THÀNH CÔNG thì ứng dụng mới mở ngăn kéo.
--   * Chỉ thêm, không sửa / xóa (cả chủ sân). Hiện trong Nhật ký thay đổi (mục "Mở ngăn kéo tiền").
--   * Ai mở được: chủ sân, hoặc nhân viên có quyền bán hàng / ghi nhận tiền / cho thuê ở chi nhánh đó.
--   * Mở tay tối đa 30 lần / giờ / người (chống bấm thử liên tục).
-- =============================================================================

begin;

create table if not exists public.cash_drawer_events (
  id            bigint generated always as identity primary key,
  occurred_at   timestamptz not null default now(),
  branch_id     uuid not null references public.branches (id),
  user_id       uuid references auth.users (id) on delete set null,
  trigger       text not null
                  constraint cash_drawer_trigger check (trigger in ('sale', 'booking_payment', 'rental', 'manual')),
  ref_code      text constraint cash_drawer_ref_len check (ref_code is null or char_length(ref_code) <= 40),
  device_label  text constraint cash_drawer_device_len check (device_label is null or char_length(device_label) <= 120)
);
create index if not exists cash_drawer_events_branch_idx on public.cash_drawer_events (branch_id, occurred_at desc);
create index if not exists cash_drawer_events_user_idx on public.cash_drawer_events (user_id, occurred_at desc);
comment on table public.cash_drawer_events is 'Nhật ký mở ngăn kéo tiền từ Rally Manager (chỉ thêm).';

alter table public.cash_drawer_events enable row level security;
drop policy if exists cash_drawer_events_read on public.cash_drawer_events;
create policy cash_drawer_events_read on public.cash_drawer_events for select to authenticated
  using ((select private.is_owner()) or user_id = (select auth.uid()));

-- Chỉ thêm: không ai sửa / xóa (kể cả qua quyền service).
create or replace function private.cash_drawer_events_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = 'APPEND_ONLY_TABLE',
    detail = 'public.cash_drawer_events không cho phép sửa / xóa.';
end;
$$;
drop trigger if exists cash_drawer_events_append_only on public.cash_drawer_events;
create trigger cash_drawer_events_append_only before update or delete on public.cash_drawer_events
  for each row execute function private.cash_drawer_events_guard();

-- Hiện trong Nhật ký thay đổi chung.
drop trigger if exists cash_drawer_events_audit on public.cash_drawer_events;
create trigger cash_drawer_events_audit after insert on public.cash_drawer_events
  for each row execute function private.audit_row_change('id', 'branch_id');

create or replace function public.log_cash_drawer_open(p_branch_id uuid, p_trigger text, p_ref_code text default null, p_device text default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id bigint;
begin
  if v_uid is null then
    perform private.raise_error('AUTH_REQUIRED');
  end if;
  if p_trigger is null or p_trigger not in ('sale', 'booking_payment', 'rental', 'manual') then
    perform private.raise_error('INVALID_INPUT', 'trigger');
  end if;
  if not (private.staff_can(p_branch_id, 'sale.record')
          or private.staff_can(p_branch_id, 'payment.record')
          or private.staff_can(p_branch_id, 'rental.operate')) then
    perform private.raise_error('PERMISSION_DENIED', 'cash_drawer');
  end if;
  if p_trigger = 'manual' and (
       select count(*) from public.cash_drawer_events
        where user_id = v_uid and trigger = 'manual' and occurred_at > now() - interval '1 hour') >= 30 then
    perform private.raise_error('DRAWER_RATE_LIMIT');
  end if;
  insert into public.cash_drawer_events (branch_id, user_id, trigger, ref_code, device_label)
  values (p_branch_id, v_uid, p_trigger,
          nullif(left(btrim(coalesce(p_ref_code, '')), 40), ''),
          nullif(left(btrim(coalesce(p_device, '')), 120), ''))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on public.cash_drawer_events from anon, authenticated;
grant select on public.cash_drawer_events to authenticated;
revoke all on function private.cash_drawer_events_guard() from public, anon, authenticated;
revoke all on function public.log_cash_drawer_open(uuid, text, text, text) from public, anon;
grant execute on function public.log_cash_drawer_open(uuid, text, text, text) to authenticated;

commit;

-- Kiểm tra nhanh: select * from public.cash_drawer_events order by occurred_at desc limit 20;
