-- =============================================================================
-- RALLY BADMINTON — 03_jobs_optional.sql  (TÙY CHỌN, chạy sau 02_app_rpc.sql)
-- Tác vụ định kỳ bằng pg_cron.
--
-- Không bắt buộc cho tính đúng đắn: giữ chỗ hết hạn đã KHÔNG chặn lịch
-- (get_branch_busy_slots bỏ qua, tạo hold mới tự giải phóng). Job chỉ để
-- trạng thái trên dashboard sạch sẽ và tự hoàn tất booking đã chơi xong.
--
-- Bật pg_cron: Dashboard > Database > Extensions > tìm "pg_cron" > Enable
-- (hoặc dòng create extension bên dưới). Chạy lại file này an toàn: job cùng tên được cập nhật.
-- Gỡ job: select cron.unschedule('rally-expire-holds');
-- Xem lịch sử: select * from cron.job_run_details order by start_time desc limit 20;
-- =============================================================================

create extension if not exists pg_cron;

-- Mỗi phút: chuyển giữ chỗ quá hạn -> expired
select cron.schedule('rally-expire-holds', '* * * * *',
  $$select public.expire_stale_holds()$$);

-- Mỗi 15 phút: hoàn tất booking đã kết thúc (checked_in ngay sau giờ chơi; confirmed sau 24h)
select cron.schedule('rally-complete-bookings', '*/15 * * * *',
  $$select public.complete_finished_bookings()$$);

-- Mỗi giờ: dọn mã QR chấm công đã hết hạn
select cron.schedule('rally-purge-qr-tokens', '7 * * * *',
  $$delete from public.attendance_qr_tokens where expires_at < now() - interval '1 hour'$$);

select jobname, schedule, command, active from cron.job where jobname like 'rally-%' order by jobname;
