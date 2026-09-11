'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';

import { cn } from '@/lib/utils';

export interface TabItem {
  value: string;
  label: string;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

export function Tabs({ items, value, onValueChange, className }: TabsProps): React.JSX.Element {
  return (
    <TabsPrimitive.Root value={value} onValueChange={onValueChange} className={className}>
      <TabsPrimitive.List className="flex gap-1 border-b border-gray-200">
        {items.map((item) => (
          <TabsPrimitive.Trigger
            key={item.value}
            value={item.value}
            className={cn(
              'border-b-2 border-transparent px-4 py-2 text-sm font-medium text-stone hover:text-deep-ink',
              'data-[state=active]:border-shakti-purple data-[state=active]:text-shakti-purple',
            )}
          >
            {item.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  );
}
