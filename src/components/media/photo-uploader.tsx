'use client';

import { ImagePlus, LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState, type ChangeEvent } from 'react';

import { buttonClass } from '@/components/ui/button';
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
}

/** Tải ảnh thẳng lên Supabase Storage bằng phiên đăng nhập (policy Storage kiểm quyền), rồi lưu đường dẫn. */
export function PhotoUploader({ folder, ownerId, onUploaded, multiple = true, label = 'Thêm ảnh' }: PhotoUploaderProps) {
  const id = useId();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of files) {
        const path = await uploadMediaFile(folder, ownerId, file);
        const result = await onUploaded(path);
        if (result.status === 'error') throw new Error(result.message ?? 'Không lưu được ảnh.');
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được ảnh.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={buttonClass('outline', 'md', busy ? 'pointer-events-none opacity-60' : 'cursor-pointer')}>
        {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
        {busy ? 'Đang tải ảnh…' : label}
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
      {error && (
        <p role="alert" className="text-sm text-shuttle-deep">
          {error}
        </p>
      )}
    </div>
  );
}
