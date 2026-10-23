import { describe, expect, it } from 'vitest';


import { isProbePath } from './probe-path';

describe('chặn đường dẫn dò lỗ hổng', () => {
  it.each(['/.env', '/.env.local', '/.git/config', '/wp-admin/', '/wp-login.php', '/index.php', '/xmlrpc.php', '/phpmyadmin/', '/backup.sql', '/cgi-bin/x', '/api/.env', '/actuator/health'])(
    'chặn %s',
    (p) => expect(isProbePath(p)).toBe(true),
  );
  it.each(['/', '/booking', '/branches/quan-7', '/admin/security', '/legal/bao-mat', '/api/webhooks/sepay', '/products/vot-yonex', '/guide', '/account/privacy', '/environment-day', '/blog/git-tips'])(
    'không chặn %s',
    (p) => expect(isProbePath(p)).toBe(false),
  );
});
