'use client';

import { cn } from '@/lib/cn';
import { formatVndShort } from '@/lib/format';

import { type DaySlot } from '../lib/slots';

export interface SlotView {
  slot: DaySlot;
  state: 'free' | 'busy' | 'past' | 'unpriced';
  pricePerHour: number | null;
  selected: boolean;
}

const STATE_TEXT: Record<Exclude<SlotView['state'], 'free'>, string> = {
  busy: 'Đã đặt',
  past: 'Đã qua',
  unpriced: 'Chưa mở',
};

/** Lưới giờ: ô đã chọn ghép thành "dải thảm" xanh như mặt sân. */
export function SlotGrid({ views, loading, onPick }: { views: SlotView[]; loading: boolean; onPick: (index: number) => void }) {
  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-1.5 min-[430px]:grid-cols-5 sm:grid-cols-6 lg:grid-cols-8" aria-busy>
        {Array.from({ length: 16 }, (_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-control bg-hall" />
        ))}
      </div>
    );
  }
  // Giờ đã qua không chọn được: ẩn đi để lưới ngắn gọn trên điện thoại (logic chọn vẫn dùng chỉ số gốc).
  const pastCount = views.filter((v) => v.state === 'past').length;
  const shown = views.filter((v) => v.state !== 'past');
  if (shown.length === 0 && pastCount > 0) {
    return <p className="rounded-panel bg-hall p-4 text-muted">Hôm nay đã hết giờ chơi. Chọn ngày khác ở trên.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-4 gap-1.5 min-[430px]:grid-cols-5 sm:grid-cols-6 lg:grid-cols-8" role="group" aria-label="Khung giờ">
        {shown.map(({ slot, state, pricePerHour, selected }) => {
          const disabled = state !== 'free';
          return (
            <button
              key={slot.index}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              aria-label={`${slot.start} đến ${slot.end}${disabled ? `, ${STATE_TEXT[state as Exclude<SlotView['state'], 'free'>]}` : ''}`}
              onClick={() => onPick(slot.index)}
              className={cn(
                'flex h-16 flex-col items-center justify-center rounded-control border text-center transition-colors duration-150',
                selected && 'border-court bg-court text-ink',
                !selected && state === 'free' && 'border-line bg-paper hover:border-ink',
                disabled && 'cursor-not-allowed border-transparent bg-hall text-muted',
                state === 'busy' && 'line-through decoration-muted/60',
              )}
            >
              <span className="font-display text-lg leading-none tabular">{slot.start}</span>
              <span className={cn('mt-1 text-[0.7rem] leading-none', selected ? 'text-ink/80' : 'text-muted')}>
                {disabled
                  ? STATE_TEXT[state as Exclude<SlotView['state'], 'free'>]
                  : pricePerHour
                    ? `${formatVndShort(pricePerHour)}/giờ`
                    : ''}
              </span>
            </button>
          );
        })}
      </div>
      {pastCount > 0 && <p className="text-sm text-muted">Đã ẩn {pastCount} khung giờ đã qua.</p>}
    </div>
  );
}
