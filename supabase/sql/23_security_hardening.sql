-- =============================================================================
-- RALLY BADMINTON — 23_security_hardening.sql
-- Bảo vệ 4 lớp: chống giữ sân ảo, khóa đăng nhập sai nhiều lần, xác thực 2 lớp (MFA) cho quản trị,
-- nhật ký sự kiện an ninh + cảnh báo, công tắc tạm dừng đặt sân online.
--
-- Chạy SAU 00 → 22. Chạy lại an toàn.
--
--   1. security_settings: ngưỡng chống lạm dụng, bắt buộc MFA, tạm dừng đặt sân online (chỉ chủ sân).
--   2. security_events: sự kiện an ninh (giữ sân bất thường, khóa đăng nhập, webhook giả...) → email chủ sân.
--   3. customer_hold_policies: nhân viên đánh dấu khách "tin cậy" (bỏ giới hạn) hoặc "tạm chặn giữ online".
--   4. create_guest_booking_hold_v2 (thay thế): đánh giá rủi ro theo SĐT + thiết bị + sức chứa chi nhánh.
--   5. Khóa đăng nhập sai nhiều lần (theo tài khoản và theo mạng), không lộ tài khoản có tồn tại hay không.
--   6. MFA: khi bật, quyền chủ sân / nhân viên CHỈ có hiệu lực với phiên đã xác thực 2 lớp (aal2) —
--      kiểm tra ngay trong is_owner() / permitted_branch_ids() mà mọi RLS và RPC đang dùng.
--   7. Webhook thanh toán bị từ chối dồn dập → sự kiện an ninh.
-- =============================================================================

begin;

-- 0. Tiện ích -------------------------------------------------------------------------------------

-- Che số điện thoại khi hiển thị trong sự kiện an ninh: 091****678.
create or replace function private.mask_phone(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_phone is null or char_length(p_phone) < 7 then p_phone
              else left(p_phone, 3) || '****' || right(p_phone, 3) end;
$$;

-- Mức xác thực của phiên hiện tại: 'aal1' (mật khẩu) | 'aal2' (đã nhập mã 2 lớp).
create or replace function private.current_aal()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(nullif((select auth.jwt() ->> 'aal'), ''), 'aal1');
$$;

-- 1. Cài đặt bảo mật (một dòng) ---------------------------------------------------------------------
create table if not exists public.security_settings (
  id                         boolean primary key default true constraint security_settings_singleton check (id),
  online_booking_paused      boolean not null default false,
  pause_message              text constraint security_pause_msg_len check (pause_message is null or char_length(pause_message) <= 300),
  paused_at                  timestamptz,
  require_owner_mfa          boolean not null default false,
  require_staff_mfa          boolean not null default false,
  -- Giới hạn theo thiết bị / mạng (mã băm IP): số lượt giữ chưa thanh toán cùng lúc, số lượt / giờ, số SĐT khác nhau / ngày.
  client_max_active_holds    smallint not null default 3 constraint security_client_active check (client_max_active_holds between 1 and 50),
  client_max_holds_per_hour  smallint not null default 6 constraint security_client_hour check (client_max_holds_per_hour between 1 and 100),
  client_max_phones_per_day  smallint not null default 4 constraint security_client_phones check (client_max_phones_per_day between 1 and 50),
  -- Theo số điện thoại: số lần giữ rồi bỏ (để hết hạn, không thanh toán) trong cửa sổ N ngày.
  abandon_window_days        smallint not null default 7 constraint security_abandon_window check (abandon_window_days between 1 and 30),
  phone_elevated_after       smallint not null default 2 constraint security_phone_elevated check (phone_elevated_after between 1 and 20),
  phone_block_after          smallint not null default 5 constraint security_phone_block check (phone_block_after between 2 and 50),
  elevated_hold_minutes      smallint not null default 7 constraint security_elevated_minutes check (elevated_hold_minutes between 5 and 30),
  -- Sức chứa chi nhánh: tối đa (số sân × hệ số, tối thiểu N) lượt giữ online chưa thanh toán cùng lúc. 0 = tắt.
  hold_cap_per_court         smallint not null default 3 constraint security_cap_per_court check (hold_cap_per_court between 0 and 20),
  hold_cap_min               smallint not null default 6 constraint security_cap_min check (hold_cap_min between 1 and 200),
  -- Đăng nhập: sai N lần trong M phút → khóa M phút; một mạng sai quá K lần / 15 phút → khóa mạng đó.
  login_max_failures         smallint not null default 5 constraint security_login_failures check (login_max_failures between 3 and 20),
  login_lock_minutes         smallint not null default 15 constraint security_login_lock check (login_lock_minutes between 5 and 1440),
  login_ip_max_failures      smallint not null default 30 constraint security_login_ip check (login_ip_max_failures between 10 and 500),
  updated_at                 timestamptz not null default now(),
  updated_by                 uuid references auth.users (id) on delete set null,
  constraint security_phone_order check (phone_block_after > phone_elevated_after)
);
comment on table public.security_settings is 'Ngưỡng chống lạm dụng, bắt buộc xác thực 2 lớp, tạm dừng đặt sân online. Chỉ chủ sân đọc / sửa (qua RPC).';
insert into public.security_settings (id) values (true) on conflict (id) do nothing;

alter table public.security_settings enable row level security;
drop policy if exists security_settings_owner_read on public.security_settings;
create policy security_settings_owner_read on public.security_settings for select to authenticated
  using ((select private.is_owner()));

drop trigger if exists audit_security_settings on public.security_settings;
create trigger audit_security_settings after update on public.security_settings
  for each row execute function private.audit_row_change('id', '-');

-- Đọc cài đặt trong hàm nội bộ (không phụ thuộc RLS).
create or replace function private.security_settings()
returns public.security_settings
language sql
stable
security definer
set search_path = ''
as $$
  select s from public.security_settings s where s.id;
$$;

-- 2. MFA: điều kiện "đủ xác thực" theo vai trò ---------------------------------------------------------
create or replace function private.mfa_satisfied(p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_aal() = 'aal2'
      or not coalesce((select case when p_role = 'owner' then s.require_owner_mfa else s.require_staff_mfa end
                         from public.security_settings s where s.id), false);
$$;

-- Thay thế hàm phân quyền gốc (00_init_schema.sql) — thêm điều kiện MFA. Mọi RLS / RPC dùng hai hàm này.
create or replace function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_accounts sa
    where sa.user_id = (select auth.uid()) and sa.role = 'owner' and sa.is_active
      and private.mfa_satisfied('owner')
  );
$$;

create or replace function private.permitted_branch_ids(p_permission public.app_permission default null)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select sa.user_id, sa.role
    from public.staff_accounts sa
    left join public.employees e on e.id = sa.employee_id
    where sa.user_id = (select auth.uid())
      and sa.is_active
      and (sa.role = 'owner' or (not sa.must_change_password and e.status = 'active'))
      and private.mfa_satisfied(sa.role)
  )
  select case
    when not exists (select 1 from me) then '{}'::uuid[]
    when (select role from me) = 'owner' then
      (select coalesce(array_agg(b.id), '{}'::uuid[]) from public.branches b)
    else
      (select coalesce(array_agg(distinct p.branch_id), '{}'::uuid[])
       from public.staff_branch_permissions p
       where p.user_id = (select user_id from me)
         and (p_permission is null or p.permission = p_permission)
         and (p_permission is null
              or private.permission_prerequisite(p_permission) is null
              or exists (select 1 from public.staff_branch_permissions q
                         where q.user_id = p.user_id and q.branch_id = p.branch_id
                           and q.permission = private.permission_prerequisite(p_permission))))
  end;
$$;

create or replace function private.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select sa.employee_id
  from public.staff_accounts sa
  join public.employees e on e.id = sa.employee_id and e.status = 'active'
  where sa.user_id = (select auth.uid()) and sa.is_active
    and private.mfa_satisfied(sa.role);
$$;

-- Ngữ cảnh nhân sự: thêm trạng thái MFA. Vẫn trả vai trò khi CHƯA đủ xác thực để giao diện chuyển sang
-- bước nhập mã / cài đặt 2 lớp (danh sách chi nhánh khi đó rỗng — database không cấp quyền nào).
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
    'aal', private.current_aal(),
    'mfa_required', coalesce((select case when sa.role = 'owner' then s.require_owner_mfa else s.require_staff_mfa end
                                from public.security_settings s where s.id), false),
    'mfa_enrolled', exists (select 1 from auth.mfa_factors f where f.user_id = sa.user_id and f.status = 'verified'),
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

-- 3. Sự kiện an ninh ------------------------------------------------------------------------------------
create table if not exists public.security_events (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null constraint security_events_kind check (kind in (
                     'booking_abuse_phone', 'booking_abuse_client', 'booking_branch_cap', 'booking_rate',
                     'login_locked', 'login_spray', 'webhook_rejected', 'mfa_change', 'security_setting', 'hold_policy')),
  severity         text not null constraint security_events_severity check (severity in ('info', 'warning', 'critical')),
  branch_id        uuid references public.branches (id) on delete set null,
  subject          text constraint security_events_subject_len check (subject is null or char_length(subject) <= 120),
  subject_key      text constraint security_events_key_len check (subject_key is null or char_length(subject_key) <= 80),
  occurrences      integer not null default 1 constraint security_events_occ check (occurrences >= 1),
  details          jsonb not null default '{}'::jsonb,
  first_seen_at    timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  alerted_at       timestamptz,
  acknowledged_at  timestamptz,
  acknowledged_by  uuid references auth.users (id) on delete set null
);
comment on table public.security_events is
  'Sự kiện an ninh (gộp theo loại + đối tượng trong 1 giờ). Không lưu SĐT / IP thật — chỉ dạng che hoặc mã băm.';
create index if not exists security_events_time_idx on public.security_events (last_seen_at desc);
create index if not exists security_events_dedupe_idx on public.security_events (kind, subject_key, last_seen_at desc);
create index if not exists security_events_alert_idx on public.security_events (last_seen_at) where alerted_at is null;

alter table public.security_events enable row level security;
drop policy if exists security_events_owner_read on public.security_events;
create policy security_events_owner_read on public.security_events for select to authenticated
  using ((select private.is_owner()));

-- Ghi / gộp sự kiện. Cùng loại + cùng đối tượng, chưa xử lý, trong 1 giờ → tăng số lần thay vì tạo dòng mới.
create or replace function private.record_security_event(
  p_kind text, p_severity text, p_branch_id uuid, p_subject text, p_subject_key text, p_details jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select e.id into v_id
    from public.security_events e
   where e.kind = p_kind and e.subject_key is not distinct from p_subject_key
     and e.acknowledged_at is null and e.last_seen_at > now() - interval '1 hour'
   order by e.last_seen_at desc
   limit 1
   for update;
  if v_id is not null then
    update public.security_events
       set occurrences = occurrences + 1, last_seen_at = now(),
           details = details || coalesce(p_details, '{}'::jsonb),
           -- Mức nặng hơn thì nâng lên (và cho phép báo lại).
           severity = case when p_severity = 'critical' or severity = 'critical' then 'critical'
                           when p_severity = 'warning' or severity = 'warning' then 'warning' else 'info' end,
           alerted_at = case when p_severity = 'critical' and severity <> 'critical' then null else alerted_at end
     where id = v_id;
    return v_id;
  end if;
  insert into public.security_events (kind, severity, branch_id, subject, subject_key, details)
  values (p_kind, p_severity, p_branch_id, left(p_subject, 120), left(p_subject_key, 80), coalesce(p_details, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.acknowledge_security_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_owner();
  update public.security_events
     set acknowledged_at = coalesce(acknowledged_at, now()), acknowledged_by = coalesce(acknowledged_by, (select auth.uid()))
   where id = p_event_id;
end;
$$;

create or replace function public.acknowledge_all_security_events()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform private.require_owner();
  update public.security_events set acknowledged_at = now(), acknowledged_by = (select auth.uid())
   where acknowledged_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Ứng dụng ghi sự kiện phát hiện ở máy chủ (vd. gỡ xác thực 2 lớp). Chỉ các loại được phép.
create or replace function public.service_record_security_event(
  p_kind text, p_severity text, p_subject text, p_subject_key text, p_details jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_service_role();
  if p_kind not in ('mfa_change', 'login_locked', 'login_spray') or p_severity not in ('info', 'warning', 'critical') then
    perform private.raise_error('INVALID_INPUT');
  end if;
  return private.record_security_event(p_kind, p_severity, null, p_subject, p_subject_key, p_details);
end;
$$;

-- 4. Chính sách giữ sân theo khách (nhân viên xử lý chặn nhầm) ------------------------------------------
create table if not exists public.customer_hold_policies (
  customer_id  uuid primary key references public.customers (id),
  policy       text not null constraint customer_hold_policy_kind check (policy in ('trusted', 'blocked')),
  note         text not null constraint customer_hold_policy_note_len check (char_length(btrim(note)) between 3 and 300),
  until_at     timestamptz,
  set_by       uuid references auth.users (id) on delete set null,
  updated_at   timestamptz not null default now()
);
comment on table public.customer_hold_policies is
  'Ngoại lệ giữ sân online: trusted = bỏ giới hạn tự động (khách quen bị chặn nhầm); blocked = tạm không cho giữ online. Không có dòng = tự động.';

alter table public.customer_hold_policies enable row level security;
drop policy if exists customer_hold_policies_staff_read on public.customer_hold_policies;
create policy customer_hold_policies_staff_read on public.customer_hold_policies for select to authenticated
  using (cardinality(private.permitted_branch_ids('booking.view')) > 0);

drop trigger if exists audit_customer_hold_policies on public.customer_hold_policies;
create trigger audit_customer_hold_policies after insert or update or delete on public.customer_hold_policies
  for each row execute function private.audit_row_change('customer_id', '-');

-- Khách bị ẩn danh hóa: bỏ ghi chú (có thể chứa thông tin cá nhân).
create or replace function private.customer_hold_policy_on_anonymize()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.anonymized_at is not null and old.anonymized_at is null then
    delete from public.customer_hold_policies where customer_id = new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists customers_hold_policy_anonymize on public.customers;
create trigger customers_hold_policy_anonymize after update of anonymized_at on public.customers
  for each row execute function private.customer_hold_policy_on_anonymize();

-- Dấu vết giữ sân theo thiết bị (mã băm IP) — chỉ để giới hạn tần suất, tự xóa sau 30 ngày.
create table if not exists private.hold_attempts (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  client_hash text not null constraint hold_attempts_client_len check (char_length(client_hash) between 1 and 64),
  customer_id uuid,
  booking_id  uuid,
  branch_id   uuid
);
create index if not exists hold_attempts_client_idx on private.hold_attempts (client_hash, created_at desc);
create index if not exists hold_attempts_time_idx on private.hold_attempts (created_at);
revoke all on private.hold_attempts from public, anon, authenticated;

-- Số lần "giữ rồi bỏ" (hết hạn, không thanh toán) của khách trong cửa sổ N ngày.
create or replace function private.customer_abandoned_holds(p_customer_id uuid, p_days integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
    from public.bookings b
   where b.customer_id = p_customer_id
     and b.source = 'online'
     and b.created_at > now() - make_interval(days => greatest(p_days, 1))
     and (b.status = 'expired' or (b.status = 'held' and b.hold_expires_at <= now()))
     and private.booking_net_paid(b.id) <= 0;
$$;

-- Mức rủi ro: trusted | normal | elevated | blocked (+ lý do, số lần bỏ).
create or replace function private.customer_hold_risk(p_customer_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.security_settings := private.security_settings();
  p public.customer_hold_policies;
  v_abandoned integer := 0;
begin
  if p_customer_id is null then
    return jsonb_build_object('level', 'normal', 'reason', null, 'abandoned', 0);
  end if;
  select * into p from public.customer_hold_policies where customer_id = p_customer_id;
  v_abandoned := private.customer_abandoned_holds(p_customer_id, s.abandon_window_days);
  if found and (p.until_at is null or p.until_at > now()) then
    return jsonb_build_object('level', p.policy, 'reason', 'manual', 'abandoned', v_abandoned,
                              'until', p.until_at, 'note', p.note);
  end if;
  if v_abandoned >= s.phone_block_after then
    return jsonb_build_object('level', 'blocked', 'reason', 'abandoned', 'abandoned', v_abandoned);
  elsif v_abandoned >= s.phone_elevated_after then
    return jsonb_build_object('level', 'elevated', 'reason', 'abandoned', 'abandoned', v_abandoned);
  end if;
  return jsonb_build_object('level', 'normal', 'reason', null, 'abandoned', v_abandoned);
end;
$$;

-- Nhân viên (có quyền thao tác đặt sân) đặt ngoại lệ cho khách. p_policy = 'auto' → bỏ ngoại lệ.
create or replace function public.set_customer_hold_policy(p_customer_id uuid, p_policy text, p_note text, p_until timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text;
begin
  if (select auth.uid()) is null or cardinality(private.permitted_branch_ids('booking.operate')) = 0 then
    perform private.raise_error('PERMISSION_DENIED');
  end if;
  if p_policy not in ('auto', 'trusted', 'blocked') then
    perform private.raise_error('INVALID_INPUT');
  end if;
  select c.phone into v_phone from public.customers c where c.id = p_customer_id and c.anonymized_at is null;
  if v_phone is null then
    perform private.raise_error('CUSTOMER_NOT_FOUND');
  end if;
  if p_policy <> 'auto' and char_length(btrim(coalesce(p_note, ''))) < 3 then
    perform private.raise_error('REASON_REQUIRED');
  end if;
  if p_until is not null and p_until <= now() then
    perform private.raise_error('INVALID_INPUT');
  end if;
  perform private.set_audit_reason('hold policy: ' || p_policy || coalesce(' — ' || btrim(p_note), ''));
  if p_policy = 'auto' then
    delete from public.customer_hold_policies where customer_id = p_customer_id;
  else
    insert into public.customer_hold_policies (customer_id, policy, note, until_at, set_by, updated_at)
    values (p_customer_id, p_policy, btrim(p_note), p_until, (select auth.uid()), now())
    on conflict (customer_id) do update
      set policy = excluded.policy, note = excluded.note, until_at = excluded.until_at,
          set_by = excluded.set_by, updated_at = now();
  end if;
  perform private.record_security_event('hold_policy', 'info', null, private.mask_phone(v_phone),
                                        private.pseudonymize('secevent', v_phone),
                                        jsonb_build_object('policy', p_policy, 'until', p_until));
  return private.customer_hold_risk(p_customer_id);
end;
$$;

-- Trạng thái giữ sân của một khách (trang chi tiết khách hàng).
create or replace function public.customer_hold_status(p_customer_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.security_settings := private.security_settings();
begin
  if (select auth.uid()) is null or cardinality(private.permitted_branch_ids('booking.view')) = 0 then
    perform private.raise_error('PERMISSION_DENIED');
  end if;
  return private.customer_hold_risk(p_customer_id) || jsonb_build_object(
    'window_days', s.abandon_window_days, 'elevated_after', s.phone_elevated_after, 'block_after', s.phone_block_after,
    'can_edit', cardinality(private.permitted_branch_ids('booking.operate')) > 0);
end;
$$;

-- Danh sách khách đang bị giới hạn / có ngoại lệ (trang Bảo mật của chủ sân).
create or replace function public.restricted_customers()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.security_settings := private.security_settings();
begin
  perform private.require_owner();
  return coalesce((
    select jsonb_agg(x order by x ->> 'level', x ->> 'name')
      from (
        select private.customer_hold_risk(c.id)
               || jsonb_build_object('customer_id', c.id, 'name', c.full_name, 'phone', c.phone) as x
          from public.customers c
         where c.anonymized_at is null
           and (exists (select 1 from public.customer_hold_policies p where p.customer_id = c.id)
                or exists (select 1 from public.bookings b
                            where b.customer_id = c.id and b.source = 'online'
                              and b.created_at > now() - make_interval(days => s.abandon_window_days)
                              and (b.status = 'expired' or (b.status = 'held' and b.hold_expires_at <= now()))))
      ) q
     where x ->> 'level' <> 'normal'), '[]'::jsonb);
end;
$$;

-- 5. Giữ sân online: đánh giá rủi ro (thay thế bản 22) ---------------------------------------------------
create or replace function public.create_guest_booking_hold_v2(
  p_court_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_contact_name text,
  p_phone text,
  p_customer_note text,
  p_idempotency_key text,
  p_terms_wording text,
  p_marketing boolean,
  p_marketing_wording text,
  p_ip_hash text,
  p_user_agent text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.security_settings := private.security_settings();
  v_result jsonb;
  v_booking_id uuid;
  v_customer uuid;
  v_phone text := private.normalize_vn_phone(p_phone);
  v_risk jsonb;
  v_level text;
  v_branch uuid;
  v_cap integer;
  v_client text := nullif(btrim(coalesce(p_ip_hash, '')), '');
begin
  perform private.require_service_role();
  if char_length(btrim(coalesce(p_terms_wording, ''))) < 5 then
    perform private.raise_error('TERMS_NOT_ACCEPTED');
  end if;
  -- Gửi lại cùng mã chống trùng (mạng chập chờn): trả đúng đơn cũ, không đánh giá lại / không ghi bằng chứng lần hai.
  if p_idempotency_key is not null and exists (select 1 from public.bookings b where b.idempotency_key = p_idempotency_key) then
    return public.create_guest_booking_hold(p_court_id, p_starts_at, p_ends_at, p_contact_name, p_phone,
                                            p_customer_note, p_idempotency_key);
  end if;
  if s.online_booking_paused then
    perform private.raise_error('ONLINE_BOOKING_PAUSED');
  end if;
  if v_phone is null then
    perform private.raise_error('INVALID_PHONE');
  end if;

  -- Cùng khóa với hàm gốc (theo SĐT) → kiểm tra và ghi đơn nằm trong một vùng tuần tự, không lách được bằng gửi song song.
  perform pg_advisory_xact_lock(hashtext('rally.guest_phone'), hashtext(v_phone));
  select c.id into v_customer from public.customers c where c.phone = v_phone;
  v_risk := private.customer_hold_risk(v_customer);
  v_level := v_risk ->> 'level';
  if v_level = 'blocked' then
    perform private.raise_error('HOLD_RISK_BLOCKED');
  end if;

  if v_level <> 'trusted' then
    -- Theo thiết bị / mạng (mã băm IP): số lượt đang giữ, số lượt mỗi giờ, số SĐT khác nhau mỗi ngày.
    if v_client is not null then
      perform pg_advisory_xact_lock(hashtext('rally.hold_client'), hashtext(v_client));
      if (select count(*) from private.hold_attempts a join public.bookings b on b.id = a.booking_id
           where a.client_hash = v_client and a.created_at > now() - interval '1 day'
             and b.status = 'held' and b.hold_expires_at > now()) >= s.client_max_active_holds
         or (select count(*) from private.hold_attempts a
              where a.client_hash = v_client and a.created_at > now() - interval '1 hour') >= s.client_max_holds_per_hour
         or (v_customer is null or not exists (select 1 from private.hold_attempts a
                                                where a.client_hash = v_client and a.customer_id = v_customer
                                                  and a.created_at > now() - interval '1 day'))
            and (select count(distinct a.customer_id) from private.hold_attempts a
                  where a.client_hash = v_client and a.created_at > now() - interval '1 day') >= s.client_max_phones_per_day then
        perform private.raise_error('CLIENT_HOLD_LIMIT');
      end if;
    end if;
    -- Từng bỏ nhiều lượt giữ: chỉ được giữ 1 lượt mỗi lúc, thời gian giữ ngắn hơn.
    if v_level = 'elevated' and v_customer is not null
       and exists (select 1 from public.bookings b where b.customer_id = v_customer
                     and b.status = 'held' and b.hold_expires_at > now()) then
      perform private.raise_error('TOO_MANY_HOLDS');
    end if;
    -- Sức chứa chi nhánh: chặn việc chiếm hết giờ trống bằng nhiều SĐT / nhiều mạng khác nhau.
    if s.hold_cap_per_court > 0 then
      select c.branch_id into v_branch from public.courts c where c.id = p_court_id;
      if v_branch is not null then
        perform pg_advisory_xact_lock(hashtext('rally.branch_holds'), hashtext(v_branch::text));
        select greatest(s.hold_cap_min, s.hold_cap_per_court * count(*))::integer into v_cap
          from public.courts c where c.branch_id = v_branch and c.status = 'active' and c.deleted_at is null;
        if (select count(*) from public.bookings b
             where b.branch_id = v_branch and b.source = 'online' and b.status = 'held'
               and b.hold_expires_at > now()) >= v_cap then
          perform private.raise_error('HOLDS_BUSY');
        end if;
      end if;
    end if;
  end if;

  v_result := public.create_guest_booking_hold(p_court_id, p_starts_at, p_ends_at, p_contact_name, p_phone,
                                               p_customer_note, p_idempotency_key);
  v_booking_id := (v_result ->> 'booking_id')::uuid;
  select b.customer_id, b.branch_id into v_customer, v_branch from public.bookings b where b.id = v_booking_id;

  if v_level = 'elevated' then
    perform private.set_audit_reason('system: shorter hold (risk)');
    update public.bookings
       set hold_expires_at = least(hold_expires_at, created_at + make_interval(mins => s.elevated_hold_minutes))
     where id = v_booking_id and status = 'held';
    perform private.set_audit_reason(null);
    v_result := private.booking_json(v_booking_id);
  end if;

  if v_client is not null then
    insert into private.hold_attempts (client_hash, customer_id, booking_id, branch_id)
    values (left(v_client, 64), v_customer, v_booking_id, v_branch);
  end if;

  perform private.record_consent(v_customer, null, v_booking_id, 'booking_terms', true, 'booking_form',
                                 p_terms_wording, p_ip_hash, p_user_agent);
  -- Chỉ ghi khi khách CHỦ ĐỘNG chọn nhận tin (không chọn = không đổi lựa chọn cũ của khách).
  if coalesce(p_marketing, false) then
    perform private.record_consent(v_customer, null, v_booking_id, 'marketing', true, 'booking_form',
                                   coalesce(p_marketing_wording, 'Nhận tin khuyến mãi'), p_ip_hash, p_user_agent);
  end if;
  return v_result;
end;
$$;

-- Máy chủ báo lại lượt giữ sân bị từ chối (lỗi làm hủy giao dịch nên database không tự ghi được) → sự kiện an ninh.
create or replace function public.service_note_hold_rejection(p_code text, p_phone text, p_ip_hash text, p_court_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := private.normalize_vn_phone(p_phone);
  v_branch uuid;
begin
  perform private.require_service_role();
  select c.branch_id into v_branch from public.courts c where c.id = p_court_id;
  case p_code
    when 'HOLD_RISK_BLOCKED' then
      perform private.record_security_event('booking_abuse_phone', 'warning', v_branch, private.mask_phone(v_phone),
                                            private.pseudonymize('secevent', v_phone), '{}'::jsonb);
    when 'CLIENT_HOLD_LIMIT' then
      perform private.record_security_event('booking_abuse_client', 'warning', v_branch,
                                            'Thiết bị / mạng ' || left(coalesce(p_ip_hash, '?'), 8),
                                            'client:' || left(coalesce(p_ip_hash, '?'), 40), '{}'::jsonb);
    when 'HOLDS_BUSY' then
      perform private.record_security_event('booking_branch_cap', 'critical', v_branch,
                                            (select b.name from public.branches b where b.id = v_branch),
                                            'branch:' || coalesce(v_branch::text, '?'), '{}'::jsonb);
    when 'RATE_LIMITED', 'TOO_MANY_HOLDS' then
      perform private.record_security_event('booking_rate', 'info', v_branch, private.mask_phone(v_phone),
                                            private.pseudonymize('secevent', v_phone), jsonb_build_object('code', p_code));
    else
      null;
  end case;
end;
$$;

-- Trạng thái đặt sân online cho trang khách (ai cũng đọc được).
create or replace function public.online_booking_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('paused', s.online_booking_paused, 'message', s.pause_message)
    from public.security_settings s where s.id;
$$;

-- 6. Khóa đăng nhập sai nhiều lần ---------------------------------------------------------------------
create table if not exists private.login_attempts (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  scope        text not null constraint login_attempts_scope check (scope in ('staff', 'member')),
  account_hash text not null constraint login_attempts_account_len check (char_length(account_hash) = 64),
  ip_hash      text constraint login_attempts_ip_len check (ip_hash is null or char_length(ip_hash) <= 64),
  success      boolean not null
);
create index if not exists login_attempts_account_idx on private.login_attempts (account_hash, created_at desc);
create index if not exists login_attempts_ip_idx on private.login_attempts (ip_hash, created_at desc) where not success;
create index if not exists login_attempts_time_idx on private.login_attempts (created_at);
revoke all on private.login_attempts from public, anon, authenticated;

-- Thời gian (giây) còn bị khóa; 0 = được thử. Không phân biệt tài khoản có tồn tại hay không.
create or replace function public.service_login_check(p_scope text, p_login text, p_ip_hash text)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.security_settings := private.security_settings();
  v_account text := private.pseudonymize('login', lower(btrim(coalesce(p_login, ''))));
  v_last_ok timestamptz;
  v_nth timestamptz;
  v_wait integer := 0;
begin
  perform private.require_service_role();
  select max(a.created_at) into v_last_ok from private.login_attempts a where a.account_hash = v_account and a.success;
  -- Lần sai thứ N (tính từ mới nhất) trong cửa sổ khóa, sau lần đúng gần nhất.
  select a.created_at into v_nth
    from private.login_attempts a
   where a.account_hash = v_account and not a.success
     and a.created_at > greatest(coalesce(v_last_ok, '-infinity'), now() - make_interval(mins => s.login_lock_minutes))
   order by a.created_at desc
   offset s.login_max_failures - 1 limit 1;
  if v_nth is not null then
    v_wait := ceil(extract(epoch from (v_nth + make_interval(mins => s.login_lock_minutes) - now())))::integer;
  end if;
  if p_ip_hash is not null and (select count(*) from private.login_attempts a
                                 where a.ip_hash = p_ip_hash and not a.success
                                   and a.created_at > now() - interval '15 minutes') >= s.login_ip_max_failures then
    v_wait := greatest(v_wait, 15 * 60);
  end if;
  return greatest(v_wait, 0);
end;
$$;

create or replace function public.service_login_record(p_scope text, p_login text, p_ip_hash text, p_success boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.security_settings := private.security_settings();
  v_login text := lower(btrim(coalesce(p_login, '')));
  v_account text := private.pseudonymize('login', v_login);
  v_last_ok timestamptz;
  v_fails integer;
  v_ip_fails integer;
  v_masked text;
begin
  perform private.require_service_role();
  if p_scope not in ('staff', 'member') or v_login = '' then
    return;
  end if;
  insert into private.login_attempts (scope, account_hash, ip_hash, success)
  values (p_scope, v_account, left(p_ip_hash, 64), coalesce(p_success, false));
  if p_success then
    return;
  end if;
  select max(a.created_at) into v_last_ok from private.login_attempts a where a.account_hash = v_account and a.success;
  select count(*) into v_fails from private.login_attempts a
   where a.account_hash = v_account and not a.success
     and a.created_at > greatest(coalesce(v_last_ok, '-infinity'), now() - make_interval(mins => s.login_lock_minutes));
  -- Che phần lớn tên đăng nhập trong sự kiện (vd. ow***@rally.vn, 091****678).
  v_masked := case when position('@' in v_login) > 0
                   then left(v_login, 2) || '***' || substr(v_login, position('@' in v_login))
                   else private.mask_phone(v_login) end;
  if v_fails = s.login_max_failures then
    perform private.record_security_event('login_locked', case when p_scope = 'staff' then 'warning' else 'info' end, null,
                                          (case when p_scope = 'staff' then 'Quản trị: ' else 'Thành viên: ' end) || v_masked,
                                          'login:' || left(v_account, 40), jsonb_build_object('scope', p_scope));
  end if;
  if p_ip_hash is not null then
    select count(*) into v_ip_fails from private.login_attempts a
     where a.ip_hash = p_ip_hash and not a.success and a.created_at > now() - interval '15 minutes';
    if v_ip_fails = s.login_ip_max_failures then
      perform private.record_security_event('login_spray', 'critical', null, 'Mạng ' || left(p_ip_hash, 8),
                                            'ip:' || left(p_ip_hash, 40), jsonb_build_object('scope', p_scope));
    end if;
  end if;
end;
$$;

-- 7. Cài đặt bảo mật (chủ sân) -----------------------------------------------------------------------
create or replace function public.update_security_settings(p jsonb)
returns public.security_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  old public.security_settings := private.security_settings();
  v public.security_settings;
  v_owner_mfa boolean := coalesce((p ->> 'require_owner_mfa')::boolean, old.require_owner_mfa);
  v_staff_mfa boolean := coalesce((p ->> 'require_staff_mfa')::boolean, old.require_staff_mfa);
  v_paused boolean := coalesce((p ->> 'online_booking_paused')::boolean, old.online_booking_paused);
begin
  perform private.require_owner();
  -- Bật / tắt bắt buộc 2 lớp chỉ từ phiên đã xác thực 2 lớp: chống tự khóa mình và chống kẻ lấy được mật khẩu tắt đi.
  if (v_owner_mfa is distinct from old.require_owner_mfa or v_staff_mfa is distinct from old.require_staff_mfa)
     and private.current_aal() <> 'aal2' then
    perform private.raise_error('MFA_REQUIRED');
  end if;
  update public.security_settings set
    online_booking_paused     = v_paused,
    pause_message             = case when p ? 'pause_message' then nullif(btrim(p ->> 'pause_message'), '') else pause_message end,
    paused_at                 = case when v_paused and not old.online_booking_paused then now()
                                     when not v_paused then null else paused_at end,
    require_owner_mfa         = v_owner_mfa,
    require_staff_mfa         = v_staff_mfa,
    client_max_active_holds   = coalesce((p ->> 'client_max_active_holds')::smallint, client_max_active_holds),
    client_max_holds_per_hour = coalesce((p ->> 'client_max_holds_per_hour')::smallint, client_max_holds_per_hour),
    client_max_phones_per_day = coalesce((p ->> 'client_max_phones_per_day')::smallint, client_max_phones_per_day),
    abandon_window_days       = coalesce((p ->> 'abandon_window_days')::smallint, abandon_window_days),
    phone_elevated_after      = coalesce((p ->> 'phone_elevated_after')::smallint, phone_elevated_after),
    phone_block_after         = coalesce((p ->> 'phone_block_after')::smallint, phone_block_after),
    elevated_hold_minutes     = coalesce((p ->> 'elevated_hold_minutes')::smallint, elevated_hold_minutes),
    hold_cap_per_court        = coalesce((p ->> 'hold_cap_per_court')::smallint, hold_cap_per_court),
    hold_cap_min              = coalesce((p ->> 'hold_cap_min')::smallint, hold_cap_min),
    login_max_failures        = coalesce((p ->> 'login_max_failures')::smallint, login_max_failures),
    login_lock_minutes        = coalesce((p ->> 'login_lock_minutes')::smallint, login_lock_minutes),
    login_ip_max_failures     = coalesce((p ->> 'login_ip_max_failures')::smallint, login_ip_max_failures),
    updated_at = now(),
    updated_by = (select auth.uid())
  where id
  returning * into v;

  if v.online_booking_paused is distinct from old.online_booking_paused then
    perform private.record_security_event('security_setting', 'warning', null,
      case when v.online_booking_paused then 'Đã TẠM DỪNG đặt sân online' else 'Đã mở lại đặt sân online' end,
      'pause:' || clock_timestamp()::text, '{}'::jsonb);
  end if;
  if (v.require_owner_mfa, v.require_staff_mfa) is distinct from (old.require_owner_mfa, old.require_staff_mfa) then
    perform private.record_security_event('mfa_change',
      case when (v.require_owner_mfa < old.require_owner_mfa) or (v.require_staff_mfa < old.require_staff_mfa)
           then 'warning' else 'info' end, null,
      'Bắt buộc 2 lớp: chủ sân ' || case when v.require_owner_mfa then 'BẬT' else 'TẮT' end
        || ', nhân viên ' || case when v.require_staff_mfa then 'BẬT' else 'TẮT' end,
      'mfa_policy:' || clock_timestamp()::text, '{}'::jsonb);
  end if;
  return v;
end;
$$;

-- 8. Webhook thanh toán bị từ chối dồn dập → sự kiện an ninh ----------------------------------------
create or replace function private.webhook_event_watch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.auth_result = 'unauthorized'
     and (select count(*) from public.payment_webhook_events e
           where e.provider = new.provider and e.auth_result = 'unauthorized'
             and e.received_at > now() - interval '10 minutes') >= 3 then
    perform private.record_security_event('webhook_rejected', 'critical', null,
      'Webhook ' || new.provider || ' bị từ chối nhiều lần', 'webhook:' || new.provider,
      jsonb_build_object('last_ip', left(coalesce(new.ip_hash, '?'), 8)));
  end if;
  return null;
end;
$$;
drop trigger if exists payment_webhook_events_watch on public.payment_webhook_events;
create trigger payment_webhook_events_watch after insert on public.payment_webhook_events
  for each row execute function private.webhook_event_watch();

-- 9. Cảnh báo email + dọn dẹp (máy chủ gọi) ---------------------------------------------------------
create or replace function public.service_pending_security_alerts(p_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_service_role();
  return jsonb_build_object(
    'recipients', to_jsonb(public.service_alert_recipients()),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'kind', e.kind, 'severity', e.severity, 'subject', e.subject,
               'occurrences', e.occurrences, 'first_seen_at', e.first_seen_at, 'last_seen_at', e.last_seen_at,
               'branch_name', b.name) order by e.last_seen_at)
        from (select * from public.security_events x
               where x.alerted_at is null and x.acknowledged_at is null and x.severity in ('warning', 'critical')
                 and x.last_seen_at > now() - interval '1 day'
               order by x.last_seen_at
               limit least(greatest(coalesce(p_limit, 20), 1), 50)) e
        left join public.branches b on b.id = e.branch_id), '[]'::jsonb));
end;
$$;

create or replace function public.service_mark_security_alerted(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform private.require_service_role();
  update public.security_events set alerted_at = now() where id = any (p_ids) and alerted_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Hằng đêm: đánh dấu lượt giữ hết hạn, xóa dấu vết chống lạm dụng cũ, xóa sự kiện an ninh quá 180 ngày.
create or replace function public.service_security_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expired integer;
  v_attempts integer;
  v_logins integer;
  v_events integer;
begin
  perform private.require_service_role();
  v_expired := public.expire_stale_holds();
  delete from private.hold_attempts where created_at < now() - interval '30 days';
  get diagnostics v_attempts = row_count;
  delete from private.login_attempts where created_at < now() - interval '2 days';
  get diagnostics v_logins = row_count;
  -- Thời hạn lưu nhật ký an ninh theo bảng thời hạn lưu trữ (chủ sân chỉnh được ở Cài đặt → Pháp lý).
  delete from public.security_events e
   where exists (select 1 from public.data_retention_policies p where p.code = 'security_logs' and p.is_automatic
                   and e.last_seen_at < now() - make_interval(days => p.retention_days));
  get diagnostics v_events = row_count;
  update public.data_retention_policies set last_run_at = now(), last_run_count = v_events where code = 'security_logs';
  delete from public.customer_hold_policies where until_at is not null and until_at < now() - interval '1 day';
  return jsonb_build_object('expired_holds', v_expired, 'hold_attempts', v_attempts,
                            'login_attempts', v_logins, 'events', v_events);
end;
$$;

-- Thời hạn lưu trữ nhật ký an ninh (hiện trong Chính sách bảo vệ dữ liệu cá nhân).
insert into public.data_retention_policies (code, label, data_scope, retention_days, action, basis, is_automatic, sort_order) values
  ('security_logs', 'Nhật ký chống lạm dụng, đăng nhập', 'Mã băm IP, số điện thoại / email đã che, số lần giữ sân, số lần đăng nhập sai',
   180, 'delete', 'Bảo vệ hệ thống khỏi giữ sân ảo và dò mật khẩu. Lượt đăng nhập tự xóa sau 2 ngày, dấu vết giữ sân sau 30 ngày, sự kiện an ninh theo thời hạn này.', true, 75)
on conflict (code) do nothing;

-- 10. Quyền --------------------------------------------------------------------------------------------
revoke all on public.security_settings, public.security_events, public.customer_hold_policies from anon, authenticated;
grant select on public.security_settings, public.security_events, public.customer_hold_policies to authenticated;

revoke all on function private.mask_phone(text) from public, anon, authenticated;
revoke all on function private.current_aal() from public, anon, authenticated;
revoke all on function private.security_settings() from public, anon, authenticated;
revoke all on function private.mfa_satisfied(public.app_role) from public, anon, authenticated;
revoke all on function private.record_security_event(text, text, uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function private.customer_abandoned_holds(uuid, integer) from public, anon, authenticated;
revoke all on function private.customer_hold_risk(uuid) from public, anon, authenticated;
revoke all on function private.customer_hold_policy_on_anonymize() from public, anon, authenticated;
revoke all on function private.webhook_event_watch() from public, anon, authenticated;

revoke all on function public.acknowledge_security_event(uuid) from public, anon;
revoke all on function public.acknowledge_all_security_events() from public, anon;
revoke all on function public.service_record_security_event(text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.set_customer_hold_policy(uuid, text, text, timestamptz) from public, anon;
revoke all on function public.customer_hold_status(uuid) from public, anon;
revoke all on function public.restricted_customers() from public, anon;
revoke all on function public.create_guest_booking_hold_v2(uuid, timestamptz, timestamptz, text, text, text, text, text, boolean, text, text, text) from public, anon, authenticated;
revoke all on function public.service_note_hold_rejection(text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.online_booking_status() from public;
revoke all on function public.service_login_check(text, text, text) from public, anon, authenticated;
revoke all on function public.service_login_record(text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.update_security_settings(jsonb) from public, anon;
revoke all on function public.service_pending_security_alerts(integer) from public, anon, authenticated;
revoke all on function public.service_mark_security_alerted(uuid[]) from public, anon, authenticated;
revoke all on function public.service_security_maintenance() from public, anon, authenticated;

grant execute on function public.acknowledge_security_event(uuid) to authenticated;
grant execute on function public.acknowledge_all_security_events() to authenticated;
grant execute on function public.service_record_security_event(text, text, text, text, jsonb) to service_role;
grant execute on function public.set_customer_hold_policy(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.customer_hold_status(uuid) to authenticated;
grant execute on function public.restricted_customers() to authenticated;
grant execute on function public.create_guest_booking_hold_v2(uuid, timestamptz, timestamptz, text, text, text, text, text, boolean, text, text, text) to service_role;
grant execute on function public.service_note_hold_rejection(text, text, text, uuid) to service_role;
grant execute on function public.online_booking_status() to anon, authenticated, service_role;
grant execute on function public.service_login_check(text, text, text) to service_role;
grant execute on function public.service_login_record(text, text, text, boolean) to service_role;
grant execute on function public.update_security_settings(jsonb) to authenticated;
grant execute on function public.service_pending_security_alerts(integer) to service_role;
grant execute on function public.service_mark_security_alerted(uuid[]) to service_role;
grant execute on function public.service_security_maintenance() to service_role;

commit;
