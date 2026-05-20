import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'HoldisPay — Invoices, contracts & payments held in one place',
  description: 'Create invoices, lock funds in escrow, and release payment when work is done. Simple, secure, and non-custodial on-chain payments.',
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
