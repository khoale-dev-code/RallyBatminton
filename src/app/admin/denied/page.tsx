import { LinkButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/primitives';

export default function DeniedPage() {
  return (
    <EmptyState title="Bạn chưa có quyền xem trang này" action={<LinkButton href="/admin">Về tổng quan</LinkButton>}>
      Quyền được cấp theo từng chi nhánh. Đổi chi nhánh ở thanh bên hoặc liên hệ chủ sân để được cấp quyền.
    </EmptyState>
  );
}
