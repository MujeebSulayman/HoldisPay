'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';

export const THEME_KEY = 'hp-theme';

/**
 * Runs before paint on the landing page so the saved (or system) theme is applied without a flash.
 * The app itself stays dark until it moves onto the theme tokens.
 */
export const themeInitScript = `try{if(location.pathname==='/'){var t=localStorage.getItem('${THEME_KEY}');if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';document.documentElement.dataset.theme=t}}catch(e){}`;

const current = (): Theme => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const html = document.documentElement;
    // Read the theme the init script applied, and keep it in sync if another tab changes it.
    const sync = () => setTheme(current());
    const id = requestAnimationFrame(sync);
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_KEY && (e.newValue === 'light' || e.newValue === 'dark')) {
        html.dataset.theme = e.newValue;
        sync();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('storage', onStorage);
      // Leaving the landing page: the app is dark-only for now.
      html.dataset.theme = 'dark';
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
      className="grid h-10 w-10 place-items-center rounded-full text-[var(--hp-mute)] transition-colors hover:text-[var(--hp-fg)]"
    >
      {light ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
    </button>
  );
}
