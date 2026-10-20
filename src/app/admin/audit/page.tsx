import { ArrowRight, ChevronLeft, ChevronRight, History, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';

import { buttonClass } from '@/components/ui/button';
import { EmptyState, PageHeader } from '@/components/ui/primitives';
import { AUDIT_TABLES, listAuditEvents, PAGE_SIZE } from '@/features/audit/queries';
import { changedFieldLabels, describeReason, recordTitle, statusChange } from '@/features/audit/lib/describe';
import { requireOwner, withGuard } from '@/lib/auth/guards';
import { cn } from '@/lib/cn';
import { formatDateKey, formatTime } from '@/lib/format';
import { addDays, dateKeyInZone, todayKey } from '@/lib/time';

export const metadata = { title: 'Nhật ký thay đổi' };

const ACTION = {
  INSERT: { label: 'Tạo mới', icon: Plus, dot: 'bg-primary-soft text-primary' },
  UPDATE: { label: 'Sửa', icon: Pencil, dot: 'bg-amber-soft text-amber-deep' },
  DELETE: { label: 'Xóa', icon: Trash2, dot: 'bg-shuttle-soft text-shuttle-deep' },
} as const;

function actionOf(a: string) {
  return a === 'INSERT' || a === 'UPDATE' || a === 'DELETE' ? ACTION[a] : ACTION.UPDATE;
}

function dayHeading(key: string): string {
  const today = todayKey();
  if (key === today) return 'Hôm nay';
  if (key === addDays(today, -1)) return 'Hôm qua';
  return formatDateKey(key);
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ table?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(0, Math.min(200, Number(sp.page) || 0));
  const table = sp.table && sp.table in AUDIT_TABLES ? sp.table : undefined;
  const [, { events, count }] = await withGuard(requireOwner(), () => listAuditEvents({ table, page }));
  const href = (p: number, t: string | undefined = table) =>
    `/admin/audit${t || p ? `?${new URLSearchParams({ ...(t ? { table: t } : {}), ...(p ? { page: String(p) } : {}) }).toString()}` : ''}`;

  // Gom theo ngày (giờ Việt Nam) để dễ dò.
  const days: Array<{ key: string; items: typeof events }> = [];
  for (const e of events) {
    const key = dateKeyInZone(new Date(e.occurred_at));
    const last = days.at(-1);
    if (last && last.key === key) last.items.push(e);
    else days.push({ key, items: [e] });
  }
  const from = page * PAGE_SIZE + 1;
  const to = page * PAGE_SIZE + events.length;

  return (
    <>
      <PageHeader
        title="Nhật ký thay đổi"
        description="Database tự ghi mọi thay đổi trên dữ liệu quan trọng: ai làm, lúc nào, đổi gì. Không ai sửa hay xóa được nhật ký."
      />

      <nav
        aria-label="Lọc theo loại dữ liệu"
        className="scrollbar-none -mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {[['', 'Tất cả'] as const, ...Object.entries(AUDIT_TABLES)].map(([key, label]) => {
          const active = (table ?? '') === key;
          return (
            <Link
              key={key || 'all'}
              href={href(0, key || undefined)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-9 shrink-0 items-center rounded-full border px-3.5 text-sm whitespace-nowrap transition-colors',
                active
                  ? 'border-primary bg-primary text-paper'
                  : 'border-line bg-paper text-ink/80 hover:border-primary/50 hover:text-primary',
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {events.length === 0 ? (
        <EmptyState title="Chưa có thay đổi nào">
          {table ? `Chưa có thay đổi trên ${AUDIT_TABLES[table]?.toLowerCase()}.` : 'Thay đổi đầu tiên sẽ hiện ở đây.'}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          {days.map((day) => (
            <section key={day.key} aria-label={dayHeading(day.key)}>
              <h2 className="sticky top-14 z-10 -mx-1 mb-2 flex items-center gap-2 bg-hall/95 px-1 py-1.5 font-sans text-sm font-semibold text-muted backdrop-blur lg:top-0">
                <History className="size-4" aria-hidden />
                {dayHeading(day.key)}
                <span className="font-normal">· {day.items.length} thay đổi</span>
              </h2>
              <ol className="overflow-hidden rounded-panel border border-line bg-paper">
                {day.items.map((e) => {
                  const act = actionOf(e.action);
                  const Icon = act.icon;
                  const fields = e.action === 'UPDATE' ? changedFieldLabels(e.old_data, e.new_data) : [];
                  const status = e.action === 'UPDATE' ? statusChange(e.table_name, e.old_data, e.new_data) : null;
                  const reason = describeReason(e.reason);
                  const { title, href: recordHref } = recordTitle(e.table_name, e.record_id, e.old_data, e.new_data, e.action);
                  const tableLabel = AUDIT_TABLES[e.table_name] ?? e.table_name;
                  const system = e.actor_id === null;
                  return (
                    <li key={e.id} className="flex gap-3 border-b border-line px-4 py-3.5 last:border-b-0 sm:gap-4 sm:px-5">
                      <span aria-hidden className={cn('mt-0.5 grid size-9 shrink-0 place-items-center rounded-full', act.dot)}>
                        <Icon className="size-4" />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                          <p className="min-w-0 font-medium">
                            <span className="sr-only">{act.label}: </span>
                            {tableLabel}
                            {title &&
                              (recordHref ? (
                                <Link href={recordHref} className="ml-1.5 text-primary underline-offset-4 hover:underline">
                                  {title}
                                </Link>
                              ) : (
                                <span className="ml-1.5 text-muted">{title}</span>
                              ))}
                          </p>
                          <time dateTime={e.occurred_at} className="shrink-0 text-sm text-muted tabular">
                            {formatTime(e.occurred_at)}
                          </time>
                        </div>
                        <p className="flex flex-wrap items-center gap-x-1.5 text-sm">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                              system ? 'bg-hall text-muted' : 'bg-primary-soft text-primary',
                            )}
                          >
                            {e.actorName}
                          </span>
                          {reason && <span className="text-ink/85">{reason}</span>}
                          {!reason && <span className="text-muted">{act.label.toLowerCase()}</span>}
                        </p>
                        {status && (
                          <p className="flex flex-wrap items-center gap-1.5 text-sm">
                            <span className="rounded-md bg-hall px-1.5 py-0.5 text-muted">{status.from}</span>
                            <ArrowRight className="size-3.5 text-muted" aria-label="thành" />
                            <span className="rounded-md bg-primary-soft px-1.5 py-0.5 font-medium text-primary">{status.to}</span>
                          </p>
                        )}
                        {fields.length > 0 && (
                          <ul className="flex flex-wrap gap-1" aria-label="Trường đã đổi">
                            {fields.map((f) => (
                              <li key={f} className="rounded-md border border-line px-1.5 py-0.5 text-xs text-muted">
                                {f}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}

      {events.length > 0 && (
        <nav aria-label="Trang nhật ký" className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted tabular">
            {from}–{to} / {count.toLocaleString('vi-VN')} thay đổi
          </p>
          <div className="flex gap-2">
            {page > 0 ? (
              <Link href={href(page - 1)} className={buttonClass('outline', 'sm')}>
                <ChevronLeft className="size-4" aria-hidden />
                Mới hơn
              </Link>
            ) : null}
            {(page + 1) * PAGE_SIZE < count ? (
              <Link href={href(page + 1)} className={buttonClass('outline', 'sm')}>
                Cũ hơn
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            ) : null}
          </div>
        </nav>
      )}
    </>
  );
}
