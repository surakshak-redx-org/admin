import { SUPPORTED_IMAGE_HOSTS } from '@/constants/config';

const HTTPS_PROTOCOL = 'https:';

/**
 * Post and incident data is user-written, so an image URL is only rendered when
 * it is an HTTPS URL on one of the known image hosts.
 */
export function isSupportedImageUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);

    return (
      parsedUrl.protocol === HTTPS_PROTOCOL &&
      SUPPORTED_IMAGE_HOSTS.some((host: string): boolean => host === parsedUrl.hostname)
    );
  } catch {
    return false;
  }
}
