-- =============================================================================
-- RALLY BADMINTON — 14_guest_phone_lookup.sql
-- Khách vãng lai quên mã đơn: tra cứu bằng số điện thoại.
--
-- Chạy SAU 00 → 13. Chạy lại an toàn.
--
-- Hai bước, để người chỉ biết số điện thoại của người khác không hủy được đơn của họ:
--   1. lookup_guest_bookings_by_phone: danh sách đơn (hôm nay, sắp tới, lịch sử) của số điện thoại,
--      mã đơn che bớt, tên người đặt chỉ hiện tên gọi. Chỉ xem, không thao tác.
--   2. reveal_guest_booking: nhập đúng họ tên đã dùng khi đặt → trả đủ thông tin đơn (mã đầy đủ,
--      hủy đơn được như tra bằng mã). Sai tên → {"error": "BOOKING_NAME_MISMATCH"}.
-- Chỉ gồm đơn của khách vãng lai (đơn đặt khi đăng nhập thành viên xem trong tài khoản).
-- Cả hai hàm chỉ máy chủ gọi được (service role) và giới hạn số lần thử theo số điện thoại, theo
-- thiết bị/IP và theo từng đơn.
-- =============================================================================

begin;

-- 1. Nhật ký lượt tra cứu (giới hạn tần suất) -------------------------------------------------
create table if not exists private.guest_lookup_attempts (
  id         bigint generated always as identity primary key,
  kind       text not null constraint guest_lookup_kind check (kind in ('phone', 'client', 'reveal_fail')),
  key        text not null constraint guest_lookup_key_len check (char_length(key) between 1 and 128),
  created_at timestamptz not null default now()
);
comment on table private.guest_lookup_attempts is
  'Lượt tra cứu đơn bằng SĐT / xác nhận tên sai — chỉ để giới hạn tần suất, tự dọn sau 1 ngày.';
create index if not exists guest_lookup_attempts_key_idx on private.guest_lookup_attempts (kind, key, created_at desc);
create index if not exists guest_lookup_attempts_time_idx on private.guest_lookup_attempts (created_at);
revoke all on private.guest_lookup_attempts from public, anon, authenticated;

-- Đếm lượt trong cửa sổ thời gian; vượt giới hạn thì báo RATE_LIMITED.
create or replace function private.guest_lookup_guard(p_kind text, p_key text, p_limit integer, p_window interval)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_key is null or p_key = '' then
    return;
  end if;
  if (select count(*) from private.guest_lookup_attempts a
       where a.kind = p_kind and a.key = p_key and a.created_at > now() - p_window) >= p_limit then
    perform private.raise_error('RATE_LIMITED');
  end if;
end;
$$;

-- So khớp họ tên không phân biệt hoa/thường, dấu tiếng Việt và khoảng trắng.
create or replace function private.fold_vn_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(
    translate(lower(normalize(coalesce(p_name, ''), NFC)),
      'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ',
      'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'),
    '[^a-z0-9]+', ' ', 'g'));
$$;

-- Mã đơn che giữa: RB-W79T5R9T → RB-W7••••9T
create or replace function private.mask_booking_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when char_length(p_code) <= 7 then p_code
              else left(p_code, 5) || repeat('•', char_length(p_code) - 7) || right(p_code, 2) end;
$$;

-- 2. Danh sách đơn theo số điện thoại (chỉ xem) ------------------------------------------------
create or replace function public.lookup_guest_bookings_by_phone(p_phone text, p_client text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := private.normalize_vn_phone(p_phone);
  v_client text := left(nullif(btrim(coalesce(p_client, '')), ''), 128);
  v_items jsonb;
  v_member_count integer;
begin
  perform private.require_service_role();
  if v_phone is null then
    perform private.raise_error('INVALID_PHONE');
  end if;

  -- Dọn nhật ký cũ (nhẹ, dùng chỉ mục thời gian).
  delete from private.guest_lookup_attempts where created_at < now() - interval '1 day';

  -- Mỗi số điện thoại 10 lần / giờ; mỗi thiết bị/IP 30 lần / giờ.
  perform private.guest_lookup_guard('phone', v_phone, 10, interval '1 hour');
  perform private.guest_lookup_guard('client', v_client, 30, interval '1 hour');
  insert into private.guest_lookup_attempts (kind, key) values ('phone', v_phone);
  if v_client is not null then
    insert into private.guest_lookup_attempts (kind, key) values ('client', v_client);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'booking_id', x.id,
           'code_masked', private.mask_booking_code(x.code),
           'status', x.status,
           'starts_at', lower(x.during),
           'ends_at', upper(x.during),
           'branch_name', x.branch_name,
           'branch_address', x.branch_address,
           'court_name', x.court_name,
           'total_amount', x.total_amount,
           'paid_amount', private.booking_net_paid(x.id),
           'name_hint', x.name_hint,
           'created_at', x.created_at)
         order by x.sort_group, x.sort_time), '[]'::jsonb)
    into v_items
    from (
      select b.id, b.code, b.status, b.during, b.total_amount, b.created_at,
             br.name as branch_name, br.address_line as branch_address, c.name as court_name,
             -- Chỉ tên gọi (chữ cuối) để khách nhận ra đơn của mình, không lộ họ tên đầy đủ.
             nullif(regexp_replace(btrim(coalesce(b.contact_name, cu.full_name)), '^.*\s', ''), '') as name_hint,
             case when upper(b.during) >= now() then 0 else 1 end as sort_group,
             case when upper(b.during) >= now() then extract(epoch from lower(b.during))
                  else -extract(epoch from lower(b.during)) end as sort_time
        from public.bookings b
        join public.customers cu on cu.id = b.customer_id
        join public.courts c on c.id = b.court_id
        join public.branches br on br.id = b.branch_id
       where cu.phone = v_phone
         and b.deleted_at is null
         and b.member_user_id is null
         and b.source in ('online', 'counter')
         and lower(b.during) > now() - interval '180 days'
       order by case when upper(b.during) >= now() then 0 else 1 end,
                case when upper(b.during) >= now() then extract(epoch from lower(b.during))
                     else -extract(epoch from lower(b.during)) end
       limit 40
    ) x;

  select count(*) into v_member_count
    from public.bookings b
    join public.customers cu on cu.id = b.customer_id
   where cu.phone = v_phone and b.deleted_at is null and b.member_user_id is not null;

  return jsonb_build_object('items', v_items, 'member_bookings', v_member_count);
end;
$$;

-- 3. Xác nhận họ tên → mở đầy đủ một đơn ----------------------------------------------------
create or replace function public.reveal_guest_booking(p_booking_id uuid, p_phone text, p_name text, p_client text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := private.normalize_vn_phone(p_phone);
  v_client text := left(nullif(btrim(coalesce(p_client, '')), ''), 128);
  v_input text := private.fold_vn_name(p_name);
  v_code text;
  v_contact text;
  v_customer_name text;
begin
  perform private.require_service_role();
  if v_phone is null then
    perform private.raise_error('INVALID_PHONE');
  end if;

  -- Sai tên tối đa 5 lần / giờ cho mỗi đơn và 15 lần / giờ cho mỗi thiết bị/IP.
  perform private.guest_lookup_guard('reveal_fail', p_booking_id::text, 5, interval '1 hour');
  perform private.guest_lookup_guard('reveal_fail', 'client:' || v_client, 15, interval '1 hour');

  select b.code, b.contact_name, cu.full_name
    into v_code, v_contact, v_customer_name
    from public.bookings b
    join public.customers cu on cu.id = b.customer_id
   where b.id = p_booking_id
     and cu.phone = v_phone
     and b.deleted_at is null
     and b.member_user_id is null;
  if v_code is null then
    perform private.raise_error('BOOKING_NOT_FOUND');
  end if;

  if char_length(v_input) < 2
     or v_input not in (private.fold_vn_name(v_contact), private.fold_vn_name(v_customer_name)) then
    insert into private.guest_lookup_attempts (kind, key) values ('reveal_fail', p_booking_id::text);
    if v_client is not null then
      insert into private.guest_lookup_attempts (kind, key) values ('reveal_fail', 'client:' || v_client);
    end if;
    -- Trả kết quả thay vì báo lỗi: báo lỗi sẽ hoàn tác cả dòng nhật ký vừa ghi (mất giới hạn số lần thử).
    return jsonb_build_object('error', 'BOOKING_NAME_MISMATCH');
  end if;

  return public.lookup_guest_booking(v_code, v_phone);
end;
$$;

revoke all on function private.guest_lookup_guard(text, text, integer, interval) from public, anon, authenticated;
revoke all on function public.lookup_guest_bookings_by_phone(text, text) from public, anon, authenticated;
revoke all on function public.reveal_guest_booking(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.lookup_guest_bookings_by_phone(text, text) to service_role;
grant execute on function public.reveal_guest_booking(uuid, text, text, text) to service_role;

commit;

notify pgrst, 'reload schema';
