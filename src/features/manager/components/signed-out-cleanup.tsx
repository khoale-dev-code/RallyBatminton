'use client';

import { useEffect } from 'react';

/**
 * Trang đăng nhập quản trị (sau khi đăng xuất): xóa bộ nhớ đệm của Rally Manager và dữ liệu tạm của phiên trước
 * trên máy dùng chung. Rally Manager vốn không lưu dữ liệu nghiệp vụ — đây là lớp phòng ngừa thêm.
 */
export function SignedOutCleanup() {
  useEffect(() => {
    try {
      window.sessionStorage.clear();
    } catch {
      // Trình duyệt chặn bộ nhớ: bỏ qua.
    }
    navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_CACHES' });
  }, []);
  return null;
}
