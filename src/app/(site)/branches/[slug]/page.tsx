import { MapPin, Phone } from 'lucide-react';
import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { SetupNotice } from '@/components/layout/setup-notice';
import { Panel } from '@/components/ui/primitives';
import { BookingBoard } from '@/features/booking/components/booking-board';
import { BookingPausedNotice } from '@/features/security/components/booking-paused-notice';
import { getBrandInfo } from '@/features/brand/queries';
import { CourtGallery } from '@/features/branches/components/court-gallery';
import { PriceTable } from '@/features/branches/components/price-table';
import { bookingBoardProps } from '@/features/branches/board-props';
import { getBranchDetail } from '@/features/branches/queries';
import { isSupabaseConfigured } from '@/lib/env';
import { formatPhone } from '@/lib/format';
import { shortTime } from '@/lib/time';

export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const detail = await getBranchDetail(slug);
  if (!detail) return { title: 'Chi nhánh' };
  return {
    title: `${detail.branch.name} — đặt sân`,
    description: `Giờ trống, bảng giá và địa chỉ ${detail.branch.name}: ${detail.branch.address_line}.`,
  };
}

export default async function BranchPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="py-10">
        <SetupNotice />
      </div>
    );
  }
  const { slug } = await params;
  const [detail, brand] = await Promise.all([getBranchDetail(slug), getBrandInfo()]);
  if (!detail) notFound();
  const { branch, courts, amenities, priceRules } = detail;
  const courtNames = Object.fromEntries(courts.map((c) => [c.id, c.name]));
  const address = [branch.address_line, branch.ward, branch.district, branch.city].filter(Boolean).join(', ');
  const mapHref = branch.map_url ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  return (
    <div className="py-8 sm:py-12">
      <header className="mb-8 flex flex-col gap-3 border-b border-line pb-6">
        <h1 className="text-4xl sm:text-5xl">{branch.name}</h1>
        <div className="flex flex-col gap-2 text-muted sm:flex-row sm:flex-wrap sm:gap-x-6">
          <a href={mapHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-2 hover:text-ink">
            <MapPin className="mt-1 size-4 shrink-0" aria-hidden />
            <span className="underline-offset-4 hover:underline">{address}</span>
          </a>
          <span>
            Mở cửa{' '}
            <span className="tabular text-ink">
              {shortTime(branch.opens_at)}–{shortTime(branch.closes_at)}
            </span>{' '}
            hằng ngày
          </span>
          {branch.phone && (
            <a href={`tel:${branch.phone}`} className="inline-flex items-center gap-2 hover:text-ink">
              <Phone className="size-4" aria-hidden />
              {formatPhone(branch.phone)}
            </a>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section id="chon-gio" aria-labelledby="book-title" className="min-w-0 scroll-mt-20">
          <h2 id="book-title" className="mb-4 text-2xl sm:text-3xl">
            Chọn giờ chơi
          </h2>
          <BookingPausedNotice className="mb-4" />
          <Suspense fallback={<div className="h-96 animate-pulse rounded-panel bg-hall" />}>
            <BookingBoard {...bookingBoardProps(detail, brand)} />
          </Suspense>
        </section>

        {/* Máy tính bảng dọc: thông tin phụ xếp 2 cột; màn hình lớn: cột bên phải. */}
        <aside className="grid grid-cols-1 content-start gap-6 md:grid-cols-2 lg:grid-cols-1">
          <Panel title="Bảng giá" className="md:col-span-2 lg:col-span-1">
            <PriceTable rules={priceRules} courtNames={courtNames} />
          </Panel>
          <Panel title="Chính sách hủy">
            <ul className="flex flex-col gap-2 text-sm">
              <li>Hủy trước {branch.free_cancel_hours} giờ: hoàn toàn bộ tiền đã cọc.</li>
              <li>
                Hủy trước {branch.partial_refund_hours} giờ: hoàn {branch.partial_refund_percent}% tiền đã cọc.
              </li>
              <li>Sát giờ hơn: không hoàn cọc.</li>
            </ul>
          </Panel>
          {(amenities.length > 0 || branch.parking_info) && (
            <Panel title="Tiện ích">
              {amenities.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {amenities.map((a) => (
                    <li key={a.code} className="rounded-full bg-hall px-3 py-1 text-sm">
                      {a.label}
                    </li>
                  ))}
                </ul>
              )}
              {branch.parking_info && <p className="mt-3 text-sm text-muted">{branch.parking_info}</p>}
            </Panel>
          )}
          {branch.house_rules && (
            <Panel title="Nội quy sân">
              <p className="text-sm whitespace-pre-line">{branch.house_rules}</p>
            </Panel>
          )}
        </aside>
      </div>

      <section aria-labelledby="courts-title" className="mt-16">
        <h2 id="courts-title" className="mb-6 text-2xl sm:text-3xl">
          Các sân
        </h2>
        {branch.description && <p className="mb-6 max-w-2xl text-muted">{branch.description}</p>}
        <CourtGallery courts={courts.filter((c) => c.status !== 'retired')} />
      </section>
    </div>
  );
}
