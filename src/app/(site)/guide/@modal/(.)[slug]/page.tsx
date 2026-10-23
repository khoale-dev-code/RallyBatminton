import { notFound } from 'next/navigation';

import { findGuide, GUIDES } from '@/features/guide/content';
import { GuideArticle, GuideMeta } from '@/features/guide/components/guide-article';
import { GuideDialog } from '@/features/guide/components/guide-dialog';
import { GuideIcon } from '@/features/guide/components/guide-icon';

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

/** Bấm thẻ ở trang Cẩm nang → đọc bài trong hộp thoại, trang phía sau giữ nguyên vị trí cuộn. */
export default async function GuideModalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = findGuide(slug);
  if (!guide) notFound();
  const titleId = `guide-title-${guide.slug}`;
  return (
    <GuideDialog
      titleId={titleId}
      header={
        <div className="flex items-center gap-3 sm:gap-4">
          <GuideIcon guide={guide} size="md" />
          <div className="min-w-0">
            <GuideMeta guide={guide} className="text-muted" />
            <h2 id={titleId} className="mt-0.5 text-[1.6rem] leading-tight sm:text-[2rem]">
              {guide.title}
            </h2>
          </div>
        </div>
      }
    >
      <GuideArticle guide={guide} inDialog />
    </GuideDialog>
  );
}
