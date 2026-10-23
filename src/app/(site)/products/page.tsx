// RALLY_PRODUCT_SHOWCASE_V6: products route only
import { type Metadata } from 'next';

import { RallyProductShowcase, type ProductSearchParams } from '@/features/catalog/components/rally-product-showcase';
import '@/features/catalog/rally-product-showcase.css';

export const metadata: Metadata = {
  title: 'Vật phẩm cầu lông tại Rally',
  description: 'Khám phá cầu lông, vợt, giày, phụ kiện và đồ uống tại Rally. Xem giá và tình trạng hàng theo chi nhánh, mua và nhận tại quầy.',
};

export default async function ProductsPage({ searchParams }: { searchParams: Promise<ProductSearchParams> }) {
  return <RallyProductShowcase searchParams={await searchParams} />;
}
