import { BadgeCheck, MapPinned, ReceiptText } from 'lucide-react';
import { type Metadata } from 'next';

import { CatalogPage, type CatalogSearchParams } from '@/features/catalog/components/catalog-page';

export const metadata: Metadata = {
  title: 'Vật phẩm',
  description: 'Nước uống, cầu, phụ kiện cầu lông bán tại quầy các chi nhánh Rally.',
};

export default async function ProductsPage({ searchParams }: { searchParams: Promise<CatalogSearchParams> }) {
  return (
    <CatalogPage
      kind="sale"
      title="Đồ uống &"
      accent="vật phẩm"
      description="Mua tại quầy khi đến chơi. Giá và tình trạng còn hàng theo từng chi nhánh."
      highlights={[
        { icon: BadgeCheck, title: 'Hàng chính hãng', text: 'Đa dạng thương hiệu' },
        { icon: ReceiptText, title: 'Giá rõ ràng', text: 'Mua tại quầy tiện lợi' },
        { icon: MapPinned, title: 'Theo từng chi nhánh', text: 'Xem còn hàng trước khi đến' },
      ]}
      searchParams={await searchParams}
    />
  );
}
