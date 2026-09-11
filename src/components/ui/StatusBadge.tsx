import { Badge } from '@/components/ui/Badge';
import type { BadgeVariant } from '@/components/ui/Badge';

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  submitted: 'info',
  under_review: 'warning',
  resolved: 'success',
  pending: 'warning',
  approved: 'success',
  hidden: 'error',
};

const STATUS_LABEL: Record<string, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  resolved: 'Resolved',
  pending: 'Pending',
  approved: 'Approved',
  hidden: 'Hidden',
};

export interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps): React.JSX.Element {
  const variant = STATUS_VARIANT[status] ?? 'default';
  const label = STATUS_LABEL[status] ?? status;
  return <Badge variant={variant}>{label}</Badge>;
}
