import { describe, expect, it } from 'vitest';

import { isSupportedImageUrl } from '@/lib/image-url';

describe('isSupportedImageUrl', (): void => {
  it('accepts a Firebase Storage download URL with a token', (): void => {
    const url =
      'https://firebasestorage.googleapis.com/v0/b/surakshak-2869a.firebasestorage.app/o/posts%2Fa.jpg?alt=media&token=abc';

    expect(isSupportedImageUrl(url)).toBe(true);
  });

  it('accepts a Google profile image URL', (): void => {
    expect(isSupportedImageUrl('https://lh3.googleusercontent.com/a/photo=s96-c')).toBe(true);
  });

  it('rejects plain http URLs', (): void => {
    const url = 'http://firebasestorage.googleapis.com/v0/b/x/o/a.jpg';

    expect(isSupportedImageUrl(url)).toBe(false);
  });

  it('rejects hosts that are not on the allowlist', (): void => {
    expect(isSupportedImageUrl('https://example.com/a.jpg')).toBe(false);
  });

  it('rejects look-alike hosts that only contain an allowed host', (): void => {
    const url = 'https://firebasestorage.googleapis.com.evil.com/a.jpg';

    expect(isSupportedImageUrl(url)).toBe(false);
  });

  it('rejects malformed and empty values instead of throwing', (): void => {
    expect(isSupportedImageUrl('')).toBe(false);
    expect(isSupportedImageUrl('not a url')).toBe(false);
    expect(isSupportedImageUrl('javascript:alert(1)')).toBe(false);
  });
});
