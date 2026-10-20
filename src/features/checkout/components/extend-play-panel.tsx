'use client';

import { AlarmClockPlus, CalendarX2, Clock, TriangleAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { formatMinutes, formatTime, formatVnd } from '@/lib/format';

import { extendBookingAction } from '../actions';
import { OVERTIME_GRACE_MINUTES, overtimeMinutes, suggestedOption, type ExtendOption, type ExtendOptions } from '../lib/extend';

/**
 * Khách chơi thêm giờ: hiện sân còn trống tới mấy giờ, các lựa chọn +30 phút / +1 giờ… kèm tiền thêm.
 * Khách đã chơi quá giờ → gợi ý sẵn khung phủ tới hiện tại (lố dưới 10 phút không tính).
 */
export function ExtendPlayPanel({ data, tz, nowMs }: { data: ExtendOptions; tz: string; nowMs: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<ExtendOption | null>(null);
  // Giờ hiện tại: lấy từ máy chủ lúc tải (khớp khi hydrate), sau đó chạy theo đồng hồ máy.
  const [now, setNow] = useState(nowMs);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const over = overtimeMinutes(data.ends_at, now);
  const suggested = suggestedOption(data.options, data.ends_at, now);
  const booked = Math.round((new Date(data.ends_at).getTime() - new Date(data.starts_at).getTime()) / 60000);

  const extend = (o: ExtendOption) =>
    startTransition(async () => {
      const res = await extendBookingAction(data.booking_id, o.ends_at);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      setConfirming(null);
      router.refresh();
    });

  if (!data.can_extend) return null;

  return (
    <section aria-label="Giờ chơi" className="@container flex flex-col gap-4 rounded-panel border border-line bg-paper p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg">
            <Clock className="size-5" aria-hidden />
            Giờ chơi
          </h2>
          <p className="mt-1 text-sm text-muted">
            Đã đặt{' '}
            <strong className="text-ink tabular">
              {formatTime(data.starts_at, tz)}–{formatTime(data.ends_at, tz)}
            </strong>{' '}
            ({formatMinutes(booked)})
          </p>
        </div>
        <p className="rounded-full bg-hall px-3 py-1 text-sm">
          Sân trống tới <strong className="tabular">{formatTime(data.free_until, tz)}</strong>
          <span className="text-muted">{data.limit_reason === 'booking' ? ' · có khách đặt sau' : ' · giờ đóng cửa'}</span>
        </p>
      </header>

      {over > 0 && (
        <p
          className={cn(
            'flex items-start gap-2 rounded-control px-3 py-2 text-sm',
            over > OVERTIME_GRACE_MINUTES ? 'bg-amber-soft text-amber-deep' : 'bg-hall text-muted',
          )}
          role="status"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {over > OVERTIME_GRACE_MINUTES
            ? `Khách đã chơi quá giờ ${formatMinutes(over)}${suggested ? ` — gợi ý tính tới ${formatTime(suggested.ends_at, tz)}.` : '.'}`
            : `Quá giờ ${over} phút — trong ${OVERTIME_GRACE_MINUTES} phút dọn sân, không tính thêm.`}
        </p>
      )}

      {data.options.length === 0 ? (
        <p className="flex items-start gap-2 text-sm text-muted">
          <CalendarX2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          {data.limit_reason === 'booking'
            ? `Sân có khách đặt tiếp lúc ${formatTime(data.free_until, tz)} — không gia hạn được trên sân này. Đổi sang sân khác ở trang chi tiết đơn.`
            : 'Đã tới giờ đóng cửa — không gia hạn thêm được.'}
        </p>
      ) : (
        <>
          <p className="text-sm font-medium">Khách chơi thêm</p>
          <ul className="grid grid-cols-2 gap-2 @md:grid-cols-3 @2xl:grid-cols-4">
            {data.options.map((o) => {
              const isSuggested = suggested?.ends_at === o.ends_at;
              const active = confirming?.ends_at === o.ends_at;
              return (
                <li key={o.ends_at}>
                  <button
                    type="button"
                    onClick={() => setConfirming(o)}
                    aria-pressed={active}
                    className={cn(
                      'relative flex h-full w-full flex-col items-start rounded-control border px-3 py-2 text-left transition-colors',
                      active
                        ? 'border-ink bg-ink text-paper'
                        : isSuggested
                          ? 'border-amber-deep/60 bg-amber-soft'
                          : 'border-line hover:border-ink',
                    )}
                  >
                    {isSuggested && (
                      <span
                        className={cn(
                          'absolute top-2 right-2 rounded-full px-1.5 text-[11px] font-medium',
                          active ? 'bg-paper/20 text-paper' : 'bg-amber-deep text-paper',
                        )}
                      >
                        Gợi ý
                      </span>
                    )}
                    <span className="font-medium">+{formatMinutes(o.minutes)}</span>
                    <span className={cn('text-sm tabular', active ? 'text-paper/80' : 'text-muted')}>tới {formatTime(o.ends_at, tz)}</span>
                    <span className="mt-1 text-sm font-medium tabular">+{formatVnd(o.amount)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {confirming && (
            <div className="flex flex-col gap-2 rounded-control bg-hall p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm">
                Gia hạn tới <strong className="tabular">{formatTime(confirming.ends_at, tz)}</strong>, cộng thêm{' '}
                <strong className="tabular">{formatVnd(confirming.amount)}</strong> vào đơn.
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setConfirming(null)} disabled={pending}>
                  Thôi
                </Button>
                <Button size="sm" onClick={() => extend(confirming)} disabled={pending}>
                  <AlarmClockPlus className="size-4" aria-hidden />
                  {pending ? 'Đang gia hạn…' : 'Gia hạn'}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
