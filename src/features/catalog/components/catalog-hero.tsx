import { type LucideIcon } from 'lucide-react';
import Image from 'next/image';

export interface CatalogHighlight {
  icon: LucideIcon;
  title: string;
  text: string;
}

/** Banner đầu trang danh mục: ảnh sân phía phải, chữ trên nền sáng phía trái, 3 điểm nổi bật. */
export function CatalogHero({
  title,
  accent,
  description,
  highlights,
  image = '/images/shop-banner.webp',
}: {
  title: string;
  /** Phần cuối tiêu đề tô xanh, ví dụ "vật phẩm". */
  accent?: string;
  description: string;
  highlights: CatalogHighlight[];
  image?: string;
}) {
  return (
    <section className="full-bleed relative isolate overflow-hidden border-b border-line bg-court-soft">
      <Image src={image} alt="" fill priority sizes="100vw" className="-z-20 object-cover object-[72%_30%]" />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(255_255_255/0.94)_0%,rgb(255_255_255/0.86)_60%,rgb(255_255_255/0.7)_100%)] lg:bg-[linear-gradient(90deg,#fff_0%,rgb(255_255_255/0.96)_40%,rgb(255_255_255/0.7)_56%,rgb(255_255_255/0)_74%)]"
      />
      <div className="mx-auto flex max-w-7xl flex-col justify-center gap-5 px-4 py-8 sm:px-6 sm:py-12 lg:min-h-[25rem] lg:py-14">
        <div className="flex max-w-2xl flex-col gap-2">
          <h1 className="text-[2.1rem] leading-tight font-semibold sm:text-5xl">
            {title}
            {accent && (
              <>
                {' '}
                <span className="text-court-strong">{accent}</span>
              </>
            )}
          </h1>
          <p className="max-w-xl text-[0.95rem] text-ink/75 sm:text-lg">{description}</p>
        </div>
        <ul className="grid max-w-3xl grid-cols-3 gap-2 sm:gap-4">
          {highlights.map((h) => (
            <li key={h.title} className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-paper text-court-strong shadow-[0_6px_16px_-8px_rgb(0_0_0/0.25)] ring-1 ring-black/5">
                <h.icon className="size-5" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-xs leading-snug font-semibold sm:text-sm">{h.title}</span>
                <span className="hidden text-xs leading-snug text-muted sm:block">{h.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
