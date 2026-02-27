'use client';

import { motion } from 'framer-motion';

const COLS = 9;
const ROWS = 6;
const GAP_X = 12;
const GAP_Y = 14;
const ORIGIN_X = 10;
const ORIGIN_Y = 15;

function getNode(col: number, row: number) {
  return { x: ORIGIN_X + col * GAP_X, y: ORIGIN_Y + row * GAP_Y };
}

const LINES: { from: [number, number]; to: [number, number] }[] = [];
for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS - 1; col++) {
    LINES.push({ from: [col, row], to: [col + 1, row] });
  }
}
for (let col = 0; col < COLS; col++) {
  for (let row = 0; row < ROWS - 1; row++) {
    LINES.push({ from: [col, row], to: [col, row + 1] });
  }
}
// Diagonals for structure
for (let row = 0; row < ROWS - 1; row++) {
  for (let col = 0; col < COLS - 1; col++) {
    if ((col + row) % 2 === 0) LINES.push({ from: [col, row], to: [col + 1, row + 1] });
  }
}

export function HeroWireGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 120 100" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="heroLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(20,184,166,0)" />
            <stop offset="50%" stopColor="rgba(20,184,166,0.7)" />
            <stop offset="100%" stopColor="rgba(20,184,166,0)" />
          </linearGradient>
          <filter id="heroGlow">
            <feGaussianBlur stdDeviation="0.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Static grid lines */}
        {LINES.map((line, idx) => {
          const a = getNode(line.from[0], line.from[1]);
          const b = getNode(line.to[0], line.to[1]);
          const d = `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
          return (
            <motion.path
              key={`s-${idx}`}
              d={d}
              fill="none"
              stroke="rgba(20,184,166,0.2)"
              strokeWidth="0.4"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, delay: idx * 0.012 }}
              style={{ filter: 'url(#heroGlow)' }}
            />
          );
        })}
        {/* Moving flow along lines */}
        {LINES.map((line, idx) => {
          const a = getNode(line.from[0], line.from[1]);
          const b = getNode(line.to[0], line.to[1]);
          const d = `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
          return (
            <motion.path
              key={`f-${idx}`}
              d={d}
              fill="none"
              stroke="rgba(20,184,166,0.6)"
              strokeWidth="0.3"
              strokeDasharray="1 2.5"
              initial={{ strokeDashoffset: 0 }}
              animate={{ strokeDashoffset: 3.5 }}
              transition={{
                duration: 1.8 + (idx % 6) * 0.2,
                repeat: Infinity,
                ease: 'linear',
              }}
              style={{ filter: 'url(#heroGlow)' }}
            />
          );
        })}
        {/* Nodes with pulse */}
        {Array.from({ length: ROWS }, (_, row) =>
          Array.from({ length: COLS }, (_, col) => ({ col, row }))
        ).flat().map(({ col, row }, i) => {
          const n = getNode(col, row);
          return (
            <motion.circle
              key={`n-${i}`}
              cx={n.x}
              cy={n.y}
              r="0.55"
              fill="rgba(20,184,166,0.3)"
              stroke="rgba(20,184,166,0.6)"
              strokeWidth="0.2"
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: [0.3, 0.8, 0.3],
                scale: 1,
              }}
              transition={{
                opacity: { duration: 2.5, repeat: Infinity, delay: 0.5 + i * 0.04 },
                scale: { duration: 0.35, delay: 0.15 + i * 0.015 },
              }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,#0a0a0a_20%,#0a0a0a_80%,transparent_100%)]" />
    </div>
  );
}
