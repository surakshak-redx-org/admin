'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';

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
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';
import type { FAQ } from '@/types/firestore.types';

const faqSchema = z.object({
  question: z.string().min(1, 'Question is required'),
  answer: z.string().min(1, 'Answer is required'),
  category: z.string().min(1, 'Category is required'),
  isPublished: z.boolean(),
});

type FaqFormValues = z.infer<typeof faqSchema>;

function truncate(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

export function FaqsTab(): React.JSX.Element {
  const { idToken } = useAuth();
  const queryClient = useQueryClient();
  const [dialogFaq, setDialogFaq] = useState<FAQ | 'new' | null>(null);
  const [deleteFaq, setDeleteFaq] = useState<FAQ | null>(null);

  const faqsQuery = useQuery({
    queryKey: ['content', 'faqs'],
    queryFn: () => apiFetch<FAQ[]>('/api/content/faqs', idToken ?? ''),
    enabled: idToken !== null,
  });

  const invalidate = (): void => {
    queryClient.invalidateQueries({ queryKey: ['content', 'faqs'] }).catch(() => undefined);
  };

  const saveMutation = useMutation({
    mutationFn: async (values: FaqFormValues & { id?: string }) => {
      const body = JSON.stringify(values);
      if (values.id) {
        return apiFetch(`/api/content/faqs/${values.id}`, idToken ?? '', { method: 'PUT', body });
      }
      return apiFetch('/api/content/faqs', idToken ?? '', { method: 'POST', body });
    },
    onSuccess: () => {
      toast.success('FAQ saved');
      setDialogFaq(null);
      invalidate();
    },
    onError: () => toast.error('Failed to save FAQ'),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/content/faqs/${id}`, idToken ?? '', { method: 'PATCH' }),
    onSuccess: invalidate,
    onError: () => toast.error('Failed to update FAQ'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/content/faqs/${id}`, idToken ?? '', { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('FAQ deleted');
      setDeleteFaq(null);
      invalidate();
    },
    onError: () => toast.error('Failed to delete FAQ'),
  });

  if (faqsQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-deep-ink">FAQ</h2>
        <Button size="sm" onClick={() => setDialogFaq('new')}>
          <Plus className="h-4 w-4" />
          Add FAQ
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Question</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Published</TableHead>
            <TableHead>Order</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(faqsQuery.data ?? []).map((faq) => (
            <TableRow key={faq.id}>
              <TableCell>{truncate(faq.question, TITLE_TRUNCATE_LENGTH)}</TableCell>
              <TableCell>
                <Badge>{faq.category}</Badge>
              </TableCell>
              <TableCell>
                <Switch
                  checked={faq.isPublished}
                  onCheckedChange={() => toggleMutation.mutate(faq.id)}
                />
              </TableCell>
              <TableCell>{faq.order}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setDialogFaq(faq)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteFaq(faq)}>
                    <Trash2 className="h-4 w-4 text-error-red" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {dialogFaq ? (
        <FaqFormDialog
          faq={dialogFaq === 'new' ? null : dialogFaq}
          onClose={() => setDialogFaq(null)}
          onSubmit={(values) =>
            saveMutation.mutate({ ...values, id: dialogFaq === 'new' ? undefined : dialogFaq.id })
          }
          isSaving={saveMutation.isPending}
        />
      ) : null}

      {deleteFaq ? (
        <AlertDialog
          open
          onOpenChange={(open) => !open && setDeleteFaq(null)}
          title="Delete this FAQ?"
          description="This permanently removes the FAQ from the app. This cannot be undone."
          confirmLabel="Delete"
          isLoading={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleteFaq.id)}
        />
      ) : null}
    </div>
  );
}

interface FaqFormDialogProps {
  faq: FAQ | null;
  onClose: () => void;
  onSubmit: (values: FaqFormValues) => void;
  isSaving: boolean;
}

function FaqFormDialog({
  faq,
  onClose,
  onSubmit,
  isSaving,
}: FaqFormDialogProps): React.JSX.Element {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FaqFormValues>({
    resolver: zodResolver(faqSchema),
    defaultValues: {
      question: faq?.question ?? '',
      answer: faq?.answer ?? '',
      category: faq?.category ?? '',
      isPublished: faq?.isPublished ?? false,
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={faq ? 'Edit FAQ' : 'Add FAQ'}>
      <form
        onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        className="flex flex-col gap-4"
      >
        <Input label="Question" {...register('question')} error={errors.question?.message} />
        <Textarea label="Answer" {...register('answer')} error={errors.answer?.message} />
        <Input label="Category" {...register('category')} error={errors.category?.message} />
        <Controller
          control={control}
          name="isPublished"
          render={({ field }) => (
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
