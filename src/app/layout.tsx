import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';

import { AuthProvider } from '@/lib/auth/session';
import { ReactQueryProvider } from '@/providers/query-provider';

import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Surakshak Admin',
  description: "Women's Safety App — Admin Dashboard",
};

export default function RootLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ReactQueryProvider>
          <AuthProvider>
            {children}
            <Toaster position="top-right" />
          </AuthProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
