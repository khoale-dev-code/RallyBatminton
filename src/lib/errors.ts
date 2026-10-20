/**
 * Chuyển mã lỗi ổn định từ database (RPC raise 'SLOT_TAKEN', ...) và lỗi Postgres/PostgREST
 * sang thông điệp tiếng Việt cho người dùng. Database là nơi quyết định; giao diện chỉ diễn đạt.
 */

const CODE_MESSAGES: Record<string, string> = {
  // Đặt sân
  SLOT_TAKEN: 'Khung giờ này vừa có người giữ. Vui lòng chọn giờ khác.',
  HOLD_EXPIRED: 'Thời gian giữ chỗ đã hết. Vui lòng đặt lại.',
  TOO_MANY_HOLDS: 'Số điện thoại này đang giữ 2 lượt chưa xác nhận. Hoàn tất hoặc chờ hết hạn rồi đặt tiếp.',
  RATE_LIMITED: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.',
  OUTSIDE_OPENING_HOURS: 'Khung giờ nằm ngoài giờ mở cửa của chi nhánh.',
  NO_PRICE_RULE: 'Khung giờ này chưa có bảng giá. Vui lòng chọn giờ khác hoặc liên hệ chi nhánh.',
  RANGE_NOT_ALIGNED: 'Giờ bắt đầu và kết thúc phải theo từng ô 30 phút.',
  INVALID_DURATION: 'Thời lượng đặt sân không hợp lệ.',
  OUTSIDE_BOOKING_WINDOW: 'Thời điểm này nằm ngoài khoảng cho phép đặt trước.',
  INVALID_RANGE: 'Khoảng thời gian không hợp lệ.',
  COURT_NOT_FOUND: 'Không tìm thấy sân.',
  COURT_UNAVAILABLE: 'Sân đang tạm ngưng hoặc bảo trì.',
  BRANCH_UNAVAILABLE: 'Chi nhánh chưa mở đặt sân trực tuyến.',
  INVALID_PHONE: 'Số điện thoại di động Việt Nam không hợp lệ (ví dụ 0912 345 678).',
  INVALID_NAME: 'Họ tên cần từ 2 đến 80 ký tự.',
  BOOKING_NOT_FOUND: 'Không tìm thấy đơn với mã và số điện thoại này.',
  BOOKING_NAME_MISMATCH: 'Họ tên chưa khớp với tên đã dùng khi đặt sân. Nhập đúng họ tên (có dấu hay không dấu đều được).',
  CANCELLATION_CLOSED: 'Đã qua giờ bắt đầu, không thể hủy trực tuyến.',
  INVALID_STATUS: 'Trạng thái đơn hiện tại không cho phép thao tác này.',
  NOT_HELD: 'Đơn không còn ở trạng thái giữ chỗ.',
  BOOKING_NOT_EDITABLE: 'Đơn đã kết thúc hoặc đã hủy, không thể chỉnh sửa.',
  CROSS_BRANCH_MOVE_FORBIDDEN: 'Chỉ đổi sang sân trong cùng chi nhánh.',
  CHECKIN_WINDOW_CLOSED: 'Chỉ check-in được từ 30 phút trước giờ chơi đến khi kết thúc.',
  NOT_STARTED_YET: 'Chưa đến giờ bắt đầu.',
  NOT_A_CUSTOMER_BOOKING: 'Thao tác chỉ áp dụng cho đơn của khách.',
  DISCOUNT_OWNER_ONLY: 'Chỉ chủ sân được giảm giá.',
  INVALID_DISCOUNT: 'Số tiền giảm không hợp lệ.',
  WAIVE_OWNER_ONLY: 'Chỉ chủ sân được miễn chính sách hủy.',
  REASON_REQUIRED: 'Vui lòng nhập lý do (tối thiểu vài ký tự).',
  IDEMPOTENCY_CONFLICT: 'Yêu cầu trùng với một thao tác trước đó nhưng khác nội dung. Tải lại trang rồi thử lại.',
  IDEMPOTENCY_KEY_REQUIRED: 'Thiếu mã chống gửi trùng. Tải lại trang rồi thử lại.',
  TRY_AGAIN: 'Có xung đột tạm thời. Vui lòng thử lại.',
  // Thành viên
  MEMBER_PHONE_TAKEN: 'Số điện thoại này đã có tài khoản thành viên. Hãy đăng nhập hoặc dùng số khác.',
  MEMBER_NOT_FOUND: 'Không tìm thấy tài khoản thành viên.',
  MEMBER_LOCKED: 'Tài khoản thành viên đang bị khóa. Vui lòng liên hệ quầy hoặc hotline.',
  MEMBER_LOGIN_PHONE: 'Số điện thoại là tên đăng nhập của tài khoản này. Muốn đổi số, vui lòng liên hệ quầy.',
  STAFF_ACCOUNT: 'Tài khoản này không dùng cho khách hàng.',
  MEMBER_ACCOUNT: 'Tài khoản này đang là tài khoản thành viên (khách hàng), không thể cấp quyền nhân sự.',
  BOOKING_CLAIMED: 'Đơn này đã thuộc một tài khoản thành viên khác.',
  POINTS_INSUFFICIENT: 'Số điểm hiện có không đủ để trừ.',
  INVALID_POINTS: 'Số điểm điều chỉnh không hợp lệ.',
  // Tiền
  AMOUNT_EXCEEDS_BALANCE: 'Số tiền vượt quá số còn phải thu.',
  REFUND_EXCEEDS_PAID: 'Số tiền hoàn vượt quá số đã thu.',
  INVALID_AMOUNT: 'Số tiền không hợp lệ.',
  DUPLICATE_REFERENCE: 'Mã giao dịch này đã được ghi nhận trước đó.',
  REFERENCE_REQUIRED: 'Chuyển khoản/thẻ/ví cần mã tham chiếu giao dịch.',
  GATEWAY_VIA_WEBHOOK_ONLY: 'Thanh toán qua cổng chỉ được ghi nhận tự động.',
  PAYMENT_NOT_FOUND: 'Không tìm thấy giao dịch.',
  INVALID_PAYMENT: 'Thông tin giao dịch không hợp lệ.',
  // Kho, bán, thuê
  INSUFFICIENT_STOCK: 'Không đủ hàng tại chi nhánh.',
  VARIANT_NOT_STOCKED_AT_BRANCH: 'Mặt hàng chưa được niêm yết tại chi nhánh này.',
  INVALID_STOCK_REASON: 'Lý do điều chỉnh kho không hợp lệ.',
  INVALID_QUANTITY: 'Số lượng không hợp lệ.',
  INVALID_QUANTITY_SIGN: 'Nhập hàng phải là số dương; hỏng/mất phải là số âm.',
  VARIANT_NOT_FOUND: 'Không tìm thấy biến thể.',
  PRODUCT_NOT_FOUND: 'Không tìm thấy sản phẩm.',
  UNIT_NOT_FOUND: 'Đơn vị tính đã bị xóa. Tải lại trang rồi thử lại.',
  BUNDLE_SINGLE_VARIANT: 'Combo chỉ có một biến thể; thành phần combo chọn sau khi tạo.',
  PRODUCT_UNAVAILABLE: 'Có mặt hàng đã ngừng bán hoặc chưa có giá.',
  INVALID_LINES: 'Giỏ hàng không hợp lệ.',
  SALE_NOT_FOUND: 'Không tìm thấy đơn bán.',
  RENTAL_UNAVAILABLE: 'Thiết bị đang tạm ngưng cho thuê.',
  RENTAL_RATE_UNAVAILABLE: 'Gói giá thuê không còn áp dụng.',
  BUNDLE_VARIANT_FORBIDDEN: 'Combo không chọn biến thể riêng.',
  BUNDLE_EMPTY: 'Combo chưa có thành phần.',
  VARIANT_REQUIRED: 'Vui lòng chọn size/biến thể.',
  RENTAL_NOT_FOUND: 'Không tìm thấy lượt thuê.',
  RENTAL_NOT_OUT: 'Lượt thuê đã được trả hoặc đã hủy.',
  RETURN_QUANTITY_MISMATCH: 'Tổng số trả + hỏng + mất phải bằng số đã cho thuê.',
  INVALID_FEE: 'Phí phát sinh không hợp lệ.',
  RENTAL_BOOKING_INVALID: 'Lượt đặt sân không thuộc chi nhánh này.',
  RENTAL_BOOKING_NOT_ACTIVE: 'Lượt đặt sân đã kết thúc hoặc chưa tới giờ (chỉ gắn sân đang chơi hoặc bắt đầu trong 60 phút).',
  RENTAL_BOOKING_TAKE_OUT: 'Đồ mang ra ngoài không gắn với lượt đặt sân.',
  RENTAL_SESSION_ON_SITE: 'Gói "hết trận" chỉ dùng tại sân.',
  RENTAL_COLLATERAL_REQUIRED: 'Mang đồ ra ngoài cần ghi vật cầm cọc (CCCD, bằng lái, tiền cọc…).',
  LATE_FEE_REASON_REQUIRED: 'Thu phụ phí thấp hơn mức hệ thống tính thì phải ghi lý do.',
  ON_HAND_LEDGER_ONLY: 'Tồn kho chỉ được thay đổi qua phiếu điều chỉnh.',
  BUNDLE_HAS_NO_STOCK: 'Combo không có tồn kho riêng.',
  NOT_A_RENTAL_BUNDLE: 'Sản phẩm không phải combo cho thuê.',
  INVALID_BUNDLE_COMPONENT: 'Thành phần combo phải là thiết bị cho thuê đơn lẻ.',
  // Chấm công & lương
  QR_EXPIRED_OR_INVALID: 'Mã QR đã hết hạn hoặc không đúng chi nhánh. Quét mã mới trên màn hình quầy.',
  INVALID_QR_REQUEST: 'Mã QR không hợp lệ.',
  INVALID_QR_HASH: 'Không tạo được mã QR.',
  STAFF_NOT_ALLOWED: 'Tài khoản chưa được liên kết hồ sơ nhân viên đang làm việc.',
  ALREADY_CHECKED_IN: 'Bạn đang trong ca, hãy check-out trước.',
  NO_ELIGIBLE_SHIFT: 'Không có ca phù hợp để check-in lúc này (mở từ 60 phút trước giờ vào ca).',
  NO_OPEN_CHECKIN: 'Không tìm thấy lượt check-in đang mở tại chi nhánh này.',
  CHECKOUT_TOO_SOON: 'Vừa check-in xong, vui lòng thử lại sau 1 phút.',
  CHECKOUT_TOO_LATE: 'Đã quá giờ quét ra ca. Gửi “Yêu cầu sửa giờ ra” trong Ca & lương của tôi, hoặc báo chủ sân.',
  PAYROLL_CLOSED: 'Tháng lương đã chốt, không thể thay đổi.',
  UNRESOLVED_SHIFTS: 'Còn ca chưa xử lý (chưa có mặt/vắng/nghỉ) trong tháng.',
  MISSING_PAY_RATE: 'Có ca làm chưa có mức lương áp dụng.',
  NEGATIVE_NET_PAY: 'Có nhân viên bị âm lương sau điều chỉnh.',
  MONTH_ALREADY_CLOSED: 'Tháng này đã được chốt.',
  MONTH_NOT_COMPLETED: 'Chỉ chốt được tháng đã kết thúc.',
  INVALID_MONTH: 'Tháng không hợp lệ.',
  SHIFT_NOT_FOUND: 'Không tìm thấy ca làm.',
  ATTENDANCE_REASON_REQUIRED: 'Thay đổi dữ liệu công phải có lý do.',
  SHIFT_ALREADY_STARTED: 'Ca đã check-in, không thể dời lịch.',
  EMPLOYEE_INACTIVE: 'Nhân viên đã nghỉ việc.',
  PAY_RATE_LOCKED_BY_CLOSED_PAYROLL: 'Mức lương này ảnh hưởng tháng đã chốt.',
  ADJUSTMENT_IMMUTABLE: 'Khoản điều chỉnh đã tạo không sửa được; hãy hủy và tạo mới.',
  // Sửa giờ chấm công, máy quầy
  INVALID_FIX_REQUEST: 'Yêu cầu sửa giờ không hợp lệ.',
  FIX_REQUEST_TOO_LATE: 'Đã quá hạn gửi yêu cầu sửa giờ cho ca này. Hãy báo trực tiếp chủ sân.',
  FIX_CLAIM_IN_FUTURE: 'Giờ khai không được ở tương lai.',
  FIX_CLAIM_OUT_OF_RANGE: 'Giờ khai không hợp lệ: giờ vào phải sớm hơn giờ đã ghi và trong khung ca; giờ ra phải sau giờ vào.',
  FIX_NEEDS_CHECKIN: 'Ca này chưa có giờ vào. Gửi yêu cầu sửa giờ vào trước.',
  FIX_ALREADY_PENDING: 'Đã có yêu cầu đang chờ chủ sân duyệt cho ca này.',
  FIX_NOT_PENDING: 'Yêu cầu này đã được xử lý.',
  FIX_SCAN_INSTEAD: 'Ca chưa kết thúc — hãy quét mã RA CA tại quầy khi về.',
  SHIFT_NOT_WORKABLE: 'Ca này đã đánh dấu vắng / nghỉ / hủy.',
  SHIFT_NOT_PRESENT: 'Ca chưa có đủ giờ vào và ra.',
  INVALID_DECISION: 'Lựa chọn không hợp lệ.',
  PENDING_ATTENDANCE_FIXES: 'Còn yêu cầu sửa giờ chưa duyệt trong tháng. Vào Duyệt chấm công để xử lý trước khi chốt lương.',
  KIOSK_INVALID: 'Máy quầy này đã bị thu hồi hoặc đường dẫn không đúng. Chủ sân tạo lại trong mục Mã QR.',
  // Gia hạn giờ chơi
  EXTEND_END_INVALID: 'Giờ kết thúc mới phải sau giờ kết thúc hiện tại.',
  EXTEND_TOO_LONG: 'Mỗi lần chỉ gia hạn tối đa 6 giờ.',
  EXTEND_COMPLETED_FUTURE: 'Đơn đã hoàn tất: chỉ tính thêm phần giờ khách đã chơi (tới thời điểm hiện tại).',
  // Tăng ca
  PAYROLL_MONTH_CLOSED: 'Tháng lương của ca này đã chốt, không thay đổi tăng ca được.',
  OVERTIME_SHIFT_NOT_WORKED: 'Ca đã vắng / nghỉ / hủy nên không đề nghị tăng ca được.',
  OVERTIME_INVALID_MINUTES: 'Thời gian tăng ca từ 15 phút đến 8 giờ, theo bước 15 phút.',
  OVERTIME_INVALID_RATE: 'Giá tăng ca không hợp lệ.',
  OVERTIME_TOO_LONG: 'Ca cộng tăng ca vượt quá 16 giờ.',
  OVERTIME_WINDOW_PASSED: 'Khung giờ tăng ca đã qua — chọn "Nhân viên đã đồng ý trực tiếp" nếu đã thỏa thuận tại sân.',
  OVERTIME_OVERLAPS_SHIFT: 'Giờ tăng ca trùng với ca kế tiếp của nhân viên này.',
  OVERTIME_ALREADY_OFFERED: 'Ca này đã có đề nghị tăng ca đang hiệu lực. Hủy đề nghị cũ trước khi tạo mới.',
  OVERTIME_NOT_FOUND: 'Không tìm thấy đề nghị tăng ca.',
  OVERTIME_ALREADY_ANSWERED: 'Đề nghị tăng ca này đã được trả lời hoặc đã hủy.',
  OVERTIME_EXPIRED: 'Đã quá khung giờ tăng ca, không trả lời được nữa.',
  // Quyền & cấu hình
  AUTH_REQUIRED: 'Vui lòng đăng nhập.',
  PERMISSION_DENIED: 'Bạn không có quyền thực hiện thao tác này tại chi nhánh.',
  OWNER_REQUIRED: 'Chỉ chủ sân được thực hiện thao tác này.',
  SERVER_ONLY: 'Thao tác chỉ được thực hiện từ máy chủ.',
  LAST_OWNER_REQUIRED: 'Không thể vô hiệu hóa chủ sân cuối cùng.',
  BRANCH_NOT_READY: 'Chi nhánh chưa đủ điều kiện công bố.',
  BRANCH_NOT_FOUND: 'Không tìm thấy chi nhánh.',
  INVALID_TIMEZONE: 'Múi giờ không hợp lệ.',
  PRICE_RULE_OVERLAP: 'Đã có quy tắc giá cùng phạm vi, cùng ưu tiên và trùng ngày giờ. Đổi độ ưu tiên hoặc khung giờ.',
  HARD_DELETE_FORBIDDEN: 'Dữ liệu lịch sử không được xóa; hãy chuyển trạng thái.',
  INVALID_STATUS_TRANSITION: 'Không thể chuyển sang trạng thái này.',
};

const DETAIL_MESSAGES: Record<string, string> = {
  MISSING_ADDRESS: 'thiếu địa chỉ',
  NO_ACTIVE_COURT: 'chưa có sân đang hoạt động',
  COURT_WITHOUT_PRICE: 'có sân chưa có bảng giá',
};

/** Ràng buộc database → thông điệp (lỗi 23505 unique, 23P01 exclusion, 23503 FK, 23514 check). */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  bookings_no_overlap: CODE_MESSAGES.SLOT_TAKEN,
  shifts_no_overlap: 'Nhân viên đã có ca trùng giờ.',
  shifts_one_open_checkin_uidx: CODE_MESSAGES.ALREADY_CHECKED_IN,
  branches_slug_key: 'Đường dẫn (slug) đã được dùng cho chi nhánh khác.',
  branches_slug_fmt: 'Đường dẫn chỉ gồm chữ thường không dấu, số và dấu gạch ngang.',
  branches_hours: 'Giờ đóng cửa phải sau giờ mở cửa.',
  branches_hours_aligned: 'Giờ mở/đóng cửa phải tròn 30 phút.',
  branches_booking_len: 'Thời lượng đặt tối thiểu/tối đa không hợp lệ.',
  branches_cancel_policy: 'Mốc hoàn toàn bộ phải lớn hơn hoặc bằng mốc hoàn một phần.',
  courts_branch_name_uidx: 'Chi nhánh đã có sân trùng tên.',
  price_rules_time: 'Giờ kết thúc phải sau giờ bắt đầu.',
  price_rules_time_aligned: 'Khung giờ phải tròn 30 phút.',
  price_rules_validity: 'Ngày kết thúc hiệu lực phải sau ngày bắt đầu.',
  price_rules_court_fk: 'Sân không thuộc chi nhánh này.',
  product_variants_sku_key: 'SKU đã tồn tại.',
  product_variants_sku_fmt: 'SKU chỉ gồm chữ in hoa, số, dấu chấm, gạch ngang (2–40 ký tự).',
  product_variants_options_uidx: 'Đã có biến thể cùng size và màu.',
  product_categories_slug_key: 'Đường dẫn nhóm hàng đã tồn tại.',
  products_slug_key: 'Đường dẫn sản phẩm đã tồn tại.',
  products_sale_price: 'Hàng bán cần có giá bán.',
  products_compare_price: 'Giá so sánh phải lớn hơn giá bán.',
  product_variants_barcode_uidx: 'Mã vạch đã dùng cho sản phẩm khác.',
  product_units_name_uidx: 'Tên đơn vị tính bị trùng.',
  product_units_barcode_uidx: 'Mã vạch của đơn vị tính đã dùng ở nơi khác.',
  product_units_conversion: 'Số quy đổi phải từ 2 đến 10.000.',
  products_option1_len: 'Tên thuộc tính tối đa 30 ký tự.',
  products_option2_len: 'Tên thuộc tính tối đa 30 ký tự.',
  product_variants_barcode_fmt: 'Mã vạch gồm 4–32 chữ, số, dấu chấm, gạch.',
  product_variants_cost: 'Giá vốn không hợp lệ.',
  products_tags_limit: 'Tối đa 20 nhãn.',
  products_seo_title_len: 'Tiêu đề SEO tối đa 70 ký tự.',
  products_seo_desc_len: 'Mô tả SEO tối đa 320 ký tự.',
  products_excerpt_len: 'Trích dẫn tối đa 300 ký tự.',
  products_unit_label_len: 'Đơn vị tính tối đa 20 ký tự.',
  products_name_len: 'Tên sản phẩm cần 2–150 ký tự.',
  rental_rates_product_duration_key: 'Đã có gói giá cho thời lượng này.',
  employees_code_key: 'Mã nhân viên đã tồn tại.',
  employees_code_fmt: 'Mã nhân viên chỉ gồm chữ in hoa, số, gạch ngang (2–24 ký tự).',
  staff_accounts_login_phone_key: 'Số điện thoại đăng nhập đã được dùng.',
  staff_accounts_employee_key: 'Nhân viên này đã có tài khoản.',
  pay_rates_employee_date_key: 'Đã có mức lương hiệu lực từ ngày này.',
  payments_manual_reference_uidx: CODE_MESSAGES.DUPLICATE_REFERENCE,
  inventory_on_hand_non_negative: CODE_MESSAGES.INSUFFICIENT_STOCK,
  customers_phone_fmt: CODE_MESSAGES.INVALID_PHONE,
};

interface ErrorShape {
  message?: unknown;
  details?: unknown;
  code?: unknown;
}

function asShape(err: unknown): ErrorShape | null {
  return typeof err === 'object' && err !== null ? (err as ErrorShape) : null;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Lấy mã lỗi nghiệp vụ (vd. 'SLOT_TAKEN') nếu có. */
export function errorCode(err: unknown): string | null {
  const message = str(asShape(err)?.message).trim();
  const head = message.split(/[\s:]/)[0] ?? '';
  return /^[A-Z][A-Z0-9_]{2,}$/.test(head) ? head : null;
}

export function toUserMessage(err: unknown, fallback = 'Có lỗi xảy ra. Vui lòng thử lại.'): string {
  const shape = asShape(err);
  if (!shape) return fallback;
  const message = str(shape.message);
  const details = str(shape.details);
  const pgCode = str(shape.code);

  const code = errorCode(err);
  if (code && CODE_MESSAGES[code]) {
    if (code === 'BRANCH_NOT_READY' && details) {
      const reasons = details
        .split(',')
        .map((d) => DETAIL_MESSAGES[d.trim()])
        .filter((d): d is string => Boolean(d));
      if (reasons.length > 0) return `${CODE_MESSAGES[code]} (${reasons.join(', ')})`;
    }
    return CODE_MESSAGES[code];
  }

  for (const [constraint, text] of Object.entries(CONSTRAINT_MESSAGES)) {
    if (message.includes(`"${constraint}"`) || details.includes(constraint)) return text;
  }

  if (pgCode === '42501' || message.includes('row-level security') || message.includes('permission denied')) {
    return CODE_MESSAGES.PERMISSION_DENIED;
  }
  if (pgCode === '23505') return 'Dữ liệu bị trùng với bản ghi đã có.';
  if (pgCode === '23514') return 'Dữ liệu không thỏa điều kiện hợp lệ.';
  if (pgCode === '23503') return 'Dữ liệu tham chiếu không tồn tại hoặc đang được sử dụng.';
  if (message.includes('Failed to fetch') || message.includes('fetch failed')) {
    return 'Không kết nối được máy chủ dữ liệu. Kiểm tra mạng rồi thử lại.';
  }
  return fallback;
}
