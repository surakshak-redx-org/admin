'use client';

import { AlertTriangle, LayoutDashboard, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { logger } from '@/lib/logger';

const ERROR_LOG_MESSAGE = 'Route segment error caught by boundary';
const ERROR_TITLE = 'Something went wrong';
const ERROR_DESCRIPTION =
  'An unexpected error occurred while processing this page. You can attempt to retry the action or navigate back to the dashboard.';
const DIGEST_LABEL = 'Error Reference:';
const RETRY_BUTTON_TEXT = 'Try again';
const DASHBOARD_BUTTON_TEXT = 'Back to Dashboard';
const DASHBOARD_HREF = '/';

export interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Route segment error boundary fallback component for Surakshak Admin Dashboard.
 */
export default function ErrorBoundary({ error, reset }: ErrorBoundaryProps): React.JSX.Element {
  useEffect((): void => {
    logger.error(ERROR_LOG_MESSAGE, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      metadata: error.digest ? { digest: error.digest } : undefined,
    });
  }, [error]);

  const handleReset = (): void => {
    reset();
  };

  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center p-6">
      <Card className="w-full max-w-lg border-gray-200 shadow-md">
        <CardHeader className="items-center pb-2 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-error-red">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <CardTitle className="text-xl font-bold text-deep-ink">{ERROR_TITLE}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-stone">{ERROR_DESCRIPTION}</p>
          {error.digest ? (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-2.5 font-mono text-xs text-stone">
              <span className="font-semibold text-deep-ink">{DIGEST_LABEL} </span>
              <span>{error.digest}</span>
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-col justify-center gap-3 pt-2 sm:flex-row">
          <Button variant="default" size="md" onClick={handleReset} className="w-full sm:w-auto">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            <span>{RETRY_BUTTON_TEXT}</span>
          </Button>
          <Link href={DASHBOARD_HREF} className="w-full sm:w-auto">
            <Button variant="outline" size="md" className="w-full sm:w-auto">
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
              <span>{DASHBOARD_BUTTON_TEXT}</span>
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
