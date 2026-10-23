import { cn } from '@/lib/cn';

import { type Guide, type GuideTone } from '../content';

const TONE: Record<GuideTone, string> = {
  court: 'bg-court text-on-court',
  shuttle: 'bg-shuttle text-paper',
  ink: 'bg-ink text-paper',
  paper: 'bg-paper text-ink ring-1 ring-line',
};

const SIZE = {
  sm: 'size-11 rounded-xl [&_svg]:size-5',
  md: 'size-12 rounded-2xl [&_svg]:size-6',
  lg: 'size-14 rounded-2xl [&_svg]:size-7',
};

/** Ô biểu tượng của một bài, tô theo màu thương hiệu. */
export function GuideIcon({ guide, size = 'md', className }: { guide: Guide; size?: keyof typeof SIZE; className?: string }) {
  return (
    <span aria-hidden className={cn('grid shrink-0 place-items-center', TONE[guide.tone], SIZE[size], className)}>
      <guide.icon />
    </span>
  );
}
