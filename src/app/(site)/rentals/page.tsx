import { Clock3, MapPin, Tags } from 'lucide-react';
import { type Metadata } from 'next';

import { CatalogPage, type CatalogSearchParams } from '@/features/catalog/components/catalog-page';

export const metadata: Metadata = { title: 'Thuê thiết bị', description: 'Thuê vợt, giày cầu lông tại quầy các chi nhánh Rally.' };

export default async function RentalsPage({ searchParams }: { searchParams: Promise<CatalogSearchParams> }) {
  return (
    <CatalogPage
      kind="rental"
      title="Thuê"
      accent="thiết bị"
      description="Quên đồ? Thuê vợt, giày ngay tại quầy — theo giờ, hết trận hoặc mang về."
      highlights={[
        { icon: MapPin, title: 'Tại sân hoặc mang về', text: 'Giá riêng cho từng hình thức' },
        { icon: Tags, title: 'Giá theo gói', text: 'Giờ, hết trận, theo ngày' },
        { icon: Clock3, title: 'Có thời gian ân hạn', text: 'Trả trễ ít không tính phí' },
      ]}
      searchParams={await searchParams}
    />
  );
}
