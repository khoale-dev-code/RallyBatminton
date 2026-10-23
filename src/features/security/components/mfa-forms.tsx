'use client';

import { Copy, ShieldCheck, Smartphone } from 'lucide-react';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { ActionForm, SubmitButton, TextField } from '@/components/ui/form';
import { Notice } from '@/components/ui/notice';

import { startMfaEnrollAction, verifyMfaAction, type EnrollResult } from '../actions';

function CodeForm({
  factorId,
  next,
  mode,
  submitLabel,
}: {
  factorId: string;
  next: string;
  mode: 'enroll' | 'challenge';
  submitLabel: string;
}) {
  return (
    <ActionForm action={verifyMfaAction} onSuccess={() => window.location.assign(next)}>
      <input type="hidden" name="factorId" value={factorId} />
      <input type="hidden" name="mode" value={mode} />
      <TextField
        name="code"
        label="Mã 6 số trong ứng dụng"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]*"
        maxLength={7}
        placeholder="123 456"
        required
        autoFocus
        className="text-center font-mono text-xl tracking-[0.3em]"
      />
      <SubmitButton size="lg" pendingLabel="Đang kiểm tra…">
        {submitLabel}
      </SubmitButton>
    </ActionForm>
  );
}

/** Mỗi lần đăng nhập: nhập mã 6 số. */
export function MfaChallenge({ factorId, next }: { factorId: string; next: string }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-start gap-2 text-sm text-muted">
        <Smartphone className="mt-0.5 size-4 shrink-0" aria-hidden />
        Mở ứng dụng xác thực (Google Authenticator, Microsoft Authenticator…) và nhập mã của “Rally Badminton”.
      </p>
      <CodeForm factorId={factorId} next={next} mode="challenge" submitLabel="Xác nhận" />
    </div>
  );
}

/** Lần đầu: quét QR, nhập mã để kích hoạt. */
export function MfaEnroll({ next, required }: { next: string; required: boolean }) {
  const [enroll, setEnroll] = useState<EnrollResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  if (!enroll || !enroll.ok) {
    return (
      <div className="flex flex-col gap-4">
        {required && (
          <Notice tone="warning" title="Chủ sân yêu cầu xác thực 2 lớp">
            Tài khoản của bạn cần cài ứng dụng xác thực trước khi vào trang quản trị.
          </Notice>
        )}
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Cài ứng dụng xác thực miễn phí trên điện thoại: Google Authenticator hoặc Microsoft Authenticator.</li>
          <li>Bấm “Tạo mã QR”, dùng ứng dụng quét mã.</li>
          <li>Nhập mã 6 số ứng dụng hiện ra để hoàn tất.</li>
        </ol>
        {enroll && !enroll.ok && <Notice tone="error">{enroll.error}</Notice>}
        <Button size="lg" disabled={pending} onClick={() => startTransition(async () => setEnroll(await startMfaEnrollAction()))}>
          <ShieldCheck className="size-4" aria-hidden />
          {pending ? 'Đang tạo mã…' : 'Tạo mã QR'}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-center rounded-panel border border-line bg-paper p-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- mã QR dạng SVG data URI do Supabase trả về */}
        <img src={enroll.qrCode} alt="Mã QR để thêm Rally Badminton vào ứng dụng xác thực" width={192} height={192} />
      </div>
      <div className="text-sm">
        <p className="text-muted">Không quét được? Nhập khóa này vào ứng dụng:</p>
        <div className="mt-1 flex items-center gap-2">
          <code className="min-w-0 flex-1 rounded-control bg-hall px-2 py-1.5 font-mono text-xs break-all">{enroll.secret}</code>
          <Button
            size="sm"
            variant="outline"
            aria-label="Sao chép khóa"
            onClick={() => {
              void navigator.clipboard?.writeText(enroll.secret).then(() => setCopied(true));
            }}
          >
            <Copy className="size-4" aria-hidden />
            {copied ? 'Đã chép' : 'Chép'}
          </Button>
        </div>
      </div>
      <CodeForm factorId={enroll.factorId} next={next} mode="enroll" submitLabel="Kích hoạt" />
    </div>
  );
}
