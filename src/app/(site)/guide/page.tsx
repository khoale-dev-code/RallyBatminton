import { ArrowDownRight, ArrowRight, BookOpenText, Check, Clock3, ShieldCheck } from 'lucide-react';
import { type Metadata } from 'next';
import Link from 'next/link';

import { CourtArena3D } from '@/features/guide/components/court-arena-3d';
import { GuideLibraryV11 } from '@/features/guide/components/guide-library-v11';
import { GUIDES } from '@/features/guide/content';
import { readingMinutes } from '@/features/guide/lib/reading';

import '@/features/guide/guide-v11.css';

export const metadata: Metadata = {
  title: 'Cẩm nang cầu lông | Rally Badminton',
  description: 'Học luật cầu lông, cách tính điểm, kỹ thuật, chọn vợt và sử dụng sân đúng luật qua 9 bài ngắn cùng sơ đồ sân tương tác.',
};

const FACTS = [
  { label: 'Đánh đơn', value: 'Dùng biên dọc trong, đến cuối sân' },
  { label: 'Đánh đôi', value: 'Dùng cả hai hành lang bên' },
  { label: 'Giao cầu đôi', value: 'Rộng nhưng ngắn hơn khi đánh cầu' },
];

/** Trang Cẩm nang V11. Giữ nguyên GUIDES, nội dung bài, đường dẫn modal và CourtExplorer. */
export default function GuideIndexPage() {
  const totalMinutes = GUIDES.reduce((sum, item) => sum + readingMinutes(item), 0);

  return (
    <div className="rg11">
      <section className="rg11-hero full-bleed" aria-labelledby="rg11-title">
        <div className="rg11-shell rg11-hero-content">
          <div className="rg11-eyebrow rg11-eyebrow-light"><span /> RALLY BADMINTON / CẨM NANG</div>
          <h1 id="rg11-title">Hiểu luật. Chơi hay.</h1>
          <p>Luật chơi, kỹ thuật và cách chọn dụng cụ, tất cả trong những bài đọc ngắn, dễ hiểu và áp dụng ngay trên sân.</p>
          <div className="rg11-actions">
            <a href="#thu-vien" className="rg11-btn rg11-btn-red">Khám phá bài học <ArrowRight size={18} aria-hidden /></a>
            <a href="#so-do-san" className="rg11-btn rg11-btn-ghost">Thử sơ đồ sân <ArrowDownRight size={18} aria-hidden /></a>
          </div>
          <div className="rg11-hero-stats" aria-label="Thông tin cẩm nang">
            <div><BookOpenText aria-hidden /><strong>{GUIDES.length.toString().padStart(2, '0')}</strong><span>Bài học thực tế</span></div>
            <div><Clock3 aria-hidden /><strong>{totalMinutes}</strong><span>Phút đọc ước tính</span></div>
            <div><ShieldCheck aria-hidden /><strong>BWF</strong><span>Tham chiếu luật thi đấu</span></div>
          </div>
        </div>
      </section>

      <section id="thu-vien" className="rg11-library rg11-shell" aria-labelledby="rg11-library-title">
        <div className="rg11-section-head">
          <div>
            <span className="rg11-section-kicker">01 / HỌC ĐÚNG NGAY TỪ ĐẦU</span>
            <h2 id="rg11-library-title">Học cầu lông, từ cơ bản.</h2>
          </div>
          <p>Chọn chủ đề bạn quan tâm. Mỗi bài ngắn gọn, có ví dụ và hình minh họa để dễ nhớ hơn.</p>
        </div>
        <GuideLibraryV11 />
      </section>

      <section id="so-do-san" className="rg11-court full-bleed" aria-labelledby="rg11-court-title">
        <div className="rg11-shell rg11-court-grid">
          <div className="rg11-court-copy">
            <span className="rg11-section-kicker">02 / TRẢI NGHIỆM SÂN CẦU LÔNG 3D</span>
            <h2 id="rg11-court-title">Xem trận đấu từ mọi góc.</h2>
            <p>Quan sát hai vận động viên đánh cầu trong không gian 3D. Chọn chế độ chơi và đổi điểm số để hiểu rõ vùng sân hợp lệ và cách giao cầu.</p>
            <div className="rg11-facts">
              {FACTS.map((item) => (
                <div key={item.label}><Check size={17} aria-hidden /><p><strong>{item.label}</strong><span>{item.value}</span></p></div>
              ))}
            </div>
            <Link href="/guide/san-don-san-doi" scroll={false} className="rg11-text-link">
              Tìm hiểu vạch sân chi tiết <ArrowRight size={18} aria-hidden />
            </Link>
          </div>
          <div className="rg11-court-stage">
            <CourtArena3D initial="serve-doubles" className="rg11-explorer" />
          </div>
        </div>
      </section>

      <section className="rg11-shell rg11-ending" aria-labelledby="rg11-ending-title">
        <div className="rg11-ending-copy">
          <span className="rg11-eyebrow rg11-eyebrow-light"><span /> RALLY BADMINTON</span>
          <h2 id="rg11-ending-title">Sẵn sàng ra sân?</h2>
          <p>Chọn chi nhánh, xem giờ trống và giữ chỗ trực tuyến. Thiếu dụng cụ thì thuê ngay tại quầy.</p>
        </div>
        <div className="rg11-actions rg11-ending-actions">
          <Link href="/booking" className="rg11-btn rg11-btn-red">Đặt sân ngay <ArrowRight size={18} aria-hidden /></Link>
          <Link href="/rentals" className="rg11-btn rg11-btn-ghost">Thuê vợt, giày <ArrowRight size={18} aria-hidden /></Link>
        </div>
      </section>
    </div>
  );
}
