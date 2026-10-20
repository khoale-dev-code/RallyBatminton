import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearStaffContextCache, readCachedContext, tokenCacheKey, writeCachedContext } from './context-cache';
import { type StaffContext } from './permissions';

vi.mock('server-only', () => ({}));

const ctx: StaffContext = {
  userId: 'u1',
  role: 'staff',
  displayName: 'Bảo',
  employeeId: 'e1',
  isActive: true,
  mustChangePassword: false,
  branches: [],
};

describe('bộ nhớ đệm quyền nhân sự', () => {
  beforeEach(() => clearStaffContextCache());

  it('khóa theo mã băm token: token khác (giả mạo / sửa 1 ký tự) không trúng', () => {
    const now = 1_000_000;
    writeCachedContext(tokenCacheKey('token-a'), ctx, now + 3_600_000, now);
    expect(readCachedContext(tokenCacheKey('token-a'), now + 1000)).toEqual(ctx);
    expect(readCachedContext(tokenCacheKey('token-b'), now + 1000)).toBeNull();
    expect(tokenCacheKey('token-a')).not.toContain('token-a');
  });

  it('hết hạn sau 60 giây hoặc khi token hết hạn', () => {
    const now = 1_000_000;
    writeCachedContext(tokenCacheKey('a'), ctx, now + 3_600_000, now);
    expect(readCachedContext(tokenCacheKey('a'), now + 59_000)).not.toBeNull();
    expect(readCachedContext(tokenCacheKey('a'), now + 61_000)).toBeNull();
    writeCachedContext(tokenCacheKey('b'), ctx, now + 10_000, now);
    expect(readCachedContext(tokenCacheKey('b'), now + 11_000)).toBeNull();
    writeCachedContext(tokenCacheKey('c'), ctx, now - 1, now);
    expect(readCachedContext(tokenCacheKey('c'), now)).toBeNull();
  });

  it('xóa ngay khi đổi quyền / mật khẩu', () => {
    const now = 1_000_000;
    writeCachedContext(tokenCacheKey('a'), ctx, now + 3_600_000, now);
    clearStaffContextCache();
    expect(readCachedContext(tokenCacheKey('a'), now)).toBeNull();
  });
});
