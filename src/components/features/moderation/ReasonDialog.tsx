'use client';

import { useState } from 'react';

import { AlertDialog } from '@/components/ui/AlertDialog';
import { Textarea } from '@/components/ui/Textarea';
import { MODERATION_REASON_MAX_LENGTH } from '@/constants/config';

const REASON_FIELD_ID = 'moderation-reason';
const REASON_LABEL = 'Reason (kept in the admin audit log)';
const REASON_PLACEHOLDER = 'Why are you doing this?';
const REASON_ROWS = 3;

export interface ReasonDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  isLoading: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
  children?: React.ReactNode;
}

/**
 * Confirmation dialog for destructive moderation actions. The confirm button
 * stays disabled until the admin types a reason. Mount it only while open so
 * the typed reason resets each time.
 */
export function ReasonDialog({
  title,
  description,
  confirmLabel,
  isLoading,
  onConfirm,
  onClose,
  children,
}: ReasonDialogProps): React.JSX.Element {
  const [reason, setReason] = useState('');
  const trimmedReason = reason.trim();

  return (
    <AlertDialog
      open
      onOpenChange={(open: boolean): void => {
        if (!open) {
          onClose();
        }
      }}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      isLoading={isLoading}
      confirmDisabled={trimmedReason === ''}
      onConfirm={(): void => onConfirm(trimmedReason)}
    >
      {children}
      <Textarea
        id={REASON_FIELD_ID}
        label={REASON_LABEL}
        placeholder={REASON_PLACEHOLDER}
        rows={REASON_ROWS}
        maxLength={MODERATION_REASON_MAX_LENGTH}
        value={reason}
        onChange={(event: React.ChangeEvent<HTMLTextAreaElement>): void => {
          setReason(event.target.value);
        }}
      />
    </AlertDialog>
  );
}
