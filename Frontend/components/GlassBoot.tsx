'use client';

import { useEffect, useRef } from 'react';
import { startGlass } from '@/lib/glass';

/** The liquid-glass backdrop. Mount once, in the root layout. */
export function GlassBoot() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => (canvas.current ? startGlass(canvas.current) : undefined), []);
  return (
    <>
      <canvas id="lg" ref={canvas} aria-hidden />
      <div className="bg-fallback" aria-hidden />
    </>
  );
}
