import { type Metadata } from 'next';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Fingerprint,
  LockKeyhole,
  MonitorCheck,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';

import { ActionButton } from '@/components/ui/action-button';
import { LinkButton } from '@/components/ui/button';
import { LinkTabs } from '@/components/ui/link-tabs';
import { ActionForm, CheckboxField, SubmitButton, TextareaField, TextField } from '@/components/ui/form';
import { Notice } from '@/components/ui/notice';
import { Badge, EmptyState, Panel } from '@/components/ui/primitives';
import {
  acknowledgeAllSecurityEventsAction,
  acknowledgeSecurityEventAction,
  removeMyMfaAction,
  resetStaffMfaAction,
  setOnlineBookingPauseAction,
  updateMfaPolicyAction,
  updateSecurityLimitsAction,
} from '@/features/security/actions';
import { EVENT_INFO, SEVERITY_INFO } from '@/features/security/lib/events';
import { LIMIT_FIELDS, LIMIT_GROUPS } from '@/features/security/lib/settings';
import { getSecuritySettings, listRestrictedCustomers, listSecurityEvents, listStaffMfa } from '@/features/security/queries';
import { HOLD_LEVEL_INFO } from '@/features/security/types';
import { requireStaff } from '@/lib/auth/guards';
import { formatDate, formatDateTime, formatPhone } from '@/lib/format';
import '@/features/security/rally-security-admin-v18.css';

export const metadata: Metadata = { title: 'Bảo mật' };

function SecurityHeading({ subtitle }: { subtitle?: string }) {
  return (
    <header className="rsec18-heading">
      <div className="rsec18-eyebrow"><ShieldCheck size={15} aria-hidden="true" /> TRUNG TÂM BẢO MẬT</div>
      <h1>Bảo mật hệ thống</h1>
      <p>{subtitle ?? 'Theo dõi rủi ro, bảo vệ tài khoản quản trị và kiểm soát an toàn đặt sân online tại Rally.'}</p>
    </header>
  );
}

function MyMfaPanel({ enrolled, aal, required }: { enrolled: boolean; aal: 'aal1' | 'aal2'; required: boolean }) {
  return (
    <Panel
      id="bao-ve-tai-khoan"
      className="rsec18-panel rsec18-main-panel"
      title="Xác thực 2 lớp của bạn"
      description="Thêm một bước xác thực khi đăng nhập để bảo vệ tài khoản quản trị, kể cả khi mật khẩu bị lộ."
    >
      <div className="rsec18-mfa-status">
        <span className="rsec18-mfa-icon" aria-hidden="true"><Fingerprint size={23} /></span>
        <div className="rsec18-mfa-copy">
          <strong>{enrolled ? 'Bạn đã thiết lập xác thực 2 lớp' : 'Tài khoản chưa bật xác thực 2 lớp'}</strong>
          <span>{enrolled ? 'Sử dụng mã từ ứng dụng xác thực để bảo vệ phiên đăng nhập.' : 'Khuyến nghị kích hoạt trước khi thao tác dữ liệu khách hàng hoặc thay đổi cấu hình.'}</span>
        </div>
        <Badge tone={enrolled ? 'green' : 'amber'}>{enrolled ? 'Đã bật' : 'Chưa bật'}</Badge>
      </div>
      {(enrolled || required) && (
        <div className="rsec18-small-notes">
          {enrolled && <Badge tone={aal === 'aal2' ? 'green' : 'neutral'}>{aal === 'aal2' ? 'Phiên đã xác minh MFA' : 'Phiên chưa xác minh MFA'}</Badge>}
          {required && <Badge tone="ink">Vai trò yêu cầu MFA</Badge>}
        </div>
      )}
      <div className="rsec18-action-row">
        {!enrolled && <LinkButton href="/admin-mfa?next=/admin/security" variant="primary" size="sm">Bật xác thực 2 lớp</LinkButton>}
        {enrolled && aal === 'aal2' && <LinkButton href="/admin-mfa?setup=1&next=/admin/security" size="sm">Thêm thiết bị xác thực</LinkButton>}
        {enrolled && !required && (
          <ActionButton
            action={removeMyMfaAction}
            label="Gỡ xác thực 2 lớp"
            pendingLabel="Đang gỡ…"
            confirmMessage="Gỡ xác thực 2 lớp? Tài khoản sẽ chỉ còn bảo vệ bằng mật khẩu."
          />
        )}
      </div>
      {enrolled && aal !== 'aal2' && <p className="rsec18-help">Đăng xuất và đăng nhập lại bằng mã xác thực để thay đổi cấu hình bảo mật.</p>}
    </Panel>
  );
}

export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const ctx = await requireStaff();
  const owner = ctx.role === 'owner';
  const myPanel = <MyMfaPanel enrolled={ctx.mfaEnrolled} aal={ctx.aal} required={ctx.mfaRequired} />;

  if (!owner) {
    return (
      <main className="rsec18">
        <SecurityHeading subtitle="Quản lý trạng thái xác thực cho tài khoản nhân viên của bạn." />
        <div className="rsec18-single">{myPanel}</div>
      </main>
    );
  }

  const [settings, events, restricted, staff] = await Promise.all([
    getSecuritySettings(),
    listSecurityEvents(20),
    listRestrictedCustomers(),
    listStaffMfa().catch(() => []),
  ]);

  if (!settings) {
    return (
      <main className="rsec18">
        <SecurityHeading />
        <Notice tone="warning" title="Chưa cài đặt phần bảo mật">
          Chạy <code>supabase/sql/23_security_hardening.sql</code> trong Supabase SQL Editor, sau đó tải lại trang.
        </Notice>
      </main>
    );
  }

  const openEvents = events.filter((e) => !e.acknowledged_at && e.severity !== 'info');
  const atAal2 = ctx.aal === 'aal2';
  const tabs = [
    { key: 'tong-quan', label: 'Tổng quan' },
    { key: 'su-kien', label: `Sự kiện${openEvents.length ? ` (${openEvents.length})` : ''}` },
    { key: 'khach', label: `Khách bị giới hạn${restricted.length ? ` (${restricted.length})` : ''}` },
    { key: 'nguong', label: 'Ngưỡng bảo vệ' },
  ] as const;
  const active = tabs.find((t) => t.key === tab)?.key ?? 'tong-quan';

  return (
    <main className="rsec18">
      <SecurityHeading />
      <section aria-label="Tình trạng bảo vệ" className="rsec18-status-grid">
        <div className="rsec18-stat">
          <span className="rsec18-stat-icon blue"><MonitorCheck size={20} aria-hidden="true" /></span>
          <span className="rsec18-stat-label">Đặt sân online</span>
          <strong>{settings.online_booking_paused ? 'Tạm dừng' : 'Đang mở'}</strong>
          <small>Trạng thái giữ sân trên website</small>
        </div>
        <div className="rsec18-stat">
          <span className="rsec18-stat-icon teal"><ShieldCheck size={20} aria-hidden="true" /></span>
          <span className="rsec18-stat-label">Bảo vệ tài khoản</span>
          <strong>{ctx.mfaEnrolled ? 'Đã bật MFA' : 'Chưa bật MFA'}</strong>
          <small>Trạng thái của tài khoản bạn</small>
        </div>
        <Link className="rsec18-stat rsec18-stat-link" href="/admin/security?tab=su-kien">
          <span className="rsec18-stat-icon orange"><Activity size={20} aria-hidden="true" /></span>
          <span className="rsec18-stat-label">Sự kiện cần xem</span>
          <strong>{openEvents.length}</strong>
          <small>Trong {events.length} sự kiện gần nhất <ChevronRight size={13} aria-hidden="true" /></small>
        </Link>
        <Link className="rsec18-stat rsec18-stat-link" href="/admin/security?tab=khach">
          <span className="rsec18-stat-icon violet"><UsersRound size={20} aria-hidden="true" /></span>
          <span className="rsec18-stat-label">Khách bị giới hạn / ngoại lệ</span>
          <strong>{restricted.length}</strong>
          <small>Xem các trường hợp đang áp dụng <ChevronRight size={13} aria-hidden="true" /></small>
        </Link>
      </section>

      <div className="rsec18-tabs">
        <LinkTabs
          label="Mục bảo mật"
          tabs={tabs.map((t) => ({
            href: t.key === 'tong-quan' ? '/admin/security' : `/admin/security?tab=${t.key}`,
            label: t.label,
            active: t.key === active,
          }))}
        />
      </div>

      {active === 'tong-quan' && (
        <div className="rsec18-single">
          {openEvents.length > 0 && (
            <Link href="/admin/security?tab=su-kien" className="rsec18-alert">
              <ShieldAlert size={20} aria-hidden="true" />
              <span><strong>{openEvents.length} sự kiện cần xem</strong><small>Kiểm tra và đánh dấu sau khi xử lý</small></span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          )}

          <div className="rsec18-section-label"><span>01</span><h2>Bảo vệ tài khoản</h2><p>Ưu tiên xác minh danh tính người quản trị</p></div>
          {myPanel}

          <div className="rsec18-section-label"><span>02</span><h2>Vận hành đặt sân online</h2><p>Chỉ tạm dừng khi cần xử lý sự cố hoặc bảo trì</p></div>
          <Panel
            id="tam-dung"
            className="rsec18-panel"
            title="Trạng thái nhận đặt sân"
            description="Khi tạm dừng, khách không thể gửi yêu cầu giữ sân mới từ website; nhân viên vẫn có thể đặt sân tại quầy."
          >
            <div className="rsec18-online-status">
              <span className={settings.online_booking_paused ? 'rsec18-live-dot paused' : 'rsec18-live-dot'} aria-hidden="true" />
              <span><strong>{settings.online_booking_paused ? 'Đang tạm dừng đặt sân online' : 'Đang nhận đặt sân online'}</strong><small>{settings.paused_at ? `Thay đổi lúc ${formatDateTime(settings.paused_at)}` : 'Được kiểm soát theo cấu hình hiện tại'}</small></span>
              <Badge tone={settings.online_booking_paused ? 'red' : 'green'}>{settings.online_booking_paused ? 'Tạm dừng' : 'Đang mở'}</Badge>
            </div>
            <ActionForm action={setOnlineBookingPauseAction}>
              <TextareaField
                name="message"
                label="Thông báo tới khách khi tạm dừng (không bắt buộc)"
                defaultValue={settings.pause_message ?? ''}
                placeholder="Ví dụ: Hệ thống đang bảo trì, vui lòng liên hệ trực tiếp chi nhánh."
                optional
                rows={2}
              />
              <input type="hidden" name="paused" value={settings.online_booking_paused ? 'off' : 'on'} />
              <SubmitButton size="sm" variant={settings.online_booking_paused ? 'primary' : 'outline'} pendingLabel="Đang lưu…">
                {settings.online_booking_paused ? 'Mở lại đặt sân online' : 'Tạm dừng đặt sân online'}
              </SubmitButton>
            </ActionForm>
          </Panel>

          <div className="rsec18-section-label"><span>03</span><h2>Chính sách và nhân viên</h2><p>Các thay đổi ảnh hưởng quyền truy cập hệ thống</p></div>
          <Panel
            id="bat-buoc-2-lop"
            className="rsec18-panel"
            title="Yêu cầu xác thực 2 lớp"
            description="Thiết lập đối tượng bắt buộc xác minh MFA trước khi truy cập dữ liệu nhạy cảm."
          >
            {!atAal2 && (
              <Notice tone="warning" className="mb-4">
                Bật xác thực 2 lớp cho chính bạn và đăng nhập lại bằng mã trước khi thay đổi mục này, tránh tự khóa tài khoản.
              </Notice>
            )}
            <ActionForm action={updateMfaPolicyAction}>
              <div className="rsec18-checks">
                <CheckboxField
                  name="require_owner_mfa"
                  label="Chủ sân"
                  hint="Khuyến nghị bật ngay cho quyền xem dữ liệu khách, hoàn tiền và sửa giá."
                  defaultChecked={settings.require_owner_mfa}
                  disabled={!atAal2}
                />
                <CheckboxField
                  name="require_staff_mfa"
                  label="Nhân viên"
                  hint="Nhân viên chưa cài sẽ được hướng dẫn cài khi đăng nhập tiếp theo."
                  defaultChecked={settings.require_staff_mfa}
                  disabled={!atAal2}
                />
              </div>
              <SubmitButton size="sm" disabled={!atAal2} pendingLabel="Đang lưu…">Lưu chính sách</SubmitButton>
            </ActionForm>
          </Panel>
          <Panel
            id="tai-khoan"
            className="rsec18-panel"
            title="Thiết bị xác thực của nhân viên"
            description="Kiểm tra trạng thái MFA và hỗ trợ đặt lại khi nhân viên mất thiết bị."
          >
            {staff.length === 0 ? (
              <p className="rsec18-help">Không đọc được danh sách (cần SUPABASE_SECRET_KEY trên máy chủ).</p>
            ) : (
              <ul className="rsec18-staff-list">
                {staff.map((s) => (
                  <li key={s.userId}>
                    <div className="rsec18-avatar" aria-hidden="true">{s.displayName.trim().charAt(0).toLocaleUpperCase('vi-VN')}</div>
                    <div className="rsec18-staff-text">
                      <strong>{s.displayName}</strong>
                      <span>{s.role === 'owner' ? 'Chủ sân' : 'Nhân viên'}{!s.isActive && ' · Đã khóa'}{s.enrolledAt && ` · Bật từ ${formatDate(s.enrolledAt)}`}</span>
                    </div>
                    <div className="rsec18-staff-actions">
                      <Badge tone={s.enrolled ? 'green' : 'amber'}>{s.enrolled ? 'Đã bật MFA' : 'Chỉ mật khẩu'}</Badge>
                      {s.enrolled && s.userId !== ctx.userId && atAal2 && (
                        <ActionButton
                          action={resetStaffMfaAction}
                          label="Đặt lại MFA"
                          hidden={{ userId: s.userId }}
                          confirmMessage={`Đặt lại xác thực 2 lớp cho ${s.displayName}?`}
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {active === 'su-kien' && (
        <div className="rsec18-single">
          <div className="rsec18-section-label"><span><Activity size={16} aria-hidden="true" /></span><h2>Nhật ký sự kiện an ninh</h2><p>Phát hiện và xử lý các dấu hiệu bất thường</p></div>
          <Panel
            className="rsec18-panel"
            title={`Sự kiện gần đây${openEvents.length ? ` · ${openEvents.length} chưa xem` : ''}`}
            description="Gộp theo loại và đối tượng trong một giờ. Email cảnh báo cần cấu hình RESEND_API_KEY."
            actions={openEvents.length > 0 ? (
              <ActionButton action={acknowledgeAllSecurityEventsAction} label="Đánh dấu tất cả đã xem" pendingLabel="Đang lưu…" />
            ) : undefined}
          >
            {events.length === 0 ? <EmptyState title="Chưa có sự kiện">Hệ thống chưa ghi nhận sự kiện an ninh trong danh sách gần đây.</EmptyState> : (
              <ul className="rsec18-event-list">
                {events.map((e) => (
                  <li key={e.id} className={e.acknowledged_at || e.severity === 'info' ? 'rsec18-event subdued' : 'rsec18-event'}>
                    <div className="rsec18-event-icon" aria-hidden="true"><AlertTriangle size={18} /></div>
                    <div className="rsec18-event-body">
                      <div className="rsec18-event-title"><Badge tone={SEVERITY_INFO[e.severity].tone}>{SEVERITY_INFO[e.severity].label}</Badge><strong>{EVENT_INFO[e.kind].label}</strong>{e.occurrences > 1 && <small>×{e.occurrences}</small>}</div>
                      <p>{[e.subject, e.branch_name].filter(Boolean).join(' · ')}</p>
                      <small>{formatDateTime(e.first_seen_at)}{e.occurrences > 1 ? ` → ${formatDateTime(e.last_seen_at)}` : ''}</small>
                      {!e.acknowledged_at && e.severity !== 'info' && <p className="rsec18-event-advice">{EVENT_INFO[e.kind].advice}</p>}
                    </div>
                    {!e.acknowledged_at && e.severity !== 'info' && (
                      <div className="rsec18-event-action"><ActionButton action={acknowledgeSecurityEventAction} label="Đã xem" hidden={{ id: e.id }} /></div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {active === 'khach' && (
        <div className="rsec18-single">
          <div className="rsec18-section-label"><span><UserRoundCheck size={16} aria-hidden="true" /></span><h2>Kiểm soát giữ sân</h2><p>Khách bị giới hạn và các ngoại lệ đã được cấp</p></div>
          <Panel
            className="rsec18-panel"
            title="Khách bị giới hạn / có ngoại lệ"
            description="Ngưỡng tính theo số lần giữ rồi bỏ. Nếu khách bị chặn nhầm, mở hồ sơ để thiết lập chế độ Tin cậy."
          >
            {restricted.length === 0 ? (
              <EmptyState title="Không có khách bị giới hạn">Chưa có trường hợp bị giới hạn hoặc có ngoại lệ trong danh sách.</EmptyState>
            ) : (
              <ul className="rsec18-restricted-list">
                {restricted.map((r) => (
                  <li key={r.customer_id}>
                    <div>
                      <Link href={`/admin/customers/${r.customer_id}`} className="rsec18-customer-link">{r.name} <ArrowRight size={14} aria-hidden="true" /></Link>
                      <small>{formatPhone(r.phone)}</small>
                    </div>
                    <Badge tone={HOLD_LEVEL_INFO[r.level].tone}>{HOLD_LEVEL_INFO[r.level].label}</Badge>
                    <p>{r.reason === 'manual'
                      ? `${r.note ?? 'Nhân viên đặt'}${r.until ? ` (đến ${formatDate(r.until)})` : ''}`
                      : `Giữ rồi bỏ ${r.abandoned} lần / ${settings.abandon_window_days} ngày`}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {active === 'nguong' && (
        <div className="rsec18-single">
          <div className="rsec18-section-label"><span><Settings2 size={16} aria-hidden="true" /></span><h2>Ngưỡng chống lạm dụng</h2><p>Cấu hình giới hạn theo tình hình vận hành thực tế</p></div>
          <Panel
            className="rsec18-panel"
            title="Cấu hình phòng vệ"
            description="Áp dụng với lượt giữ sân và lần đăng nhập tiếp theo. Điều chỉnh thận trọng để tránh chặn nhầm khách hàng."
          >
            <ActionForm action={updateSecurityLimitsAction}>
              <div className="rsec18-limits">
                {LIMIT_GROUPS.map((g) => (
                  <fieldset key={g.key} className="rsec18-limit-group">
                    <legend>{g.title}</legend>
                    <p>{g.hint}</p>
                    <div className="rsec18-limit-grid">
                      {LIMIT_FIELDS.filter((f) => f.group === g.key).map((f) => (
                        <TextField
                          key={f.key}
                          name={f.key}
                          label={f.label}
                          type="number"
                          inputMode="numeric"
                          min={f.min}
                          max={f.max}
                          defaultValue={settings[f.key]}
                          required
                        />
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
              <div className="rsec18-submit-footer"><LockKeyhole size={17} aria-hidden="true" /><span>Thay đổi ảnh hưởng tới các lượt truy cập tiếp theo.</span><SubmitButton size="sm" pendingLabel="Đang lưu…">Lưu ngưỡng</SubmitButton></div>
            </ActionForm>
          </Panel>
        </div>
      )}
    </main>
  );
}
