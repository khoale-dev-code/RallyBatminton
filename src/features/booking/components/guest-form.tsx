'use client';

import { BadgeCheck, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';

import { useMember } from '@/features/member/hooks/use-member';
import { formatPhone } from '@/lib/format';

import { buttonClass } from '@/components/ui/button';
import { cn } from '@/lib/cn';

import { Turnstile } from './turnstile';

export interface GuestFormValues {
  contactName: string;
  phone: string;
  note?: string;
  turnstileToken: string;
}

interface GuestFormProps {
  turnstileSiteKey: string;
  holdMinutes: number;
  pending: boolean;
  error: string | null;
  fieldErrors: Partial<Record<string, string>>;
  turnstileReset: number;
  onSubmit: (values: GuestFormValues) => void;
}

const inputClass =
  'min-h-11 w-full rounded-control border border-line bg-paper px-3 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10 aria-[invalid=true]:border-shuttle-deep';

export function GuestForm({ turnstileSiteKey, holdMinutes, pending, error, fieldErrors, turnstileReset, onSubmit }: GuestFormProps) {
  const id = useId();
  const [token, setToken] = useState<string | null>(turnstileSiteKey ? null : 'dev-no-turnstile');
  const member = useMember();
  const pathname = usePathname();
  const profile = member.status === 'member' ? member.profile : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSubmit({
      contactName: String(data.get('contactName') ?? ''),
      phone: String(data.get('phone') ?? ''),
      note: String(data.get('note') ?? '') || undefined,
      turnstileToken: token ?? '',
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      {profile ? (
        <p className="flex items-center gap-2 rounded-control bg-court-soft px-3 py-2 text-sm text-court-deep">
          <BadgeCheck className="size-4 shrink-0" aria-hidden />
          <span>
            Đặt bằng tài khoản <strong className="font-semibold">{profile.full_name}</strong> — đơn tự lưu và được tích điểm.
          </span>
        </p>
      ) : member.status === 'guest' ? (
        <p className="text-sm text-muted">
          Có tài khoản thành viên?{' '}
          <Link
            href={`/login?next=${encodeURIComponent(pathname)}`}
            className="font-medium text-court-deep underline-offset-4 hover:underline"
          >
            Đăng nhập
          </Link>{' '}
          để tự điền thông tin và tích điểm.
        </p>
      ) : null}
      <div key={profile?.user_id ?? 'guest'} className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-name`} className="text-sm font-medium">
            Họ tên
          </label>
          <input
            id={`${id}-name`}
            name="contactName"
            defaultValue={profile?.full_name ?? ''}
            autoComplete="name"
            required
            maxLength={80}
            aria-invalid={Boolean(fieldErrors.contactName)}
            className={inputClass}
          />
          {fieldErrors.contactName && <p className="text-sm text-shuttle-deep">{fieldErrors.contactName}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-phone`} className="text-sm font-medium">
            Số điện thoại
          </label>
          <input
            id={`${id}-phone`}
            name="phone"
            defaultValue={profile?.phone ? formatPhone(profile.phone) : ''}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            placeholder="0912 345 678"
            aria-invalid={Boolean(fieldErrors.phone)}
            className={inputClass}
          />
          {fieldErrors.phone && <p className="text-sm text-shuttle-deep">{fieldErrors.phone}</p>}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-note`} className="text-sm font-medium">
          Ghi chú <span className="font-normal text-muted">(không bắt buộc)</span>
        </label>
        <input id={`${id}-note`} name="note" maxLength={300} placeholder="Ví dụ: cần thuê thêm 2 vợt" className={inputClass} />
      </div>
      {turnstileSiteKey && <Turnstile siteKey={turnstileSiteKey} onToken={setToken} resetSignal={turnstileReset} />}
      {fieldErrors.turnstileToken && <p className="text-sm text-shuttle-deep">{fieldErrors.turnstileToken}</p>}
      {error && (
        <p role="alert" className="rounded-control bg-shuttle-soft px-3 py-2 text-sm text-shuttle-deep">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          Sân được giữ {holdMinutes} phút để chi nhánh xác nhận.{profile ? '' : ' Không cần tạo tài khoản.'}
        </p>
        <button type="submit" disabled={pending || !token} className={cn(buttonClass('primary', 'lg'), 'w-full sm:w-auto')}>
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {pending ? 'Đang giữ sân…' : 'Giữ sân'}
        </button>
      </div>
    </form>
  );
}
