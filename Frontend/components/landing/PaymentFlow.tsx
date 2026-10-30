'use client';

import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';

type Mode = 'milestones' | 'recurring' | 'split';

const MODES: { id: Mode; label: string }[] = [
  { id: 'milestones', label: 'Milestones' },
  { id: 'recurring', label: 'Recurring' },
  { id: 'split', label: 'Team split' },
];

// What leaves the escrow, per mode. Widths are the share of the locked amount.
const PAYOUTS: Record<Mode, { note: string; rows: { label: string; value: string; width: number; done?: boolean }[] }> = {
  milestones: {
    note: 'Each approved milestone releases its share.',
    rows: [
      { label: 'Design', value: 'Released', width: 100, done: true },
      { label: 'Build', value: 'Released', width: 100, done: true },
      { label: 'Launch', value: 'Held', width: 4 },
    ],
  },
  recurring: {
    note: 'Released on schedule, every month.',
    rows: [
      { label: 'Sep', value: 'Paid', width: 100, done: true },
      { label: 'Oct', value: 'Paid', width: 100, done: true },
      { label: 'Nov', value: 'Scheduled', width: 4 },
    ],
  },
  split: {
    note: 'One payment, divided automatically.',
    rows: [
      { label: 'Lead', value: '50%', width: 50, done: true },
      { label: 'Design', value: '30%', width: 30, done: true },
      { label: 'QA', value: '20%', width: 20, done: true },
    ],
  },
};

/**
 * How a payment moves through HoldisPay: client → escrow → you, and what the contract
 * releases in each mode. Cycles on its own until a mode is picked.
 */
export function PaymentFlow() {
  const [tick, setTick] = useState(0);
  const [picked, setPicked] = useState<Mode | null>(null);

  useEffect(() => {
    if (picked) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 6000);
    return () => window.clearInterval(t);
  }, [picked]);

  const mode = picked ?? MODES[tick % MODES.length].id;
  const { note, rows } = PAYOUTS[mode];

  return (
    <div className="flex w-full max-w-[460px] flex-col items-center">
      <div className="glass-strong w-full rounded-[32px] p-6 text-left">
        <div className="flex items-center justify-between">
          <span className="hp-label">How a payment moves</span>
          <span className="hp-pill hp-pill-accent !h-7 font-mono !text-[11.5px]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--hp-accent)]" />
            on-chain
          </span>
        </div>

        {/* Client → Escrow → You, with funds travelling along the line */}
        <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="hp-inset rounded-[18px] px-3 py-4 text-center">
            <p className="hp-label !text-[10px]">Client</p>
            <p className="mt-1.5 text-[13px] font-medium">Funds up front</p>
          </div>
          <span className="hp-knob h-12 w-12 rounded-[16px]" aria-hidden>
            <Lock className="h-5 w-5" />
          </span>
          <div className="hp-inset rounded-[18px] px-3 py-4 text-center">
            <p className="hp-label !text-[10px]">You</p>
            <p className="mt-1.5 text-[13px] font-medium">Paid on release</p>
          </div>
        </div>
        <div className="relative mx-6 mt-4 h-px bg-[var(--hp-line2)]" aria-hidden>
          <span className="hp-flow-dot absolute -top-[3px] h-[7px] w-[7px] rounded-full bg-[var(--hp-accent)] shadow-[0_0_10px_var(--hp-accent)]" />
        </div>
        <p className="mt-3 text-center font-mono text-[11px] text-[var(--hp-mute)]">escrow contract · nobody can move it alone</p>

        {/* What the contract releases in this mode */}
        <div className="hp-inset mt-6 rounded-[22px] p-4">
          <p className="text-[13.5px] text-[var(--hp-dim)]">{note}</p>
          <div className="mt-4 grid gap-3">
            {rows.map((row) => (
              <div key={row.label} className="grid grid-cols-[3.5rem_1fr_4.5rem] items-center gap-3 font-mono text-[12px]">
                <span className={row.done ? 'text-[var(--hp-accent)]' : 'text-[var(--hp-mute)]'}>{row.label}</span>
                <span className={`hp-meter ${row.done ? 'is-accent' : ''}`}>
                  <i style={{ width: `${row.width}%` }} />
                </span>
                <span className="text-right">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="hp-label mt-7 mb-3">See it as</p>
      <div className="hp-seg" role="group" aria-label="Payment type">
        {MODES.map((m) => (
          <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => setPicked(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
