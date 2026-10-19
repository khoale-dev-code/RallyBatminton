-- =============================================================================
-- RALLY BADMINTON — 04_seed_demo_optional.sql   (TÙY CHỌN — dữ liệu mẫu để chạy thử)
-- Tạo 2 chi nhánh, sân, bảng giá, đồ uống/vật phẩm, thiết bị thuê và tồn kho ban đầu.
-- Chạy sau 00, 01, 02. Chạy lại an toàn (bỏ qua nếu chi nhánh mẫu đã có).
-- KHÔNG chạy trên dữ liệu thật nếu không muốn có chi nhánh mẫu (có thể "Đóng chi nhánh" sau).
-- =============================================================================

begin;

do $seed$
declare
  v_td uuid;
  v_q7 uuid;
  v_court uuid;
  v_vip uuid;
  v_product uuid;
  v_variant uuid;
  v_racket uuid;
  v_shoe41 uuid;
  v_shoe42 uuid;
  v_combo uuid;
  v_cat record;
  i integer;
begin
  if exists (select 1 from public.branches where slug = 'rally-thu-duc') then
    raise notice 'Dữ liệu mẫu đã có — bỏ qua.';
    return;
  end if;

  update public.brand_settings
     set hotline = '0901234567',
         email = 'xinchao@rally.vn',
         address_line = 'TP. Hồ Chí Minh',
         payment_instructions = E'Đặt cọc qua chuyển khoản: Vietcombank 0123456789 — RALLY BADMINTON.\nNội dung: mã đơn + số điện thoại. Nhân viên sẽ gọi xác nhận trong thời gian giữ chỗ.';

  -- Chi nhánh (tạo nháp → thêm sân, giá → công bố)
  insert into public.branches (slug, name, address_line, ward, district, city, phone, opens_at, closes_at, description, parking_info, house_rules)
  values ('rally-thu-duc', 'Rally Thủ Đức', '12 Võ Văn Ngân', 'Linh Chiểu', 'TP. Thủ Đức', 'TP. Hồ Chí Minh', '0901234567', '06:00', '23:00',
          'Sáu sân thảm PVC tiêu chuẩn thi đấu, trần cao 9 m, đèn chống chói.',
          'Giữ xe máy miễn phí trong hầm. Ô tô đậu dọc đường Võ Văn Ngân.',
          E'Mang giày đế không in vết.\nKhông hút thuốc trong khu vực sân.\nRa sân đúng giờ để không ảnh hưởng lượt sau.')
  returning id into v_td;
  insert into public.branches (slug, name, address_line, ward, district, city, phone, opens_at, closes_at, description, parking_info)
  values ('rally-quan-7', 'Rally Quận 7', '88 Nguyễn Thị Thập', 'Tân Phú', 'Quận 7', 'TP. Hồ Chí Minh', '0907654321', '05:30', '23:30',
          'Bốn sân sàn gỗ, có phòng tắm và tủ đồ.', 'Bãi ô tô trong khuôn viên.')
  returning id into v_q7;

  for i in 1..6 loop
    insert into public.courts (branch_id, name, surface_code, sort_order)
    values (v_td, 'Sân ' || i, 'pvc_mat', i) returning id into v_court;
    if i = 1 then v_vip := v_court; end if;
  end loop;
  for i in 1..4 loop
    insert into public.courts (branch_id, name, surface_code, sort_order) values (v_q7, 'Sân ' || chr(64 + i), 'wood', i);
  end loop;

  -- Bảng giá: ngày thường, giờ vàng, cuối tuần; sân 1 Thủ Đức là sân thi đấu (giá riêng)
  insert into public.price_rules (branch_id, label, days_mask, starts_at, ends_at, price_per_hour, priority) values
    (v_td, 'Giờ thường', 31, '06:00', '17:00', 80000, 0),
    (v_td, 'Giờ vàng', 31, '17:00', '23:00', 120000, 0),
    (v_td, 'Cuối tuần', 96, '06:00', '23:00', 130000, 0),
    (v_q7, 'Sáng sớm', 127, '05:30', '08:00', 70000, 0),
    (v_q7, 'Trong ngày', 127, '08:00', '17:00', 90000, 0),
    (v_q7, 'Buổi tối', 127, '17:00', '23:30', 140000, 0);
  insert into public.price_rules (branch_id, court_id, label, days_mask, starts_at, ends_at, price_per_hour, priority)
  values (v_td, v_vip, 'Sân thi đấu', 127, '17:00', '23:00', 150000, 0);

  insert into public.branch_amenities (branch_id, amenity_code)
  select v_td, code from public.amenities where code in ('motorbike_parking', 'drinks', 'equipment_rental', 'wifi', 'locker');
  insert into public.branch_amenities (branch_id, amenity_code)
  select v_q7, code from public.amenities where code in ('motorbike_parking', 'car_parking', 'shower', 'locker', 'drinks', 'equipment_rental', 'air_conditioning');

  update public.branches set status = 'published' where id in (v_td, v_q7);

  -- Hàng bán: (nhóm, tên, giá, sku)
  for v_cat in
    select * from (values
      ('do-uong', 'Nước suối Aquafina 500ml', 10000, 'NUOC-AQUA-500', 48),
      ('do-uong', 'Revive chanh muối', 15000, 'NUOC-REVIVE', 36),
      ('do-uong', 'Pocari Sweat 500ml', 20000, 'NUOC-POCARI', 24),
      ('cau', 'Cầu lông Thành Công (hộp 12 quả)', 280000, 'CAU-TC-12', 10),
      ('cau', 'Cầu lông Yonex AS-30 (hộp 12 quả)', 690000, 'CAU-YNX-AS30', 4),
      ('phu-kien', 'Quấn cán Yonex AC102', 35000, 'PK-QUAN-AC102', 30)
    ) as t(cat, name, price, sku, qty)
  loop
    insert into public.products (kind, category_id, name, base_price)
    values ('sale', (select id from public.product_categories where slug = v_cat.cat), v_cat.name, v_cat.price)
    returning id into v_product;
    insert into public.product_variants (product_id, sku, is_default) values (v_product, v_cat.sku, true) returning id into v_variant;
    insert into public.inventory_levels (branch_id, variant_id, reorder_level) values (v_td, v_variant, 5), (v_q7, v_variant, 5);
    insert into public.stock_movements (branch_id, variant_id, quantity_delta, reason) values
      (v_td, v_variant, v_cat.qty, 'opening'), (v_q7, v_variant, greatest(1, v_cat.qty / 2), 'opening');
  end loop;

  -- Tất thể thao có size
  insert into public.products (kind, category_id, name, base_price, brand_name)
  values ('sale', (select id from public.product_categories where slug = 'phu-kien'), 'Tất thể thao cổ ngắn', 45000, 'Kamito')
  returning id into v_product;
  insert into public.product_variants (product_id, sku, size_label, is_default, sort_order) values
    (v_product, 'PK-TAT-M', 'M', true, 1), (v_product, 'PK-TAT-L', 'L', false, 2);
  insert into public.inventory_levels (branch_id, variant_id)
  select v_td, id from public.product_variants where product_id = v_product;
  insert into public.stock_movements (branch_id, variant_id, quantity_delta, reason)
  select v_td, id, 12, 'opening' from public.product_variants where product_id = v_product;

  -- Thiết bị thuê
  insert into public.products (kind, category_id, name, brand_name, description)
  values ('rental', (select id from public.product_categories where slug = 'vot'), 'Vợt Yonex Astrox 77', 'Yonex', 'Vợt căng sẵn 24 lbs, quấn cán mới mỗi tuần.')
  returning id into v_product;
  insert into public.product_variants (product_id, sku, is_default) values (v_product, 'THUE-VOT-AX77', true) returning id into v_racket;
  insert into public.rental_rates (product_id, label, duration_minutes, price) values (v_product, '1 giờ', 60, 30000), (v_product, '2 giờ', 120, 50000);

  insert into public.products (kind, category_id, name, brand_name)
  values ('rental', (select id from public.product_categories where slug = 'giay'), 'Giày cầu lông', 'Lining')
  returning id into v_product;
  insert into public.product_variants (product_id, sku, size_label, is_default, sort_order) values (v_product, 'THUE-GIAY-41', '41', true, 1) returning id into v_shoe41;
  insert into public.product_variants (product_id, sku, size_label, sort_order) values (v_product, 'THUE-GIAY-42', '42', 2) returning id into v_shoe42;
  insert into public.rental_rates (product_id, label, duration_minutes, price) values (v_product, '1 giờ', 60, 20000), (v_product, '2 giờ', 120, 35000);

  insert into public.products (kind, name, is_bundle, description)
  values ('rental', 'Combo vợt + giày', true, 'Một vợt Astrox 77 và một đôi giày size 41.')
  returning id into v_combo;
  insert into public.product_variants (product_id, sku, is_default) values (v_combo, 'THUE-COMBO-01', true);
  insert into public.bundle_components (bundle_product_id, component_variant_id, quantity) values (v_combo, v_racket, 1), (v_combo, v_shoe41, 1);
  insert into public.rental_rates (product_id, label, duration_minutes, price) values (v_combo, '2 giờ', 120, 75000);

  insert into public.inventory_levels (branch_id, variant_id) values
    (v_td, v_racket), (v_td, v_shoe41), (v_td, v_shoe42), (v_q7, v_racket), (v_q7, v_shoe41);
  insert into public.stock_movements (branch_id, variant_id, quantity_delta, reason) values
    (v_td, v_racket, 8, 'opening'), (v_td, v_shoe41, 4, 'opening'), (v_td, v_shoe42, 4, 'opening'),
    (v_q7, v_racket, 4, 'opening'), (v_q7, v_shoe41, 2, 'opening');

  raise notice 'Đã tạo dữ liệu mẫu: 2 chi nhánh, 10 sân, 10 sản phẩm.';
end
$seed$;

commit;
