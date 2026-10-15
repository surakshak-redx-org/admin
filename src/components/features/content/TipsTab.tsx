'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { useTogglePublished } from '@/components/features/content/useTogglePublished';
import { AlertDialog } from '@/components/ui/AlertDialog';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Switch } from '@/components/ui/Switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { Textarea } from '@/components/ui/Textarea';
import { TITLE_TRUNCATE_LENGTH } from '@/constants/config';
import { useDeleteTipMutation, useSaveTipMutation, useTipsQuery } from '@/hooks';
import type { SafetyTip } from '@/types/firestore.types';

const tipSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  category: z.string().min(1, 'Category is required'),
  isPublished: z.boolean(),
});

type TipFormValues = z.infer<typeof tipSchema>;

function truncate(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

export function TipsTab(): React.JSX.Element {
  const [dialogTip, setDialogTip] = useState<SafetyTip | 'new' | null>(null);
  const [deleteTip, setDeleteTip] = useState<SafetyTip | null>(null);
  const tipsQuery = useTipsQuery();
  const saveMutation = useSaveTipMutation();
  const deleteMutation = useDeleteTipMutation();
  const publish = useTogglePublished<SafetyTip>('tips', 'Tip');

  if (tipsQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-deep-ink">Safety Tips</h2>
        <Button size="sm" onClick={(): void => setDialogTip('new')}>
          <Plus className="h-4 w-4" />
          Add Tip
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Published</TableHead>
            <TableHead>Order</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(tipsQuery.data ?? []).map((tip: SafetyTip): React.JSX.Element => (
            <TableRow key={tip.id}>
              <TableCell>{truncate(tip.title, TITLE_TRUNCATE_LENGTH)}</TableCell>
              <TableCell>
                <Badge>{tip.category}</Badge>
              </TableCell>
              <TableCell>
                <Switch
                  checked={tip.isPublished}
                  onCheckedChange={(checked: boolean): void => publish.toggle(tip.id, checked)}
                  disabled={publish.pendingId === tip.id}
                />
              </TableCell>
              <TableCell>{tip.order}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={(): void => setDialogTip(tip)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={(): void => setDeleteTip(tip)}>
                    <Trash2 className="h-4 w-4 text-error-red" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {dialogTip ? (
        <TipFormDialog
          tip={dialogTip === 'new' ? null : dialogTip}
          onClose={(): void => setDialogTip(null)}
          onSubmit={(values: TipFormValues): void => {
            saveMutation.mutate(dialogTip === 'new' ? values : { ...values, id: dialogTip.id }, {
              onSuccess: (): void => {
                setDialogTip(null);
              },
            });
          }}
          isSaving={saveMutation.isPending}
        />
      ) : null}

      {deleteTip ? (
        <AlertDialog
          open
          onOpenChange={(open: boolean): void => {
            if (!open) {
              setDeleteTip(null);
            }
          }}
          title="Delete this safety tip?"
          description="This permanently removes the tip from the app. This cannot be undone."
          confirmLabel="Delete"
          isLoading={deleteMutation.isPending}
          onConfirm={(): void => {
            deleteMutation.mutate(deleteTip.id, {
              onSuccess: (): void => {
                setDeleteTip(null);
              },
            });
          }}
        />
      ) : null}
    </div>
  );
}

interface TipFormDialogProps {
  tip: SafetyTip | null;
  onClose: () => void;
  onSubmit: (values: TipFormValues) => void;
  isSaving: boolean;
}

function TipFormDialog({
  tip,
  onClose,
  onSubmit,
  isSaving,
}: TipFormDialogProps): React.JSX.Element {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<TipFormValues>({
    resolver: zodResolver(tipSchema),
    defaultValues: {
      title: tip?.title ?? '',
      content: tip?.content ?? '',
      category: tip?.category ?? '',
      isPublished: tip?.isPublished ?? false,
    },
  });

  return (
    <Dialog
      open
      onOpenChange={(open: boolean): void => {
        if (!open) {
          onClose();
        }
      }}
      title={tip ? 'Edit Safety Tip' : 'Add Safety Tip'}
    >
      <form
        onSubmit={(event: React.FormEvent<HTMLFormElement>): void =>
          void handleSubmit(onSubmit)(event)
        }
        className="flex flex-col gap-4"
      >
        <Input label="Title" {...register('title')} error={errors.title?.message} />
        <Textarea label="Content" {...register('content')} error={errors.content?.message} />
        <Input label="Category" {...register('category')} error={errors.category?.message} />
        <Controller
          control={control}
          name="isPublished"
          render={({ field }): React.JSX.Element => (
            <Switch label="Published" checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
