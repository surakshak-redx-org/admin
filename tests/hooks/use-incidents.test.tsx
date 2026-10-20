import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useRecentIncidentsQuery } from '@/hooks/use-incidents';

const { mockGetIncidents } = vi.hoisted(() => ({ mockGetIncidents: vi.fn() }));

vi.mock('@/lib/auth/session', (): Record<string, unknown> => ({
  useAuth: (): { idToken: string } => ({ idToken: 'test-token' }),
}));
vi.mock('@/services/incidents.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/incidents.service')>();
  return { ...actual, getIncidents: mockGetIncidents };
});

describe('useRecentIncidentsQuery', () => {
  beforeEach((): void => {
    mockGetIncidents.mockReset();
    mockGetIncidents.mockResolvedValue([]);
  });

  it('requests unresolved incidents with the configured limit', async (): Promise<void> => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren): React.JSX.Element => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useRecentIncidentsQuery(10), { wrapper });

    await waitFor(() =>
      expect(mockGetIncidents).toHaveBeenCalledWith('test-token', {
        status: 'unresolved',
        limit: 10,
      }),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
