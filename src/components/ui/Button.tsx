import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'default' | 'destructive' | 'outline' | 'ghost' | 'secondary';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  default: 'bg-shakti-purple text-white hover:bg-shakti-purple/90',
  destructive: 'bg-error-red text-white hover:bg-error-red/90',
  outline: 'border border-gray-300 bg-white text-deep-ink hover:bg-gray-50',
  ghost: 'bg-transparent text-deep-ink hover:bg-gray-100',
  secondary: 'bg-gray-100 text-deep-ink hover:bg-gray-200',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export function Button({
  variant = 'default',
  size = 'md',
  isLoading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps): React.JSX.Element {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      disabled={disabled ?? isLoading}
      {...props}
    >
      {isLoading ? (
        <Spinner size="sm" variant={variant === 'default' ? 'white' : 'purple'} />
      ) : null}
      {children}
    </button>
  );
}
