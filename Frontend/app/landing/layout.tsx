import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'HoldisPay — Invoices, contracts & payments held in one place',
  description: 'Create invoices, lock funds in escrow, and release payment when work is done. Simple, secure, on-chain. Join the waitlist.',
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
