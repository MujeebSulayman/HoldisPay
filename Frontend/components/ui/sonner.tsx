'use client';

import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      theme="dark"
      position="top-center"
      toastOptions={{
        classNames: {
          toast: 'group toast border shadow-2xl rounded-xl font-sans py-4 px-6 flex flex-row items-center justify-center text-center gap-3 whitespace-nowrap !w-auto min-w-[150px] mx-auto',
          title: 'text-sm font-bold group-[.success]:text-black group-[.error]:text-white',
          description: 'text-xs group-[.success]:text-neutral-600 group-[.error]:text-red-50',
          success: 'bg-white text-black border-white !bg-white !text-black',
          error: 'bg-red-600 text-white border-red-600 !bg-red-600 !text-white',
          warning: 'bg-amber-500 text-white border-amber-500',
          info: 'bg-blue-600 text-white border-blue-600',
          default: 'bg-[#0d0d0d] text-white border-gray-800',
        },
      }}
      duration={4000}
    />
  );
}
