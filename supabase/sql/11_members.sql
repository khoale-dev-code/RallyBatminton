-- =============================================================================
-- RALLY BADMINTON — 11_members.sql
-- TÀI KHOẢN THÀNH VIÊN cho khách (tùy chọn) + ĐIỂM TÍCH LŨY + HẠNG.
--
-- Chạy SAU 00 → 09 (08, 10 tùy chọn). Chạy lại an toàn.
--
-- Nguyên tắc:
--  * Khách vẫn đặt sân KHÔNG cần tài khoản. Tài khoản chỉ để xem mọi đơn của mình, đặt nhanh, tích điểm.
--  * Tài khoản khách và tài khoản nhân sự KHÔNG trùng nhau: một user Auth không thể vừa có
--    member_profiles vừa có staff_accounts (chặn ở cả hai phía bằng trigger).
--  * Chưa có OTP nên số điện thoại của thành viên CHƯA được xác minh. Vì vậy thành viên chỉ thấy
--    đơn đặt khi đang đăng nhập, hoặc đơn cũ tự "nhận" bằng ĐÚNG mã đơn + số điện thoại.
--    Biết số điện thoại thôi không xem được lịch của người khác.
--  * Điểm: 1 điểm / 10.000đ tiền sân của đơn HOÀN TẤT gắn với thành viên (cộng 1 lần / đơn).
--    Hạng theo tổng điểm đã tích (không giảm khi đổi điểm sau này):
--      Thành viên 0 · Bạc 300 · Vàng 1.000 · Kim cương 3.000.
--  * Sổ điểm chỉ thêm, không sửa; số dư nằm trên member_profiles và chỉ đổi qua sổ điểm.
--  * Mọi thao tác ghi đi qua RPC security definer có kiểm tra người gọi; bảng không mở quyền ghi.
-- =============================================================================

begin;

-- 1. Kiểu dữ liệu ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'member_tier' and typnamespace = 'public'::regnamespace) then
    create type public.member_tier as enum ('member', 'silver', 'gold', 'diamond');
  end if;
  if not exists (select 1 from pg_type where typname = 'member_login_kind' and typnamespace = 'public'::regnamespace) then
    create type public.member_login_kind as enum ('phone', 'email', 'google');
  end if;
end;
$$;

-- 2. Bảng ------------------------------------------------------------------------------------
create table if not exists public.member_profiles (
  user_id              uuid primary key references auth.users (id) on delete cascade,
  full_name            text not null constraint member_profiles_name_len check (char_length(btrim(full_name)) between 2 and 80),
  phone                text constraint member_profiles_phone_key unique
                         constraint member_profiles_phone_fmt check (phone is null or phone ~ '^0[35789][0-9]{8}$'),
  login_kind           public.member_login_kind not null,
  points               integer not null default 0 constraint member_profiles_points_nonneg check (points >= 0),
  lifetime_points      integer not null default 0 constraint member_profiles_lifetime_nonneg check (lifetime_points >= 0),
  tier                 public.member_tier not null default 'member',
  is_locked            boolean not null default false,
  must_change_password boolean not null default false,
  marketing_opt_in     boolean not null default false,
  staff_note           text constraint member_profiles_note_len check (staff_note is null or char_length(staff_note) <= 500),
  last_seen_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
comment on table public.member_profiles is 'Thành viên (khách có tài khoản). Không trùng tài khoản nhân sự.';

create table if not exists public.member_point_ledger (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.member_profiles (user_id) on delete cascade,
  kind       text not null constraint member_point_kind check (kind in ('booking', 'adjust')),
  delta      integer not null constraint member_point_delta_nonzero check (delta <> 0),
  reason     text not null constraint member_point_reason_len check (char_length(btrim(reason)) between 2 and 200),
  booking_id uuid references public.bookings (id),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint member_point_booking_ref check (kind <> 'booking' or booking_id is not null)
);
comment on table public.member_point_ledger is 'Sổ điểm thành viên (chỉ thêm). Số dư trên member_profiles.';
create unique index if not exists member_point_booking_uidx on public.member_point_ledger (booking_id) where kind = 'booking';
create index if not exists member_point_user_idx on public.member_point_ledger (user_id, created_at desc);

alter table public.bookings add column if not exists member_user_id uuid references public.member_profiles (user_id) on delete set null;
create index if not exists bookings_member_idx on public.bookings (member_user_id, created_at desc) where member_user_id is not null;
comment on column public.bookings.member_user_id is 'Thành viên sở hữu đơn (đặt khi đăng nhập hoặc tự nhận bằng mã đơn + SĐT).';

-- 3. Hàm nội bộ ------------------------------------------------------------------------------
create or replace function private.member_tier_for(p_lifetime integer)
returns public.member_tier
language sql
immutable
set search_path = ''
as $$
  select case
    when p_lifetime >= 3000 then 'diamond'::public.member_tier
    when p_lifetime >= 1000 then 'gold'::public.member_tier
    when p_lifetime >= 300 then 'silver'::public.member_tier
    else 'member'::public.member_tier end;
$$;

-- Điểm của một đơn: 1 điểm / 10.000đ tiền sân.
create or replace function private.member_points_for_amount(p_amount bigint)
returns integer
language sql
immutable
set search_path = ''
as $$
  select greatest(0, floor(coalesce(p_amount, 0) / 10000.0))::integer;
$$;

-- Email đăng nhập "bí danh" của tài khoản đăng ký bằng SĐT (không phải hộp thư thật).
create or replace function private.member_is_alias_email(p_email text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_email, '') like '%@thanhvien.rally.invalid';
$$;

-- Thành viên chỉ gắn với hồ sơ khách (customers) cùng SĐT; bỏ gắn hồ sơ cũ khi đổi số.
create or replace function private.member_link_customer(p_user_id uuid, p_phone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.customers set auth_user_id = null
   where auth_user_id = p_user_id and phone is distinct from p_phone;
  if p_phone is not null then
    update public.customers set auth_user_id = p_user_id
     where phone = p_phone and auth_user_id is null;
  end if;
end;
$$;

-- Người gọi được xem danh sách thành viên: chủ sân hoặc nhân sự có quyền xem lịch ở ít nhất 1 chi nhánh.
create or replace function private.can_view_members()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_owner())
      or cardinality((select private.permitted_branch_ids('booking.view'))) > 0;
$$;

create or replace function private.member_json(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'user_id', m.user_id,
    'full_name', m.full_name,
    'phone', m.phone,
    'email', case when private.member_is_alias_email(u.email) then null else u.email end,
    'login_kind', m.login_kind,
    'points', m.points,
    'lifetime_points', m.lifetime_points,
    'tier', m.tier,
    'is_locked', m.is_locked,
    'must_change_password', m.must_change_password,
    'has_password', coalesce(u.encrypted_password, '') <> '',
    'marketing_opt_in', m.marketing_opt_in,
    'created_at', m.created_at)
  from public.member_profiles m
  join auth.users u on u.id = m.user_id
  where m.user_id = p_user_id;
$$;

-- 4. Trigger ---------------------------------------------------------------------------------
create or replace function private.member_profiles_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and exists (select 1 from public.staff_accounts sa where sa.user_id = new.user_id) then
    raise exception using errcode = 'P0001', message = 'STAFF_ACCOUNT';
  end if;
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception using errcode = 'P0001', message = 'MEMBER_KEY_IMMUTABLE';
  end if;
  new.full_name := btrim(new.full_name);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists member_profiles_before_write on public.member_profiles;
create trigger member_profiles_before_write
  before insert or update on public.member_profiles
  for each row execute function private.member_profiles_before_write();

-- Phía ngược lại: không cấp quyền nhân sự cho tài khoản đang là thành viên.
create or replace function private.staff_accounts_not_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.member_profiles m where m.user_id = new.user_id) then
    raise exception using errcode = 'P0001', message = 'MEMBER_ACCOUNT';
  end if;
  return new;
end;
$$;

drop trigger if exists staff_accounts_not_member on public.staff_accounts;
create trigger staff_accounts_not_member
  before insert on public.staff_accounts
  for each row execute function private.staff_accounts_not_member();

-- Sổ điểm: chỉ thêm; mỗi dòng cập nhật số dư + tổng tích lũy + hạng.
create or replace function private.member_point_apply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_points integer;
begin
  update public.member_profiles m
     set points = m.points + new.delta,
         lifetime_points = m.lifetime_points + greatest(new.delta, 0),
         tier = private.member_tier_for(m.lifetime_points + greatest(new.delta, 0))
   where m.user_id = new.user_id
  returning m.points into v_points;
  if v_points is null then
    raise exception using errcode = 'P0001', message = 'MEMBER_NOT_FOUND';
  end if;
  return new;
exception
  when check_violation then
    raise exception using errcode = 'P0001', message = 'POINTS_INSUFFICIENT';
end;
$$;

drop trigger if exists member_point_apply on public.member_point_ledger;
create trigger member_point_apply
  after insert on public.member_point_ledger
  for each row execute function private.member_point_apply();

drop trigger if exists member_point_append_only on public.member_point_ledger;
create trigger member_point_append_only
  before update on public.member_point_ledger
  for each row execute function private.forbid_update();

-- Đơn hoàn tất có chủ thành viên → cộng điểm đúng 1 lần (kể cả khi nhận đơn cũ đã hoàn tất).
create or replace function private.bookings_award_member_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_points integer;
begin
  if new.status <> 'completed' or new.member_user_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'completed' and old.member_user_id is not distinct from new.member_user_id then
    return new;
  end if;
  v_points := private.member_points_for_amount(new.total_amount);
  if v_points > 0 then
    insert into public.member_point_ledger (user_id, kind, delta, reason, booking_id)
    values (new.member_user_id, 'booking', v_points, 'Tích điểm đơn ' || new.code, new.id)
    on conflict (booking_id) where kind = 'booking' do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_award_member_points on public.bookings;
create trigger bookings_award_member_points
  after insert or update of status, member_user_id on public.bookings
  for each row execute function private.bookings_award_member_points();

-- 5. RLS + quyền -----------------------------------------------------------------------------
alter table public.member_profiles enable row level security;
alter table public.member_point_ledger enable row level security;

drop policy if exists member_profiles_read on public.member_profiles;
create policy member_profiles_read on public.member_profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.can_view_members()));

drop policy if exists member_point_ledger_read on public.member_point_ledger;
create policy member_point_ledger_read on public.member_point_ledger
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.can_view_members()));

revoke all on public.member_profiles from anon, authenticated;
revoke all on public.member_point_ledger from anon, authenticated;
-- staff_note là ghi chú nội bộ: thành viên không đọc được (nhân sự đọc qua admin_get_member).
grant select (user_id, full_name, phone, login_kind, points, lifetime_points, tier, is_locked,
              must_change_password, marketing_opt_in, last_seen_at, created_at, updated_at)
  on public.member_profiles to authenticated;
grant select on public.member_point_ledger to authenticated;

-- 6. RPC phía máy chủ (service role) ---------------------------------------------------------
-- Tạo hồ sơ thành viên ngay sau khi tạo user Auth (đăng ký SĐT/email). Gọi lại an toàn.
create or replace function public.service_register_member(
  p_user_id uuid,
  p_full_name text,
  p_phone text,
  p_login_kind public.member_login_kind)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_name text := btrim(coalesce(p_full_name, ''));
begin
  perform private.require_service_role();
  if v_phone is not null then
    v_phone := private.normalize_vn_phone(v_phone);
    if v_phone is null then
      perform private.raise_error('INVALID_PHONE');
    end if;
  end if;
  if char_length(v_name) not between 2 and 80 then
    perform private.raise_error('INVALID_NAME');
  end if;
  if exists (select 1 from public.staff_accounts sa where sa.user_id = p_user_id) then
    perform private.raise_error('STAFF_ACCOUNT');
  end if;
  if exists (select 1 from public.member_profiles m where m.user_id = p_user_id) then
    return private.member_json(p_user_id);
  end if;
  begin
    insert into public.member_profiles (user_id, full_name, phone, login_kind)
    values (p_user_id, v_name, v_phone, p_login_kind);
  exception
    when unique_violation then
      perform private.raise_error('MEMBER_PHONE_TAKEN');
  end;
  perform private.member_link_customer(p_user_id, v_phone);
  return private.member_json(p_user_id);
end;
$$;

create or replace function public.service_member_phone_taken(p_phone text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_service_role();
  return exists (select 1 from public.member_profiles m where m.phone = private.normalize_vn_phone(p_phone));
end;
$$;

-- SĐT hoặc email → email Auth của THÀNH VIÊN (null nếu không có / đang khóa / là nhân sự — không lộ lý do).
-- Dùng cho đăng nhập bằng SĐT và quên mật khẩu (chỉ gửi email đặt lại cho tài khoản khách).
create or replace function public.resolve_member_login(p_login text)
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
      from public.member_profiles m join auth.users u on u.id = m.user_id
     where lower(u.email) = lower(v_login) and not m.is_locked;
    return v_email;
  end if;
  v_phone := private.normalize_vn_phone(v_login);
  if v_phone is null then
    return null;
  end if;
  select u.email into v_email
    from public.member_profiles m join auth.users u on u.id = m.user_id
   where m.phone = v_phone and not m.is_locked;
  return v_email;
end;
$$;

-- Gắn đơn vừa giữ sân (khi khách đang đăng nhập) vào thành viên.
create or replace function public.service_attach_member_booking(p_booking_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.member_profiles;
  v_customer uuid;
begin
  perform private.require_service_role();
  select * into v_member from public.member_profiles where user_id = p_user_id and not is_locked;
  if not found then
    return false;
  end if;
  update public.bookings set member_user_id = p_user_id
   where id = p_booking_id and member_user_id is null
  returning customer_id into v_customer;
  if v_customer is null then
    return false;
  end if;
  update public.member_profiles set last_seen_at = now() where user_id = p_user_id;
  -- Chỉ liên kết hồ sơ khách khi đơn đặt đúng số điện thoại của thành viên.
  if v_member.phone is not null then
    update public.customers set auth_user_id = p_user_id
     where id = v_customer and phone = v_member.phone and auth_user_id is null;
  end if;
  return true;
end;
$$;

create or replace function public.service_set_member_password_flag(p_user_id uuid, p_must_change boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_service_role();
  update public.member_profiles set must_change_password = p_must_change where user_id = p_user_id;
end;
$$;

-- 7. RPC thành viên (authenticated) ----------------------------------------------------------
-- Gọi sau đăng nhập Google / email: tạo hồ sơ nếu chưa có. Tài khoản nhân sự bị từ chối.
create or replace function public.ensure_member_profile()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_user auth.users;
  v_name text;
  v_kind public.member_login_kind;
begin
  if v_uid is null then
    perform private.raise_error('AUTH_REQUIRED');
  end if;
  if exists (select 1 from public.staff_accounts sa where sa.user_id = v_uid) then
    perform private.raise_error('STAFF_ACCOUNT');
  end if;
  if exists (select 1 from public.member_profiles m where m.user_id = v_uid) then
    if exists (select 1 from public.member_profiles m where m.user_id = v_uid and m.is_locked) then
      perform private.raise_error('MEMBER_LOCKED');
    end if;
    update public.member_profiles set last_seen_at = now() where user_id = v_uid;
    return private.member_json(v_uid);
  end if;

  select * into v_user from auth.users where id = v_uid;
  v_name := left(btrim(coalesce(
    nullif(btrim(v_user.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(v_user.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(v_user.email, ''), '@', 1))), 80);
  if char_length(v_name) < 2 then
    v_name := 'Thành viên Rally';
  end if;
  v_kind := case
    when private.member_is_alias_email(v_user.email) then 'phone'
    when coalesce(v_user.raw_app_meta_data ->> 'provider', '') = 'google' then 'google'
    else 'email' end;
  insert into public.member_profiles (user_id, full_name, login_kind, last_seen_at)
  values (v_uid, v_name, v_kind, now())
  on conflict (user_id) do nothing;
  return private.member_json(v_uid);
end;
$$;

create or replace function public.my_member_profile()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.member_json((select auth.uid()));
$$;

create or replace function public.update_my_member_profile(
  p_full_name text,
  p_phone text,
  p_marketing_opt_in boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_member public.member_profiles;
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_name text := btrim(coalesce(p_full_name, ''));
begin
  select * into v_member from public.member_profiles where user_id = v_uid for update;
  if not found then
    perform private.raise_error('MEMBER_NOT_FOUND');
  end if;
  if char_length(v_name) not between 2 and 80 then
    perform private.raise_error('INVALID_NAME');
  end if;
  if v_phone is not null then
    v_phone := private.normalize_vn_phone(v_phone);
    if v_phone is null then
      perform private.raise_error('INVALID_PHONE');
    end if;
  end if;
  -- Tài khoản đăng ký bằng SĐT: số điện thoại là tên đăng nhập, đổi tại quầy.
  if v_member.login_kind = 'phone' and v_phone is distinct from v_member.phone then
    perform private.raise_error('MEMBER_LOGIN_PHONE');
  end if;
  begin
    update public.member_profiles
       set full_name = v_name, phone = v_phone, marketing_opt_in = coalesce(p_marketing_opt_in, false)
     where user_id = v_uid;
  exception
    when unique_violation then
      perform private.raise_error('MEMBER_PHONE_TAKEN');
  end;
  if v_phone is distinct from v_member.phone then
    perform private.member_link_customer(v_uid, v_phone);
  end if;
  return private.member_json(v_uid);
end;
$$;

create or replace function private.member_booking_json(p_booking_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.booking_json(b.id) || jsonb_build_object(
    'branch_name', br.name,
    'branch_slug', br.slug,
    'branch_address', br.address_line,
    'court_name', c.name,
    'contact_name', b.contact_name,
    'contact_phone', cu.phone,
    'points_earned', (select l.delta from public.member_point_ledger l
                       where l.booking_id = b.id and l.kind = 'booking'))
  from public.bookings b
  join public.courts c on c.id = b.court_id
  join public.branches br on br.id = b.branch_id
  join public.customers cu on cu.id = b.customer_id
  where b.id = p_booking_id;
$$;

create or replace function public.my_member_bookings(p_limit integer default 100)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(private.member_booking_json(x.id) order by x.starts desc), '[]'::jsonb)
  from (
    select b.id, lower(b.during) as starts
    from public.bookings b
    where b.member_user_id = (select auth.uid()) and b.deleted_at is null
    order by lower(b.during) desc
    limit least(greatest(coalesce(p_limit, 100), 1), 300)
  ) x;
$$;

create or replace function public.my_member_booking(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select b.id into v_id from public.bookings b
   where b.code = upper(btrim(coalesce(p_code, ''))) and b.member_user_id = (select auth.uid()) and b.deleted_at is null;
  if v_id is null then
    perform private.raise_error('BOOKING_NOT_FOUND');
  end if;
  return private.member_booking_json(v_id);
end;
$$;

-- Nhận đơn cũ (đặt lúc chưa đăng nhập): phải nhập ĐÚNG mã đơn + SĐT đã dùng khi đặt.
create or replace function public.member_claim_booking(p_code text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v public.bookings;
begin
  if not exists (select 1 from public.member_profiles m where m.user_id = v_uid and not m.is_locked) then
    perform private.raise_error('MEMBER_NOT_FOUND');
  end if;
  select b.* into v
    from public.bookings b join public.customers cu on cu.id = b.customer_id
   where b.code = upper(btrim(coalesce(p_code, ''))) and cu.phone = private.normalize_vn_phone(p_phone)
     and b.deleted_at is null
   for update of b;
  if not found then
    perform private.raise_error('BOOKING_NOT_FOUND');
  end if;
  if v.member_user_id = v_uid then
    return private.member_booking_json(v.id) || jsonb_build_object('already_claimed', true);
  end if;
  if v.member_user_id is not null then
    perform private.raise_error('BOOKING_CLAIMED');
  end if;
  update public.bookings set member_user_id = v_uid where id = v.id;
  -- Có mã đơn + SĐT là đủ để coi hồ sơ khách cùng số là của thành viên.
  update public.customers cu set auth_user_id = v_uid
   where cu.id = v.customer_id and cu.auth_user_id is null
     and cu.phone = (select m.phone from public.member_profiles m where m.user_id = v_uid);
  return private.member_booking_json(v.id);
end;
$$;

-- Thành viên tự hủy đơn của mình (cùng luật với khách tự hủy).
create or replace function public.member_cancel_booking(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v public.bookings;
begin
  select b.id into v_id from public.bookings b
   where b.code = upper(btrim(coalesce(p_code, ''))) and b.member_user_id = (select auth.uid()) and b.deleted_at is null;
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
  perform private.set_audit_reason('member cancel');
  update public.bookings
     set status = 'cancelled',
         status_reason = 'Thành viên tự hủy trên website',
         refund_entitlement = private.refund_entitlement(v, false)
   where id = v.id;
  return private.member_booking_json(v.id);
end;
$$;

-- 8. RPC quản trị ----------------------------------------------------------------------------
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
  with base as (
    select m.*, u.email, u.last_sign_in_at,
           (select count(*) from public.bookings b where b.member_user_id = m.user_id and b.deleted_at is null) as booking_count,
           (select cu.id from public.customers cu where cu.auth_user_id = m.user_id) as customer_id
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
        from (select * from base order by created_at desc
              limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0)) x), '[]'::jsonb),
    'summary', jsonb_build_object(
      'members', (select count(*) from public.member_profiles),
      'new_30d', (select count(*) from public.member_profiles where created_at > now() - interval '30 days'),
      'with_phone', (select count(*) from public.member_profiles where phone is not null),
      'locked', (select count(*) from public.member_profiles where is_locked)))
  into v_result;
  return v_result;
end;
$$;

create or replace function public.admin_get_member(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not private.can_view_members() then
    perform private.raise_error('PERMISSION_DENIED', 'booking.view');
  end if;
  select private.member_json(m.user_id) || jsonb_build_object(
           'staff_note', m.staff_note,
           'last_sign_in_at', u.last_sign_in_at,
           'last_seen_at', m.last_seen_at,
           'providers', coalesce(u.raw_app_meta_data -> 'providers', '[]'::jsonb),
           'customer', (select jsonb_build_object('id', cu.id, 'full_name', cu.full_name, 'phone', cu.phone)
                          from public.customers cu where cu.auth_user_id = m.user_id),
           'stats', jsonb_build_object(
             'bookings', (select count(*) from public.bookings b where b.member_user_id = m.user_id and b.deleted_at is null),
             'completed', (select count(*) from public.bookings b where b.member_user_id = m.user_id and b.status = 'completed'),
             'no_show', (select count(*) from public.bookings b where b.member_user_id = m.user_id and b.status = 'no_show'),
             'spent', (select coalesce(sum(b.total_amount), 0) from public.bookings b
                        where b.member_user_id = m.user_id and b.status in ('checked_in', 'completed'))))
    into v_result
    from public.member_profiles m join auth.users u on u.id = m.user_id
   where m.user_id = p_user_id;
  return v_result;
end;
$$;

create or replace function public.admin_update_member(
  p_user_id uuid,
  p_full_name text,
  p_phone text,
  p_staff_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.member_profiles;
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_name text := btrim(coalesce(p_full_name, ''));
begin
  perform private.require_owner();
  select * into v_member from public.member_profiles where user_id = p_user_id for update;
  if not found then
    perform private.raise_error('MEMBER_NOT_FOUND');
  end if;
  if char_length(v_name) not between 2 and 80 then
    perform private.raise_error('INVALID_NAME');
  end if;
  if v_phone is not null then
    v_phone := private.normalize_vn_phone(v_phone);
    if v_phone is null then
      perform private.raise_error('INVALID_PHONE');
    end if;
  end if;
  if v_member.login_kind = 'phone' and v_phone is distinct from v_member.phone then
    perform private.raise_error('MEMBER_LOGIN_PHONE');
  end if;
  begin
    update public.member_profiles
       set full_name = v_name, phone = v_phone,
           staff_note = nullif(btrim(coalesce(p_staff_note, '')), '')
     where user_id = p_user_id;
  exception
    when unique_violation then
      perform private.raise_error('MEMBER_PHONE_TAKEN');
  end;
  if v_phone is distinct from v_member.phone then
    perform private.member_link_customer(p_user_id, v_phone);
  end if;
  return public.admin_get_member(p_user_id);
end;
$$;

create or replace function public.admin_adjust_member_points(p_user_id uuid, p_delta integer, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_owner();
  if coalesce(p_delta, 0) = 0 or abs(p_delta) > 100000 then
    perform private.raise_error('INVALID_POINTS');
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    perform private.raise_error('REASON_REQUIRED');
  end if;
  insert into public.member_point_ledger (user_id, kind, delta, reason, created_by)
  values (p_user_id, 'adjust', p_delta, btrim(p_reason), (select auth.uid()));
  return public.admin_get_member(p_user_id);
end;
$$;

create or replace function public.admin_set_member_locked(p_user_id uuid, p_locked boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_owner();
  update public.member_profiles set is_locked = coalesce(p_locked, false) where user_id = p_user_id;
  if not found then
    perform private.raise_error('MEMBER_NOT_FOUND');
  end if;
  return public.admin_get_member(p_user_id);
end;
$$;

-- 9. Cấp quyền gọi hàm -----------------------------------------------------------------------
revoke all on function public.service_register_member(uuid, text, text, public.member_login_kind) from public, anon, authenticated;
revoke all on function public.service_member_phone_taken(text) from public, anon, authenticated;
revoke all on function public.resolve_member_login(text) from public, anon, authenticated;
revoke all on function public.service_attach_member_booking(uuid, uuid) from public, anon, authenticated;
revoke all on function public.service_set_member_password_flag(uuid, boolean) from public, anon, authenticated;
grant execute on function public.service_register_member(uuid, text, text, public.member_login_kind) to service_role;
grant execute on function public.service_member_phone_taken(text) to service_role;
grant execute on function public.resolve_member_login(text) to service_role;
grant execute on function public.service_attach_member_booking(uuid, uuid) to service_role;
grant execute on function public.service_set_member_password_flag(uuid, boolean) to service_role;

revoke all on function public.ensure_member_profile() from public, anon;
revoke all on function public.my_member_profile() from public, anon;
revoke all on function public.update_my_member_profile(text, text, boolean) from public, anon;
revoke all on function public.my_member_bookings(integer) from public, anon;
revoke all on function public.my_member_booking(text) from public, anon;
revoke all on function public.member_claim_booking(text, text) from public, anon;
revoke all on function public.member_cancel_booking(text) from public, anon;
revoke all on function public.admin_list_members(text, text, integer, integer) from public, anon;
revoke all on function public.admin_get_member(uuid) from public, anon;
revoke all on function public.admin_update_member(uuid, text, text, text) from public, anon;
revoke all on function public.admin_adjust_member_points(uuid, integer, text) from public, anon;
revoke all on function public.admin_set_member_locked(uuid, boolean) from public, anon;
grant execute on function public.ensure_member_profile() to authenticated;
grant execute on function public.my_member_profile() to authenticated;
grant execute on function public.update_my_member_profile(text, text, boolean) to authenticated;
grant execute on function public.my_member_bookings(integer) to authenticated;
grant execute on function public.my_member_booking(text) to authenticated;
grant execute on function public.member_claim_booking(text, text) to authenticated;
grant execute on function public.member_cancel_booking(text) to authenticated;
grant execute on function public.admin_list_members(text, text, integer, integer) to authenticated;
grant execute on function public.admin_get_member(uuid) to authenticated;
grant execute on function public.admin_update_member(uuid, text, text, text) to authenticated;
grant execute on function public.admin_adjust_member_points(uuid, integer, text) to authenticated;
grant execute on function public.admin_set_member_locked(uuid, boolean) to authenticated;

revoke all on function private.member_tier_for(integer) from public;
revoke all on function private.member_points_for_amount(bigint) from public;
revoke all on function private.member_link_customer(uuid, text) from public;
revoke all on function private.can_view_members() from public;
revoke all on function private.member_json(uuid) from public;
revoke all on function private.member_booking_json(uuid) from public;
revoke all on function private.member_is_alias_email(text) from public;
revoke all on function private.member_profiles_before_write() from public;
revoke all on function private.staff_accounts_not_member() from public;
revoke all on function private.member_point_apply() from public;
revoke all on function private.bookings_award_member_points() from public;
-- Dùng trong chính sách RLS nên người gọi (authenticated) cần quyền chạy.
grant execute on function private.can_view_members() to authenticated, service_role;

commit;

notify pgrst, 'reload schema';
