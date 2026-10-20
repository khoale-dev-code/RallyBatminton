'use client';

import { ImagePlus, LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState, type ChangeEvent } from 'react';

import { buttonClass } from '@/components/ui/button';
import { toast, useToastEnabled } from '@/components/ui/toast';
import { type FormState } from '@/lib/form-state';

import { uploadMediaFile } from './upload-media';

interface PhotoUploaderProps {
  /** Thư mục theo đối tượng: courts/<id>, products/<id>, branches/<id> */
  folder: 'courts' | 'products' | 'branches';
  ownerId: string;
  /** Server Action ghi đường dẫn ảnh vào bảng (RLS kiểm tra quyền). */
  onUploaded: (path: string) => Promise<FormState>;
  multiple?: boolean;
  label?: string;
  /** Đối tượng đã có ảnh → thông báo "cập nhật" thay vì "tải lên" (ảnh bìa). */
  replaces?: boolean;
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : 'Không tải được ảnh.';
}

/** Câu thông báo kết quả cho cả lượt tải (một hay nhiều ảnh, có ảnh lỗi hay không). */
function resultMessage(done: number, failed: number, replaces: boolean, firstError: string | null) {
  if (done === 0) return { tone: 'error' as const, text: firstError ?? 'Không tải được ảnh.' };
  const ok = replaces ? 'Đã cập nhật ảnh thành công.' : done === 1 ? 'Đã tải ảnh lên thành công.' : `Đã tải lên thành công ${done} ảnh.`;
  if (failed === 0) return { tone: 'success' as const, text: ok };
  return { tone: 'error' as const, text: `Đã tải lên ${done} ảnh, ${failed} ảnh lỗi: ${firstError ?? 'không tải được'}` };
}

/** Tải ảnh thẳng lên Supabase Storage bằng phiên đăng nhập (policy Storage kiểm quyền), rồi lưu đường dẫn. */
export function PhotoUploader({ folder, ownerId, onUploaded, multiple = true, label = 'Thêm ảnh', replaces = false }: PhotoUploaderProps) {
  const id = useId();
  const router = useRouter();
  const toasts = useToastEnabled();
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = progress !== null;

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;
    setError(null);
    const verb = replaces ? 'Đang cập nhật ảnh' : 'Đang tải ảnh lên';
    const loadingId = toast.loading(files.length > 1 ? `${verb} (0/${files.length})…` : `${verb}…`);

    let done = 0;
    let firstError: string | null = null;
    // Tải lần lượt từng ảnh; một ảnh lỗi không làm dừng các ảnh còn lại.
    for (const [index, file] of files.entries()) {
      const step = files.length > 1 ? `${index + 1}/${files.length}` : '';
      setProgress(step ? `Đang tải ${step}…` : 'Đang tải ảnh…');
      if (step && loadingId !== null) toast.update(loadingId, 'loading', `${verb} (${step})…`);
      try {
        const path = await uploadMediaFile(folder, ownerId, file);
        const result = await onUploaded(path);
        if (result.status === 'error') throw new Error(result.message ?? 'Không lưu được ảnh.');
        done += 1;
      } catch (e) {
        firstError ??= files.length > 1 ? `${file.name} — ${errorText(e)}` : errorText(e);
      }
    }

    const outcome = resultMessage(done, files.length - done, replaces, firstError);
    toast.update(loadingId, outcome.tone, outcome.text);
    if (outcome.tone === 'error') setError(outcome.text);
    setProgress(null);
    if (done > 0) router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={buttonClass('outline', 'md', busy ? 'pointer-events-none opacity-60' : 'cursor-pointer')}>
        {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
        {progress ?? label}
      </label>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={multiple}
        onChange={handleFiles}
        disabled={busy}
        className="sr-only"
      />
      {/* Lỗi vẫn ghi cạnh nút (kể cả khi đã có thông báo nổi) để biết ảnh nào cần tải lại. */}
      {error && (
        <p role={toasts ? undefined : 'alert'} className="text-sm text-shuttle-deep">
          {error}
        </p>
      )}
    </div>
  );
}
