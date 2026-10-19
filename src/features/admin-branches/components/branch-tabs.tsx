import Link from 'next/link';

import { cn } from '@/lib/cn';

const TABS = [
  { key: 'info', label: 'Thông tin', href: (id: string) => `/admin/branches/${id}` },
  { key: 'courts', label: 'Sân', href: (id: string) => `/admin/branches/${id}/courts` },
  { key: 'pricing', label: 'Bảng giá', href: (id: string) => `/admin/branches/${id}/pricing` },
] as const;

export function BranchTabs({ branchId, active }: { branchId: string; active: (typeof TABS)[number]['key'] }) {
  return (
    <nav aria-label="Mục chi nhánh" className="mb-6 flex gap-1 border-b border-line">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href(branchId)}
          aria-current={t.key === active ? 'page' : undefined}
          className={cn(
            '-mb-px border-b-2 px-4 py-2.5 text-[0.95rem]',
            t.key === active ? 'border-ink font-medium' : 'border-transparent text-muted hover:text-ink',
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
