import { ArrowLeft, CalendarCheck2, Gift, History, Zap } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { type ReactNode } from 'react';

import { Logo } from '@/components/brand/logo';
import { MEMBER_TIERS } from '@/features/member/lib/tiers';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';

const PERKS = [
  { icon: History, text: 'Xem mọi đơn đã đặt — không cần nhớ mã đơn' },
  { icon: Zap, text: 'Đặt sân nhanh, thông tin tự điền sẵn' },
  { icon: Gift, text: 'Tích 1 điểm cho mỗi 10.000đ tiền sân' },
  { icon: CalendarCheck2, text: 'Tự hủy đơn ngay trong tài khoản' },
];

const TIER_DOT: Record<string, string> = {
  member: 'bg-court',
  silver: 'bg-[#c9d0d8]',
  gold: 'bg-[#e8b923]',
  diamond: 'bg-paper',
};

/** Khung trang tài khoản KHÁCH: đăng nhập, đăng ký, quên mật khẩu (tách khỏi đăng nhập quản trị). */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-5 py-5 sm:px-10">
        <div className="flex items-center justify-between gap-4">
          <Logo />
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink">
            <ArrowLeft className="size-4" aria-hidden />
            Về trang chủ
          </Link>
        </div>
        <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          {children}
        </main>
        <p className="text-center text-xs text-muted">
          Không muốn tạo tài khoản?{' '}
          <Link href="/booking" className="font-medium text-court-deep underline-offset-4 hover:underline">
            Đặt sân ngay với tư cách khách
          </Link>
        </p>
      </div>

      <aside aria-label="Quyền lợi thành viên" className="relative isolate hidden overflow-hidden bg-hall-dark text-paper lg:flex">
        <Image src="/images/hero-court.webp" alt="" fill priority sizes="50vw" className="-z-20 object-cover object-[55%_70%]" />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[linear-gradient(160deg,rgb(4_24_15/0.55)_0%,rgb(4_24_15/0.82)_55%,rgb(0_0_0/0.92)_100%)]"
        />
        <div className="mt-auto flex w-full flex-col gap-7 p-10 xl:p-14">
          <div className="flex flex-col gap-3">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-paper/10 px-3 py-1 text-xs font-semibold tracking-wide uppercase ring-1 ring-paper/20">
              <span aria-hidden className="size-2 rounded-full bg-shuttle" />
              Thành viên Rally
            </span>
            <p className="font-display text-5xl leading-[1.05] xl:text-6xl">
              Chơi nhiều hơn,
              <br />
              <span className="text-court">nhận nhiều hơn.</span>
            </p>
          </div>
          <ul className="grid gap-3 xl:grid-cols-2">
            {PERKS.map((p) => (
              <li key={p.text} className="flex items-center gap-3 text-[0.95rem] text-paper/90">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-court/20 text-court ring-1 ring-court/40">
                  <p.icon className="size-4" aria-hidden />
                </span>
                {p.text}
              </li>
            ))}
          </ul>
          <ol className="grid grid-cols-4 overflow-hidden rounded-panel bg-paper/8 ring-1 ring-paper/15 backdrop-blur-sm">
            {MEMBER_TIERS.map((t, i) => (
              <li key={t.tier} className={cn('flex flex-col gap-1 px-4 py-3', i > 0 && 'border-l border-paper/15')}>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                  <span aria-hidden className={cn('size-2.5 rounded-full', TIER_DOT[t.tier])} />
                  {t.label}
                </span>
                <span className="text-xs text-paper/65 tabular">{t.min === 0 ? 'Khi đăng ký' : `${formatNumber(t.min)} điểm`}</span>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </div>
  );
}
