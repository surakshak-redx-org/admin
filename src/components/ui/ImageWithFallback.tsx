'use client';

import { ImageOff } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

import { cn } from '@/lib/utils';

const UNAVAILABLE_LABEL = 'Image unavailable';
const IMAGE_WIDTH_PX = 800;
const IMAGE_HEIGHT_PX = 600;

export interface ImageUnavailableProps {
  className?: string;
}

export interface ImageWithFallbackProps {
  src: string;
  alt: string;
  className?: string;
}

/** Placeholder shown in place of an image that is missing, blocked or failed to load. */
export function ImageUnavailable({ className }: ImageUnavailableProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex h-40 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-stone/30 bg-gray-50 text-stone',
        className,
      )}
    >
      <ImageOff className="h-6 w-6" aria-hidden="true" />
      <span className="text-sm">{UNAVAILABLE_LABEL}</span>
    </div>
  );
}

/**
 * Remote image that degrades to an "Image unavailable" placeholder instead of
 * throwing. `unoptimized` loads the URL straight in the browser, so a Firebase
 * Storage URL never depends on the Next.js image optimizer (and its host
 * allowlist), which is what crashed the page into the error boundary.
 */
export function ImageWithFallback({
  src,
  alt,
  className,
}: ImageWithFallbackProps): React.JSX.Element {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (failedSrc === src) {
    return <ImageUnavailable />;
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={IMAGE_WIDTH_PX}
      height={IMAGE_HEIGHT_PX}
      unoptimized
      onError={(): void => setFailedSrc(src)}
      className={className}
    />
  );
}
