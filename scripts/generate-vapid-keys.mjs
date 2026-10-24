// Tạo cặp khóa VAPID cho thông báo đẩy của Rally Manager (chạy MỘT lần: npm run push:keys).
// Dán 2 dòng in ra vào .env.local và Vercel → Settings → Environment Variables. KHÔNG commit khóa riêng.
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
process.stdout.write(
  [
    '# Thông báo đẩy Rally Manager — đổi khóa thì mọi thiết bị phải bật thông báo lại.',
    `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`,
    `VAPID_PRIVATE_KEY=${privateKey}`,
    '# Email liên hệ gửi kèm cho dịch vụ đẩy (Google / Apple / Mozilla):',
    'VAPID_SUBJECT=mailto:chusan@vidu.vn',
    '',
  ].join('\n'),
);
