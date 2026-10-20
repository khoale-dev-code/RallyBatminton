import {
  ArrowRight,
  BadgeCheck,
  Bike,
  CalendarClock,
  Car,
  CupSoda,
  Fan,
  Gift,
  Lock,
  Package,
  ShowerHead,
  Sparkles,
  UserRoundCheck,
  Wifi,
  type LucideIcon,
} from 'lucide-react';
import { type Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { LoadErrorNotice, SetupNotice } from '@/components/layout/setup-notice';
import { CountUp } from '@/components/motion/count-up';
import { CourtDraw } from '@/components/motion/court-draw';
import { Marquee } from '@/components/motion/marquee';
import { Parallax } from '@/components/motion/parallax';
import { Reveal } from '@/components/motion/reveal';
import { SplitHeading } from '@/components/motion/split-heading';
import { buttonClass } from '@/components/ui/button';
import { BranchMapExplorer } from '@/features/about/components/branch-map-explorer';
import { ShuttleFly } from '@/features/about/components/shuttle-fly';
import { getAboutData } from '@/features/about/queries';
import { getBrandInfo } from '@/features/brand/queries';
import { cn } from '@/lib/cn';
import { formatPhone, formatVnd } from '@/lib/format';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Giới thiệu',
  description: 'Rally Badminton — hệ thống sân cầu lông: câu chuyện, tiện ích, địa chỉ và bản đồ từng chi nhánh.',
};

const AMENITY_ICON: Record<string, LucideIcon> = {
  bike: Bike,
  car: Car,
  fan: Fan,
  'shower-head': ShowerHead,
  lock: Lock,
  'cup-soda': CupSoda,
  package: Package,
  wifi: Wifi,
};

const PROMISES = [
  {
    icon: CalendarClock,
    tone: 'bg-court text-on-court',
    title: 'Giờ trống thật, theo từng sân',
    text: 'Lịch cập nhật trực tiếp. Thấy trống là giữ được — không gọi điện hỏi qua lại.',
  },
  {
    icon: BadgeCheck,
    tone: 'bg-ink text-paper',
    title: 'Giá rõ trước khi giữ sân',
    text: 'Bảng giá theo khung giờ, tiền cọc và chính sách hủy hiện ngay khi bạn chọn giờ.',
  },
  {
    icon: UserRoundCheck,
    tone: 'bg-paper text-ink ring-1 ring-line',
    title: 'Không cần tài khoản',
    text: 'Chỉ cần tên và số điện thoại. Muốn xem mọi đơn, tích điểm thì đăng ký thành viên.',
  },
  {
    icon: Gift,
    tone: 'bg-shuttle text-paper',
    title: 'Chơi nhiều, nhận nhiều',
    text: 'Thành viên tích 1 điểm cho mỗi 10.000đ tiền sân, lên hạng Bạc, Vàng, Kim cương.',
  },
];

export default async function AboutPage() {
  const [result, brand] = await Promise.all([getAboutData(), getBrandInfo()]);
  const data = result.ok ? result.data : null;
  const totals = data?.totals;

  return (
    <>
      {/* HERO ------------------------------------------------------------------ */}
      <section aria-labelledby="about-title" className="full-bleed relative isolate overflow-hidden bg-ink text-paper">
        <Parallax className="absolute inset-0 -z-20" amount={22}>
          <div data-parallax className="absolute -inset-y-[12%] inset-x-0">
            <Image src="/images/hero-court.webp" alt="" fill priority sizes="100vw" className="object-cover object-[50%_65%]" />
          </div>
        </Parallax>
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(0_0_0/0.55)_0%,rgb(0_0_0/0.72)_55%,rgb(0_0_0/0.95)_100%)] lg:bg-[linear-gradient(90deg,rgb(0_0_0/0.92)_0%,rgb(0_0_0/0.7)_45%,rgb(0_0_0/0.25)_100%)]"
        />
        <div className="mx-auto flex min-h-[78svh] max-w-7xl flex-col justify-end gap-6 px-4 pt-24 pb-14 sm:px-6 lg:min-h-[86svh] lg:pb-20">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-paper/10 px-3 py-1 text-xs font-semibold tracking-wide uppercase ring-1 ring-paper/25 backdrop-blur-sm">
            <span aria-hidden className="size-2 rounded-full bg-shuttle" />
            Về {brand.name}
          </span>
          <SplitHeading
            as="h1"
            id="about-title"
            className="max-w-4xl text-[3rem] leading-[0.98] font-semibold sm:text-7xl lg:text-[6.5rem]"
          >
            Mỗi pha cầu <span className="text-court">đều đáng nhớ.</span>
          </SplitHeading>
          <p className="max-w-xl text-paper/80 sm:text-lg">
            {brand.name} là hệ thống sân cầu lông dành cho mọi người — từ buổi đánh vui cùng bạn bè đến những trận đấu nghiêm túc. Đặt sân
            trong một phút, tới là chơi.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/booking" className={buttonClass('brand', 'lg')}>
              Đặt sân ngay
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <a
              href="#ban-do"
              className={buttonClass('outline', 'lg', 'border-paper/30 bg-transparent text-paper hover:border-paper hover:bg-paper/10')}
            >
              Xem bản đồ chi nhánh
            </a>
          </div>
        </div>
        <Marquee
          className="border-y border-ink bg-court py-3 font-display text-2xl tracking-wide text-on-court uppercase sm:text-3xl"
          items={['Smash', 'Drop shot', 'Clear', 'Net kill', 'Rally', 'Đặt sân 1 phút', 'Chơi hết mình']}
        />
      </section>

      {/* CÂU CHUYỆN ---------------------------------------------------------- */}
      <section
        aria-labelledby="story-title"
        className="grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] lg:gap-16"
      >
        <div className="flex flex-col gap-5">
          <p className="font-display text-sm tracking-[0.3em] text-court-strong uppercase">Câu chuyện của chúng tôi</p>
          <SplitHeading id="story-title" onScroll className="text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
            Sân tốt, đặt dễ, <span className="text-shuttle">chơi vui.</span>
          </SplitHeading>
          <Reveal className="flex flex-col gap-4 text-[1.02rem] leading-relaxed text-muted">
            <p data-reveal>
              Chúng tôi tin một buổi cầu lông trọn vẹn bắt đầu từ trước khi bước vào sân: biết chắc còn sân, biết rõ giá, không phải chờ ai
              bắt máy. Vì vậy mọi chi nhánh {brand.name} đều mở lịch trống trực tuyến và giữ chỗ ngay lập tức.
            </p>
            <p data-reveal>
              Tại sân, bạn có sẵn nước uống, cầu, quấn cán và vợt, giày cho thuê nếu lỡ quên đồ. Thành viên được lưu lịch sử đặt sân và tích
              điểm sau mỗi trận.
            </p>
          </Reveal>
        </div>
        <div className="relative mx-auto w-full max-w-sm lg:max-w-none">
          <div className="relative rounded-[1.75rem] bg-hall-dark p-8 text-court shadow-lift sm:p-10">
            <CourtDraw className="mx-auto h-[26rem] w-auto sm:h-[30rem]" strokeWidth={3} />
            <span className="absolute top-6 right-6 rounded-full bg-paper px-3 py-1 text-xs font-semibold text-ink">13,4 × 6,1 m</span>
          </div>
          {totals && totals.courts > 0 && (
            <div className="absolute -bottom-6 -left-2 rounded-[1.1rem] bg-court p-4 text-on-court shadow-lift sm:-left-8 sm:p-5">
              <p className="font-display text-5xl leading-none tabular">
                <CountUp value={totals.courts} />
              </p>
              <p className="text-sm font-medium">sân đang phục vụ</p>
            </div>
          )}
        </div>
      </section>

      {/* SỐ LIỆU -------------------------------------------------------------- */}
      {totals && totals.branches > 0 && (
        <section aria-label="Rally qua những con số" className="full-bleed bg-hall">
          <Reveal className="mx-auto grid max-w-7xl grid-cols-2 gap-px overflow-hidden px-4 py-12 sm:px-6 lg:grid-cols-4 lg:py-16">
            {[
              { value: totals.branches, label: 'chi nhánh', suffix: '' },
              { value: totals.courts, label: 'sân thi đấu', suffix: '' },
              { value: totals.openHours, label: 'giờ mở cửa mỗi ngày', suffix: 'h' },
              { value: data?.amenities.length ?? 0, label: 'tiện ích tại sân', suffix: '+' },
            ].map((s, i) => (
              <div key={s.label} data-reveal className={cn('flex flex-col gap-1 px-2 py-4 sm:px-6', i > 0 && 'lg:border-l lg:border-line')}>
                <span className="font-display text-6xl leading-none text-ink tabular sm:text-7xl">
                  <CountUp value={s.value} suffix={s.suffix} />
                </span>
                <span className="text-sm text-muted sm:text-base">{s.label}</span>
              </div>
            ))}
          </Reveal>
        </section>
      )}

      {/* CAM KẾT ------------------------------------------------------------- */}
      <section aria-labelledby="promise-title" className="py-16 sm:py-24">
        <div className="mb-8 flex flex-col gap-3 sm:mb-10 lg:flex-row lg:items-end lg:justify-between">
          <SplitHeading id="promise-title" onScroll className="max-w-2xl text-4xl leading-tight sm:text-5xl">
            Điều bạn luôn nhận được ở Rally
          </SplitHeading>
          {totals?.minPrice != null && (
            <p className="text-muted">
              Giá sân từ <span className="font-display text-2xl text-shuttle-deep tabular">{formatVnd(totals.minPrice)}</span>/giờ
            </p>
          )}
        </div>
        <Reveal className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROMISES.map((p, i) => (
            <article
              key={p.title}
              data-reveal
              className="group relative flex flex-col gap-4 overflow-hidden rounded-[1.25rem] border border-line bg-paper p-6 transition-shadow hover:shadow-lift"
            >
              <span
                aria-hidden
                className="absolute -top-4 -right-1 font-display text-8xl leading-none text-hall transition-colors group-hover:text-court-soft"
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className={cn('relative grid size-12 place-items-center rounded-full', p.tone)}>
                <p.icon className="size-5" aria-hidden />
              </span>
              <h3 className="relative text-xl leading-snug">{p.title}</h3>
              <p className="relative text-sm leading-relaxed text-muted">{p.text}</p>
            </article>
          ))}
        </Reveal>
      </section>

      {/* TIỆN ÍCH ------------------------------------------------------------ */}
      {data && data.amenities.length > 0 && (
        <section aria-labelledby="amenity-title" className="full-bleed overflow-hidden bg-ink text-paper">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:py-24">
            <div className="flex flex-col gap-4">
              <p className="font-display text-sm tracking-[0.3em] text-court uppercase">Tiện ích</p>
              <SplitHeading id="amenity-title" onScroll className="text-4xl leading-tight sm:text-5xl">
                Đủ đầy để bạn chỉ việc chơi.
              </SplitHeading>
              <p className="text-paper/70">Tiện ích có thể khác nhau giữa các chi nhánh — xem chi tiết ở trang từng chi nhánh.</p>
            </div>
            <Reveal className="grid grid-cols-2 gap-3 sm:grid-cols-3" stagger={0.06}>
              {data.amenities.map((a) => {
                const Icon = (a.icon && AMENITY_ICON[a.icon]) || Sparkles;
                return (
                  <div
                    key={a.code}
                    data-reveal
                    className="flex flex-col gap-3 rounded-[1.1rem] bg-paper/5 p-4 ring-1 ring-paper/10 transition-colors hover:bg-court hover:text-on-court"
                  >
                    <Icon className="size-6" aria-hidden />
                    <span className="font-medium leading-snug">{a.label}</span>
                    {data.branches.length > 1 && (
                      <span className="text-xs opacity-70">
                        {a.branchCount === data.branches.length ? 'Mọi chi nhánh' : `${a.branchCount}/${data.branches.length} chi nhánh`}
                      </span>
                    )}
                  </div>
                );
              })}
            </Reveal>
          </div>
        </section>
      )}

      {/* BẢN ĐỒ --------------------------------------------------------------- */}
      <section id="ban-do" aria-labelledby="map-title" className="scroll-mt-20 pt-16 sm:pt-24">
        <div className="mb-6 flex flex-col gap-3 sm:mb-8">
          <p className="font-display text-sm tracking-[0.3em] text-court-strong uppercase">Địa chỉ</p>
          <SplitHeading id="map-title" onScroll className="text-4xl leading-tight sm:text-5xl">
            Tìm sân gần bạn
          </SplitHeading>
        </div>
        {!result.ok && result.reason === 'not_configured' && <SetupNotice />}
        {!result.ok && result.reason === 'error' && <LoadErrorNotice />}
        {data && data.branches.length > 0 && <BranchMapExplorer branches={data.branches} />}
        {data && data.branches.length > 1 && (
          <Reveal className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.branches.map((b) => (
              <Link
                key={b.id}
                data-reveal
                href={`/branches/${b.slug}`}
                className="group flex min-w-0 items-start justify-between gap-3 rounded-panel border border-line bg-paper p-4 transition-colors hover:border-ink/40"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="font-display text-xl">{b.name}</span>
                  <span className="text-sm text-muted">{b.address}</span>
                  {b.amenities.length > 0 && <span className="mt-1 truncate text-xs text-muted">{b.amenities.join(' · ')}</span>}
                </span>
                <ArrowRight
                  className="mt-1 size-5 shrink-0 text-muted transition-transform group-hover:translate-x-1 group-hover:text-ink"
                  aria-hidden
                />
              </Link>
            ))}
          </Reveal>
        )}
      </section>

      {/* KẾT -------------------------------------------------------------------- */}
      <section aria-labelledby="cta-title" className="pt-10 sm:pt-16">
        <ShuttleFly />
        <div className="relative isolate flex flex-col items-start gap-6 overflow-hidden rounded-[1.75rem] bg-court p-7 text-on-court sm:p-12 lg:flex-row lg:items-end lg:justify-between">
          <CourtDraw className="absolute -top-24 -right-10 -z-10 h-[150%] rotate-90 text-ink/10" />
          <div className="flex flex-col gap-3">
            <SplitHeading id="cta-title" onScroll className="text-5xl leading-[0.95] sm:text-7xl">
              Hẹn bạn trên sân.
            </SplitHeading>
            <p className="max-w-md text-ink/75">
              Giữ sân trong một phút, không cần tài khoản.
              {brand.hotline && (
                <>
                  {' '}
                  Cần hỗ trợ? Gọi{' '}
                  <a href={`tel:${brand.hotline}`} className="font-semibold underline underline-offset-4">
                    {formatPhone(brand.hotline)}
                  </a>
                  .
                </>
              )}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Link href="/booking" className={buttonClass('primary', 'lg')}>
              Đặt sân ngay
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link href="/register" className={buttonClass('outline', 'lg', 'border-ink/25 bg-paper/90')}>
              Đăng ký thành viên
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
