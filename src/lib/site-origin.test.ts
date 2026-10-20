import { afterEach, describe, expect, it, vi } from 'vitest';

let current = new Headers();
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => current }));

const { configuredSiteUrl, siteOrigin } = await import('./site-origin');

describe('siteOrigin — địa chỉ cho mã QR chấm công', () => {
  afterEach(() => {
    current = new Headers();
    vi.unstubAllEnvs();
  });

  it('lấy đúng tên miền đang mở (header Origin của server action)', async () => {
    current = new Headers({ origin: 'https://rally-eight-tau.vercel.app', host: 'rally-eight-tau.vercel.app' });
    expect(await siteOrigin()).toBe('https://rally-eight-tau.vercel.app');
  });

  it('không có Origin → dùng x-forwarded-host / proto của Vercel', async () => {
    current = new Headers({ 'x-forwarded-host': 'san.rally.vn', 'x-forwarded-proto': 'https', host: 'internal:3000' });
    expect(await siteOrigin()).toBe('https://san.rally.vn');
  });

  it('bỏ qua Origin sai dạng (có đường dẫn / ký tự lạ)', async () => {
    current = new Headers({ origin: 'https://evil.example/x?y', host: 'rally-eight-tau.vercel.app' });
    expect(await siteOrigin()).toBe('https://rally-eight-tau.vercel.app');
  });

  it('chạy trên máy cá nhân → http://localhost', async () => {
    current = new Headers({ host: 'localhost:3000' });
    expect(await siteOrigin()).toBe('http://localhost:3000');
  });

  it('không có request: NEXT_PUBLIC_SITE_URL là localhost mà đang trên Vercel → tên miền production', () => {
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'rally-eight-tau.vercel.app');
    expect(configuredSiteUrl()).toMatch(/^(https:\/\/rally-eight-tau\.vercel\.app|https?:\/\/(?!localhost).+)$/);
  });
});
