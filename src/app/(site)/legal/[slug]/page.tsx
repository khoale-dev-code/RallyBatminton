import { ArrowRight, History, LifeBuoy } from 'lucide-react';
import { type Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { SetupNotice } from '@/components/layout/setup-notice';
import { LegalDocumentBody } from '@/features/privacy/components/legal-document';
import { LegalNav } from '@/features/privacy/components/legal-nav';
import { DATA_REQUEST_HREF, LEGAL_CODES, LEGAL_PAGES, legalCodeFromSlug, legalHref } from '@/features/privacy/consent-text';
import { parseLegalMarkup } from '@/features/privacy/lib/markup';
import { getCancellationPolicies, getLegalDocument, getLegalValues, getRetentionPolicies } from '@/features/privacy/queries';
import { cn } from '@/lib/cn';
import { formatDate, formatPhone } from '@/lib/format';

export const revalidate = 600;

export function generateStaticParams() {
  return LEGAL_CODES.map((code) => ({ slug: LEGAL_PAGES[code].slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const code = legalCodeFromSlug(slug);
  if (!code) return {};
  const doc = await getLegalDocument(code);
  return { title: LEGAL_PAGES[code].label, description: doc?.current?.summary ?? undefined };
}

export default async function LegalPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const [{ slug }, { v }] = await Promise.all([params, searchParams]);
  const code = legalCodeFromSlug(slug);
  if (!code) notFound();

  const [result, values, cancellation, retention] = await Promise.all([
    getLegalDocument(code),
    getLegalValues(),
    getCancellationPolicies(),
    getRetentionPolicies(),
  ]);
  if (!result?.current) {
    return (
      <div className="py-12">
        <SetupNotice />
      </div>
    );
  }
  const wanted = v ? Number.parseInt(v, 10) : null;
  const doc = (wanted && result.versions.find((d) => d.version === wanted)) || result.current;
  const isOld = doc.id !== result.current.id;
  const nextVersion = isOld ? result.versions[result.versions.findIndex((d) => d.id === doc.id) - 1] : null;
  const blocks = parseLegalMarkup(doc.body);
  const toc = blocks.flatMap((b) => (b.kind === 'h2' ? [{ id: b.id, text: b.text }] : []));

  return (
    <article className="pt-6 pb-16 sm:pt-10 sm:pb-24">
      <header className="flex flex-col gap-5 border-b border-line pb-8 sm:pb-10">
        <LegalNav active={code} />
        <div className="flex max-w-3xl flex-col gap-3">
          <p className="font-display text-sm tracking-[0.24em] text-court-strong uppercase">
            Phiên bản {doc.version} · hiệu lực từ {formatDate(doc.effectiveAt)}
          </p>
          <h1 className="text-[2.4rem] leading-[1.05] sm:text-6xl">{doc.title}</h1>
          {doc.summary && <p className="text-lg text-muted">{doc.summary}</p>}
        </div>
      </header>

      {isOld && (
        <p role="note" className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-amber-soft px-4 py-3 text-amber-deep">
          <History className="size-4" aria-hidden />
          Bạn đang xem phiên bản cũ ({doc.version}), áp dụng từ {formatDate(doc.effectiveAt)}
          {nextVersion ? ` tới ${formatDate(nextVersion.effectiveAt)}` : ''}.
          <Link href={legalHref(code)} className="font-semibold underline underline-offset-4">
            Xem bản đang áp dụng
          </Link>
        </p>
      )}

      <div className="mt-8 grid gap-10 sm:mt-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16">
        <div className="max-w-3xl min-w-0">
          <LegalDocumentBody blocks={blocks} values={values} cancellation={cancellation} retention={retention} />
        </div>
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          {toc.length > 0 && (
            <nav aria-label="Mục lục" className="hidden rounded-2xl border border-line p-2 lg:block">
              <p className="px-3 pt-2 pb-1 text-xs font-semibold tracking-[0.14em] text-muted uppercase">Trong trang này</p>
              <ol>
                {toc.map((h) => (
                  <li key={h.id}>
                    <a href={`#${h.id}`} className="block rounded-xl px-3 py-1.5 text-[0.93rem] transition-colors hover:bg-hall">
                      {h.text}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}
          <div className="flex flex-col gap-3 rounded-2xl bg-hall-dark p-5 text-paper">
            <LifeBuoy className="size-6 text-court" aria-hidden />
            <p className="font-display text-2xl leading-tight">Xem, sửa hoặc xóa dữ liệu của bạn</p>
            <p className="text-sm text-paper/75">Gửi yêu cầu trực tuyến — Rally phản hồi trong 2 ngày làm việc.</p>
            <Link
              href={DATA_REQUEST_HREF}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-court px-4 font-medium text-on-court hover:brightness-95"
            >
              Gửi yêu cầu
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            {values.hotline && (
              <a href={`tel:${values.hotline}`} className="text-center text-sm text-paper/80 underline-offset-4 hover:underline">
                hoặc gọi {formatPhone(values.hotline)}
              </a>
            )}
          </div>
          {result.versions.length > 1 && (
            <nav aria-label="Các phiên bản" className="rounded-2xl border border-line p-2">
              <p className="px-3 pt-2 pb-1 text-xs font-semibold tracking-[0.14em] text-muted uppercase">Các phiên bản</p>
              <ul>
                {result.versions.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={d.id === result.current?.id ? legalHref(code) : `${legalHref(code)}?v=${d.version}`}
                      aria-current={d.id === doc.id ? 'page' : undefined}
                      className={cn(
                        'flex flex-col rounded-xl px-3 py-2 text-sm transition-colors',
                        d.id === doc.id ? 'bg-ink text-paper' : 'hover:bg-hall',
                      )}
                    >
                      <span className="font-medium">
                        Phiên bản {d.version}
                        {d.id === result.current?.id ? ' · đang áp dụng' : ''}
                      </span>
                      <span className={d.id === doc.id ? 'text-paper/70' : 'text-muted'}>
                        Từ {formatDate(d.effectiveAt)}
                        {d.changeNote ? ` — ${d.changeNote}` : ''}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </aside>
      </div>
    </article>
  );
}
