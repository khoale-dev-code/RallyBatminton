import { Bell, ClockCheck, Gauge, Landmark, Palette, Receipt, ShieldCheck } from 'lucide-react';

/** Các mục của trang Cài đặt thương hiệu (mỗi lần hiện một mục: /admin/settings?muc=…). */
export const SETTINGS_SECTIONS = [
  { id: 'thuong-hieu', label: 'Thương hiệu', icon: Palette },
  { id: 'chuyen-khoan', label: 'Chuyển khoản SePay', icon: Landmark },
  { id: 'thong-bao', label: 'Email cảnh báo', icon: Bell },
  { id: 'thue', label: 'Thuế', icon: Receipt },
  { id: 'phap-ly', label: 'Pháp lý & dữ liệu', icon: ShieldCheck },
  { id: 'cham-cong', label: 'Chấm công', icon: ClockCheck },
  { id: 'toc-do', label: 'Tốc độ máy chủ', icon: Gauge },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id'];

export function isSettingsSection(value: string | undefined): value is SettingsSectionId {
  return SETTINGS_SECTIONS.some((s) => s.id === value);
}
