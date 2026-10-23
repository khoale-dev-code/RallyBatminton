'use client';

import { Info, Mail, MailCheck, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { useActionState, useId, useState } from 'react';

import { ActionForm, PasswordField, SubmitButton, TextField, useFormFieldError } from '@/components/ui/form';
import { Turnstile } from '@/features/booking/components/turnstile';
import { ConsentChecks } from '@/features/privacy/components/consent-checks';
import { CONSENT_TEXT, linkifyConsent } from '@/features/privacy/consent-text';
import { cn } from '@/lib/cn';
import { initialFormState } from '@/lib/form-state';

import { forgotPasswordAction, googleSignInAction, memberSignInAction, registerAction, resetPasswordAction } from '../actions';
import { passwordStrength } from '../lib/password';

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" />
    </svg>
  );
}

/** Nút "Tiếp tục với Google" (Server Action trả về địa chỉ đăng nhập Google). */
export function GoogleButton({ next, label = 'Tiếp tục với Google' }: { next?: string; label?: string }) {
  const [state, action, pending] = useActionState(googleSignInAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-2">
      {next && <input type="hidden" name="next" value={next} />}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-control border border-line bg-paper px-4 font-medium transition-colors hover:border-ink/40 hover:bg-hall disabled:opacity-60"
      >
        <GoogleLogo />
        {pending ? 'Đang chuyển tới Google…' : label}
      </button>
      <p className="text-center text-xs leading-relaxed text-muted">
        {linkifyConsent(CONSENT_TEXT.accountTermsGoogle).map((p, i) =>
          p.href ? (
            <a key={i} href={p.href} target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-ink">
              {p.text}
            </a>
          ) : (
            <span key={i}>{p.text}</span>
          ),
        )}
      </p>
      {state.status === 'error' && (
        <p role="alert" className="animate-fade flex items-start gap-2 rounded-control bg-amber-soft px-3 py-2.5 text-sm text-amber-deep">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.message}
        </p>
      )}
    </form>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-xs tracking-wide text-muted uppercase" role="separator">
      <span className="h-px flex-1 bg-line" />
      hoặc
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

// ---------------------------------------------------------------------------
export function MemberLoginForm({ next }: { next?: string }) {
  return (
    <ActionForm action={memberSignInAction}>
      {next && <input type="hidden" name="next" value={next} />}
      <TextField
        name="login"
        label="Số điện thoại hoặc email"
        autoComplete="username"
        inputMode="email"
        placeholder="0912 345 678 hoặc ban@email.com"
        required
        autoFocus
      />
      <div className="flex flex-col gap-1.5">
        <PasswordField name="password" label="Mật khẩu" autoComplete="current-password" required />
        <Link href="/forgot-password" className="self-end text-sm font-medium text-court-deep underline-offset-4 hover:underline">
          Quên mật khẩu?
        </Link>
      </div>
      <SubmitButton variant="brand" size="lg" pendingLabel="Đang đăng nhập…">
        Đăng nhập
      </SubmitButton>
    </ActionForm>
  );
}

// ---------------------------------------------------------------------------
function StrengthMeter({ value }: { value: string }) {
  if (!value) return null;
  const s = passwordStrength(value);
  const colors = ['bg-shuttle', 'bg-shuttle', 'bg-[#e8b923]', 'bg-court', 'bg-court-strong'];
  return (
    <div className="flex items-center gap-2" aria-live="polite">
      <div className="grid flex-1 grid-cols-4 gap-1">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn('h-1.5 rounded-full', i <= s.score ? colors[s.score] : 'bg-line')} />
        ))}
      </div>
      <span className="w-20 text-right text-xs text-muted">{s.label}</span>
    </div>
  );
}

/** Ô xác nhận điều khoản (bắt buộc) + nhận tin (tự chọn) — lỗi hiện ngay dưới ô. */
function AccountConsent() {
  return <ConsentChecks kind="account" termsError={useFormFieldError('terms')} />;
}

function TurnstileField({ siteKey }: { siteKey: string }) {
  const [token, setToken] = useState('');
  const error = useFormFieldError('turnstileToken');
  if (!siteKey) return <input type="hidden" name="turnstileToken" value="dev-no-turnstile" />;
  return (
    <div className="flex flex-col gap-1">
      <input type="hidden" name="turnstileToken" value={token} />
      <Turnstile siteKey={siteKey} onToken={(t) => setToken(t ?? '')} resetSignal={0} action="member_auth" />
      {error && <p className="text-sm text-shuttle-deep">{error}</p>}
    </div>
  );
}

type Method = 'phone' | 'email';

function MethodTabs({ method, onChange }: { method: Method; onChange: (m: Method) => void }) {
  const tabs: Array<{ key: Method; label: string; icon: typeof Smartphone }> = [
    { key: 'phone', label: 'Số điện thoại', icon: Smartphone },
    { key: 'email', label: 'Email', icon: Mail },
  ];
  return (
    <div role="tablist" aria-label="Đăng ký bằng" className="grid grid-cols-2 gap-1 rounded-control bg-hall p-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={method === t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            'inline-flex min-h-10 items-center justify-center gap-2 rounded-[0.4rem] text-sm font-medium transition-colors',
            method === t.key ? 'bg-paper text-ink shadow-sm' : 'text-muted hover:text-ink',
          )}
        >
          <t.icon className="size-4" aria-hidden />
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function RegisterForm({ turnstileSiteKey, next }: { turnstileSiteKey: string; next?: string }) {
  const [method, setMethod] = useState<Method>('phone');
  const [password, setPassword] = useState('');
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const hintId = useId();

  if (sentMessage) {
    return (
      <div className="animate-fade flex flex-col items-center gap-4 rounded-panel bg-court-soft p-6 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-court text-on-court">
          <MailCheck className="size-7" aria-hidden />
        </span>
        <p className="font-display text-2xl">Kiểm tra hộp thư</p>
        <p className="text-sm text-court-deep">{sentMessage}</p>
        <Link href="/login" className="text-sm font-medium underline underline-offset-4">
          Đã kích hoạt? Đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <MethodTabs method={method} onChange={setMethod} />
      <ActionForm key={method} action={registerAction} onSuccess={(s) => setSentMessage(s.message ?? 'Đã gửi thư kích hoạt.')}>
        <input type="hidden" name="method" value={method} />
        {next && <input type="hidden" name="next" value={next} />}
        <TextField name="full_name" label="Họ và tên" autoComplete="name" required maxLength={80} />
        {method === 'phone' ? (
          <TextField
            name="phone"
            label="Số điện thoại"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0912 345 678"
            hint="Dùng số này để đăng nhập. Số được điền sẵn khi bạn đặt sân."
            required
          />
        ) : (
          <>
            <TextField name="email" label="Email" type="email" autoComplete="email" placeholder="ban@email.com" required />
            <TextField
              name="phone"
              label="Số điện thoại"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0912 345 678"
              optional
              hint="Thêm số để đăng nhập bằng SĐT và đặt sân nhanh hơn."
            />
          </>
        )}
        <div className="flex flex-col gap-2">
          <PasswordField
            name="password"
            label="Mật khẩu"
            autoComplete="new-password"
            required
            aria-describedby={hintId}
            onChange={(e) => setPassword(e.currentTarget.value)}
          />
          <StrengthMeter value={password} />
          <p id={hintId} className="text-xs text-muted">
            Tối thiểu 8 ký tự, gồm chữ và số.
          </p>
        </div>
        <PasswordField name="confirm" label="Nhập lại mật khẩu" autoComplete="new-password" required />
        {method === 'phone' && (
          <p className="rounded-control bg-hall px-3 py-2 text-xs leading-relaxed text-muted">
            Tài khoản bằng số điện thoại khi quên mật khẩu sẽ được cấp lại tại quầy hoặc qua hotline. Muốn tự lấy lại qua email, hãy chọn
            tab <strong className="font-semibold text-ink">Email</strong>.
          </p>
        )}
        <AccountConsent />
        <TurnstileField siteKey={turnstileSiteKey} />
        <SubmitButton variant="brand" size="lg" pendingLabel="Đang tạo tài khoản…">
          Tạo tài khoản
        </SubmitButton>
      </ActionForm>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function ForgotPasswordForm() {
  return (
    <ActionForm action={forgotPasswordAction}>
      <TextField
        name="login"
        label="Email hoặc số điện thoại đã đăng ký"
        autoComplete="username"
        placeholder="ban@email.com"
        required
        autoFocus
      />
      <SubmitButton variant="brand" size="lg" pendingLabel="Đang gửi…">
        Gửi liên kết đặt lại
      </SubmitButton>
    </ActionForm>
  );
}

export function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  return (
    <ActionForm action={resetPasswordAction}>
      <div className="flex flex-col gap-2">
        <PasswordField
          name="password"
          label="Mật khẩu mới"
          autoComplete="new-password"
          required
          autoFocus
          onChange={(e) => setPassword(e.currentTarget.value)}
        />
        <StrengthMeter value={password} />
      </div>
      <PasswordField name="confirm" label="Nhập lại mật khẩu mới" autoComplete="new-password" required />
      <SubmitButton variant="brand" size="lg" pendingLabel="Đang lưu…">
        Lưu mật khẩu mới
      </SubmitButton>
    </ActionForm>
  );
}

export { StrengthMeter };
