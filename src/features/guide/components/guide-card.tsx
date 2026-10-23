import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/cn';

import { type Guide, type GuidePreview } from '../content';
import { GuideMeta } from './guide-article';
import { GuideIcon } from './guide-icon';
import { Scoreboard } from './scoreboard';

export type CardSurface = 'light' | 'dark' | 'green';

const SURFACE: Record<CardSurface, { card: string; meta: string; text: string; mark: string }> = {
  light: {
    card: 'border border-line bg-paper hover:border-ink/25 hover:shadow-[0_28px_50px_-30px_rgb(0_0_0/0.4)]',
    meta: 'text-muted',
    text: 'text-ink/70',
    mark: 'text-ink/[0.06]',
  },
  dark: {
    card: 'bg-ink text-paper hover:shadow-[0_30px_60px_-28px_rgb(0_0_0/0.65)] bg-[radial-gradient(90%_70%_at_100%_0%,rgb(98_187_70/0.22),transparent_60%)]',
    meta: 'text-paper/55',
    text: 'text-paper/70',
    mark: 'text-paper/[0.07]',
  },
  green: {
    card: 'bg-court text-on-court hover:shadow-[0_30px_60px_-30px_rgb(46_107_31/0.7)]',
    meta: 'text-ink/60',
    text: 'text-ink/75',
    mark: 'text-ink/[0.09]',
  },
};

/** Sân thu nhỏ (nhìn từ trên) cho thẻ "Sân đơn & sân đôi". */
function CourtMini() {
  return (
    <svg viewBox="0 0 268 122" aria-hidden className="h-auto w-full max-w-[22rem]">
      <rect x="0" y="0" width="268" height="122" rx="6" fill="#2f8a3a" />
      <rect x="0" y="9.2" width="268" height="103.6" fill="#62bb46" opacity="0.45" />
      <g fill="none" stroke="#fff" strokeWidth="1.6">
        <rect x="1" y="1" width="266" height="120" rx="5" />
        <path d="M0 9.2H268M0 112.8H268M94.4 0V122M173.6 0V122M15.2 0V122M252.8 0V122M0 61H94.4M173.6 61H268" />
      </g>
      <line x1="134" x2="134" y1="-4" y2="126" stroke="#fff" strokeWidth="3.5" />
      <circle cx="210" cy="36" r="5" fill="#ED1C24" stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}

function Preview({ preview, surface }: { preview: GuidePreview; surface: CardSurface }) {
  switch (preview.kind) {
    case 'score':
      return <Scoreboard compact />;
    case 'court':
      return <CourtMini />;
    case 'big':
      return (
        <p className="flex items-end gap-2">
          <span className={cn('font-display text-6xl leading-[0.85]', surface === 'light' && 'text-shuttle')}>{preview.value}</span>
          <span className={cn('pb-1 text-sm', SURFACE[surface].meta)}>{preview.caption}</span>
        </p>
      );
    case 'chips':
      return (
        <ul className="flex flex-wrap gap-1.5">
          {preview.items.map((c) => (
            <li
              key={c}
              className={cn(
                'rounded-full px-3 py-1 text-sm font-medium',
                surface === 'light' ? 'bg-hall text-ink ring-1 ring-line' : 'bg-paper/12 text-current ring-1 ring-current/20',
              )}
            >
              {c}
            </li>
          ))}
        </ul>
      );
    case 'dots':
      return (
        <p className="flex items-center gap-1.5">
          {Array.from({ length: preview.count }, (_, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className="grid size-7 place-items-center rounded-full bg-ink font-display text-sm text-paper">{i + 1}</span>
              {i < preview.count - 1 && <span aria-hidden className="h-px w-2 bg-line" />}
            </span>
          ))}
          <span className={cn('ml-1.5 text-sm', SURFACE[surface].meta)}>{preview.caption}</span>
        </p>
      );
    case 'cta':
      return (
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm font-medium">
          {['Đặt sân online', 'Báo số điện thoại ở quầy', 'Vào sân', 'Chơi thêm nếu sân trống'].map((s, i, all) => (
            <li key={s} className="flex items-center gap-2">
              <span className="rounded-full bg-ink px-3 py-1 text-paper">{s}</span>
              {i < all.length - 1 && <ArrowRight className="size-4 opacity-60" aria-hidden />}
            </li>
          ))}
        </ol>
      );
  }
}

/**
 * Thẻ một bài trong lưới Cẩm nang. Bấm → mở hộp thoại đọc bài (URL /guide/<bài>, giữ vị trí cuộn).
 */
export function GuideCard({
  guide,
  index,
  surface = 'light',
  large = false,
  className,
}: {
  guide: Guide;
  index: number;
  surface?: CardSurface;
  large?: boolean;
  className?: string;
}) {
  const s = SURFACE[surface];
  return (
    <Link
      href={`/guide/${guide.slug}`}
      scroll={false}
      data-reveal
      className={cn(
        'group relative isolate flex min-h-[15rem] flex-col overflow-hidden rounded-[1.75rem] p-6 transition-[translate,box-shadow,border-color] duration-300 ease-out hover:-translate-y-1 sm:p-7',
        s.card,
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-2 right-5 -z-10 font-display leading-none tabular select-none',
          large ? 'text-[9rem]' : 'text-[5.5rem]',
          s.mark,
        )}
      >
        {String(index + 1).padStart(2, '0')}
      </span>
      <GuideIcon
        guide={guide}
        size={large ? 'lg' : 'md'}
        className="transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105"
      />
      <GuideMeta guide={guide} className={cn('mt-5', s.meta)} />
      <h3 className={cn('mt-2', large ? 'text-4xl sm:text-5xl' : 'text-[1.7rem]')}>{guide.title}</h3>
      <p className={cn('mt-2 leading-relaxed', large ? 'max-w-md text-[1.05rem]' : 'text-[0.97rem]', s.text)}>{guide.summary}</p>
      {large && guide.highlights && (
        <ul className="mt-6 flex flex-col gap-2.5">
          {guide.highlights.map((h) => (
            <li key={h} className={cn('flex items-center gap-3 text-[0.97rem]', s.text)}>
              <span aria-hidden className="size-2 shrink-0 rotate-45 bg-court" />
              {h}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto pt-6">
        <Preview preview={guide.preview} surface={surface} />
      </div>
      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold">
        Đọc bài
        <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
      </span>
    </Link>
  );
}
