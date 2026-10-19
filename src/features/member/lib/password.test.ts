import { describe, expect, it } from 'vitest';

import { safeMemberNext } from '../schemas';

import { newPasswordSchema, passwordStrength } from './password';

describe('newPasswordSchema', () => {
  it('cần chữ và số, tối thiểu 8 ký tự', () => {
    expect(newPasswordSchema.safeParse('abc12345').success).toBe(true);
    expect(newPasswordSchema.safeParse('abcdefgh').success).toBe(false);
    expect(newPasswordSchema.safeParse('1234567').success).toBe(false);
  });
});

describe('passwordStrength', () => {
  it('tăng dần theo độ phức tạp', () => {
    expect(passwordStrength('abc').score).toBe(0);
    expect(passwordStrength('abcdefgh').score).toBe(1);
    expect(passwordStrength('abcd1234').score).toBe(2);
    expect(passwordStrength('Abcd1234').score).toBe(3);
    expect(passwordStrength('Abcd1234!').score).toBe(4);
  });
});

describe('safeMemberNext', () => {
  it('chỉ nhận đường dẫn nội bộ và không cho vào khu quản trị', () => {
    expect(safeMemberNext('/account/bookings')).toBe('/account/bookings');
    expect(safeMemberNext('//evil.com')).toBe('/account');
    expect(safeMemberNext('https://evil.com')).toBe('/account');
    expect(safeMemberNext('/admin')).toBe('/account');
    expect(safeMemberNext(undefined, '/')).toBe('/');
  });
});
