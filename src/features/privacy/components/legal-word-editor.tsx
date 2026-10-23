'use client';

import {
  AlignLeft,
  Bold,
  Check,
  ChevronDown,
  Eye,
  FileText,
  Heading2,
  Heading3,
  Link2,
  List,
  ListOrdered,
  PencilLine,
  Quote,
  Redo2,
  Table2,
  Undo2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ActionForm, FieldError, SubmitButton, TextField } from '@/components/ui/form';
import { buttonClass } from '@/components/ui/button';

import { publishLegalDocumentAction } from '../actions';
import type { LegalCode } from '../consent-text';
import { BLOCK_PLACEHOLDERS, INLINE_PLACEHOLDERS, parseLegalMarkup, unknownPlaceholders, type LegalBlock } from '../lib/markup';
import type { BranchCancellation, RetentionPolicy } from '../types';
import { LegalDocumentBody } from './legal-document';
import '../legal-word-editor.css';

type Props = {
  code: LegalCode;
  initial: { title: string; summary: string; body: string };
  values: Record<string, string | null>;
  cancellation: BranchCancellation[];
  retention: RetentionPolicy[];
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function inlineToHtml(text: string): string {
  const parts = text.split(/(\{\{\s*[a-z_]+\s*\}\}|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part) => {
    const token = /^\{\{\s*([a-z_]+)\s*\}\}$/.exec(part);
    if (token) {
      const p = [...INLINE_PLACEHOLDERS, ...BLOCK_PLACEHOLDERS].find((x) => x.key === token[1]);
      const label = p?.label ?? token[1];
      return `<span class="rally-word-token" data-token="${escapeHtml(token[1])}" contenteditable="false" title="Thông tin tự động: ${escapeHtml(label)}">${escapeHtml(label)}</span>`;
    }
    if (part.startsWith('**') && part.endsWith('**')) return `<strong>${inlineToHtml(part.slice(2, -2))}</strong>`;
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link && safeLink(link[2])) return `<a href="${escapeHtml(link[2])}" rel="noopener noreferrer">${escapeHtml(link[1])}</a>`;
    return escapeHtml(part);
  }).join('');
}

function safeLink(href: string): boolean {
  return /^\/(?!\/)/.test(href) || /^https?:\/\//i.test(href) || /^mailto:/i.test(href);
}

function blocksToHtml(blocks: LegalBlock[]): string {
  return blocks.map((b) => {
    if (b.kind === 'h2') return `<h2>${inlineToHtml(b.text)}</h2>`;
    if (b.kind === 'h3') return `<h3>${inlineToHtml(b.text)}</h3>`;
    if (b.kind === 'p') return `<p>${inlineToHtml(b.text)}</p>`;
    if (b.kind === 'note') return `<blockquote>${inlineToHtml(b.text)}</blockquote>`;
    if (b.kind === 'ul' || b.kind === 'ol') return `<${b.kind}>${b.items.map((t) => `<li>${inlineToHtml(t)}</li>`).join('')}</${b.kind}>`;
    if (b.kind === 'table') {
      return `<table class="rally-word-table"><thead><tr>${b.head.map((c) => `<th>${inlineToHtml(c)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((row) => `<tr>${row.map((c) => `<td>${inlineToHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }
    if (b.kind === 'slot') {
      const label = BLOCK_PLACEHOLDERS.find((p) => p.key === b.key)?.label ?? b.key;
      return `<div class="rally-word-slot" data-slot="${escapeHtml(b.key)}" contenteditable="false"><span>🔄 ${escapeHtml(label)}</span><button type="button" data-remove-slot="true" title="Bỏ khối này khỏi văn bản">×</button></div>`;
    }
    return '';
  }).join('') || '<p></p>';
}

function inlineToMarkup(node: Node): string {
  if (node.nodeType === 3) return (node.textContent ?? '').replace(/\u00a0/g, ' ');
  if (!(node instanceof HTMLElement)) return '';
  if (node.dataset.token) return `{{${node.dataset.token}}}`;
  if (node.tagName === 'BR') return ' ';
  const inner = Array.from(node.childNodes).map(inlineToMarkup).join('');
  if (node.tagName === 'B' || node.tagName === 'STRONG') return `**${inner.replace(/\*\*/g, '')}**`;
  if (node.tagName === 'A') {
    const href = node.getAttribute('href') ?? '';
    return safeLink(href) ? `[${inner}](${href})` : inner;
  }
  return inner;
}

function elementMarkup(el: Element): string {
  if (!(el instanceof HTMLElement)) return '';
  if (el.dataset.slot) return `{{${el.dataset.slot}}}`;
  const inl = () => Array.from(el.childNodes).map(inlineToMarkup).join('').replace(/\s+/g, ' ').trim();
  switch (el.tagName) {
    case 'H2': return `## ${inl()}`;
    case 'H3': return `### ${inl()}`;
    case 'BLOCKQUOTE': return `> ${inl()}`;
    case 'UL': return Array.from(el.children).filter((c) => c.tagName === 'LI').map((c) => `- ${Array.from(c.childNodes).map(inlineToMarkup).join('').trim()}`).join('\n');
    case 'OL': return Array.from(el.children).filter((c) => c.tagName === 'LI').map((c, i) => `${i + 1}. ${Array.from(c.childNodes).map(inlineToMarkup).join('').trim()}`).join('\n');
    case 'TABLE': {
      const rows = Array.from(el.querySelectorAll('tr')).map((r) => Array.from(r.querySelectorAll('th,td')).map((c) => Array.from(c.childNodes).map(inlineToMarkup).join('').replace(/\|/g, '/').trim()));
      if (!rows.length) return '';
      const first = rows[0];
      const out = [`| ${first.join(' | ')} |`, `| ${first.map(() => '---').join(' | ')} |`];
      for (const r of rows.slice(1)) out.push(`| ${first.map((_, i) => r[i] ?? '').join(' | ')} |`);
      return out.join('\n');
    }
    case 'DIV': {
      if (Array.from(el.children).some((c) => ['DIV', 'P', 'H2', 'H3', 'OL', 'UL', 'TABLE'].includes(c.tagName)))
        return Array.from(el.children).map(elementMarkup).filter(Boolean).join('\n\n');
      return inl();
    }
    default: return inl();
  }
}

function contentToMarkup(el: HTMLElement): string {
  return (el.children.length ? Array.from(el.children).map(elementMarkup).filter(Boolean).join('\n\n') : Array.from(el.childNodes).map(inlineToMarkup).join('')).replace(/\n{3,}/g, '\n\n').trim();
}

const controls = [
  { name: 'Đoạn văn', command: 'formatBlock', value: 'p', Icon: AlignLeft },
  { name: 'Tiêu đề lớn', command: 'formatBlock', value: 'h2', Icon: Heading2 },
  { name: 'Tiêu đề nhỏ', command: 'formatBlock', value: 'h3', Icon: Heading3 },
  { name: 'In đậm', command: 'bold', value: '', Icon: Bold },
  { name: 'Danh sách', command: 'insertUnorderedList', value: '', Icon: List },
  { name: 'Đánh số', command: 'insertOrderedList', value: '', Icon: ListOrdered },
  { name: 'Ghi chú', command: 'formatBlock', value: 'blockquote', Icon: Quote },
] as const;

export function LegalEditor({ code, initial, values, cancellation, retention }: Props) {
  const [title, setTitle] = useState(initial.title);
  const [summary, setSummary] = useState(initial.summary);
  const [body, setBody] = useState(initial.body);
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkHref, setLinkHref] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [insertChoice, setInsertChoice] = useState('');
  const surface = useRef<HTMLDivElement>(null);
  const selection = useRef<Range | null>(null);
  const blocks = useMemo(() => parseLegalMarkup(body), [body]);
  const unknown = useMemo(() => unknownPlaceholders(body), [body]);
  const changed = body !== initial.body || title !== initial.title || summary !== initial.summary;

  useEffect(() => {
    if (surface.current) surface.current.innerHTML = blocksToHtml(parseLegalMarkup(initial.body));
  }, [initial.body]);

  const sync = () => {
    if (surface.current) setBody(contentToMarkup(surface.current));
  };
  const rememberSelection = () => {
    const root = surface.current;
    const s = window.getSelection();
    if (root && s?.rangeCount && root.contains(s.anchorNode)) selection.current = s.getRangeAt(0).cloneRange();
  };
  const restoreSelection = () => {
    const s = window.getSelection();
    const saved = selection.current;
    if (!s || !surface.current) return;
    surface.current.focus();
    if (saved && surface.current.contains(saved.commonAncestorContainer)) {
      s.removeAllRanges();
      s.addRange(saved);
    }
  };
  const command = (cmd: string, value?: string) => {
    restoreSelection();
    document.execCommand(cmd, false, value);
    rememberSelection();
    sync();
  };
  const addNode = (el: HTMLElement) => {
    const root = surface.current;
    if (!root) return;
    restoreSelection();
    let block: HTMLElement | null = window.getSelection()?.anchorNode instanceof Element
      ? window.getSelection()?.anchorNode as HTMLElement
      : window.getSelection()?.anchorNode?.parentElement ?? null;
    while (block && block.parentElement !== root) block = block.parentElement;
    if (block && block.parentElement === root) block.after(el);
    else root.append(el);
    root.focus();
    const next = document.createRange();
    next.selectNodeContents(el);
    next.collapse(false);
    const s = window.getSelection();
    s?.removeAllRanges();
    s?.addRange(next);
    sync();
  };
  const addToken = (key: string) => {
    const root = surface.current;
    if (!root) return;
    if (BLOCK_PLACEHOLDERS.some((x) => x.key === key)) {
      const div = document.createElement('div');
      div.className = 'rally-word-slot';
      div.dataset.slot = key;
      div.contentEditable = 'false';
      const text = document.createElement('span');
      text.textContent = `🔄 ${BLOCK_PLACEHOLDERS.find((x) => x.key === key)?.label}`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.dataset.removeSlot = 'true';
      remove.textContent = '×';
      remove.title = 'Bỏ khối này khỏi văn bản';
      div.append(text, remove);
      addNode(div);
      return;
    }
    restoreSelection();
    const span = document.createElement('span');
    span.className = 'rally-word-token';
    span.contentEditable = 'false';
    span.dataset.token = key;
    span.title = 'Thông tin cập nhật tự động';
    span.textContent = INLINE_PLACEHOLDERS.find((x) => x.key === key)?.label ?? key;
    const s = window.getSelection();
    if (s?.rangeCount && root.contains(s.anchorNode)) {
      const range = s.getRangeAt(0);
      range.deleteContents();
      range.insertNode(span);
      range.setStartAfter(span);
      range.collapse(true);
      s.removeAllRanges();
      s.addRange(range);
    } else {
      const p = document.createElement('p');
      p.append(span);
      root.append(p);
    }
    rememberSelection();
    sync();
  };
  const addTable = () => {
    const table = document.createElement('table');
    table.className = 'rally-word-table';
    table.innerHTML = '<thead><tr><th>Cột 1</th><th>Cột 2</th></tr></thead><tbody><tr><td>Nội dung</td><td>Nội dung</td></tr></tbody>';
    addNode(table);
  };
  const addLink = () => {
    if (!safeLink(linkHref.trim())) return;
    restoreSelection();
    const s = window.getSelection();
    if (s && s.rangeCount && surface.current?.contains(s.anchorNode)) {
      const range = s.getRangeAt(0);
      const a = document.createElement('a');
      a.href = linkHref.trim();
      a.textContent = linkLabel.trim() || s.toString() || 'Xem chi tiết';
      range.deleteContents();
      range.insertNode(a);
      range.setStartAfter(a);
      range.collapse(true);
      s.removeAllRanges();
      s.addRange(range);
      sync();
    } else if (surface.current) {
      const p = document.createElement('p');
      const a = document.createElement('a');
      a.href = linkHref.trim();
      a.textContent = linkLabel.trim() || 'Xem chi tiết';
      p.append(a);
      surface.current.append(p);
      sync();
    }
    setLinkOpen(false);
    setLinkHref('');
    setLinkLabel('');
  };

  return (
    <div className="rally-word-root">
      <div className="rally-word-intro">
        <div className="flex items-center gap-2"><FileText className="size-5 text-primary" aria-hidden /><strong>Soạn văn bản như Word</strong></div>
        <p>Bấm vào trang giấy để sửa trực tiếp. Bôi đen một đoạn rồi dùng thanh công cụ. Không cần biết Markdown hay HTML.</p>
      </div>
      <ActionForm action={publishLegalDocumentAction.bind(null, code)} className="gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="title" label="Tên văn bản" value={title} onChange={(e) => setTitle(e.currentTarget.value)} required maxLength={120} />
          <TextField name="summary" label="Giới thiệu ngắn" value={summary} onChange={(e) => setSummary(e.currentTarget.value)} optional maxLength={400} />
        </div>
        <div className="rally-word-frame">
          <div className="rally-word-menubar">
            <div className="rally-word-switch" role="tablist" aria-label="Chế độ soạn văn bản">
              <button type="button" role="tab" aria-selected={mode === 'write'} onClick={() => setMode('write')} className={mode === 'write' ? 'active' : ''}><PencilLine className="size-4"/> Soạn thảo</button>
              <button type="button" role="tab" aria-selected={mode === 'preview'} onClick={() => { sync(); setMode('preview'); }} className={mode === 'preview' ? 'active' : ''}><Eye className="size-4"/> Xem trước</button>
            </div>
            <span className="rally-word-hint">{changed ? '● Có thay đổi chưa đăng' : 'Đang xem phiên bản hiện tại'}</span>
          </div>
          {mode === 'write' && (
            <div className="rally-word-tools" role="toolbar" aria-label="Định dạng văn bản">
              {controls.map(({ name, command: cmd, value, Icon }) => (
                <button key={name} type="button" title={name} aria-label={name} onMouseDown={(e) => e.preventDefault()} onClick={() => command(cmd, value)}><Icon className="size-4"/><span>{name}</span></button>
              ))}
              <span className="rally-word-separator" />
              <button type="button" title="Chèn liên kết" onMouseDown={(e) => e.preventDefault()} onClick={() => { rememberSelection(); setLinkLabel(window.getSelection()?.toString() || ''); setLinkOpen((v) => !v); }}><Link2 className="size-4"/><span>Liên kết</span></button>
              <button type="button" title="Chèn bảng" onMouseDown={(e) => e.preventDefault()} onClick={addTable}><Table2 className="size-4"/><span>Bảng</span></button>
              <span className="rally-word-separator" />
              <button type="button" aria-label="Hoàn tác" title="Hoàn tác" onMouseDown={(e) => e.preventDefault()} onClick={() => command('undo')}><Undo2 className="size-4" /></button>
              <button type="button" aria-label="Làm lại" title="Làm lại" onMouseDown={(e) => e.preventDefault()} onClick={() => command('redo')}><Redo2 className="size-4" /></button>
            </div>
          )}
          {mode === 'write' && linkOpen && (
            <div className="rally-word-link-popover">
              <label>Chữ hiển thị<input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Ví dụ: Xem chính sách" /></label>
              <label>Đường dẫn<input value={linkHref} onChange={(e) => setLinkHref(e.target.value)} placeholder="/legal/bao-mat hoặc https://..." /></label>
              <button type="button" className={buttonClass('primary', 'sm')} disabled={!safeLink(linkHref.trim())} onClick={addLink}>Chèn liên kết</button>
              <button type="button" className={buttonClass('ghost', 'sm')} onClick={() => setLinkOpen(false)}>Đóng</button>
            </div>
          )}
          {mode === 'write' && (
            <div className="rally-word-insert">
              <span>Chèn thông tin tự động:</span>
              <div className="rally-word-select-wrap"><select aria-label="Chèn thông tin tự động" value={insertChoice} onChange={(e) => { setInsertChoice(''); addToken(e.target.value); }} onMouseDown={rememberSelection}>
                <option value="" disabled>Chọn thông tin cần chèn…</option>
                <optgroup label="Thông tin Rally">{INLINE_PLACEHOLDERS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</optgroup>
                <optgroup label="Bảng tự động">{BLOCK_PLACEHOLDERS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</optgroup>
              </select><ChevronDown className="size-4" aria-hidden /></div>
              <span className="rally-word-insert-note">Giá trị sẽ tự cập nhật theo cấu hình hệ thống.</span>
            </div>
          )}
          <div className={mode === 'write' ? 'rally-word-canvas' : 'hidden'}>
            <div className="rally-word-sheet" role="textbox" aria-multiline="true" aria-label="Nội dung văn bản pháp lý, chỉnh sửa trực tiếp như Word" ref={surface} contentEditable suppressContentEditableWarning spellCheck onInput={sync} onKeyUp={rememberSelection} onMouseUp={rememberSelection} onBlur={rememberSelection} onPaste={(e) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); sync(); }} onClick={(e) => { const target = e.target as HTMLElement; if (target.dataset.removeSlot) { target.closest('[data-slot]')?.remove(); sync(); } }} />
          </div>
          {mode === 'preview' && (
            <div className="rally-word-canvas">
              <div className="rally-word-sheet rally-word-preview">
                <h1>{title}</h1>{summary && <p className="rally-word-summary">{summary}</p>}
                <LegalDocumentBody blocks={blocks} values={values} cancellation={cancellation} retention={retention} />
              </div>
            </div>
          )}
          <div className="rally-word-footer">
            <span><Check className="size-4"/> Văn bản hiển thị như trên website ở chế độ Xem trước</span>
            <span>{body.length.toLocaleString('vi-VN')} ký tự</span>
          </div>
        </div>
        <input type="hidden" name="body" value={body} readOnly />
        <FieldError name="body" />
        {unknown.length > 0 && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Phát hiện thông tin tự động không hợp lệ: {unknown.join(', ')}. Hãy xóa và chèn lại bằng menu phía trên.</p>}
        <div className="rally-word-publish">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="changeNote" label="Bạn đã sửa những gì?" required maxLength={300} placeholder="Ví dụ: Cập nhật thông tin liên hệ" hint="Ghi ngắn gọn để quản lý các phiên bản." />
            <TextField name="effectiveDate" label="Ngày bắt đầu áp dụng" type="date" optional hint="Để trống nếu muốn áp dụng ngay." />
          </div>
          <p>Mỗi lần đăng sẽ tạo một <strong>phiên bản mới</strong>. Các phiên bản cũ vẫn được lưu lại.</p>
          <SubmitButton pendingLabel="Đang đăng văn bản…" disabled={!changed || unknown.length > 0 || body.trim().length < 50} className="w-full sm:w-auto">Đăng phiên bản mới</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
