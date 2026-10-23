/**
 * Đường dẫn chỉ công cụ dò lỗ hổng mới gọi (WordPress, PHP, file cấu hình lộ...). Website không có các đường dẫn này:
 * trả 404 ngay, không tốn lượt gọi Supabase / render trang. Lớp ngoài cùng vẫn là Vercel Firewall (docs/SECURITY-4-LOP.md).
 */
const PROBE_PATTERN =
  /(?:^|\/)(?:\.env|\.git|\.svn|\.hg|\.aws|\.ssh|\.htaccess|\.htpasswd|\.DS_Store|wp-admin|wp-login|wp-content|wp-includes|xmlrpc\.php|phpmyadmin|pma|cgi-bin|server-status|actuator|vendor\/phpunit)(?:\/|$|\.)|\.(?:php\d?|asp|aspx|jsp|cgi|sql|bak|old|swp|ini|log)$/i;

export function isProbePath(pathname: string): boolean {
  return PROBE_PATTERN.test(pathname);
}
