import { Notice } from '@/components/ui/notice';

/** Hiển thị khi chưa điền .env.local — giúp chạy thử dự án lần đầu không bị lỗi trắng trang. */
export function SetupNotice() {
  return (
    <Notice tone="warning" title="Chưa kết nối Supabase">
      Sao chép <code>.env.example</code> thành <code>.env.local</code>, điền <code>NEXT_PUBLIC_SUPABASE_URL</code> và khóa, chạy các file
      trong <code>supabase/sql</code> rồi khởi động lại <code>npm run dev</code>. Xem README.md.
    </Notice>
  );
}

export function LoadErrorNotice() {
  return (
    <Notice tone="error" title="Không tải được dữ liệu">
      Máy chủ dữ liệu đang không phản hồi. Vui lòng tải lại trang sau ít phút.
    </Notice>
  );
}
