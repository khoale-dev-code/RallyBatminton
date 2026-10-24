/**
 * Lưu sự kiện "có thể cài ứng dụng" (beforeinstallprompt) của trình duyệt Chrome / Edge.
 * Sự kiện chỉ bắn một lần lúc tải trang, nên bắt ngay ở khung quản trị rồi trang "Cài ứng dụng" dùng lại.
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function subscribeInstall(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getInstallPrompt = () => deferred;
export const getInstalled = () => installed;

export function setInstallPrompt(event: BeforeInstallPromptEvent | null) {
  deferred = event;
  emit();
}

export function markInstalled() {
  installed = true;
  deferred = null;
  emit();
}

/** Mở hộp thoại cài của trình duyệt. Trả về true nếu người dùng đồng ý. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  await event.prompt();
  const choice = await event.userChoice;
  deferred = null;
  emit();
  return choice.outcome === 'accepted';
}
