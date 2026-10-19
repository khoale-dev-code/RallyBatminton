import { Sparkles } from 'lucide-react';

import { tierDef, type MemberTier } from '@/features/member/lib/tiers';
import { cn } from '@/lib/cn';

export function MemberTierBadge({ tier, className }: { tier: MemberTier; className?: string }) {
  const def = tierDef(tier);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        def.badge,
        className,
      )}
    >
      <Sparkles className="size-3" aria-hidden />
      {def.label}
    </span>
  );
}
