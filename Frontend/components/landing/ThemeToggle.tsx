'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';

export const THEME_KEY = 'hp-theme';

// Pages that support light and dark. Everything else (admin, email flows) stays dark for now.
const THEMED_PATHS = ['/', '/signin', '/signup'];
const THEMED_PREFIXES = ['/dashboard'];

/**
 * Runs before paint so a themed page opens in the right theme without a flash.
 * Light is the default; the user's own choice (saved by the toggle) wins.
 */
export const themeInitScript = `try{var p=location.pathname.replace(/\\/$/,'')||'/';if(${JSON.stringify(THEMED_PATHS)}.indexOf(p)>-1||${JSON.stringify(THEMED_PREFIXES)}.some(function(x){return p.indexOf(x)===0})){var t=localStorage.getItem('${THEME_KEY}');if(t!=='light'&&t!=='dark')t='light';document.documentElement.dataset.theme=t}}catch(e){}`;

function savedTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === 'light' || t === 'dark') return t;
  } catch {}
  return 'light';
}

const current = (): Theme => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

/**
 * Mount on every themed page. Applies the saved theme when the page opens (including
 * client-side navigation, where the init script doesn't run) and returns to dark on the
 * way out, for pages that are still dark-only.
 */
export function ThemeScope() {
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.theme = savedTheme();
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_KEY && (e.newValue === 'light' || e.newValue === 'dark')) html.dataset.theme = e.newValue;
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      html.dataset.theme = 'dark';
    };
  }, []);
  return null;
}

export function ThemeToggle({ className = '', showLabel = false }: { className?: string; showLabel?: boolean }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    // Read the theme ThemeScope applied, and follow changes made elsewhere (another toggle or tab).
    const sync = () => setTheme(current());
    const id = requestAnimationFrame(sync);
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      cancelAnimationFrame(id);
      observer.disconnect();
    };
  }, []);

  const toggle = () => {
    const next: Theme = current() === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
    setTheme(next);
  };

  const light = theme === 'light';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={light ? 'Switch to dark mode' : 'Switch to light mode'}
      title={light ? 'Dark mode' : 'Light mode'}
      className={className || 'grid h-10 w-10 place-items-center rounded-full text-[var(--hp-mute)] transition-colors hover:text-[var(--hp-fg)]'}
    >
      {light ? <Moon className="h-[18px] w-[18px] shrink-0" /> : <Sun className="h-[18px] w-[18px] shrink-0" />}
      {showLabel && <span className="text-sm font-medium">{light ? 'Dark mode' : 'Light mode'}</span>}
    </button>
  );
}
