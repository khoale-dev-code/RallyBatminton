import { ArrowRight, Clock3, MapPin } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { MediaImage } from '@/components/brand/media-image';
import { bookingHref } from '@/features/booking/lib/links';
import { type HomeBranch } from '@/features/home/queries';
import { formatVnd } from '@/lib/format';
import { shortTime } from '@/lib/time';

interface Props {
  branches: HomeBranch[];
  date: string | null;
  time: string | null;
}

function BranchVisual({ branch }: { branch: HomeBranch }) {
  return (
    <div className="rly-branch-photo">
      <Link href={`/branches/${branch.slug}`} aria-label={`Xem chi tiết ${branch.name}`} className="rly-branch-photo-link">
        {branch.coverImagePath ? (
          <MediaImage path={branch.coverImagePath} alt={`Sân cầu lông ${branch.name}`} sizes="(min-width: 900px) 620px, 100vw" className="rly-branch-cover" />
        ) : (
          <Image src="/images/hero-court.webp" alt="Không gian sân cầu lông Rally" fill sizes="(min-width: 900px) 620px, 100vw" className="rly-branch-cover-img" />
        )}
      </Link>
      <span className={`rly-branch-open ${branch.isOpen ? 'is-open' : ''}`}>
        <span aria-hidden="true" />{branch.isOpen ? 'Đang mở cửa' : 'Ngoài giờ hoạt động'}
      </span>
      <span className="rly-branch-count">{branch.courtCount} sân</span>
    </div>
  );
}

function BranchCard({ branch, index, date, time }: { branch: HomeBranch; index: number; date: string | null; time: string | null }) {
  const addr = [branch.addressLine, branch.district, branch.city].filter(Boolean).join(', ');
  const slots = branch.slots.slice(0, 4);
  const mainHref = bookingHref(branch.slug, { date, time });
  return (
    <article className={`rly-branch-card ${index === 0 ? 'is-featured' : ''}`}>
      <BranchVisual branch={branch} />
      <div className="rly-branch-content">
        <p className="rly-branch-small">CHI NHÁNH {String(index + 1).padStart(2, '0')}</p>
        <h3><Link href={`/branches/${branch.slug}`}>{branch.name}</Link></h3>
        <p className="rly-branch-address"><MapPin size={16} aria-hidden="true" /> <span>{addr}</span></p>
        <div className="rly-branch-facts">
          <div><span>Giá tham khảo từ</span><strong>{branch.minPrice === null ? 'Liên hệ' : formatVnd(branch.minPrice)}{branch.minPrice !== null && <small> /giờ</small>}</strong></div>
          <div><span>Giờ hoạt động</span><strong><Clock3 size={16} aria-hidden="true" /> {shortTime(branch.opensAt)} - {shortTime(branch.closesAt)}</strong></div>
        </div>
        <div className="rly-branch-timebox">
          <p>{branch.slotsIsToday ? 'Giờ trống gợi ý hôm nay' : 'Giờ trống gợi ý ngày mai'}</p>
          {slots.length > 0 ? (
            <div className="rly-branch-times">
              {slots.map((slot) => slot.freeCourts > 0 ? (
                <Link key={slot.start} href={bookingHref(branch.slug, { date: branch.slotsDate, time: slot.start })} title={`Còn ${slot.freeCourts} sân lúc ${slot.start}`}>
                  {slot.start}
                </Link>
              ) : (
                <span key={slot.start} className="is-full" title="Hết sân">{slot.start}</span>
              ))}
            </div>
          ) : <p className="rly-branch-times-empty">Chọn ngày trên lịch để xem khung giờ khả dụng.</p>}
        </div>
        <div className="rly-branch-actions">
          <Link className="rly-btn rly-btn-red" href={mainHref}>Xem lịch & đặt sân <ArrowRight size={18} aria-hidden="true" /></Link>
          <Link className="rly-btn rly-btn-secondary" href={`/branches/${branch.slug}`}>Thông tin sân</Link>
        </div>
      </div>
    </article>
  );
}

export function RallyBranchCards({ branches, date, time }: Props) {
  return (
    <div className={`rly-branch-grid ${branches.length === 1 ? 'is-single' : ''}`}>
      {branches.map((branch, index) => (
        <BranchCard key={branch.id} branch={branch} index={index} date={date} time={time} />
      ))}
    </div>
  );
}
