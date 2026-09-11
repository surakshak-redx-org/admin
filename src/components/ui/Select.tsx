'use client';

import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  label?: string;
  error?: string;
  placeholder?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
}

export function Select({
  label,
  error,
  placeholder = 'Select…',
  value,
  onValueChange,
  options,
  disabled,
}: SelectProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      {label ? <span className="text-sm font-medium text-deep-ink">{label}</span> : null}
      <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectPrimitive.Trigger
          className={cn(
            'flex h-10 items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm text-deep-ink focus:border-shakti-purple focus:outline-none focus:ring-1 focus:ring-shakti-purple',
            error ? 'border-error-red' : '',
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon>
            <ChevronDown className="h-4 w-4 text-stone" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content className="z-50 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
            <SelectPrimitive.Viewport className="p-1">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  className="relative flex cursor-pointer select-none items-center rounded px-8 py-2 text-sm text-deep-ink outline-none data-[highlighted]:bg-gray-100"
                >
                  <SelectPrimitive.ItemIndicator className="absolute left-2 inline-flex items-center">
                    <Check className="h-4 w-4 text-shakti-purple" />
                  </SelectPrimitive.ItemIndicator>
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
      {error ? <p className="text-xs text-error-red">{error}</p> : null}
    </div>
  );
}
