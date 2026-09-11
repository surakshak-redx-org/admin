'use client';

import { LogIn, ShieldCheck } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/lib/auth/session';

export default function LoginPage(): React.JSX.Element {
  return (
    <Suspense fallback={<Spinner />}>
      <LoginCard />
    </Suspense>
  );
}

function LoginCard(): React.JSX.Element {
  const { signInWithGoogle, isAdmin, isLoading } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const notAdmin = searchParams.get('error') === 'not_admin';

  useEffect(() => {
    if (!isLoading && isAdmin) {
      router.push('/');
    }
  }, [isLoading, isAdmin, router]);

  const handleSignIn = useCallback((): void => {
    setIsSigningIn(true);
    signInWithGoogle()
      .catch(() => {
        toast.error('Sign-in failed. Please try again.');
      })
      .finally(() => {
        setIsSigningIn(false);
      });
  }, [signInWithGoogle]);

  return (
    <Card className="w-full max-w-sm">
      <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
        <ShieldCheck className="h-12 w-12 text-shakti-purple" />
        <div>
          <h1 className="text-xl font-semibold text-deep-ink">Surakshak Admin</h1>
          <p className="mt-1 text-sm text-stone">Women&apos;s Safety App — Admin Dashboard</p>
        </div>

        {notAdmin ? (
          <div className="w-full rounded-md border border-red-200 bg-red-50 p-3 text-sm text-error-red">
            Your account is not authorized as an admin. Contact the super admin.
          </div>
        ) : null}

        <Button className="w-full" isLoading={isSigningIn} onClick={handleSignIn}>
          <LogIn className="h-4 w-4" />
          Continue with Google
        </Button>

        <p className="text-xs text-stone">Access restricted to authorized administrators only.</p>
      </CardContent>
    </Card>
  );
}
