import type { TextareaHTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, id, className, ...props },
  ref,
): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={id} className="text-sm font-medium text-deep-ink">
          {label}
        </label>
      ) : null}
      <textarea
        id={id}
        ref={ref}
        className={cn(
          'rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-deep-ink placeholder:text-stone focus:border-shakti-purple focus:outline-none focus:ring-1 focus:ring-shakti-purple',
          error ? 'border-error-red focus:border-error-red focus:ring-error-red' : '',
          className,
        )}
        {...props}
      />
      {error ? <p className="text-xs text-error-red">{error}</p> : null}
    </div>
  );
});
