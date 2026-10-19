'use client';

import { X } from 'lucide-react';
import { useId, useState, type KeyboardEvent } from 'react';

import { cn } from '@/lib/cn';

interface TagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  id?: string;
  placeholder?: string;
  suggestions?: string[];
  max?: number;
  maxLength?: number;
  invalid?: boolean;
  ariaLabel?: string;
  describedBy?: string;
}

/** Ô nhập nhiều giá trị: Enter hoặc dấu phẩy để thêm, Backspace ở ô trống để xóa giá trị cuối. */
export function TagInput({
  value,
  onChange,
  id,
  placeholder,
  suggestions = [],
  max = 20,
  maxLength = 30,
  invalid,
  ariaLabel,
  describedBy,
}: TagInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [text, setText] = useState('');
  const lower = new Set(value.map((v) => v.toLowerCase()));

  function add(raw: string) {
    const parts = raw
      .split(',')
      .map((p) => p.trim().slice(0, maxLength))
      .filter(Boolean);
    const next = [...value];
    for (const p of parts) {
      if (next.length >= max) break;
      if (!next.some((x) => x.toLowerCase() === p.toLowerCase())) next.push(p);
    }
    if (next.length !== value.length) onChange(next);
    setText('');
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (text.trim()) add(text);
    } else if (e.key === 'Backspace' && text === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  const query = text.trim().toLowerCase();
  const matches = query ? suggestions.filter((s) => s.toLowerCase().includes(query) && !lower.has(s.toLowerCase())).slice(0, 6) : [];

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          'flex min-h-11 flex-wrap items-center gap-1.5 rounded-control border bg-paper px-2 py-1.5 focus-within:border-ink focus-within:ring-2 focus-within:ring-ink/10',
          invalid ? 'border-shuttle-deep' : 'border-line',
        )}
      >
        {value.map((tag) => (
          <span key={tag} className="inline-flex max-w-full items-center gap-1 rounded-full bg-hall py-1 pr-1 pl-3 text-sm">
            <span className="truncate">{tag}</span>
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              aria-label={`Bỏ ${tag}`}
              className="grid size-6 shrink-0 place-items-center rounded-full text-muted hover:bg-line hover:text-ink"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={inputId}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => text.trim() && add(text)}
          placeholder={value.length >= max ? '' : placeholder}
          disabled={value.length >= max}
          aria-label={ariaLabel}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          enterKeyHint="done"
          className="min-h-8 min-w-[8rem] flex-1 bg-transparent px-1 text-[0.95rem] outline-none placeholder:text-muted/70"
        />
      </div>
      {matches.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Gợi ý">
          {matches.map((m) => (
            <button
              key={m}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(m)}
              className="min-h-8 rounded-full border border-dashed border-line px-3 text-sm hover:border-ink"
            >
              + {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
