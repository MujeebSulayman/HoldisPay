import type { ReactNode } from 'react';
import Link from 'next/link';
import { ResetThemeOnLeave } from '@/components/landing/ThemeToggle';

type Props = {
  mode: 'signin' | 'signup';
  title: string;
  subtitle: string;
  children: ReactNode;
};

const LANDING_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://holdispay.xyz';

/** Sign-in / sign-up: one quiet, centered column. The form is the only thing on the page. */
export function AuthLayout({ mode, title, subtitle, children }: Props) {
  const tab = (href: string, label: string, active: boolean) =>
    active ? (
      <span aria-current="page" className="flex-1 rounded-full bg-[var(--hp-knob)] py-2 text-center text-[var(--hp-fg)] shadow-[var(--hp-edge-sm)]">
        {label}
      </span>
    ) : (
      <Link href={href} className="flex-1 rounded-full py-2 text-center transition-colors hover:text-[var(--hp-fg)]">
        {label}
      </Link>
    );

  return (
    <div className="hp-landing flex min-h-screen flex-col font-sans">
      <ResetThemeOnLeave />

      <header className="hp-shell flex h-20 items-center">
        <a href={LANDING_URL} aria-label="HoldisPay home" className="inline-flex items-center gap-2.5">
          <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg" />
          <span className="font-heading text-[16px] font-semibold tracking-tight">HoldisPay</span>
        </a>
      </header>

      <main className="flex flex-1 justify-center px-4 pb-20 pt-8 sm:pt-16">
        <div className="hp-rise w-full max-w-[420px]">
          <h1 className="hp-display text-center text-[clamp(30px,4vw,38px)]">{title}</h1>
          <p className="mt-3 text-center text-[15.5px] leading-relaxed text-[var(--hp-dim)]">{subtitle}</p>

          <nav className="hp-seg mt-9 flex w-full text-[14px] font-medium text-[var(--hp-mute)]" aria-label="Account">
            {tab('/signin', 'Sign in', mode === 'signin')}
            {tab('/signup', 'Create account', mode === 'signup')}
          </nav>

          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
