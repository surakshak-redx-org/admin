'use client';

import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

import { AlertDialog } from '@/components/ui/AlertDialog';
import { Badge } from '@/components/ui/Badge';
import type { BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import {
  COMMUNITY_REPORT_HIDE_THRESHOLD,
  CONTENT_PREVIEW_LENGTH,
  REPORT_COUNT_DANGER_THRESHOLD,
} from '@/constants/config';
import { useModerationActionMutation, useModerationPostsQuery } from '@/hooks';
import type { ModerationPost } from '@/services/moderation.service';
import type { PostType } from '@/types/firestore.types';

const TYPE_VARIANT: Record<PostType, BadgeVariant> = {
  help_request: 'error',
  location: 'info',
  image: 'default',
  text: 'default',
};

function truncate(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

export default function ModerationPage(): React.JSX.Element {
  const [restorePost, setRestorePost] = useState<ModerationPost | null>(null);
  const [deletePost, setDeletePost] = useState<ModerationPost | null>(null);

  const postsQuery = useModerationPostsQuery();
  const actionMutation = useModerationActionMutation();

  const posts = postsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* What this queue is was never stated anywhere on the page (BUG-009). */}
      <div>
        <h1 className="text-2xl font-semibold text-deep-ink">Reported Posts</h1>
        <p className="mt-1 max-w-3xl text-sm text-stone">
          Community posts are hidden from the app automatically once{' '}
          {COMMUNITY_REPORT_HIDE_THRESHOLD} users report them. Review each one:{' '}
          <span className="font-medium">Restore</span> makes it visible again and clears its
          reports; <span className="font-medium">Delete</span> removes it permanently.
        </p>
      </div>

      {postsQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : postsQuery.isError ? (
        <EmptyState
          icon={AlertCircle}
          iconClassName="h-10 w-10 text-error-red"
          title="Couldn't load reported posts"
          subtitle="Refresh the page to try again."
        />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          iconClassName="h-10 w-10 text-forest-green"
          title="All clear — no posts need review"
          subtitle="Posts appear here once they are hidden by user reports."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Content Preview</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Reports</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.map((post): React.JSX.Element => (
              <TableRow key={post.id}>
                <TableCell className="max-w-xs">
                  {truncate(post.content, CONTENT_PREVIEW_LENGTH)}
                </TableCell>
                <TableCell>{post.isAnonymous ? 'Anonymous' : post.authorName}</TableCell>
                <TableCell>{post.city}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      post.reportCount >= REPORT_COUNT_DANGER_THRESHOLD ? 'error' : 'default'
                    }
                  >
                    {post.reportCount}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={TYPE_VARIANT[post.type]}>{post.type}</Badge>
                </TableCell>
                <TableCell>
                  {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={(): void => setRestorePost(post)}>
                      Restore
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={(): void => setDeletePost(post)}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {restorePost ? (
        <AlertDialog
          open
          onOpenChange={(open: boolean): void => {
            if (!open) {
              setRestorePost(null);
            }
          }}
          title="Restore this post?"
          description="This will make the post visible again and reset report count."
          confirmLabel="Restore"
          confirmVariant="default"
          isLoading={actionMutation.isPending}
          onConfirm={(): void => {
            actionMutation.mutate(
              { id: restorePost.id, action: 'restore' },
              {
                onSuccess: (): void => {
                  setRestorePost(null);
                },
              },
            );
          }}
        />
      ) : null}

      {deletePost ? (
        <AlertDialog
          open
          onOpenChange={(open: boolean): void => {
            if (!open) {
              setDeletePost(null);
            }
          }}
          title="Permanently delete this post?"
          description="The post and its report history are removed for everyone. This cannot be undone."
          confirmLabel="Delete"
          isLoading={actionMutation.isPending}
          onConfirm={(): void => {
            actionMutation.mutate(
              { id: deletePost.id, action: 'delete' },
              {
                onSuccess: (): void => {
                  setDeletePost(null);
                },
              },
            );
          }}
        />
      ) : null}
    </div>
  );
}
