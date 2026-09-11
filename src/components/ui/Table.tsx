import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export function Table({
  className,
  ...props
}: HTMLAttributes<HTMLTableElement>): React.JSX.Element {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full border-collapse text-sm', className)} {...props} />
    </div>
  );
}

export function TableHeader({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>): React.JSX.Element {
  return <thead className={cn('border-b border-gray-200 text-left', className)} {...props} />;
}

export function TableBody({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>): React.JSX.Element {
  return <tbody className={cn('divide-y divide-gray-100', className)} {...props} />;
}

export function TableRow({
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement>): React.JSX.Element {
  return <tr className={cn('hover:bg-gray-50', className)} {...props} />;
}

export function TableHead({
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>): React.JSX.Element {
  return (
    <th
      className={cn(
        'whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>): React.JSX.Element {
  return <td className={cn('px-4 py-3 align-middle text-deep-ink', className)} {...props} />;
}
