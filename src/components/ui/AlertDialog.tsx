'use client';

import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';

import { Button } from '@/components/ui/Button';
import type { ButtonVariant } from '@/components/ui/Button';

export interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ButtonVariant;
  isLoading?: boolean;
  onConfirm: () => void;
}

export function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'destructive',
  isLoading = false,
  onConfirm,
}: AlertDialogProps): React.JSX.Element {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <AlertDialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
          <AlertDialogPrimitive.Title className="text-lg font-semibold text-deep-ink">
            {title}
          </AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description className="mt-2 text-sm text-stone">
            {description}
          </AlertDialogPrimitive.Description>
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialogPrimitive.Cancel asChild>
              <Button variant="outline">{cancelLabel}</Button>
            </AlertDialogPrimitive.Cancel>
            <Button variant={confirmVariant} isLoading={isLoading} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
