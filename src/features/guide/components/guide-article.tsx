import { ArrowRight, Check, Lightbulb, TriangleAlert, X } from 'lucide-react';
import Link from 'next/link';

import { buttonClass } from '@/components/ui/button';
import { cn } from '@/lib/cn';

import { TOPIC_LABEL, nextGuide, type Guide, type GuideBlock } from '../content';
import { readingMinutes } from '../lib/reading';
import { CourtExplorer } from './court-explorer';
import { GuideIcon } from './guide-icon';
import { RichText } from './rich-text';
import { Scoreboard } from './scoreboard';

function Block({ block }: { block: GuideBlock }) {
  switch (block.kind) {
    case 'heading':
      return (
        <h3 className="flex items-center gap-3 pt-3 text-2xl sm:text-[1.7rem]">
          <span aria-hidden className="h-6 w-1.5 rounded-full bg-court" />
          {block.text}
        </h3>
      );
    case 'text':
      return (
        <p className="text-[1.02rem] leading-relaxed text-ink/80">
          <RichText text={block.text} />
        </p>
      );
    case 'list':
      return (
        <ul className="flex flex-col gap-3">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-[1.02rem] leading-relaxed text-ink/80">
              <span aria-hidden className="mt-[0.6rem] size-2 shrink-0 rotate-45 bg-court" />
              <span>
                {item.term && <strong className="font-semibold text-ink">{item.term}. </strong>}
                <RichText text={item.text} />
              </span>
            </li>
          ))}
        </ul>
      );
    case 'steps':
      return (
        <ol className="relative flex flex-col gap-5">
          <span aria-hidden className="absolute top-4 bottom-4 left-[1.05rem] w-px bg-line" />
          {block.items.map((step, i) => (
            <li key={i} className="relative flex gap-4">
              <span className="z-[1] grid size-[2.15rem] shrink-0 place-items-center rounded-full bg-ink font-display text-lg text-paper ring-4 ring-paper">
                {i + 1}
              </span>
              <div className="pt-0.5">
                <h4 className="font-sans text-[1.05rem] font-semibold">{step.title}</h4>
                <p className="mt-1 leading-relaxed text-ink/75">
                  <RichText text={step.text} />
                </p>
              </div>
            </li>
          ))}
        </ol>
      );
    case 'cards':
      return (
        <ul className="grid gap-3 sm:grid-cols-3">
          {block.items.map((card) => (
            <li key={card.title} className="flex flex-col gap-2 rounded-2xl border border-line bg-hall/60 p-4">
              <span aria-hidden className="grid size-10 place-items-center rounded-xl bg-court text-on-court">
                <card.icon className="size-5" />
              </span>
              <h4 className="mt-1 font-sans text-base font-semibold">{card.title}</h4>
              <p className="text-[0.95rem] leading-relaxed text-ink/75">
                <RichText text={card.text} />
              </p>
            </li>
          ))}
        </ul>
      );
    case 'faults':
      return (
        <ol className="flex flex-col gap-3">
          {block.items.map((f, i) => (
            <li key={f.title} className="flex gap-3 rounded-2xl border border-line bg-paper p-4 sm:gap-4">
              <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-shuttle-soft text-shuttle-deep">
                <X className="size-5" strokeWidth={2.5} />
              </span>
              <div className="min-w-0">
                <h4 className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-sans text-[1.05rem] font-semibold">
                  <span>
                    {i + 1}. {f.title}
                  </span>
                  <span className="rounded-full bg-hall px-2 py-0.5 text-xs font-medium text-muted">{f.alias}</span>
                </h4>
                <p className="mt-1 leading-relaxed text-ink/75">
                  <RichText text={f.text} />
                </p>
                {f.allowed && (
                  <p className="mt-2 flex items-start gap-1.5 text-sm text-court-deep">
                    <Check className="mt-0.5 size-4 shrink-0" aria-hidden strokeWidth={2.5} />
                    <span>
                      <strong className="font-semibold">Không phải lỗi:</strong> {f.allowed}
                    </span>
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      );
    case 'note': {
      const warn = block.tone === 'warn';
      const Icon = warn ? TriangleAlert : Lightbulb;
      return (
        <aside
          className={cn(
            'flex gap-3 rounded-2xl border p-4 sm:p-5',
            warn ? 'border-shuttle/25 bg-shuttle-soft' : 'border-court/35 bg-court-soft',
          )}
        >
          <Icon className={cn('mt-0.5 size-5 shrink-0', warn ? 'text-shuttle-deep' : 'text-court-deep')} aria-hidden />
          <div>
            <p className={cn('font-semibold', warn ? 'text-shuttle-deep' : 'text-court-deep')}>{block.title}</p>
            <p className="mt-1 leading-relaxed text-ink/80">
              <RichText text={block.text} />
            </p>
          </div>
        </aside>
      );
    }
    case 'scoreboard':
      return <Scoreboard />;
    case 'court':
      return <CourtExplorer initial={block.initial} />;
    case 'actions':
      return (
        <div className="flex flex-col gap-2 sm:flex-row">
          {block.items.map((a) => (
            <Link key={a.href} href={a.href} className={buttonClass(a.primary ? 'brand' : 'outline', 'lg')}>
              {a.label}
              {a.primary && <ArrowRight className="size-4" aria-hidden />}
            </Link>
          ))}
        </div>
      );
  }
}

/** Dòng chủ đề · thời gian đọc. */
export function GuideMeta({ guide, className }: { guide: Guide; className?: string }) {
  return (
    <p className={cn('flex flex-wrap items-center gap-x-2 text-xs font-semibold tracking-[0.14em] uppercase', className)}>
      <span>{TOPIC_LABEL[guide.topic]}</span>
      <span aria-hidden>·</span>
      <span>{readingMinutes(guide)} phút đọc</span>
    </p>
  );
}

/**
 * Thân bài cẩm nang (dùng chung cho hộp thoại và trang riêng).
 * `inDialog`: liên kết "Bài tiếp theo" thay URL hiện tại để nút Đóng quay về đúng trang Cẩm nang.
 */
export function GuideArticle({ guide, inDialog = false }: { guide: Guide; inDialog?: boolean }) {
  const next = nextGuide(guide.slug);
  return (
    <div className="flex flex-col gap-5">
      <p className="text-lg leading-relaxed text-ink sm:text-xl">
        <RichText text={guide.lead} />
      </p>
      {guide.blocks.map((b, i) => (
        <Block key={i} block={b} />
      ))}

      <Link
        href={`/guide/${next.slug}`}
        replace={inDialog}
        scroll={!inDialog}
        className="group mt-4 flex items-center gap-4 rounded-2xl border border-line bg-hall/50 p-4 transition-colors hover:border-ink/25 hover:bg-hall"
      >
        <GuideIcon guide={next} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold tracking-[0.14em] text-muted uppercase">Bài tiếp theo</span>
          <span className="block truncate font-display text-xl">{next.title}</span>
        </span>
        <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden />
      </Link>
    </div>
  );
}
