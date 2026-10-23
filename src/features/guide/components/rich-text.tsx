import Link from 'next/link';

import { parseRich } from '../lib/rich';

/** Hiện chữ có **đậm** và [liên kết](/trong-web) của nội dung cẩm nang. */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {parseRich(text).map((p, i) => {
        if (p.kind === 'bold')
          return (
            <strong key={i} className="font-semibold text-ink">
              {p.text}
            </strong>
          );
        if (p.kind === 'link')
          return (
            <Link
              key={i}
              href={p.href}
              className="font-medium text-court-deep underline decoration-court/60 decoration-2 underline-offset-[3px] transition-colors hover:decoration-court-deep"
            >
              {p.text}
            </Link>
          );
        return <span key={i}>{p.text}</span>;
      })}
    </>
  );
}
