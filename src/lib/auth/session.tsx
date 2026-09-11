'use client';

import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { clientAuth } from '@/lib/firebase/client';
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

  useEffect(() => {
    const unsubscribe = clientAuth.onAuthStateChanged((firebaseUser) => {
      const load = async (): Promise<void> => {
        if (firebaseUser) {
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
              await signOut(clientAuth);
              setUser(null);
              setIdToken(null);
              router.push('/login?error=not_admin');
            }
          } catch {
            setUser(null);
            setIdToken(null);
          }
        } else {
          setUser(null);
          setIdToken(null);
        }
        setIsLoading(false);
      };

      void load();
    });
    return unsubscribe;
  }, [router]);

  const signInWithGoogle = useCallback(async (): Promise<void> => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(clientAuth, provider);
  }, []);

  const signOutAdmin = useCallback(async (): Promise<void> => {
    await signOut(clientAuth);
    setUser(null);
    setIdToken(null);
    router.push('/login');
  }, [router]);

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
