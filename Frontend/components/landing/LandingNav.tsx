'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { CircleHelp, House, LayoutGrid, Menu, Route, X, type LucideIcon } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

const LINKS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'hero', label: 'Home', icon: House },
  { id: 'how-it-works', label: 'How it works', icon: Route },
  { id: 'features', label: 'Features', icon: LayoutGrid },
  { id: 'faq', label: 'FAQ', icon: CircleHelp },
];

/** The section currently under the top of the viewport. */
function useActiveSection() {
  const [active, setActive] = useState('hero');
  useEffect(() => {
    const onScroll = () => {
      let current = 'hero';
      for (const { id } of LINKS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 160) current = id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return active;
}

/** Floating liquid-glass nav. The glass "drop" slides to the active or hovered link. */
export function LandingNav({ signInUrl, signUpUrl }: { signInUrl: string; signUpUrl: string }) {
  const active = useActiveSection();
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLElement>(null);
  const drop = useRef<HTMLSpanElement>(null);

  const moveTo = (a: HTMLElement | null | undefined) => {
    const d = drop.current;
    if (!d) return;
    if (!a) {
      d.style.opacity = '0';
      return;
    }
    d.style.opacity = '1';
    d.style.width = `${a.offsetWidth}px`;
    d.style.transform = `translateX(${a.offsetLeft}px)`;
  };
  const current = () => host.current?.querySelector<HTMLElement>('a[aria-current="true"]');

  useLayoutEffect(() => {
    moveTo(current());
  }, [active]);

  useEffect(() => {
    const ro = new ResizeObserver(() => moveTo(current()));
    if (host.current) ro.observe(host.current);
    return () => ro.disconnect();
  }, []);

  return (
    <>
      <header className="hp-topnav hp-lgx">
        <Link href="/" aria-label="HoldisPay home" className="flex shrink-0 items-center gap-2.5 transition-transform duration-700 [transition-timing-function:var(--ease-spring)] hover:scale-105">
          <img src="/logo.png" alt="HoldisPay" className="h-9 w-9 rounded-xl" />
          <span className="hidden font-heading text-[17px] font-semibold tracking-tight sm:inline">HoldisPay</span>
        </Link>

        <nav className="hp-nav-links" aria-label="Main" ref={host} onPointerLeave={() => moveTo(current())}>
          <span className="hp-drop" ref={drop} aria-hidden />
          {LINKS.map(({ id, label, icon: Icon }) => (
            <a
              key={id}
              href={`#${id}`}
              aria-current={active === id ? 'true' : undefined}
              onPointerEnter={(e) => e.pointerType === 'mouse' && moveTo(e.currentTarget)}
            >
              <Icon className="h-[17px] w-[17px]" strokeWidth={active === id ? 2.1 : 1.8} />
              {label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 lg:ml-0">
          <ThemeToggle />
          <a href={signInUrl} className="hp-btn hp-btn-sm hp-btn-ghost hidden sm:inline-flex">
            Sign in
          </a>
          <a href={signUpUrl} className="hp-btn hp-btn-sm hp-btn-accent">
            Get started
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="grid h-10 w-10 place-items-center rounded-full text-[var(--hp-dim)] hover:text-[var(--hp-fg)] lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="hp-lgx fixed left-4 right-4 top-[88px] z-50 flex flex-col gap-1 rounded-[28px] p-2 lg:hidden"
            aria-label="Mobile"
          >
            {LINKS.map(({ id, label, icon: Icon }) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-[20px] px-4 py-3 text-sm font-medium ${active === id ? 'bg-[var(--hp-knob)] text-[var(--hp-fg)] shadow-[var(--hp-edge-sm)]' : 'text-[var(--hp-dim)]'}`}
              >
                <Icon className="h-[18px] w-[18px]" />
                {label}
              </a>
            ))}
            <a href={signInUrl} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-[20px] px-4 py-3 text-sm font-medium text-[var(--hp-dim)] sm:hidden">
              Sign in
            </a>
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  );
}
