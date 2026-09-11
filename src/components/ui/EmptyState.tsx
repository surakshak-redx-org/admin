import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  iconClassName?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  action,
  iconClassName,
}: EmptyStateProps): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <Icon className={iconClassName ?? 'h-10 w-10 text-stone'} />
      <p className="text-base font-medium text-deep-ink">{title}</p>
      {subtitle ? <p className="text-sm text-stone">{subtitle}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
