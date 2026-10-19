-- =============================================================================
-- RALLY BADMINTON — 16_alerts_reconcile.sql
-- Báo email cho chủ sân khi có giao dịch cần xử lý + đối soát dự phòng với SePay.
--
-- Chạy SAU 00 → 15. Chạy lại an toàn.
--
--   * notification_settings: email nhận cảnh báo (trống = email các tài khoản chủ sân), bật/tắt từng loại.
--   * bank_transactions.alerted_at: đã gửi email cho giao dịch này chưa (không gửi trùng).
--   * reconcile_runs: nhật ký mỗi lần website tự hỏi SePay danh sách giao dịch gần đây.
--   * record_sepay_transaction: chống trùng thêm theo mã tham chiếu ngân hàng (giao dịch từ đối soát).
--   * Các hàm service_* chỉ máy chủ gọi được (service role).
-- Lịch chạy tự động mỗi 15 phút: xem 17_reconcile_cron_optional.sql.
-- =============================================================================

begin;

-- 1. Cài đặt thông báo (chỉ chủ sân đọc / sửa) ---------------------------------------------
create table if not exists public.notification_settings (
  id                  boolean primary key default true constraint notification_settings_singleton check (id),
  alert_emails        text[] not null default '{}'
                        constraint notification_alert_emails_max check (cardinality(alert_emails) <= 5),
  alert_on_review     boolean not null default true,
  alert_on_unmatched  boolean not null default true,
  updated_at          timestamptz not null default now()
);
comment on table public.notification_settings is 'Email nhận cảnh báo giao dịch cần xử lý (trống = email tài khoản chủ sân).';
insert into public.notification_settings (id) values (true) on conflict (id) do nothing;

alter table public.notification_settings enable row level security;
revoke all on public.notification_settings from anon, authenticated;
grant select, update on public.notification_settings to authenticated;
drop policy if exists notification_settings_owner_read on public.notification_settings;
create policy notification_settings_owner_read on public.notification_settings
  for select to authenticated using ((select private.is_owner()));
drop policy if exists notification_settings_owner_update on public.notification_settings;
create policy notification_settings_owner_update on public.notification_settings
  for update to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));

-- 2. Đánh dấu đã gửi cảnh báo ---------------------------------------------------------------
alter table public.bank_transactions add column if not exists alerted_at timestamptz;
create index if not exists bank_txn_alert_idx on public.bank_transactions (created_at)
  where alerted_at is null and status in ('unmatched', 'review');
create index if not exists bank_txn_reference_idx on public.bank_transactions (reference_code) where reference_code is not null;

-- 3. Nhật ký đối soát -------------------------------------------------------------------------
create table if not exists public.reconcile_runs (
  id          uuid primary key default gen_random_uuid(),
  source      text not null constraint reconcile_source check (source in ('cron', 'manual', 'vercel')),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  fetched     integer not null default 0,
  new_count   integer not null default 0,
  error       text constraint reconcile_error_len check (error is null or char_length(error) <= 500)
);
create index if not exists reconcile_runs_time_idx on public.reconcile_runs (started_at desc);
alter table public.reconcile_runs enable row level security;
revoke all on public.reconcile_runs from anon, authenticated;
grant select on public.reconcile_runs to authenticated;
drop policy if exists reconcile_runs_owner_read on public.reconcile_runs;
create policy reconcile_runs_owner_read on public.reconcile_runs
  for select to authenticated using ((select private.is_owner()));

-- 4. Webhook / đối soát: chống trùng theo mã tham chiếu ---------------------------------------
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
  -- Đối soát qua API có thể trả cùng giao dịch với mã khác webhook: chống trùng thêm theo mã tham chiếu ngân hàng.
  if nullif(btrim(coalesce(p_payload ->> 'referenceCode', '')), '') is not null then
    select * into v_existing from public.bank_transactions t
     where t.provider = 'sepay'
       and t.reference_code = left(btrim(p_payload ->> 'referenceCode'), 100)
       and t.amount = greatest(coalesce(v_amount, 0), 0)
       and t.transfer_type = v_type
       and t.account_number is not distinct from left(p_payload ->> 'accountNumber', 40)
     limit 1;
    if found then
      return jsonb_build_object('status', v_existing.status, 'booking_id', v_existing.booking_id, 'replayed', true);
    end if;
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

-- 5. Hàm cho máy chủ -----------------------------------------------------------------------------
-- Người nhận cảnh báo: danh sách trong cài đặt, nếu trống thì email các tài khoản chủ sân.
create or replace function public.service_alert_recipients()
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_emails text[];
begin
  perform private.require_service_role();
  select alert_emails into v_emails from public.notification_settings where id;
  if coalesce(cardinality(v_emails), 0) > 0 then
    return v_emails;
  end if;
  select coalesce(array_agg(distinct u.email), '{}') into v_emails
    from public.staff_accounts sa join auth.users u on u.id = sa.user_id
   where sa.role = 'owner' and sa.is_active and u.email is not null
     and u.email not like '%@thanhvien.rally.invalid';
  return v_emails;
end;
$$;

-- Giao dịch cần báo (chưa báo, trong 3 ngày) kèm thông tin đơn để viết email.
create or replace function public.service_pending_alerts(p_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.notification_settings;
begin
  perform private.require_service_role();
  select * into s from public.notification_settings where id;
  return jsonb_build_object(
    'recipients', to_jsonb(public.service_alert_recipients()),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'amount', t.amount, 'content', t.content, 'status', t.status,
               'status_note', t.status_note, 'transaction_at', t.transaction_at, 'gateway', t.gateway,
               'booking_code', b.code, 'contact_name', b.contact_name, 'contact_phone', cu.phone,
               'starts_at', lower(b.during), 'court_name', c.name, 'branch_name', br.name)
             order by t.transaction_at)
        from (select * from public.bank_transactions x
               where x.alerted_at is null and x.transfer_type = 'in'
                 and x.created_at > now() - interval '3 days'
                 and ((x.status = 'review' and coalesce(s.alert_on_review, true))
                   or (x.status = 'unmatched' and coalesce(s.alert_on_unmatched, true)))
               order by x.transaction_at
               limit least(greatest(coalesce(p_limit, 20), 1), 50)) t
        left join public.bookings b on b.id = t.booking_id
        left join public.customers cu on cu.id = b.customer_id
        left join public.courts c on c.id = b.court_id
        left join public.branches br on br.id = b.branch_id), '[]'::jsonb));
end;
$$;

create or replace function public.service_mark_alerted(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform private.require_service_role();
  update public.bank_transactions set alerted_at = now() where id = any (p_ids) and alerted_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Số tài khoản cần đối soát (tài khoản thương hiệu + tài khoản riêng của chi nhánh).
create or replace function public.service_bank_accounts()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct acc), '{}')
    from (select bank_account_no as acc from public.brand_settings where bank_account_no is not null
          union
          select bank_account_no from public.branches where bank_account_no is not null and deleted_at is null) a;
$$;

create or replace function public.service_reconcile_start(p_source text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_last timestamptz;
begin
  perform private.require_service_role();
  -- Mốc bắt đầu lấy giao dịch: lần đối soát thành công gần nhất (lùi 2 giờ cho chắc), tối đa 3 ngày.
  select max(started_at) into v_last from public.reconcile_runs where finished_at is not null and error is null;
  insert into public.reconcile_runs (source) values (p_source) returning id into v_id;
  delete from public.reconcile_runs where started_at < now() - interval '30 days';
  return jsonb_build_object('run_id', v_id,
    'since', greatest(coalesce(v_last, now() - interval '3 days') - interval '2 hours', now() - interval '3 days'));
end;
$$;

create or replace function public.service_reconcile_finish(p_run_id uuid, p_fetched integer, p_new integer, p_error text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_service_role();
  update public.reconcile_runs
     set finished_at = now(), fetched = greatest(coalesce(p_fetched, 0), 0), new_count = greatest(coalesce(p_new, 0), 0),
         error = left(nullif(btrim(coalesce(p_error, '')), ''), 500)
   where id = p_run_id;
end;
$$;

revoke all on function public.service_alert_recipients() from public, anon, authenticated;
revoke all on function public.service_pending_alerts(integer) from public, anon, authenticated;
revoke all on function public.service_mark_alerted(uuid[]) from public, anon, authenticated;
revoke all on function public.service_bank_accounts() from public, anon, authenticated;
revoke all on function public.service_reconcile_start(text) from public, anon, authenticated;
revoke all on function public.service_reconcile_finish(uuid, integer, integer, text) from public, anon, authenticated;
grant execute on function public.service_alert_recipients() to service_role;
grant execute on function public.service_pending_alerts(integer) to service_role;
grant execute on function public.service_mark_alerted(uuid[]) to service_role;
grant execute on function public.service_bank_accounts() to service_role;
grant execute on function public.service_reconcile_start(text) to service_role;
grant execute on function public.service_reconcile_finish(uuid, integer, integer, text) to service_role;

commit;

notify pgrst, 'reload schema';
