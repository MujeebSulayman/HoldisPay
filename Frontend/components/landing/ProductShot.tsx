'use client';

import { useState } from 'react';

type Props = {
  /** Path under /public, e.g. /landing/dashboard.png */
  src: string;
  alt: string;
  /** Shown in the browser bar. */
  url?: string;
  className?: string;
  priority?: boolean;
};

/**
 * A real screenshot of the app in a quiet browser frame.
 * Until the image exists it shows a labelled placeholder, so a missing file is obvious in dev.
 */
export function ProductShot({ src, alt, url = 'app.holdispay.xyz', className = '', priority = false }: Props) {
  const [missing, setMissing] = useState(false);

  return (
    <figure
      className={`overflow-hidden rounded-[14px] border border-[var(--hp-line)] bg-[#0b0d14] shadow-[0_50px_100px_-40px_rgb(0_0_0/0.55),0_0_0_1px_rgb(255_255_255/0.03)] ${className}`}
    >
      <div className="flex h-9 items-center gap-3 border-b border-white/[0.06] px-4">
        <span className="flex gap-1.5" aria-hidden>
          <i className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <i className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <i className="h-2.5 w-2.5 rounded-full bg-white/15" />
        </span>
        <span className="mx-auto rounded-md bg-white/[0.05] px-3 py-0.5 font-mono text-[11px] text-white/45">{url}</span>
        <span className="w-[42px]" aria-hidden />
      </div>
      {missing ? (
        <div className="grid aspect-[16/10] place-items-center text-center font-mono text-[12px] leading-relaxed text-white/40">
          <span>
            Screenshot needed
            <br />
            <span className="text-white/60">public{src}</span>
          </span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          onError={() => setMissing(true)}
          className="block w-full"
        />
      )}
    </figure>
  );
}
