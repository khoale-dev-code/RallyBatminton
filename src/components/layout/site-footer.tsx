import { Mail, MapPin, Phone } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode } from 'react';

import { Wordmark } from '@/components/brand/logo';
import { getBrandInfo } from '@/features/brand/queries';
import { DATA_REQUEST_HREF, LEGAL_CODES, LEGAL_PAGES, legalHref } from '@/features/privacy/consent-text';
import { getLegalValues } from '@/features/privacy/queries';
import { formatPhone } from '@/lib/format';

const COLUMNS: Array<{ title: string; links: Array<{ href: string; label: string }> }> = [
  {
    title: 'Về chúng tôi',
    links: [
      { href: '/about', label: 'Giới thiệu' },
      { href: '/branches', label: 'Chi nhánh' },
      { href: '/#cach-dat', label: 'Cách đặt sân' },
    ],
  },
  {
    title: 'Dịch vụ',
    links: [
      { href: '/booking', label: 'Đặt sân' },
      { href: '/products', label: 'Vật phẩm' },
      { href: '/rentals', label: 'Thuê thiết bị' },
    ],
  },
  {
    title: 'Hỗ trợ',
    links: [
      { href: '/#cach-dat', label: 'Hướng dẫn đặt sân' },
      { href: '/guide', label: 'Cẩm nang cầu lông' },
      { href: '/booking/lookup', label: 'Tra cứu đơn' },
      { href: '/register', label: 'Đăng ký thành viên' },
    ],
  },
];

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4 fill-current">
      <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8v3h2.6V21h2.9Z" />
    </svg>
  );
}

function SocialLink({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="grid size-9 place-items-center rounded-full border border-line text-ink transition-colors hover:border-court-strong hover:bg-court-soft hover:text-court-deep"
    >
      {children}
    </a>
  );
}

export async function SiteFooter() {
  const [brand, legal] = await Promise.all([getBrandInfo(), getLegalValues()]);
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-line bg-paper sm:mt-20">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-8 px-4 py-10 sm:px-6 md:grid-cols-4 lg:grid-cols-[1.6fr_1fr_1fr_1fr_1.4fr]">
        <div className="col-span-2 flex flex-col gap-3 md:col-span-4 lg:col-span-1">
          <Link href="/" className="inline-flex w-fit items-center gap-3" aria-label={`${brand.name} — trang chủ`}>
            <Wordmark className="h-11" />
            <span className="font-display text-sm font-semibold tracking-[0.3em] text-court-strong uppercase">Badminton</span>
          </Link>
          <p className="max-w-xs text-sm text-muted">Sân cầu lông cho mọi người. Chơi nhiều hơn, kết nối nhiều hơn.</p>
          {(brand.facebookUrl ?? brand.zaloUrl) && (
            <div className="mt-1 flex items-center gap-2">
              {brand.facebookUrl && (
                <SocialLink href={brand.facebookUrl} label="Facebook">
                  <FacebookIcon />
                </SocialLink>
              )}
              {brand.zaloUrl && (
                <SocialLink href={brand.zaloUrl} label="Zalo">
                  <span className="text-[0.6rem] font-bold tracking-tight">Zalo</span>
                </SocialLink>
              )}
            </div>
          )}
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title} className="flex flex-col gap-2.5 text-sm">
            <span className="font-semibold">{col.title}</span>
            {col.links.map((l) => (
              <Link key={l.label} href={l.href} className="w-fit text-muted transition-colors hover:text-ink">
                {l.label}
              </Link>
            ))}
          </nav>
        ))}
        <div className="flex flex-col gap-2.5 text-sm">
          <span className="font-semibold">Liên hệ</span>
          {brand.hotline && (
            <a href={`tel:${brand.hotline}`} className="inline-flex w-fit items-center gap-2 text-muted hover:text-ink">
              <Phone className="size-4 shrink-0" aria-hidden />
              <span className="tabular">{formatPhone(brand.hotline)}</span>
            </a>
          )}
          {brand.email && (
            <a href={`mailto:${brand.email}`} className="inline-flex w-fit items-center gap-2 break-all text-muted hover:text-ink">
              <Mail className="size-4 shrink-0" aria-hidden />
              {brand.email}
            </a>
          )}
          {brand.addressLine && (
            <span className="inline-flex items-start gap-2 text-muted">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
              {brand.addressLine}
            </span>
          )}
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 text-xs text-muted sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-1">
            <p>
              © {year} {brand.name}. Đặt sân trực tuyến không cần tài khoản.
            </p>
            {(legal.ten_phap_ly ?? legal.ma_so_thue) && (
              <p>
                {legal.ten_phap_ly}
                {legal.ten_phap_ly && legal.ma_so_thue ? ' · ' : ''}
                {legal.ma_so_thue ? `MST ${legal.ma_so_thue}` : ''}
              </p>
            )}
          </div>
          <nav aria-label="Chính sách và điều khoản" className="flex flex-wrap gap-x-4 gap-y-1.5">
            {LEGAL_CODES.map((code) => (
              <Link key={code} href={legalHref(code)} className="hover:text-ink hover:underline">
                {LEGAL_PAGES[code].short}
              </Link>
            ))}
            <Link href={DATA_REQUEST_HREF} className="font-medium text-court-deep hover:underline">
              Yêu cầu về dữ liệu cá nhân
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
