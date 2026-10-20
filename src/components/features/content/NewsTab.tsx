'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { AlertCircle, Newspaper, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { useTogglePublished } from '@/components/features/content/useTogglePublished';
import { AlertDialog } from '@/components/ui/AlertDialog';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
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
import { useDeleteNewsMutation, useNewsQuery, useSaveNewsMutation } from '@/hooks';
import type { NewsItemWithId } from '@/services/content.service';

const SECTION_TITLE = 'News';
const ADD_LABEL = 'Add News';
const EDIT_DIALOG_TITLE = 'Edit News';
const ELLIPSIS = '\u2026';
const LOAD_ERROR_MESSAGE = 'Could not load news.';
const EMPTY_TITLE = 'No news yet';
const EMPTY_SUBTITLE = 'Add a news item to show it in the app.';
const DELETE_TITLE = 'Delete this news item?';
const DELETE_DESCRIPTION =
  'This permanently removes the news item from the app. This cannot be undone.';
const TABLE_DATE_FORMAT = 'PP';
const DATETIME_LOCAL_FORMAT = "yyyy-MM-dd'T'HH:mm";

const newsSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  summary: z.string().min(1, 'Summary is required'),
  content: z.string().min(1, 'Content is required'),
  imageUrl: z.string(),
  category: z.string().min(1, 'Category is required'),
  isPublished: z.boolean(),
  publishedAt: z.string(),
});

type NewsFormValues = z.infer<typeof newsSchema>;

function truncate(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length)}${ELLIPSIS}` : text;
}

export function NewsTab(): React.JSX.Element {
  const [dialogNews, setDialogNews] = useState<NewsItemWithId | 'new' | null>(null);
  const [deleteNews, setDeleteNews] = useState<NewsItemWithId | null>(null);

  const newsQuery = useNewsQuery();
  const saveMutation = useSaveNewsMutation();
  const deleteMutation = useDeleteNewsMutation();
  const publish = useTogglePublished<NewsItemWithId>('news', 'News item');

  const newsItems = newsQuery.data ?? [];

  const handleRetry = (): void => {
    void newsQuery.refetch();
  };

  let content: React.JSX.Element;

  if (newsQuery.isLoading) {
    content = (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  } else if (newsQuery.isError) {
    content = (
      <Card>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-error-red" aria-hidden="true" />
            <p className="text-sm text-error-red">{LOAD_ERROR_MESSAGE}</p>
          </div>
          <Button variant="outline" isLoading={newsQuery.isFetching} onClick={handleRetry}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  } else if (newsItems.length === 0) {
    content = <EmptyState icon={Newspaper} title={EMPTY_TITLE} subtitle={EMPTY_SUBTITLE} />;
  } else {
    content = (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Published</TableHead>
            <TableHead>Published At</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {newsItems.map((news: NewsItemWithId): React.JSX.Element => (
            <TableRow key={news.id}>
              <TableCell>{truncate(news.title, TITLE_TRUNCATE_LENGTH)}</TableCell>
              <TableCell>
                <Badge>{news.category}</Badge>
              </TableCell>
              <TableCell>
                <Switch
                  checked={news.isPublished}
                  onCheckedChange={(checked: boolean): void => publish.toggle(news.id, checked)}
                  disabled={publish.pendingId === news.id}
                />
              </TableCell>
              <TableCell>{format(new Date(news.publishedAt), TABLE_DATE_FORMAT)}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={(): void => setDialogNews(news)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={(): void => setDeleteNews(news)}>
                    <Trash2 className="h-4 w-4 text-error-red" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-deep-ink">{SECTION_TITLE}</h2>
        <Button size="sm" onClick={(): void => setDialogNews('new')}>
          <Plus className="h-4 w-4" />
          {ADD_LABEL}
        </Button>
      </div>

      {content}

      {dialogNews ? (
        <NewsFormDialog
          news={dialogNews === 'new' ? null : dialogNews}
          onClose={(): void => setDialogNews(null)}
          onSubmit={(values: NewsFormValues): void => {
            // `datetime-local` has no timezone; converting here, in the admin's
            // browser, keeps an IST time from being read as UTC on the server.
            const publishedAt =
              values.publishedAt === ''
                ? values.publishedAt
                : new Date(values.publishedAt).toISOString();
            const payload = { ...values, publishedAt };
            saveMutation.mutate(
              dialogNews === 'new' ? payload : { ...payload, id: dialogNews.id },
              {
                onSuccess: (): void => {
                  setDialogNews(null);
                },
              },
            );
          }}
          isSaving={saveMutation.isPending}
        />
      ) : null}

      {deleteNews ? (
        <AlertDialog
          open
          onOpenChange={(open: boolean): void => {
            if (!open) {
              setDeleteNews(null);
            }
          }}
          title={DELETE_TITLE}
          description={DELETE_DESCRIPTION}
          confirmLabel="Delete"
          isLoading={deleteMutation.isPending}
          onConfirm={(): void => {
            deleteMutation.mutate(deleteNews.id, {
              onSuccess: (): void => {
                setDeleteNews(null);
              },
            });
          }}
        />
      ) : null}
    </div>
  );
}

interface NewsFormDialogProps {
  news: NewsItemWithId | null;
  onClose: () => void;
  onSubmit: (values: NewsFormValues) => void;
  isSaving: boolean;
}

function NewsFormDialog({
  news,
  onClose,
  onSubmit,
  isSaving,
}: NewsFormDialogProps): React.JSX.Element {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<NewsFormValues>({
    resolver: zodResolver(newsSchema),
    defaultValues: {
      title: news?.title ?? '',
      summary: news?.summary ?? '',
      content: news?.content ?? '',
      imageUrl: news?.imageUrl ?? '',
      category: news?.category ?? '',
      isPublished: news?.isPublished ?? false,
      publishedAt: news
        ? format(new Date(news.publishedAt), DATETIME_LOCAL_FORMAT)
        : format(new Date(), DATETIME_LOCAL_FORMAT),
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
      title={news ? EDIT_DIALOG_TITLE : ADD_LABEL}
    >
      <form
        onSubmit={(event: React.FormEvent<HTMLFormElement>): void =>
          void handleSubmit(onSubmit)(event)
        }
        className="flex flex-col gap-4"
      >
        <Input label="Title" {...register('title')} error={errors.title?.message} />
        <Textarea label="Summary" {...register('summary')} error={errors.summary?.message} />
        <Textarea
          label="Content"
          className="min-h-32"
          {...register('content')}
          error={errors.content?.message}
        />
        <Input label="Image URL (optional)" {...register('imageUrl')} />
        <Input label="Category" {...register('category')} error={errors.category?.message} />
        <Input type="datetime-local" label="Published At" {...register('publishedAt')} />
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
