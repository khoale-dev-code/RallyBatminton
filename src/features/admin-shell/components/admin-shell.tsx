'use client';

import { KeyRound, LogOut, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useTransition, type ReactNode } from 'react';

import { ShuttleMark, Wordmark } from '@/components/brand/logo';
import { toast } from '@/components/ui/toast';
import { signOutAction } from '@/features/auth/actions';
import { cn } from '@/lib/cn';

import { setActiveBranchAction } from '../actions';
import { writePrefCookie } from '../lib/ui-prefs';
import { NAV_CLOSED_COOKIE, SIDEBAR_COOKIE, type NavGroup, type NavGroupKey } from '../nav';

import { SidebarNav } from './sidebar-nav';

interface AdminShellProps {
  nav: NavGroup[];
  displayName: string;
  roleLabel: string;
  branches: Array<{ id: string; name: string }>;
  activeBranchId: string | null;
  /** Trạng thái menu đọc từ cookie ở server để không nhấp nháy khi tải trang. */
  initialRail: boolean;
  initialClosedGroups: NavGroupKey[];
  children: ReactNode;
}

/** Chữ cái tên gọi (từ cuối của họ tên Việt). */
function initial(name: string): string {
  return (name.trim().split(/\s+/).at(-1)?.[0] ?? 'R').toUpperCase();
}

/** "Rally Quận 7" → "Q7", "Rally Thủ Đức" → "TĐ" (bỏ từ đầu là tên thương hiệu). */
function branchBadge(name: string): string {
  const words = name.trim().split(/\s+/);
  const rest = words.length > 1 ? words.slice(1) : words;
  return rest
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

export function AdminShell({
  nav,
  displayName,
  roleLabel,
  branches,
  activeBranchId,
  initialRail,
  initialClosedGroups,
  children,
}: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rail, setRail] = useState(initialRail);
  const [closedGroups, setClosedGroups] = useState<NavGroupKey[]>(initialClosedGroups);
  const [switching, startSwitch] = useTransition();
  const activeBranchName = branches.find((b) => b.id === activeBranchId)?.name ?? null;

  // Khóa cuộn trang nền khi menu trượt đang mở (điện thoại, máy tính bảng).
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function toggleRail() {
    const next = !rail;
    setRail(next);
    writePrefCookie(SIDEBAR_COOKIE, next ? 'rail' : 'full');
  }

  function toggleGroup(key: NavGroupKey) {
    const next = closedGroups.includes(key) ? closedGroups.filter((k) => k !== key) : [...closedGroups, key];
    setClosedGroups(next);
    writePrefCookie(NAV_CLOSED_COOKIE, next.join(','));
  }

  const branchSwitcher = (
    <div className="px-5 pb-3">
      <label htmlFor="branch-switcher" className="mb-1 block text-xs text-muted">
        Chi nhánh đang làm việc
      </label>
      <select
        id="branch-switcher"
        value={activeBranchId ?? ''}
        disabled={switching || branches.length === 1}
        onChange={(e) => {
          const id = e.target.value;
          startSwitch(async () => {
            await setActiveBranchAction(id);
            toast.info(`Đang làm việc tại ${branches.find((b) => b.id === id)?.name ?? 'chi nhánh mới'}.`);
            router.refresh();
          });
        }}
        className="min-h-11 w-full rounded-control border border-line bg-paper px-2 text-sm"
      >
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </div>
  );

  /** Menu đầy đủ: dùng cho cột trái máy tính (khi mở rộng) và menu trượt điện thoại. */
  const fullSidebar = (drawer: boolean) => (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 py-4 pr-3 pl-5 lg:py-5">
        <Link href="/admin" className="flex min-w-0 flex-1 items-center gap-2" aria-label="Rally quản trị — tổng quan">
          <Wordmark className="h-8" />
          <span className="truncate font-display text-lg text-muted">Quản trị</span>
        </Link>
        {!drawer && (
          <button
            type="button"
            onClick={toggleRail}
            aria-label="Thu gọn menu"
            title="Thu gọn menu"
            className="hidden size-9 shrink-0 place-items-center rounded-control text-muted hover:bg-hall hover:text-ink lg:grid"
          >
            <PanelLeftClose className="size-5" aria-hidden />
          </button>
        )}
      </div>
      {branches.length > 0 && branchSwitcher}
      <SidebarNav
        nav={nav}
        pathname={pathname}
        rail={false}
        closedGroups={closedGroups}
        onToggleGroup={toggleGroup}
        onNavigate={drawer ? () => setOpen(false) : undefined}
      />
      <div className="border-t border-line px-5 py-3 pb-safe">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft font-display text-sm text-primary"
          >
            {initial(displayName)}
          </span>
          <p className="flex min-w-0 flex-col leading-tight">
            <span className="truncate font-medium">{displayName}</span>
            {roleLabel !== displayName && <span className="truncate text-xs text-muted">{roleLabel}</span>}
          </p>
        </div>
        <div className="mt-1.5 flex items-center gap-4 text-sm">
          <Link
            href="/admin/password"
            onClick={() => setOpen(false)}
            className="inline-flex min-h-10 items-center underline-offset-4 hover:underline"
          >
            Đổi mật khẩu
          </Link>
          <form action={signOutAction}>
            <button type="submit" className="inline-flex min-h-10 items-center gap-1 text-shuttle-deep hover:underline">
              <LogOut className="size-4" aria-hidden />
              Đăng xuất
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  /** Menu thu gọn: chỉ biểu tượng, rê chuột để xem tên. */
  const railSidebar = (
    <div className="flex h-full flex-col items-stretch">
      <div className="flex flex-col items-center gap-2 py-4">
        <Link
          href="/admin"
          aria-label="Tổng quan"
          title="Rally quản trị"
          className="grid size-10 place-items-center rounded-control hover:bg-hall"
        >
          <ShuttleMark className="size-7" />
        </Link>
        <button
          type="button"
          onClick={toggleRail}
          aria-label="Mở rộng menu"
          title="Mở rộng menu"
          className="grid size-10 place-items-center rounded-control text-muted hover:bg-hall hover:text-ink"
        >
          <PanelLeftOpen className="size-5" aria-hidden />
        </button>
        {activeBranchName && (
          <button
            type="button"
            onClick={toggleRail}
            title={`Chi nhánh: ${activeBranchName} — mở rộng để đổi`}
            aria-label={`Chi nhánh ${activeBranchName}. Mở rộng menu để đổi chi nhánh`}
            className="grid size-10 place-items-center rounded-full border border-line text-xs font-medium hover:border-ink"
          >
            {branchBadge(activeBranchName)}
          </button>
        )}
      </div>
      <SidebarNav nav={nav} pathname={pathname} rail closedGroups={[]} onToggleGroup={toggleGroup} />
      <div className="flex flex-col items-center gap-1 border-t border-line py-3">
        <span
          title={`${displayName} (${roleLabel})`}
          className="grid size-9 place-items-center rounded-full bg-primary-soft text-xs font-medium text-primary"
          aria-label={`${displayName}, ${roleLabel}`}
        >
          {initial(displayName)}
        </span>
        <Link
          href="/admin/password"
          aria-label="Đổi mật khẩu"
          title="Đổi mật khẩu"
          className="grid size-10 place-items-center rounded-control text-muted hover:bg-hall hover:text-ink"
        >
          <KeyRound className="size-4" aria-hidden />
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            aria-label="Đăng xuất"
            title="Đăng xuất"
            className="grid size-10 place-items-center rounded-control text-shuttle-deep hover:bg-shuttle-soft"
          >
            <LogOut className="size-4" aria-hidden />
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        'theme-admin min-h-dvh bg-hall/60 text-ink lg:grid lg:transition-[grid-template-columns] lg:duration-200 motion-reduce:transition-none',
        rail ? 'lg:grid-cols-[72px_minmax(0,1fr)]' : 'lg:grid-cols-[260px_minmax(0,1fr)]',
      )}
    >
      <aside className="sticky top-0 hidden h-dvh overflow-hidden border-r border-line bg-paper lg:block">
        {rail ? railSidebar : fullSidebar(false)}
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-paper/95 px-4 backdrop-blur sm:px-6 lg:hidden">
        <Link href="/admin" className="flex min-w-0 items-center gap-2">
          <ShuttleMark className="size-7 shrink-0" />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="font-display text-lg">Rally quản trị</span>
            {activeBranchName && <span className="truncate text-xs text-muted">{activeBranchName}</span>}
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Mở menu quản trị"
          aria-expanded={open}
          className="inline-flex size-11 items-center justify-center rounded-control hover:bg-hall"
        >
          <Menu className="size-6" />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu quản trị">
          <button type="button" aria-label="Đóng menu" className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="animate-fade absolute inset-y-0 left-0 w-[86%] max-w-[340px] bg-paper shadow-lift">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Đóng menu"
              className="absolute top-3 right-3 inline-flex size-10 items-center justify-center rounded-control hover:bg-hall"
            >
              <X className="size-5" />
            </button>
            {fullSidebar(true)}
          </div>
        </div>
      )}

      <main id="main" className="min-w-0 px-4 py-5 pb-10 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        <div className={cn('mx-auto', rail ? 'max-w-7xl' : 'max-w-7xl')}>{children}</div>
      </main>
    </div>
  );
}
