import { ArrowLeft, ArrowRight } from 'lucide-react';
import { type Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { SplitHeading } from '@/components/motion/split-heading';
import { buttonClass } from '@/components/ui/button';
import { findGuide, GUIDES, TOPIC_LABEL } from '@/features/guide/content';
import { GuideArticle, GuideMeta } from '@/features/guide/components/guide-article';
import { GuideIcon } from '@/features/guide/components/guide-icon';
import { plainText } from '@/features/guide/lib/rich';
import { cn } from '@/lib/cn';

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = findGuide(slug);
  if (!guide) return {};
  return { title: `${guide.title} — Cẩm nang cầu lông`, description: plainText(guide.lead) };
}

/** Trang riêng của một bài (mở link trực tiếp, tải lại trang, máy tìm kiếm). */
export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = findGuide(slug);
  if (!guide) notFound();

  return (
    <article className="pt-6 pb-16 sm:pt-10 sm:pb-24">
      <nav aria-label="Vị trí" className="flex items-center gap-2 text-sm text-muted">
        <Link href="/guide" className="inline-flex items-center gap-1.5 hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden />
          Cẩm nang
        </Link>
        <span aria-hidden>/</span>
        <span>{TOPIC_LABEL[guide.topic]}</span>
      </nav>

      <header className="mt-6 flex max-w-3xl flex-col gap-4 border-b border-line pb-8 sm:mt-8 sm:pb-10">
        <GuideIcon guide={guide} size="lg" />
        <GuideMeta guide={guide} className="text-muted" />
        <SplitHeading as="h1" className="text-[2.6rem] leading-[1.02] sm:text-6xl">
          {guide.title}
        </SplitHeading>
      </header>

      <div className="mt-8 grid gap-12 sm:mt-10 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-16">
        <div className="max-w-3xl min-w-0">
          <GuideArticle guide={guide} />
        </div>
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <nav aria-label="Các bài trong cẩm nang" className="rounded-2xl border border-line p-2">
            <p className="px-3 pt-2 pb-1 text-xs font-semibold tracking-[0.14em] text-muted uppercase">Trong cẩm nang</p>
            <ol>
              {GUIDES.map((g, i) => {
                const current = g.slug === guide.slug;
                return (
                  <li key={g.slug}>
                    <Link
                      href={`/guide/${g.slug}`}
                      scroll={false}
                      aria-current={current ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2 text-[0.95rem] transition-colors',
                        current ? 'bg-ink text-paper' : 'hover:bg-hall',
                      )}
                    >
                      <span className={cn('w-6 font-display tabular', current ? 'text-court' : 'text-muted')}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0 truncate">{g.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </nav>
          <div className="flex flex-col gap-3 rounded-2xl bg-court p-5 text-on-court">
            <p className="font-display text-2xl leading-tight">Sẵn sàng ra sân?</p>
            <p className="text-sm text-ink/75">Xem giờ trống và giữ sân trong một phút, không cần tài khoản.</p>
            <Link href="/booking" className={buttonClass('primary', 'md', 'w-full')}>
              Đặt sân ngay
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </aside>
      </div>
    </article>
  );
}
