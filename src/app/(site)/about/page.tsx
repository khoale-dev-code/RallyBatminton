import {
  ArrowRight,
  ArrowUpRight,
  Bike,
  CalendarDays,
  Car,
  Check,
  Clock3,
  Coffee,
  Fan,
  LockKeyhole,
  MapPin,
  Package,
  ShieldCheck,
  ShowerHead,
  Sparkles,
  UsersRound,
  Wallet,
  Wifi,
  type LucideIcon,
} from 'lucide-react';
import { type Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { LoadErrorNotice, SetupNotice } from '@/components/layout/setup-notice';
import { Reveal } from '@/components/motion/reveal';
import { BranchMapExplorer } from '@/features/about/components/branch-map-explorer';
import { getAboutData } from '@/features/about/queries';
import { getBrandInfo } from '@/features/brand/queries';
import { formatPhone, formatVnd } from '@/lib/format';
import { shortTime } from '@/lib/time';

import '@/features/about/rally-about-v13.css';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Về Rally Badminton',
  description: 'Khám phá Rally Badminton: chọn sân dễ dàng, xem lịch trống rõ ràng và tận hưởng những buổi chơi cầu lông cùng bạn bè.',
};

const amenityIcons: Record<string, LucideIcon> = {
  bike: Bike,
  car: Car,
  fan: Fan,
  'shower-head': ShowerHead,
  lock: LockKeyhole,
  'cup-soda': Coffee,
  package: Package,
  wifi: Wifi,
};

const strengths = [
  {
    number: '01',
    icon: CalendarDays,
    title: 'Lịch sân rõ ràng',
    description: 'Xem giờ trống theo chi nhánh để chủ động chọn khung giờ hợp với lịch của bạn.',
  },
  {
    number: '02',
    icon: Wallet,
    title: 'Giá dễ theo dõi',
    description: 'Xem mức giá theo sân và khung giờ trước khi gửi yêu cầu đặt chỗ.',
  },
  {
    number: '03',
    icon: ShieldCheck,
    title: 'Đặt sân thật gọn',
    description: 'Không cần tạo tài khoản. Chỉ cần thông tin liên hệ để đặt sân.',
  },
  {
    number: '04',
    icon: UsersRound,
    title: 'Không gian để kết nối',
    description: 'Từ trận cầu đầu tiên đến những buổi gặp mặt quen thuộc, Rally luôn chào đón bạn.',
  },
];

export default async function AboutPage() {
  const [result, brand] = await Promise.all([getAboutData(), getBrandInfo()]);
  const data = result.ok ? result.data : null;
  const totals = data?.totals;
  const featured = data?.branches[0];

  return (
    <div className="rabout">
      <section className="rabout-hero full-bleed" aria-labelledby="rabout-title">
        <Image
          src="/images/hero-court.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="rabout-hero-photo"
        />
        <div className="rabout-container rabout-hero-inner">
          <div className="rabout-hero-copy">
            <span className="rabout-eyebrow rabout-eyebrow-light">
              <span className="rabout-signal" aria-hidden="true" />
              VỀ {brand.name.toLocaleUpperCase('vi-VN')}
            </span>
            <h1 id="rabout-title">Cùng nhau ra sân.</h1>
            <p className="rabout-hero-lead">
              Một cuộc hẹn hay không cần bắt đầu phức tạp. Chọn sân, hẹn bạn bè và tận hưởng từng pha cầu cùng Rally.
            </p>
            <div className="rabout-actions">
              <Link href="/booking" className="rabout-button rabout-button-red">
                Đặt sân ngay <ArrowUpRight aria-hidden="true" />
              </Link>
              <a href="#rabout-location" className="rabout-button rabout-button-ghost">
                Khám phá chi nhánh <ArrowRight aria-hidden="true" />
              </a>
            </div>
          </div>
          <div className="rabout-hero-note" aria-label="Giới thiệu Rally">
            <span className="rabout-note-number">RALLY<span>.</span></span>
            <span>Không chỉ là một trận cầu.<br />Là khoảng thời gian dành cho nhau.</span>
          </div>
        </div>
      </section>

      <div className="rabout-utility-strip full-bleed">
        <div className="rabout-container rabout-strip-inner">
          <span><Check aria-hidden="true" /> Xem lịch sân trực tuyến</span>
          <span><Check aria-hidden="true" /> Biết mức giá trước khi chọn</span>
          <span><Check aria-hidden="true" /> Đặt chỗ không cần tài khoản</span>
        </div>
      </div>

      <section className="rabout-story rabout-section" aria-labelledby="rabout-story-title">
        <div className="rabout-story-heading">
          <div>
            <p className="rabout-kicker">01 / CÂU CHUYỆN RALLY</p>
            <h2 id="rabout-story-title">Cứ hẹn nhau. Rally lo chuyện sân.</h2>
          </div>
          <div className="rabout-story-copy">
            <p>Chúng tôi tin rằng một buổi chơi trọn vẹn bắt đầu từ việc sắp xếp thật dễ dàng. Bạn cần thời gian cho trận đấu, không phải cho những cuộc gọi hỏi sân trống.</p>
            <p>Rally kết nối lịch sân, thông tin chi nhánh và các tiện ích trong một nơi, để mỗi cuộc hẹn đều có thể bắt đầu nhẹ nhàng hơn.</p>
          </div>
        </div>
        <div className="rabout-story-grid">
          <div className="rabout-story-photo rabout-story-photo-main">
            <Image
              src="/images/about/rally-about-story-shuttle-net.webp"
              alt=""
              fill
              sizes="(min-width: 900px) 68vw, 100vw"
              className="rabout-img-cover rabout-photo-replacement-story"
            />
            <div className="rabout-photo-label"><span>01 / RA SÂN CÙNG RALLY</span><strong>Buổi chơi của bạn, theo cách của bạn.</strong></div>
          </div>
          <div className="rabout-story-photo rabout-story-photo-small">
            <Image src="/images/counter-rentals.webp" alt="Vợt và giày cầu lông có thể tìm hiểu thuê tại Rally" fill sizes="(min-width: 900px) 30vw, 100vw" className="rabout-img-contain" />
            <div className="rabout-small-photo-caption">Quên dụng cụ? Xem lựa chọn thuê tại quầy.</div>
          </div>
        </div>
      </section>

      {totals && totals.branches > 0 && (
        <section className="rabout-metrics" aria-label="Thông tin hệ thống Rally">
          <div className="rabout-metrics-heading">RALLY QUA NHỮNG CON SỐ</div>
          <div className="rabout-metrics-list">
            <div><strong>{totals.branches.toLocaleString('vi-VN')}</strong><span>Chi nhánh</span></div>
            <div><strong>{totals.courts.toLocaleString('vi-VN')}</strong><span>Sân cầu lông</span></div>
            {totals.minPrice !== null && <div><strong>{formatVnd(totals.minPrice)}</strong><span>Giá sân từ / giờ</span></div>}
            {totals.openHours > 0 && <div><strong>{totals.openHours} giờ</strong><span>Khung giờ phục vụ tối đa/ngày</span></div>}
          </div>
        </section>
      )}

      <section className="rabout-values rabout-section" aria-labelledby="rabout-values-title">
        <header className="rabout-section-header">
          <div>
            <p className="rabout-kicker">02 / LÝ DO CHỌN RALLY</p>
            <h2 id="rabout-values-title">Lên lịch dễ. Chơi thảnh thơi.</h2>
          </div>
          <p>Những điều thiết thực nhất được đặt ngay trong trải nghiệm đặt sân của bạn.</p>
        </header>
        <Reveal className="rabout-benefit-grid" stagger={0.075}>
          {strengths.map((item, index) => {
            const Icon = item.icon;
            return (
              <article key={item.number} className={`rabout-benefit-card ${index === 0 ? 'rabout-benefit-featured' : ''}`} data-reveal>
                <div className="rabout-benefit-head">
                  <span className="rabout-benefit-icon"><Icon aria-hidden="true" /></span>
                  <span className="rabout-benefit-number" aria-hidden="true">{item.number}</span>
                </div>
                <div className="rabout-benefit-body">
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
                {index === 0 && <Link href="/booking" className="rabout-benefit-link">Xem lịch sân <ArrowUpRight aria-hidden="true" /></Link>}
              </article>
            );
          })}
        </Reveal>
      </section>

      <section className="rabout-experience full-bleed" aria-labelledby="rabout-experience-title">
        <div className="rabout-container rabout-experience-inner">
          <div className="rabout-experience-copy">
            <p className="rabout-kicker rabout-kicker-on-dark">03 / TRẢI NGHIỆM TẠI SÂN</p>
            <h2 id="rabout-experience-title">Tới sân là vào cuộc.</h2>
            <p>Thêm thời gian cho những pha cầu, bớt bận tâm đến khâu chuẩn bị. Tiện ích và dịch vụ có thể khác nhau theo từng chi nhánh.</p>
            {data && data.amenities.length > 0 && (
              <div className="rabout-amenity-list">
                {data.amenities.slice(0, 8).map((a) => {
                  const Icon = (a.icon && amenityIcons[a.icon]) || Sparkles;
                  return (
                    <span key={a.code}><Icon aria-hidden="true" />{a.label}</span>
                  );
                })}
              </div>
            )}
            <Link href="/branches" className="rabout-button rabout-button-white">Xem các chi nhánh <ArrowUpRight aria-hidden="true" /></Link>
          </div>
          <div className="rabout-experience-art" aria-hidden="true">
            <div className="rabout-experience-photo">
              <Image src="/images/about/rally-about-amenities-shuttle-racket.webp" alt="" fill sizes="(min-width: 900px) 44vw, 90vw" className="rabout-photo-replacement-amenities" />
            </div>
            <div className="rabout-experience-stamp">PLAY<br />MORE.</div>
          </div>
        </div>
      </section>

      <section id="rabout-location" className="rabout-location rabout-section" aria-labelledby="rabout-location-title">
        <header className="rabout-section-header rabout-location-header">
          <div>
            <p className="rabout-kicker">04 / VỊ TRÍ CHI NHÁNH</p>
            <h2 id="rabout-location-title">Tìm sân gần bạn.</h2>
          </div>
          <p>Chọn một chi nhánh để xem địa chỉ, hướng đi và đặt sân phù hợp với lịch trình.</p>
        </header>
        {!result.ok && result.reason === 'not_configured' && <SetupNotice />}
        {!result.ok && result.reason === 'error' && <LoadErrorNotice />}
        {data && data.branches.length > 0 && <BranchMapExplorer branches={data.branches} />}
        {data && data.branches.length === 0 && (
          <div className="rabout-empty">Thông tin chi nhánh đang được cập nhật. Bạn có thể quay lại trang đặt sân để xem lịch mới nhất.</div>
        )}
        {data && data.branches.length > 0 && (
          <div className="rabout-branch-strip">
            <div>
              <span className="rabout-branch-chip"><MapPin aria-hidden="true" /> {featured?.name ?? 'Rally Badminton'}</span>
              <p>{featured?.address}</p>
              {featured && <span className="rabout-branch-hours"><Clock3 aria-hidden="true" /> {shortTime(featured.opensAt)} – {shortTime(featured.closesAt)} · {featured.courtCount} sân</span>}
            </div>
            <Link href="/branches" className="rabout-text-link">Xem tất cả chi nhánh <ArrowRight aria-hidden="true" /></Link>
          </div>
        )}
      </section>

      <section className="rabout-closing rabout-section" aria-labelledby="rabout-closing-title">
        <div className="rabout-closing-inner">
          <div>
            <p className="rabout-kicker rabout-kicker-on-dark">HẸN TRẬN TIẾP THEO</p>
            <h2 id="rabout-closing-title">Trận tới, hẹn ở Rally.</h2>
            <p>Mở lịch sân, chọn khung giờ phù hợp rồi rủ đồng đội ra sân.</p>
            {brand.hotline && <p className="rabout-help-line">Cần hỗ trợ? Gọi <a href={`tel:${brand.hotline}`}>{formatPhone(brand.hotline)}</a></p>}
          </div>
          <Link href="/booking" className="rabout-button rabout-button-red">Xem giờ trống <ArrowUpRight aria-hidden="true" /></Link>
          <div className="rabout-closing-drawing" aria-hidden="true">R.</div>
        </div>
      </section>
    </div>
  );
}
