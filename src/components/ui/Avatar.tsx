'use client';

import * as AvatarPrimitive from '@radix-ui/react-avatar';

import { cn } from '@/lib/utils';

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps {
  src?: string | null;
  name: string;
  size?: AvatarSize;
  className?: string;
}

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-xl',
};

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function Avatar({ src, name, size = 'md', className }: AvatarProps): React.JSX.Element {
  return (
    <AvatarPrimitive.Root
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-shakti-purple/10 font-medium text-shakti-purple',
        SIZE_CLASSES[size],
        className,
      )}
    >
      <AvatarPrimitive.Image
        src={src ?? undefined}
        alt={name}
        className="h-full w-full object-cover"
      />
      <AvatarPrimitive.Fallback delayMs={200}>{initialsFor(name)}</AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
