'use client';

import { motion } from 'framer-motion';

const NODES = [
  { x: 10, y: 15 },
  { x: 25, y: 8 },
  { x: 45, y: 12 },
  { x: 65, y: 20 },
  { x: 85, y: 10 },
  { x: 15, y: 45 },
  { x: 40, y: 55 },
  { x: 70, y: 50 },
  { x: 90, y: 60 },
  { x: 30, y: 75 },
  { x: 55, y: 85 },
  { x: 80, y: 80 },
  { x: 5, y: 60 },
  { x: 50, y: 35 },
  { x: 75, y: 70 },
];

const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [1, 14], [2, 14], [2, 6], [3, 7], [4, 8],
  [5, 6], [6, 14], [6, 9], [7, 8], [7, 11], [8, 11], [9, 10], [10, 11], [0, 12], [12, 5],
  [14, 7], [14, 10], [5, 9], [3, 11],
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function WireNetworkBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="wireGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(20,184,166,0)" />
            <stop offset="50%" stopColor="rgba(20,184,166,0.25)" />
            <stop offset="100%" stopColor="rgba(20,184,166,0)" />
          </linearGradient>
          <linearGradient id="wireGradVert" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(20,184,166,0)" />
            <stop offset="50%" stopColor="rgba(20,184,166,0.2)" />
            <stop offset="100%" stopColor="rgba(20,184,166,0)" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="0.3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {CONNECTIONS.map(([i, j], idx) => {
          const a = NODES[i];
          const b = NODES[j];
          const midX = lerp(a.x, b.x, 0.5);
          const midY = lerp(a.y, b.y, 0.5);
          const pathD = `M ${a.x} ${a.y} Q ${midX + (idx % 2 === 0 ? 3 : -3)} ${midY + 2} ${b.x} ${b.y}`;
          return (
            <motion.path
              key={`${i}-${j}`}
              d={pathD}
              fill="none"
              stroke="url(#wireGrad)"
              strokeWidth="0.15"
              strokeOpacity="0.4"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{
                pathLength: 1,
                opacity: 0.5,
              }}
              transition={{
                pathLength: { duration: 1.5, delay: idx * 0.05 },
                opacity: { duration: 0.8, delay: idx * 0.05 },
              }}
              style={{ filter: 'url(#glow)' }}
            />
          );
        })}
        {CONNECTIONS.map(([i, j], idx) => (
          <motion.path
            key={`run-${i}-${j}`}
            d={(() => {
              const a = NODES[i];
              const b = NODES[j];
              const midX = lerp(a.x, b.x, 0.5);
              const midY = lerp(a.y, b.y, 0.5);
              return `M ${a.x} ${a.y} Q ${midX + (idx % 2 === 0 ? 3 : -3)} ${midY + 2} ${b.x} ${b.y}`;
            })()}
            fill="none"
            stroke="rgba(20,184,166,0.6)"
            strokeWidth="0.08"
            strokeDasharray="0.8 1.2"
            initial={{ strokeDashoffset: 0 }}
            animate={{ strokeDashoffset: 2 }}
            transition={{
              duration: 3 + (idx % 3) * 0.5,
              repeat: Infinity,
              ease: 'linear',
            }}
            style={{ filter: 'url(#glow)' }}
          />
        ))}
        {NODES.map((node, i) => (
          <motion.circle
            key={i}
            cx={node.x}
            cy={node.y}
            r="0.4"
            fill="rgba(20,184,166,0.15)"
            stroke="rgba(20,184,166,0.4)"
            strokeWidth="0.12"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 + i * 0.03, duration: 0.4 }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,#0a0a0a_30%,#0a0a0a_70%,transparent_100%)]" />
    </div>
  );
}
