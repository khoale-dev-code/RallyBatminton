import { ArrowRight, CalendarDays, Check, CheckCircle2, Clock3, LockKeyhole, MapPin, Navigation, Phone, ShieldCheck, Sparkles } from 'lucide-react';
import { type Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { LoadErrorNotice, SetupNotice } from '@/components/layout/setup-notice';
import { EmptyState, Panel } from '@/components/ui/primitives';
import { BookingBoard } from '@/features/booking/components/booking-board';
import { BookingSteps } from '@/features/booking/components/booking-steps';
import { bookingHref } from '@/features/booking/lib/links';
import { getBrandInfo } from '@/features/brand/queries';
import { bookingBoardProps } from '@/features/branches/board-props';
import { PriceTable } from '@/features/branches/components/price-table';
import { mapDirectionsHref } from '@/features/branches/lib/map-embed';
import { getBranchDetail, listPublishedBranches } from '@/features/branches/queries';
import { cn } from '@/lib/cn';
import { formatPhone, formatVnd } from '@/lib/format';
import { isDateKey, shortTime } from '@/lib/time';

import '@/features/booking/rally-booking-v14.css';

export const metadata: Metadata = {
  title: 'Đặt sân cầu lông',
  description: 'Chọn ngày, sân và giờ trống tại Rally. Xem giá rõ ràng và gửi yêu cầu giữ sân trực tuyến.',
};

type Search = { branch?: string; date?: string; time?: string };

export default async function BookingPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [list, sp, brand] = await Promise.all([listPublishedBranches(), searchParams, getBrandInfo()]);
  const date = sp.date && isDateKey(sp.date) ? sp.date : null;
  const branches = list.ok ? list.data : [];
  const selected = branches.find((b) => b.slug === sp.branch) ?? (branches.length === 1 ? branches[0] : undefined);
  const detail = selected ? await getBranchDetail(selected.slug) : null;

  return (
    <div className="rb-booking-v14">
      <header className="rb-booking-hero">
        <div className="rb-booking-hero__content">
          <span className="rb-booking-eyebrow"><span aria-hidden className="rb-booking-dot" /> RALLY / ĐẶT SÂN TRỰC TUYẾN</span>
          <h1>Chọn giờ đẹp. Giữ sân nhanh.</h1>
          <p>Kiểm tra lịch trống theo từng sân, biết giá trước khi đặt và gửi yêu cầu giữ sân chỉ với vài thao tác.</p>
          <div className="rb-booking-hero__perks" aria-label="Lợi ích khi đặt sân">
            <span><CheckCircle2 size={16} aria-hidden /> Xem giờ trống</span>
            <span><ShieldCheck size={16} aria-hidden /> Giá rõ ràng</span>
            <span><LockKeyhole size={16} aria-hidden /> Không cần tài khoản</span>
          </div>
        </div>
        <div className="rb-booking-hero__art" aria-hidden="true">
          <span className="rb-booking-hero__art-label">RALLY / MATCH DAY</span>
          <span className="rb-booking-hero__art-line" />
        </div>
      </header>

      <div className="rb-booking-progress" aria-label="Quy trình đặt sân">
        <div className="rb-booking-progress__copy">
          <span className="rb-booking-progress__eyebrow">QUY TRÌNH ĐẶT SÂN</span>
          <strong>Ba bước để vào sân</strong>
        </div>
        <div className="rb-booking-progress__steps">
          <BookingSteps current={detail ? 1 : 0} />
        </div>
      </div>

      <div className="rb-booking-content">
        {!list.ok && list.reason === 'not_configured' && <SetupNotice />}
        {!list.ok && list.reason === 'error' && <LoadErrorNotice />}
        {list.ok && branches.length === 0 && <EmptyState title="Chưa có chi nhánh mở đặt sân" />}

        {branches.length > 1 && (
          <section className="rb-booking-branch-picker" aria-labelledby="rb-choose-branch">
            <div className="rb-section-head">
              <div>
                <span className="rb-section-kicker">BƯỚC 01 / CHỌN ĐỊA ĐIỂM</span>
                <h2 id="rb-choose-branch">Bạn muốn chơi ở đâu?</h2>
              </div>
              <p>Chọn chi nhánh phù hợp để xem lịch và giá từng sân.</p>
            </div>
            <ul className="rb-branch-list">
              {branches.map((b) => {
                const active = b.id === selected?.id;
                return (
                  <li key={b.id}>
                    <Link
                      href={bookingHref(b.slug, { date })}
                      scroll={false}
                      aria-current={active ? 'true' : undefined}
                      className={cn('rb-branch-option', active && 'is-active')}
                    >
                      <span className="rb-branch-option__tick" aria-hidden="true"><Check size={16} /></span>
                      <span className="rb-branch-option__name">{b.name}</span>
                      <span className="rb-branch-option__address">{[b.district, b.city].filter(Boolean).join(', ')}</span>
                      <span className="rb-branch-option__meta">
                        <span><Clock3 size={14} aria-hidden /> {shortTime(b.opensAt)}–{shortTime(b.closesAt)}</span>
                        <span>{b.courtCount} sân</span>
                        {b.minPrice !== null && <span>Từ {formatVnd(b.minPrice)}/giờ</span>}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {!detail && branches.length > 1 && (
          <div className="rb-booking-empty">
            <MapPin size={28} aria-hidden />
            <h2>Chọn chi nhánh để bắt đầu.</h2>
            <p>Nhấn vào địa điểm bạn muốn chơi để xem sân và khung giờ có thể đặt.</p>
            <Link href="/branches">Khám phá chi nhánh <ArrowRight size={16} aria-hidden /></Link>
          </div>
        )}

        {detail && (
          <div className="rb-booking-main-grid">
            <section id="chon-gio" className="rb-booking-workspace" aria-labelledby="rb-booking-board-title">
              <div className="rb-booking-workspace__heading">
                <div>
                  <span className="rb-section-kicker">BƯỚC 02 / CHỌN THỜI GIAN</span>
                  <h2 id="rb-booking-board-title">Lên lịch trận đấu của bạn</h2>
                  <p>Chọn ngày, chọn sân và khung giờ phù hợp với bạn.</p>
                </div>
                <span className="rb-booking-workspace__branch"><MapPin size={15} aria-hidden /> {detail.branch.name}</span>
              </div>
              <div className="rb-booking-board">
                <Suspense fallback={<div className="h-96 animate-pulse rounded-panel bg-hall" />}>
                  <BookingBoard key={detail.branch.id} {...bookingBoardProps(detail, brand)} />
                </Suspense>
              </div>
            </section>

            <aside className="rb-booking-sidebar" aria-label="Thông tin sân và chính sách">
              <section className="rb-booking-location" aria-labelledby="rb-location-title">
                <div className="rb-booking-location__cover">
                  <span>YOUR COURT. YOUR GAME.</span>
                </div>
                <div className="rb-booking-location__body">
                  <span className="rb-sidebar-eyebrow">CHI NHÁNH BẠN ĐÃ CHỌN</span>
                  <h2 id="rb-location-title">{detail.branch.name}</h2>
                  <ul>
                    <li><MapPin size={17} aria-hidden /><span>{[detail.branch.address_line, detail.branch.ward, detail.branch.district, detail.branch.city].filter(Boolean).join(', ')}</span></li>
                    <li><Clock3 size={17} aria-hidden /><span>{shortTime(detail.branch.opens_at)}–{shortTime(detail.branch.closes_at)} hằng ngày</span></li>
                    {detail.branch.phone && <li><Phone size={17} aria-hidden /><a href={`tel:${detail.branch.phone}`}>{formatPhone(detail.branch.phone)}</a></li>}
                  </ul>
                  <div className="rb-booking-location__actions">
                    <a href={mapDirectionsHref(detail.branch.map_url, [detail.branch.name, detail.branch.address_line, detail.branch.district, detail.branch.city].filter(Boolean).join(', '))} target="_blank" rel="noopener noreferrer"><Navigation size={16} aria-hidden /> Chỉ đường</a>
                    <Link href={`/branches/${detail.branch.slug}`}>Xem chi nhánh <ArrowRight size={16} aria-hidden /></Link>
                  </div>
                </div>
              </section>
              <section className="rb-booking-pricing" aria-label="Bảng giá sân">
                <Panel title="Bảng giá theo khung giờ">
                  <PriceTable rules={detail.priceRules} courtNames={Object.fromEntries(detail.courts.map((c) => [c.id, c.name]))} />
                </Panel>
              </section>
              <div className="rb-booking-policy">
                <ShieldCheck size={21} aria-hidden />
                <div>
                  <strong>Chính sách giữ sân</strong>
                  <p>Giữ chỗ {detail.branch.hold_minutes} phút, cọc {detail.branch.deposit_percent}%. Hủy trước {detail.branch.free_cancel_hours} giờ hoàn toàn bộ cọc; trước {detail.branch.partial_refund_hours} giờ hoàn {detail.branch.partial_refund_percent}%.</p>
                </div>
              </div>
            </aside>
          </div>
        )}

        {detail && (
          <div className="rb-booking-assurance">
            <div><CalendarDays size={23} aria-hidden /><span><strong>Lịch theo từng sân</strong><small>Kiểm tra ngày và giờ trước khi chọn</small></span></div>
            <div><Sparkles size={23} aria-hidden /><span><strong>Giá minh bạch</strong><small>Biết tổng tiền và cọc khi chọn giờ</small></span></div>
            <div><ShieldCheck size={23} aria-hidden /><span><strong>Gửi yêu cầu nhanh</strong><small>Điền thông tin để chi nhánh xác nhận</small></span></div>
          </div>
        )}
      </div>
    </div>
  );
}
