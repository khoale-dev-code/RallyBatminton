/* Rally Home Refresh v1 | Tìm sân mới, giữ nguyên bookingHref và tham số đặt sân. */
'use client';

import { ArrowRight, CalendarDays, Clock3, MapPin, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { addDays, dateKeyInZone, DEFAULT_TZ, minutesToTime, zonedParts } from '@/lib/time';
import { bookingHref } from '@/features/booking/lib/links';

export interface SearchBranch {
  slug: string;
  name: string;
  opensAt: string;
  closesAt: string;
}

const subscribe = () => () => undefined;

const fieldClass =
  'h-12 w-full appearance-none rounded-xl border border-[#dfe7df] bg-[#f8faf7] pr-9 pl-11 text-sm font-medium text-[#183322] outline-none transition-all hover:border-[#bdd9c0] focus-visible:border-[#168346] focus-visible:ring-2 focus-visible:ring-[#bce3bd] sm:h-13';

function Field({ label, icon, children }: { label: string; icon: ReactNode; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="text-xs font-semibold text-[#526557]">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[#548062]">{icon}</span>
        {children(id)}
      </div>
    </div>
  );
}

/** Chọn chi nhánh, ngày và giờ rồi chuyển đến lịch đặt sân đang hoạt động. */
export function QuickSearch({ branches, className }: { branches: SearchBranch[]; className?: string }) {
  const router = useRouter();
  const today = useSyncExternalStore(subscribe, () => dateKeyInZone(new Date(), DEFAULT_TZ), () => '');
  const nextHour = useSyncExternalStore(subscribe, () => Math.min(22, zonedParts(new Date(), DEFAULT_TZ).hour + 1), () => 17);
  const [slug, setSlug] = useState(branches.length === 1 ? (branches[0]?.slug ?? '') : '');
  const [date, setDate] = useState('');
  const [hour, setHour] = useState<number | null>(null);

  const branch = branches.find((item) => item.slug === slug);
  const openHour = Math.ceil(Number((branch?.opensAt ?? '05:00').slice(0, 2)));
  const closeHour = Number((branch?.closesAt ?? '23:00').slice(0, 2)) || 24;
  const hours = Array.from({ length: Math.max(0, closeHour - openHour) }, (_, index) => openHour + index);
  const pickedDate = date || today;
  const pickedHour = hour !== null && hours.includes(hour) ? hour : Math.max(openHour, Math.min(nextHour, closeHour - 1));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const time = minutesToTime(pickedHour * 60);
    if (slug) {
      router.push(bookingHref(slug, { date: pickedDate, time }));
      return;
    }
    // Chưa chọn chi nhánh: xem danh sách chi nhánh, giữ nguyên ngày và giờ đã lọc.
    const params = new URLSearchParams({ time });
    if (pickedDate) params.set('date', pickedDate);
    router.push(`/branches?${params.toString()}`);
  }

  return (
    <div className={cn('rally-home-search overflow-hidden rounded-[1.5rem] border border-[#e6ece6] bg-white shadow-[0_28px_65px_-24px_rgba(6,42,24,0.3)]', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf1ed] px-4 py-3 sm:px-6">
        <nav aria-label="Dịch vụ nhanh" className="flex flex-wrap gap-1.5 text-xs font-semibold sm:text-sm">
          <span aria-current="page" className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-[#167e40] px-4 text-white">
            <Search className="size-3.5" aria-hidden /> Đặt sân
          </span>
          <Link href="/booking/lookup" className="inline-flex min-h-9 items-center rounded-lg px-3.5 text-[#5d6d61] transition-colors hover:bg-[#eef6ec] hover:text-[#186b3d]">Tra cứu đơn</Link>
          <Link href="/rentals" className="inline-flex min-h-9 items-center rounded-lg px-3.5 text-[#5d6d61] transition-colors hover:bg-[#eef6ec] hover:text-[#186b3d]">Thuê dụng cụ</Link>
          <Link href="/products" className="inline-flex min-h-9 items-center rounded-lg px-3.5 text-[#5d6d61] transition-colors hover:bg-[#eef6ec] hover:text-[#186b3d]">Vật phẩm</Link>
        </nav>
        <span className="hidden items-center gap-1.5 text-xs text-[#5d7062] lg:inline-flex">
          <span className="size-1.5 rounded-full bg-[#39b96b]" /> Tìm sân phù hợp với bạn
        </span>
      </div>

      <form onSubmit={submit} aria-label="Tìm giờ trống" className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-[1.25fr_1fr_1fr_auto] lg:items-end lg:gap-5">
        <div className="sm:col-span-2 lg:col-span-1">
          <Field label="Chi nhánh" icon={<MapPin className="size-4" aria-hidden />}>
            {(id) => (
              <select id={id} value={slug} onChange={(event) => { setSlug(event.target.value); setHour(null); }} className={fieldClass}>
                <option value="">Tất cả chi nhánh Rally</option>
                {branches.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
              </select>
            )}
          </Field>
        </div>
        <Field label="Ngày muốn chơi" icon={<CalendarDays className="size-4" aria-hidden />}>
          {(id) => (
            <input
              id={id}
              type="date"
              value={pickedDate}
              min={today || undefined}
              max={today ? addDays(today, 30) : undefined}
              onChange={(event) => setDate(event.target.value)}
              className={cn(fieldClass, 'pr-3')}
            />
          )}
        </Field>
        <Field label="Khung giờ" icon={<Clock3 className="size-4" aria-hidden />}>
          {(id) => (
            <select id={id} value={pickedHour} onChange={(event) => setHour(Number(event.target.value))} className={fieldClass}>
              {hours.map((value) => (
                <option key={value} value={value}>{minutesToTime(value * 60)} – {minutesToTime((value + 1) * 60)}</option>
              ))}
            </select>
          )}
        </Field>
        <button type="submit" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#137d3d] px-6 text-sm font-semibold whitespace-nowrap text-white shadow-[0_10px_20px_-12px_#137d3d] transition-all hover:bg-[#0e6030] hover:shadow-[0_14px_24px_-12px_#137d3d] sm:col-span-2 sm:h-13 lg:col-span-1 lg:w-auto">
          Xem giờ trống <ArrowRight className="size-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}
