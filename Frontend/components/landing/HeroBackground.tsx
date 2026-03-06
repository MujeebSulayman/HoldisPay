'use client';

import { motion } from 'framer-motion';

export function HeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* Subtle dot grid - no lines, template-style */}
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(20,184,166,0.4) 1px, transparent 0)`,
          backgroundSize: '28px 28px',
        }}
      />
      {/* Soft radial gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_20%_50%,rgba(20,184,166,0.08),transparent_50%)]" />
      {/* Floating orbs - slow drift, no lines */}
      <motion.div
        className="absolute top-1/4 right-0 w-[600px] h-[600px] rounded-full bg-teal-500/10 blur-[120px]"
        animate={{
          x: [0, 40, 0],
          y: [0, -30, 0],
          scale: [1, 1.12, 1],
          opacity: [0.5, 0.85, 0.5],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-1/4 left-0 w-[400px] h-[400px] rounded-full bg-teal-400/10 blur-[100px]"
        animate={{
          x: [0, -25, 0],
          y: [0, 20, 0],
          scale: [1.05, 1, 1.05],
          opacity: [0.4, 0.75, 0.4],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 w-[300px] h-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-500/5 blur-[80px]"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.2, 0.5, 0.2],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />
      {/* Fade edges so content pops */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to bottom, transparent 0%, #0a0a0a 25%, #0a0a0a 75%, transparent 100%)',
        }}
      />
    </div>
  );
}
