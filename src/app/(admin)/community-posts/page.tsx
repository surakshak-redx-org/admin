'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { RefreshCw } from 'lucide-react';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
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
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';
import type { Serialized } from '@/types/api.types';
import type { CommunityPost, PostType } from '@/types/firestore.types';

type ClientPost = Serialized<CommunityPost> & { id: string };

const TYPE_VARIANT: Record<PostType, 'default' | 'info' | 'error'> = {
  text: 'default',
  location: 'info',
  image: 'default',
  help_request: 'error',
};

function formatPostType(type: PostType): string {
  return type.replace('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function truncate(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

export default function CommunityPostsPage(): React.JSX.Element {
  const { idToken } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedPost, setSelectedPost] = useState<ClientPost | null>(null);
  const [postToDelete, setPostToDelete] = useState<ClientPost | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const postsQuery = useQuery({
    queryKey: ['community-posts'],
    queryFn: (): Promise<ClientPost[]> =>
      apiFetch<ClientPost[]>('/api/community-posts', idToken ?? ''),
    enabled: idToken !== null,
  });

  const filteredPosts = useMemo((): ClientPost[] => {
    const posts = postsQuery.data ?? [];
    const searchTerm = search.trim().toLowerCase();

    const filtered = posts.filter((post) => {
      const matchesSearch =
        !searchTerm ||
        post.content.toLowerCase().includes(searchTerm) ||
        post.authorName.toLowerCase().includes(searchTerm) ||
        post.city.toLowerCase().includes(searchTerm);

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'hidden' && post.isHidden) ||
        (statusFilter === 'visible' && !post.isHidden);

      return matchesSearch && matchesStatus;
    });

    return [...filtered].sort((firstPost, secondPost) => {
      if (sortBy === 'most-reported') {
        return secondPost.reportCount - firstPost.reportCount;
      }

      const firstDate = new Date(firstPost.createdAt).getTime();
      const secondDate = new Date(secondPost.createdAt).getTime();

      return sortBy === 'newest' ? secondDate - firstDate : firstDate - secondDate;
    });
  }, [postsQuery.data, search, statusFilter, sortBy]);

  const handleDelete = async (): Promise<void> => {
    if (!postToDelete) return;

    setIsDeleting(true);

    try {
      await apiFetch(`/api/community-posts/${postToDelete.id}`, idToken ?? '', {
        method: 'DELETE',
      });

      await postsQuery.refetch();
      await queryClient.invalidateQueries({ queryKey: ['moderation'] });
      setPostToDelete(null);
    } catch {
      toast.error('Failed to delete post');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-deep-ink">Community Posts</h1>
        <p className="mt-1 text-sm text-stone">View and manage all community posts.</p>
        <p className="mt-2 text-xs font-medium text-stone">
          {filteredPosts.length} {filteredPosts.length === 1 ? 'post' : 'posts'}
        </p>
      </div>

      <div className="-mt-2 flex flex-wrap items-end gap-3">
        <Input
          placeholder="Search by post, author or city…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-80"
        />

        <Select
          label="Status"
          value={statusFilter}
          onValueChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'visible', label: 'Visible' },
            { value: 'hidden', label: 'Hidden' },
          ]}
        />

        <Select
          label="Sort By"
          value={sortBy}
          onValueChange={setSortBy}
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
            onClick={() => {
              postsQuery.refetch().catch(() => undefined);
            }}
            disabled={postsQuery.isFetching}
          >
            <RefreshCw className={postsQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Refresh
          </Button>
        </div>
      </div>

      {postsQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : postsQuery.isError ? (
        <div className="py-16 text-center">
          <p className="text-sm font-medium text-deep-ink">Failed to load community posts.</p>
          <p className="mt-1 text-sm text-stone">Please try refreshing the page.</p>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm font-medium text-deep-ink">
            {search || statusFilter !== 'all'
              ? 'No posts match your filters'
              : 'No community posts yet'}
          </p>

          {search || statusFilter !== 'all' ? (
            <p className="mt-1 text-sm text-stone">Try changing your search or filter.</p>
          ) : null}
        </div>
      ) : (
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
            {filteredPosts.map((post) => (
              <TableRow key={post.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar
                      name={post.isAnonymous ? 'Anonymous' : post.authorName}
                      src={post.isAnonymous ? undefined : post.authorPhotoUrl}
                      size="sm"
                    />
                    <span>{post.isAnonymous ? 'Anonymous' : post.authorName}</span>
                  </div>
                </TableCell>

                <TableCell className="max-w-xs">{truncate(post.content, 80)}</TableCell>

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
                    <Button size="sm" variant="outline" onClick={() => setSelectedPost(post)}>
                      View
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="border-error-red text-error-red hover:bg-error-red/10"
                      onClick={() => setPostToDelete(post)}
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

      {selectedPost ? (
        <Dialog open onOpenChange={(open) => !open && setSelectedPost(null)} title="Community Post">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar
                name={selectedPost.isAnonymous ? 'Anonymous' : selectedPost.authorName}
                src={selectedPost.isAnonymous ? undefined : selectedPost.authorPhotoUrl}
                size="lg"
              />

              <div>
                <p className="font-semibold text-deep-ink">
                  {selectedPost.isAnonymous ? 'Anonymous' : selectedPost.authorName}
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

            {selectedPost.imageUrl ? (
              <Image
                src={selectedPost.imageUrl}
                alt="Community post"
                width={800}
                height={600}
                className="max-h-80 w-full rounded-lg object-contain"
              />
            ) : null}

            {selectedPost.locationUrl ? (
              <a
                href={selectedPost.locationUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-electric-blue underline"
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
          onOpenChange={(open) => !open && setPostToDelete(null)}
          title="Delete Community Post"
        >
          <div className="space-y-4">
            <p className="text-sm text-stone">
              Are you sure you want to delete this community post? This action cannot be undone.
            </p>

            <div className="rounded-lg border border-stone/20 p-4">
              <p className="text-sm text-deep-ink">{truncate(postToDelete.content, 120)}</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPostToDelete(null)} disabled={isDeleting}>
                Cancel
              </Button>

              <Button
                variant="destructive"
                onClick={() => {
                  void handleDelete();
                }}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
