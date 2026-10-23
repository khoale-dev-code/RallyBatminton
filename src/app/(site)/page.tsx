/* Rally Athletic v5: giao dien moi, du lieu va booking that. */
import {
  ArrowDownRight,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { MediaImage } from '@/components/brand/media-image';
import { SetupNotice, LoadErrorNotice } from '@/components/layout/setup-notice';
import { EmptyState } from '@/components/ui/primitives';
import { bookingHref } from '@/features/booking/lib/links';
import { Community3D } from '@/features/home/components/community-3d';
import { QuickSearch } from '@/features/home/components/quick-search';
import { getHomeBranches, type HomeBranch } from '@/features/home/queries';
import { GUIDES } from '@/features/guide/content';
import { formatVnd } from '@/lib/format';
import { shortTime } from '@/lib/time';

import '@/features/home/community-3d.css';
import '@/features/home/home-athletic-v5.css';

export const revalidate = 60;

const HOW = [
  {
    id: '01',
    icon: MapPin,
    title: 'Tìm sân phù hợp',
    description: 'Chọn chi nhánh thuận tiện và xem thông tin sân rõ ràng.',
    href: '/branches',
    action: 'Khám phá chi nhánh',
  },
  {
    id: '02',
    icon: CalendarDays,
    title: 'Chọn ngày, chọn giờ',
    description: 'Kiểm tra khung giờ còn sân và chọn lịch chơi mong muốn.',
    href: '/booking',
    action: 'Xem lịch sân',
  },
  {
    id: '03',
    icon: Check,
    title: 'Gửi yêu cầu đặt sân',
    description: 'Để lại thông tin liên hệ và nhận xác nhận từ chi nhánh.',
    href: '/booking',
    action: 'Đặt sân ngay',
  },
];

const SERVICES = [
  {
    index: '01',
    tag: 'GIẢI KHÁT',
    title: 'Nước uống & vật phẩm',
    description: 'Đồ uống, cầu lông và vật phẩm cần thiết ngay tại quầy.',
    href: '/products',
    image: '/images/counter-drinks.webp',
    alt: 'Đồ uống giải khát tại quầy Rally',
  },
  {
    index: '02',
    tag: 'THIẾT BỊ',
    title: 'Thuê vợt & giày',
    description: 'Tìm hiểu dịch vụ thuê vợt và giày tại các chi nhánh.',
    href: '/rentals',
    image: '/images/counter-rentals.webp',
    alt: 'Vợt và giày cầu lông cho thuê',
  },
  {
    index: '03',
    tag: 'TIỆN ÍCH',
    title: 'Tiện ích tại sân',
    description: 'Xem khu nghỉ ngơi và các tiện ích sẵn có tại sân.',
    href: '/branches',
    image: '/images/counter-amenities.webp',
    alt: 'Tiện ích phục vụ người chơi tại sân cầu lông',
  },
];

function BranchCard({ branch }: { branch: HomeBranch }) {
  const address = [branch.addressLine, branch.district].filter(Boolean).join(', ');
  const firstSlot = branch.slots.find((slot) => slot.freeCourts > 0)?.start;
  return (
    <article className="rx-branch-card">
      <Link className="rx-branch-photo" href={`/branches/${branch.slug}`} aria-label={`Xem chi tiết ${branch.name}`}>
        {branch.coverImagePath ? (
          <MediaImage path={branch.coverImagePath} alt={branch.name} className="rx-photo-fill" sizes="(min-width: 1100px) 580px, (min-width: 680px) 60vw, 100vw" />
        ) : (
          <Image src="/images/hero-court.webp" alt="Không gian sân cầu lông Rally" fill sizes="(min-width: 1100px) 580px, 100vw" className="object-cover" />
        )}
        <span className="rx-court-count">{branch.courtCount} sân cầu lông</span>
      </Link>
      <div className="rx-branch-info">
        <div className="rx-branch-heading">
          <div>
            <p className="rx-overline rx-overline-inverse">CHI NHÁNH RALLY</p>
            <h3><Link href={`/branches/${branch.slug}`}>{branch.name}</Link></h3>
          </div>
          <span className="rx-status"><span aria-hidden="true" className={branch.isOpen ? 'rx-dot-open' : 'rx-dot-closed'} />{branch.isOpen ? 'Đang mở cửa' : 'Ngoài giờ mở cửa'}</span>
        </div>
        <p className="rx-location"><MapPin size={15} aria-hidden="true" />{address || 'Xem địa chỉ chi nhánh'}</p>
        <div className="rx-branch-details">
          <div><span>Giá tham khảo từ</span><strong>{branch.minPrice === null ? 'Liên hệ' : formatVnd(branch.minPrice)}{branch.minPrice !== null && <small> / giờ</small>}</strong></div>
          <div><span>Giờ hoạt động</span><strong>{shortTime(branch.opensAt)} – {shortTime(branch.closesAt)}</strong></div>
        </div>
        <div className="rx-branch-slots">
          <p>{branch.slotsIsToday ? 'Giờ gợi ý hôm nay' : 'Giờ gợi ý ngày mai'}</p>
          {branch.slots.length ? (
            <div className="rx-slot-grid">
              {branch.slots.map((slot) => slot.freeCourts > 0 ? (
                <Link key={slot.start} href={bookingHref(branch.slug, { date: branch.slotsDate, time: slot.start })} title={`Còn ${slot.freeCourts} sân`} className="rx-slot">{slot.start}</Link>
              ) : (
                <span key={slot.start} className="rx-slot rx-slot-off" title="Hết sân">{slot.start}</span>
              ))}
            </div>
          ) : (
            <p className="rx-empty-slot">Chọn ngày để xem lịch trống</p>
          )}
        </div>
        <Link className="rx-branch-cta" href={bookingHref(branch.slug, { date: branch.slotsDate, time: firstSlot })}>Xem lịch & đặt sân <ArrowRight size={19} aria-hidden="true" /></Link>
      </div>
    </article>
  );
}

export default async function HomePage() {
  const result = await getHomeBranches(new Date());
  const branches = result.ok ? result.data : [];
  const minPrice = branches.reduce<number | null>((min, b) => b.minPrice !== null && (min === null || b.minPrice < min) ? b.minPrice : min, null);
  const featuredGuides = GUIDES.slice(0, 3);

  return (
    <div className="rx-home rx-v5">
      <section id="dat-san" aria-labelledby="rx-hero-title" className="rx-hero full-bleed">
        <Image src="/images/hero-court.webp" alt="" fill priority sizes="100vw" className="rx-hero-image" />
        <div className="rx-hero-overlay" aria-hidden="true" />
        <div className="rx-container rx-hero-content">
          <div className="rx-hero-copy">
            <span className="rx-hero-kicker"><span className="rx-kicker-square" />RALLY BADMINTON  /  ĐẶT SÂN TRỰC TUYẾN</span>
            <h1 id="rx-hero-title">Đặt sân nhanh.<span>Chơi hết sức.</span></h1>
            <p>Tìm sân đúng khung giờ, kiểm tra chỗ trống và gửi yêu cầu đặt sân chỉ trong vài thao tác.{minPrice !== null && <> Giá sân tham khảo từ <strong>{formatVnd(minPrice)}/giờ</strong>.</>}</p>
            <div className="rx-actions">
              <Link href="/booking" className="rx-btn rx-btn-red">Đặt sân ngay <ArrowRight size={20} aria-hidden="true" /></Link>
              <Link href="#chi-nhanh" className="rx-btn rx-btn-ghost">Xem các chi nhánh <ArrowDownRight size={19} aria-hidden="true" /></Link>
            </div>
          </div>
          <div className="rx-hero-badge" aria-hidden="true"><span>RALLY</span><strong>PLAY<br/>MORE.</strong><small>BADMINTON CLUB</small></div>
        </div>
      </section>

      <section className="rx-find-band full-bleed" aria-label="Đặt sân nhanh">
        <div className="rx-container">
          <div className="rx-search-frame">
            <div className="rx-search-intro"><span className="rx-overline">ĐẶT SÂN TRỰC TUYẾN</span><strong>Chọn lịch. Giữ sân.</strong></div>
            <QuickSearch branches={branches.map((b) => ({ slug: b.slug, name: b.name, opensAt: b.opensAt, closesAt: b.closesAt }))} />
          </div>
          <div className="rx-perks" aria-label="Điểm nổi bật khi đặt sân">
            <span><Check size={16} aria-hidden="true" />Không cần tạo tài khoản</span>
            <span><Clock3 size={16} aria-hidden="true" />Chủ động chọn khung giờ</span>
            <span><ShieldCheck size={16} aria-hidden="true" />Thông tin sân rõ ràng</span>
          </div>
        </div>
      </section>

      <section id="chi-nhanh" className="rx-section rx-branches-section full-bleed" aria-labelledby="rx-branches-title">
        <div className="rx-container">
          <div className="rx-section-header">
            <div><p className="rx-overline">01 / TÌM ĐỊA ĐIỂM</p><h2 id="rx-branches-title">Chọn sân phù hợp.</h2><p>Xem hình ảnh sân, mức giá và thời gian còn trống tại từng chi nhánh.</p></div>
            <Link href="/branches" className="rx-text-link">Tất cả chi nhánh <ArrowRight size={19} aria-hidden="true" /></Link>
          </div>
          {!result.ok && result.reason === 'not_configured' && <SetupNotice />}
          {!result.ok && result.reason === 'error' && <LoadErrorNotice />}
          {result.ok && branches.length === 0 && <EmptyState title="Chưa có chi nhánh mở đặt sân">Chi nhánh sẽ xuất hiện khi chủ sân công bố thông tin trong trang quản trị.</EmptyState>}
          {branches.length > 0 && (
            <div className={`rx-branch-list ${branches.length === 1 ? 'rx-single' : ''}`}>
              {branches.slice(0, 3).map((branch) => <BranchCard key={branch.id} branch={branch} />)}
            </div>
          )}
        </div>
      </section>

      <section id="cach-dat" className="rx-section rx-steps-section full-bleed" aria-labelledby="rx-steps-title">
        <div className="rx-container">
          <div className="rx-section-header"><div><p className="rx-overline">02 / ĐẶT SÂN ĐƠN GIẢN</p><h2 id="rx-steps-title">Đặt sân trong 3 bước.</h2><p>Đơn giản từ lúc chọn sân đến khi gửi yêu cầu đặt chỗ.</p></div></div>
          <ol className="rx-steps">
            {HOW.map((step) => (
              <li className="rx-step" key={step.id}>
                <div className="rx-step-top"><span className="rx-step-number">{step.id}</span><step.icon size={25} strokeWidth={1.8} aria-hidden="true" /></div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
                <Link href={step.href}>{step.action} <ArrowRight size={17} aria-hidden="true" /></Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="rx-section rx-services-section full-bleed" aria-labelledby="rx-services-title">
        <div className="rx-container">
          <div className="rx-section-header"><div><p className="rx-overline">03 / DỊCH VỤ TẠI SÂN</p><h2 id="rx-services-title">Trang bị cho cuộc chơi.</h2><p>Từ vợt, giày đến nước uống: Rally chuẩn bị những gì bạn cần.</p></div></div>
          <div className="rx-services-grid">
            {SERVICES.map((service) => (
              <Link key={service.index} href={service.href} className="rx-service-card">
                <div className="rx-service-photo"><Image src={service.image} fill alt={service.alt} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" /></div>
                <div className="rx-service-copy"><span>{service.tag} / {service.index}</span><h3>{service.title}</h3><p>{service.description}</p><strong>Khám phá dịch vụ <ArrowRight size={18} aria-hidden="true" /></strong></div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="rx-community-frame full-bleed"><Community3D /></div>

      <section className="rx-section rx-guides-section full-bleed" aria-labelledby="rx-guides-title">
        <div className="rx-container">
          <div className="rx-section-header"><div><p className="rx-overline">05 / CẨM NANG CẦU LÔNG</p><h2 id="rx-guides-title">Thêm kỹ năng. Thêm tự tin.</h2><p>Kiến thức thiết thực trước khi vào sân và sau mỗi trận đấu.</p></div><Link href="/guide" className="rx-text-link">Xem tất cả bài viết <ArrowRight size={19} aria-hidden="true" /></Link></div>
          <div className="rx-guide-grid">
            {featuredGuides.map((guide, index) => (
              <Link href={`/guide/${guide.slug}`} key={guide.slug} className="rx-guide-card">
                <div className="rx-guide-top"><span>0{index + 1} / CẨM NANG</span><guide.icon size={24} strokeWidth={1.75} aria-hidden="true" /></div>
                <h3>{guide.title}</h3><p>{guide.summary}</p><strong>Đọc bài viết <ArrowRight size={18} aria-hidden="true" /></strong>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="rx-bottom-cta full-bleed" aria-labelledby="rx-bottom-title">
        <div className="rx-container rx-bottom-inner">
          <div><p className="rx-overline">SẴN SÀNG CHO TRẬN TIẾP THEO?</p><h2 id="rx-bottom-title">Hẹn nhau trên sân.</h2><p>Xem lịch trống và giữ chỗ cho trận cầu tiếp theo của bạn.</p></div>
          <Link href="/booking" className="rx-btn rx-btn-red">Đặt sân ngay <ArrowRight size={20} aria-hidden="true" /></Link>
        </div>
      </section>
    </div>
  );
}
