import { Phone } from 'lucide-react';
import { type Metadata } from 'next';
import Link from 'next/link';

import { ForgotPasswordForm } from '@/features/member/components/auth-forms';
import { getBrandInfo } from '@/features/brand/queries';
import { formatPhone } from '@/lib/format';

export const metadata: Metadata = { title: 'Quên mật khẩu', robots: { index: false } };

export default async function ForgotPasswordPage() {
  const brand = await getBrandInfo();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl sm:text-5xl">Quên mật khẩu</h1>
        <p className="text-muted">Nhập email hoặc số điện thoại đã đăng ký. Chúng tôi gửi liên kết đặt lại mật khẩu tới email của bạn.</p>
      </div>
      <ForgotPasswordForm />
      <div className="flex gap-3 rounded-panel border border-line p-4 text-sm">
        <Phone className="mt-0.5 size-5 shrink-0 text-court-deep" aria-hidden />
        <p className="text-muted">
          Tài khoản chỉ đăng ký bằng <strong className="font-semibold text-ink">số điện thoại</strong>? Gọi hotline
          {brand.hotline && (
            <>
              {' '}
              <a href={`tel:${brand.hotline}`} className="font-semibold text-ink underline-offset-4 hover:underline">
                {formatPhone(brand.hotline)}
              </a>
            </>
          )}{' '}
          hoặc đến quầy bất kỳ chi nhánh để được cấp mật khẩu tạm.
        </p>
      </div>
      <Link href="/login" className="text-center text-sm font-semibold text-court-deep hover:underline">
        Quay lại đăng nhập
      </Link>
    </div>
  );
}
