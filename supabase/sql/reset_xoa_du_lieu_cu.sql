-- =============================================================================
-- RALLY BADMINTON — reset_xoa_du_lieu_cu.sql
-- XÓA TOÀN BỘ dữ liệu và cấu trúc cũ của ứng dụng trong project Supabase,
-- để chạy lại 00 → 01 → 02 (→ 03, 04) từ đầu.
--
-- !!! KHÔNG HOÀN TÁC ĐƯỢC. Sao lưu trước khi chạy:
--     Dashboard > Database > Backups (gói Pro), hoặc trên máy:
--     supabase db dump --db-url "<connection string>" -f backup_schema.sql
--     supabase db dump --db-url "<connection string>" --data-only -f backup_data.sql
--
-- Xóa:
--   * Toàn bộ schema public (bảng, view, hàm, kiểu, trigger, policy) — rồi tạo lại rỗng
--     với quyền mặc định của Supabase.
--   * Schema private của Rally.
--   * Trigger cũ do schema cũ gắn lên auth.users (ví dụ handle_new_user) — đi theo hàm bị xóa.
--   * Policy ảnh rally_media_* trên storage.objects và job pg_cron tên rally-*.
--
-- GIỮ NGUYÊN:
--   * Tài khoản đăng nhập (auth.users) — dùng lại email cũ cho chủ sân được.
--     Muốn xóa luôn tài khoản: bỏ chú thích khối (C) cuối file.
--   * File ảnh trong Storage (Supabase không cho xóa file bằng SQL).
--     Muốn dọn: Dashboard > Storage > chọn bucket > xóa file / Empty bucket.
--   * Các schema hệ thống của Supabase (auth, storage, realtime, extensions, cron…).
--
-- Cách chạy: Supabase Dashboard > SQL Editor > New query > dán TOÀN BỘ file > Run.
-- =============================================================================

-- (A) XEM TRƯỚC — chỉ đọc. Có thể chạy riêng đoạn này trước để biết sẽ mất những gì.
select c.relname as bang, c.reltuples::bigint as so_dong_uoc_tinh
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind in ('r', 'p')
 order by c.relname;

-- (B) XÓA
begin;

-- B1. Job định kỳ của Rally (nếu đã bật pg_cron)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname like 'rally-%';
  end if;
end
$$;

-- B2. Policy ảnh của Rally trên Storage (00_init_schema.sql tạo lại)
drop policy if exists rally_media_insert on storage.objects;
drop policy if exists rally_media_update on storage.objects;
drop policy if exists rally_media_delete on storage.objects;

-- B3. Schema ứng dụng. CASCADE kéo theo: trigger trên auth.users dùng hàm trong public,
--     policy Storage tham chiếu hàm public/private, bảng trong publication realtime.
drop schema if exists private cascade;
drop schema if exists public cascade;

-- B4. Tạo lại schema public rỗng với quyền mặc định của Supabase
create schema public authorization postgres;
comment on schema public is 'standard public schema';
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
alter default privileges for role postgres in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to postgres, anon, authenticated, service_role;

commit;

-- Báo API (PostgREST) đọc lại cấu trúc mới.
notify pgrst, 'reload schema';

-- (C) TÙY CHỌN — xóa luôn mọi tài khoản đăng nhập. Bỏ dấu "--" ở 3 dòng dưới nếu muốn.
-- begin;
-- delete from auth.users;
-- commit;

-- (D) Kiểm tra: phải ra 0 bảng
select count(*) as so_bang_con_lai
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind in ('r', 'p');

-- Tiếp theo: chạy 00_init_schema.sql → 01_core_rpc.sql → 02_app_rpc.sql (→ 03, 04 tùy chọn),
-- rồi: select private.bootstrap_first_owner('email-chu-san@vidu.vn', 'Tên chủ sân');
