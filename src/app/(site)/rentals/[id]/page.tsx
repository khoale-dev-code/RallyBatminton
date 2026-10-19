import { type Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ProductDetailView } from '@/features/catalog/components/product-detail';
import { getProductDetail, productMetadata } from '@/features/catalog/queries';

export const revalidate = 60;

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return productMetadata(await getProductDetail((await params).id, 'rental'));
}

export default async function Page({ params }: PageProps) {
  const product = await getProductDetail((await params).id, 'rental');
  if (!product) notFound();
  return <ProductDetailView product={product} backHref="/rentals" backLabel="Tất cả thiết bị cho thuê" />;
}
