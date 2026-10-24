import { type ReactNode } from 'react';

import { cn } from '@/lib/cn';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right';
  /** Ẩn trên màn hình hẹp (thông tin phụ). */
  wide?: boolean;
}

/** Bảng số liệu: cuộn ngang trên điện thoại, số căn phải, hàng mảnh. */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  empty = 'Chưa có số liệu trong khoảng này.',
  caption,
  limit,
}: {
  rows: T[];
  columns: Array<Column<T>>;
  rowKey: (row: T, index: number) => string;
  empty?: string;
  caption?: string;
  /** Hiện N dòng đầu, phần còn lại thu gọn (xem đủ trong file Excel). */
  limit?: number;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  if (limit !== undefined && rows.length > limit) {
    return (
      <div className="flex flex-col gap-2">
        <DataTable rows={rows.slice(0, limit)} columns={columns} rowKey={rowKey} caption={caption} />
        <details className="group">
          <summary className="cursor-pointer py-2 text-sm text-primary hover:underline">Xem thêm {rows.length - limit} dòng</summary>
          <DataTable rows={rows.slice(limit)} columns={columns} rowKey={(r, i) => rowKey(r, i + limit)} caption={caption} />
        </details>
      </div>
    );
  }
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-[30rem] text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-line text-xs text-muted">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  'px-4 py-2 font-medium whitespace-nowrap sm:px-3',
                  c.align === 'right' && 'text-right',
                  c.wide && 'hidden md:table-cell',
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={rowKey(r, i)} className="border-b border-line/70 last:border-0">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    'px-4 py-2.5 align-top sm:px-3',
                    c.align === 'right' && 'text-right whitespace-nowrap tabular',
                    c.wide && 'hidden md:table-cell',
                  )}
                >
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
