'use client';

import { LogIn, ShieldCheck } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/lib/auth/session';

const APP_NAME = 'Surakshak Admin';
const NOT_ADMIN_ERROR = 'not_admin';
const HOME_PATH = '/';
const SIGN_IN_ERROR_MESSAGE = 'Sign-in failed. Please try again.';
const NOT_ADMIN_MESSAGE = 'Your account is not authorized as an admin. Contact the super admin.';
const RESTRICTED_NOTE = 'Access restricted to authorized administrators only.';

export default function LoginPage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      }
    >
      <LoginCard />
    </Suspense>
  );
}

function LoginCard(): React.JSX.Element {
  const { signInWithGoogle, isAdmin, isLoading } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const notAdmin = searchParams.get('error') === NOT_ADMIN_ERROR;

  useEffect((): void => {
    if (!isLoading && isAdmin) {
      router.push(HOME_PATH);
    }
  }, [isLoading, isAdmin, router]);

  const handleSignIn = useCallback((): void => {
    setIsSigningIn(true);
    signInWithGoogle()
      .catch((): void => {
        toast.error(SIGN_IN_ERROR_MESSAGE);
      })
      .finally((): void => {
        setIsSigningIn(false);
      });
  }, [signInWithGoogle]);

  return (
    <Card className="w-full max-w-sm">
      <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
        <ShieldCheck className="h-12 w-12 text-shakti-purple" aria-hidden="true" />
        <div>
          <h1 className="text-xl font-semibold text-deep-ink">{APP_NAME}</h1>
          <p className="mt-1 text-sm text-stone">Women&apos;s Safety App &mdash; Admin Dashboard</p>
        </div>

        {notAdmin ? (
          <div
            role="alert"
            className="w-full rounded-md border border-red-200 bg-red-50 p-3 text-sm text-error-red"
          >
            {NOT_ADMIN_MESSAGE}
          </div>
        ) : null}

        <Button className="w-full" isLoading={isSigningIn} onClick={handleSignIn}>
          <LogIn className="h-4 w-4" aria-hidden="true" />
          Continue with Google
        </Button>

        <p className="text-xs text-stone">{RESTRICTED_NOTE}</p>
      </CardContent>
    </Card>
  );
}
