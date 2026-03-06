'use client';

import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      theme="dark"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: 'bg-[#0d0d0d] border border-gray-800 text-white',
          title: 'text-white',
          description: 'text-gray-400',
          success: 'border-teal-500/50',
          error: 'border-red-500/50',
          warning: 'border-amber-500/50',
          info: 'border-sky-500/50',
        },
      }}
    />
  );
}
