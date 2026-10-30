import type { ReactNode } from 'react';
import Link from 'next/link';
import { PaymentFlow } from '@/components/landing/PaymentFlow';

type Props = {
  mode: 'signin' | 'signup';
  title: string;
  subtitle: string;
  children: ReactNode;
};

const LANDING_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://holdispay.xyz';

/**
 * Sign-in / sign-up shell in the same design language as the landing page:
 * form on the left, the payment-flow explainer on a glass panel on the right.
 */
export function AuthLayout({ mode, title, subtitle, children }: Props) {
  const tab = (href: string, label: string, active: boolean) =>
    active ? (
      <span aria-current="page" className="rounded-full bg-[var(--hp-knob)] px-4 py-2 text-[var(--hp-fg)] shadow-[var(--hp-edge-sm)]">
        {label}
      </span>
    ) : (
      <Link href={href} className="rounded-full px-4 py-2 transition-colors hover:text-[var(--hp-fg)]">
        {label}
      </Link>
    );

  return (
    <div className="hp-landing flex min-h-screen font-sans">
      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-16">
        <div className="hp-rise w-full max-w-md">
          <a href={LANDING_URL} aria-label="HoldisPay home" className="inline-flex items-center gap-2.5">
            <img src="/logo.png" alt="" className="h-9 w-9 rounded-xl" />
            <span className="font-heading text-[17px] font-semibold tracking-tight">HoldisPay</span>
          </a>

          <nav className="hp-seg mt-12 !text-[14px] font-medium text-[var(--hp-mute)]" aria-label="Account">
            {tab('/signin', 'Sign in', mode === 'signin')}
            {tab('/signup', 'Create account', mode === 'signup')}
          </nav>

          <h1 className="hp-display mt-8 text-[clamp(32px,4vw,42px)]">{title}</h1>
          <p className="mt-3 text-[16px] leading-relaxed text-[var(--hp-dim)]">{subtitle}</p>

          <div className="mt-10">{children}</div>
        </div>
      </div>

      <aside className="sticky top-0 hidden h-screen flex-1 items-center justify-center border-l border-[var(--hp-line)] px-12 lg:flex">
        <div className="hp-rise flex w-full max-w-[460px] flex-col items-center" style={{ animationDelay: '120ms' }}>
          <p className="hp-display text-center text-[clamp(28px,2.6vw,36px)]">
            Pay and get paid
            <br />
            with <span className="hp-text-gradient">confidence.</span>
          </p>
          <div className="mt-10 w-full">
            <PaymentFlow />
          </div>
        </div>
      </aside>
    </div>
  );
}
