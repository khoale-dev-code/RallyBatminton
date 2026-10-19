'use client';

import { ArrowRight, CalendarDays, Clock3, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';

import { buttonClass } from '@/components/ui/button';
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
  'h-12 w-full appearance-none rounded-control border border-line bg-paper pr-9 pl-10 text-[0.95rem] text-ink outline-none transition-colors hover:border-ink/30 focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink/10';

function Field({ label, icon, children }: { label: string; icon: ReactNode; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted">{icon}</span>
        {children(id)}
      </div>
    </div>
  );
}

/** Ô tìm giờ trống trên trang chủ: chi nhánh → ngày → khung giờ → mở lịch chi nhánh đúng ngày. */
export function QuickSearch({ branches, className }: { branches: SearchBranch[]; className?: string }) {
  const router = useRouter();
  // Ngày "hôm nay" chỉ tính ở trình duyệt (trang được cache); server trả rỗng để không lệch hydrate.
  const today = useSyncExternalStore(
    subscribe,
    () => dateKeyInZone(new Date(), DEFAULT_TZ),
    () => '',
  );
  const nextHour = useSyncExternalStore(
    subscribe,
    () => Math.min(22, zonedParts(new Date(), DEFAULT_TZ).hour + 1),
    () => 17,
  );
  const [slug, setSlug] = useState(branches.length === 1 ? (branches[0]?.slug ?? '') : '');
  const [date, setDate] = useState('');
  const [hour, setHour] = useState<number | null>(null);

  const branch = branches.find((b) => b.slug === slug);
  const openHour = Math.ceil(Number((branch?.opensAt ?? '05:00').slice(0, 2)));
  const closeHour = Number((branch?.closesAt ?? '23:00').slice(0, 2)) || 24;
  const hours = Array.from({ length: Math.max(0, closeHour - openHour) }, (_, i) => openHour + i);
  const pickedDate = date || today;
  const pickedHour = hour ?? Math.max(openHour, Math.min(nextHour, closeHour - 1));

  function submit(e: FormEvent) {
    e.preventDefault();
    const time = minutesToTime(pickedHour * 60);
    if (slug) {
      router.push(bookingHref(slug, { date: pickedDate, time }));
      return;
    }
    // Chưa chọn chi nhánh: xem các chi nhánh với ngày/giờ đã chọn.
    const params = new URLSearchParams({ time });
    if (pickedDate) params.set('date', pickedDate);
    router.push(`/branches?${params.toString()}`);
  }

  return (
    <form
      onSubmit={submit}
      aria-label="Tìm giờ trống"
      className={cn(
        'grid gap-3 rounded-panel border border-line bg-paper p-4 shadow-lift sm:p-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[1.3fr_1fr_1fr_auto_auto] xl:items-end',
        className,
      )}
    >
      <div className="md:col-span-2 lg:col-span-1">
        <Field label="Chọn chi nhánh" icon={<MapPin className="size-4" aria-hidden />}>
          {(id) => (
            <select id={id} value={slug} onChange={(e) => setSlug(e.target.value)} className={fieldClass}>
              <option value="">Tất cả chi nhánh</option>
              {branches.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <Field label="Ngày" icon={<CalendarDays className="size-4" aria-hidden />}>
        {(id) => (
          <input
            id={id}
            type="date"
            value={pickedDate}
            min={today || undefined}
            max={today ? addDays(today, 30) : undefined}
            onChange={(e) => setDate(e.target.value)}
            className={cn(fieldClass, 'pr-3')}
          />
        )}
      </Field>
      <Field label="Giờ" icon={<Clock3 className="size-4" aria-hidden />}>
        {(id) => (
          <select id={id} value={pickedHour} onChange={(e) => setHour(Number(e.target.value))} className={fieldClass}>
            {hours.map((h) => (
              <option key={h} value={h}>
                {minutesToTime(h * 60)} – {minutesToTime((h + 1) * 60)}
              </option>
            ))}
          </select>
        )}
      </Field>
      <div className="grid gap-3 sm:grid-cols-2 md:col-span-2 lg:col-span-3 lg:flex lg:justify-end xl:contents">
        <button type="submit" className={buttonClass('brand', 'lg', 'h-12 min-h-12 w-full lg:w-auto')}>
          Xem giờ trống
          <ArrowRight className="size-4" aria-hidden />
        </button>
        <Link
          href="/booking/lookup"
          className={buttonClass('outline', 'lg', 'h-12 min-h-12 w-full border-court-strong/40 text-court-strong lg:w-auto')}
        >
          Tra cứu đơn
        </Link>
      </div>
    </form>
  );
}
