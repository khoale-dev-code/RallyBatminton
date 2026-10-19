-- =============================================================================
-- RALLY BADMINTON — 15_sepay_deposit.sql
-- Đặt cọc bằng chuyển khoản qua SePay + tổng quan dòng tiền cho trang quản trị.
--
-- Chạy SAU 00 → 14. Chạy lại an toàn.
--
--   * Tài khoản nhận tiền: brand_settings.bank_* (mặc định) và branches.bank_* (chi nhánh dùng tài khoản riêng).
--     Khách thấy mã VietQR (số tiền + nội dung = mã đơn không gạch, ví dụ RB7K3M9Q2T) ngay sau khi giữ sân.
--   * Webhook SePay (máy chủ Next.js xác thực API key / chữ ký) gọi record_sepay_transaction:
--       - ghi mọi giao dịch vào bank_transactions (chống trùng theo id SePay),
--       - tìm đơn theo mã trong nội dung, ghi payments (method = gateway, provider = sepay),
--       - đủ tiền cọc → đơn tự chuyển "đã xác nhận"; giữ chỗ vừa hết hạn mà sân còn trống → mở lại,
--       - không khớp / đơn đã hủy / sân đã có người → để "cần xử lý" cho nhân viên.
--   * match_bank_transaction / dismiss_bank_transaction: nhân viên gán tay giao dịch ghi sai nội dung.
--   * admin_dashboard: một lần gọi trả mọi số liệu cho trang Tổng quan (theo quyền người xem).
-- =============================================================================

begin;

-- 1. Tài khoản nhận chuyển khoản ------------------------------------------------------------
alter table public.brand_settings
  add column if not exists bank_code text,
  add column if not exists bank_account_no text,
  add column if not exists bank_account_name text,
  add column if not exists transfer_auto_confirm boolean not null default true;

alter table public.branches
  add column if not exists bank_code text,
  add column if not exists bank_account_no text,
  add column if not exists bank_account_name text;

-- Chữ bắt buộc đứng trước nội dung chuyển khoản (ví dụ VietinBank cá nhân qua SePay cần "SEVQR").
alter table public.brand_settings add column if not exists transfer_memo_prefix text;
alter table public.branches add column if not exists transfer_memo_prefix text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'brand_settings_bank_fmt') then
    alter table public.brand_settings add constraint brand_settings_bank_fmt check (
      (bank_code is null or bank_code ~ '^[A-Za-z0-9]{2,20}$')
      and (bank_account_no is null or bank_account_no ~ '^[A-Za-z0-9]{4,30}$')
      and (bank_account_name is null or char_length(btrim(bank_account_name)) between 2 and 80)
      and ((bank_code is null) = (bank_account_no is null)));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'brand_settings_memo_prefix_fmt') then
    alter table public.brand_settings add constraint brand_settings_memo_prefix_fmt
      check (transfer_memo_prefix is null or transfer_memo_prefix ~ '^[A-Za-z0-9]{2,20}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'branches_memo_prefix_fmt') then
    alter table public.branches add constraint branches_memo_prefix_fmt
      check (transfer_memo_prefix is null or transfer_memo_prefix ~ '^[A-Za-z0-9]{2,20}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'branches_bank_fmt') then
    alter table public.branches add constraint branches_bank_fmt check (
      (bank_code is null or bank_code ~ '^[A-Za-z0-9]{2,20}$')
      and (bank_account_no is null or bank_account_no ~ '^[A-Za-z0-9]{4,30}$')
      and (bank_account_name is null or char_length(btrim(bank_account_name)) between 2 and 80)
      and ((bank_code is null) = (bank_account_no is null)));
  end if;
end;
$$;

comment on column public.brand_settings.bank_code is 'Ngân hàng nhận cọc (tên viết tắt / BIN theo VietQR, ví dụ MBBank, Vietcombank, 970422).';
comment on column public.brand_settings.transfer_auto_confirm is 'Nhận đủ tiền cọc qua SePay thì tự xác nhận đơn.';
comment on column public.brand_settings.transfer_memo_prefix is 'Chữ bắt buộc trước mã đơn trong nội dung CK (VietinBank cá nhân: SEVQR). Trống = chỉ mã đơn.';
comment on column public.branches.bank_code is 'Tài khoản riêng của chi nhánh (trống = dùng tài khoản thương hiệu).';

-- 2. Giao dịch ngân hàng từ SePay -----------------------------------------------------------
create table if not exists public.bank_transactions (
  id                 uuid primary key default gen_random_uuid(),
  provider           text not null default 'sepay' constraint bank_txn_provider check (provider in ('sepay')),
  provider_txn_id    text not null constraint bank_txn_provider_id_len check (char_length(provider_txn_id) between 1 and 64),
  gateway            text,
  account_number     text,
  transfer_type      text not null constraint bank_txn_type check (transfer_type in ('in', 'out')),
  amount             bigint not null constraint bank_txn_amount check (amount >= 0),
  content            text,
  payment_code       text,
  reference_code     text,
  transaction_at     timestamptz not null default now(),
  status             text not null constraint bank_txn_status check (status in ('matched', 'unmatched', 'review', 'ignored')),
  status_note        text constraint bank_txn_note_len check (status_note is null or char_length(status_note) <= 300),
  branch_id          uuid references public.branches (id),
  booking_id         uuid references public.bookings (id),
  payment_id         uuid references public.payments (id),
  raw                jsonb not null default '{}'::jsonb,
  resolved_by        uuid references auth.users (id) on delete set null,
  resolved_at        timestamptz,
  created_at         timestamptz not null default now(),
  constraint bank_txn_provider_uniq unique (provider, provider_txn_id),
  constraint bank_txn_matched_fields check (status <> 'matched' or (booking_id is not null and payment_id is not null))
);
comment on table public.bank_transactions is
  'Giao dịch ngân hàng nhận từ SePay (webhook). Khớp mã đơn → ghi payments; không khớp → chờ nhân viên xử lý.';
create index if not exists bank_txn_status_idx on public.bank_transactions (status, transaction_at desc);
create index if not exists bank_txn_branch_idx on public.bank_transactions (branch_id, transaction_at desc);
create index if not exists bank_txn_booking_idx on public.bank_transactions (booking_id) where booking_id is not null;

alter table public.bank_transactions enable row level security;
revoke all on public.bank_transactions from anon, authenticated;
grant select on public.bank_transactions to authenticated;

drop policy if exists bank_transactions_read on public.bank_transactions;
create policy bank_transactions_read on public.bank_transactions
  for select to authenticated
  using (
    (select private.is_owner())
    or (branch_id is not null and branch_id = any ((select private.permitted_branch_ids('payment.record'))::uuid[]))
    -- Chưa khớp chi nhánh nào: nhân viên có quyền thu tiền ở bất kỳ chi nhánh nào cũng xem được để gán tay.
    or (branch_id is null and cardinality((select private.permitted_branch_ids('payment.record'))::uuid[]) > 0)
  );

-- 3. Cho phép SePay "mở lại" giữ chỗ vừa hết hạn (chỉ khi đang ghi tiền, sân còn trống) ----------
create or replace function private.booking_transition_allowed(p_from public.booking_status, p_to public.booking_status)
returns boolean
language sql
stable
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
  )
  or (p_from = 'expired'::public.booking_status and p_to = 'confirmed'::public.booking_status
      and coalesce(current_setting('rally.deposit_revive', true), '') = 'on');
$$;

-- 4. Mã đơn trong nội dung chuyển khoản ------------------------------------------------------
-- Ngân hàng thường bỏ dấu gạch: "RB7K3M9Q2T", "rb-7k3m9q2t coc san" → RB-7K3M9Q2T.
create or replace function private.extract_booking_code(p_code text, p_content text)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'RB-' || m[1]
    from (select regexp_match(upper(coalesce(nullif(p_code, ''), '') || ' ' || coalesce(p_content, '')),
                              'RB[^A-Z0-9]{0,2}([2-9A-HJKMNP-TV-Z]{8})(?![A-Z0-9])') as m) x
   where m is not null;
$$;

-- Tài khoản nhận tiền áp dụng cho chi nhánh (riêng chi nhánh, nếu không thì của thương hiệu).
create or replace function private.branch_bank_account(p_branch_id uuid)
returns table (bank_code text, account_no text, account_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(b.bank_code, s.bank_code),
         coalesce(b.bank_account_no, s.bank_account_no),
         case when b.bank_code is not null then coalesce(b.bank_account_name, s.bank_account_name) else s.bank_account_name end
    from public.brand_settings s
    left join public.branches b on b.id = p_branch_id
   limit 1;
$$;

-- 5. Áp một giao dịch vào đơn: ghi tiền + tự xác nhận / mở lại / đánh dấu cần xử lý -------------
create or replace function private.apply_bank_transaction(p_txn_id uuid, p_booking_id uuid, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.bank_transactions;
  v public.bookings;
  v_payment uuid;
  v_paid bigint;
  v_status text := 'matched';
  v_note text;
  v_auto boolean;
  v_constraint text;
begin
  select * into t from public.bank_transactions where id = p_txn_id for update;
  if not found then
    perform private.raise_error('BANK_TXN_NOT_FOUND');
  end if;
  if t.payment_id is not null then
    return jsonb_build_object('status', t.status, 'booking_id', t.booking_id, 'payment_id', t.payment_id, 'replayed', true);
  end if;
  if t.transfer_type <> 'in' or t.amount <= 0 then
    perform private.raise_error('BANK_TXN_NOT_INCOMING');
  end if;

  select * into v from public.bookings where id = p_booking_id and deleted_at is null and kind = 'customer' for update;
  if not found then
    perform private.raise_error('BOOKING_NOT_FOUND');
  end if;

  perform private.set_audit_reason('system: sepay ' || t.provider_txn_id);
  insert into public.payments (booking_id, kind, method, status, amount, reference, note, provider, provider_txn_id,
                               provider_payload, idempotency_key, received_at, recorded_by)
  values (v.id, 'charge', 'gateway', 'succeeded', t.amount,
          nullif(left(btrim(coalesce(t.reference_code, '')), 100), ''),
          left('Chuyển khoản SePay: ' || coalesce(t.content, ''), 300),
          t.provider, t.provider_txn_id, t.raw, 'sepay:' || t.provider_txn_id, t.transaction_at, p_actor)
  returning id into v_payment;

  v_paid := private.booking_net_paid(v.id);
  select coalesce(transfer_auto_confirm, true) into v_auto from public.brand_settings limit 1;

  if v.status = 'held' then
    -- Còn "held" nghĩa là chưa ai lấy giờ này (giữ chỗ hết hạn chỉ nhường sân khi có người đặt chồng).
    if v_auto and v_paid >= greatest(v.deposit_amount, 1) then
      update public.bookings set status = 'confirmed' where id = v.id;
      v_note := 'Đủ cọc — đã tự xác nhận đơn.';
    elsif v.hold_expires_at <= now() then
      v_status := 'review';
      v_note := format('Giữ chỗ đã hết hạn, mới nhận %s đ / cọc %s đ — cần liên hệ khách.', v_paid, v.deposit_amount);
    else
      v_note := format('Đã nhận %s đ, cọc yêu cầu %s đ.', v_paid, v.deposit_amount);
    end if;
  elsif v.status = 'expired' then
    -- Giữ chỗ bị hủy vì hết giờ trong lúc khách đang chuyển: mở lại nếu sân vẫn trống.
    if v_auto and v_paid >= greatest(v.deposit_amount, 1) then
      begin
        perform set_config('rally.deposit_revive', 'on', true);
        update public.bookings set status = 'confirmed' where id = v.id;
        perform set_config('rally.deposit_revive', '', true);
        v_note := 'Giữ chỗ đã hết hạn nhưng sân còn trống — đã mở lại và xác nhận.';
      exception
        when exclusion_violation then
          perform set_config('rally.deposit_revive', '', true);
          v_status := 'review';
          v_note := 'Giữ chỗ đã hết hạn và giờ này đã có người khác đặt — cần liên hệ khách để đổi giờ hoặc hoàn tiền.';
      end;
    else
      v_status := 'review';
      v_note := format('Giữ chỗ đã hết hạn, mới nhận %s đ / cọc %s đ — cần liên hệ khách.', v_paid, v.deposit_amount);
    end if;
  elsif v.status in ('cancelled', 'no_show') then
    v_status := 'review';
    v_note := 'Đơn đã hủy / không đến nhưng khách vẫn chuyển tiền — cần hoàn tiền.';
  else
    v_note := 'Đã ghi vào tiền thanh toán của đơn.';
  end if;

  if v_paid > v.total_amount then
    v_status := 'review';
    v_note := coalesce(v_note || ' ', '') || format('Khách chuyển dư %s đ.', v_paid - v.total_amount);
  end if;
  perform private.set_audit_reason(null);

  -- Các lần chuyển trước của cùng đơn (thiếu cọc) đã được bù đủ → không còn cần xử lý.
  if v_status = 'matched' and (select b.status from public.bookings b where b.id = v.id) in ('confirmed', 'checked_in', 'completed') then
    update public.bank_transactions
       set status = 'matched', status_note = 'Đã đủ cọc nhờ giao dịch chuyển sau.'
     where booking_id = v.id and status = 'review' and payment_id is not null and id <> t.id;
  end if;

  update public.bank_transactions
     set status = v_status, status_note = left(v_note, 300), branch_id = v.branch_id, booking_id = v.id,
         payment_id = v_payment,
         resolved_by = case when p_actor is not null then p_actor else resolved_by end,
         resolved_at = case when p_actor is not null then now() else resolved_at end
   where id = t.id;

  return jsonb_build_object('status', v_status, 'note', v_note, 'booking_id', v.id, 'booking_code', v.code,
                            'payment_id', v_payment,
                            'booking_status', (select b.status from public.bookings b where b.id = v.id));
exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint in ('payments_provider_txn_uidx', 'payments_idempotency_key') then
      perform private.raise_error('BANK_TXN_ALREADY_RECORDED');
    end if;
    raise;
end;
$$;

-- 6. Webhook SePay (chỉ máy chủ gọi) -----------------------------------------------------------
create or replace function public.record_sepay_transaction(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_txn_id text := nullif(btrim(p_payload ->> 'id'), '');
  v_type text := lower(coalesce(p_payload ->> 'transferType', ''));
  v_amount bigint;
  v_at timestamptz;
  v_code text;
  v_booking uuid;
  v_existing public.bank_transactions;
  v_id uuid;
begin
  perform private.require_service_role();
  if v_txn_id is null or v_type not in ('in', 'out') then
    perform private.raise_error('INVALID_WEBHOOK_PAYLOAD');
  end if;
  begin
    v_amount := round((p_payload ->> 'transferAmount')::numeric)::bigint;
  exception when others then
    perform private.raise_error('INVALID_WEBHOOK_PAYLOAD', 'transferAmount');
  end;
  begin
    -- SePay gửi giờ Việt Nam dạng "YYYY-MM-DD HH:mm:ss".
    v_at := ((p_payload ->> 'transactionDate')::timestamp) at time zone 'Asia/Ho_Chi_Minh';
  exception when others then
    v_at := now();
  end;
  v_at := coalesce(v_at, now());

  -- Gửi lại (SePay thử lại / bấm gửi lại) → trả kết quả cũ, không ghi tiền hai lần.
  perform pg_advisory_xact_lock(hashtext('rally.sepay'), hashtext(v_txn_id));
  select * into v_existing from public.bank_transactions where provider = 'sepay' and provider_txn_id = v_txn_id;
  if found then
    return jsonb_build_object('status', v_existing.status, 'booking_id', v_existing.booking_id, 'replayed', true);
  end if;

  v_code := private.extract_booking_code(p_payload ->> 'code', p_payload ->> 'content');
  insert into public.bank_transactions (provider, provider_txn_id, gateway, account_number, transfer_type, amount, content,
                                        payment_code, reference_code, transaction_at, status, raw)
  values ('sepay', v_txn_id, left(p_payload ->> 'gateway', 60), left(p_payload ->> 'accountNumber', 40), v_type,
          greatest(coalesce(v_amount, 0), 0), left(p_payload ->> 'content', 500), v_code,
          left(nullif(p_payload ->> 'referenceCode', ''), 100), v_at,
          case when v_type = 'out' then 'ignored' else 'unmatched' end, p_payload)
  returning id into v_id;

  if v_type = 'out' or coalesce(v_amount, 0) <= 0 then
    return jsonb_build_object('status', 'ignored');
  end if;
  if v_code is null then
    update public.bank_transactions set status_note = 'Nội dung không có mã đơn RB…' where id = v_id;
    return jsonb_build_object('status', 'unmatched');
  end if;
  select b.id into v_booking from public.bookings b where b.code = v_code and b.deleted_at is null and b.kind = 'customer';
  if v_booking is null then
    update public.bank_transactions set status_note = format('Không có đơn %s', v_code) where id = v_id;
    return jsonb_build_object('status', 'unmatched', 'booking_code', v_code);
  end if;
  return private.apply_bank_transaction(v_id, v_booking, null);
end;
$$;

-- 7. Nhân viên gán tay / bỏ qua giao dịch --------------------------------------------------------
create or replace function public.match_bank_transaction(p_txn_id uuid, p_booking_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.bank_transactions;
  v public.bookings;
  v_code text := private.extract_booking_code(p_booking_code, null);
begin
  select * into t from public.bank_transactions where id = p_txn_id;
  if not found then
    perform private.raise_error('BANK_TXN_NOT_FOUND');
  end if;
  if t.payment_id is not null or t.status not in ('unmatched', 'review') then
    perform private.raise_error('BANK_TXN_ALREADY_RECORDED');
  end if;
  select * into v from public.bookings where code = v_code and deleted_at is null and kind = 'customer';
  if not found then
    perform private.raise_error('BOOKING_NOT_FOUND');
  end if;
  perform private.require_permission(v.branch_id, 'payment.record');
  return private.apply_bank_transaction(t.id, v.id, (select auth.uid()));
end;
$$;

create or replace function public.dismiss_bank_transaction(p_txn_id uuid, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.bank_transactions;
begin
  select * into t from public.bank_transactions where id = p_txn_id for update;
  if not found then
    perform private.raise_error('BANK_TXN_NOT_FOUND');
  end if;
  if t.branch_id is null then
    perform private.require_owner();
  else
    perform private.require_permission(t.branch_id, 'payment.record');
  end if;
  if char_length(btrim(coalesce(p_note, ''))) < 3 then
    perform private.raise_error('REASON_REQUIRED');
  end if;
  if t.status not in ('unmatched', 'review') then
    perform private.raise_error('BANK_TXN_ALREADY_RECORDED');
  end if;
  update public.bank_transactions
     set status = 'ignored', status_note = left(btrim(p_note), 300), resolved_by = (select auth.uid()), resolved_at = now()
   where id = t.id;
  return jsonb_build_object('status', 'ignored');
end;
$$;

-- 8. Tổng quan quản trị: một lần gọi, theo quyền người xem -----------------------------------------
create or replace function public.admin_dashboard(p_branch_id uuid default null, p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c_tz constant text := 'Asia/Ho_Chi_Minh';
  v_owner boolean := private.is_owner();
  v_days integer := least(greatest(coalesce(p_days, 30), 7), 92);
  v_today date := (now() at time zone c_tz)::date;
  v_day_start timestamptz := (v_today::timestamp) at time zone c_tz;
  v_day_end timestamptz := ((v_today + 1)::timestamp) at time zone c_tz;
  v_from timestamptz := ((v_today - v_days + 1)::timestamp) at time zone c_tz;
  v_prev_from timestamptz := ((v_today - 2 * v_days + 1)::timestamp) at time zone c_tz;
  v_scope uuid[];
  v_view uuid[];
  v_pay uuid[];
  v_sale uuid[];
  v_rent uuid[];
  v_stock uuid[];
  v_shift uuid[];
  v_result jsonb := '{}'::jsonb;
begin
  if (select auth.uid()) is null then
    perform private.raise_error('AUTH_REQUIRED');
  end if;
  -- Phạm vi: một chi nhánh (phải có quyền ở đó) hoặc tất cả (chỉ chủ sân).
  if p_branch_id is null then
    if not v_owner then
      perform private.raise_error('OWNER_REQUIRED');
    end if;
    select coalesce(array_agg(id), '{}') into v_scope from public.branches where deleted_at is null;
  else
    if not (p_branch_id = any (private.permitted_branch_ids(null))) then
      perform private.raise_error('PERMISSION_DENIED');
    end if;
    v_scope := array[p_branch_id];
  end if;

  select coalesce(array_agg(x), '{}') into v_view from unnest(v_scope) x where x = any (private.permitted_branch_ids('booking.view'));
  select coalesce(array_agg(x), '{}') into v_pay from unnest(v_scope) x where x = any (private.permitted_branch_ids('payment.record'));
  select coalesce(array_agg(x), '{}') into v_sale from unnest(v_scope) x where x = any (private.permitted_branch_ids('sale.record'));
  select coalesce(array_agg(x), '{}') into v_rent from unnest(v_scope) x where x = any (private.permitted_branch_ids('rental.operate'));
  select coalesce(array_agg(x), '{}') into v_stock from unnest(v_scope) x where x = any (private.permitted_branch_ids('catalog.view'));
  select coalesce(array_agg(x), '{}') into v_shift from unnest(v_scope) x where x = any (private.permitted_branch_ids('shift.view_branch'));
  if v_owner then
    v_pay := v_scope;
    v_shift := v_scope;
  end if;

  v_result := jsonb_build_object('today', v_today, 'days', v_days, 'is_owner', v_owner,
                                 'scope', case when p_branch_id is null then 'all' else 'branch' end);

  -- 8.1 Đặt sân hôm nay + lấp sân
  if cardinality(v_view) > 0 then
    v_result := v_result || jsonb_build_object('bookings', (
      with today as (
        select b.* from public.bookings b
         where b.branch_id = any (v_view) and b.deleted_at is null and b.kind = 'customer'
           and b.during && tstzrange(v_day_start, v_day_end, '[)')
      ), capacity as (
        select coalesce(sum(extract(epoch from (br.closes_at - br.opens_at)) / 60 *
                 (select count(*) from public.courts c where c.branch_id = br.id and c.status = 'active' and c.deleted_at is null)), 0) as minutes
          from public.branches br where br.id = any (v_view)
      ), used as (
        select coalesce(sum(extract(epoch from (least(upper(t.during), v_day_end) - greatest(lower(t.during), v_day_start))) / 60), 0) as minutes
          from today t where t.status in ('confirmed', 'checked_in', 'completed', 'held')
      )
      select jsonb_build_object(
        'total', (select count(*) from today where status not in ('cancelled', 'expired')),
        'held', (select count(*) from today where status = 'held'),
        'confirmed', (select count(*) from today where status = 'confirmed'),
        'checked_in', (select count(*) from today where status = 'checked_in'),
        'completed', (select count(*) from today where status = 'completed'),
        'cancelled', (select count(*) from today where status in ('cancelled', 'no_show')),
        'occupancy', case when (select minutes from capacity) > 0
                          then round(100.0 * (select minutes from used) / (select minutes from capacity)) else 0 end,
        'new_online', (select count(*) from public.bookings b where b.branch_id = any (v_view) and b.source = 'online'
                         and b.created_at >= v_day_start and b.deleted_at is null),
        'upcoming', coalesce((
          select jsonb_agg(jsonb_build_object('id', u.id, 'code', u.code, 'status', u.status, 'contact_name', u.contact_name,
                                              'starts_at', lower(u.during), 'ends_at', upper(u.during),
                                              'court_name', c.name, 'branch_name', br.name)
                           order by lower(u.during))
            from (select * from today where status in ('confirmed', 'checked_in') and upper(during) > now()
                   order by lower(during) limit 8) u
            join public.courts c on c.id = u.court_id
            join public.branches br on br.id = u.branch_id), '[]'::jsonb),
        'awaiting_deposit', coalesce((
          select jsonb_agg(jsonb_build_object('id', h.id, 'code', h.code, 'contact_name', h.contact_name,
                                              'starts_at', lower(h.during), 'hold_expires_at', h.hold_expires_at,
                                              'deposit_amount', h.deposit_amount,
                                              'paid_amount', private.booking_net_paid(h.id),
                                              'court_name', c.name, 'branch_name', br.name)
                           order by h.hold_expires_at)
            from (select * from public.bookings b where b.branch_id = any (v_view) and b.status = 'held'
                     and b.hold_expires_at > now() and b.deleted_at is null order by b.hold_expires_at limit 10) h
            join public.courts c on c.id = h.court_id
            join public.branches br on br.id = h.branch_id), '[]'::jsonb)
      )));
  end if;

  -- 8.2 Dòng tiền
  if cardinality(v_pay) > 0 then
    v_result := v_result || jsonb_build_object('cash', (
      with p as (
        select pm.*, case when pm.kind = 'charge' then pm.amount else -pm.amount end as signed,
               case when pm.booking_id is not null then 'booking' when pm.sale_id is not null then 'sale' else 'rental' end as source,
               (pm.received_at at time zone c_tz)::date as day
          from public.payments pm
         where pm.branch_id = any (v_pay) and pm.status = 'succeeded' and pm.received_at >= v_prev_from
      ), cur as (select * from p where received_at >= v_from)
      select jsonb_build_object(
        'today_in', (select coalesce(sum(amount), 0) from cur where kind = 'charge' and received_at >= v_day_start),
        'today_refund', (select coalesce(sum(amount), 0) from cur where kind = 'refund' and received_at >= v_day_start),
        'today_net', (select coalesce(sum(signed), 0) from cur where received_at >= v_day_start),
        'period_net', (select coalesce(sum(signed), 0) from cur),
        'period_refund', (select coalesce(sum(amount), 0) from cur where kind = 'refund'),
        'prev_net', (select coalesce(sum(signed), 0) from p where received_at < v_from),
        'by_source', jsonb_build_object(
          'booking', (select coalesce(sum(signed), 0) from cur where source = 'booking'),
          'sale', (select coalesce(sum(signed), 0) from cur where source = 'sale'),
          'rental', (select coalesce(sum(signed), 0) from cur where source = 'rental')),
        'by_method', coalesce((select jsonb_object_agg(method, total) from (
            select method::text, sum(signed) as total from cur group by method) m), '{}'::jsonb),
        'series', coalesce((
          select jsonb_agg(jsonb_build_object('day', d.day::date,
                   'booking', coalesce(s.booking, 0), 'sale', coalesce(s.sale, 0), 'rental', coalesce(s.rental, 0),
                   'refund', coalesce(s.refund, 0)) order by d.day)
            from generate_series((v_today - v_days + 1)::timestamp, v_today::timestamp, interval '1 day') as d(day)
            left join (
              select day,
                     sum(amount) filter (where kind = 'charge' and source = 'booking') as booking,
                     sum(amount) filter (where kind = 'charge' and source = 'sale') as sale,
                     sum(amount) filter (where kind = 'charge' and source = 'rental') as rental,
                     sum(amount) filter (where kind = 'refund') as refund
                from cur group by day) s on s.day = d.day::date), '[]'::jsonb),
        'recent', coalesce((
          select jsonb_agg(r order by r.received_at desc) from (
            select pm.id, pm.kind, pm.method, pm.amount, pm.received_at, pm.provider,
                   coalesce(bk.code, sl.code, rt.code) as ref_code,
                   case when pm.booking_id is not null then 'booking' when pm.sale_id is not null then 'sale' else 'rental' end as source,
                   pm.booking_id, pm.sale_id, pm.rental_id
              from public.payments pm
              left join public.bookings bk on bk.id = pm.booking_id
              left join public.sales sl on sl.id = pm.sale_id
              left join public.rentals rt on rt.id = pm.rental_id
             where pm.branch_id = any (v_pay) and pm.status = 'succeeded'
             order by pm.received_at desc limit 10) r), '[]'::jsonb),
        -- Tiền còn phải thu của đơn sắp chơi (7 ngày tới).
        'receivable', (
          select coalesce(sum(greatest(b.total_amount - private.booking_net_paid(b.id), 0)), 0)
            from public.bookings b
           where b.branch_id = any (v_pay) and b.status in ('confirmed', 'checked_in') and b.deleted_at is null
             and lower(b.during) < now() + interval '7 days' and upper(during) > now() - interval '1 day')
      )));
    v_result := v_result || jsonb_build_object('bank', (
      select jsonb_build_object(
        'today_count', count(*) filter (where t.transfer_type = 'in' and t.transaction_at >= v_day_start),
        'today_amount', coalesce(sum(t.amount) filter (where t.transfer_type = 'in' and t.transaction_at >= v_day_start), 0),
        'auto_matched_period', count(*) filter (where t.status = 'matched' and t.resolved_by is null and t.transaction_at >= v_from),
        'pending', count(*) filter (where t.status in ('unmatched', 'review')),
        'pending_list', coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'amount', t.amount, 'content', t.content,
                                   'status', t.status, 'status_note', t.status_note, 'transaction_at', t.transaction_at))
                          filter (where t.status in ('unmatched', 'review')), '[]'::jsonb))
        from public.bank_transactions t
       where (t.branch_id = any (v_pay) or (t.branch_id is null and (v_owner or cardinality(v_pay) > 0)))
         and (t.transaction_at >= v_from or t.status in ('unmatched', 'review'))));
  end if;

  -- 8.3 Bán hàng
  if cardinality(v_sale) > 0 or (v_owner and cardinality(v_scope) > 0) then
    v_result := v_result || jsonb_build_object('sales', (
      select jsonb_build_object(
        'today_count', count(*) filter (where s.sold_at >= v_day_start),
        'today_total', coalesce(sum(s.total_amount) filter (where s.sold_at >= v_day_start), 0),
        'period_count', count(*),
        'period_total', coalesce(sum(s.total_amount), 0),
        'top', coalesce((
          select jsonb_agg(x order by x.qty desc) from (
            select pr.name, sum(l.quantity) as qty, sum(l.line_total) as total
              from public.sale_lines l
              join public.sales s2 on s2.id = l.sale_id
              join public.product_variants pv on pv.id = l.variant_id
              join public.products pr on pr.id = pv.product_id
             where s2.branch_id = any (case when v_owner then v_scope else v_sale end)
               and s2.status = 'completed' and s2.sold_at >= v_from
             group by pr.name order by sum(l.quantity) desc limit 5) x), '[]'::jsonb))
        from public.sales s
       where s.branch_id = any (case when v_owner then v_scope else v_sale end)
         and s.status = 'completed' and s.sold_at >= v_from));
  end if;

  -- 8.4 Cho thuê
  if cardinality(v_rent) > 0 then
    v_result := v_result || jsonb_build_object('rentals', (
      select jsonb_build_object(
        'out', count(*) filter (where r.status = 'out'),
        'overdue', count(*) filter (where r.status = 'out' and r.due_at < now()),
        'today_new', count(*) filter (where r.created_at >= v_day_start),
        'overdue_list', coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'code', r.code, 'due_at', r.due_at,
                                   'customer', cu.full_name) order by r.due_at)
                          filter (where r.status = 'out' and r.due_at < now()), '[]'::jsonb))
        from public.rentals r
        left join public.customers cu on cu.id = r.customer_id
       where r.branch_id = any (v_rent) and (r.status = 'out' or r.created_at >= v_day_start)));
  end if;

  -- 8.5 Tồn kho
  if cardinality(v_stock) > 0 then
    v_result := v_result || jsonb_build_object('stock', (
      select jsonb_build_object(
        'low', count(*),
        'out', count(*) filter (where il.on_hand <= 0),
        'list', coalesce((jsonb_agg(jsonb_build_object('variant_id', il.variant_id, 'name', pr.name,
                     'size', pv.size_label, 'color', pv.color_label, 'on_hand', il.on_hand, 'reorder', il.reorder_level,
                     'branch_name', br.name) order by il.on_hand)), '[]'::jsonb))
        from public.inventory_levels il
        join public.product_variants pv on pv.id = il.variant_id and pv.deleted_at is null and pv.is_active
        join public.products pr on pr.id = pv.product_id and pr.kind = 'sale' and pr.deleted_at is null
        join public.branches br on br.id = il.branch_id
       where il.branch_id = any (v_stock) and il.is_listed and il.on_hand <= il.reorder_level));
  end if;

  -- 8.6 Nhân sự đang trong ca
  if cardinality(v_shift) > 0 then
    v_result := v_result || jsonb_build_object('staff', (
      select jsonb_build_object(
        'on_shift', count(*) filter (where sh.checked_in_at is not null and sh.checked_out_at is null),
        'scheduled_today', count(*),
        'late', count(*) filter (where sh.checked_in_at is null and sh.status = 'scheduled' and sh.scheduled_start < now()))
        from public.shifts sh
       where sh.branch_id = any (v_shift) and sh.deleted_at is null
         and sh.scheduled_start < v_day_end and sh.scheduled_end > v_day_start and sh.status <> 'cancelled'));
  end if;

  -- 8.7 Thành viên (toàn thương hiệu)
  if private.can_view_members() then
    v_result := v_result || jsonb_build_object('members', (
      select jsonb_build_object('total', count(*), 'new_period', count(*) filter (where m.created_at >= v_from))
        from public.member_profiles m));
  end if;

  return v_result;
end;
$$;

-- 9. Quyền gọi hàm ---------------------------------------------------------------------------
revoke all on function private.apply_bank_transaction(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.record_sepay_transaction(jsonb) from public, anon, authenticated;
grant execute on function public.record_sepay_transaction(jsonb) to service_role;
revoke all on function public.match_bank_transaction(uuid, text) from public, anon;
grant execute on function public.match_bank_transaction(uuid, text) to authenticated;
revoke all on function public.dismiss_bank_transaction(uuid, text) from public, anon;
grant execute on function public.dismiss_bank_transaction(uuid, text) to authenticated;
revoke all on function public.admin_dashboard(uuid, integer) from public, anon;
grant execute on function public.admin_dashboard(uuid, integer) to authenticated;

commit;

notify pgrst, 'reload schema';
