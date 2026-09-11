import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps): React.JSX.Element {
  return (
    <div
      className={cn('rounded-lg border border-gray-200 bg-white shadow-sm', className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: CardProps): React.JSX.Element {
  return <div className={cn('flex flex-col gap-1 p-5 pb-0', className)} {...props} />;
}

export function CardContent({ className, ...props }: CardProps): React.JSX.Element {
  return <div className={cn('p-5', className)} {...props} />;
}

export function CardFooter({ className, ...props }: CardProps): React.JSX.Element {
  return <div className={cn('flex items-center gap-2 p-5 pt-0', className)} {...props} />;
}

export function CardTitle({ className, ...props }: CardProps): React.JSX.Element {
  return <div className={cn('text-lg font-semibold text-deep-ink', className)} {...props} />;
}
