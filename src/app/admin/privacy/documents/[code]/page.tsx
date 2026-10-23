import { ArrowLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge, PageHeader, Panel } from '@/components/ui/primitives';
import { LegalEditor } from '@/features/privacy/components/admin-privacy';
import { LEGAL_CODES, LEGAL_PAGES, legalHref, type LegalCode } from '@/features/privacy/consent-text';
import { getCancellationPolicies, getLegalValues, listLegalVersionsAdmin, listRetentionAdmin } from '@/features/privacy/queries';
import { requireOwner, withGuard } from '@/lib/auth/guards';
import { requestNow } from '@/lib/time';
import { formatDateTime } from '@/lib/format';

export const metadata = { title: 'Sửa văn bản pháp lý' };

const isLegalCode = (v: string): v is LegalCode => (LEGAL_CODES as string[]).includes(v);

export default async function LegalDocumentAdminPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!isLegalCode(code)) notFound();
  const [, [versions, values, cancellation, retention]] = await withGuard(requireOwner(), () =>
    Promise.all([listLegalVersionsAdmin(code), getLegalValues(), getCancellationPolicies(), listRetentionAdmin()]),
  );
  if (!versions) notFound();
  const latest = versions[0];
  const now = requestNow();

  return (
    <>
      <PageHeader
        back={
          <Link href="/admin/privacy#van-ban" className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary">
            <ArrowLeft className="size-4" aria-hidden />
            Dữ liệu cá nhân
          </Link>
        }
        title={LEGAL_PAGES[code].label}
        description={latest ? `Đang sửa từ phiên bản ${latest.version}.` : 'Chưa có phiên bản nào.'}
        actions={
          <Link href={legalHref(code)} target="_blank" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary">
            Xem trên website
            <ExternalLink className="size-4" aria-hidden />
          </Link>
        }
      />
      <LegalEditor
        code={code}
        initial={{ title: latest?.title ?? LEGAL_PAGES[code].label, summary: latest?.summary ?? '', body: latest?.body ?? '' }}
        values={values}
        cancellation={cancellation}
        retention={retention ?? []}
      />
      {versions.length > 0 && (
        <Panel title="Các phiên bản" className="mt-6">
          <ul className="divide-y divide-line text-sm">
            {versions.map((v) => {
              const scheduled = Date.parse(v.effectiveAt) > now;
              return (
                <li key={v.id} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    <span className="font-medium">Phiên bản {v.version}</span>
                    {v.changeNote ? <span className="text-muted"> — {v.changeNote}</span> : null}
                  </span>
                  <span className="flex items-center gap-2 text-muted">
                    {scheduled && <Badge tone="amber">Hẹn hiệu lực</Badge>}
                    Hiệu lực {formatDateTime(v.effectiveAt)}
                    {!scheduled && (
                      <Link href={`${legalHref(code)}?v=${v.version}`} target="_blank" className="text-primary hover:underline">
                        Xem
                      </Link>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </>
  );
}
