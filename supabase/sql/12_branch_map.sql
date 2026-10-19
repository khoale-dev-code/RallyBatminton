-- =============================================================================
-- RALLY BADMINTON — 12_branch_map.sql
-- Bản đồ Google nhúng cho từng chi nhánh (trang Giới thiệu, trang chi nhánh).
--
-- Chạy SAU 00 → 11. Chạy lại an toàn. Không bắt buộc có dữ liệu: chi nhánh chưa dán mã nhúng
-- thì website tự hiện bản đồ tìm theo địa chỉ.
--
-- Chỉ lưu đường dẫn src dạng https://www.google.com/maps/embed?pb=… (database kiểm tra lại),
-- không lưu HTML — website tự dựng thẻ <iframe> nên không thể chèn mã lạ.
-- =============================================================================

begin;

alter table public.branches add column if not exists map_embed_url text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'branches_map_embed_fmt') then
    alter table public.branches add constraint branches_map_embed_fmt check (
      map_embed_url is null
      or (map_embed_url ~ '^https://www\.google\.com/maps/embed\?pb=[^\s"''<>]+$' and char_length(map_embed_url) <= 2000));
  end if;
end;
$$;

comment on column public.branches.map_embed_url is 'Link nhúng Google Maps (src của iframe). Trống = bản đồ theo địa chỉ.';

commit;

notify pgrst, 'reload schema';
