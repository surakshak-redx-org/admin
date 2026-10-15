'use client';

import { format, formatDistanceToNow } from 'date-fns';
import Image from 'next/image';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import type { BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import {
  COMMUNITY_IMAGE_HOSTS,
  COMMUNITY_REPORT_HIDE_THRESHOLD,
  LOCATION_URL_PREFIX,
} from '@/constants/config';
import type { ModerationPost } from '@/services/moderation.service';
import type { PostType } from '@/types/firestore.types';

const TYPE_VARIANT: Record<PostType, BadgeVariant> = {
  help_request: 'error',
  location: 'info',
  image: 'default',
  text: 'default',
};

const DATE_TIME_FORMAT = 'dd MMM yyyy, hh:mm a';
const ANONYMOUS_LABEL = 'Anonymous';

/** Post data is user-written — only load images from the hosts next.config allows. */
export function isSupportedImageUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'https:' && COMMUNITY_IMAGE_HOSTS.includes(parsedUrl.hostname);
  } catch {
    return false;
  }
}

/** Post data is user-written — only link out to the documented Maps URL format. */
export function isSupportedLocationUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && url.startsWith(LOCATION_URL_PREFIX);
}

export interface PostPreviewDialogProps {
  post: ModerationPost;
  isBusy: boolean;
  onClose: () => void;
  onRestore: (post: ModerationPost) => void;
  onDelete: (post: ModerationPost) => void;
}

/**
 * Shows everything an admin needs to judge a hidden post — full image, full
 * caption, author, timestamp and report count — before restoring or deleting it.
 */
export function PostPreviewDialog({
  post,
  isBusy,
  onClose,
  onRestore,
  onDelete,
}: PostPreviewDialogProps): React.JSX.Element {
  const authorName = post.isAnonymous ? ANONYMOUS_LABEL : post.authorName;
  const createdAt = new Date(post.createdAt);
  const imageUrl = isSupportedImageUrl(post.imageUrl) ? post.imageUrl : null;
  const absoluteDate = format(createdAt, DATE_TIME_FORMAT);
  const relativeDate = formatDistanceToNow(createdAt, { addSuffix: true });

  return (
    <Dialog
      open
      onOpenChange={(open: boolean): void => {
        if (!open) onClose();
      }}
      title="Review hidden post"
      description="Check the full post before you restore or delete it."
      className="max-w-2xl"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar
            name={authorName}
            src={post.isAnonymous ? undefined : post.authorPhotoUrl}
            size="md"
          />
          <div>
            <p className="font-semibold text-deep-ink">{authorName}</p>
            <p className="text-sm text-stone">
              {post.city}
              {post.state ? `, ${post.state}` : ''}
            </p>
          </div>
        </div>

        {imageUrl ? (
          <div className="relative h-72 w-full overflow-hidden rounded-lg bg-gray-100">
            <Image
              src={imageUrl}
              alt="Attached to the hidden post"
              fill
              sizes="(min-width: 768px) 640px, 100vw"
              className="object-contain"
            />
          </div>
        ) : post.type === 'image' ? (
          <p className="rounded-lg border border-dashed border-stone/30 p-4 text-sm text-stone">
            This is an image post, but the image is missing or cannot be displayed.
          </p>
        ) : null}

        <div className="rounded-lg border border-stone/20 p-4">
          <p className="whitespace-pre-wrap text-sm text-deep-ink">{post.content}</p>
        </div>

        {isSupportedLocationUrl(post.locationUrl) ? (
          <a
            href={post.locationUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-shakti-purple underline"
          >
            View shared location
          </a>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={TYPE_VARIANT[post.type]}>{post.type}</Badge>
          <Badge variant="error">
            {post.reportCount} {post.reportCount === 1 ? 'report' : 'reports'}
          </Badge>
          <span className="text-xs text-stone">
            Hidden automatically at {COMMUNITY_REPORT_HIDE_THRESHOLD} reports
          </span>
        </div>

        <p className="text-sm text-stone">
          Posted {absoluteDate} ({relativeDate})
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isBusy}>
            Close
          </Button>
          <Button variant="destructive" onClick={(): void => onDelete(post)} disabled={isBusy}>
            Delete
          </Button>
          <Button onClick={(): void => onRestore(post)} disabled={isBusy}>
            Restore
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
