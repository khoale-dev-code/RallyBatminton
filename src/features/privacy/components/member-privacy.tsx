'use client';

import { Download, LoaderCircle } from 'lucide-react';
import { useState, useTransition } from 'react';

import { ActionForm, SubmitButton } from '@/components/ui/form';
import { buttonClass } from '@/components/ui/button';

import { exportMyDataAction, memberSetMarketingAction } from '../actions';
import { CONSENT_TEXT } from '../consent-text';
import { downloadJson } from './download-json';

/** Bật / tắt nhận tin — mỗi lần đổi lưu một bằng chứng (rút lại đồng ý có hiệu lực ngay). */
export function MarketingToggle({ enabled }: { enabled: boolean }) {
  const [checked, setChecked] = useState(enabled);
  return (
    <ActionForm action={memberSetMarketingAction} className="gap-3">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="marketing"
          checked={checked}
          onChange={(e) => setChecked(e.currentTarget.checked)}
          className="mt-0.5 size-5 shrink-0 accent-court-deep"
        />
        <span className="flex flex-col">
          <span className="font-medium">{CONSENT_TEXT.marketingAccount}</span>
          <span className="text-sm text-muted">Không bắt buộc. Tắt bất cứ lúc nào — Rally ngừng gửi tin khuyến mãi ngay.</span>
        </span>
      </label>
      <SubmitButton variant="outline" size="sm" pendingLabel="Đang lưu…" className="self-start" disabled={checked === enabled}>
        Lưu lựa chọn
      </SubmitButton>
    </ActionForm>
  );
}

/** Tải toàn bộ dữ liệu của tôi (JSON) — tạo tệp ngay trên trình duyệt, không lưu lại ở máy chủ. */
export function ExportMyData() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await exportMyDataAction();
            if (!res.ok) {
              setError(res.error);
              return;
            }
            downloadJson(res.json, res.fileName);
          })
        }
        className={buttonClass('primary', 'md', 'self-start')}
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
        {pending ? 'Đang chuẩn bị…' : 'Tải dữ liệu của tôi (.json)'}
      </button>
      {error && (
        <p role="alert" className="text-sm text-shuttle-deep">
          {error}
        </p>
      )}
    </div>
  );
}
