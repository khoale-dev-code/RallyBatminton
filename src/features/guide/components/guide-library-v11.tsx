'use client';

import { ArrowRight, BookOpen, Clock3, Filter } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useMemo, useState } from 'react';

import { GUIDES, TOPIC_LABEL, type Guide, type GuideTopic } from '../content';
import { readingMinutes } from '../lib/reading';

const FILTERS: Array<{ value: GuideTopic | 'all'; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'luat', label: 'Luật chơi' },
  { value: 'san', label: 'Sân bãi' },
  { value: 'ky-thuat', label: 'Kỹ thuật' },
  { value: 'dung-cu', label: 'Dụng cụ' },
  { value: 'suc-khoe', label: 'Sức khỏe' },
  { value: 'rally', label: 'Tại Rally' },
];

const CARD_PHOTOS: Record<string, { src: string; alt: string; style?: string }> = {
  'san-don-san-doi': { src: '/images/rally-guide-court-lines.webp', alt: 'Ảnh minh họa các vạch sân cầu lông trong nhà' },
  'ky-thuat-nen-tang': { src: '/images/rally-guide-smash-art.webp', alt: 'Tranh minh họa người chơi cầu lông vung vợt trên không', style: 'illustration' },
  'khoi-dong': { src: '/images/rally-guide-movement-art.webp', alt: 'Minh họa nhiều tư thế vận động trong cầu lông', style: 'illustration movement' },
};

function Card({ guide, number }: { guide: Guide; number: number }) {
  const Icon = guide.icon;
  const photo = CARD_PHOTOS[guide.slug];
  return (
    <Link className="rg11-guide-card" href={`/guide/${guide.slug}`} scroll={false}>
      <div className="rg11-guide-card-top">
        <span className="rg11-guide-icon"><Icon size={24} strokeWidth={1.9} aria-hidden /></span>
        <span className="rg11-guide-number" aria-hidden="true">{String(number).padStart(2, '0')}</span>
      </div>
      <span className="rg11-guide-meta">{TOPIC_LABEL[guide.topic]} <span aria-hidden>·</span> {readingMinutes(guide)} phút đọc</span>
      <h3>{guide.title}</h3>
      <p>{guide.summary}</p>
      {photo && (
        <div className={`rg11-guide-photo ${photo.style || ''}`}>
          <Image src={photo.src} alt={photo.alt} fill sizes="(max-width: 580px) 100vw, (max-width: 800px) 48vw, 31vw" />
        </div>
      )}
      <span className="rg11-guide-action">Đọc bài viết <ArrowRight size={18} aria-hidden /></span>
    </Link>
  );
}

export function GuideLibraryV11() {
  const [topic, setTopic] = useState<GuideTopic | 'all'>('all');
  const selected = useMemo(() => GUIDES.filter((item) => topic === 'all' || item.topic === topic), [topic]);
  const featured = topic === 'all' ? GUIDES[0] : undefined;
  const listing = featured ? selected.filter((item) => item.slug !== featured.slug) : selected;

  return (
    <div className="rg11-article-area">
      <div className="rg11-filter-line">
        <div className="rg11-filter-label"><Filter size={17} aria-hidden /><span>Lọc theo chủ đề</span></div>
        <div className="rg11-filter-scroller" role="group" aria-label="Lọc bài học theo chủ đề">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              aria-pressed={topic === filter.value}
              onClick={() => setTopic(filter.value)}
              className={`rg11-filter-pill ${topic === filter.value ? 'is-active' : ''}`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <span className="rg11-results" aria-live="polite">{selected.length} bài</span>
      </div>

      {featured && (
        <Link className="rg11-featured" href={`/guide/${featured.slug}`} scroll={false}>
          <div className="rg11-featured-content">
            <span className="rg11-featured-label"><BookOpen size={16} aria-hidden /> BÀI HỌC ĐẦU TIÊN</span>
            <h3>{featured.title}</h3>
            <p>{featured.summary}</p>
            <ul>
              {(featured.highlights || []).slice(0, 3).map((text) => <li key={text}><span aria-hidden>✓</span>{text}</li>)}
            </ul>
            <span className="rg11-featured-cta">Bắt đầu học <ArrowRight size={18} aria-hidden /></span>
          </div>
          <div className="rg11-featured-visual" aria-hidden><span>01 <small>/ {GUIDES.length.toString().padStart(2, '0')}</small></span></div>
        </Link>
      )}

      <div className={`rg11-guide-grid ${topic === 'all' ? 'is-full' : ''}`}>
        {listing.map((guide) => <Card key={guide.slug} guide={guide} number={GUIDES.findIndex((g) => g.slug === guide.slug) + 1} />)}
      </div>
      {topic === 'all' && (
        <Link className="rg11-practice-band" href="/guide/ky-thuat-nen-tang" scroll={false}>
          <div className="rg11-practice-copy">
            <span className="rg11-practice-kicker">GÓC THỰC HÀNH / KỸ THUẬT</span>
            <h3>Tập đúng từ những cú đánh đầu tiên.</h3>
            <p>Từ tư thế chờ cầu, bước chân đến các cú đánh cơ bản. Một lộ trình ngắn giúp bạn luyện tập có mục tiêu hơn.</p>
            <span className="rg11-practice-action">Xem bài kỹ thuật <ArrowRight size={18} aria-hidden /></span>
          </div>
          <div className="rg11-practice-photo">
            <Image
              src="/images/rally-guide-practice-court.webp"
              alt="Sân tập cầu lông với nhiều quả cầu dùng trong buổi luyện tập"
              fill
              sizes="(max-width: 650px) 100vw, 40vw"
            />
          </div>
        </Link>
      )}
      {selected.length === 0 && <p className="rg11-empty">Chưa có bài học trong chủ đề này.</p>}
      <p className="rg11-library-note"><Clock3 size={16} aria-hidden /> Bấm vào bài viết để đọc nội dung chi tiết ngay trên trang, không mất vị trí đang xem.</p>
    </div>
  );
}
