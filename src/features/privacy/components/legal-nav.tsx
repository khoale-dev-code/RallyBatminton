import { FileLock2 } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/cn';

import { DATA_REQUEST_HREF, LEGAL_CODES, LEGAL_PAGES, legalHref, type LegalCode } from '../consent-text';

/** Chuyển nhanh giữa các văn bản pháp lý và trang gửi yêu cầu dữ liệu. */
export function LegalNav({ active }: { active: LegalCode | 'request' | null }) {
  return (
    <nav aria-label="Văn bản pháp lý" className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1.5 sm:w-auto sm:flex-wrap">
        {LEGAL_CODES.map((code) => (
          <li key={code}>
            <Link
              href={legalHref(code)}
              aria-current={active === code ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors',
                active === code ? 'border-ink bg-ink text-paper' : 'border-line bg-paper hover:border-ink/40',
              )}
            >
              {LEGAL_PAGES[code].short}
            </Link>
          </li>
        ))}
        <li>
          <Link
            href={DATA_REQUEST_HREF}
            aria-current={active === 'request' ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors',
              active === 'request'
                ? 'border-court-strong bg-court-strong text-paper'
                : 'border-court/50 bg-court-soft text-court-deep hover:border-court-deep',
            )}
          >
            <FileLock2 className="size-4" aria-hidden />
            Yêu cầu về dữ liệu
          </Link>
        </li>
      </ul>
    </nav>
  );
}
