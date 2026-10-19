import { CourtArt } from '@/components/brand/court-art';
import { Logo } from '@/components/brand/logo';
import { LinkButton } from '@/components/ui/button';

export const metadata = { title: 'Không tìm thấy trang' };

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-6 px-5 py-12">
      <Logo />
      <CourtArt className="h-44 w-28 overflow-hidden rounded-panel" />
      <h1 className="text-4xl">Cầu ra ngoài biên rồi</h1>
      <p className="text-muted">
        Trang bạn tìm không tồn tại hoặc đã được chuyển. Kiểm tra lại đường dẫn, hoặc quay về trang chủ để đặt sân.
      </p>
      <div className="flex flex-wrap gap-2">
        <LinkButton href="/" variant="primary">
          Về trang chủ
        </LinkButton>
        <LinkButton href="/branches">Xem chi nhánh</LinkButton>
      </div>
    </main>
  );
}
