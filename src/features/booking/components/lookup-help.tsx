import { ArrowRight, Phone, RotateCcw, Smartphone, Ticket } from 'lucide-react';
import Link from 'next/link';

import { buttonClass } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { formatPhone } from '@/lib/format';

const TIPS = [
  {
    icon: Smartphone,
    tone: 'bg-court text-on-court',
    title: 'Quên mã đơn?',
    text: 'Chọn tab Số điện thoại: xem các sân đã đặt hôm nay, sắp tới và lịch sử bằng đúng số đã dùng khi đặt.',
  },
  {
    icon: Ticket,
    tone: 'bg-ink text-paper',
    title: 'Thông tin được giữ kín',
    text: 'Tìm bằng số điện thoại chỉ thấy mã đơn che bớt. Muốn xem đầy đủ hoặc hủy đơn, nhập họ tên người đặt (hoặc mã đơn RB-…).',
  },
  {
    icon: RotateCcw,
    tone: 'bg-shuttle text-paper',
    title: 'Tự hủy trước giờ chơi',
    text: 'Đơn đang giữ chỗ hoặc đã xác nhận có thể tự hủy trước giờ bắt đầu. Tiền cọc hoàn theo chính sách chi nhánh.',
  },
];

/** Hướng dẫn hiển thị khi khách chưa tra cứu đơn nào. */
export function LookupHelp({ hotline }: { hotline: string | null }) {
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="lookup-help-title" className="flex flex-col gap-5">
        <h2 id="lookup-help-title" className="text-2xl sm:text-3xl">
          Cần biết trước khi tra cứu
        </h2>
        <ol className="grid gap-3 sm:gap-4 md:grid-cols-3">
          {TIPS.map((tip, i) => (
            <li key={tip.title} className="relative flex gap-4 overflow-hidden rounded-panel border border-line bg-paper p-5 md:flex-col">
              <span
                aria-hidden
                className="pointer-events-none absolute -top-3 right-3 hidden font-display text-7xl leading-none text-hall select-none md:block"
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className={cn('relative grid size-12 shrink-0 place-items-center rounded-full', tip.tone)}>
                <tip.icon className="size-5" aria-hidden />
              </span>
              <span className="relative flex flex-col gap-1">
                <span className="font-semibold">{tip.title}</span>
                <span className="text-sm leading-relaxed text-muted">{tip.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-label="Chưa có đơn đặt sân"
        className="relative isolate flex flex-col gap-5 overflow-hidden rounded-[1.25rem] bg-court p-6 text-on-court sm:p-8 md:flex-row md:items-center md:justify-between"
      >
        <svg aria-hidden viewBox="0 0 400 200" className="absolute top-0 right-0 -z-10 h-full w-auto text-ink opacity-[0.08]">
          <rect x="40" y="20" width="340" height="160" fill="none" stroke="currentColor" strokeWidth="4" />
          <path d="M210 20 V180 M40 100 H380 M120 20 V180 M300 20 V180" stroke="currentColor" strokeWidth="3" fill="none" />
        </svg>
        <div className="flex flex-col gap-1.5">
          <p className="font-display text-3xl leading-tight sm:text-4xl">Chưa có đơn nào?</p>
          <p className="max-w-md text-[0.95rem] text-ink/80">
            Xem giờ trống ở mọi chi nhánh và giữ sân chỉ trong một phút, không cần tài khoản.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row md:shrink-0">
          <Link href="/booking" className={buttonClass('primary', 'lg')}>
            Đặt sân ngay
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          {hotline && (
            <a href={`tel:${hotline}`} className={buttonClass('outline', 'lg', 'border-ink/25 bg-paper/90')}>
              <Phone className="size-4" aria-hidden />
              {formatPhone(hotline)}
            </a>
          )}
        </div>
      </section>
    </div>
  );
}
