import { useSyncExternalStore } from 'react';

import { offlineSaleSchema, type OfflineSale } from './lib';

/**
 * Hàng đợi đơn bán khi mất mạng trên máy (IndexedDB — còn nguyên khi tắt ứng dụng / mất điện).
 * Đăng xuất KHÔNG xóa hàng đợi: đây là tiền đã thu, phải được gửi lên. Không có thông tin khách trong hàng đợi.
 */
const DB_NAME = 'rally-offline-pos';
const STORE = 'sales';

let snapshot: OfflineSale[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function emit(next: OfflineSale[]) {
  snapshot = next;
  loaded = true;
  for (const l of listeners) l();
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB không khả dụng'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Không mở được bộ nhớ máy'));
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = work(tx.objectStore(STORE));
      let result: T;
      req.onsuccess = () => {
        result = req.result;
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error ?? new Error('Lỗi bộ nhớ máy'));
      tx.onabort = () => reject(tx.error ?? new Error('Lỗi bộ nhớ máy'));
    });
  } finally {
    db.close();
  }
}

/** Đọc lại toàn bộ hàng đợi (bỏ bản ghi hỏng). */
export async function refreshOfflineSales(): Promise<OfflineSale[]> {
  try {
    const rows = await run<unknown[]>('readonly', (s) => s.getAll());
    const valid = rows.flatMap((r) => {
      const parsed = offlineSaleSchema.safeParse(r);
      return parsed.success ? [parsed.data] : [];
    });
    emit(valid);
  } catch {
    emit(snapshot);
  }
  return snapshot;
}

/** Lưu đơn vào hàng đợi. Lỗi (bộ nhớ đầy / bị chặn) được ném ra để quầy báo ngay — không được "mất" đơn im lặng. */
export async function saveOfflineSale(sale: OfflineSale): Promise<void> {
  const checked = offlineSaleSchema.parse(sale);
  await run('readwrite', (s) => s.put(checked));
  await refreshOfflineSales();
}

export async function removeOfflineSale(id: string): Promise<void> {
  await run('readwrite', (s) => s.delete(id));
  await refreshOfflineSales();
}

export function getOfflineSalesSnapshot(): OfflineSale[] {
  return snapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!loaded) void refreshOfflineSales();
  // Tab / cửa sổ khác của Rally Manager thay đổi hàng đợi → đọc lại khi quay lại.
  const onFocus = () => void refreshOfflineSales();
  window.addEventListener('focus', onFocus);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('focus', onFocus);
  };
}

const EMPTY: OfflineSale[] = [];

export function useOfflineSales(): OfflineSale[] {
  return useSyncExternalStore(subscribe, getOfflineSalesSnapshot, () => EMPTY);
}
