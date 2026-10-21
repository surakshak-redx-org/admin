'use client';

import { useQueryClient } from '@tanstack/react-query';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { getClientAuth } from '@/lib/firebase/client';
import type { Serialized } from '@/types/api.types';
import type { AdminUser } from '@/types/firestore.types';

type ClientAdminUser = Serialized<AdminUser>;

interface AuthSession {
  user: ClientAdminUser | null;
  idToken: string | null;
  isLoading: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutAdmin: () => Promise<void>;
}

interface AuthProviderProps {
  children: ReactNode;
}

interface MeResponse {
  data: ClientAdminUser;
}

const AuthContext = createContext<AuthSession | null>(null);

export function AuthProvider({ children }: AuthProviderProps): React.JSX.Element {
  const [user, setUser] = useState<ClientAdminUser | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    const auth = getClientAuth();
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      if (!firebaseUser) {
        // Also covers sign-out from another tab or an expired session, which
        // never goes through signOutAdmin — cached admin data must not outlive it.
        queryClient.clear();
        setUser(null);
        setIdToken(null);
        setIsLoading(false);
        return;
      }

      const fetchAdminProfile = async (): Promise<void> => {
        try {
          const token = await firebaseUser.getIdToken();
          setIdToken(token);

          const response = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (response.ok) {
            const body = (await response.json()) as MeResponse;
            setUser(body.data);
          } else {
            await signOut(auth);
            queryClient.clear();
            setUser(null);
            setIdToken(null);
            router.replace('/login?error=not_admin');
          }
        } catch {
          setUser(null);
          setIdToken(null);
        } finally {
          setIsLoading(false);
        }
      };

      void fetchAdminProfile();
    });
    return unsubscribe;
  }, [router, queryClient]);

  // A page restored from the browser's back/forward cache is a frozen snapshot of
  // the old session, including any admin data on screen. Reload it so the auth
  // state is re-checked and signed-out visitors land on /login.
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent): void => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener('pageshow', handlePageShow);
    return (): void => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<void> => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(getClientAuth(), provider);
  }, []);

  const signOutAdmin = useCallback(async (): Promise<void> => {
    try {
      await signOut(getClientAuth());
    } finally {
      // Runs even if sign-out rejects, so no admin data is left on screen or cached.
      queryClient.clear();
      setUser(null);
      setIdToken(null);
      // `replace`, not `push`: Back must not return to a protected page.
      router.replace('/login');
    }
  }, [router, queryClient]);

  return (
    <AuthContext.Provider
      value={{
        user,
        idToken,
        isLoading,
        isAdmin: user !== null,
        signInWithGoogle,
        signOutAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthSession {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
