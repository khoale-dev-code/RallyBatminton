#!/usr/bin/env node
/**
 * Kiểm tra KHÓA BÍ MẬT không lọt vào mã gửi xuống trình duyệt (chạy sau `npm run build`):
 *   npm run check:secrets
 * Quét .next/static (JavaScript của trình duyệt) và trang dựng sẵn (.next/server/app/*.html, *.rsc) tìm:
 *   - giá trị thật của các biến bí mật trong môi trường / .env.local (chỉ in TÊN biến, không in giá trị);
 *   - khóa Supabase dạng sb_secret_… và JWT có role "service_role".
 * Có phát hiện → thoát mã 1 (dùng được trong CI).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SECRET_NAMES = [
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TURNSTILE_SECRET_KEY',
  'SEPAY_WEBHOOK_SECRET',
  'SEPAY_WEBHOOK_API_KEY',
  'SEPAY_API_TOKEN',
  'RESEND_API_KEY',
  'CRON_SECRET',
];

function readEnvFile(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}

const env = { ...readEnvFile(join(ROOT, '.env.local')), ...process.env };
const secrets = SECRET_NAMES.map((name) => ({ name, value: env[name]?.trim() ?? '' })).filter((s) => s.value.length >= 8);

function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

function isServiceRoleJwt(token) {
  const part = token.split('.')[1];
  if (!part) return false;
  try {
    const json = JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return json && json.role === 'service_role';
  } catch {
    return false;
  }
}

const targets = [
  ...[...walk(join(ROOT, '.next', 'static'))].filter((f) => /\.(js|css|json|txt|map)$/.test(f)),
  ...[...walk(join(ROOT, '.next', 'server', 'app'))].filter((f) => /\.(html|rsc|body)$/.test(f)),
];

if (targets.length === 0) {
  console.error('Chưa có bản build (.next). Chạy `npm run build` trước.');
  process.exit(2);
}

const findings = [];
for (const file of targets) {
  const text = readFileSync(file, 'utf8');
  for (const s of secrets) if (text.includes(s.value)) findings.push(`${relative(ROOT, file)}: chứa giá trị của ${s.name}`);
  if (/sb_secret_[A-Za-z0-9_-]{10,}/.test(text)) findings.push(`${relative(ROOT, file)}: chứa khóa dạng sb_secret_…`);
  for (const m of text.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g)) {
    if (isServiceRoleJwt(m[0])) findings.push(`${relative(ROOT, file)}: chứa JWT service_role`);
  }
}

const say = (line) => process.stdout.write(`${line}\n`);
say(`Đã quét ${targets.length} tệp, ${secrets.length} biến bí mật đang cấu hình (${secrets.map((s) => s.name).join(', ') || 'không có'}).`);
if (findings.length > 0) {
  console.error('\nPHÁT HIỆN KHÓA BÍ MẬT TRONG MÃ GỬI XUỐNG TRÌNH DUYỆT:');
  for (const f of [...new Set(findings)]) console.error(`  - ${f}`);
  console.error('\nKhông deploy bản này. Đổi khóa (rotate) nếu đã lỡ deploy.');
  process.exit(1);
}
say('Không phát hiện khóa bí mật trong mã trình duyệt.');
