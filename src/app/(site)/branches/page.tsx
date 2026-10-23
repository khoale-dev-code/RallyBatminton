import { ArrowRight, Clock3, MapPin, ShieldCheck } from 'lucide-react';
import { type Metadata } from 'next';
import Link from 'next/link';

import { LoadErrorNotice, SetupNotice } from '@/components/layout/setup-notice';
import { EmptyState } from '@/components/ui/primitives';
import { bookingHref } from '@/features/booking/lib/links';
import { RallyBranchCards } from '@/features/branches/components/rally-branch-cards';
import { getHomeBranches } from '@/features/home/queries';
import { formatDateKey, formatNumber, formatVnd } from '@/lib/format';
import { isDateKey } from '@/lib/time';

import '@/features/branches/rally-branches-v10.css';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Chi nhánh Rally | Chọn sân và xem giờ trống',
  description: 'Khám phá chi nhánh Rally, xem địa chỉ, giờ hoạt động, giá từ và khung giờ trống để đặt sân cầu lông nhanh chóng.',
};

export default async function BranchesPage({ searchParams }: { searchParams: Promise<{ date?: string; time?: string }> }) {
  const [result, params] = await Promise.all([getHomeBranches(new Date()), searchParams]);
  const date = params.date && isDateKey(params.date) ? params.date : null;
  const time = date && params.time && /^\d{2}:\d{2}$/.test(params.time) ? params.time : null;
  const branches = result.ok ? result.data : [];
  const courtCount = branches.reduce((total, branch) => total + branch.courtCount, 0);
  const minPrice = branches.reduce<number | null>(
    (min, branch) => branch.minPrice === null ? min : min === null ? branch.minPrice : Math.min(min, branch.minPrice),
    null,
  );

  return (
    <div className="rly-branches-v10">
      <section aria-labelledby="branches-title" className="rly-branches-hero full-bleed">
        <div className="rly-branches-hero-inner">
          <p className="rly-branches-eyebrow"><span aria-hidden="true" /> RALLY BADMINTON / CHI NHÁNH</p>
          <h1 id="branches-title">Chọn sân. Vào trận.</h1>
          <p className="rly-branches-hero-desc">
            Khám phá các chi nhánh, xem giờ trống và chọn sân phù hợp với lịch chơi của bạn.
          </p>
          <div className="rly-branches-hero-cta">
            <a className="rly-btn rly-btn-red" href="#danh-sach-chi-nhanh">Khám phá chi nhánh <ArrowRight size={19} aria-hidden="true" /></a>
            <Link className="rly-btn rly-btn-outline-light" href={bookingHref(null, { date, time })}>Xem lịch đặt sân</Link>
          </div>
          <div className="rly-branches-hero-stats" aria-label="Thông tin hệ thống sân">
            <div><strong>{formatNumber(branches.length)}</strong><span>Chi nhánh hiển thị</span></div>
            <div><strong>{formatNumber(courtCount)}</strong><span>Sân đang phục vụ</span></div>
            {minPrice !== null && <div><strong>{formatVnd(minPrice)}</strong><span>Giá tham khảo từ / giờ</span></div>}
          </div>
        </div>
      </section>

      <section id="danh-sach-chi-nhanh" className="rly-branches-directory" aria-labelledby="branches-list-title">
        <div className="rly-branches-section-head">
          <div>
            <p className="rly-branches-kicker">01 / KHÔNG GIAN CHƠI CỦA BẠN</p>
            <h2 id="branches-list-title">Tìm sân phù hợp</h2>
            <p>
              {date
                ? `Bạn đang tìm sân ngày ${formatDateKey(date)}${time ? ` lúc ${time}` : ''}. Hãy chọn chi nhánh để xem lịch chi tiết.`
                : 'Từ địa điểm đến giá và giờ chơi, mọi thông tin cần thiết đều ở ngay đây.'}
            </p>
          </div>
          <Link className="rly-branches-text-link" href="/about#ban-do">Xem vị trí các sân <ArrowRight size={17} aria-hidden="true" /></Link>
        </div>
        {!result.ok && result.reason === 'not_configured' && <SetupNotice />}
        {!result.ok && result.reason === 'error' && <LoadErrorNotice />}
        {result.ok && branches.length === 0 && <EmptyState title="Chưa có chi nhánh mở đặt sân" />}
        {branches.length > 0 && <RallyBranchCards branches={branches} date={date} time={time} />}
      </section>

      <section aria-labelledby="branches-steps-title" className="rly-branches-steps">
        <div className="rly-branches-section-head">
          <div>
            <p className="rly-branches-kicker">02 / ĐẶT SÂN DỄ DÀNG</p>
            <h2 id="branches-steps-title">Ba bước, một trận đấu</h2>
          </div>
          <p>Chọn nơi chơi, kiểm tra lịch trống, gửi thông tin giữ sân. Đơn giản và rõ ràng.</p>
        </div>
        <ol className="rly-branches-step-grid">
          <li><span>01</span><MapPin aria-hidden="true" size={22}/><h3>Chọn chi nhánh</h3><p>Xem vị trí, giá tham khảo và thông tin từng sân.</p></li>
          <li><span>02</span><Clock3 aria-hidden="true" size={22}/><h3>Chọn giờ chơi</h3><p>Mở lịch thực tế để chọn sân và khung giờ phù hợp.</p></li>
          <li><span>03</span><ShieldCheck aria-hidden="true" size={22}/><h3>Gửi yêu cầu</h3><p>Điền thông tin liên hệ và nhận xác nhận từ chi nhánh.</p></li>
        </ol>
      </section>

      <section className="rly-branches-bottom-cta" aria-label="Bắt đầu đặt sân">
        <div>
          <p className="rly-branches-kicker">RALLY / ĐẶT SÂN TRỰC TUYẾN</p>
          <h2>Sẵn sàng ra sân?</h2>
          <p>Chọn ngày và giờ chơi của bạn trên lịch đặt sân Rally.</p>
        </div>
        <Link className="rly-btn rly-btn-red" href={bookingHref(null, { date, time })}>Đặt sân ngay <ArrowRight size={19} aria-hidden="true" /></Link>
      </section>
    </div>
  );
}
