import { MediaImage } from '@/components/brand/media-image';
import { Badge } from '@/components/ui/primitives';
import { TiltCard } from '@/components/ui/interactive';
import { COURT_STATUS } from '@/lib/labels';

import { type CourtPublic } from '../queries';

export function CourtGallery({ courts }: { courts: CourtPublic[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
      {courts.map((c) => (
        <li key={c.id}>
          <TiltCard className="h-full rounded-panel border border-line bg-paper">
            <MediaImage
              path={c.photos[0]?.path}
              alt={c.photos[0]?.alt ?? c.name}
              className="aspect-[16/10] rounded-t-panel"
              fallbackLabel={c.name}
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            />
            <div className="flex flex-col gap-1 p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <h3 className="text-lg sm:text-xl">{c.name}</h3>
                {c.status !== 'active' && <Badge tone={COURT_STATUS[c.status].tone}>{COURT_STATUS[c.status].label}</Badge>}
              </div>
              <p className="text-sm text-muted">{[c.surface, c.isIndoor ? 'Trong nhà' : 'Ngoài trời'].filter(Boolean).join(', ')}</p>
              {c.description && <p className="text-sm">{c.description}</p>}
              {c.photos.length > 1 && <p className="text-xs text-muted">{c.photos.length} ảnh</p>}
            </div>
          </TiltCard>
        </li>
      ))}
    </ul>
  );
}
