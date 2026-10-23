'use client';

import { useId } from 'react';

import { cn } from '@/lib/cn';

import { CONSENT_TEXT, linkifyConsent } from '../consent-text';

function ConsentText({ text }: { text: string }) {
  return (
    <>
      {linkifyConsent(text).map((p, i) =>
        p.href ? (
          <a
            key={i}
            href={p.href}
            target="_blank"
            rel="noopener"
            className="font-medium text-court-deep underline decoration-court/60 underline-offset-[3px] hover:decoration-court-deep"
          >
            {p.text}
          </a>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

/**
 * Hai ô TÁCH RIÊNG, KHÔNG chọn sẵn (Điều 9 Luật 91/2025; Điều 6 NĐ 356/2025):
 *  - terms (bắt buộc): xác nhận điều khoản + đã được cung cấp chính sách bảo vệ dữ liệu;
 *  - marketing (không bắt buộc): đồng ý nhận tin khuyến mãi — không ảnh hưởng việc đặt sân / đăng ký.
 * Câu chữ hiển thị đúng như câu máy chủ lưu làm bằng chứng.
 */
export function ConsentChecks({ kind, termsError, className }: { kind: 'booking' | 'account'; termsError?: string; className?: string }) {
  const id = useId();
  const termsText = kind === 'booking' ? CONSENT_TEXT.bookingTerms : CONSENT_TEXT.accountTerms;
  const errorId = `${id}-terms-error`;
  return (
    <fieldset className={cn('flex flex-col gap-2.5 rounded-control border border-line bg-hall/50 p-3 sm:p-4', className)}>
      <legend className="sr-only">Xác nhận và đồng ý</legend>
      <div className="flex items-start gap-3">
        <input
          id={`${id}-terms`}
          name="terms"
          type="checkbox"
          required
          aria-invalid={Boolean(termsError)}
          aria-describedby={termsError ? errorId : undefined}
          className="mt-0.5 size-5 shrink-0 accent-court-deep"
        />
        <label htmlFor={`${id}-terms`} className="text-[0.92rem] leading-relaxed">
          <ConsentText text={termsText} />
          <span className="text-shuttle-deep" aria-hidden>
            {' '}
            *
          </span>
        </label>
      </div>
      {termsError && (
        <p id={errorId} className="pl-8 text-sm text-shuttle-deep">
          {termsError}
        </p>
      )}
      <div className="flex items-start gap-3">
        <input id={`${id}-marketing`} name="marketing" type="checkbox" className="mt-0.5 size-5 shrink-0 accent-court-deep" />
        <label htmlFor={`${id}-marketing`} className="text-[0.92rem] leading-relaxed text-ink/80">
          {CONSENT_TEXT.marketing}
        </label>
      </div>
    </fieldset>
  );
}
