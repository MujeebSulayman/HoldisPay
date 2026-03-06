'use client';

import { motion } from 'framer-motion';

export function HeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* Dot grid - visible, no lines */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(20,184,166,0.6) 1.5px, transparent 0)`,
          backgroundSize: '32px 32px',
        }}
      />
      {/* Soft radial glow from left */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_15%_50%,rgba(20,184,166,0.18),transparent_55%)]" />
      {/* Floating orbs */}
      <motion.div
        className="absolute -top-20 -right-32 w-[500px] h-[500px] rounded-full bg-teal-500/25 blur-[100px]"
        animate={{
          x: [0, 50, 0],
          y: [0, -40, 0],
          scale: [1, 1.15, 1],
          opacity: [0.6, 1, 0.6],
        }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-20 -left-24 w-[380px] h-[380px] rounded-full bg-teal-400/20 blur-[90px]"
        animate={{
          x: [0, -30, 0],
          y: [0, 25, 0],
          scale: [1.05, 1, 1.05],
          opacity: [0.5, 0.9, 0.5],
        }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 w-[320px] h-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-500/15 blur-[70px]"
        animate={{
          scale: [1, 1.25, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />
      {/* Light vignette on edges only - no solid center cover */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(to bottom, rgba(10,10,10,0.4) 0%, transparent 18%, transparent 82%, rgba(10,10,10,0.4) 100%),
            linear-gradient(to right, rgba(10,10,10,0.25) 0%, transparent 20%, transparent 80%, rgba(10,10,10,0.25) 100%)
          `,
        }}
      />
    </div>
  );
}
