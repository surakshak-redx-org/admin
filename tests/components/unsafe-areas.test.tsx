import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UnsafeAreasPage from '@/app/(admin)/unsafe-areas/page';

const { mockUnsafeAreasQuery, mockRefetch } = vi.hoisted(() => ({
  mockUnsafeAreasQuery: vi.fn(),
  mockRefetch: vi.fn(),
}));

vi.mock('@/hooks', (): Record<string, unknown> => ({
  useUnsafeAreasQuery: mockUnsafeAreasQuery,
  useUnsafeAreaActionMutation: (): Record<string, unknown> => ({
    isPending: false,
    mutate: vi.fn(),
  }),
}));
vi.mock('next/navigation', () => ({
  useSearchParams: (): URLSearchParams => new URLSearchParams(),
}));

describe('Unsafe areas reporter lookup errors', () => {
  beforeEach((): void => {
    mockRefetch.mockReset();
    mockUnsafeAreasQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch: mockRefetch,
    });
  });

  it('shows a retryable error instead of reporting that the list is empty', (): void => {
    render(<UnsafeAreasPage />);

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Could not load unsafe areas.');
    expect(screen.getByRole('button', { name: 'Retry' })).not.toBeNull();
    expect(screen.queryByText('No unsafe areas')).toBeNull();
  });

  it('retries loading unsafe-area reports', (): void => {
    render(<UnsafeAreasPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});
