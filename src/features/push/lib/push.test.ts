import { describe, expect, it } from 'vitest';

import { deviceLabel, isAllowedPushEndpoint, pushPayload, pushTtl, urlBase64ToUint8Array, type PushItem } from './push';

describe('thông báo đẩy', () => {
  it('chỉ gửi tới dịch vụ đẩy chính thức qua https', () => {
    expect(isAllowedPushEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(isAllowedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true);
    expect(isAllowedPushEndpoint('https://web.push.apple.com/QX')).toBe(true);
    expect(isAllowedPushEndpoint('https://wns2-par02p.notify.windows.com/w/?token=x')).toBe(true);
    expect(isAllowedPushEndpoint('http://fcm.googleapis.com/fcm/send/abc')).toBe(false);
    expect(isAllowedPushEndpoint('https://fcm.googleapis.com.evil.com/x')).toBe(false);
    expect(isAllowedPushEndpoint('https://169.254.169.254/latest')).toBe(false);
    expect(isAllowedPushEndpoint('nonsense')).toBe(false);
  });
  it('nội dung chỉ trỏ vào khu quản trị', () => {
    const item: PushItem = { id: 1, kind: 'booking_new', title: 'T', body: 'B', url: 'https://evil.com', tag: null, targets: [] };
    expect(JSON.parse(pushPayload(item))).toEqual({ title: 'T', body: 'B', url: '/admin', tag: 'rally-1' });
    expect(JSON.parse(pushPayload({ ...item, url: '/admin/go?to=bank' })).url).toBe('/admin/go?to=bank');
    expect(pushTtl('booking_new')).toBe(3600);
  });
  it('đổi khóa công khai VAPID và đặt tên thiết bị', () => {
    expect(Array.from(urlBase64ToUint8Array('AQID'))).toEqual([1, 2, 3]);
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0')).toBe(
      'Edge · Windows',
    );
    expect(deviceLabel('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36')).toBe('Chrome · Android');
  });
});
