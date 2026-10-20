'use client';

import { Gauge } from 'lucide-react';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

import { measureServerSpeedAction, type SpeedReport } from '../actions';

function verdict(ms: number): { tone: string; label: string; advice: string } {
  if (ms <= 40)
    return {
      tone: 'bg-court-soft text-court-deep',
      label: 'Tốt',
      advice: 'Máy chủ web và database ở gần nhau. Trang mở chậm thì không phải do đường truyền.',
    };
  if (ms <= 120)
    return {
      tone: 'bg-amber-soft text-amber-deep',
      label: 'Tạm được',
      advice: 'Có thể nhanh hơn nếu máy chủ web chạy cùng vùng với database (xem hướng dẫn bên dưới).',
    };
  return {
    tone: 'bg-shuttle-soft text-shuttle-deep',
    label: 'Chậm — hai máy chủ ở xa nhau',
    advice: 'Mỗi lần mở trang phải chờ vài lượt như thế này. Đặt máy chủ web cùng vùng với database (xem hướng dẫn bên dưới).',
  };
}

/** Nút đo tốc độ máy chủ web ↔ database (chủ sân). */
export function ServerSpeed() {
  const [report, setReport] = useState<SpeedReport | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  const v = report ? verdict(report.median) : null;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setFailed(false);
              try {
                setReport(await measureServerSpeedAction());
              } catch {
                setFailed(true);
              }
            })
          }
        >
          <Gauge className="size-4" aria-hidden />
          {pending ? 'Đang đo…' : report ? 'Đo lại' : 'Đo tốc độ'}
        </Button>
      </div>
      {failed && <p className="text-sm text-shuttle-deep">Không đo được. Thử lại sau.</p>}
      {report && v && (
        <div className="flex flex-col gap-2 text-sm" role="status">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-display text-2xl tabular">{report.median} ms</span>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', v.tone)}>{v.label}</span>
            <span className="text-muted">mỗi lượt hỏi database · nhanh nhất {report.best} ms</span>
          </p>
          <p className="text-muted">
            Máy chủ web: <strong className="text-ink">{report.region ? `Vercel ${report.region}` : 'máy của bạn (đang chạy thử)'}</strong>.{' '}
            {v.advice}
          </p>
        </div>
      )}
    </div>
  );
}
