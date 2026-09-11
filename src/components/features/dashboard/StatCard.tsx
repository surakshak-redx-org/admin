import type { LucideIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

export type StatCardColor = 'blue' | 'purple' | 'red' | 'amber';

export interface StatCardProps {
  icon: LucideIcon;
  color: StatCardColor;
  label: string;
  value: number;
  badgeLabel?: string;
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

export function StatCard({
  icon: Icon,
  color,
  label,
  value,
  badgeLabel,
}: StatCardProps): React.JSX.Element {
  return (
    <Card>
      <CardContent className="flex items-start justify-between">
        <div>
          <span className={cn('inline-flex rounded-md p-2', COLOR_CLASSES[color])}>
            <Icon className="h-5 w-5" />
          </span>
          <p className="mt-3 text-sm text-stone">{label}</p>
          <p className="text-2xl font-semibold text-deep-ink">{value}</p>
        </div>
        {badgeLabel ? (
          <span
            className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', BADGE_CLASSES[color])}
          >
            {badgeLabel}
          </span>
        ) : null}
      </CardContent>
    </Card>
  );
}
