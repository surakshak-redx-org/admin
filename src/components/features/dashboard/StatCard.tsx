import { ArrowUpRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

const NUMBER_LOCALE = 'en-IN';

export type StatCardColor = 'blue' | 'purple' | 'red' | 'amber';

export interface StatCardProps {
  icon: LucideIcon;
  color: StatCardColor;
  label: string;
  value: number;
  badgeLabel?: string;
  href?: string;
}

const COLOR_CLASSES: Record<StatCardColor, string> = {
  blue: 'bg-blue-100 text-blue-700',
  purple: 'bg-shakti-purple/10 text-shakti-purple',
  red: 'bg-red-100 text-error-red',
  amber: 'bg-amber-100 text-saffron',
};

const BADGE_CLASSES: Record<StatCardColor, string> = {
  blue: 'bg-blue-100 text-blue-700',
  purple: 'bg-shakti-purple/10 text-shakti-purple',
  red: 'bg-red-100 text-error-red',
  amber: 'bg-amber-100 text-amber-800',
};

const LINK_CLASSES =
  'group block rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shakti-purple focus-visible:ring-offset-2';

export function StatCard({
  icon: Icon,
  color,
  label,
  value,
  badgeLabel,
  href,
}: StatCardProps): React.JSX.Element {
  const card = (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <span className={cn('inline-flex rounded-md p-2', COLOR_CLASSES[color])}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          {badgeLabel ? (
            <span
              className={cn(
                'whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
                BADGE_CLASSES[color],
              )}
            >
              {badgeLabel}
            </span>
          ) : null}
        </div>
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-stone">{label}</p>
            {href ? (
              <ArrowUpRight
                className="h-4 w-4 text-stone transition-colors group-hover:text-deep-ink"
                aria-hidden="true"
              />
            ) : null}
          </div>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-deep-ink">
            {value.toLocaleString(NUMBER_LOCALE)}
          </p>
        </div>
      </CardContent>
    </Card>
  );

  if (!href) {
    return card;
  }

  return (
    <Link href={href} className={LINK_CLASSES}>
      {card}
    </Link>
  );
}
