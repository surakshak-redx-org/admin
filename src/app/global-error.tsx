'use client';

import { AlertOctagon, RefreshCw, RotateCcw } from 'lucide-react';
import { useEffect } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { logger } from '@/lib/logger';

import './globals.css';

const HTML_LANG = 'en';
const GLOBAL_ERROR_LOG_MESSAGE = 'Root application crash caught by global-error boundary';
const GLOBAL_ERROR_TITLE = 'Critical Application Error';
const GLOBAL_ERROR_DESCRIPTION =
  'The Surakshak admin dashboard encountered an unrecoverable system error. You can retry the operation or reload the application.';
const DIGEST_LABEL = 'Error Reference:';
const RETRY_BUTTON_TEXT = 'Try again';
const RELOAD_BUTTON_TEXT = 'Reload application';

export interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Root global error boundary handling fatal root layout crashes in Surakshak Admin Dashboard.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps): React.JSX.Element {
  useEffect((): void => {
    logger.error(GLOBAL_ERROR_LOG_MESSAGE, {
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

  const handleReload = (): void => {
    window.location.reload();
  };

  return (
    <html lang={HTML_LANG} className="h-full">
      <body className="flex min-h-full items-center justify-center bg-off-white p-4">
        <Card className="w-full max-w-lg border-gray-200 bg-white shadow-lg">
          <CardHeader className="items-center pb-2 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-error-red">
              <AlertOctagon className="h-7 w-7" aria-hidden="true" />
            </div>
            <CardTitle className="text-xl font-bold text-deep-ink">{GLOBAL_ERROR_TITLE}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-stone">{GLOBAL_ERROR_DESCRIPTION}</p>
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
            <Button variant="outline" size="md" onClick={handleReload} className="w-full sm:w-auto">
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span>{RELOAD_BUTTON_TEXT}</span>
            </Button>
          </CardFooter>
        </Card>
      </body>
    </html>
  );
}
