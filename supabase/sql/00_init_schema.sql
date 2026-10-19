-- =============================================================================
-- RALLY BADMINTON — 00_init_schema.sql
-- Khởi tạo toàn bộ cấu trúc dữ liệu cho một Supabase project MỚI.
--
-- Phạm vi : enum, bảng, khóa ngoại, ràng buộc, index, trigger toàn vẹn,
--           hàm hỗ trợ phân quyền, RLS từng bảng, quyền (GRANT), Storage, seed tham chiếu.
-- Không gồm: RPC nghiệp vụ (giữ sân, thanh toán, bán hàng, thuê, chấm công, chốt lương)
--           -> chạy tiếp 01_core_rpc.sql.
-- Cách chạy: Supabase Dashboard > SQL Editor > dán toàn bộ file > Run (một lần duy nhất).
--           Script chạy trong 1 transaction: lỗi ở đâu thì rollback toàn bộ.
-- Quy ước : tiền là VND số nguyên; thời điểm dùng timestamptz; giờ địa phương theo
--           branches.timezone (mặc định Asia/Ho_Chi_Minh).
-- Bảo mật : RLS bật trên MỌI bảng; mọi thao tác tiền/booking/kho/chấm công chỉ ghi qua RPC
--           SECURITY DEFINER; service_role chỉ dùng ở server Next.js.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. Chặn chạy nhầm trên database cũ hoặc chạy lại lần hai
-- -----------------------------------------------------------------------------
do $guard$
begin
  if to_regclass('public.venues') is not null
     or to_regclass('public.rally_items') is not null
     or to_regclass('public.branches') is not null then
    raise exception using
      message = 'RALLY_INIT_ABORTED: database này đã có schema (cũ hoặc đã khởi tạo).',
      hint = 'Chạy 00_init_schema.sql trên một Supabase project mới, trống.';
  end if;
end
$guard$;

-- -----------------------------------------------------------------------------
-- 1. Extension & schema
-- -----------------------------------------------------------------------------
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;  -- uuid "=" trong exclusion constraint

-- Schema "private" KHÔNG được PostgREST expose: chứa hàm phân quyền/trigger.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. Enum
-- -----------------------------------------------------------------------------
create type public.app_role as enum ('owner', 'staff');

create type public.app_permission as enum (
  'booking.view',       -- xem booking của chi nhánh
  'booking.confirm',    -- xác nhận giữ sân            (cần booking.view)
  'booking.operate',    -- tạo tại quầy, đổi, hủy, check-in, no-show, khóa sân (cần booking.view)
  'payment.record',     -- ghi nhận tiền thu thủ công  (cần booking.view)
  'catalog.view',       -- xem danh mục & tồn kho chi nhánh
  'catalog.edit',       -- sửa danh mục sản phẩm (toàn thương hiệu)  (cần catalog.view)
  'inventory.adjust',   -- điều chỉnh/kiểm kê tồn kho chi nhánh      (cần catalog.view)
  'sale.record',        -- bán hàng tại quầy                         (cần catalog.view)
  'rental.operate',     -- cho thuê & nhận trả thiết bị              (cần catalog.view)
  'shift.view_branch'   -- xem lịch ca của cả chi nhánh (không gồm lương)
);

create type public.branch_status   as enum ('draft', 'published', 'paused', 'archived');
create type public.court_status    as enum ('active', 'maintenance', 'retired');
create type public.booking_kind    as enum ('customer', 'block');
create type public.booking_source  as enum ('online', 'counter', 'recurring', 'system');
create type public.booking_status  as enum ('held', 'confirmed', 'checked_in', 'completed', 'cancelled', 'expired', 'no_show');
create type public.recurring_status as enum ('active', 'ended', 'cancelled');
create type public.payment_kind    as enum ('charge', 'refund');
create type public.payment_method  as enum ('cash', 'bank_transfer', 'card', 'e_wallet', 'gateway');
create type public.payment_status  as enum ('pending', 'succeeded', 'failed', 'voided');
create type public.product_kind    as enum ('sale', 'rental');
create type public.sale_status     as enum ('completed', 'voided');
create type public.rental_status   as enum ('out', 'returned', 'voided');
create type public.stock_reason    as enum (
  'opening', 'purchase', 'sale', 'sale_void', 'rental_out', 'rental_return',
  'adjustment', 'damage', 'loss', 'count_correction'
);
create type public.employee_status  as enum ('active', 'inactive');
create type public.employment_type  as enum ('full_time', 'part_time');
create type public.pay_type         as enum ('hourly', 'daily');
create type public.attendance_status as enum ('scheduled', 'present', 'absent', 'leave', 'cancelled');

-- -----------------------------------------------------------------------------
-- 3. Hàm tiện ích chung (không đụng bảng)
-- -----------------------------------------------------------------------------
create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

-- Dữ liệu lịch sử không bao giờ bị xóa cứng (kể cả service_role).
create function private.forbid_hard_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = 'P0001',
    message = 'HARD_DELETE_FORBIDDEN',
    detail  = pg_catalog.format('Bảng %I.%I chỉ cho phép soft-delete / đổi trạng thái.', tg_table_schema, tg_table_name);
end;
$$;

-- Mã ngắn dễ đọc (bỏ ký tự dễ nhầm: 0 O 1 I L U). Ví dụ: RB-7K3M9Q2T
create function private.random_code(p_prefix text, p_length integer default 8)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_bytes bytea := pg_catalog.uuid_send(pg_catalog.gen_random_uuid())
                || pg_catalog.uuid_send(pg_catalog.gen_random_uuid());
  v_out text := '';
  i integer;
begin
  if p_length < 4 or p_length > 16 then
    raise exception 'INVALID_CODE_LENGTH';
  end if;
  for i in 0 .. p_length - 1 loop
    -- bỏ qua byte version/variant (6, 8) của UUID v4
    v_out := v_out || pg_catalog.substr(
      v_alphabet,
      (pg_catalog.get_byte(v_bytes, case when i < 6 then i else i + 3 end) % 30) + 1,
      1);
  end loop;
  return p_prefix || '-' || v_out;
end;
$$;

-- Quyền phụ thuộc: ví dụ booking.confirm chỉ có hiệu lực khi có booking.view.
create function private.permission_prerequisite(p_permission public.app_permission)
returns public.app_permission
language sql
immutable
set search_path = ''
as $$
  select case p_permission
    when 'booking.confirm'  then 'booking.view'::public.app_permission
    when 'booking.operate'  then 'booking.view'::public.app_permission
    when 'payment.record'   then 'booking.view'::public.app_permission
    when 'catalog.edit'     then 'catalog.view'::public.app_permission
    when 'inventory.adjust' then 'catalog.view'::public.app_permission
    when 'sale.record'      then 'catalog.view'::public.app_permission
    when 'rental.operate'   then 'catalog.view'::public.app_permission
    else null
  end;
$$;

-- =============================================================================
-- 4. BẢNG
-- =============================================================================

-- 4.1 Thương hiệu (singleton) ---------------------------------------------------
create table public.brand_settings (
  id          boolean primary key default true constraint brand_settings_singleton check (id),
  name        text not null constraint brand_name_len check (char_length(btrim(name)) between 2 and 80),
  hotline     text,
  email       text,
  website_url text,
  facebook_url text,
  zalo_url    text,
  updated_at  timestamptz not null default now()
);
comment on table public.brand_settings is 'Thông tin thương hiệu Rally (luôn đúng 1 dòng).';

-- 4.2 Danh mục tham chiếu ----------------------------------------------------
create table public.amenities (
  code       text primary key constraint amenities_code_fmt check (code ~ '^[a-z][a-z0-9_]{1,39}$'),
  label      text not null constraint amenities_label_len check (char_length(btrim(label)) between 2 and 60),
  icon       text,
  sort_order smallint not null default 0
);

create table public.court_surfaces (
  code       text primary key constraint court_surfaces_code_fmt check (code ~ '^[a-z][a-z0-9_]{1,39}$'),
  label      text not null constraint court_surfaces_label_len check (char_length(btrim(label)) between 2 and 60),
  sort_order smallint not null default 0
);

-- 4.3 Chi nhánh ----------------------------------------------------------------
create table public.branches (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text not null constraint branches_slug_key unique
                           constraint branches_slug_fmt check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  name                   text not null constraint branches_name_len check (char_length(btrim(name)) between 2 and 120),
  address_line           text not null default '' constraint branches_address_len check (char_length(address_line) <= 250),
  ward                   text,
  district               text,
  city                   text not null default 'TP. Hồ Chí Minh',
  phone                  text constraint branches_phone_fmt check (phone is null or phone ~ '^[0-9+ ]{8,20}$'),
  latitude               numeric(9, 6) constraint branches_lat check (latitude is null or latitude between -90 and 90),
  longitude              numeric(9, 6) constraint branches_lng check (longitude is null or longitude between -180 and 180),
  map_url                text,
  timezone               text not null default 'Asia/Ho_Chi_Minh',
  opens_at               time not null default '06:00',
  closes_at              time not null default '23:00',   -- cho phép '24:00'
  slot_minutes           smallint not null default 30 constraint branches_slot check (slot_minutes in (30, 60)),
  hold_minutes           smallint not null default 10 constraint branches_hold check (hold_minutes between 5 and 30),
  min_booking_minutes    smallint not null default 60,
  max_booking_minutes    smallint not null default 240,
  booking_window_days    smallint not null default 30 constraint branches_window check (booking_window_days between 1 and 90),
  deposit_percent        smallint not null default 30 constraint branches_deposit check (deposit_percent between 0 and 100),
  free_cancel_hours      smallint not null default 24,
  partial_refund_hours   smallint not null default 6,
  partial_refund_percent smallint not null default 50 constraint branches_partial_pct check (partial_refund_percent between 0 and 100),
  description            text constraint branches_desc_len check (description is null or char_length(description) <= 2000),
  parking_info           text constraint branches_parking_len check (parking_info is null or char_length(parking_info) <= 500),
  house_rules            text constraint branches_rules_len check (house_rules is null or char_length(house_rules) <= 2000),
  cover_image_path       text,
  status                 public.branch_status not null default 'draft',
  published_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz,
  constraint branches_hours check (closes_at > opens_at),
  constraint branches_hours_aligned check (
    extract(second from opens_at) = 0 and extract(second from closes_at) = 0
    and extract(minute from opens_at)::int % 30 = 0 and extract(minute from closes_at)::int % 30 = 0),
  constraint branches_booking_len check (
    min_booking_minutes >= slot_minutes and max_booking_minutes >= min_booking_minutes
    and max_booking_minutes <= 720 and min_booking_minutes % slot_minutes = 0 and max_booking_minutes % slot_minutes = 0),
  constraint branches_cancel_policy check (free_cancel_hours >= partial_refund_hours and partial_refund_hours >= 0),
  constraint branches_cover_path check (cover_image_path is null or cover_image_path like 'branches/' || id::text || '/%'),
  constraint branches_deleted_archived check (deleted_at is null or status = 'archived')
);
comment on table public.branches is 'Chi nhánh của thương hiệu Rally. Không có club_id: hệ thống chỉ phục vụ một thương hiệu.';

create table public.branch_amenities (
  branch_id    uuid not null references public.branches (id) on delete cascade,
  amenity_code text not null references public.amenities (code) on update cascade,
  primary key (branch_id, amenity_code)
);
create index branch_amenities_amenity_idx on public.branch_amenities (amenity_code);

-- 4.4 Sân ----------------------------------------------------------------------
create table public.courts (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid not null references public.branches (id),
  name         text not null constraint courts_name_len check (char_length(btrim(name)) between 1 and 60),
  surface_code text references public.court_surfaces (code) on update cascade,
  is_indoor    boolean not null default true,
  status       public.court_status not null default 'active',
  sort_order   smallint not null default 0,
  description  text constraint courts_desc_len check (description is null or char_length(description) <= 800),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  constraint courts_id_branch_key unique (id, branch_id),   -- đích cho FK ghép (court_id, branch_id)
  constraint courts_deleted_retired check (deleted_at is null or status = 'retired')
);
create unique index courts_branch_name_uidx on public.courts (branch_id, lower(name)) where deleted_at is null;
create index courts_branch_sort_idx on public.courts (branch_id, sort_order) where deleted_at is null;
create index courts_surface_idx on public.courts (surface_code);

create table public.court_photos (
  id           uuid primary key default gen_random_uuid(),
  court_id     uuid not null references public.courts (id) on delete cascade,
  storage_path text not null constraint court_photos_path_key unique,
  alt_text     text constraint court_photos_alt_len check (alt_text is null or char_length(alt_text) <= 150),
  sort_order   smallint not null default 0,
  is_cover     boolean not null default false,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint court_photos_path_fmt check (
    storage_path ~ ('^courts/' || court_id::text || '/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'))
);
create index court_photos_court_sort_idx on public.court_photos (court_id, sort_order, created_at);
create unique index court_photos_one_cover_uidx on public.court_photos (court_id) where is_cover;

-- 4.5 Bảng giá -------------------------------------------------------------------
-- days_mask: bit 0 = Thứ 2 ... bit 6 = Chủ nhật. 31 = T2–T6, 96 = T7–CN, 127 = cả tuần.
create table public.price_rules (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid not null references public.branches (id),
  court_id       uuid,                         -- null = giá mặc định cho mọi sân của chi nhánh
  label          text constraint price_rules_label_len check (label is null or char_length(label) <= 60),
  days_mask      smallint not null constraint price_rules_days check (days_mask between 1 and 127),
  starts_at      time not null,
  ends_at        time not null,                -- cho phép '24:00'
  price_per_hour integer not null constraint price_rules_price check (price_per_hour between 1000 and 10000000),
  priority       smallint not null default 0 constraint price_rules_priority check (priority between -100 and 100),
  valid_from     date,
  valid_until    date,
  is_active      boolean not null default true,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  constraint price_rules_court_fk foreign key (court_id, branch_id) references public.courts (id, branch_id),
  constraint price_rules_time check (starts_at < ends_at),
  constraint price_rules_time_aligned check (
    extract(second from starts_at) = 0 and extract(second from ends_at) = 0
    and extract(minute from starts_at)::int % 30 = 0 and extract(minute from ends_at)::int % 30 = 0),
  constraint price_rules_validity check (valid_from is null or valid_until is null or valid_until >= valid_from),
  constraint price_rules_deleted_inactive check (deleted_at is null or not is_active)
);
create index price_rules_branch_lookup_idx on public.price_rules (branch_id, court_id, priority desc)
  where is_active and deleted_at is null;
create index price_rules_court_idx on public.price_rules (court_id, branch_id) where court_id is not null;

-- 4.6 Khách hàng ----------------------------------------------------------------
create table public.customers (
  id               uuid primary key default gen_random_uuid(),
  phone            text not null constraint customers_phone_key unique
                     constraint customers_phone_fmt check (phone ~ '^0[35789][0-9]{8}$'),
  full_name        text not null constraint customers_name_len check (char_length(btrim(full_name)) between 2 and 80),
  email            text constraint customers_email_fmt check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  auth_user_id     uuid references auth.users (id) on delete set null,
  staff_note       text constraint customers_note_len check (staff_note is null or char_length(staff_note) <= 500),
  marketing_opt_in boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index customers_auth_user_uidx on public.customers (auth_user_id) where auth_user_id is not null;
comment on table public.customers is 'Khách đặt sân/mua/thuê, định danh bằng số điện thoại VN (0xxxxxxxxx).';

-- 4.7 Lịch cố định (đặt sân định kỳ — P1) --------------------------------------
create table public.recurring_series (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null,
  court_id    uuid not null,
  customer_id uuid not null references public.customers (id),
  iso_dow     smallint not null constraint recurring_dow check (iso_dow between 1 and 7),
  starts_at   time not null,
  ends_at     time not null,
  valid_from  date not null,
  valid_until date not null,
  status      public.recurring_status not null default 'active',
  note        text constraint recurring_note_len check (note is null or char_length(note) <= 500),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint recurring_court_fk foreign key (court_id, branch_id) references public.courts (id, branch_id),
  constraint recurring_time check (starts_at < ends_at),
  constraint recurring_validity check (valid_from <= valid_until and valid_until - valid_from <= 366)
);
create index recurring_series_court_idx on public.recurring_series (court_id, branch_id);
create index recurring_series_customer_idx on public.recurring_series (customer_id);
create index recurring_series_branch_idx on public.recurring_series (branch_id, status);

-- 4.8 Booking ------------------------------------------------------------------
create table public.bookings (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null default private.random_code('RB') constraint bookings_code_key unique,
  branch_id           uuid not null,
  court_id            uuid not null,
  kind                public.booking_kind not null default 'customer',
  source              public.booking_source not null,
  status              public.booking_status not null default 'held',
  during              tstzrange not null,
  customer_id         uuid references public.customers (id),
  contact_name        text constraint bookings_contact_len check (contact_name is null or char_length(btrim(contact_name)) between 2 and 80),
  hold_expires_at     timestamptz,
  subtotal_amount     integer not null default 0 constraint bookings_subtotal check (subtotal_amount >= 0),
  discount_amount     integer not null default 0,
  total_amount        integer generated always as (subtotal_amount - discount_amount) stored,
  deposit_amount      integer not null default 0,
  price_snapshot      jsonb not null default '[]'::jsonb,
  refund_entitlement  integer constraint bookings_refund_entitlement check (refund_entitlement is null or refund_entitlement >= 0),
  recurring_series_id uuid references public.recurring_series (id),
  customer_note       text constraint bookings_customer_note_len check (customer_note is null or char_length(customer_note) <= 300),
  internal_note       text constraint bookings_internal_note_len check (internal_note is null or char_length(internal_note) <= 500),
  status_reason       text constraint bookings_status_reason_len check (status_reason is null or char_length(btrim(status_reason)) between 3 and 300),
  idempotency_key     text constraint bookings_idem_len check (idempotency_key is null or char_length(idempotency_key) between 8 and 100),
  created_by          uuid references auth.users (id) on delete set null,
  confirmed_at        timestamptz,
  confirmed_by        uuid references auth.users (id) on delete set null,
  checked_in_at       timestamptz,
  checked_in_by       uuid references auth.users (id) on delete set null,
  completed_at        timestamptz,
  cancelled_at        timestamptz,
  cancelled_by        uuid references auth.users (id) on delete set null,
  status_changed_at   timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  constraint bookings_court_fk foreign key (court_id, branch_id) references public.courts (id, branch_id),
  constraint bookings_during_valid check (
    not isempty(during) and not lower_inf(during) and not upper_inf(during)
    and lower_inc(during) and not upper_inc(during)),
  constraint bookings_amounts check (
    discount_amount between 0 and subtotal_amount
    and deposit_amount between 0 and (subtotal_amount - discount_amount)),
  constraint bookings_party check (
    (kind = 'customer' and customer_id is not null and contact_name is not null)
    or (kind = 'block' and customer_id is null and subtotal_amount = 0 and deposit_amount = 0 and internal_note is not null)),
  constraint bookings_hold_expiry check (status <> 'held' or hold_expires_at is not null),
  constraint bookings_reason_required check (status not in ('cancelled', 'no_show') or status_reason is not null),
  constraint bookings_archive_terminal check (deleted_at is null or status in ('completed', 'cancelled', 'expired', 'no_show')),
  -- KHÓA CHỐNG ĐẶT TRÙNG: hai booking đang hiệu lực không được chồng giờ trên cùng sân.
  constraint bookings_no_overlap exclude using gist (court_id with =, during with &&)
    where (status in ('held', 'confirmed', 'checked_in'))
);
create unique index bookings_idempotency_uidx on public.bookings (idempotency_key) where idempotency_key is not null;
create index bookings_branch_during_gist on public.bookings using gist (branch_id, during);
create index bookings_customer_idx on public.bookings (customer_id, created_at desc) where customer_id is not null;
create index bookings_held_expiry_idx on public.bookings (hold_expires_at) where status = 'held';
create index bookings_recurring_idx on public.bookings (recurring_series_id) where recurring_series_id is not null;
create index bookings_confirmed_end_idx on public.bookings (upper(during)) where status in ('confirmed', 'checked_in');
comment on column public.bookings.price_snapshot is 'Ảnh chụp giá tại thời điểm giữ/đổi lịch; bảng giá đổi sau không ảnh hưởng booking cũ.';
comment on column public.bookings.refund_entitlement is 'Số tiền khách được hoàn theo chính sách tại lúc hủy (tiền hoàn thực tế nằm ở payments).';

-- 4.9 Danh mục sản phẩm -----------------------------------------------------------
create table public.product_categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null constraint product_categories_slug_key unique
               constraint product_categories_slug_fmt check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name       text not null constraint product_categories_name_len check (char_length(btrim(name)) between 2 and 60),
  sort_order smallint not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id               uuid primary key default gen_random_uuid(),
  kind             public.product_kind not null,
  category_id      uuid references public.product_categories (id),
  name             text not null constraint products_name_len check (char_length(btrim(name)) between 2 and 150),
  slug             text constraint products_slug_key unique
                     constraint products_slug_fmt check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description      text constraint products_desc_len check (description is null or char_length(description) <= 4000),
  brand_name       text constraint products_brand_len check (brand_name is null or char_length(brand_name) <= 60),
  base_price       integer constraint products_base_price check (base_price is null or base_price between 0 and 100000000),
  compare_at_price integer,
  is_bundle        boolean not null default false,
  is_active        boolean not null default true,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  constraint products_sale_price check (kind <> 'sale' or base_price is not null),
  constraint products_compare_price check (compare_at_price is null or (base_price is not null and compare_at_price > base_price)),
  constraint products_bundle_rental check (not is_bundle or kind = 'rental'),
  constraint products_deleted_inactive check (deleted_at is null or not is_active)
);
create index products_kind_active_idx on public.products (kind, is_active) where deleted_at is null;
create index products_category_idx on public.products (category_id);
comment on table public.products is 'Danh mục sản phẩm dùng chung toàn thương hiệu; tồn kho tách theo chi nhánh ở inventory_levels.';

-- Mọi sản phẩm có >= 1 biến thể (biến thể mặc định nếu không có size/màu) => một nguồn tồn kho duy nhất.
create table public.product_variants (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products (id),
  sku            text not null constraint product_variants_sku_key unique
                   constraint product_variants_sku_fmt check (sku ~ '^[A-Z0-9][A-Z0-9._-]{1,39}$'),
  size_label     text constraint product_variants_size_len check (size_label is null or char_length(size_label) <= 30),
  color_label    text constraint product_variants_color_len check (color_label is null or char_length(color_label) <= 30),
  price_override integer constraint product_variants_price check (price_override is null or price_override between 0 and 100000000),
  is_default     boolean not null default false,
  is_active      boolean not null default true,
  sort_order     smallint not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  constraint product_variants_id_product_key unique (id, product_id),
  constraint product_variants_deleted_inactive check (deleted_at is null or not is_active)
);
create index product_variants_product_idx on public.product_variants (product_id, sort_order);
create unique index product_variants_one_default_uidx on public.product_variants (product_id) where is_default and deleted_at is null;
create unique index product_variants_options_uidx on public.product_variants
  (product_id, coalesce(lower(size_label), ''), coalesce(lower(color_label), '')) where deleted_at is null;

create table public.product_photos (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  storage_path text not null constraint product_photos_path_key unique,
  alt_text     text constraint product_photos_alt_len check (alt_text is null or char_length(alt_text) <= 150),
  sort_order   smallint not null default 0,
  is_cover     boolean not null default false,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint product_photos_path_fmt check (
    storage_path ~ ('^products/' || product_id::text || '/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'))
);
create index product_photos_product_sort_idx on public.product_photos (product_id, sort_order, created_at);
create unique index product_photos_one_cover_uidx on public.product_photos (product_id) where is_cover;

-- Giá thuê theo thời lượng (không còn cố định 1h/2h/day).
create table public.rental_rates (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references public.products (id) on delete cascade,
  label            text not null constraint rental_rates_label_len check (char_length(btrim(label)) between 1 and 40),
  duration_minutes integer not null constraint rental_rates_duration check (duration_minutes between 15 and 10080),
  price            integer not null constraint rental_rates_price check (price between 1000 and 100000000),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint rental_rates_product_duration_key unique (product_id, duration_minutes)
);

-- Thành phần combo thuê: trỏ thẳng tới biến thể thành phần.
create table public.bundle_components (
  bundle_product_id    uuid not null references public.products (id) on delete cascade,
  component_variant_id uuid not null references public.product_variants (id),
  quantity             smallint not null constraint bundle_components_qty check (quantity between 1 and 50),
  primary key (bundle_product_id, component_variant_id)
);
create index bundle_components_variant_idx on public.bundle_components (component_variant_id);

-- 4.10 Tồn kho theo chi nhánh + sổ biến động ---------------------------------------
create table public.inventory_levels (
  branch_id     uuid not null references public.branches (id),
  variant_id    uuid not null references public.product_variants (id),
  on_hand       integer not null default 0 constraint inventory_on_hand_non_negative check (on_hand >= 0),
  reorder_level integer not null default 0 constraint inventory_reorder check (reorder_level >= 0),
  is_listed     boolean not null default true,
  updated_at    timestamptz not null default now(),
  primary key (branch_id, variant_id)
);
create index inventory_levels_variant_idx on public.inventory_levels (variant_id);
comment on column public.inventory_levels.on_hand is 'Số lượng đang có trên kệ. CHỈ thay đổi qua stock_movements (trigger chặn sửa tay).';

-- 4.11 Bán hàng -----------------------------------------------------------------------
create table public.sales (
  id              uuid primary key default gen_random_uuid(),
  code            text not null default private.random_code('RS') constraint sales_code_key unique,
  branch_id       uuid not null references public.branches (id),
  customer_id     uuid references public.customers (id),
  status          public.sale_status not null default 'completed',
  subtotal_amount bigint not null constraint sales_subtotal check (subtotal_amount >= 0),
  discount_amount bigint not null default 0,
  total_amount    bigint generated always as (subtotal_amount - discount_amount) stored,
  note            text constraint sales_note_len check (note is null or char_length(note) <= 300),
  idempotency_key text constraint sales_idem_len check (idempotency_key is null or char_length(idempotency_key) between 8 and 100),
  sold_by         uuid references auth.users (id) on delete set null,
  sold_at         timestamptz not null default now(),
  voided_at       timestamptz,
  voided_by       uuid references auth.users (id) on delete set null,
  void_reason     text,
  constraint sales_discount check (discount_amount between 0 and subtotal_amount),
  constraint sales_void_fields check (
    (status = 'completed' and voided_at is null and void_reason is null)
    or (status = 'voided' and voided_at is not null and char_length(btrim(void_reason)) >= 3))
);
create unique index sales_idempotency_uidx on public.sales (idempotency_key) where idempotency_key is not null;
create index sales_branch_sold_idx on public.sales (branch_id, sold_at desc);
create index sales_customer_idx on public.sales (customer_id) where customer_id is not null;

create table public.sale_lines (
  id            uuid primary key default gen_random_uuid(),
  sale_id       uuid not null references public.sales (id),
  variant_id    uuid not null references public.product_variants (id),
  product_name  text not null,      -- ảnh chụp tên tại thời điểm bán (in hóa đơn)
  variant_label text,
  quantity      integer not null constraint sale_lines_qty check (quantity between 1 and 1000),
  unit_price    integer not null constraint sale_lines_price check (unit_price between 0 and 100000000),
  line_total    bigint generated always as (quantity::bigint * unit_price) stored
);
create index sale_lines_sale_idx on public.sale_lines (sale_id);
create index sale_lines_variant_idx on public.sale_lines (variant_id);

-- 4.12 Cho thuê -----------------------------------------------------------------------
create table public.rentals (
  id               uuid primary key default gen_random_uuid(),
  code             text not null default private.random_code('RT') constraint rentals_code_key unique,
  branch_id        uuid not null references public.branches (id),
  customer_id      uuid not null references public.customers (id),
  product_id       uuid not null references public.products (id),   -- món/combo khách chọn
  rate_label       text not null,                                    -- ảnh chụp giá thuê
  duration_minutes integer not null constraint rentals_duration check (duration_minutes between 15 and 10080),
  unit_price       integer not null constraint rentals_unit_price check (unit_price >= 0),
  quantity         integer not null constraint rentals_qty check (quantity between 1 and 50),
  rental_fee       bigint generated always as (quantity::bigint * unit_price) stored,
  late_fee         integer not null default 0 constraint rentals_late_fee check (late_fee >= 0),
  damage_fee       integer not null default 0 constraint rentals_damage_fee check (damage_fee >= 0),
  status           public.rental_status not null default 'out',
  starts_at        timestamptz not null default now(),
  due_at           timestamptz not null,
  returned_at      timestamptz,
  note             text constraint rentals_note_len check (note is null or char_length(note) <= 300),
  idempotency_key  text constraint rentals_idem_len check (idempotency_key is null or char_length(idempotency_key) between 8 and 100),
  created_by       uuid references auth.users (id) on delete set null,
  returned_by      uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint rentals_due check (due_at > starts_at),
  constraint rentals_status_fields check (
    (status = 'out' and returned_at is null)
    or (status = 'returned' and returned_at is not null)
    or (status = 'voided'))
);
create unique index rentals_idempotency_uidx on public.rentals (idempotency_key) where idempotency_key is not null;
create index rentals_branch_status_due_idx on public.rentals (branch_id, status, due_at);
create index rentals_customer_idx on public.rentals (customer_id);
create index rentals_product_idx on public.rentals (product_id);

create table public.rental_lines (
  id                uuid primary key default gen_random_uuid(),
  rental_id         uuid not null references public.rentals (id),
  variant_id        uuid not null references public.product_variants (id),
  quantity          integer not null constraint rental_lines_qty check (quantity between 1 and 1000),
  returned_quantity integer not null default 0,
  damaged_quantity  integer not null default 0,
  lost_quantity     integer not null default 0,
  constraint rental_lines_return_qty check (
    returned_quantity >= 0 and damaged_quantity >= 0 and lost_quantity >= 0
    and returned_quantity + damaged_quantity + lost_quantity <= quantity),
  constraint rental_lines_unique_variant unique (rental_id, variant_id)
);
create index rental_lines_variant_idx on public.rental_lines (variant_id);

-- Sổ biến động kho (append-only). on_hand = tổng quantity_delta.
create table public.stock_movements (
  id             bigint generated always as identity primary key,
  branch_id      uuid not null,
  variant_id     uuid not null,
  quantity_delta integer not null constraint stock_movements_delta check (quantity_delta <> 0 and abs(quantity_delta) <= 100000),
  balance_after  integer not null default 0,
  reason         public.stock_reason not null,
  sale_line_id   uuid references public.sale_lines (id),
  rental_line_id uuid references public.rental_lines (id),
  note           text constraint stock_movements_note_len check (note is null or char_length(note) <= 300),
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  constraint stock_movements_level_fk foreign key (branch_id, variant_id) references public.inventory_levels (branch_id, variant_id),
  constraint stock_movements_source check (
    (reason in ('sale', 'sale_void') and sale_line_id is not null and rental_line_id is null)
    or (reason in ('rental_out', 'rental_return') and rental_line_id is not null and sale_line_id is null)
    or (reason in ('opening', 'purchase', 'adjustment', 'damage', 'loss', 'count_correction')
        and sale_line_id is null and rental_line_id is null)),
  constraint stock_movements_note_required check (
    reason not in ('adjustment', 'damage', 'loss', 'count_correction') or char_length(btrim(note)) >= 3)
);
create index stock_movements_level_time_idx on public.stock_movements (branch_id, variant_id, created_at desc);
create index stock_movements_sale_line_idx on public.stock_movements (sale_line_id) where sale_line_id is not null;
create index stock_movements_rental_line_idx on public.stock_movements (rental_line_id) where rental_line_id is not null;

-- 4.13 Sổ thu/chi (một nguồn duy nhất cho tiền) -------------------------------------
create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid not null references public.branches (id),   -- trigger tự điền từ đối tượng thanh toán
  booking_id      uuid references public.bookings (id),
  sale_id         uuid references public.sales (id),
  rental_id       uuid references public.rentals (id),
  kind            public.payment_kind not null default 'charge',
  method          public.payment_method not null,
  status          public.payment_status not null default 'succeeded',
  amount          bigint not null constraint payments_amount check (amount between 1 and 1000000000),
  reference       text constraint payments_reference_len check (reference is null or char_length(reference) between 3 and 100),
  provider        text,
  provider_txn_id text,
  provider_payload jsonb,
  idempotency_key text not null constraint payments_idempotency_key unique
                    constraint payments_idem_len check (char_length(idempotency_key) between 8 and 100),
  note            text constraint payments_note_len check (note is null or char_length(note) <= 300),
  received_at     timestamptz not null default now(),
  recorded_by     uuid references auth.users (id) on delete set null,
  voided_at       timestamptz,
  voided_by       uuid references auth.users (id) on delete set null,
  void_reason     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint payments_one_target check (num_nonnulls(booking_id, sale_id, rental_id) = 1),
  constraint payments_reference_required check (
    method not in ('bank_transfer', 'card', 'e_wallet') or kind = 'refund' or reference is not null),
  constraint payments_gateway_fields check (
    (method = 'gateway') = (provider is not null and provider_txn_id is not null)),
  constraint payments_void_fields check (
    (status = 'voided') = (voided_at is not null) and (status <> 'voided' or char_length(btrim(void_reason)) >= 3))
);
create unique index payments_provider_txn_uidx on public.payments (provider, provider_txn_id) where provider is not null;
create unique index payments_manual_reference_uidx on public.payments (method, lower(reference))
  where reference is not null and kind = 'charge' and status in ('pending', 'succeeded');
create index payments_booking_idx on public.payments (booking_id) where booking_id is not null;
create index payments_sale_idx on public.payments (sale_id) where sale_id is not null;
create index payments_rental_idx on public.payments (rental_id) where rental_id is not null;
create index payments_branch_received_idx on public.payments (branch_id, received_at desc);
comment on table public.payments is 'Sổ giao dịch tiền (thu & hoàn) cho booking/bán hàng/cho thuê. Trạng thái tiền tách khỏi trạng thái booking.';

-- 4.14 Nhân sự -------------------------------------------------------------------------
create table public.employees (
  id              uuid primary key default gen_random_uuid(),
  code            text not null constraint employees_code_key unique
                    constraint employees_code_fmt check (code ~ '^[A-Z0-9_-]{2,24}$'),
  full_name       text not null constraint employees_name_len check (char_length(btrim(full_name)) between 2 and 120),
  phone           text constraint employees_phone_fmt check (phone is null or phone ~ '^0[0-9]{9}$'),
  email           text,
  home_branch_id  uuid not null references public.branches (id),
  employment_type public.employment_type not null default 'part_time',
  status          public.employee_status not null default 'active',
  hired_on        date,
  terminated_on   date,
  notes           text constraint employees_notes_len check (notes is null or char_length(notes) <= 1000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint employees_terminated check (terminated_on is null or hired_on is null or terminated_on >= hired_on)
);
create index employees_branch_idx on public.employees (home_branch_id, status);

-- Mức lương có hiệu lực theo ngày (lịch sử thay vì ghi đè).
create table public.employee_pay_rates (
  id                   uuid primary key default gen_random_uuid(),
  employee_id          uuid not null references public.employees (id),
  pay_type             public.pay_type not null,
  hourly_rate          integer constraint pay_rates_hourly check (hourly_rate is null or hourly_rate between 0 and 20000000),
  daily_rate           integer constraint pay_rates_daily check (daily_rate is null or daily_rate between 0 and 100000000),
  standard_day_minutes smallint not null default 480 constraint pay_rates_std_day check (standard_day_minutes between 60 and 900),
  effective_from       date not null,
  note                 text,
  created_by           uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  constraint pay_rates_employee_date_key unique (employee_id, effective_from),
  constraint pay_rates_by_type check (
    (pay_type = 'hourly' and hourly_rate is not null and daily_rate is null)
    or (pay_type = 'daily' and daily_rate is not null and hourly_rate is null))
);

-- Tài khoản đăng nhập (Supabase Auth) — tách khỏi hồ sơ nhân sự.
create table public.staff_accounts (
  user_id              uuid primary key references auth.users (id) on delete cascade,
  role                 public.app_role not null default 'staff',
  employee_id          uuid constraint staff_accounts_employee_key unique references public.employees (id),
  display_name         text not null constraint staff_accounts_name_len check (char_length(btrim(display_name)) between 2 and 80),
  login_phone          text constraint staff_accounts_login_phone_key unique
                         constraint staff_accounts_login_phone_fmt check (login_phone is null or login_phone ~ '^\+[1-9][0-9]{7,14}$'),
  is_active            boolean not null default true,
  must_change_password boolean not null default true,
  created_by           uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint staff_accounts_staff_has_employee check (role = 'owner' or employee_id is not null)
);

create table public.staff_branch_permissions (
  user_id    uuid not null references public.staff_accounts (user_id) on delete cascade,
  branch_id  uuid not null references public.branches (id),
  permission public.app_permission not null,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, branch_id, permission)
);
create index staff_branch_permissions_branch_idx on public.staff_branch_permissions (branch_id);

-- 4.15 Ca làm & chấm công (hỗ trợ ca qua nửa đêm) -------------------------------------
create table public.shifts (
  id                   uuid primary key default gen_random_uuid(),
  employee_id          uuid not null references public.employees (id),
  branch_id            uuid not null references public.branches (id),
  work_date            date not null,   -- ngày địa phương của giờ bắt đầu (trigger tự tính)
  scheduled_start      timestamptz not null,
  scheduled_end        timestamptz not null,
  scheduled_range      tstzrange generated always as (tstzrange(scheduled_start, scheduled_end, '[)')) stored,
  break_minutes        smallint not null default 0,
  status               public.attendance_status not null default 'scheduled',
  checked_in_at        timestamptz,
  checked_out_at       timestamptz,
  actual_break_minutes smallint not null default 0,
  paid_minutes         integer generated always as (
    case when status = 'present' and checked_in_at is not null and checked_out_at is not null
      then greatest(0, floor(extract(epoch from (checked_out_at - checked_in_at)) / 60)::integer - actual_break_minutes)
      else 0 end) stored,
  note                 text constraint shifts_note_len check (note is null or char_length(note) <= 300),
  created_by           uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz,
  constraint shifts_schedule check (
    scheduled_end > scheduled_start and scheduled_end - scheduled_start <= interval '16 hours'),
  constraint shifts_break check (
    break_minutes between 0 and 240 and actual_break_minutes between 0 and 240
    and break_minutes * interval '1 minute' < scheduled_end - scheduled_start),
  constraint shifts_actual check (
    checked_out_at is null or (checked_in_at is not null and checked_out_at > checked_in_at)),
  constraint shifts_present_complete check (
    status <> 'present' or (checked_in_at is not null and checked_out_at is not null)),
  constraint shifts_not_worked_clean check (
    status not in ('absent', 'leave', 'cancelled') or (checked_in_at is null and checked_out_at is null)),
  constraint shifts_deleted check (deleted_at is null or status = 'cancelled'),
  constraint shifts_no_overlap exclude using gist (employee_id with =, scheduled_range with &&)
    where (deleted_at is null and status <> 'cancelled')
);
create index shifts_branch_date_idx on public.shifts (branch_id, work_date) where deleted_at is null;
create index shifts_employee_date_idx on public.shifts (employee_id, work_date);
create unique index shifts_one_open_checkin_uidx on public.shifts (employee_id)
  where checked_in_at is not null and checked_out_at is null and deleted_at is null;

create table public.attendance_qr_tokens (
  token_hash text primary key constraint attendance_qr_hash_fmt check (token_hash ~ '^[a-f0-9]{64}$'),
  branch_id  uuid not null references public.branches (id),
  expires_at timestamptz not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);
create index attendance_qr_tokens_branch_idx on public.attendance_qr_tokens (branch_id, expires_at);
comment on table public.attendance_qr_tokens is 'Chỉ lưu SHA-256 của token QR (hiệu lực 90 giây). Không có policy: chỉ RPC truy cập.';

-- 4.16 Bảng lương ------------------------------------------------------------------------
create table public.payroll_periods (
  id         uuid primary key default gen_random_uuid(),
  month      date not null constraint payroll_periods_month_key unique
               constraint payroll_periods_month_first check (month = date_trunc('month', month)::date),
  closed_at  timestamptz not null default now(),
  closed_by  uuid not null references auth.users (id),
  note       text
);

create table public.payroll_adjustments (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id),
  month       date not null constraint payroll_adjustments_month_first check (month = date_trunc('month', month)::date),
  amount      integer not null constraint payroll_adjustments_amount check (amount <> 0 and amount between -100000000 and 100000000),
  reason      text not null constraint payroll_adjustments_reason_len check (char_length(btrim(reason)) between 3 and 250),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  voided_at   timestamptz,
  voided_by   uuid references auth.users (id) on delete set null
);
create index payroll_adjustments_employee_month_idx on public.payroll_adjustments (employee_id, month);

create table public.payroll_lines (
  period_id         uuid not null references public.payroll_periods (id),
  employee_id       uuid not null references public.employees (id),
  employee_code     text not null,   -- ảnh chụp tại thời điểm chốt
  employee_name     text not null,
  branch_id         uuid not null references public.branches (id),
  shifts_count      integer not null,
  paid_minutes      integer not null,
  base_pay          bigint not null,
  adjustments_total bigint not null,
  net_pay           bigint generated always as (base_pay + adjustments_total) stored,
  primary key (period_id, employee_id),
  constraint payroll_lines_non_negative check (base_pay >= 0 and base_pay + adjustments_total >= 0)
);
create index payroll_lines_employee_idx on public.payroll_lines (employee_id);
create index payroll_lines_branch_idx on public.payroll_lines (branch_id);

-- 4.17 Nhật ký kiểm toán (append-only) ----------------------------------------------------
create table public.audit_events (
  id          bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id    uuid,
  actor_role  text,
  branch_id   uuid,
  table_name  text not null,
  record_id   text not null,
  action      text not null constraint audit_events_action check (action in ('INSERT', 'UPDATE', 'DELETE')),
  reason      text,
  old_data    jsonb,
  new_data    jsonb
);
create index audit_events_record_idx on public.audit_events (table_name, record_id, occurred_at desc);
create index audit_events_branch_idx on public.audit_events (branch_id, occurred_at desc) where branch_id is not null;
create index audit_events_time_brin on public.audit_events using brin (occurred_at);

-- =============================================================================
-- 5. HÀM PHÂN QUYỀN (dùng trong RLS và RPC)
-- =============================================================================

create function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_accounts sa
    where sa.user_id = (select auth.uid()) and sa.role = 'owner' and sa.is_active
  );
$$;

-- Danh sách chi nhánh mà người gọi được dùng quyền p_permission (null = bất kỳ quyền nào).
-- Owner: mọi chi nhánh. Staff: phải active, đã đổi mật khẩu, hồ sơ nhân viên đang làm.
create function private.permitted_branch_ids(p_permission public.app_permission default null)
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

create function private.staff_can(p_branch_id uuid, p_permission public.app_permission)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_branch_id is not null and p_branch_id = any (private.permitted_branch_ids(p_permission));
$$;

create function private.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select sa.employee_id
  from public.staff_accounts sa
  join public.employees e on e.id = sa.employee_id and e.status = 'active'
  where sa.user_id = (select auth.uid()) and sa.is_active;
$$;

create function private.payroll_month_closed(p_date date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.payroll_periods pp
    where pp.month = date_trunc('month', p_date)::date
  );
$$;

-- Lý do thay đổi do RPC đặt: select set_config('rally.audit_reason', '...', true)
create function private.audit_reason()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(btrim(current_setting('rally.audit_reason', true)), '');
$$;

-- =============================================================================
-- 6. TRIGGER TOÀN VẸN DỮ LIỆU
-- =============================================================================

-- 6.1 Chi nhánh: kiểm tra timezone + điều kiện công bố ---------------------------
create function private.branch_publish_problems(p_branch_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_remove(array[
    case when char_length(btrim(b.address_line)) < 5 then 'MISSING_ADDRESS' end,
    case when not exists (select 1 from public.courts c
                          where c.branch_id = b.id and c.status = 'active' and c.deleted_at is null)
         then 'NO_ACTIVE_COURT' end,
    case when exists (
           select 1 from public.courts c
           where c.branch_id = b.id and c.status = 'active' and c.deleted_at is null
             and not exists (select 1 from public.price_rules r
                             where r.branch_id = b.id and r.is_active and r.deleted_at is null
                               and (r.court_id is null or r.court_id = c.id)
                               and (r.valid_until is null or r.valid_until >= current_date)))
         then 'COURT_WITHOUT_PRICE' end
  ], null)
  from public.branches b
  where b.id = p_branch_id;
$$;

create function private.branches_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_problems text[];
begin
  begin
    perform pg_catalog.now() at time zone new.timezone;
  exception when others then
    raise exception using errcode = 'P0001', message = 'INVALID_TIMEZONE';
  end;

  if new.status = 'published'
     and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    if tg_op = 'INSERT' then
      raise exception using errcode = 'P0001', message = 'BRANCH_NOT_READY',
        detail = 'Tạo chi nhánh ở trạng thái draft, thêm sân và bảng giá rồi mới công bố.';
    end if;
    v_problems := private.branch_publish_problems(new.id);
    if cardinality(v_problems) > 0 then
      raise exception using errcode = 'P0001', message = 'BRANCH_NOT_READY',
        detail = array_to_string(v_problems, ',');
    end if;
    new.published_at := coalesce(new.published_at, pg_catalog.now());
  end if;
  return new;
end;
$$;

create trigger branches_before_write
  before insert or update on public.branches
  for each row execute function private.branches_before_write();

-- 6.2 Bảng giá: chặn 2 quy tắc mơ hồ (cùng phạm vi, cùng ưu tiên, giao nhau) ----------
create function private.price_rules_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_active and new.deleted_at is null then
    -- tuần tự hóa theo chi nhánh để 2 phiên không cùng chèn quy tắc chồng nhau
    perform pg_advisory_xact_lock(hashtext('rally.price_rules'), hashtext(new.branch_id::text));
    if exists (
      select 1 from public.price_rules p
      where p.id <> new.id
        and p.branch_id = new.branch_id
        and p.court_id is not distinct from new.court_id
        and p.priority = new.priority
        and p.is_active and p.deleted_at is null
        and (p.days_mask & new.days_mask) <> 0
        and p.starts_at < new.ends_at and p.ends_at > new.starts_at
        and (p.valid_from is null or new.valid_until is null or p.valid_from <= new.valid_until)
        and (new.valid_from is null or p.valid_until is null or new.valid_from <= p.valid_until)
    ) then
      raise exception using errcode = 'P0001', message = 'PRICE_RULE_OVERLAP',
        detail = 'Có quy tắc giá cùng phạm vi, cùng ưu tiên và trùng ngày/giờ. Đổi priority hoặc khung giờ.';
    end if;
  end if;
  return new;
end;
$$;

create trigger price_rules_before_write
  before insert or update on public.price_rules
  for each row execute function private.price_rules_before_write();

-- 6.3 Booking: máy trạng thái + trường bất biến -----------------------------------
create function private.booking_transition_allowed(p_from public.booking_status, p_to public.booking_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_from, p_to) in (
    ('held'::public.booking_status,       'confirmed'::public.booking_status),
    ('held'::public.booking_status,       'cancelled'::public.booking_status),
    ('held'::public.booking_status,       'expired'::public.booking_status),
    ('confirmed'::public.booking_status,  'checked_in'::public.booking_status),
    ('confirmed'::public.booking_status,  'completed'::public.booking_status),
    ('confirmed'::public.booking_status,  'cancelled'::public.booking_status),
    ('confirmed'::public.booking_status,  'no_show'::public.booking_status),
    ('checked_in'::public.booking_status, 'completed'::public.booking_status)
  );
$$;

create function private.bookings_before_write()
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
     and old.status not in ('held', 'confirmed') then
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

create trigger bookings_before_write
  before insert or update on public.bookings
  for each row execute function private.bookings_before_write();

-- Phát sự kiện realtime cho màn hình lịch trống (KHÔNG chứa dữ liệu cá nhân).
create function private.bookings_broadcast_availability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     or new.status is distinct from old.status
     or new.during is distinct from old.during
     or new.court_id is distinct from old.court_id then
    begin
      perform realtime.send(
        pg_catalog.jsonb_build_object('court_id', new.court_id, 'status', new.status,
                                      'starts_at', lower(new.during), 'ends_at', upper(new.during)),
        'availability_changed',
        'branch:' || new.branch_id::text || ':availability',
        false);
    exception when others then
      raise warning 'realtime broadcast failed: %', sqlerrm;  -- không làm hỏng giao dịch booking
    end;
  end if;
  return null;
end;
$$;

create trigger bookings_broadcast_availability
  after insert or update on public.bookings
  for each row execute function private.bookings_broadcast_availability();

-- 6.4 Payments: tự lấy branch từ đối tượng, chỉ cho đổi trạng thái hợp lệ -----------
create function private.payments_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.booking_id is not null then
      select b.branch_id into new.branch_id from public.bookings b where b.id = new.booking_id;
    elsif new.sale_id is not null then
      select s.branch_id into new.branch_id from public.sales s where s.id = new.sale_id;
    else
      select r.branch_id into new.branch_id from public.rentals r where r.id = new.rental_id;
    end if;
    if new.status = 'voided' then
      raise exception using errcode = 'P0001', message = 'INVALID_INITIAL_STATUS';
    end if;
    return new;
  end if;

  if (new.branch_id, new.booking_id, new.sale_id, new.rental_id, new.kind, new.method, new.amount,
      new.idempotency_key, new.received_at, new.created_at)
     is distinct from
     (old.branch_id, old.booking_id, old.sale_id, old.rental_id, old.kind, old.method, old.amount,
      old.idempotency_key, old.received_at, old.created_at)
     or new.recorded_by is distinct from old.recorded_by
     or new.reference is distinct from old.reference then
    raise exception using errcode = 'P0001', message = 'PAYMENT_IMMUTABLE_FIELD';
  end if;

  if new.status is distinct from old.status
     and (old.status, new.status) not in (
       ('pending'::public.payment_status,   'succeeded'::public.payment_status),
       ('pending'::public.payment_status,   'failed'::public.payment_status),
       ('pending'::public.payment_status,   'voided'::public.payment_status),
       ('succeeded'::public.payment_status, 'voided'::public.payment_status)) then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYMENT_TRANSITION',
      detail = pg_catalog.format('%s -> %s', old.status, new.status);
  end if;
  return new;
end;
$$;

create trigger payments_before_write
  before insert or update on public.payments
  for each row execute function private.payments_before_write();

-- 6.5 Kho: on_hand chỉ đổi qua sổ biến động -----------------------------------------
create function private.inventory_levels_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.on_hand <> 0 then
      raise exception using errcode = 'P0001', message = 'ON_HAND_LEDGER_ONLY',
        detail = 'Tạo dòng tồn với on_hand = 0 rồi ghi stock_movements (reason = opening).';
    end if;
    if exists (select 1 from public.product_variants v join public.products p on p.id = v.product_id
               where v.id = new.variant_id and p.is_bundle) then
      raise exception using errcode = 'P0001', message = 'BUNDLE_HAS_NO_STOCK';
    end if;
    return new;
  end if;
  if new.on_hand is distinct from old.on_hand
     and coalesce(current_setting('rally.inventory_ledger', true), '') <> 'on' then
    raise exception using errcode = 'P0001', message = 'ON_HAND_LEDGER_ONLY';
  end if;
  if (new.branch_id, new.variant_id) is distinct from (old.branch_id, old.variant_id) then
    raise exception using errcode = 'P0001', message = 'INVENTORY_KEY_IMMUTABLE';
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create trigger inventory_levels_guard
  before insert or update on public.inventory_levels
  for each row execute function private.inventory_levels_guard();

-- Ghi sổ => cập nhật on_hand trong cùng giao dịch (khóa dòng, CHECK >= 0 chống âm kho).
create function private.stock_movements_apply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('rally.inventory_ledger', 'on', true);
  update public.inventory_levels il
     set on_hand = il.on_hand + new.quantity_delta
   where il.branch_id = new.branch_id and il.variant_id = new.variant_id
  returning il.on_hand into new.balance_after;
  perform set_config('rally.inventory_ledger', '', true);
  if not found then
    raise exception using errcode = 'P0001', message = 'VARIANT_NOT_STOCKED_AT_BRANCH';
  end if;
  new.created_by := coalesce(new.created_by, (select auth.uid()));
  return new;
exception
  when check_violation then
    perform set_config('rally.inventory_ledger', '', true);
    raise exception using errcode = 'P0001', message = 'INSUFFICIENT_STOCK',
      detail = pg_catalog.format('variant %s tại chi nhánh %s', new.variant_id, new.branch_id);
end;
$$;

create trigger stock_movements_apply
  before insert on public.stock_movements
  for each row execute function private.stock_movements_apply();

create function private.forbid_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = 'APPEND_ONLY_TABLE',
    detail = pg_catalog.format('%I.%I không cho phép sửa.', tg_table_schema, tg_table_name);
end;
$$;

create trigger stock_movements_append_only
  before update on public.stock_movements
  for each row execute function private.forbid_update();

-- 6.6 Combo thuê: chỉ gồm biến thể thuê đơn lẻ ------------------------------------
create function private.bundle_components_validate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.products p
                 where p.id = new.bundle_product_id and p.kind = 'rental' and p.is_bundle) then
    raise exception using errcode = 'P0001', message = 'NOT_A_RENTAL_BUNDLE';
  end if;
  if not exists (select 1 from public.product_variants v join public.products p on p.id = v.product_id
                 where v.id = new.component_variant_id and p.kind = 'rental' and not p.is_bundle) then
    raise exception using errcode = 'P0001', message = 'INVALID_BUNDLE_COMPONENT';
  end if;
  return new;
end;
$$;

create trigger bundle_components_validate
  before insert or update on public.bundle_components
  for each row execute function private.bundle_components_validate();

-- 6.7 Lương: khóa mức lương ảnh hưởng tới tháng đã chốt -----------------------------
create function private.pay_rates_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_date date;
begin
  if tg_op = 'DELETE' then
    v_date := old.effective_from;
  else
    v_date := least(new.effective_from, old.effective_from);
  end if;
  if exists (select 1 from public.payroll_periods pp where pp.month >= date_trunc('month', v_date)::date) then
    raise exception using errcode = 'P0001', message = 'PAY_RATE_LOCKED_BY_CLOSED_PAYROLL';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create function private.pay_rates_guard_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.payroll_periods pp
             where pp.month >= date_trunc('month', new.effective_from)::date) then
    raise exception using errcode = 'P0001', message = 'PAY_RATE_LOCKED_BY_CLOSED_PAYROLL';
  end if;
  return new;
end;
$$;

create trigger pay_rates_guard_insert
  before insert on public.employee_pay_rates
  for each row execute function private.pay_rates_guard_insert();
create trigger pay_rates_guard_change
  before update or delete on public.employee_pay_rates
  for each row execute function private.pay_rates_guard();

create function private.payroll_adjustments_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.payroll_month_closed(new.month)
     or (tg_op = 'UPDATE' and private.payroll_month_closed(old.month)) then
    raise exception using errcode = 'P0001', message = 'PAYROLL_CLOSED';
  end if;
  if tg_op = 'UPDATE' and (new.employee_id, new.amount, new.month, new.created_at)
       is distinct from (old.employee_id, old.amount, old.month, old.created_at) then
    raise exception using errcode = 'P0001', message = 'ADJUSTMENT_IMMUTABLE',
      detail = 'Chỉ được hủy (voided_at) và tạo dòng mới.';
  end if;
  return new;
end;
$$;

create trigger payroll_adjustments_guard
  before insert or update on public.payroll_adjustments
  for each row execute function private.payroll_adjustments_guard();

create trigger payroll_periods_append_only
  before update on public.payroll_periods
  for each row execute function private.forbid_update();
create trigger payroll_lines_append_only
  before update on public.payroll_lines
  for each row execute function private.forbid_update();

-- 6.8 Ca làm: ngày làm, kỳ lương đã chốt, chỉnh công BẮT BUỘC có lý do -------------
create function private.shifts_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz text;
begin
  if tg_op = 'UPDATE' and (new.employee_id, new.created_at) is distinct from (old.employee_id, old.created_at) then
    raise exception using errcode = 'P0001', message = 'SHIFT_IMMUTABLE_FIELD';
  end if;

  select b.timezone into v_tz from public.branches b where b.id = new.branch_id;
  new.work_date := (new.scheduled_start at time zone v_tz)::date;

  if not exists (select 1 from public.employees e where e.id = new.employee_id and e.status = 'active')
     and tg_op = 'INSERT' then
    raise exception using errcode = 'P0001', message = 'EMPLOYEE_INACTIVE';
  end if;

  if private.payroll_month_closed(new.work_date)
     or (tg_op = 'UPDATE' and private.payroll_month_closed(old.work_date)) then
    raise exception using errcode = 'P0001', message = 'PAYROLL_CLOSED';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'scheduled' or new.checked_in_at is not null or new.checked_out_at is not null then
      if private.audit_reason() is null then
        raise exception using errcode = 'P0001', message = 'ATTENDANCE_REASON_REQUIRED';
      end if;
    end if;
    return new;
  end if;

  -- Mọi thay đổi dữ liệu công (kể cả của owner) phải đi kèm lý do => không còn "đường sửa công không audit".
  if (new.status, new.checked_in_at, new.checked_out_at, new.actual_break_minutes)
       is distinct from (old.status, old.checked_in_at, old.checked_out_at, old.actual_break_minutes)
     and private.audit_reason() is null then
    raise exception using errcode = 'P0001', message = 'ATTENDANCE_REASON_REQUIRED',
      detail = 'Dùng RPC owner_adjust_attendance hoặc quét QR.';
  end if;

  -- Đã có check-in thì không được dời lịch/ đổi chi nhánh.
  if old.checked_in_at is not null
     and (new.branch_id, new.scheduled_start, new.scheduled_end)
         is distinct from (old.branch_id, old.scheduled_start, old.scheduled_end) then
    raise exception using errcode = 'P0001', message = 'SHIFT_ALREADY_STARTED';
  end if;
  return new;
end;
$$;

create trigger shifts_before_write
  before insert or update on public.shifts
  for each row execute function private.shifts_before_write();

-- 6.9 Tài khoản: không thể mất owner cuối cùng; staff không tự nâng quyền ----------
create function private.staff_accounts_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception using errcode = 'P0001', message = 'STAFF_ACCOUNT_KEY_IMMUTABLE';
  end if;
  if tg_op in ('UPDATE', 'DELETE') and old.role = 'owner' and old.is_active
     and (tg_op = 'DELETE' or new.role <> 'owner' or not new.is_active) then
    perform pg_advisory_xact_lock(hashtext('rally.last_owner'));
    if not exists (select 1 from public.staff_accounts sa
                   where sa.role = 'owner' and sa.is_active and sa.user_id <> old.user_id) then
      raise exception using errcode = 'P0001', message = 'LAST_OWNER_REQUIRED';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger staff_accounts_guard
  before update or delete on public.staff_accounts
  for each row execute function private.staff_accounts_guard();

-- 6.10 Nhật ký kiểm toán chung ------------------------------------------------------
-- TG_ARGV[0] = cột khóa, TG_ARGV[1] = cột chi nhánh (hoặc '-' nếu không có)
create function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_key text := tg_argv[0];
  v_branch_col text := coalesce(tg_argv[1], '-');
begin
  if tg_op in ('UPDATE', 'DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new := to_jsonb(new); end if;

  if tg_op = 'UPDATE' then
    -- chỉ lưu các cột thay đổi (bỏ qua updated_at)
    select coalesce(jsonb_object_agg(n.key, n.value), '{}'::jsonb) into v_new
      from jsonb_each(to_jsonb(new)) n
     where n.key <> 'updated_at' and (to_jsonb(old) -> n.key) is distinct from n.value;
    if v_new = '{}'::jsonb then
      return null;
    end if;
    select jsonb_object_agg(o.key, o.value) into v_old
      from jsonb_each(to_jsonb(old)) o
     where v_new ? o.key;
  end if;

  v_row := coalesce(to_jsonb(new), to_jsonb(old));
  insert into public.audit_events (actor_id, actor_role, branch_id, table_name, record_id, action, reason, old_data, new_data)
  values (
    (select auth.uid()),
    coalesce((select auth.role()), current_user),
    case when v_branch_col = '-' then null else (v_row ->> v_branch_col)::uuid end,
    tg_table_name,
    case when v_key like '%+%' then
           (select string_agg(v_row ->> k, ':') from unnest(string_to_array(v_key, '+')) k)
         else v_row ->> v_key end,
    tg_op,
    private.audit_reason(),
    v_old,
    v_new);
  return null;
end;
$$;

create trigger audit_branches after insert or update on public.branches
  for each row execute function private.audit_row_change('id', 'id');
create trigger audit_courts after insert or update on public.courts
  for each row execute function private.audit_row_change('id', 'branch_id');
create trigger audit_price_rules after insert or update on public.price_rules
  for each row execute function private.audit_row_change('id', 'branch_id');
create trigger audit_bookings after insert or update on public.bookings
  for each row execute function private.audit_row_change('id', 'branch_id');
create trigger audit_payments after insert or update on public.payments
  for each row execute function private.audit_row_change('id', 'branch_id');
create trigger audit_sales after insert or update on public.sales
  for each row execute function private.audit_row_change('id', 'branch_id');
create trigger audit_rentals after insert or update on public.rentals
  for each row execute function private.audit_row_change('id', 'branch_id');
create trigger audit_inventory_levels after insert or update on public.inventory_levels
  for each row when (pg_trigger_depth() = 0)  -- biến động on_hand (đến từ trigger sổ kho) đã có ở stock_movements
  execute function private.audit_row_change('branch_id+variant_id', 'branch_id');
create trigger audit_products after insert or update on public.products
  for each row execute function private.audit_row_change('id', '-');
create trigger audit_product_variants after insert or update on public.product_variants
  for each row execute function private.audit_row_change('id', '-');
create trigger audit_rental_rates after insert or update or delete on public.rental_rates
  for each row execute function private.audit_row_change('id', '-');
create trigger audit_employees after insert or update on public.employees
  for each row execute function private.audit_row_change('id', 'home_branch_id');
create trigger audit_employee_pay_rates after insert or update or delete on public.employee_pay_rates
  for each row execute function private.audit_row_change('id', '-');
create trigger audit_shifts after insert or update on public.shifts
  for each row execute function private.audit_row_change('id', 'branch_id');
create trigger audit_payroll_adjustments after insert or update on public.payroll_adjustments
  for each row execute function private.audit_row_change('id', '-');
create trigger audit_staff_accounts after insert or update or delete on public.staff_accounts
  for each row execute function private.audit_row_change('user_id', '-');
create trigger audit_staff_branch_permissions after insert or update or delete on public.staff_branch_permissions
  for each row execute function private.audit_row_change('user_id+branch_id+permission', 'branch_id');
create trigger audit_customers after update on public.customers
  for each row execute function private.audit_row_change('id', '-');

-- 6.11 updated_at --------------------------------------------------------------------
create trigger touch_brand_settings before update on public.brand_settings for each row execute function private.touch_updated_at();
create trigger touch_branches before update on public.branches for each row execute function private.touch_updated_at();
create trigger touch_courts before update on public.courts for each row execute function private.touch_updated_at();
create trigger touch_price_rules before update on public.price_rules for each row execute function private.touch_updated_at();
create trigger touch_customers before update on public.customers for each row execute function private.touch_updated_at();
create trigger touch_recurring_series before update on public.recurring_series for each row execute function private.touch_updated_at();
create trigger touch_bookings before update on public.bookings for each row execute function private.touch_updated_at();
create trigger touch_product_categories before update on public.product_categories for each row execute function private.touch_updated_at();
create trigger touch_products before update on public.products for each row execute function private.touch_updated_at();
create trigger touch_product_variants before update on public.product_variants for each row execute function private.touch_updated_at();
create trigger touch_rental_rates before update on public.rental_rates for each row execute function private.touch_updated_at();
create trigger touch_rentals before update on public.rentals for each row execute function private.touch_updated_at();
create trigger touch_payments before update on public.payments for each row execute function private.touch_updated_at();
create trigger touch_employees before update on public.employees for each row execute function private.touch_updated_at();
create trigger touch_staff_accounts before update on public.staff_accounts for each row execute function private.touch_updated_at();
create trigger touch_shifts before update on public.shifts for each row execute function private.touch_updated_at();

-- 6.12 Cấm xóa cứng dữ liệu lịch sử ----------------------------------------------------
create trigger no_delete_branches before delete on public.branches for each row execute function private.forbid_hard_delete();
create trigger no_delete_courts before delete on public.courts for each row execute function private.forbid_hard_delete();
create trigger no_delete_price_rules before delete on public.price_rules for each row execute function private.forbid_hard_delete();
create trigger no_delete_customers before delete on public.customers for each row execute function private.forbid_hard_delete();
create trigger no_delete_recurring_series before delete on public.recurring_series for each row execute function private.forbid_hard_delete();
create trigger no_delete_bookings before delete on public.bookings for each row execute function private.forbid_hard_delete();
create trigger no_delete_products before delete on public.products for each row execute function private.forbid_hard_delete();
create trigger no_delete_product_variants before delete on public.product_variants for each row execute function private.forbid_hard_delete();
create trigger no_delete_inventory_levels before delete on public.inventory_levels for each row execute function private.forbid_hard_delete();
create trigger no_delete_stock_movements before delete on public.stock_movements for each row execute function private.forbid_hard_delete();
create trigger no_delete_sales before delete on public.sales for each row execute function private.forbid_hard_delete();
create trigger no_delete_sale_lines before delete on public.sale_lines for each row execute function private.forbid_hard_delete();
create trigger no_delete_rentals before delete on public.rentals for each row execute function private.forbid_hard_delete();
create trigger no_delete_rental_lines before delete on public.rental_lines for each row execute function private.forbid_hard_delete();
create trigger no_delete_payments before delete on public.payments for each row execute function private.forbid_hard_delete();
create trigger no_delete_employees before delete on public.employees for each row execute function private.forbid_hard_delete();
create trigger no_delete_shifts before delete on public.shifts for each row execute function private.forbid_hard_delete();
create trigger no_delete_payroll_periods before delete on public.payroll_periods for each row execute function private.forbid_hard_delete();
create trigger no_delete_payroll_lines before delete on public.payroll_lines for each row execute function private.forbid_hard_delete();
create trigger no_delete_payroll_adjustments before delete on public.payroll_adjustments for each row execute function private.forbid_hard_delete();
create trigger no_delete_audit_events before delete on public.audit_events for each row execute function private.forbid_hard_delete();
create trigger audit_events_append_only before update on public.audit_events for each row execute function private.forbid_update();

-- =============================================================================
-- 7. VIEW
-- =============================================================================
-- Số dư booking tính từ sổ payments (không lưu trùng). security_invoker => tôn trọng RLS người gọi.
create view public.booking_balances
with (security_invoker = true)
as
select
  b.id as booking_id,
  b.branch_id,
  b.total_amount,
  b.deposit_amount,
  coalesce(sum(p.amount) filter (where p.kind = 'charge' and p.status = 'succeeded'), 0)::bigint as paid_amount,
  coalesce(sum(p.amount) filter (where p.kind = 'refund' and p.status = 'succeeded'), 0)::bigint as refunded_amount,
  (b.total_amount
    - coalesce(sum(p.amount) filter (where p.kind = 'charge' and p.status = 'succeeded'), 0)
    + coalesce(sum(p.amount) filter (where p.kind = 'refund' and p.status = 'succeeded'), 0))::bigint as balance_due
from public.bookings b
left join public.payments p on p.booking_id = b.id
group by b.id;

-- =============================================================================
-- 8. ROW LEVEL SECURITY
--    Quy tắc: một policy cho mỗi (role, lệnh); hàm private.* bọc trong (select ...)
--    để Postgres tính một lần mỗi câu lệnh (InitPlan) thay vì mỗi dòng.
--    Không có policy = từ chối. service_role bỏ qua RLS (chỉ dùng ở server).
-- =============================================================================

alter table public.brand_settings           enable row level security;
alter table public.amenities                enable row level security;
alter table public.court_surfaces           enable row level security;
alter table public.branches                 enable row level security;
alter table public.branch_amenities         enable row level security;
alter table public.courts                   enable row level security;
alter table public.court_photos             enable row level security;
alter table public.price_rules              enable row level security;
alter table public.customers                enable row level security;
alter table public.recurring_series         enable row level security;
alter table public.bookings                 enable row level security;
alter table public.product_categories       enable row level security;
alter table public.products                 enable row level security;
alter table public.product_variants         enable row level security;
alter table public.product_photos           enable row level security;
alter table public.rental_rates             enable row level security;
alter table public.bundle_components        enable row level security;
alter table public.inventory_levels         enable row level security;
alter table public.sales                    enable row level security;
alter table public.sale_lines               enable row level security;
alter table public.rentals                  enable row level security;
alter table public.rental_lines             enable row level security;
alter table public.stock_movements          enable row level security;
alter table public.payments                 enable row level security;
alter table public.employees                enable row level security;
alter table public.employee_pay_rates       enable row level security;
alter table public.staff_accounts           enable row level security;
alter table public.staff_branch_permissions enable row level security;
alter table public.shifts                   enable row level security;
alter table public.attendance_qr_tokens     enable row level security;
alter table public.payroll_periods          enable row level security;
alter table public.payroll_adjustments      enable row level security;
alter table public.payroll_lines            enable row level security;
alter table public.audit_events             enable row level security;

-- 8.1 brand_settings ------------------------------------------------------------
create policy brand_settings_public_read on public.brand_settings
  for select to anon, authenticated using (true);
create policy brand_settings_owner_update on public.brand_settings
  for update to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

-- 8.2 amenities / court_surfaces / product_categories (danh mục tham chiếu) ----------
create policy amenities_public_read on public.amenities
  for select to anon, authenticated using (true);
create policy amenities_owner_insert on public.amenities
  for insert to authenticated with check ((select private.is_owner()));
create policy amenities_owner_update on public.amenities
  for update to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));

create policy court_surfaces_public_read on public.court_surfaces
  for select to anon, authenticated using (true);
create policy court_surfaces_owner_insert on public.court_surfaces
  for insert to authenticated with check ((select private.is_owner()));
create policy court_surfaces_owner_update on public.court_surfaces
  for update to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));

create policy product_categories_anon_read on public.product_categories
  for select to anon using (is_active);
create policy product_categories_auth_read on public.product_categories
  for select to authenticated using (is_active or (select private.is_owner()));
create policy product_categories_owner_insert on public.product_categories
  for insert to authenticated with check ((select private.is_owner()));
create policy product_categories_owner_update on public.product_categories
  for update to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));

-- 8.3 branches ------------------------------------------------------------------------
create policy branches_anon_read on public.branches
  for select to anon
  using (status = 'published' and deleted_at is null);
create policy branches_auth_read on public.branches
  for select to authenticated
  using (
    (status = 'published' and deleted_at is null)
    or id = any ((select private.permitted_branch_ids())::uuid[]));
create policy branches_owner_insert on public.branches
  for insert to authenticated with check ((select private.is_owner()));
create policy branches_owner_update on public.branches
  for update to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));

-- 8.4 branch_amenities: hiển thị khi chi nhánh hiển thị (RLS của branches áp dụng trong subquery)
create policy branch_amenities_read on public.branch_amenities
  for select to anon, authenticated
  using (exists (select 1 from public.branches b where b.id = branch_amenities.branch_id));
create policy branch_amenities_owner_insert on public.branch_amenities
  for insert to authenticated with check ((select private.is_owner()));
create policy branch_amenities_owner_delete on public.branch_amenities
  for delete to authenticated using ((select private.is_owner()));

-- 8.5 courts --------------------------------------------------------------------------
create policy courts_anon_read on public.courts
  for select to anon
  using (deleted_at is null and status <> 'retired'
         and exists (select 1 from public.branches b where b.id = courts.branch_id));
create policy courts_auth_read on public.courts
  for select to authenticated
  using (
    (deleted_at is null and status <> 'retired'
     and exists (select 1 from public.branches b where b.id = courts.branch_id))
    or (select private.is_owner()));
create policy courts_owner_insert on public.courts
  for insert to authenticated with check ((select private.is_owner()));
create policy courts_owner_update on public.courts
  for update to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));

-- 8.6 court_photos ----------------------------------------------------------------------
create policy court_photos_read on public.court_photos
  for select to anon, authenticated
  using (exists (select 1 from public.courts c where c.id = court_photos.court_id));
create policy court_photos_owner_insert on public.court_photos
  for insert to authenticated with check ((select private.is_owner()));
create policy court_photos_owner_update on public.court_photos
  for update to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy court_photos_owner_delete on public.court_photos
  for delete to authenticated using ((select private.is_owner()));

-- 8.7 price_rules --------------------------------------------------------------------
create policy price_rules_anon_read on public.price_rules
  for select to anon
  using (is_active and deleted_at is null
         and exists (select 1 from public.branches b where b.id = price_rules.branch_id));
create policy price_rules_auth_read on public.price_rules
  for select to authenticated
  using (
    (is_active and deleted_at is null
     and exists (select 1 from public.branches b where b.id = price_rules.branch_id))
    or (select private.is_owner()));
create policy price_rules_owner_insert on public.price_rules
  for insert to authenticated with check ((select private.is_owner()));
create policy price_rules_owner_update on public.price_rules
  for update to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));

-- 8.8 customers: owner; staff chỉ thấy khách có giao dịch tại chi nhánh mình ----------
create policy customers_staff_read on public.customers
  for select to authenticated
  using (
    (select private.is_owner())
    or exists (select 1 from public.bookings b
               where b.customer_id = customers.id
                 and b.branch_id = any ((select private.permitted_branch_ids('booking.view'))::uuid[]))
    or exists (select 1 from public.rentals r
               where r.customer_id = customers.id
                 and r.branch_id = any ((select private.permitted_branch_ids('rental.operate'))::uuid[])));
create policy customers_owner_update on public.customers
  for update to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));

-- 8.9 recurring_series ------------------------------------------------------------------
create policy recurring_series_read on public.recurring_series
  for select to authenticated
  using (branch_id = any ((select private.permitted_branch_ids('booking.view'))::uuid[]));

-- 8.10 bookings: chỉ đọc theo quyền; GHI chỉ qua RPC ----------------------------------
create policy bookings_read on public.bookings
  for select to authenticated
  using (branch_id = any ((select private.permitted_branch_ids('booking.view'))::uuid[]));

-- 8.11 payments -------------------------------------------------------------------------
create policy payments_read on public.payments
  for select to authenticated
  using (
    (booking_id is not null and branch_id = any ((select private.permitted_branch_ids('booking.view'))::uuid[]))
    or (sale_id is not null and branch_id = any ((select private.permitted_branch_ids('sale.record'))::uuid[]))
    or (rental_id is not null and branch_id = any ((select private.permitted_branch_ids('rental.operate'))::uuid[]))
    or (select private.is_owner()));

-- 8.12 products & con ---------------------------------------------------------------
create policy products_anon_read on public.products
  for select to anon using (is_active and deleted_at is null);
create policy products_auth_read on public.products
  for select to authenticated
  using (
    (is_active and deleted_at is null)
    or cardinality((select private.permitted_branch_ids('catalog.view'))) > 0);
create policy products_editor_insert on public.products
  for insert to authenticated
  with check (cardinality((select private.permitted_branch_ids('catalog.edit'))) > 0);
create policy products_editor_update on public.products
  for update to authenticated
  using (cardinality((select private.permitted_branch_ids('catalog.edit'))) > 0)
  with check (cardinality((select private.permitted_branch_ids('catalog.edit'))) > 0);

create policy product_variants_anon_read on public.product_variants
  for select to anon
  using (is_active and deleted_at is null
         and exists (select 1 from public.products p where p.id = product_variants.product_id));
create policy product_variants_auth_read on public.product_variants
  for select to authenticated
  using (
    (is_active and deleted_at is null
     and exists (select 1 from public.products p where p.id = product_variants.product_id))
    or cardinality((select private.permitted_branch_ids('catalog.view'))) > 0);
create policy product_variants_editor_insert on public.product_variants
  for insert to authenticated
  with check (cardinality((select private.permitted_branch_ids('catalog.edit'))) > 0);
create policy product_variants_editor_update on public.product_variants
  for update to authenticated
  using (cardinality((select private.permitted_branch_ids('catalog.edit'))) > 0)
  with check (cardinality((select private.permitted_branch_ids('catalog.edit'))) > 0);

create policy product_photos_read on public.product_photos
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_photos.product_id));
create policy product_photos_editor_insert on public.product_photos
  for insert to authenticated
  with check (cardinality((select private.permitted_branch_ids('catalog.edit'))) > 0);
create policy product_photos_editor_update on public.product_photos
  for update to authenticated
  using (cardinality((select private.permitted_branch_ids('catalog.edit'))) > 0)
  with check (cardinality((select private.permitted_branch_ids('catalog.edit'))) > 0);
create policy product_photos_editor_delete on public.product_photos
  for delete to authenticated
  using (cardinality((select private.permitted_branch_ids('catalog.edit'))) > 0);

create policy rental_rates_anon_read on public.rental_rates
  for select to anon
  using (is_active and exists (select 1 from public.products p where p.id = rental_rates.product_id));
create policy rental_rates_auth_read on public.rental_rates
  for select to authenticated
  using (
    (is_active and exists (select 1 from public.products p where p.id = rental_rates.product_id))
    or cardinality((select private.permitted_branch_ids('catalog.view'))) > 0);
create policy rental_rates_editor_insert on public.rental_rates
  for insert to authenticated
  with check (cardinality((select private.permitted_branch_ids('catalog.edit'))) > 0);
create policy rental_rates_editor_update on public.rental_rates
  for update to authenticated
  using (cardinality((select private.permitted_branch_ids('catalog.edit'))) > 0)
  with check (cardinality((select private.permitted_branch_ids('catalog.edit'))) > 0);
create policy rental_rates_editor_delete on public.rental_rates
  for delete to authenticated
  using (cardinality((select private.permitted_branch_ids('catalog.edit'))) > 0);

create policy bundle_components_read on public.bundle_components
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = bundle_components.bundle_product_id));
create policy bundle_components_editor_insert on public.bundle_components
  for insert to authenticated
  with check (cardinality((select private.permitted_branch_ids('catalog.edit'))) > 0);
create policy bundle_components_editor_update on public.bundle_components
  for update to authenticated
  using (cardinality((select private.permitted_branch_ids('catalog.edit'))) > 0)
  with check (cardinality((select private.permitted_branch_ids('catalog.edit'))) > 0);
create policy bundle_components_editor_delete on public.bundle_components
  for delete to authenticated
  using (cardinality((select private.permitted_branch_ids('catalog.edit'))) > 0);
-- Lưu ý: anon thấy dòng con (biến thể, ảnh, giá thuê) khi sản phẩm cha hiển thị
-- (RLS của products áp dụng trong subquery). Đọc rental_rates cần RLS products,
-- nên dòng giá thuê của sản phẩm ẩn sẽ không lộ ra ngoài.

-- 8.13 inventory_levels / stock_movements ------------------------------------------------
create policy inventory_levels_anon_read on public.inventory_levels
  for select to anon
  using (is_listed and exists (select 1 from public.branches b where b.id = inventory_levels.branch_id));
create policy inventory_levels_auth_read on public.inventory_levels
  for select to authenticated
  using (
    (is_listed and exists (select 1 from public.branches b
                           where b.id = inventory_levels.branch_id and b.status = 'published' and b.deleted_at is null))
    or branch_id = any ((select private.permitted_branch_ids('catalog.view'))::uuid[]));
create policy inventory_levels_editor_insert on public.inventory_levels
  for insert to authenticated
  with check (branch_id = any ((select private.permitted_branch_ids('catalog.edit'))::uuid[]));
create policy inventory_levels_editor_update on public.inventory_levels
  for update to authenticated
  using (branch_id = any ((select private.permitted_branch_ids('catalog.edit'))::uuid[]))
  with check (branch_id = any ((select private.permitted_branch_ids('catalog.edit'))::uuid[]));

create policy stock_movements_read on public.stock_movements
  for select to authenticated
  using (branch_id = any ((select private.permitted_branch_ids('catalog.view'))::uuid[]));

-- 8.14 sales / rentals (ghi chỉ qua RPC) -------------------------------------------------
create policy sales_read on public.sales
  for select to authenticated
  using (branch_id = any ((select private.permitted_branch_ids('sale.record'))::uuid[]));
create policy sale_lines_read on public.sale_lines
  for select to authenticated
  using (exists (select 1 from public.sales s where s.id = sale_lines.sale_id));
create policy rentals_read on public.rentals
  for select to authenticated
  using (branch_id = any ((select private.permitted_branch_ids('rental.operate'))::uuid[]));
create policy rental_lines_read on public.rental_lines
  for select to authenticated
  using (exists (select 1 from public.rentals r where r.id = rental_lines.rental_id));

-- 8.15 Nhân sự -----------------------------------------------------------------------
create policy employees_read on public.employees
  for select to authenticated
  using ((select private.is_owner()) or id = (select private.current_employee_id()));
create policy employees_owner_insert on public.employees
  for insert to authenticated with check ((select private.is_owner()));
create policy employees_owner_update on public.employees
  for update to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));

create policy pay_rates_read on public.employee_pay_rates
  for select to authenticated
  using ((select private.is_owner()) or employee_id = (select private.current_employee_id()));
create policy pay_rates_owner_insert on public.employee_pay_rates
  for insert to authenticated with check ((select private.is_owner()));
create policy pay_rates_owner_update on public.employee_pay_rates
  for update to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy pay_rates_owner_delete on public.employee_pay_rates
  for delete to authenticated using ((select private.is_owner()));

create policy staff_accounts_read on public.staff_accounts
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_owner()));
create policy staff_accounts_owner_insert on public.staff_accounts
  for insert to authenticated with check ((select private.is_owner()));
create policy staff_accounts_owner_update on public.staff_accounts
  for update to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));

create policy staff_permissions_read on public.staff_branch_permissions
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_owner()));
create policy staff_permissions_owner_insert on public.staff_branch_permissions
  for insert to authenticated with check ((select private.is_owner()));
create policy staff_permissions_owner_delete on public.staff_branch_permissions
  for delete to authenticated using ((select private.is_owner()));

create policy shifts_read on public.shifts
  for select to authenticated
  using (
    (select private.is_owner())
    or employee_id = (select private.current_employee_id())
    or branch_id = any ((select private.permitted_branch_ids('shift.view_branch'))::uuid[]));
create policy shifts_owner_insert on public.shifts
  for insert to authenticated with check ((select private.is_owner()));
create policy shifts_owner_update on public.shifts
  for update to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));

-- attendance_qr_tokens: KHÔNG có policy (chỉ RPC SECURITY DEFINER).

create policy payroll_periods_read on public.payroll_periods
  for select to authenticated using ((select private.is_owner()));
create policy payroll_lines_read on public.payroll_lines
  for select to authenticated
  using ((select private.is_owner()) or employee_id = (select private.current_employee_id()));
create policy payroll_adjustments_read on public.payroll_adjustments
  for select to authenticated
  using ((select private.is_owner()) or employee_id = (select private.current_employee_id()));
create policy payroll_adjustments_owner_insert on public.payroll_adjustments
  for insert to authenticated with check ((select private.is_owner()));
create policy payroll_adjustments_owner_update on public.payroll_adjustments
  for update to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));

create policy audit_events_owner_read on public.audit_events
  for select to authenticated using ((select private.is_owner()));

-- =============================================================================
-- 9. QUYỀN TRUY CẬP (GRANT) — phòng thủ nhiều lớp bên cạnh RLS
-- =============================================================================
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Dữ liệu công khai cho website khách
grant select on public.brand_settings, public.amenities, public.court_surfaces, public.branches,
  public.branch_amenities, public.courts, public.court_photos, public.price_rules,
  public.product_categories, public.products, public.product_variants, public.product_photos,
  public.rental_rates, public.bundle_components, public.inventory_levels
  to anon;

-- Người dùng đăng nhập (owner/staff): đọc theo RLS
grant select on all tables in schema public to authenticated;
revoke select on public.attendance_qr_tokens from authenticated;

-- Ghi trực tiếp (vẫn bị RLS + trigger kiểm soát). Booking/tiền/kho/công: chỉ qua RPC.
grant update on public.brand_settings to authenticated;
grant insert, update on public.amenities, public.court_surfaces, public.product_categories,
  public.branches, public.courts, public.price_rules, public.products, public.product_variants,
  public.employees, public.employee_pay_rates, public.staff_accounts, public.shifts,
  public.payroll_adjustments, public.rental_rates, public.bundle_components
  to authenticated;
grant update (full_name, email, staff_note, marketing_opt_in) on public.customers to authenticated;
grant insert, update (is_listed, reorder_level) on public.inventory_levels to authenticated;
grant insert, update, delete on public.court_photos, public.product_photos to authenticated;
grant insert, delete on public.branch_amenities, public.staff_branch_permissions to authenticated;
grant delete on public.employee_pay_rates, public.rental_rates, public.bundle_components to authenticated;

grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Hàm private: authenticated cần EXECUTE để policy chạy được; anon thì không cần.
revoke all on all functions in schema private from public;
grant execute on function private.is_owner() to authenticated, service_role;
grant execute on function private.permitted_branch_ids(public.app_permission) to authenticated, service_role;
grant execute on function private.staff_can(uuid, public.app_permission) to authenticated, service_role;
grant execute on function private.current_employee_id() to authenticated, service_role;
grant execute on function private.permission_prerequisite(public.app_permission) to authenticated, service_role;
grant execute on function private.branch_publish_problems(uuid) to service_role;
grant execute on function private.random_code(text, integer) to service_role;

-- =============================================================================
-- 10. STORAGE — một bucket ảnh công khai, phân thư mục theo đối tượng
--     branches/<branch_id>/<uuid>.webp | courts/<court_id>/<uuid>.webp | products/<product_id>/<uuid>.webp
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('public-media', 'public-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy rally_media_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'public-media'
    and (storage.foldername(name))[1] in ('branches', 'courts', 'products')
    and (
      (select private.is_owner())
      or ((storage.foldername(name))[1] = 'products'
          and cardinality((select private.permitted_branch_ids('catalog.edit'))) > 0)));

create policy rally_media_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'public-media'
    and ((select private.is_owner())
         or ((storage.foldername(name))[1] = 'products'
             and cardinality((select private.permitted_branch_ids('catalog.edit'))) > 0)))
  with check (
    bucket_id = 'public-media'
    and (storage.foldername(name))[1] in ('branches', 'courts', 'products')
    and ((select private.is_owner())
         or ((storage.foldername(name))[1] = 'products'
             and cardinality((select private.permitted_branch_ids('catalog.edit'))) > 0)));

create policy rally_media_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'public-media'
    and ((select private.is_owner())
         or ((storage.foldername(name))[1] = 'products'
             and cardinality((select private.permitted_branch_ids('catalog.edit'))) > 0)));

-- =============================================================================
-- 11. SEED THAM CHIẾU (an toàn để sửa sau trong Admin)
-- =============================================================================
insert into public.brand_settings (id, name) values (true, 'Rally Badminton');

insert into public.amenities (code, label, icon, sort_order) values
  ('motorbike_parking', 'Giữ xe máy',        'bike',        10),
  ('car_parking',       'Bãi đậu ô tô',      'car',         20),
  ('air_conditioning',  'Máy lạnh / quạt lớn','fan',         30),
  ('shower',            'Phòng tắm',         'shower-head', 40),
  ('locker',            'Tủ đồ',             'lock',        50),
  ('drinks',            'Nước uống tại quầy','cup-soda',    60),
  ('equipment_rental',  'Cho thuê vợt/giày', 'package',     70),
  ('wifi',              'Wi-Fi miễn phí',    'wifi',        80);

insert into public.court_surfaces (code, label, sort_order) values
  ('pvc_mat',   'Thảm PVC thi đấu', 10),
  ('wood',      'Sàn gỗ',           20),
  ('synthetic', 'Sàn tổng hợp',     30);

insert into public.product_categories (slug, name, sort_order) values
  ('vot',        'Vợt',            10),
  ('cau',        'Cầu',            20),
  ('giay',       'Giày',           30),
  ('quan-ao',    'Quần áo',        40),
  ('do-uong',    'Đồ uống',        50),
  ('phu-kien',   'Phụ kiện',       60);

-- =============================================================================
-- 12. KHỞI TẠO OWNER ĐẦU TIÊN (chỉ chạy được khi chưa có owner, chỉ từ SQL Editor)
--     B1: Dashboard > Authentication > Add user (email + mật khẩu mạnh)
--     B2: select private.bootstrap_first_owner('email@cua-ban.vn', 'Tên chủ sân');
-- =============================================================================
create function private.bootstrap_first_owner(p_email text, p_display_name text default 'Chủ sân')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if exists (select 1 from public.staff_accounts where role = 'owner') then
    raise exception using errcode = 'P0001', message = 'OWNER_ALREADY_EXISTS';
  end if;
  select u.id into v_user from auth.users u where lower(u.email) = lower(btrim(p_email));
  if v_user is null then
    raise exception using errcode = 'P0001', message = 'AUTH_USER_NOT_FOUND',
      hint = 'Tạo user trong Authentication trước.';
  end if;
  insert into public.staff_accounts (user_id, role, display_name, must_change_password)
  values (v_user, 'owner', p_display_name, false);
  return v_user;
end;
$$;
revoke all on function private.bootstrap_first_owner(text, text) from public, anon, authenticated;

commit;
