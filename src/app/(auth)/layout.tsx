import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-off-white px-4">
      {children}
    </div>
  );
}
