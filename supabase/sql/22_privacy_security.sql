-- =============================================================================
-- 22_privacy_security.sql — RALLY SECURITY & PRIVACY UPGRADE 2026
-- Chạy SAU 21_attendance_rules.sql. Chạy lại nhiều lần an toàn (idempotent).
--
-- Căn cứ: Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 và Nghị định 356/2025/NĐ-CP
-- (cùng hiệu lực 01/01/2026, thay Nghị định 13/2023/NĐ-CP).
--
--  1. brand_settings: thêm thông tin pháp lý (tên doanh nghiệp, MST, địa chỉ, đầu mối dữ liệu cá nhân).
--  2. legal_documents: văn bản pháp lý có PHIÊN BẢN (chủ sân sửa trong quản trị → thêm phiên bản mới,
--     phiên bản cũ giữ nguyên để làm bằng chứng). Khách đọc công khai.
--  3. privacy_consents: bằng chứng xác nhận / đồng ý theo TỪNG mục đích (Điều 9 Luật; Điều 6 NĐ 356):
--     ai, lúc nào, nội dung ô đã chọn, phiên bản văn bản. Chỉ thêm, không sửa / xóa; rút lại = thêm dòng mới.
--     Đồng ý nhận tin khuyến mãi tách riêng, không chọn sẵn; đồng bộ với customers / member_profiles.
--  4. data_subject_requests: yêu cầu xem / tải / sửa / xóa / rút đồng ý… kèm hạn xử lý theo Điều 5 NĐ 356
--     (phản hồi 2 ngày làm việc; xem-sửa-cung cấp 10 ngày; rút đồng ý-hạn chế-phản đối 15 ngày; xóa 20 ngày).
--  5. anonymize_customer: "xóa" = ẩn danh hóa (tên, SĐT, email, ghi chú) trên khách, đơn, thành viên và nhật ký;
--     giữ nguyên đơn / giao dịch (soft-delete, chứng từ kế toán).
--  6. data_retention_policies + apply_retention: thời hạn lưu trữ, tự xóa / ẩn danh khi hết hạn.
--  7. payment_webhook_events: nhật ký mọi lần gọi webhook thanh toán (kể cả bị từ chối) để đối soát.
--  8. Băm số điện thoại trong bảng chống tra cứu dồn dập (trước đây lưu số thật 1 ngày).
-- =============================================================================

-- 0. Tiện ích -------------------------------------------------------------------------------------

-- Cộng N ngày làm việc (bỏ Thứ Bảy, Chủ nhật — giờ Việt Nam). Ngày lễ do chủ sân tự trừ khi cần.
create or replace function private.add_working_days(p_from timestamptz, p_days integer)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  v timestamptz := p_from;
  n integer := 0;
begin
  while n < greatest(p_days, 0) loop
    v := v + interval '1 day';
    if extract(isodow from (v at time zone 'Asia/Ho_Chi_Minh')) < 6 then
      n := n + 1;
    end if;
  end loop;
  return v;
end;
$$;

-- Mã băm có "muối" cố định theo mục đích (giả danh hóa — vẫn là dữ liệu cá nhân, chỉ giảm rủi ro lộ số thật).
create or replace function private.pseudonymize(p_purpose text, p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_value is null or p_value = '' then null
              else encode(pg_catalog.sha256(convert_to('rally:' || p_purpose || ':' || p_value, 'UTF8')), 'hex') end;
$$;

-- Bỏ các trường định danh khỏi một bản ghi nhật ký (jsonb).
create or replace function private.redact_pii(p_data jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when p_data is null then null
    when p_data ?| array['full_name', 'phone', 'email', 'staff_note', 'contact_name', 'customer_note', 'requester_name', 'details',
                         'internal_note', 'note', 'collateral']
      then (p_data - array['full_name', 'phone', 'email', 'staff_note', 'contact_name', 'customer_note', 'requester_name', 'details',
                           'internal_note', 'note', 'collateral'])
           || '{"_redacted": true}'::jsonb
    else p_data end;
$$;

-- 1. Thông tin pháp lý của doanh nghiệp (mã số thuế đã có sẵn từ 06_product_tax.sql) -------------------
alter table public.brand_settings
  add column if not exists legal_name      text,
  add column if not exists legal_address   text,
  add column if not exists privacy_email   text,
  add column if not exists privacy_contact text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'brand_settings_legal_check') then
    alter table public.brand_settings add constraint brand_settings_legal_check check (
      (legal_name is null or char_length(btrim(legal_name)) between 2 and 200)
      and (legal_address is null or char_length(btrim(legal_address)) between 5 and 300)
      and (privacy_email is null or privacy_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
      and (privacy_contact is null or char_length(btrim(privacy_contact)) between 2 and 120));
  end if;
end $$;
comment on column public.brand_settings.legal_name is 'Tên doanh nghiệp / hộ kinh doanh — bên kiểm soát dữ liệu cá nhân.';
comment on column public.brand_settings.privacy_contact is 'Người / bộ phận phụ trách bảo vệ dữ liệu cá nhân.';

-- 2. Văn bản pháp lý có phiên bản ---------------------------------------------------------------
create table if not exists public.legal_documents (
  id           uuid primary key default gen_random_uuid(),
  code         text not null constraint legal_documents_code check (code in ('privacy', 'terms', 'cancellation', 'cookies')),
  version      integer not null constraint legal_documents_version_pos check (version >= 1),
  title        text not null constraint legal_documents_title_len check (char_length(btrim(title)) between 3 and 120),
  summary      text constraint legal_documents_summary_len check (summary is null or char_length(summary) <= 400),
  body         text not null constraint legal_documents_body_len check (char_length(body) between 50 and 60000),
  change_note  text constraint legal_documents_note_len check (change_note is null or char_length(change_note) <= 300),
  effective_at timestamptz not null default now(),
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint legal_documents_version_uniq unique (code, version)
);
create index if not exists legal_documents_current_idx on public.legal_documents (code, effective_at desc, version desc);
comment on table public.legal_documents is
  'Chính sách / điều khoản công khai. Mỗi lần sửa là một phiên bản mới; không sửa, không xóa phiên bản cũ (bằng chứng).';

alter table public.legal_documents enable row level security;
drop policy if exists legal_documents_public_read on public.legal_documents;
create policy legal_documents_public_read on public.legal_documents for select to anon, authenticated using (true);
grant select on public.legal_documents to anon, authenticated;

drop trigger if exists legal_documents_append_only on public.legal_documents;
create trigger legal_documents_append_only before update on public.legal_documents
  for each row execute function private.forbid_update();
drop trigger if exists no_delete_legal_documents on public.legal_documents;
create trigger no_delete_legal_documents before delete on public.legal_documents
  for each row execute function private.forbid_hard_delete();
drop trigger if exists audit_legal_documents on public.legal_documents;
create trigger audit_legal_documents after insert on public.legal_documents
  for each row execute function private.audit_row_change('id', '-');

-- Phiên bản đang áp dụng của một văn bản.
create or replace function private.current_legal_document(p_code text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select d.id from public.legal_documents d
   where d.code = p_code and d.effective_at <= now()
   order by d.effective_at desc, d.version desc
   limit 1;
$$;

-- Chủ sân đăng phiên bản mới (không sửa bản cũ). Hiệu lực từ bây giờ hoặc một ngày trong 90 ngày tới.
create or replace function public.publish_legal_document(
  p_code text,
  p_title text,
  p_summary text,
  p_body text,
  p_change_note text,
  p_effective_at timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version integer;
  v_id uuid;
  v_at timestamptz := coalesce(p_effective_at, now());
begin
  perform private.require_owner();
  if p_code not in ('privacy', 'terms', 'cancellation', 'cookies') then
    perform private.raise_error('INVALID_LEGAL_DOCUMENT');
  end if;
  if v_at < now() - interval '5 minutes' or v_at > now() + interval '90 days' then
    perform private.raise_error('INVALID_EFFECTIVE_DATE');
  end if;
  if char_length(btrim(coalesce(p_change_note, ''))) < 3 then
    perform private.raise_error('CHANGE_NOTE_REQUIRED');
  end if;
  perform pg_advisory_xact_lock(hashtext('legal_documents:' || p_code));
  select coalesce(max(version), 0) + 1 into v_version from public.legal_documents where code = p_code;
  perform private.set_audit_reason('legal: đăng phiên bản ' || v_version);
  insert into public.legal_documents (code, version, title, summary, body, change_note, effective_at, created_by)
  values (p_code, v_version, btrim(p_title), nullif(btrim(coalesce(p_summary, '')), ''), p_body,
          btrim(p_change_note), v_at, (select auth.uid()))
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'version', v_version, 'effective_at', v_at);
end;
$$;

-- 3. Bằng chứng xác nhận / đồng ý ---------------------------------------------------------------
create table if not exists public.privacy_consents (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid references public.customers (id),
  auth_user_id      uuid references auth.users (id) on delete set null,
  booking_id        uuid references public.bookings (id),
  purpose           text not null constraint privacy_consents_purpose check (purpose in ('booking_terms', 'account_terms', 'marketing')),
  granted           boolean not null,
  privacy_doc_id    uuid references public.legal_documents (id),
  terms_doc_id      uuid references public.legal_documents (id),
  source            text not null constraint privacy_consents_source check (source in ('booking_form', 'register_form', 'account', 'data_request', 'staff')),
  wording           text not null constraint privacy_consents_wording_len check (char_length(wording) between 5 and 500),
  ip_hash           text constraint privacy_consents_ip_len check (ip_hash is null or char_length(ip_hash) <= 64),
  user_agent        text constraint privacy_consents_ua_len check (user_agent is null or char_length(user_agent) <= 300),
  created_by        uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  constraint privacy_consents_subject check (customer_id is not null or auth_user_id is not null)
);
create index if not exists privacy_consents_customer_idx on public.privacy_consents (customer_id, purpose, created_at desc) where customer_id is not null;
create index if not exists privacy_consents_user_idx on public.privacy_consents (auth_user_id, purpose, created_at desc) where auth_user_id is not null;
create unique index if not exists privacy_consents_booking_uidx on public.privacy_consents (booking_id, purpose) where booking_id is not null;
comment on table public.privacy_consents is
  'Bằng chứng đồng ý / xác nhận theo từng mục đích (Điều 9 Luật 91/2025; Điều 6 NĐ 356/2025). Chỉ thêm; rút lại = dòng granted=false.';

-- Hồ sơ khách gắn với tài khoản đang đăng nhập (đọc qua hàm vì thành viên không có quyền đọc bảng customers).
create or replace function private.my_customer_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id from public.customers c where c.auth_user_id = (select auth.uid());
$$;
grant execute on function private.my_customer_id() to authenticated;

alter table public.privacy_consents enable row level security;
drop policy if exists privacy_consents_read on public.privacy_consents;
create policy privacy_consents_read on public.privacy_consents for select to authenticated
  using ((select private.is_owner())
         or auth_user_id = (select auth.uid())
         or customer_id = (select private.my_customer_id()));
grant select on public.privacy_consents to authenticated;

drop trigger if exists privacy_consents_append_only on public.privacy_consents;
create trigger privacy_consents_append_only before update on public.privacy_consents
  for each row execute function private.forbid_update();
drop trigger if exists no_delete_privacy_consents on public.privacy_consents;
create trigger no_delete_privacy_consents before delete on public.privacy_consents
  for each row execute function private.forbid_hard_delete();

-- Đồng ý nhận tin mới nhất → cập nhật cờ marketing_opt_in (khách + thành viên) để màn hình cũ vẫn đúng.
create or replace function private.privacy_consents_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := new.auth_user_id;
begin
  if new.purpose <> 'marketing' then
    return null;
  end if;
  perform set_config('rally.consent_sync', 'on', true);
  if new.customer_id is not null then
    update public.customers set marketing_opt_in = new.granted
     where id = new.customer_id and marketing_opt_in is distinct from new.granted;
    select coalesce(v_uid, c.auth_user_id) into v_uid from public.customers c where c.id = new.customer_id;
  end if;
  if v_uid is not null then
    update public.member_profiles set marketing_opt_in = new.granted
     where user_id = v_uid and marketing_opt_in is distinct from new.granted;
    update public.customers set marketing_opt_in = new.granted
     where auth_user_id = v_uid and marketing_opt_in is distinct from new.granted;
  end if;
  perform set_config('rally.consent_sync', 'off', true);
  return null;
end;
$$;
drop trigger if exists privacy_consents_sync on public.privacy_consents;
create trigger privacy_consents_sync after insert on public.privacy_consents
  for each row execute function private.privacy_consents_sync();

-- Nhân viên / thành viên đổi cờ nhận tin ở màn hình cũ → tự ghi bằng chứng (không mất dấu ai đổi).
create or replace function private.marketing_flag_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_customer uuid;
  v_user uuid;
begin
  if new.marketing_opt_in is not distinct from old.marketing_opt_in
     or coalesce(current_setting('rally.consent_sync', true), 'off') = 'on' then
    return null;
  end if;
  if tg_table_name = 'customers' then
    v_customer := new.id;
    v_user := new.auth_user_id;
  else
    v_user := new.user_id;
  end if;
  insert into public.privacy_consents (customer_id, auth_user_id, purpose, granted, privacy_doc_id, source, wording, created_by)
  values (v_customer, v_user, 'marketing', new.marketing_opt_in, private.current_legal_document('privacy'),
          case when v_actor is not null and v_actor = v_user then 'account' else 'staff' end,
          case when v_actor is not null and v_actor = v_user
               then 'Nhận tin ưu đãi dành cho thành viên (đổi trong tài khoản)'
               else 'Nhân viên cập nhật lựa chọn nhận tin theo yêu cầu của khách' end,
          v_actor);
  return null;
end;
$$;
drop trigger if exists customers_marketing_audit on public.customers;
create trigger customers_marketing_audit after update of marketing_opt_in on public.customers
  for each row execute function private.marketing_flag_audit();
drop trigger if exists member_profiles_marketing_audit on public.member_profiles;
create trigger member_profiles_marketing_audit after update of marketing_opt_in on public.member_profiles
  for each row execute function private.marketing_flag_audit();

-- Ghi xác nhận / đồng ý từ máy chủ web (khóa bí mật). Một đơn chỉ ghi mỗi mục đích một lần.
create or replace function private.record_consent(
  p_customer_id uuid, p_user_id uuid, p_booking_id uuid, p_purpose text, p_granted boolean,
  p_source text, p_wording text, p_ip_hash text, p_user_agent text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.privacy_consents (customer_id, auth_user_id, booking_id, purpose, granted, privacy_doc_id, terms_doc_id,
                                       source, wording, ip_hash, user_agent, created_by)
  values (p_customer_id, p_user_id, p_booking_id, p_purpose, p_granted,
          private.current_legal_document('privacy'),
          case when p_purpose in ('booking_terms', 'account_terms') then private.current_legal_document('terms') end,
          p_source, left(btrim(p_wording), 500), left(p_ip_hash, 64), left(p_user_agent, 300), (select auth.uid()))
  on conflict (booking_id, purpose) where booking_id is not null do nothing
  returning id into v_id;
  return v_id;
end;
$$;

-- Giữ sân + lưu bằng chứng trong CÙNG một giao dịch (không có đơn nào thiếu bằng chứng xác nhận).
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
  v_result jsonb;
  v_booking_id uuid;
  v_customer uuid;
begin
  perform private.require_service_role();
  if char_length(btrim(coalesce(p_terms_wording, ''))) < 5 then
    perform private.raise_error('TERMS_NOT_ACCEPTED');
  end if;
  v_result := public.create_guest_booking_hold(p_court_id, p_starts_at, p_ends_at, p_contact_name, p_phone,
                                               p_customer_note, p_idempotency_key);
  v_booking_id := (v_result ->> 'booking_id')::uuid;
  select b.customer_id into v_customer from public.bookings b where b.id = v_booking_id;
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

-- Thành viên mới đăng ký: xác nhận điều khoản + (tùy chọn) nhận tin.
create or replace function public.service_record_member_consents(
  p_user_id uuid, p_terms_wording text, p_marketing boolean, p_marketing_wording text, p_ip_hash text, p_user_agent text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_service_role();
  -- Đã có xác nhận điều khoản (vd. đăng nhập Google lần thứ hai) thì không ghi thêm.
  if exists (select 1 from public.privacy_consents c where c.auth_user_id = p_user_id and c.purpose = 'account_terms') then
    return;
  end if;
  perform private.record_consent(null, p_user_id, null, 'account_terms', true, 'register_form', p_terms_wording, p_ip_hash, p_user_agent);
  if coalesce(p_marketing, false) then
    perform private.record_consent(null, p_user_id, null, 'marketing', true, 'register_form',
                                   coalesce(p_marketing_wording, 'Nhận tin khuyến mãi'), p_ip_hash, p_user_agent);
  end if;
end;
$$;

-- Thành viên bật / tắt nhận tin (rút lại đồng ý có hiệu lực ngay).
create or replace function public.member_set_marketing(p_granted boolean, p_wording text, p_user_agent text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not exists (select 1 from public.member_profiles m where m.user_id = v_uid) then
    perform private.raise_error('MEMBER_NOT_FOUND');
  end if;
  perform private.record_consent((select c.id from public.customers c where c.auth_user_id = v_uid), v_uid, null,
                                 'marketing', coalesce(p_granted, false), 'account', coalesce(p_wording, 'Nhận tin ưu đãi'),
                                 null, p_user_agent);
  return jsonb_build_object('marketing_opt_in', coalesce(p_granted, false));
end;
$$;

-- 4. Yêu cầu của chủ thể dữ liệu --------------------------------------------------------------------
create table if not exists public.data_subject_requests (
  id                uuid primary key default gen_random_uuid(),
  code              text not null default private.random_code('DR') constraint data_requests_code_key unique,
  kind              text not null constraint data_requests_kind check (kind in ('access', 'export', 'correct', 'delete', 'withdraw', 'restrict', 'object', 'complaint')),
  status            text not null default 'received'
                      constraint data_requests_status check (status in ('received', 'in_progress', 'extended', 'completed', 'rejected', 'cancelled')),
  requester_name    text not null constraint data_requests_name_len check (char_length(btrim(requester_name)) between 2 and 80),
  phone             text constraint data_requests_phone_fmt check (phone is null or phone ~ '^0[35789][0-9]{8}$'),
  email             text constraint data_requests_email_fmt check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  auth_user_id      uuid references auth.users (id) on delete set null,
  customer_id       uuid references public.customers (id),
  booking_code      text constraint data_requests_booking_len check (booking_code is null or char_length(booking_code) <= 20),
  verified          boolean not null default false,
  verification_note text constraint data_requests_verify_len check (verification_note is null or char_length(verification_note) <= 300),
  details           text not null constraint data_requests_details_len check (char_length(btrim(details)) between 5 and 2000),
  channel           text not null default 'web' constraint data_requests_channel check (channel in ('web', 'account', 'counter', 'email', 'phone')),
  received_at       timestamptz not null default now(),
  ack_due_at        timestamptz not null,
  due_at            timestamptz not null,
  extended_due_at   timestamptz,
  extension_reason  text constraint data_requests_ext_len check (extension_reason is null or char_length(extension_reason) <= 300),
  acknowledged_at   timestamptz,
  resolved_at       timestamptz,
  resolution_note   text constraint data_requests_resolution_len check (resolution_note is null or char_length(resolution_note) <= 2000),
  handled_by        uuid references auth.users (id) on delete set null,
  ip_hash           text,
  redacted_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint data_requests_contact check (phone is not null or email is not null or auth_user_id is not null or redacted_at is not null),
  constraint data_requests_resolved check (status not in ('completed', 'rejected') or (resolved_at is not null and resolution_note is not null)),
  constraint data_requests_extended check (status <> 'extended' or (extended_due_at is not null and extension_reason is not null))
);
create index if not exists data_requests_open_idx on public.data_subject_requests (due_at)
  where status in ('received', 'in_progress', 'extended');
create index if not exists data_requests_user_idx on public.data_subject_requests (auth_user_id, created_at desc) where auth_user_id is not null;
comment on table public.data_subject_requests is
  'Yêu cầu thực hiện quyền của chủ thể dữ liệu (Điều 4 Luật 91/2025) và hạn xử lý theo Điều 5 NĐ 356/2025.';

alter table public.data_subject_requests enable row level security;
drop policy if exists data_requests_read on public.data_subject_requests;
create policy data_requests_read on public.data_subject_requests for select to authenticated
  using ((select private.is_owner()) or auth_user_id = (select auth.uid()));
grant select on public.data_subject_requests to authenticated;

drop trigger if exists touch_data_requests on public.data_subject_requests;
create trigger touch_data_requests before update on public.data_subject_requests
  for each row execute function private.touch_updated_at();
drop trigger if exists no_delete_data_requests on public.data_subject_requests;
create trigger no_delete_data_requests before delete on public.data_subject_requests
  for each row execute function private.forbid_hard_delete();
drop trigger if exists audit_data_requests on public.data_subject_requests;
create trigger audit_data_requests after insert or update on public.data_subject_requests
  for each row execute function private.audit_row_change('id', '-');

-- Số ngày phải thực hiện xong theo loại yêu cầu (Điều 5 NĐ 356/2025). Gia hạn tối đa 1 lần, bằng đúng số ngày này.
create or replace function private.data_request_days(p_kind text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'access' then 10 when 'export' then 10 when 'correct' then 10
    when 'delete' then 20
    else 15 end;  -- withdraw, restrict, object, complaint
$$;

-- Chống gửi dồn dập: tái dùng bảng đếm lượt của tra cứu đơn (mở rộng loại).
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'guest_lookup_kind') then
    alter table private.guest_lookup_attempts drop constraint guest_lookup_kind;
  end if;
  alter table private.guest_lookup_attempts add constraint guest_lookup_kind
    check (kind in ('phone', 'client', 'reveal_fail', 'dsr_client', 'dsr_phone'));
end $$;

-- Không lưu số điện thoại thật trong bảng đếm lượt: băm có muối trước khi so / ghi.
create or replace function private.guest_lookup_guard(p_kind text, p_key text, p_limit integer, p_window interval)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := case when p_kind in ('phone', 'dsr_phone') then private.pseudonymize('lookup', p_key) else p_key end;
begin
  if v_key is null or v_key = '' then
    return;
  end if;
  if (select count(*) from private.guest_lookup_attempts a
       where a.kind = p_kind and a.key = v_key and a.created_at > now() - p_window) >= p_limit then
    perform private.raise_error('RATE_LIMITED');
  end if;
end;
$$;

create or replace function private.guest_lookup_attempts_hash()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind in ('phone', 'dsr_phone') and new.key ~ '^0[0-9]{9}$' then
    new.key := private.pseudonymize('lookup', new.key);
  end if;
  return new;
end;
$$;
drop trigger if exists guest_lookup_attempts_hash on private.guest_lookup_attempts;
create trigger guest_lookup_attempts_hash before insert on private.guest_lookup_attempts
  for each row execute function private.guest_lookup_attempts_hash();
delete from private.guest_lookup_attempts where kind = 'phone' and key ~ '^0[0-9]{9}$';

-- Khách gửi yêu cầu từ website (máy chủ gọi sau khi xác minh Turnstile).
-- Tự xác minh khi SĐT + mã đơn khớp, hoặc khi gửi từ tài khoản thành viên đã đăng nhập.
create or replace function public.service_submit_data_request(
  p_kind text,
  p_name text,
  p_phone text,
  p_email text,
  p_booking_code text,
  p_details text,
  p_user_id uuid,
  p_ip_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := private.normalize_vn_phone(nullif(btrim(coalesce(p_phone, '')), ''));
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_code text := nullif(upper(regexp_replace(coalesce(p_booking_code, ''), '\s', '', 'g')), '');
  v_customer uuid;
  v_verified boolean := false;
  v_note text;
  v_now timestamptz := now();
  v_row public.data_subject_requests;
begin
  perform private.require_service_role();
  if p_kind not in ('access', 'export', 'correct', 'delete', 'withdraw', 'restrict', 'object', 'complaint') then
    perform private.raise_error('INVALID_DATA_REQUEST');
  end if;
  if nullif(btrim(coalesce(p_phone, '')), '') is not null and v_phone is null then
    perform private.raise_error('INVALID_PHONE');
  end if;
  if v_phone is null and v_email is null and p_user_id is null then
    perform private.raise_error('CONTACT_REQUIRED');
  end if;

  delete from private.guest_lookup_attempts where created_at < now() - interval '1 day';
  perform private.guest_lookup_guard('dsr_client', p_ip_hash, 5, interval '1 hour');
  perform private.guest_lookup_guard('dsr_phone', v_phone, 3, interval '1 day');
  if p_ip_hash is not null then
    insert into private.guest_lookup_attempts (kind, key) values ('dsr_client', left(p_ip_hash, 128));
  end if;
  if v_phone is not null then
    insert into private.guest_lookup_attempts (kind, key) values ('dsr_phone', v_phone);
  end if;

  if p_user_id is not null then
    select c.id into v_customer from public.customers c where c.auth_user_id = p_user_id;
    v_verified := true;
    v_note := 'Gửi từ tài khoản thành viên đã đăng nhập';
  elsif v_phone is not null and v_code is not null then
    select b.customer_id into v_customer
      from public.bookings b join public.customers c on c.id = b.customer_id
     where b.code = v_code and c.phone = v_phone;
    if v_customer is not null then
      v_verified := true;
      v_note := 'Số điện thoại khớp với mã đơn ' || v_code;
    end if;
  end if;
  if v_customer is null and v_phone is not null then
    select c.id into v_customer from public.customers c where c.phone = v_phone;
  end if;

  insert into public.data_subject_requests (kind, requester_name, phone, email, auth_user_id, customer_id, booking_code,
                                            verified, verification_note, details, channel, received_at, ack_due_at, due_at, ip_hash)
  values (p_kind, btrim(p_name), v_phone, v_email, p_user_id, v_customer, v_code, v_verified, v_note, btrim(p_details),
          case when p_user_id is null then 'web' else 'account' end, v_now,
          private.add_working_days(v_now, 2), v_now + make_interval(days => private.data_request_days(p_kind)),
          left(p_ip_hash, 64))
  returning * into v_row;

  return jsonb_build_object('id', v_row.id, 'code', v_row.code, 'kind', v_row.kind, 'verified', v_row.verified,
                            'ack_due_at', v_row.ack_due_at, 'due_at', v_row.due_at);
end;
$$;

-- Chủ sân xử lý: tiếp nhận, xác minh, gia hạn (1 lần, có lý do), hoàn tất / từ chối (bắt buộc ghi kết quả).
create or replace function public.update_data_request(
  p_id uuid,
  p_status text,
  p_note text default null,
  p_verified boolean default null,
  p_extension_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.data_subject_requests;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  perform private.require_owner();
  select * into v from public.data_subject_requests where id = p_id for update;
  if not found then
    perform private.raise_error('DATA_REQUEST_NOT_FOUND');
  end if;
  if v.status in ('completed', 'rejected', 'cancelled') then
    perform private.raise_error('DATA_REQUEST_CLOSED');
  end if;
  if p_status not in ('in_progress', 'extended', 'completed', 'rejected', 'cancelled') then
    perform private.raise_error('INVALID_STATUS', p_status);
  end if;
  if p_status = 'extended' then
    if v.extended_due_at is not null then
      perform private.raise_error('DATA_REQUEST_EXTENDED_ONCE');
    end if;
    if char_length(btrim(coalesce(p_extension_reason, ''))) < 5 then
      perform private.raise_error('EXTENSION_REASON_REQUIRED');
    end if;
  end if;
  if p_status in ('completed', 'rejected') and v_note is null then
    perform private.raise_error('RESOLUTION_NOTE_REQUIRED');
  end if;
  if p_status = 'completed' and not coalesce(p_verified, v.verified) and v.kind in ('access', 'export', 'delete', 'correct') then
    perform private.raise_error('DATA_REQUEST_NOT_VERIFIED');
  end if;

  perform private.set_audit_reason('privacy: ' || p_status);
  update public.data_subject_requests
     set status = p_status,
         verified = coalesce(p_verified, verified),
         verification_note = case when p_verified is true and not v.verified then 'Chủ sân xác minh' else verification_note end,
         acknowledged_at = coalesce(acknowledged_at, now()),
         extended_due_at = case when p_status = 'extended'
                                then v.due_at + make_interval(days => private.data_request_days(v.kind)) else extended_due_at end,
         extension_reason = case when p_status = 'extended' then btrim(p_extension_reason) else extension_reason end,
         resolved_at = case when p_status in ('completed', 'rejected', 'cancelled') then now() else resolved_at end,
         resolution_note = coalesce(v_note, resolution_note),
         handled_by = (select auth.uid())
   where id = p_id
   returning * into v;
  return to_jsonb(v);
end;
$$;

-- Số yêu cầu đang mở / quá hạn (thanh bên quản trị).
create or replace function public.data_request_counts()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not private.is_owner() then jsonb_build_object('open', 0, 'overdue', 0, 'unacknowledged', 0)
  else jsonb_build_object(
    'open', count(*),
    'overdue', count(*) filter (where coalesce(extended_due_at, due_at) < now()),
    'unacknowledged', count(*) filter (where acknowledged_at is null))
  end
  from public.data_subject_requests
  where status in ('received', 'in_progress', 'extended');
$$;

-- 5. Ẩn danh hóa khách ------------------------------------------------------------------------------
alter table public.customers add column if not exists anonymized_at timestamptz;
alter table public.member_profiles add column if not exists anonymized_at timestamptz;

-- SĐT sau ẩn danh là mã ngẫu nhiên "x…" (không phải số thật, không suy ngược được) để giữ ràng buộc duy nhất.
alter table public.customers drop constraint if exists customers_phone_fmt;
alter table public.customers add constraint customers_phone_fmt
  check (phone ~ '^0[35789][0-9]{8}$' or (anonymized_at is not null and phone ~ '^x[0-9a-f]{12}$'));

-- Khách đã ẩn danh: không ai sửa lại thông tin (tránh gắn lại danh tính).
create or replace function private.customers_anonymized_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.anonymized_at is not null and coalesce(current_setting('rally.privacy_redact', true), 'off') <> 'on'
     and (new.full_name, new.phone, new.email, new.staff_note, new.auth_user_id, new.anonymized_at)
         is distinct from (old.full_name, old.phone, old.email, old.staff_note, old.auth_user_id, old.anonymized_at) then
    raise exception using errcode = 'P0001', message = 'CUSTOMER_ANONYMIZED';
  end if;
  return new;
end;
$$;
drop trigger if exists customers_anonymized_guard on public.customers;
create trigger customers_anonymized_guard before update on public.customers
  for each row execute function private.customers_anonymized_guard();

-- Nhật ký thay đổi: chỉ thêm, NGOẠI TRỪ bước ẩn danh hóa (chỉ được xóa trường định danh trong old/new_data).
create or replace function private.audit_events_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('rally.privacy_redact', true), 'off') = 'on'
     and (new.id, new.occurred_at, new.actor_id, new.actor_role, new.branch_id, new.table_name, new.record_id, new.action)
         is not distinct from (old.id, old.occurred_at, old.actor_id, old.actor_role, old.branch_id, old.table_name, old.record_id, old.action) then
    return new;
  end if;
  raise exception using errcode = 'P0001', message = 'APPEND_ONLY_TABLE',
    detail = 'public.audit_events không cho phép sửa.';
end;
$$;
drop trigger if exists audit_events_append_only on public.audit_events;
create trigger audit_events_append_only before update on public.audit_events
  for each row execute function private.audit_events_guard();

-- Ghi nhật ký: khi đang ẩn danh hóa thì bỏ trường định danh khỏi bản ghi nhật ký mới.
create or replace function private.audit_row_change()
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

  if coalesce(current_setting('rally.privacy_redact', true), 'off') = 'on' then
    v_old := private.redact_pii(v_old);
    v_new := private.redact_pii(v_new);
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

-- Lõi ẩn danh hóa (dùng chung cho chủ sân và tác vụ lưu trữ tự động). Trả về auth_user_id cũ (nếu là thành viên)
-- để máy chủ web vô hiệu hóa tài khoản đăng nhập (Supabase Auth — xóa mềm).
create or replace function private.anonymize_customer_core(p_customer_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.customers;
  v_uid uuid;
begin
  select * into v from public.customers where id = p_customer_id for update;
  if not found then
    perform private.raise_error('CUSTOMER_NOT_FOUND');
  end if;
  if v.anonymized_at is not null then
    perform private.raise_error('CUSTOMER_ANONYMIZED');
  end if;
  if exists (select 1 from public.bookings b
              where b.customer_id = p_customer_id and b.status in ('held', 'confirmed', 'checked_in')
                and upper(b.during) > now() - interval '1 hour') then
    perform private.raise_error('CUSTOMER_HAS_ACTIVE_BOOKINGS');
  end if;
  if exists (select 1 from public.rentals r where r.customer_id = p_customer_id and r.status = 'out') then
    perform private.raise_error('CUSTOMER_HAS_OPEN_RENTALS');
  end if;
  v_uid := v.auth_user_id;

  perform set_config('rally.privacy_redact', 'on', true);
  perform set_config('rally.consent_sync', 'on', true);
  perform private.set_audit_reason(left('privacy: ẩn danh hóa — ' || coalesce(p_reason, ''), 300));

  update public.customers
     set full_name = 'Khách đã xóa dữ liệu',
         phone = 'x' || substr(md5(gen_random_uuid()::text), 1, 12),
         email = null,
         staff_note = null,
         marketing_opt_in = false,
         auth_user_id = null,
         anonymized_at = now()
   where id = p_customer_id;

  update public.bookings
     set contact_name = 'Khách đã xóa', customer_note = null, internal_note = case when kind = 'block' then internal_note end
   where customer_id = p_customer_id;
  update public.rentals
     set collateral = case when collateral is null then null else 'Đã xóa' end, note = null
   where customer_id = p_customer_id and (collateral is not null or note is not null);
  update public.sales set note = null where customer_id = p_customer_id and note is not null;

  if v_uid is not null then
    update public.member_profiles
       set full_name = 'Thành viên đã xóa', phone = null, staff_note = null, marketing_opt_in = false,
           is_locked = true, anonymized_at = now()
     where user_id = v_uid;
  end if;

  -- Xóa trường định danh trong nhật ký cũ của khách, các đơn và hồ sơ thành viên.
  update public.audit_events e
     set old_data = private.redact_pii(e.old_data), new_data = private.redact_pii(e.new_data)
   where (e.table_name = 'customers' and e.record_id = p_customer_id::text)
      or (e.table_name = 'bookings' and e.record_id in (select b.id::text from public.bookings b where b.customer_id = p_customer_id))
      or (e.table_name = 'rentals' and e.record_id in (select r.id::text from public.rentals r where r.customer_id = p_customer_id))
      or (e.table_name = 'sales' and e.record_id in (select x.id::text from public.sales x where x.customer_id = p_customer_id))
      or (v_uid is not null and e.table_name = 'member_profiles' and e.record_id = v_uid::text);

  perform set_config('rally.privacy_redact', 'off', true);
  perform set_config('rally.consent_sync', 'off', true);
  return v_uid;
end;
$$;

-- Chủ sân ẩn danh hóa một khách (thường để thực hiện yêu cầu xóa). Có mã yêu cầu thì tự hoàn tất yêu cầu đó.
create or replace function public.anonymize_customer(p_customer_id uuid, p_request_id uuid default null, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_req public.data_subject_requests;
begin
  perform private.require_owner();
  if p_request_id is not null then
    select * into v_req from public.data_subject_requests where id = p_request_id for update;
    if not found then
      perform private.raise_error('DATA_REQUEST_NOT_FOUND');
    end if;
    if not v_req.verified then
      perform private.raise_error('DATA_REQUEST_NOT_VERIFIED');
    end if;
  elsif char_length(btrim(coalesce(p_reason, ''))) < 5 then
    perform private.raise_error('REASON_REQUIRED');
  end if;

  v_uid := private.anonymize_customer_core(p_customer_id, coalesce(v_req.code, btrim(p_reason)));

  if v_req.id is not null and v_req.status in ('received', 'in_progress', 'extended') then
    perform private.set_audit_reason('privacy: hoàn tất yêu cầu xóa');
    update public.data_subject_requests
       set status = 'completed', acknowledged_at = coalesce(acknowledged_at, now()), resolved_at = now(),
           resolution_note = coalesce(resolution_note, 'Đã ẩn danh hóa thông tin liên hệ trên hồ sơ khách, các đơn và nhật ký. '
                                     || 'Đơn và giao dịch được giữ ở dạng không định danh theo nghĩa vụ kế toán.'),
           customer_id = p_customer_id, handled_by = (select auth.uid())
     where id = v_req.id;
  end if;
  return jsonb_build_object('customer_id', p_customer_id, 'auth_user_id', v_uid);
end;
$$;

-- Tối thiểu hóa dữ liệu: vật cầm cọc khi thuê đồ chỉ ghi LOẠI giấy tờ (vd. "CCCD"), không ghi số giấy tờ.
create or replace function private.rentals_collateral_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.collateral is not null and new.collateral ~ '[0-9][0-9 .-]{7,}[0-9]'
     and (tg_op = 'INSERT' or new.collateral is distinct from old.collateral) then
    raise exception using errcode = 'P0001', message = 'COLLATERAL_NO_ID_NUMBER';
  end if;
  return new;
end;
$$;
drop trigger if exists rentals_collateral_guard on public.rentals;
create trigger rentals_collateral_guard before insert or update of collateral on public.rentals
  for each row execute function private.rentals_collateral_guard();

-- 6. Thời hạn lưu trữ ----------------------------------------------------------------------------
create table if not exists public.data_retention_policies (
  code           text primary key,
  label          text not null,
  data_scope     text not null,
  retention_days integer not null constraint retention_days_range check (retention_days between 1 and 7300),
  action         text not null constraint retention_action check (action in ('anonymize', 'delete', 'keep')),
  basis          text not null,
  is_automatic   boolean not null default false,
  sort_order     smallint not null default 0,
  last_run_at    timestamptz,
  last_run_count integer,
  updated_at     timestamptz not null default now()
);
comment on table public.data_retention_policies is 'Thời hạn lưu trữ từng loại dữ liệu; hiển thị trong Chính sách bảo vệ dữ liệu cá nhân.';

insert into public.data_retention_policies (code, label, data_scope, retention_days, action, basis, is_automatic, sort_order) values
  ('guest_contact', 'Thông tin liên hệ khách', 'Họ tên, số điện thoại, email, ghi chú của khách không có tài khoản',
   1095, 'anonymize', 'Kể từ lần đặt sân / mua / thuê gần nhất. Hết hạn thì ẩn danh hóa, đơn vẫn giữ ở dạng không định danh.', false, 10),
  ('booking_financial', 'Đơn đặt sân, thanh toán, hóa đơn', 'Mã đơn, sân, giờ, số tiền, giao dịch, chứng từ',
   3650, 'keep', 'Nghĩa vụ lưu chứng từ kế toán (Luật Kế toán). Không xóa cứng; tên và SĐT có thể đã được ẩn danh hóa.', false, 20),
  ('member_account', 'Tài khoản thành viên', 'Hồ sơ thành viên, điểm, hạng',
   3650, 'keep', 'Giữ trong thời gian bạn còn dùng tài khoản; xóa (ẩn danh hóa) khi bạn yêu cầu.', false, 30),
  ('consents', 'Bằng chứng đồng ý / xác nhận', 'Nội dung đã xác nhận, phiên bản chính sách, thời điểm, mã băm IP',
   1825, 'keep', 'Để chứng minh sự đồng ý khi có tranh chấp (Điều 6 Nghị định 356/2025/NĐ-CP).', false, 40),
  ('data_requests', 'Yêu cầu về dữ liệu cá nhân', 'Nội dung yêu cầu, thông tin liên hệ, kết quả xử lý',
   1825, 'anonymize', 'Kể từ khi yêu cầu được xử lý xong. Hết hạn thì xóa thông tin liên hệ và nội dung yêu cầu.', true, 50),
  ('webhook_events', 'Nhật ký thông báo thanh toán', 'Nội dung thông báo từ SePay / ngân hàng',
   365, 'delete', 'Phục vụ đối soát. Hết hạn thì xóa nội dung, chỉ giữ thời điểm và kết quả xác thực.', true, 60),
  ('lookup_attempts', 'Lượt tra cứu, gửi yêu cầu', 'Mã băm số điện thoại và địa chỉ IP',
   1, 'delete', 'Chỉ để chống tra cứu dồn dập; tự xóa sau 1 ngày.', true, 70),
  ('audit_events', 'Nhật ký thay đổi dữ liệu', 'Ai đổi gì, lúc nào (trường định danh bị xóa khi khách được ẩn danh hóa)',
   1825, 'keep', 'Bảo đảm an toàn, truy vết sai sót và gian lận.', false, 80)
on conflict (code) do nothing;

alter table public.data_retention_policies enable row level security;
drop policy if exists retention_public_read on public.data_retention_policies;
create policy retention_public_read on public.data_retention_policies for select to anon, authenticated using (true);
grant select on public.data_retention_policies to anon, authenticated;
drop trigger if exists touch_retention on public.data_retention_policies;
create trigger touch_retention before update on public.data_retention_policies
  for each row execute function private.touch_updated_at();
drop trigger if exists audit_retention on public.data_retention_policies;
create trigger audit_retention after update on public.data_retention_policies
  for each row execute function private.audit_row_change('code', '-');

-- Chủ sân đổi thời hạn / bật tự động cho loại dữ liệu ẩn danh hóa / xóa được.
create or replace function public.update_retention_policy(p_code text, p_days integer, p_automatic boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.data_retention_policies;
begin
  perform private.require_owner();
  select * into v from public.data_retention_policies where code = p_code for update;
  if not found then
    perform private.raise_error('RETENTION_NOT_FOUND');
  end if;
  if v.action = 'keep' and coalesce(p_automatic, false) then
    perform private.raise_error('RETENTION_KEEP_ONLY');
  end if;
  if p_code = 'guest_contact' and p_days < 180 then
    perform private.raise_error('RETENTION_TOO_SHORT', '180');
  end if;
  if p_code = 'booking_financial' and p_days < 1825 then
    perform private.raise_error('RETENTION_TOO_SHORT', '1825');
  end if;
  perform private.set_audit_reason('privacy: đổi thời hạn lưu trữ');
  update public.data_retention_policies
     set retention_days = p_days, is_automatic = coalesce(p_automatic, false)
   where code = p_code;
end;
$$;

-- 7. Nhật ký webhook thanh toán ------------------------------------------------------------------
create table if not exists public.payment_webhook_events (
  id              bigint generated always as identity primary key,
  provider        text not null default 'sepay',
  received_at     timestamptz not null default now(),
  auth_result     text not null constraint webhook_events_auth check (auth_result in ('ok', 'unauthorized', 'not_configured')),
  auth_method     text constraint webhook_events_method check (auth_method is null or auth_method in ('hmac', 'apikey')),
  provider_txn_id text constraint webhook_events_txn_len check (provider_txn_id is null or char_length(provider_txn_id) <= 64),
  http_status     smallint not null,
  outcome         text constraint webhook_events_outcome_len check (outcome is null or char_length(outcome) <= 64),
  body_sha256     text constraint webhook_events_sha_len check (body_sha256 is null or char_length(body_sha256) = 64),
  payload         jsonb,
  ip_hash         text constraint webhook_events_ip_len check (ip_hash is null or char_length(ip_hash) <= 64)
);
create index if not exists webhook_events_time_idx on public.payment_webhook_events (received_at desc);
create index if not exists webhook_events_txn_idx on public.payment_webhook_events (provider, provider_txn_id) where provider_txn_id is not null;
comment on table public.payment_webhook_events is
  'Mỗi lần nhà cung cấp thanh toán gọi webhook (kể cả bị từ chối). Chỉ lưu nội dung khi đã xác thực; chống ghi lặp nằm ở bank_transactions (unique provider + provider_txn_id).';

alter table public.payment_webhook_events enable row level security;
drop policy if exists webhook_events_owner_read on public.payment_webhook_events;
create policy webhook_events_owner_read on public.payment_webhook_events for select to authenticated
  using ((select private.is_owner()));
grant select on public.payment_webhook_events to authenticated;

create or replace function public.service_log_webhook_event(
  p_provider text, p_auth_result text, p_auth_method text, p_txn_id text, p_http_status integer,
  p_outcome text, p_body_sha256 text, p_payload jsonb, p_ip_hash text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_service_role();
  insert into public.payment_webhook_events (provider, auth_result, auth_method, provider_txn_id, http_status, outcome,
                                             body_sha256, payload, ip_hash)
  values (coalesce(p_provider, 'sepay'), p_auth_result, p_auth_method, left(p_txn_id, 64), p_http_status, left(p_outcome, 64),
          p_body_sha256, case when p_auth_result = 'ok' then p_payload end, left(p_ip_hash, 64));
end;
$$;

-- 8. Áp dụng thời hạn lưu trữ ---------------------------------------------------------------------
create or replace function private.apply_retention(p_dry_run boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.data_retention_policies;
  v_result jsonb := '{}'::jsonb;
  v_count integer;
  v_customer uuid;
begin
  for p in select * from public.data_retention_policies where action <> 'keep' order by sort_order loop
    v_count := 0;
    if p.code = 'guest_contact' then
      for v_customer in
        select c.id from public.customers c
         where c.anonymized_at is null and c.auth_user_id is null
           and c.created_at < now() - make_interval(days => p.retention_days)
           and not exists (select 1 from public.bookings b where b.customer_id = c.id
                            and (upper(b.during) > now() - make_interval(days => p.retention_days) or b.status in ('held', 'confirmed', 'checked_in')))
           and not exists (select 1 from public.sales s where s.customer_id = c.id and s.sold_at > now() - make_interval(days => p.retention_days))
           and not exists (select 1 from public.rentals r where r.customer_id = c.id
                            and (r.status = 'out' or r.created_at > now() - make_interval(days => p.retention_days)))
         limit 500
      loop
        v_count := v_count + 1;
        if not p_dry_run and p.is_automatic then
          perform private.anonymize_customer_core(v_customer, 'hết thời hạn lưu trữ');
        end if;
      end loop;
    elsif p.code = 'data_requests' then
      select count(*) into v_count from public.data_subject_requests r
       where r.redacted_at is null and r.status in ('completed', 'rejected', 'cancelled')
         and r.resolved_at < now() - make_interval(days => p.retention_days);
      if not p_dry_run and p.is_automatic and v_count > 0 then
        perform set_config('rally.privacy_redact', 'on', true);
        update public.data_subject_requests r
           set requester_name = 'Đã xóa', phone = null, email = null, details = '[Đã xóa theo thời hạn lưu trữ]',
               ip_hash = null, redacted_at = now()
         where r.redacted_at is null and r.status in ('completed', 'rejected', 'cancelled')
           and r.resolved_at < now() - make_interval(days => p.retention_days);
        perform set_config('rally.privacy_redact', 'off', true);
      end if;
    elsif p.code = 'webhook_events' then
      select count(*) into v_count from public.payment_webhook_events e
       where e.payload is not null and e.received_at < now() - make_interval(days => p.retention_days);
      if not p_dry_run and p.is_automatic and v_count > 0 then
        update public.payment_webhook_events e set payload = null
         where e.payload is not null and e.received_at < now() - make_interval(days => p.retention_days);
      end if;
    elsif p.code = 'lookup_attempts' then
      select count(*) into v_count from private.guest_lookup_attempts a
       where a.created_at < now() - make_interval(days => p.retention_days);
      if not p_dry_run and p.is_automatic then
        delete from private.guest_lookup_attempts a where a.created_at < now() - make_interval(days => p.retention_days);
      end if;
    end if;
    if not p_dry_run and p.is_automatic then
      update public.data_retention_policies set last_run_at = now(), last_run_count = v_count where code = p.code;
    end if;
    v_result := v_result || jsonb_build_object(p.code, jsonb_build_object('due', v_count, 'automatic', p.is_automatic));
  end loop;
  return v_result;
end;
$$;

create or replace function public.apply_retention(p_dry_run boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_owner();
  return private.apply_retention(coalesce(p_dry_run, true));
end;
$$;

create or replace function public.service_apply_retention()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_service_role();
  return private.apply_retention(false);
end;
$$;

-- 9. Tải dữ liệu (thành viên tự tải; chủ sân tải hộ khách để trả lời yêu cầu xem / nhận bản sao) ----------
create or replace function private.build_data_export(p_customer uuid, p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'account', (select jsonb_build_object('email', u.email, 'phone', u.phone, 'created_at', u.created_at,
                                          'last_sign_in_at', u.last_sign_in_at)
                  from auth.users u where p_uid is not null and u.id = p_uid),
    'member_profile', (select to_jsonb(m) - 'staff_note' from public.member_profiles m where p_uid is not null and m.user_id = p_uid),
    'customer', (select jsonb_build_object('full_name', c.full_name, 'phone', c.phone, 'email', c.email,
                                           'marketing_opt_in', c.marketing_opt_in, 'created_at', c.created_at)
                   from public.customers c where c.id = p_customer),
    'bookings', coalesce((select jsonb_agg(jsonb_build_object(
                    'code', b.code, 'status', b.status, 'branch', br.name, 'court', ct.name,
                    'starts_at', lower(b.during), 'ends_at', upper(b.during),
                    'total_amount', b.total_amount, 'deposit_amount', b.deposit_amount,
                    'contact_name', b.contact_name, 'customer_note', b.customer_note, 'created_at', b.created_at)
                    order by lower(b.during) desc)
                  from public.bookings b
                  join public.branches br on br.id = b.branch_id
                  join public.courts ct on ct.id = b.court_id
                  where p_customer is not null and b.customer_id = p_customer), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object(
                    'booking_code', b.code, 'kind', p.kind, 'method', p.method, 'amount', p.amount,
                    'status', p.status, 'created_at', p.created_at) order by p.created_at desc)
                  from public.payments p join public.bookings b on b.id = p.booking_id
                  where p_customer is not null and b.customer_id = p_customer), '[]'::jsonb),
    'sales', coalesce((select jsonb_agg(jsonb_build_object('code', s.code, 'total', s.total_amount, 'sold_at', s.sold_at)
                    order by s.sold_at desc)
                  from public.sales s where p_customer is not null and s.customer_id = p_customer), '[]'::jsonb),
    'rentals', coalesce((select jsonb_agg(jsonb_build_object('code', r.code, 'status', r.status, 'created_at', r.created_at)
                    order by r.created_at desc)
                  from public.rentals r where p_customer is not null and r.customer_id = p_customer), '[]'::jsonb),
    'points', coalesce((select jsonb_agg(to_jsonb(l) - 'created_by' order by l.created_at desc)
                  from public.member_point_ledger l where p_uid is not null and l.user_id = p_uid), '[]'::jsonb),
    'consents', coalesce((select jsonb_agg(jsonb_build_object(
                    'purpose', pc.purpose, 'granted', pc.granted, 'source', pc.source, 'wording', pc.wording,
                    'privacy_version', d.version, 'created_at', pc.created_at) order by pc.created_at desc)
                  from public.privacy_consents pc left join public.legal_documents d on d.id = pc.privacy_doc_id
                  where (p_uid is not null and pc.auth_user_id = p_uid) or (p_customer is not null and pc.customer_id = p_customer)), '[]'::jsonb),
    'data_requests', coalesce((select jsonb_agg(jsonb_build_object('code', r.code, 'kind', r.kind, 'status', r.status,
                    'received_at', r.received_at, 'resolved_at', r.resolved_at) order by r.received_at desc)
                  from public.data_subject_requests r
                  where (p_uid is not null and r.auth_user_id = p_uid) or (p_customer is not null and r.customer_id = p_customer)), '[]'::jsonb));
$$;

create or replace function public.my_data_export()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not exists (select 1 from public.member_profiles m where m.user_id = v_uid) then
    perform private.raise_error('MEMBER_NOT_FOUND');
  end if;
  return private.build_data_export((select c.id from public.customers c where c.auth_user_id = v_uid), v_uid);
end;
$$;

-- Chủ sân tải dữ liệu của một khách để trả lời yêu cầu "xem / nhận bản sao" (có ghi nhật ký).
create or replace function public.customer_data_export(p_customer_id uuid, p_request_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.customers;
begin
  perform private.require_owner();
  select * into v from public.customers where id = p_customer_id;
  if not found then
    perform private.raise_error('CUSTOMER_NOT_FOUND');
  end if;
  insert into public.audit_events (actor_id, actor_role, table_name, record_id, action, reason, new_data)
  values ((select auth.uid()), 'authenticated', 'customers', p_customer_id::text, 'UPDATE',
          'privacy: chủ sân tải dữ liệu khách', jsonb_build_object('export', true, 'request_id', p_request_id));
  return private.build_data_export(p_customer_id, v.auth_user_id);
end;
$$;

-- 10. Văn bản mặc định (bản nháp — chủ sân rà soát & đăng phiên bản mới trong Quản trị → Dữ liệu cá nhân) ----
insert into public.legal_documents (code, version, title, summary, body, change_note, effective_at)
select 'privacy', 1, 'Chính sách bảo vệ dữ liệu cá nhân',
  'Rally thu thập dữ liệu gì, dùng vào việc gì, chia sẻ với ai, lưu bao lâu và bạn thực hiện quyền của mình như thế nào.',
$doc$Chính sách này giải thích cách **{{ten_thuong_hieu}}** ("Rally", "chúng tôi") thu thập, sử dụng, lưu trữ và bảo vệ dữ liệu cá nhân của khách hàng khi đặt sân, mua hàng, thuê dụng cụ, đăng ký thành viên và sử dụng website. Chính sách được xây dựng theo Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 và Nghị định 356/2025/NĐ-CP, có hiệu lực từ ngày 01/01/2026.

## 1. Bên kiểm soát và xử lý dữ liệu

- Tên: {{ten_phap_ly}}
- Mã số thuế / mã số doanh nghiệp: {{ma_so_thue}}
- Địa chỉ: {{dia_chi}}
- Đầu mối bảo vệ dữ liệu cá nhân: {{nguoi_phu_trach}} — email {{email_du_lieu}}, điện thoại {{hotline}}

## 2. Dữ liệu chúng tôi thu thập

Rally chỉ thu thập dữ liệu cần cho từng việc. **Rally không yêu cầu CCCD, hộ chiếu hay dữ liệu cá nhân nhạy cảm để đặt sân.**

- **Đặt sân không cần tài khoản:** họ tên, số điện thoại, ghi chú bạn tự nhập (nếu có); thông tin đơn: chi nhánh, sân, giờ chơi, số tiền, tiền cọc, trạng thái.
- **Thanh toán chuyển khoản:** số tiền, thời gian, nội dung chuyển khoản và thông tin giao dịch do ngân hàng gửi qua dịch vụ đối soát SePay (có thể gồm tên hoặc số tài khoản người chuyển).
- **Thành viên:** họ tên, số điện thoại hoặc email đăng nhập, mật khẩu (được mã hóa một chiều — nhân viên không xem được); nếu đăng nhập bằng Google: tên và email của tài khoản Google; điểm tích lũy, hạng thành viên.
- **Mua hàng, thuê dụng cụ tại quầy:** sản phẩm, số tiền, thời gian và số điện thoại để gắn vào hồ sơ khách (nếu bạn cung cấp).
- **Dữ liệu kỹ thuật:** cookie cần thiết để đăng nhập (xem [Chính sách cookie](/legal/cookie)); địa chỉ IP và số điện thoại dùng để chống tra cứu dồn dập được chuyển thành mã băm và tự xóa sau 1 ngày. Mã băm vẫn có thể liên kết với bạn nên Rally bảo vệ như dữ liệu cá nhân.
- **Bằng chứng xác nhận / đồng ý:** nội dung ô bạn đã chọn, phiên bản chính sách, thời điểm, mã băm địa chỉ IP và thông tin trình duyệt.

## 3. Mục đích và căn cứ xử lý

| Mục đích | Dữ liệu | Căn cứ |
| --- | --- | --- |
| Giữ sân, xác nhận, nhận cọc, đổi giờ, hủy và hoàn cọc | Họ tên, SĐT, thông tin đơn, giao dịch | Thực hiện thỏa thuận đặt sân giữa bạn và Rally (Điều 19 Luật Bảo vệ dữ liệu cá nhân) |
| Tra cứu đơn, hỗ trợ tại quầy, chơi thêm giờ | Họ tên, SĐT, mã đơn | Thực hiện thỏa thuận |
| Tài khoản thành viên, tích điểm, ưu đãi theo hạng | Dữ liệu thành viên | Thực hiện thỏa thuận khi bạn đăng ký |
| Kế toán, hóa đơn, nghĩa vụ thuế | Thông tin giao dịch | Nghĩa vụ theo quy định của pháp luật |
| Chống spam, gian lận, bảo vệ hệ thống | Mã băm IP / SĐT, tín hiệu chống bot | Bảo đảm an toàn khi thực hiện thỏa thuận |
| Gửi tin khuyến mãi, ưu đãi | Họ tên, SĐT, email | **Chỉ khi bạn đồng ý riêng** — rút lại bất cứ lúc nào |

Đồng ý nhận tin khuyến mãi luôn là lựa chọn riêng, không chọn sẵn và không phải điều kiện để đặt sân.

## 4. Chia sẻ dữ liệu

Rally **không bán** dữ liệu cá nhân. Rally chỉ chia sẻ khi cần với:

- Nhà cung cấp hạ tầng: Supabase (cơ sở dữ liệu, đăng nhập) và Vercel (máy chủ website) — máy chủ có thể đặt ngoài Việt Nam;
- SePay và ngân hàng: đối soát giao dịch chuyển khoản;
- Cloudflare: xác minh chống bot (Turnstile);
- Google: khi bạn chọn đăng nhập bằng Google;
- Cơ quan nhà nước có thẩm quyền khi pháp luật yêu cầu.

Các bên này chỉ được xử lý dữ liệu theo mục đích Rally giao và phải áp dụng biện pháp bảo vệ phù hợp.

## 5. Thời hạn lưu trữ

{{bang_luu_tru}}

Hết thời hạn, thông tin liên hệ được xóa hoặc ẩn danh hóa; chứng từ kế toán được giữ theo thời hạn luật định nhưng không còn gắn với tên, số điện thoại của bạn.

## 6. Quyền của bạn

Theo Điều 4 Luật Bảo vệ dữ liệu cá nhân, bạn có quyền:

- được biết về hoạt động xử lý dữ liệu của mình;
- đồng ý, không đồng ý hoặc rút lại sự đồng ý (ví dụ: ngừng nhận tin khuyến mãi);
- xem, chỉnh sửa và yêu cầu cung cấp bản sao dữ liệu;
- yêu cầu xóa, hạn chế xử lý hoặc phản đối xử lý dữ liệu;
- khiếu nại, tố cáo, khởi kiện và yêu cầu bồi thường theo quy định của pháp luật.

Gửi yêu cầu tại trang [Yêu cầu về dữ liệu cá nhân](/legal/yeu-cau-du-lieu). Thành viên có thể tải dữ liệu và đổi lựa chọn nhận tin ngay trong [Tài khoản → Quyền riêng tư](/account/privacy).

### Thời hạn xử lý

Theo Điều 5 Nghị định 356/2025/NĐ-CP, Rally phản hồi trong **2 ngày làm việc**; xem, sửa, cung cấp dữ liệu trong **10 ngày**; rút lại đồng ý, hạn chế, phản đối xử lý trong **15 ngày**; xóa dữ liệu trong **20 ngày**. Trường hợp phức tạp có thể gia hạn một lần và Rally sẽ báo lý do.

Rally cần xác minh bạn là chủ dữ liệu (ví dụ: số điện thoại khớp với mã một đơn đã đặt) trước khi cung cấp hoặc xóa dữ liệu. Rally chưa thể xóa ngay khi đơn đang diễn ra, khi đang mượn dụng cụ hoặc khi pháp luật yêu cầu lưu (ví dụ chứng từ kế toán); khi đó Rally sẽ thông báo lý do.

## 7. Bảo vệ dữ liệu

- Kết nối mã hóa HTTPS; mật khẩu được mã hóa một chiều;
- Phân quyền theo vai trò ngay tại cơ sở dữ liệu: nhân viên chỉ thấy dữ liệu của chi nhánh được giao;
- Ghi nhật ký thay đổi dữ liệu; khóa bí mật chỉ nằm ở máy chủ, không gửi xuống trình duyệt;
- Chống bot bằng Cloudflare Turnstile, giới hạn số lần tra cứu và gửi yêu cầu.

Khi xảy ra sự cố lộ, mất dữ liệu, Rally xử lý ngay, thông báo cho cơ quan chuyên trách trong 72 giờ theo quy định và thông báo cho người bị ảnh hưởng khi cần thiết.

## 8. Người chưa thành niên

Người chưa thành niên nên đặt sân và đăng ký thành viên thông qua cha mẹ hoặc người giám hộ. Rally không cố ý thu thập dữ liệu của trẻ em ngoài thông tin liên hệ cần cho việc đặt sân.

## 9. Thay đổi chính sách

Mỗi lần sửa, Rally đăng phiên bản mới kèm ngày hiệu lực tại trang này và lưu lại các phiên bản cũ. Khi thay đổi ảnh hưởng tới sự đồng ý bạn đã đưa ra, Rally sẽ xin lại sự đồng ý.$doc$,
  'Bản đầu tiên theo Luật 91/2025/QH15 và Nghị định 356/2025/NĐ-CP', now()
where not exists (select 1 from public.legal_documents where code = 'privacy');

insert into public.legal_documents (code, version, title, summary, body, change_note, effective_at)
select 'terms', 1, 'Điều khoản sử dụng và đặt sân',
  'Quy định khi bạn dùng website, đặt sân, thanh toán, chơi thêm giờ và dùng tài khoản thành viên tại Rally.',
$doc$Điều khoản này áp dụng khi bạn sử dụng website **{{ten_thuong_hieu}}**, đặt sân trực tuyến, tại quầy hoặc qua điện thoại, mua hàng và thuê dụng cụ tại các chi nhánh. Khi đặt sân, bạn xác nhận đã đọc điều khoản này và [Chính sách bảo vệ dữ liệu cá nhân](/legal/bao-mat).

## 1. Đặt sân và giữ chỗ

- Bạn chọn chi nhánh, sân, giờ còn trống và cung cấp họ tên, số điện thoại chính xác. Mỗi đơn có một mã đơn để tra cứu.
- Đơn mới ở trạng thái **giữ chỗ** trong thời gian quy định của từng chi nhánh. Hết thời gian mà chưa đặt cọc (khi chi nhánh yêu cầu cọc), đơn tự hết hạn và sân được mở lại cho người khác.
- Đơn được **xác nhận** khi Rally nhận đủ tiền cọc hoặc nhân viên xác nhận.
- Giá tính theo bảng giá từng khung giờ tại thời điểm đặt. Giá đã ghi trên đơn không đổi khi bảng giá thay đổi sau đó.
- Thời gian giữ chỗ, mức cọc và điều kiện hoàn cọc của từng chi nhánh: xem [Chính sách hủy sân & hoàn cọc](/legal/huy-san).

## 2. Thanh toán

- Chuyển khoản tiền cọc đúng số tiền và nội dung hiển thị trên mã QR để hệ thống tự xác nhận. Chuyển sai nội dung hoặc số tiền có thể cần nhân viên đối chiếu thủ công.
- Phần còn lại thanh toán tại quầy theo hướng dẫn của nhân viên.

## 3. Đến sân và chơi thêm giờ

- Vui lòng đến đúng giờ; thời gian đến muộn vẫn tính vào giờ đã đặt.
- Muốn chơi thêm, hãy báo nhân viên quầy. Chỉ gia hạn được khi sân còn trống; phần thêm tính theo bảng giá của khung giờ đó.
- Đơn đã xác nhận mà không đến và không hủy trước giờ chơi được ghi nhận **không đến**; tiền cọc không được hoàn.

## 4. Hủy và hoàn cọc

Theo [Chính sách hủy sân & hoàn cọc](/legal/huy-san).

## 5. Nội quy và an toàn

- Mang giày thể thao đế không để lại vết trên sàn; tuân thủ nội quy của từng chi nhánh và hướng dẫn của nhân viên.
- Tự đánh giá sức khỏe trước khi chơi và khởi động kỹ; dừng chơi khi thấy không khỏe.
- Tự bảo quản tư trang; dùng tủ đồ nếu chi nhánh có.

## 6. Tài khoản thành viên

- Giữ bí mật mật khẩu và báo ngay cho Rally nếu nghi bị lộ.
- Điểm tích lũy và quyền lợi theo hạng áp dụng theo chương trình thành viên Rally công bố tại từng thời điểm.
- Rally có thể khóa tài khoản dùng để gian lận hoặc giữ chỗ ảo nhiều lần.

## 7. Hành vi bị cấm

- Dùng công cụ tự động, spam để giữ chỗ hoặc tra cứu;
- Cung cấp thông tin giả hoặc dùng thông tin của người khác khi chưa được phép;
- Tấn công, dò quét lỗ hổng hoặc làm gián đoạn hệ thống.

## 8. Khi Rally phải hủy hoặc đổi sân

Khi sân gặp sự cố hoặc Rally không thể phục vụ, Rally sẽ liên hệ để đổi sang sân, giờ khác nếu bạn đồng ý, hoặc hủy đơn và hoàn **toàn bộ** số tiền bạn đã trả.

## 9. Dữ liệu cá nhân

Rally xử lý dữ liệu của bạn theo [Chính sách bảo vệ dữ liệu cá nhân](/legal/bao-mat).

## 10. Liên hệ và giải quyết tranh chấp

Hotline {{hotline}}, email {{email}}. Tranh chấp được ưu tiên giải quyết bằng thương lượng; không thành thì giải quyết theo pháp luật Việt Nam.$doc$,
  'Bản đầu tiên', now()
where not exists (select 1 from public.legal_documents where code = 'terms');

insert into public.legal_documents (code, version, title, summary, body, change_note, effective_at)
select 'cancellation', 1, 'Chính sách hủy sân và hoàn cọc',
  'Thời gian giữ chỗ, mức cọc và số tiền được hoàn khi hủy — lấy trực tiếp từ cấu hình đang áp dụng của từng chi nhánh.',
$doc$Chính sách này áp dụng cho đơn đặt sân trực tuyến và tại quầy. Các con số trong bảng dưới đây được lấy **trực tiếp từ cấu hình đang áp dụng** của từng chi nhánh, nên luôn khớp với màn hình đặt sân, xác nhận đơn và tra cứu đơn.

{{bang_huy_coc}}

## Cách tính tiền hoàn

- Tiền hoàn tính trên **số tiền bạn đã thực trả** cho đơn (thường là tiền cọc), theo số giờ còn lại tới giờ bắt đầu chơi tại thời điểm bạn hủy.
- Mức hoàn một phần được làm tròn xuống tới 1.000đ.
- Đơn **giữ chỗ chưa thanh toán** tự hết hạn, không mất phí.

## Cách hủy

- Tự hủy tại [Tra cứu đơn](/booking/lookup) (mã đơn và số điện thoại) hoặc trong tài khoản thành viên, **trước giờ bắt đầu chơi**.
- Sau giờ bắt đầu không thể hủy trực tuyến; vui lòng liên hệ quầy.
- Hệ thống tự tính và hiển thị số tiền được hoàn ngay khi bạn hủy.

## Nhận tiền hoàn

Rally hoàn qua chuyển khoản hoặc tiền mặt tại quầy. Nhân viên liên hệ để lấy thông tin tài khoản nhận tiền; thời gian xử lý thường trong vòng **3 ngày làm việc** kể từ khi hủy.

## Khi Rally hủy đơn

Khi sân gặp sự cố hoặc Rally không thể phục vụ, bạn được hoàn **toàn bộ** số tiền đã trả, hoặc đổi sang sân, giờ khác nếu bạn đồng ý.

## Không đến

Đơn đã xác nhận mà không đến và không hủy trước giờ chơi được ghi nhận **không đến**; tiền cọc không được hoàn.$doc$,
  'Bản đầu tiên — bảng điều kiện đọc trực tiếp từ cấu hình chi nhánh', now()
where not exists (select 1 from public.legal_documents where code = 'cancellation');

insert into public.legal_documents (code, version, title, summary, body, change_note, effective_at)
select 'cookies', 1, 'Chính sách cookie',
  'Rally chỉ dùng cookie và bộ nhớ trình duyệt cần thiết; không dùng cookie quảng cáo hay theo dõi của bên thứ ba.',
$doc$Rally chỉ dùng cookie và bộ nhớ trình duyệt **cần thiết** để website hoạt động. Rally **không** dùng cookie quảng cáo hay công cụ theo dõi hành vi của bên thứ ba, nên website không hiện hộp hỏi đồng ý cookie.

| Tên | Mục đích | Thời hạn | Loại |
| --- | --- | --- | --- |
| sb-…-auth-token | Giữ phiên đăng nhập của thành viên và nhân viên | Tới khi đăng xuất hoặc hết phiên | Cần thiết |
| sb-…-code-verifier | Bảo mật bước đăng nhập bằng Google | Vài phút | Cần thiết |
| rally_flash | Hiện thông báo một lần sau khi lưu | Xóa ngay sau khi hiện | Cần thiết |
| rally_branch | Chi nhánh đang làm việc (khu quản trị) | 180 ngày | Chức năng |
| rally_sidebar, rally_nav_closed | Ghi nhớ cách hiển thị menu quản trị | 1 năm | Chức năng |
| rally.recent-bookings (bộ nhớ trình duyệt) | Đơn bạn đã đặt hoặc tra cứu **trên thiết bị này** để mở lại nhanh: mã đơn, số điện thoại, giờ chơi, tên sân | Tự xóa sau 30 ngày kể từ giờ chơi; xóa được bất cứ lúc nào | Chức năng |

Cloudflare Turnstile (chống bot ở form đặt sân và tra cứu) có thể dùng dữ liệu kỹ thuật của trình duyệt theo chính sách của Cloudflare để phân biệt người thật với máy.

## Quản lý cookie

- Xóa cookie trong cài đặt trình duyệt; chặn cookie cần thiết có thể khiến bạn không đăng nhập được.
- Xóa danh sách đơn gần đây ngay tại trang [Tra cứu đơn](/booking/lookup).

## Khi Rally dùng thêm công cụ đo lường

Nếu sau này Rally dùng công cụ thống kê hoặc quảng cáo, Rally sẽ cập nhật chính sách này và chỉ bật các công cụ đó **sau khi bạn đồng ý**.$doc$,
  'Bản đầu tiên', now()
where not exists (select 1 from public.legal_documents where code = 'cookies');

-- 11. Siết quyền bảng (phòng thủ nhiều lớp) ----------------------------------------------------------
-- Khách chưa đăng nhập (anon) không bao giờ ghi trực tiếp vào bảng — mọi thao tác ghi đi qua hàm RPC đã kiểm tra.
-- TRUNCATE không chịu RLS → thu hồi của cả anon và authenticated. Áp dụng cả cho bảng tạo sau này.
do $$
declare
  t record;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind in ('r', 'p') loop
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from anon', t.relname);
    execute format('revoke truncate, references, trigger on public.%I from authenticated', t.relname);
  end loop;
end $$;
alter default privileges in schema public revoke insert, update, delete, truncate, references, trigger on tables from anon;
alter default privileges in schema public revoke truncate, references, trigger on tables from authenticated;

-- 12. Quyền thực thi ----------------------------------------------------------------------------------
-- Supabase mặc định cấp mọi quyền bảng mới cho anon / authenticated; chỉ giữ đúng quyền ĐỌC cần thiết (RLS vẫn lọc dòng).
revoke all on public.legal_documents, public.privacy_consents, public.data_subject_requests,
              public.data_retention_policies, public.payment_webhook_events from anon, authenticated;
grant select on public.legal_documents, public.data_retention_policies to anon, authenticated;
grant select on public.privacy_consents, public.data_subject_requests, public.payment_webhook_events to authenticated;

revoke all on function private.add_working_days(timestamptz, integer) from public, anon, authenticated;
revoke all on function private.pseudonymize(text, text) from public, anon, authenticated;
revoke all on function private.redact_pii(jsonb) from public, anon, authenticated;
revoke all on function private.current_legal_document(text) from public, anon, authenticated;
revoke all on function private.record_consent(uuid, uuid, uuid, text, boolean, text, text, text, text) from public, anon, authenticated;
revoke all on function private.anonymize_customer_core(uuid, text) from public, anon, authenticated;
revoke all on function private.apply_retention(boolean) from public, anon, authenticated;
revoke all on function private.data_request_days(text) from public, anon, authenticated;

revoke all on function public.publish_legal_document(text, text, text, text, text, timestamptz) from public, anon;
revoke all on function public.create_guest_booking_hold_v2(uuid, timestamptz, timestamptz, text, text, text, text, text, boolean, text, text, text) from public, anon, authenticated;
revoke all on function public.service_record_member_consents(uuid, text, boolean, text, text, text) from public, anon, authenticated;
revoke all on function public.member_set_marketing(boolean, text, text) from public, anon;
revoke all on function public.service_submit_data_request(text, text, text, text, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.update_data_request(uuid, text, text, boolean, text) from public, anon;
revoke all on function public.data_request_counts() from public, anon;
revoke all on function public.anonymize_customer(uuid, uuid, text) from public, anon;
revoke all on function public.update_retention_policy(text, integer, boolean) from public, anon;
revoke all on function public.service_log_webhook_event(text, text, text, text, integer, text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.apply_retention(boolean) from public, anon;
revoke all on function public.service_apply_retention() from public, anon, authenticated;
revoke all on function public.my_data_export() from public, anon;
revoke all on function private.build_data_export(uuid, uuid) from public, anon, authenticated;
revoke all on function public.customer_data_export(uuid, uuid) from public, anon;

grant execute on function public.publish_legal_document(text, text, text, text, text, timestamptz) to authenticated;
grant execute on function public.create_guest_booking_hold_v2(uuid, timestamptz, timestamptz, text, text, text, text, text, boolean, text, text, text) to service_role;
grant execute on function public.service_record_member_consents(uuid, text, boolean, text, text, text) to service_role;
grant execute on function public.member_set_marketing(boolean, text, text) to authenticated;
grant execute on function public.service_submit_data_request(text, text, text, text, text, text, uuid, text) to service_role;
grant execute on function public.update_data_request(uuid, text, text, boolean, text) to authenticated;
grant execute on function public.data_request_counts() to authenticated;
grant execute on function public.anonymize_customer(uuid, uuid, text) to authenticated;
grant execute on function public.update_retention_policy(text, integer, boolean) to authenticated;
grant execute on function public.service_log_webhook_event(text, text, text, text, integer, text, text, jsonb, text) to service_role;
grant execute on function public.apply_retention(boolean) to authenticated;
grant execute on function public.service_apply_retention() to service_role;
grant execute on function public.my_data_export() to authenticated;
grant execute on function public.customer_data_export(uuid, uuid) to authenticated;
