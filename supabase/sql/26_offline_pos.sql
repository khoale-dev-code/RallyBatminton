-- =============================================================================
-- RALLY BADMINTON — 26_offline_pos.sql
-- Bán hàng khi mất mạng (quầy bán Rally Manager).
--
-- Chạy SAU 00 → 25. Chạy lại an toàn.
--
--   * Mất Internet: quầy bán vẫn bán TIỀN MẶT; đơn lưu trên máy (không có thông tin khách) kèm mã chống trùng.
--   * Có mạng lại: máy gửi từng đơn qua record_offline_sale → dùng đúng record_sale (giá, kho, quyền, chống trùng
--     như bán thường), chỉ khác: giờ bán / giờ nhận tiền = giờ bán thật lúc mất mạng, đánh dấu "bán khi mất mạng".
--   * Giá đã đổi trong lúc mất mạng (tổng tính lại ≠ tiền đã thu) → KHÔNG ghi, báo OFFLINE_PRICE_CHANGED kèm tổng mới;
--     nhân viên bấm "Ghi theo giá hiện tại" (p_accept_server_total) nếu đồng ý — ghi chú đơn lưu số tiền thật đã thu.
--   * Kho không đủ / món đã ngừng bán → báo lỗi như bán thường (không bao giờ để tồn kho âm); đơn nằm lại trên máy
--     chờ xử lý (nhập kho / bật lại món rồi gửi lại).
--   * Chỉ nhận đơn bán trong 72 giờ gần nhất, không nhận giờ tương lai.
-- =============================================================================

begin;

alter table public.sales add column if not exists recorded_offline boolean not null default false;
alter table public.sales add column if not exists offline_synced_at timestamptz;
comment on column public.sales.recorded_offline is 'Đơn bán lúc mất mạng, gửi lên sau (sold_at = giờ bán thật).';

-- Giờ bán thật của đơn đang được ghi (chỉ record_offline_sale đặt, trong cùng giao dịch).
create or replace function private.offline_sold_at()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select nullif(current_setting('rally.offline_sold_at', true), '')::timestamptz;
$$;

create or replace function private.sales_offline_stamp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_at timestamptz := private.offline_sold_at();
begin
  if v_at is not null then
    new.sold_at := v_at;
    new.recorded_offline := true;
    new.offline_synced_at := now();
  else
    new.recorded_offline := false;
    new.offline_synced_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists sales_offline_stamp on public.sales;
create trigger sales_offline_stamp before insert on public.sales
  for each row execute function private.sales_offline_stamp();

-- Khoản thu của đơn bán lúc mất mạng: giờ nhận tiền = giờ bán thật (đối soát tiền mặt theo ca / ngày).
create or replace function private.payments_offline_stamp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_at timestamptz := private.offline_sold_at();
begin
  if v_at is not null and new.sale_id is not null then
    new.received_at := v_at;
  end if;
  return new;
end;
$$;
drop trigger if exists payments_offline_stamp on public.payments;
create trigger payments_offline_stamp before insert on public.payments
  for each row execute function private.payments_offline_stamp();

create or replace function public.record_offline_sale(
  p_branch_id uuid,
  p_lines jsonb,
  p_discount_amount bigint,
  p_sold_at timestamptz,
  p_expected_total bigint,
  p_idempotency_key text,
  p_note text default null,
  p_accept_server_total boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb;
  v_total bigint;
begin
  if (select auth.uid()) is null then
    perform private.raise_error('AUTH_REQUIRED');
  end if;
  if p_sold_at is null or p_sold_at > now() + interval '5 minutes' or p_sold_at < now() - interval '72 hours' then
    perform private.raise_error('OFFLINE_SALE_TOO_OLD');
  end if;
  if p_expected_total is null or p_expected_total < 0 then
    perform private.raise_error('INVALID_INPUT', 'expected_total');
  end if;

  perform set_config('rally.offline_sold_at', p_sold_at::text, true);
  r := public.record_sale(p_branch_id, p_lines, 'cash', null, coalesce(p_discount_amount, 0), null, null,
                          left('Bán khi mất mạng' || coalesce(' · ' || nullif(btrim(p_note), ''), ''), 300),
                          p_idempotency_key);
  perform set_config('rally.offline_sold_at', '', true);

  -- Đã ghi trước đó (gửi lại / mạng chập chờn): trả kết quả cũ, không kiểm lại giá.
  if coalesce((r ->> 'replayed')::boolean, false) then
    return r || jsonb_build_object('offline', true);
  end if;

  v_total := (r ->> 'total_amount')::bigint;
  if v_total <> p_expected_total then
    if not coalesce(p_accept_server_total, false) then
      -- Lỗi làm hủy toàn bộ đơn vừa ghi (cùng giao dịch): không có đơn / kho / khoản thu nào được lưu.
      perform private.raise_error('OFFLINE_PRICE_CHANGED', v_total::text);
    end if;
    -- Ghi theo giá hiện tại: để lại dấu vết số tiền thật đã thu lúc mất mạng (đối chiếu két).
    update public.sales
       set note = left(coalesce(note || ' · ', '') || 'Lúc mất mạng thu ' || p_expected_total || 'đ, ghi theo giá hiện tại '
                       || v_total || 'đ', 300)
     where id = (r ->> 'sale_id')::uuid;
  end if;
  return r || jsonb_build_object('offline', true);
end;
$$;

revoke all on function private.offline_sold_at() from public, anon, authenticated;
revoke all on function private.sales_offline_stamp() from public, anon, authenticated;
revoke all on function private.payments_offline_stamp() from public, anon, authenticated;
revoke all on function public.record_offline_sale(uuid, jsonb, bigint, timestamptz, bigint, text, text, boolean) from public, anon;
grant execute on function public.record_offline_sale(uuid, jsonb, bigint, timestamptz, bigint, text, text, boolean) to authenticated;

commit;

-- Kiểm tra nhanh: select code, sold_at, offline_synced_at, total_amount from public.sales where recorded_offline order by sold_at desc limit 20;
