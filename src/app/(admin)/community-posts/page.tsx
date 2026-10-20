'use client';

import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, RefreshCw } from 'lucide-react';
import Image from 'next/image';
import { useMemo, useState } from 'react';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
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
  COMMUNITY_POST_SORTS,
  COMMUNITY_POST_STATUSES,
  LOCATION_URL_PREFIX,
} from '@/constants/config';
import { useCommunityPostsInfiniteQuery, useDeleteCommunityPostMutation } from '@/hooks';
import type { Serialized } from '@/types/api.types';
import type { CommunityPost, PostType } from '@/types/firestore.types';

type ClientPost = Serialized<CommunityPost> & { id: string };
type CommunityPostSort = (typeof COMMUNITY_POST_SORTS)[number];
type CommunityPostStatus = (typeof COMMUNITY_POST_STATUSES)[number];

const PAGE_TITLE = 'Community Posts';
const PAGE_SUBTITLE = 'View and manage all community posts.';
const SEARCH_PLACEHOLDER = 'Search by post, author or city\u2026';
const ELLIPSIS = '\u2026';
const ANONYMOUS_LABEL = 'Anonymous';
const LOAD_ERROR_MESSAGE = 'Could not load community posts.';
const EMPTY_FILTERED_TITLE = 'No posts match your filters';
const EMPTY_FILTERED_SUBTITLE = 'Try changing your search or filter.';
const EMPTY_TITLE = 'No community posts yet';
const LOADING_MORE_LABEL = 'Loading...';
const LOAD_MORE_LABEL = 'Load More';
const POST_PREVIEW_LENGTH = 80;
const DELETE_PREVIEW_LENGTH = 120;
const DELETE_DIALOG_TITLE = 'Delete Community Post';
const DELETE_DIALOG_MESSAGE =
  'Are you sure you want to delete this community post? This action cannot be undone.';

function isCommunityPostSort(value: string): value is CommunityPostSort {
  return COMMUNITY_POST_SORTS.some((sort): boolean => sort === value);
}

function isCommunityPostStatus(value: string): value is CommunityPostStatus {
  return COMMUNITY_POST_STATUSES.some((status): boolean => status === value);
}

const TYPE_VARIANT: Record<PostType, 'default' | 'info' | 'error'> = {
  text: 'default',
  location: 'info',
  image: 'default',
  help_request: 'error',
};

function formatPostType(type: PostType): string {
  return type
    .replace('_', ' ')
    .replace(/\b\w/g, (character: string): string => character.toUpperCase());
}

function truncate(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length)}${ELLIPSIS}` : text;
}

function isSupportedImageUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);

    return (
      parsedUrl.protocol === 'https:' &&
      (parsedUrl.hostname === 'firebasestorage.googleapis.com' ||
        parsedUrl.hostname === 'lh3.googleusercontent.com')
    );
  } catch {
    return false;
  }
}

/** Post data is user-written — only link out to the documented Maps URL format. */
function isSupportedLocationUrl(url: string): boolean {
  return url.startsWith(LOCATION_URL_PREFIX);
}

export default function CommunityPostsPage(): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CommunityPostStatus>('all');
  const [sortBy, setSortBy] = useState<CommunityPostSort>('newest');
  const [selectedPost, setSelectedPost] = useState<ClientPost | null>(null);
  const [postToDelete, setPostToDelete] = useState<ClientPost | null>(null);

  const postsQuery = useCommunityPostsInfiniteQuery(sortBy, statusFilter);
  const deleteMutation = useDeleteCommunityPostMutation();

  const posts = useMemo(
    (): ClientPost[] => postsQuery.data?.pages.flatMap((page): ClientPost[] => page.posts) ?? [],
    [postsQuery.data],
  );

  // Status and sort are applied server-side (they change the query key), so
  // only the free-text search filters the pages already loaded.
  const filteredPosts = useMemo((): ClientPost[] => {
    const searchTerm = search.trim().toLowerCase();
    if (!searchTerm) return posts;

    return posts.filter(
      (post: ClientPost): boolean =>
        post.content.toLowerCase().includes(searchTerm) ||
        (!post.isAnonymous && post.authorName.toLowerCase().includes(searchTerm)) ||
        post.city.toLowerCase().includes(searchTerm),
    );
  }, [posts, search]);

  const hasActiveFilters = search !== '' || statusFilter !== 'all';

  const handleDelete = (): void => {
    if (!postToDelete) return;
    deleteMutation.mutate(postToDelete.id, {
      onSettled: (): void => {
        setPostToDelete(null);
      },
    });
  };

  const handleRetry = (): void => {
    postsQuery.refetch().catch((): undefined => undefined);
  };

  let content: React.JSX.Element;

  if (postsQuery.isLoading) {
    content = (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  } else if (postsQuery.isError) {
    content = (
      <Card>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-error-red" aria-hidden="true" />
            <p className="text-sm text-error-red">{LOAD_ERROR_MESSAGE}</p>
          </div>
          <Button variant="outline" isLoading={postsQuery.isFetching} onClick={handleRetry}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  } else if (filteredPosts.length === 0) {
    content = (
      <div className="py-16 text-center">
        <p className="text-sm font-medium text-deep-ink">
          {hasActiveFilters ? EMPTY_FILTERED_TITLE : EMPTY_TITLE}
        </p>

        {hasActiveFilters ? (
          <p className="mt-1 text-sm text-stone">{EMPTY_FILTERED_SUBTITLE}</p>
        ) : null}
      </div>
    );
  } else {
    content = (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Author</TableHead>
            <TableHead>Post</TableHead>
            <TableHead className="min-w-28">City</TableHead>
            <TableHead className="text-center">Type</TableHead>
            <TableHead>Reports</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {filteredPosts.map((post: ClientPost): React.JSX.Element => (
            <TableRow key={post.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar
                    name={post.isAnonymous ? ANONYMOUS_LABEL : post.authorName}
                    src={post.isAnonymous ? undefined : post.authorPhotoUrl}
                    size="sm"
                  />
                  <span>{post.isAnonymous ? ANONYMOUS_LABEL : post.authorName}</span>
                </div>
              </TableCell>

              <TableCell className="max-w-xs">
                {truncate(post.content, POST_PREVIEW_LENGTH)}
              </TableCell>

              <TableCell className="whitespace-nowrap">{post.city}</TableCell>

              <TableCell className="text-center">
                <Badge variant={TYPE_VARIANT[post.type]}>{formatPostType(post.type)}</Badge>
              </TableCell>

              <TableCell>{post.reportCount}</TableCell>

              <TableCell>
                <Badge variant={post.isHidden ? 'error' : 'default'}>
                  {post.isHidden ? 'Hidden' : 'Visible'}
                </Badge>
              </TableCell>

              <TableCell className="whitespace-nowrap">
                {formatDistanceToNow(new Date(post.createdAt), {
                  addSuffix: true,
                })}
              </TableCell>

              <TableCell>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={(): void => setSelectedPost(post)}>
                    View
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="border-error-red text-error-red hover:bg-error-red/10"
                    onClick={(): void => setPostToDelete(post)}
                  >
                    Delete
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
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-deep-ink">{PAGE_TITLE}</h1>
        <p className="mt-1 text-sm text-stone">{PAGE_SUBTITLE}</p>
        <p className="mt-2 text-xs font-medium text-stone">
          {filteredPosts.length} loaded {filteredPosts.length === 1 ? 'post' : 'posts'}
        </p>
      </div>

      <div className="-mt-2 flex flex-wrap items-end gap-3">
        <Input
          placeholder={SEARCH_PLACEHOLDER}
          value={search}
          onChange={(event: React.ChangeEvent<HTMLInputElement>): void =>
            setSearch(event.target.value)
          }
          className="w-80"
        />

        <Select
          label="Status"
          value={statusFilter}
          onValueChange={(value: string): void => {
            if (isCommunityPostStatus(value)) setStatusFilter(value);
          }}
          options={[
            { value: 'all', label: 'All' },
            { value: 'visible', label: 'Visible' },
            { value: 'hidden', label: 'Hidden' },
          ]}
        />

        <Select
          label="Sort By"
          value={sortBy}
          onValueChange={(value: string): void => {
            if (isCommunityPostSort(value)) setSortBy(value);
          }}
          options={[
            { value: 'newest', label: 'Newest' },
            { value: 'oldest', label: 'Oldest' },
            { value: 'most-reported', label: 'Most Reported' },
          ]}
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-transparent">Refresh</span>

          <Button
            size="md"
            variant="outline"
            onClick={handleRetry}
            disabled={postsQuery.isFetching}
          >
            <RefreshCw className={postsQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Refresh
          </Button>
        </div>
      </div>

      {content}

      {postsQuery.hasNextPage ? (
        <div className="flex justify-center py-4">
          <Button
            variant="outline"
            onClick={(): void => {
              void postsQuery.fetchNextPage();
            }}
            disabled={postsQuery.isFetchingNextPage}
          >
            {postsQuery.isFetchingNextPage ? LOADING_MORE_LABEL : LOAD_MORE_LABEL}
          </Button>
        </div>
      ) : null}

      {selectedPost ? (
        <Dialog
          open
          onOpenChange={(open: boolean): void => {
            if (!open) setSelectedPost(null);
          }}
          title="Community Post"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar
                name={selectedPost.isAnonymous ? ANONYMOUS_LABEL : selectedPost.authorName}
                src={selectedPost.isAnonymous ? undefined : selectedPost.authorPhotoUrl}
                size="lg"
              />

              <div>
                <p className="font-semibold text-deep-ink">
                  {selectedPost.isAnonymous ? ANONYMOUS_LABEL : selectedPost.authorName}
                </p>

                <p className="text-sm text-stone">
                  {selectedPost.city}, {selectedPost.state}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-stone/20 p-4">
              <p className="whitespace-pre-wrap text-sm text-deep-ink">{selectedPost.content}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant={TYPE_VARIANT[selectedPost.type]}>
                {formatPostType(selectedPost.type)}
              </Badge>

              <Badge variant={selectedPost.isHidden ? 'error' : 'default'}>
                {selectedPost.isHidden ? 'Hidden' : 'Visible'}
              </Badge>

              <Badge>{selectedPost.reportCount} reports</Badge>
            </div>

            <p className="text-sm text-stone">
              Posted{' '}
              {formatDistanceToNow(new Date(selectedPost.createdAt), {
                addSuffix: true,
              })}
            </p>

            {selectedPost.imageUrl && isSupportedImageUrl(selectedPost.imageUrl) ? (
              <Image
                src={selectedPost.imageUrl}
                alt="Community post"
                width={800}
                height={600}
                className="max-h-80 w-full rounded-lg object-contain"
              />
            ) : null}

            {selectedPost.locationUrl && isSupportedLocationUrl(selectedPost.locationUrl) ? (
              <a
                href={selectedPost.locationUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-shakti-purple underline"
              >
                View shared location
              </a>
            ) : null}
          </div>
        </Dialog>
      ) : null}

      {postToDelete ? (
        <Dialog
          open
          onOpenChange={(open: boolean): void => {
            if (!open) setPostToDelete(null);
          }}
          title={DELETE_DIALOG_TITLE}
        >
          <div className="space-y-4">
            <p className="text-sm text-stone">{DELETE_DIALOG_MESSAGE}</p>

            <div className="rounded-lg border border-stone/20 p-4">
              <p className="text-sm text-deep-ink">
                {truncate(postToDelete.content, DELETE_PREVIEW_LENGTH)}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={(): void => setPostToDelete(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>

              <Button
                variant="destructive"
                onClick={handleDelete}
                isLoading={deleteMutation.isPending}
              >
                Delete
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
