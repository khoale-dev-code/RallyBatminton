// RALLY_RENTAL_EXPERIENCE_V7
import { type Metadata } from 'next';

import { RallyRentalExperience, type RentalSearchParams } from '@/features/catalog/components/rally-rental-experience';
import '@/features/catalog/rally-rentals-v7.css';

export const metadata: Metadata = {
  title: 'Thuê vợt, giày cầu lông tại Rally',
  description: 'Quên dụng cụ vẫn ra sân đúng hẹn. Khám phá vợt, giày và combo cho thuê, xem giá và tình trạng tại Rally.',
};

export default async function RentalsPage({ searchParams }: { searchParams: Promise<RentalSearchParams> }) {
  return <RallyRentalExperience searchParams={await searchParams} />;
}
