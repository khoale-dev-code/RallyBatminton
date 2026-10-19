import { ArrowRight, CalendarCheck2, CalendarDays, CircleCheckBig, MapPin, MapPinned, UserRoundCheck, Zap } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { LoadErrorNotice, SetupNotice } from '@/components/layout/setup-notice';
import { EmptyState } from '@/components/ui/primitives';
import { BranchCarousel } from '@/features/home/components/branch-carousel';
import { QuickSearch } from '@/features/home/components/quick-search';
import { getHomeBranches } from '@/features/home/queries';
import { cn } from '@/lib/cn';
import { formatVnd } from '@/lib/format';

export const revalidate = 60;

const FEATURES = [
  { icon: Zap, title: 'Đặt sân nhanh', text: 'Chỉ khoảng 1 phút' },
  { icon: CalendarDays, title: 'Xem lịch trực tiếp', text: 'Giờ trống cập nhật liên tục' },
  { icon: MapPinned, title: 'Nhiều chi nhánh', text: 'Chọn nơi gần bạn nhất' },
  { icon: UserRoundCheck, title: 'Không cần tài khoản', text: 'Chỉ cần tên và số điện thoại' },
];

const STEPS = [
  {
    icon: MapPin,
    tone: 'bg-court-soft text-court-deep',
    title: 'Chọn chi nhánh',
    text: 'Xem địa chỉ, vị trí sân và bảng giá theo khung giờ.',
  },
  {
    icon: CalendarCheck2,
    tone: 'bg-shuttle-soft text-shuttle-deep',
    title: 'Chọn sân và giờ',
    text: 'Lịch trống cập nhật trực tiếp, chạm giờ bắt đầu và kết thúc.',
  },
  {
    icon: CircleCheckBig,
    tone: 'bg-court-soft text-court-deep',
    title: 'Giữ sân',
    text: 'Nhập tên, số điện thoại. Chi nhánh xác nhận và bạn sẵn sàng ra sân.',
  },
];

const COUNTER = [
  {
    href: '/products',
    title: 'Đồ uống & vật phẩm',
    text: 'Nước, nước điện giải, cầu, quấn cán và phụ kiện — giá và tình trạng còn hàng ở từng chi nhánh.',
    image: '/images/counter-drinks.webp',
  },
  {
    href: '/rentals',
    title: 'Thuê vợt, giày',
    text: 'Quên đồ? Thuê ngay tại quầy: theo giờ, hết trận hoặc mang về, có combo vợt + giày.',
    image: '/images/counter-rentals.webp',
  },
  {
    href: '/branches',
    title: 'Dịch vụ & tiện ích',
    text: 'Bãi giữ xe, tủ đồ, phòng tắm, máy lạnh, khu nghỉ ngơi — xem theo từng chi nhánh.',
    image: '/images/counter-amenities.webp',
  },
];

export default async function HomePage() {
  const result = await getHomeBranches(new Date());
  const branches = result.ok ? result.data : [];
  const minPrice = branches.reduce<number | null>(
    (min, b) => (b.minPrice !== null && (min === null || b.minPrice < min) ? b.minPrice : min),
    null,
  );

  return (
    <>
      {/* HERO -------------------------------------------------------------- */}
      <section id="dat-san" aria-labelledby="hero-title" className="full-bleed relative isolate overflow-hidden bg-hall-dark">
        <Image src="/images/hero-court.webp" alt="" fill priority sizes="100vw" className="-z-20 object-cover object-[55%_78%]" />
        {/* Lớp phủ xanh đậm phía trái/dưới để chữ trắng luôn đọc rõ trên ảnh */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(4_24_15/0.82)_0%,rgb(4_24_15/0.62)_45%,rgb(4_24_15/0.88)_100%)] md:bg-[linear-gradient(90deg,rgb(4_24_15/0.9)_0%,rgb(4_24_15/0.74)_38%,rgb(4_24_15/0.2)_70%,rgb(4_24_15/0.05)_100%)]"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 -z-10 hidden h-48 bg-gradient-to-t from-[rgb(4_24_15/0.7)] to-transparent md:block"
        />
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pt-10 pb-8 sm:px-6 sm:pt-16 lg:pt-20 lg:pb-12">
          <div className="flex max-w-2xl flex-col gap-4 text-paper sm:gap-5">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-paper/12 px-3 py-1 text-[0.7rem] font-semibold tracking-wide text-paper uppercase ring-1 ring-paper/25 backdrop-blur-sm sm:text-xs">
              <Zap className="size-3.5 text-court" aria-hidden />
              Đặt sân online 24/7
            </span>
            <h1 id="hero-title" className="text-[2.6rem] leading-[1.08] font-semibold drop-shadow-sm sm:text-6xl lg:text-[4.5rem]">
              Đặt sân cầu lông
              <br />
              trong <span className="text-court">một phút.</span>
            </h1>
            <p className="max-w-lg text-[0.95rem] text-paper/85 sm:text-lg">
              Xem giờ trống tại mọi chi nhánh Rally, chọn sân và giữ chỗ ngay — không cần tạo tài khoản.
              {minPrice !== null && (
                <>
                  {' '}
                  Giá từ <span className="font-semibold text-paper tabular">{formatVnd(minPrice)}/giờ</span>.
                </>
              )}
            </p>
          </div>
          <QuickSearch
            className="mt-2 lg:mt-8"
            branches={branches.map((b) => ({ slug: b.slug, name: b.name, opensAt: b.opensAt, closesAt: b.closesAt }))}
          />
        </div>
      </section>

      {/* LỢI ÍCH ----------------------------------------------------------- */}
      <section aria-label="Vì sao đặt sân ở Rally" className="full-bleed border-b border-line bg-paper">
        <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-x-4 gap-y-5 px-4 py-6 sm:px-6 lg:grid-cols-4 lg:divide-x lg:divide-line lg:py-7">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex items-center gap-3 lg:px-6 lg:first:pl-0">
              <f.icon className="size-7 shrink-0 text-court-strong" aria-hidden strokeWidth={1.8} />
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold sm:text-[0.95rem]">{f.title}</span>
                <span className="text-xs text-muted sm:text-sm">{f.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* CHI NHÁNH --------------------------------------------------------- */}
      <section aria-labelledby="branches-title" className="pt-12 sm:pt-16">
        {!result.ok && result.reason === 'not_configured' && <SetupNotice />}
        {!result.ok && result.reason === 'error' && <LoadErrorNotice />}
        {result.ok && branches.length === 0 && (
          <EmptyState title="Chưa có chi nhánh mở đặt sân">
            Chi nhánh sẽ xuất hiện ở đây sau khi chủ sân công bố trong trang quản trị.
          </EmptyState>
        )}
        {branches.length > 0 && (
          <BranchCarousel
            branches={branches}
            heading={
              <h2 id="branches-title" className="text-2xl sm:text-3xl">
                Khám phá chi nhánh
              </h2>
            }
            action={
              <Link href="/branches" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
                Xem tất cả
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            }
          />
        )}
      </section>

      {/* 3 BƯỚC ------------------------------------------------------------- */}
      <section id="cach-dat" aria-labelledby="steps-title" className="scroll-mt-20 pt-12 sm:pt-16">
        <h2 id="steps-title" className="mb-5 text-2xl sm:text-3xl">
          Đặt sân trong ba bước
        </h2>
        <ol className="grid grid-cols-3 gap-2 sm:gap-4">
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              className="flex flex-col items-center gap-2 rounded-panel border border-line bg-paper p-3 text-center sm:p-4 lg:flex-row lg:items-start lg:gap-4 lg:p-5 lg:text-left"
            >
              <span className={cn('grid size-11 shrink-0 place-items-center rounded-full lg:size-14', s.tone)}>
                <s.icon className="size-5 lg:size-7" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="hidden font-display text-sm text-court-strong tabular sm:block">{String(i + 1).padStart(2, '0')}</span>
                <span className="text-xs leading-snug font-semibold sm:text-sm lg:text-base">{s.title}</span>
                <span className="hidden text-xs text-muted sm:block lg:text-sm">{s.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* TẠI QUẦY ----------------------------------------------------------- */}
      <section aria-labelledby="counter-title" className="pt-12 sm:pt-16">
        <h2 id="counter-title" className="mb-5 text-2xl sm:text-3xl">
          Tại quầy
        </h2>
        <ul className="grid grid-cols-3 gap-2 sm:gap-4">
          {COUNTER.map((c) => (
            <li key={c.title}>
              <Link
                href={c.href}
                className="group flex h-full flex-col overflow-hidden rounded-panel border border-line bg-paper transition-shadow hover:shadow-lift lg:flex-row lg:items-stretch"
              >
                <span className="relative order-1 aspect-[4/3] bg-[radial-gradient(circle_at_50%_60%,#ffffff_0%,var(--color-hall)_75%)] sm:aspect-[16/10] lg:order-2 lg:aspect-auto lg:min-h-44 lg:w-[46%] lg:shrink-0 lg:bg-none">
                  <Image
                    src={c.image}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 200px, 33vw"
                    className="object-contain p-2 transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none lg:p-3"
                  />
                </span>
                <span className="order-2 flex min-w-0 flex-1 flex-col justify-center gap-1 p-3 sm:p-4 lg:order-1 lg:p-5 lg:pr-0">
                  <span className="text-xs leading-snug font-semibold sm:text-sm lg:text-lg">{c.title}</span>
                  <span className="hidden text-xs text-muted sm:line-clamp-2 lg:line-clamp-3 lg:text-sm">{c.text}</span>
                  <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-court-strong sm:text-sm">
                    Xem chi tiết
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
