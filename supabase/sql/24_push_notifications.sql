-- =============================================================================
-- RALLY BADMINTON — 24_push_notifications.sql
-- Thông báo đẩy cho Rally Manager (ứng dụng quản trị đã cài trên máy quầy / điện thoại).
--
-- Chạy SAU 00 → 23. Chạy lại an toàn.
--
--   * push_subscriptions: thiết bị đã bật thông báo (mỗi trình duyệt / ứng dụng một dòng). Chỉ chấp nhận địa chỉ của
--     dịch vụ đẩy chính thức (Google, Mozilla, Apple, Microsoft) — máy chủ không bao giờ gửi tới địa chỉ lạ.
--   * push_preferences: mỗi người chọn loại thông báo muốn nhận.
--   * private.push_outbox: hàng đợi; trigger trên bookings / bank_transactions / security_events thêm việc,
--     máy chủ web gửi đi (web-push) rồi đánh dấu xong. Lỗi gửi không bao giờ làm hỏng giao dịch gốc.
--   * Người nhận theo quyền: chủ sân nhận mọi chi nhánh; nhân viên nhận chi nhánh mình có quyền xem đặt sân /
--     ghi nhận tiền; cảnh báo bảo mật chỉ chủ sân.
--   * Nội dung KHÔNG có tên / số điện thoại khách (thông báo hiện trên màn hình khóa).
-- =============================================================================

begin;

-- 1. Thiết bị nhận thông báo --------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  endpoint      text not null constraint push_sub_endpoint_key unique
                  constraint push_sub_endpoint_fmt check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh        text not null constraint push_sub_p256dh_len check (char_length(p256dh) between 40 and 200),
  auth_secret   text not null constraint push_sub_auth_len check (char_length(auth_secret) between 10 and 100),
  device_label  text constraint push_sub_label_len check (device_label is null or char_length(device_label) <= 120),
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  last_sent_at  timestamptz,
  failed_count  integer not null default 0,
  last_error    text constraint push_sub_error_len check (last_error is null or char_length(last_error) <= 300),
  disabled_at   timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id) where disabled_at is null;
comment on table public.push_subscriptions is 'Thiết bị đã bật thông báo đẩy của Rally Manager (chỉ tài khoản quản trị).';

alter table public.push_subscriptions enable row level security;
drop policy if exists push_subscriptions_own_read on public.push_subscriptions;
create policy push_subscriptions_own_read on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

-- Chỉ địa chỉ của dịch vụ đẩy chính thức (chống dùng máy chủ Rally gửi yêu cầu tới địa chỉ tùy ý).
create or replace function private.push_endpoint_allowed(p_endpoint text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_endpoint ~* ('^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|'
                                 || '[a-z0-9.-]*push\.apple\.com|[a-z0-9.-]*\.notify\.windows\.com)/'), false);
$$;

-- 2. Lựa chọn loại thông báo ------------------------------------------------------------------------------
create table if not exists public.push_preferences (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  booking_new     boolean not null default true,
  deposit_paid    boolean not null default true,
  payment_review  boolean not null default true,
  security        boolean not null default true,
  updated_at      timestamptz not null default now()
);
alter table public.push_preferences enable row level security;
drop policy if exists push_preferences_own_read on public.push_preferences;
create policy push_preferences_own_read on public.push_preferences for select to authenticated
  using (user_id = (select auth.uid()));

-- 3. Hàng đợi ------------------------------------------------------------------------------------------
create table if not exists private.push_outbox (
  id           bigint generated always as identity primary key,
  kind         text not null constraint push_outbox_kind check (kind in ('booking_new', 'deposit_paid', 'payment_review', 'security', 'test')),
  branch_id    uuid,
  target_user  uuid,
  title        text not null,
  body         text not null,
  url          text not null,
  tag          text,
  created_at   timestamptz not null default now(),
  claimed_at   timestamptz,
  sent_at      timestamptz,
  sent_count   integer not null default 0
);
create index if not exists push_outbox_pending_idx on private.push_outbox (created_at) where sent_at is null;
revoke all on private.push_outbox from public, anon, authenticated;

-- Người có quyền nhận thông báo loại này ở chi nhánh này (cùng điều kiện với permitted_branch_ids, theo user_id).
create or replace function private.push_user_allowed(p_user uuid, p_kind text, p_branch uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.staff_accounts sa
      left join public.employees e on e.id = sa.employee_id
     where sa.user_id = p_user and sa.is_active
       and (sa.role = 'owner' or (not sa.must_change_password and e.status = 'active'))
       and (
         sa.role = 'owner'
         or (p_kind in ('booking_new', 'deposit_paid') and p_branch is not null and exists (
               select 1 from public.staff_branch_permissions p
                where p.user_id = p_user and p.branch_id = p_branch and p.permission = 'booking.view'))
         or (p_kind = 'payment_review' and p_branch is not null and exists (
               select 1 from public.staff_branch_permissions p
                where p.user_id = p_user and p.branch_id = p_branch and p.permission = 'payment.record'))
       )
  );
$$;

create or replace function private.push_enqueue(
  p_kind text, p_branch uuid, p_title text, p_body text, p_url text, p_tag text, p_target uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Chưa có thiết bị nào bật thông báo → không xếp hàng (đỡ tốn chỗ).
  if not exists (select 1 from public.push_subscriptions s where s.disabled_at is null) then
    return;
  end if;
  insert into private.push_outbox (kind, branch_id, target_user, title, body, url, tag)
  values (p_kind, p_branch, p_target, left(p_title, 120), left(p_body, 240), left(p_url, 300), left(p_tag, 120));
exception when others then
  raise warning 'push enqueue failed: %', sqlerrm;  -- không làm hỏng giao dịch gốc
end;
$$;

-- "Sân 3 · 19:00 24/10 · RB-ABC123"
create or replace function private.push_booking_line(p_booking public.bookings)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select concat_ws(' · ',
           (select c.name from public.courts c where c.id = p_booking.court_id),
           to_char(lower(p_booking.during) at time zone coalesce(b.timezone, 'Asia/Ho_Chi_Minh'), 'HH24:MI DD/MM'),
           p_booking.code)
    from public.branches b where b.id = p_booking.branch_id;
$$;

-- 4. Trigger tạo thông báo ------------------------------------------------------------------------------
create or replace function private.push_on_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch text;
  v_date text;
begin
  if new.kind <> 'customer' or new.source <> 'online' then
    return null;
  end if;
  select b.name, to_char(lower(new.during) at time zone b.timezone, 'YYYY-MM-DD') into v_branch, v_date
    from public.branches b where b.id = new.branch_id;
  if tg_op = 'INSERT' and new.status = 'held' then
    perform private.push_enqueue('booking_new', new.branch_id, 'Đơn online mới · ' || coalesce(v_branch, 'Rally'),
      private.push_booking_line(new) || ' — chờ khách chuyển cọc',
      '/admin/go?to=bookings&branch=' || new.branch_id || '&date=' || v_date, 'booking-' || new.id);
  elsif tg_op = 'UPDATE' and old.status = 'held' and new.status = 'confirmed' then
    perform private.push_enqueue('deposit_paid', new.branch_id, 'Đã nhận cọc · ' || coalesce(v_branch, 'Rally'),
      private.push_booking_line(new) || ' — đơn đã xác nhận',
      '/admin/go?to=bookings&branch=' || new.branch_id || '&date=' || v_date, 'booking-' || new.id);
  end if;
  return null;
exception when others then
  raise warning 'push trigger failed: %', sqlerrm;
  return null;
end;
$$;
drop trigger if exists bookings_push on public.bookings;
create trigger bookings_push after insert or update of status on public.bookings
  for each row execute function private.push_on_booking();

create or replace function private.push_on_bank_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch uuid;
begin
  if new.transfer_type <> 'in' or new.status not in ('review', 'unmatched')
     or (tg_op = 'UPDATE' and old.status is not distinct from new.status) then
    return null;
  end if;
  v_branch := coalesce(new.branch_id, (select b.branch_id from public.bookings b where b.id = new.booking_id));
  perform private.push_enqueue('payment_review', v_branch,
    case when new.status = 'review' then 'Giao dịch cần xử lý' else 'Tiền vào không khớp đơn' end,
    replace(to_char(new.amount, 'FM999,999,999,999'), ',', '.') || ' đ'
      || coalesce(' — ' || left(new.status_note, 140), ' — mở Giao dịch ngân hàng để xử lý'),
    '/admin/go?to=bank' || coalesce('&branch=' || v_branch, ''), 'bank-' || new.id);
  return null;
exception when others then
  raise warning 'push trigger failed: %', sqlerrm;
  return null;
end;
$$;
drop trigger if exists bank_transactions_push on public.bank_transactions;
create trigger bank_transactions_push after insert or update of status on public.bank_transactions
  for each row execute function private.push_on_bank_transaction();

create or replace function private.push_on_security_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.severity not in ('warning', 'critical')
     or (tg_op = 'UPDATE' and (old.severity = 'critical' or new.severity <> 'critical')) then
    return null;
  end if;
  perform private.push_enqueue('security', null,
    case when new.severity = 'critical' then 'Cảnh báo bảo mật KHẨN' else 'Cảnh báo bảo mật' end,
    case new.kind
      when 'booking_branch_cap' then 'Chi nhánh chạm giới hạn lượt giữ chưa thanh toán'
      when 'booking_abuse_client' then 'Một thiết bị giữ sân quá nhiều'
      when 'booking_abuse_phone' then 'Số điện thoại giữ rồi bỏ nhiều lần — đã tạm chặn'
      when 'login_locked' then 'Tài khoản bị khóa do sai mật khẩu nhiều lần'
      when 'login_spray' then 'Dò mật khẩu hàng loạt từ một mạng'
      when 'webhook_rejected' then 'Thông báo thanh toán sai khóa bị từ chối'
      when 'mfa_change' then 'Thay đổi xác thực 2 lớp'
      when 'security_setting' then 'Thay đổi cài đặt bảo mật'
      else 'Sự kiện an ninh mới' end || coalesce(': ' || left(new.subject, 80), ''),
    '/admin/go?to=security', 'security-' || new.id);
  return null;
exception when others then
  raise warning 'push trigger failed: %', sqlerrm;
  return null;
end;
$$;
drop trigger if exists security_events_push on public.security_events;
create trigger security_events_push after insert or update of severity on public.security_events
  for each row execute function private.push_on_security_event();

-- 5. RPC cho người dùng (tài khoản quản trị đang đăng nhập) ---------------------------------------------
create or replace function public.register_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_label text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null or not exists (select 1 from public.staff_accounts sa where sa.user_id = v_uid and sa.is_active) then
    perform private.raise_error('PERMISSION_DENIED');
  end if;
  if not private.push_endpoint_allowed(p_endpoint) then
    perform private.raise_error('PUSH_ENDPOINT_NOT_ALLOWED');
  end if;
  -- Cùng thiết bị, người khác đăng nhập (máy quầy dùng chung) → thiết bị chuyển sang người đang đăng nhập.
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_secret, device_label)
  values (v_uid, p_endpoint, p_p256dh, p_auth, nullif(left(btrim(coalesce(p_label, '')), 120), ''))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth_secret = excluded.auth_secret,
        device_label = coalesce(excluded.device_label, public.push_subscriptions.device_label),
        last_seen_at = now(), failed_count = 0, last_error = null, disabled_at = null
  returning id into v_id;
  insert into public.push_preferences (user_id) values (v_uid) on conflict (user_id) do nothing;
  return v_id;
end;
$$;

-- Tắt thông báo trên thiết bị này (hoặc khi đăng xuất khỏi máy dùng chung).
create or replace function public.unregister_push_subscription(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    perform private.raise_error('AUTH_REQUIRED');
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = (select auth.uid());
end;
$$;

create or replace function public.save_push_preferences(p_booking_new boolean, p_deposit_paid boolean, p_payment_review boolean, p_security boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not exists (select 1 from public.staff_accounts sa where sa.user_id = v_uid and sa.is_active) then
    perform private.raise_error('PERMISSION_DENIED');
  end if;
  insert into public.push_preferences (user_id, booking_new, deposit_paid, payment_review, security, updated_at)
  values (v_uid, p_booking_new, p_deposit_paid, p_payment_review, p_security, now())
  on conflict (user_id) do update
    set booking_new = excluded.booking_new, deposit_paid = excluded.deposit_paid,
        payment_review = excluded.payment_review, security = excluded.security, updated_at = now();
end;
$$;

-- Gửi thử tới mọi thiết bị của chính mình.
create or replace function public.send_test_push()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_count integer;
begin
  if v_uid is null or not exists (select 1 from public.staff_accounts sa where sa.user_id = v_uid and sa.is_active) then
    perform private.raise_error('PERMISSION_DENIED');
  end if;
  select count(*) into v_count from public.push_subscriptions s where s.user_id = v_uid and s.disabled_at is null;
  if v_count = 0 then
    perform private.raise_error('PUSH_NOT_ENABLED');
  end if;
  insert into private.push_outbox (kind, target_user, title, body, url, tag)
  values ('test', v_uid, 'Rally Manager', 'Thông báo thử — thiết bị này đã nhận được thông báo.', '/admin/app', 'test-' || v_uid);
  return v_count;
end;
$$;

-- 6. Hàm cho máy chủ gửi thông báo (service_role) ------------------------------------------------------------
-- Nhận tối đa N việc chưa gửi (khóa 2 phút để hai tiến trình không gửi trùng) kèm danh sách thiết bị nhận.
create or replace function public.service_claim_push(p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids bigint[];
begin
  perform private.require_service_role();
  select array_agg(id) into v_ids from (
    select o.id from private.push_outbox o
     where o.sent_at is null and o.created_at > now() - interval '1 day'
       and (o.claimed_at is null or o.claimed_at < now() - interval '2 minutes')
     order by o.created_at
     limit least(greatest(coalesce(p_limit, 20), 1), 100)
     for update skip locked) q;
  if v_ids is null then
    return '[]'::jsonb;
  end if;
  update private.push_outbox set claimed_at = now() where id = any (v_ids);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', o.id, 'kind', o.kind, 'title', o.title, 'body', o.body, 'url', o.url, 'tag', o.tag,
             'targets', coalesce((
               select jsonb_agg(jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth_secret))
                 from public.push_subscriptions s
                 left join public.push_preferences pr on pr.user_id = s.user_id
                where s.disabled_at is null
                  and private.push_endpoint_allowed(s.endpoint)
                  and case when o.kind = 'test' then s.user_id = o.target_user
                           else private.push_user_allowed(s.user_id, o.kind, o.branch_id)
                                and case o.kind
                                      when 'booking_new' then coalesce(pr.booking_new, true)
                                      when 'deposit_paid' then coalesce(pr.deposit_paid, true)
                                      when 'payment_review' then coalesce(pr.payment_review, true)
                                      when 'security' then coalesce(pr.security, true)
                                      else false end end), '[]'::jsonb))
           order by o.id)
      from private.push_outbox o where o.id = any (v_ids)), '[]'::jsonb);
end;
$$;

-- Kết quả gửi: p_results = [{ "subscription_id": uuid, "status": 201 | 404 | 410 | …, "error": text }]
create or replace function public.service_push_done(p_outbox_ids bigint[], p_results jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb;
  v_status integer;
begin
  perform private.require_service_role();
  for r in select * from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) loop
    v_status := coalesce((r ->> 'status')::integer, 0);
    if v_status between 200 and 299 then
      update public.push_subscriptions set last_sent_at = now(), failed_count = 0, last_error = null
       where id = (r ->> 'subscription_id')::uuid;
    else
      -- 404 / 410: thiết bị đã gỡ ứng dụng / tắt thông báo → ngừng gửi. Lỗi khác: tắt sau 5 lần liên tiếp.
      update public.push_subscriptions
         set failed_count = failed_count + 1,
             last_error = left(coalesce(r ->> 'error', 'HTTP ' || v_status), 300),
             disabled_at = case when v_status in (404, 410) or failed_count + 1 >= 5 then now() else disabled_at end
       where id = (r ->> 'subscription_id')::uuid;
    end if;
  end loop;
  update private.push_outbox o
     set sent_at = now(),
         sent_count = (select count(*) from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) x
                        where (x ->> 'status')::integer between 200 and 299)
   where o.id = any (p_outbox_ids);
end;
$$;

-- Hằng đêm: xóa hàng đợi cũ, thiết bị đã tắt lâu / không dùng lâu.
create or replace function public.service_push_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_outbox integer;
  v_subs integer;
begin
  perform private.require_service_role();
  delete from private.push_outbox where created_at < now() - interval '3 days';
  get diagnostics v_outbox = row_count;
  delete from public.push_subscriptions
   where (disabled_at is not null and disabled_at < now() - interval '30 days')
      or last_seen_at < now() - interval '180 days';
  get diagnostics v_subs = row_count;
  return jsonb_build_object('outbox', v_outbox, 'subscriptions', v_subs);
end;
$$;

-- 7. Quyền ----------------------------------------------------------------------------------------------
revoke all on public.push_subscriptions, public.push_preferences from anon, authenticated;
grant select on public.push_subscriptions, public.push_preferences to authenticated;

revoke all on function private.push_endpoint_allowed(text) from public, anon, authenticated;
revoke all on function private.push_user_allowed(uuid, text, uuid) from public, anon, authenticated;
revoke all on function private.push_enqueue(text, uuid, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function private.push_booking_line(public.bookings) from public, anon, authenticated;
revoke all on function private.push_on_booking() from public, anon, authenticated;
revoke all on function private.push_on_bank_transaction() from public, anon, authenticated;
revoke all on function private.push_on_security_event() from public, anon, authenticated;

revoke all on function public.register_push_subscription(text, text, text, text) from public, anon;
revoke all on function public.unregister_push_subscription(text) from public, anon;
revoke all on function public.save_push_preferences(boolean, boolean, boolean, boolean) from public, anon;
revoke all on function public.send_test_push() from public, anon;
revoke all on function public.service_claim_push(integer) from public, anon, authenticated;
revoke all on function public.service_push_done(bigint[], jsonb) from public, anon, authenticated;
revoke all on function public.service_push_maintenance() from public, anon, authenticated;

grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.unregister_push_subscription(text) to authenticated;
grant execute on function public.save_push_preferences(boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.send_test_push() to authenticated;
grant execute on function public.service_claim_push(integer) to service_role;
grant execute on function public.service_push_done(bigint[], jsonb) to service_role;
grant execute on function public.service_push_maintenance() to service_role;

commit;
