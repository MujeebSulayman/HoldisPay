'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

const LINKS = [
  { href: '#product', label: 'Product' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#faq', label: 'FAQ' },
];

/** Slim top bar; picks up a hairline and blur once the page scrolls. */
export function LandingNav({ signInUrl, signUpUrl }: { signInUrl: string; signUpUrl: string }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color] duration-300 ${
        scrolled || open
          ? 'border-b border-[var(--hp-line)] bg-[color-mix(in_srgb,var(--background)_78%,transparent)] backdrop-blur-xl'
          : 'border-b border-transparent'
      }`}
    >
      <div className="hp-shell flex h-16 items-center gap-8">
        <Link href="/" aria-label="HoldisPay home" className="flex shrink-0 items-center gap-2.5">
          <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg" />
          <span className="font-heading text-[16px] font-semibold tracking-tight">HoldisPay</span>
        </Link>

        <nav className="hidden items-center gap-7 text-[14px] text-[var(--hp-dim)] md:flex" aria-label="Main">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-[var(--hp-fg)]">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <a href={signInUrl} className="hidden px-3 text-[14px] text-[var(--hp-dim)] transition-colors hover:text-[var(--hp-fg)] sm:inline">
            Sign in
          </a>
          <a href={signUpUrl} className="hp-btn hp-btn-sm hp-btn-white">
            Get started
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="grid h-10 w-10 place-items-center text-[var(--hp-dim)] md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="hp-shell flex flex-col pb-4 text-[15px] md:hidden" aria-label="Mobile">
          {[...LINKS, { href: signInUrl, label: 'Sign in' }].map((l) => (
            <a key={l.label} href={l.href} onClick={() => setOpen(false)} className="border-t border-[var(--hp-line)] py-3 text-[var(--hp-dim)]">
              {l.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
