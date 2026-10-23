/** Tải chuỗi JSON thành tệp ngay trên trình duyệt (không lưu ở máy chủ). */
export function downloadJson(json: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
