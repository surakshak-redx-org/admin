import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

export type SpinnerSize = 'sm' | 'md' | 'lg';
export type SpinnerVariant = 'purple' | 'white' | 'stone';

export interface SpinnerProps {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  className?: string;
}

const SIZE_CLASSES: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

const VARIANT_CLASSES: Record<SpinnerVariant, string> = {
  purple: 'text-shakti-purple',
  white: 'text-white',
  stone: 'text-stone',
};

export function Spinner({
  size = 'md',
  variant = 'purple',
  className,
}: SpinnerProps): React.JSX.Element {
  return (
    <Loader2
      className={cn('animate-spin', SIZE_CLASSES[size], VARIANT_CLASSES[variant], className)}
    />
  );
}
