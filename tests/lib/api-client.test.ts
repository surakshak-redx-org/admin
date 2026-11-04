import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SESSION_ENDED_ERROR } from '@/constants/config';
import { apiFetch } from '@/lib/api/client';

interface MockAuth {
  currentUser: { uid: string } | null;
}

const mockAuth = vi.hoisted((): MockAuth => ({ currentUser: null }));

vi.mock('@/lib/firebase/client', () => ({
  getClientAuth: (): MockAuth => mockAuth,
}));

const ID_TOKEN = 'id-token-123';

describe('apiFetch', (): void => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach((): void => {
    fetchMock.mockImplementation((): Promise<Response> =>
      Promise.resolve(new Response(JSON.stringify({ data: { ok: true }, error: null }))),
    );
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach((): void => {
    vi.unstubAllGlobals();
    mockAuth.currentUser = null;
  });

  it('sends the bearer token while a user is signed in', async (): Promise<void> => {
    mockAuth.currentUser = { uid: 'admin-1' };

    await expect(apiFetch<{ ok: boolean }>('/api/stats', ID_TOKEN)).resolves.toEqual({ ok: true });

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.headers).toMatchObject({ Authorization: `Bearer ${ID_TOKEN}` });
  });

  it('refuses to send once the tab has no signed-in user', async (): Promise<void> => {
    mockAuth.currentUser = null;

    await expect(apiFetch('/api/content/laws', ID_TOKEN, { method: 'DELETE' })).rejects.toThrow(
      SESSION_ENDED_ERROR,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
