import { Sparkles } from 'lucide-react';

import { cn } from '@/lib/cn';
import { formatDate, formatNumber, formatPhone } from '@/lib/format';

import { tierProgress } from '../lib/tiers';
import { type MemberProfile } from '../schemas';

/** Thẻ thành viên: hạng, điểm khả dụng, tiến độ lên hạng. */
export function MemberCard({ profile, className }: { profile: MemberProfile; className?: string }) {
  const progress = tierProgress(profile.lifetime_points);
  return (
    <div
      className={cn(
        'relative isolate flex flex-col gap-5 overflow-hidden rounded-[1.25rem] bg-gradient-to-br p-5 text-paper shadow-lift sm:p-6',
        progress.current.card,
        className,
      )}
    >
      <svg aria-hidden viewBox="0 0 300 200" className="absolute -right-10 -bottom-12 -z-10 w-72 text-paper opacity-[0.09]">
        <rect x="10" y="10" width="280" height="180" fill="none" stroke="currentColor" strokeWidth="4" />
        <path d="M150 10 V190 M10 100 H290 M60 10 V190 M240 10 V190" stroke="currentColor" strokeWidth="3" fill="none" />
      </svg>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="text-xs font-semibold tracking-[0.25em] text-paper/60 uppercase">Rally member</span>
          <span className="truncate font-display text-2xl sm:text-3xl">{profile.full_name}</span>
          <span className="text-sm text-paper/70 tabular">{profile.phone ? formatPhone(profile.phone) : (profile.email ?? '')}</span>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-paper/15 px-3 py-1 text-sm font-semibold ring-1 ring-paper/25 backdrop-blur-sm">
          <Sparkles className="size-4" aria-hidden />
          {progress.current.label}
        </span>
      </div>
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-xs text-paper/65">Điểm khả dụng</span>
          <span className="font-display text-5xl leading-none tabular">{formatNumber(profile.points)}</span>
        </div>
        <span className="text-right text-xs text-paper/60">Thành viên từ {formatDate(profile.created_at)}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <div
          className="h-2 overflow-hidden rounded-full bg-paper/20"
          role="progressbar"
          aria-label="Tiến độ lên hạng"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.percent}
        >
          <span className="block h-full rounded-full bg-court" style={{ width: `${progress.percent}%` }} />
        </div>
        <span className="text-xs text-paper/75">
          {progress.next
            ? `Còn ${formatNumber(progress.remaining)} điểm nữa để lên hạng ${progress.next.label}`
            : 'Bạn đang ở hạng cao nhất. Cảm ơn bạn đã đồng hành cùng Rally!'}
        </span>
      </div>
    </div>
  );
}
