import { ArrowRight, Cookie, FileLock2, FileText, Receipt, ShieldCheck, type LucideIcon } from 'lucide-react';
import { type Metadata } from 'next';
import Link from 'next/link';

import { DATA_REQUEST_HREF, LEGAL_CODES, LEGAL_PAGES, legalHref, type LegalCode } from '@/features/privacy/consent-text';
import { getLegalDocument } from '@/features/privacy/queries';
import { formatDate } from '@/lib/format';

export const revalidate = 600;

export const metadata: Metadata = {
  title: 'Chính sách & điều khoản',
  description: 'Chính sách bảo vệ dữ liệu cá nhân, điều khoản đặt sân, chính sách hủy sân & hoàn cọc và cookie của Rally.',
};

const ICONS: Record<LegalCode, LucideIcon> = { privacy: ShieldCheck, terms: FileText, cancellation: Receipt, cookies: Cookie };

export default async function LegalIndexPage() {
  const docs = await Promise.all(LEGAL_CODES.map(async (code) => ({ code, doc: (await getLegalDocument(code))?.current ?? null })));
  return (
    <div className="pt-6 pb-16 sm:pt-10 sm:pb-24">
      <header className="flex max-w-3xl flex-col gap-3 border-b border-line pb-8 sm:pb-10">
        <p className="font-display text-sm tracking-[0.24em] text-court-strong uppercase">Pháp lý</p>
        <h1 className="text-[2.4rem] leading-[1.05] sm:text-6xl">Chính sách & điều khoản</h1>
        <p className="text-lg text-muted">
          Rally công khai cách đặt sân, hủy và hoàn cọc, cách thu thập và bảo vệ dữ liệu của bạn. Mỗi văn bản ghi rõ phiên bản và ngày hiệu
          lực.
        </p>
      </header>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {docs.map(({ code, doc }) => {
          const Icon = ICONS[code];
          return (
            <li key={code}>
              <Link
                href={legalHref(code)}
                className="group flex h-full flex-col gap-3 rounded-[1.5rem] border border-line bg-paper p-6 transition-[border-color,box-shadow,translate] hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-[0_24px_50px_-32px_rgb(0_0_0/0.45)]"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-court text-on-court">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="font-display text-2xl leading-tight">{doc?.title ?? LEGAL_PAGES[code].label}</span>
                {doc?.summary && <span className="text-[0.95rem] text-muted">{doc.summary}</span>}
                <span className="mt-auto flex items-center justify-between gap-2 pt-2 text-sm">
                  <span className="text-muted">
                    {doc ? `Phiên bản ${doc.version} · từ ${formatDate(doc.effectiveAt)}` : 'Chưa công bố'}
                  </span>
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </span>
              </Link>
            </li>
          );
        })}
        <li className="sm:col-span-2">
          <Link
            href={DATA_REQUEST_HREF}
            className="group flex flex-col gap-3 rounded-[1.5rem] bg-hall-dark p-6 text-paper sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="flex items-center gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-court text-on-court">
                <FileLock2 className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block font-display text-2xl leading-tight">Yêu cầu về dữ liệu cá nhân</span>
                <span className="block text-sm text-paper/75">
                  Xem, tải, sửa, xóa dữ liệu hoặc rút lại đồng ý — phản hồi trong 2 ngày làm việc.
                </span>
              </span>
            </span>
            <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden />
          </Link>
        </li>
      </ul>
    </div>
  );
}
