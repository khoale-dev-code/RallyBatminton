'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { TagInput } from '@/components/ui/tag-input';
import { cn } from '@/lib/cn';

import { ATTRIBUTE_PRESETS } from '../../lib/product-draft';

/** Gợi ý giá trị theo tên thuộc tính. */
const VALUE_SUGGESTIONS: Array<{ match: RegExp; values: string[] }> = [
  { match: /kích thước|size/i, values: ['S', 'M', 'L', 'XL', 'XXL', '38', '39', '40', '41', '42', '43', '3U', '4U'] },
  { match: /màu/i, values: ['Đen', 'Trắng', 'Đỏ', 'Xanh lá', 'Xanh dương', 'Vàng', 'Cam', 'Hồng', 'Xám'] },
  { match: /dung tích/i, values: ['250ml', '330ml', '350ml', '500ml', '1L', '1.5L'] },
  { match: /hương vị|vị/i, values: ['Chanh', 'Cam', 'Dâu', 'Đào', 'Nguyên bản'] },
  { match: /chất liệu/i, values: ['Cotton', 'Polyester', 'Da', 'Vải lưới'] },
  { match: /trọng lượng/i, values: ['3U', '4U', '5U', '100g', '500g'] },
];

interface AttributeRowProps {
  slot: 1 | 2;
  name: string;
  values: string[];
  otherName: string | null;
  onName: (name: string) => void;
  onValues: (values: string[]) => void;
  onRemove: () => void;
  nameError?: string;
}

/** Một thuộc tính biến thể (kiểu Haravan): chọn tên thuộc tính, nhập giá trị, bấm "Xong" để thu gọn. */
export function AttributeRow({ slot, name, values, otherName, onName, onValues, onRemove, nameError }: AttributeRowProps) {
  const [editing, setEditing] = useState(values.length === 0);
  const suggestions = VALUE_SUGGESTIONS.find((s) => s.match.test(name))?.values ?? [];
  const nameId = `attr-name-${slot}`;
  const valuesId = `attr-values-${slot}`;
  const presets = ATTRIBUTE_PRESETS.filter((p) => p.toLowerCase() !== (otherName ?? '').toLowerCase());

  if (!editing) {
    return (
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2 border-t border-line py-4 first:border-t-0">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{name || 'Thuộc tính'}</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {values.map((v) => (
              <li key={v} className="rounded-full bg-hall px-3 py-1 text-sm">
                {v}
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-control border border-line px-3 text-sm hover:border-ink"
        >
          <Pencil className="size-4" aria-hidden />
          Sửa
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-3 border-t border-line py-4 first:border-t-0 md:grid-cols-[minmax(0,13rem)_auto_minmax(0,1fr)] md:gap-x-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor={nameId} className="text-sm font-medium text-muted">
          Thuộc tính
        </label>
        <select
          id={nameId}
          value={presets.includes(name) ? name : '__custom'}
          onChange={(e) => onName(e.target.value === '__custom' ? '' : e.target.value)}
          className="min-h-11 w-full rounded-control border border-line bg-paper px-3"
        >
          {presets.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
          <option value="__custom">Khác (tự đặt tên)</option>
        </select>
        {!presets.includes(name) && (
          <input
            value={name}
            onChange={(e) => onName(e.target.value)}
            maxLength={30}
            placeholder="Tên thuộc tính, ví dụ: Độ cứng"
            aria-label="Tên thuộc tính tự đặt"
            aria-invalid={nameError ? true : undefined}
            className={cn('min-h-11 rounded-control border bg-paper px-3', nameError ? 'border-shuttle-deep' : 'border-line')}
          />
        )}
        {nameError && <p className="text-sm text-shuttle-deep">{nameError}</p>}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Xóa thuộc tính ${name || slot}`}
        title="Xóa thuộc tính"
        className="mt-7 grid size-11 place-items-center rounded-control text-shuttle-deep hover:bg-shuttle-soft"
      >
        <Trash2 className="size-5" aria-hidden />
      </button>
      <div className="col-span-2 flex min-w-0 flex-col gap-1.5 md:col-span-1">
        <label htmlFor={valuesId} className="text-sm font-medium text-muted">
          Giá trị
        </label>
        <TagInput id={valuesId} value={values} onChange={onValues} suggestions={suggestions} placeholder="Thêm giá trị mới" />
        <p className="text-xs text-muted">Enter hoặc dấu phẩy để thêm từng giá trị.</p>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={values.length === 0 || !name.trim()}
          className="mt-1 inline-flex min-h-10 items-center self-start rounded-control border border-court-deep/50 px-5 text-sm font-medium text-court-deep hover:bg-court-soft disabled:opacity-40"
        >
          Xong
        </button>
      </div>
    </div>
  );
}
