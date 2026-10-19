-- =============================================================================
-- RALLY BADMINTON — 17_reconcile_cron_optional.sql (TÙY CHỌN)
-- Lịch đối soát SePay mỗi 15 phút bằng Supabase Cron (pg_cron + pg_net).
-- Vercel gói Hobby chỉ cho chạy cron 1 lần/ngày, nên dùng Supabase để chạy dày hơn.
--
-- Trước khi chạy file này:
--   1. Đặt CRON_SECRET (chuỗi ngẫu nhiên, KHÔNG có ký tự $) trên Vercel và redeploy.
--   2. Chạy 2 lệnh dưới (thay giá trị thật) trong SQL Editor — khóa nằm trong Supabase Vault, không nằm trong file:
--        select vault.create_secret('https://rally-eight-tau.vercel.app', 'rally_site_url');
--        select vault.create_secret('<CRON_SECRET>', 'rally_cron_secret');
--      Đổi giá trị sau này: select vault.update_secret(id, '<giá trị mới>') from vault.secrets where name = 'rally_cron_secret';
--   3. Chạy file này. Chạy lại an toàn (lịch cũ được thay).
-- Tắt lịch: select cron.unschedule('rally-sepay-reconcile');
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'rally_site_url')
     or not exists (select 1 from vault.decrypted_secrets where name = 'rally_cron_secret') then
    raise notice 'Chưa có secret rally_site_url / rally_cron_secret trong Vault — xem bước 2 ở đầu file. Chưa tạo lịch.';
    return;
  end if;

  if exists (select 1 from cron.job where jobname = 'rally-sepay-reconcile') then
    perform cron.unschedule('rally-sepay-reconcile');
  end if;

  perform cron.schedule(
    'rally-sepay-reconcile',
    '*/15 * * * *',
    $job$
    select net.http_post(
      url := rtrim((select decrypted_secret from vault.decrypted_secrets where name = 'rally_site_url'), '/')
             || '/api/cron/sepay-reconcile',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'rally_cron_secret')),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
    $job$
  );
  raise notice 'Đã bật lịch đối soát SePay mỗi 15 phút (rally-sepay-reconcile).';
end;
$$;

-- Xem kết quả các lần chạy gần nhất:
--   select status, return_message, start_time from cron.job_run_details
--    where jobid = (select jobid from cron.job where jobname = 'rally-sepay-reconcile') order by start_time desc limit 10;
--   select status_code, content, created from net._http_response order by created desc limit 10;
