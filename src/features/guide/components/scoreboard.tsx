import { cn } from '@/lib/cn';

const ROWS = [
  { score: '21', label: 'điểm mỗi ván', note: 'Thắng 2 trong 3 ván', accent: 'text-court' },
  { score: '20–20', label: 'hòa', note: 'Phải hơn 2 điểm', accent: 'text-paper' },
  { score: '29–29', label: 'hòa', note: 'Ai chạm 30 thắng', accent: 'text-shuttle' },
];

/** Bảng điểm kiểu nhà thi đấu: ba mốc cần nhớ của luật tính điểm. */
export function Scoreboard({ compact = false }: { compact?: boolean }) {
  return (
    <div
      role="list"
      aria-label="Ba mốc điểm cần nhớ"
      className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-paper/15 text-paper ring-1 ring-ink"
    >
      {ROWS.map((r, i) => (
        <div
          role="listitem"
          key={r.score}
          className={cn(
            'relative flex flex-col justify-between bg-[#0b0b0b]',
            compact ? 'gap-1 px-3 py-3' : 'gap-3 px-4 py-4 sm:px-5 sm:py-5',
          )}
        >
          <span className="text-[0.68rem] font-semibold tracking-[0.18em] text-paper/50 uppercase">Mốc {i + 1}</span>
          <span
            className={cn('font-display leading-none tabular', r.accent, compact ? 'text-[1.7rem] sm:text-3xl' : 'text-[2rem] sm:text-5xl')}
          >
            {r.score}
          </span>
          <span className={cn('leading-snug text-paper/75', compact ? 'text-xs' : 'text-sm')}>
            <span className="sr-only">{r.label}: </span>
            {r.note}
          </span>
        </div>
      ))}
    </div>
  );
}
