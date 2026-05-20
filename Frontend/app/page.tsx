'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { HeroBackground } from '@/components/landing/HeroBackground';
import { blockchainApi, type PublicChain, type PublicAsset } from '@/lib/api/blockchain';

const FAQ_ITEMS = [
  {
    q: 'What is HoldisPay?',
    a: 'HoldisPay is a non-custodial platform for invoices, payment contracts, and escrow. Funds are held in smart contracts on-chain; we never custody your assets. Create invoices, agree on terms, lock funds in smart contract escrow, and release payment when work is done.',
  },
  {
    q: 'How does escrow work?',
    a: 'You fund a smart contract. Funds are held on-chain in escrow until you approve delivery or hit a milestone. Then you trigger release. No release, no payout. Non-custodial: you stay in control.',
  },
  {
    q: 'Can I get paid in crypto?',
    a: 'Yes. HoldisPay uses smart contracts on multiple networks. Get paid in USD (stablecoins) and other supported tokens. All non-custodial: funds stay in the contract until release conditions are met.',
  },
  {
    q: 'What networks and tokens are supported?',
    a: 'HoldisPay currently supports major EVM chains including Ethereum Mainnet, Arbitrum, Optimism, Base, and Polygon. You can receive payments in popular stablecoins like USDC and USDT, as well as native tokens like ETH.',
  },
];

function PaymentSimulator() {
  const [step, setStep] = useState<'locked' | 'releasing' | 'released'>('locked');

  const handleRelease = () => {
    if (step !== 'locked') return;
    setStep('releasing');
    setTimeout(() => {
      setStep('released');
    }, 1800);
  };

  const handleReset = () => {
    setStep('locked');
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900/90 p-5 sm:p-6 lg:p-8 shadow-2xl backdrop-blur-md shrink-0 select-none relative overflow-hidden text-left">
      {/* Decorative gradient glowing bar on top */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-600" />

      {/* Title */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <span className="text-[10px] font-bold tracking-wider text-teal-400 uppercase bg-teal-500/10 px-2.5 py-0.5 rounded-full border border-teal-500/20">
            Smart Escrow Contract
          </span>
          <h3 className="text-sm font-semibold text-zinc-300 mt-2">Contract #HP-2026-089</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${step === 'releasing' ? 'bg-amber-400 animate-pulse' : step === 'released' ? 'bg-emerald-400' : 'bg-teal-400 animate-pulse'}`} />
          <span className="text-xs font-semibold text-zinc-400">
            {step === 'releasing' ? 'Processing' : step === 'released' ? 'Released' : 'Escrowed'}
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-4 rounded-xl bg-black/40 border border-white/5 p-4 mb-6">
        <div className="flex justify-between items-center pb-3 border-b border-white/5">
          <span className="text-xs text-zinc-500">Service Provider</span>
          <span className="text-xs font-medium text-white flex items-center gap-1">
            <span className="w-4 h-4 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center text-[8px] font-bold">M</span>
            Mujeeb (Developer)
          </span>
        </div>

        <div className="flex justify-between items-center pb-3 border-b border-white/5">
          <span className="text-xs text-zinc-500">Client</span>
          <span className="text-xs font-medium text-white">Acme Corporation</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-xs text-zinc-500">Amount Locked</span>
          <span className="text-sm font-bold text-white flex items-center gap-1.5">
            5,000.00 USDC
            <span className="text-[9px] text-zinc-400 font-normal bg-white/5 px-1.5 py-0.5 rounded border border-white/5">USDC</span>
          </span>
        </div>
      </div>

      {/* Milestones */}
      <div className="space-y-3 mb-6">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Contract Milestones</h4>
        
        {/* Milestone 1 */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </div>
            <div>
              <p className="text-xs font-medium text-white">Milestone 1: UI Implementation</p>
              <p className="text-[9px] text-zinc-500">Released 5 days ago</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-zinc-400">2,500 USDC</span>
        </div>

        {/* Milestone 2 */}
        <div className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-300 ${step === 'released' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-white/5 border-white/5'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300 ${step === 'released' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-teal-500/10 border border-teal-500/20 text-teal-400 animate-pulse'}`}>
              {step === 'released' ? (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-white">Milestone 2: Backend Integration</p>
              <p className="text-[9px] text-zinc-500">
                {step === 'released' ? 'Released just now' : 'Escrowed & Protected'}
              </p>
            </div>
          </div>
          <span className={`text-xs font-semibold ${step === 'released' ? 'text-emerald-400' : 'text-teal-400'}`}>2,500 USDC</span>
        </div>
      </div>

      {/* Action button */}
      <AnimatePresence mode="wait">
        {step === 'locked' && (
          <motion.button
            key="lock-btn"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onClick={handleRelease}
            className="w-full py-3.5 px-4 rounded-xl bg-teal-500 text-black font-semibold hover:bg-teal-400 hover:shadow-lg hover:shadow-teal-500/20 transition-all flex items-center justify-center gap-2 group cursor-pointer"
          >
            <svg className="w-4 h-4 text-black group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
            Approve & Release Milestone 2
          </motion.button>
        )}

        {step === 'releasing' && (
          <motion.div
            key="releasing-btn"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full py-3.5 px-4 rounded-xl bg-zinc-800 border border-white/5 text-zinc-400 font-semibold flex items-center justify-center gap-3"
          >
            <svg className="animate-spin h-4 w-4 text-teal-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Broadcasting release tx...
          </motion.div>
        )}

        {step === 'released' && (
          <motion.div
            key="released-btn"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            <div className="w-full py-3.5 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold flex items-center justify-center gap-2">
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Payment Released Successfully!
            </div>
            <button
              onClick={handleReset}
              className="w-full py-2 px-4 rounded-lg bg-white/5 text-zinc-500 hover:text-white hover:bg-white/10 text-xs transition-colors cursor-pointer"
            >
              Reset Simulation
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Simulated TX status log */}
      <div className="mt-4 text-[10px] font-mono text-zinc-600 text-center flex justify-center items-center gap-1.5">
        <span>Network: Base Mainnet</span>
        <span>•</span>
        {step === 'released' ? (
          <a href="#" className="text-teal-500/80 hover:text-teal-400 hover:underline transition-colors flex items-center gap-0.5 pointer-events-none">
            Tx: 0x8f2a...c0d1
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          </a>
        ) : (
          <span>Smart Escrow Lock Active</span>
        )}
      </div>
    </div>
  );
}

function FeeCalculator() {
  const [invoiceAmount, setInvoiceAmount] = useState<number>(10000);

  // Fees calculations
  // Stripe/PayPal: 2.9% + $0.30
  const traditionalFee = invoiceAmount * 0.029 + 0.3;
  // Wire: flat $30
  const wireFee = 30;
  // HoldisPay: flat 0.2% fee + simulated gas of $0.50
  const holdisFee = invoiceAmount * 0.002 + 0.5;

  const traditionalSavings = traditionalFee - holdisFee;

  return (
    <div className="w-full max-w-4xl mx-auto rounded-2xl border border-white/10 bg-zinc-900/40 p-6 sm:p-8 lg:p-10 shadow-xl backdrop-blur-md text-left">
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr,1fr] gap-8 lg:gap-12 items-center">
        {/* Slider & Controls */}
        <div className="space-y-6">
          <div className="flex justify-between items-end">
            <div>
              <span className="text-[10px] font-bold tracking-wider text-teal-400 uppercase bg-teal-500/10 px-2.5 py-0.5 rounded-full border border-teal-500/20">
                Calculator
              </span>
              <h3 className="text-xl font-bold text-white mt-3">Invoice Amount</h3>
            </div>
            <span className="text-3xl font-extrabold text-teal-400 font-mono">
              ${invoiceAmount.toLocaleString()}
            </span>
          </div>

          <div className="space-y-2">
            <input
              type="range"
              min="1000"
              max="100000"
              step="1000"
              value={invoiceAmount}
              onChange={(e) => setInvoiceAmount(Number(e.target.value))}
              className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
              aria-label="Invoice amount slider"
            />
            <div className="flex justify-between text-xs text-zinc-500 font-mono">
              <span>$1,000</span>
              <span>$50,000</span>
              <span>$100,000</span>
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-400 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Non-Custodial Escrow Protection</h4>
                <p className="text-xs text-zinc-400">Funds remain locked securely in a smart contract. No middleman custody risk.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-400 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Instant Settling</h4>
                <p className="text-xs text-zinc-400">Once milestones are approved, funds release to your wallet in seconds, not days.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Cost Comparison Visualizer */}
        <div className="space-y-5 rounded-2xl bg-black/40 border border-white/5 p-6 relative overflow-hidden">
          {/* Background glowing orb */}
          <div className="absolute -right-24 -bottom-24 w-48 h-48 rounded-full bg-teal-500/5 blur-[50px] pointer-events-none" />
          
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Cost & Speed Breakdown</h4>

          {/* Traditional Credit Cards */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-zinc-400">Stripe / PayPal (2.9%)</span>
              <span className="font-mono text-red-400 font-bold">${traditionalFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-red-500/50 rounded-full"
                animate={{ width: `${Math.min(100, (traditionalFee / traditionalFee) * 100)}%` }}
                transition={{ type: 'spring', stiffness: 60 }}
              />
            </div>
            <p className="text-[10px] text-zinc-500 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3" /></svg>
              Payout Delay: 2-3 business days
            </p>
          </div>

          {/* Traditional Bank Wire */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-zinc-400">International Bank Wire</span>
              <span className="font-mono text-amber-400 font-bold">${wireFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-amber-500/50 rounded-full"
                animate={{ width: `${Math.min(100, (wireFee / traditionalFee) * 100)}%` }}
                transition={{ type: 'spring', stiffness: 60 }}
              />
            </div>
            <p className="text-[10px] text-zinc-500 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3" /></svg>
              Payout Delay: 3-5 business days + compliance checks
            </p>
          </div>

          {/* HoldisPay */}
          <div className="space-y-1.5 pt-1 border-t border-white/5 mt-4">
            <div className="flex justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1">
                HoldisPay Smart Escrow
              </span>
              <span className="font-mono text-emerald-400 font-bold">${holdisFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/20"
                animate={{ width: `${Math.max(4, Math.min(100, (holdisFee / traditionalFee) * 100))}%` }}
                transition={{ type: 'spring', stiffness: 60 }}
              />
            </div>
            <p className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              Payout Delay: Instant (0 seconds) on milestone approval
            </p>
          </div>

          {/* Savings Highlight */}
          <div className="mt-4 p-4 rounded-xl bg-teal-500/10 border border-teal-500/20 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider">Estimated Savings</span>
            <span className="text-2xl font-black text-white mt-1">
              ${traditionalSavings > 0 ? traditionalSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
            </span>
            <p className="text-[10px] text-zinc-400 mt-1">Plus 2-5 days of payout waiting time eliminated.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [chains, setChains] = useState<PublicChain[]>([]);
  const [assets, setAssets] = useState<PublicAsset[]>([]);

  useEffect(() => {
    Promise.all([
      blockchainApi.getPublicEnabledChains(),
      blockchainApi.getPublicSupportedAssets(),
    ]).then(([c, a]) => {
      setChains(c);
      const bySymbol = new Map<string, PublicAsset>();
      for (const x of a) {
        if (x.symbol && !bySymbol.has(x.symbol)) bySymbol.set(x.symbol, x);
      }
      setAssets(Array.from(bySymbol.values()));
    }).catch(() => { });
  }, []);

  const spring = { type: 'spring' as const, stiffness: 80, damping: 20 };
  const springBouncy = { type: 'spring' as const, stiffness: 120, damping: 18 };
  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.12, delayChildren: 0.15 },
    },
  };
  const item = {
    hidden: { opacity: 0, y: 48 },
    visible: { opacity: 1, y: 0, transition: spring },
  };
  const sectionReveal = {
    hidden: { opacity: 0, y: 72 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const },
    },
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "HoldisPay",
            "operatingSystem": "Web",
            "applicationCategory": "FinanceApplication",
            "description": "Non-custodial platform for invoices, payment contracts, and escrow on-chain.",
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "USD"
            }
          })
        }}
      />
      {/* Nav */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0a0a0a]/90 backdrop-blur-md"
      >
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-lg py-1.5 pr-2 transition-colors hover:bg-white/5">
            <span className="text-lg font-semibold tracking-tight text-white sm:text-xl">HoldisPay</span>
          </Link>

          <div className="hidden items-center gap-1 rounded-full bg-white/5 px-1.5 py-1 backdrop-blur-sm md:flex">
            <a href="#features" className="rounded-full px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white">Features</a>
            <a href="#how-it-works" className="rounded-full px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white">How it works</a>
            <a href="#faq" className="rounded-full px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white">FAQ</a>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/signin" className="rounded-full px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors hidden sm:inline-block">
              Sign in
            </Link>
            <Link href="/signup" className="rounded-full px-4 py-2.5 text-sm font-semibold bg-teal-500 text-black hover:bg-teal-400 transition-all hidden sm:inline-block shadow-md shadow-teal-500/10">
              Get started
            </Link>

            <button
              type="button"
              onClick={() => setNavOpen((o) => !o)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/5 hover:text-white md:hidden"
              aria-expanded={navOpen}
              aria-label="Toggle menu"
            >
              {navOpen ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              )}
            </button>
          </div>
        </nav>

        <AnimatePresence>
          {navOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-white/5 bg-[#0a0a0a]/98 backdrop-blur-xl md:hidden"
            >
              <div className="flex flex-col gap-1 px-4 py-4">
                <a href="#features" className="rounded-lg px-4 py-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5 hover:text-white" onClick={() => setNavOpen(false)}>Features</a>
                <a href="#how-it-works" className="rounded-lg px-4 py-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5 hover:text-white" onClick={() => setNavOpen(false)}>How it works</a>
                <a href="#faq" className="rounded-lg px-4 py-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5 hover:text-white" onClick={() => setNavOpen(false)}>FAQ</a>

                <Link href="/signin" className="rounded-lg px-4 py-3 text-sm font-medium text-zinc-400 transition-colors" onClick={() => setNavOpen(false)}>
                  Sign in
                </Link>
                <Link href="/signup" className="rounded-xl px-4 py-3 text-sm font-medium bg-teal-500 hover:bg-teal-600 text-black transition-colors" onClick={() => setNavOpen(false)}>
                  Get started
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Hero */}
      <section id="hero" className="relative min-h-0 lg:min-h-[90vh] flex flex-col justify-center pt-28 sm:pt-24 sm:pb-20 pb-16 lg:pt-28 lg:pb-28 px-4 sm:px-6 lg:px-8 scroll-mt-20 overflow-hidden">
        <HeroBackground />
        <div className="relative max-w-6xl mx-auto w-full z-10">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr,450px] gap-10 sm:gap-12 lg:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -80 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1, ...spring }}
              className="text-left w-full order-2 lg:order-1"
            >
              <motion.h1
                className="text-4xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white tracking-tight max-w-2xl leading-[1.1]"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: {},
                  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
                }}
              >
                {'Invoices, contracts & payments held in escrow on-chain.'.split(' ').map((word, i) => (
                  <motion.span
                    key={i}
                    variants={{
                      hidden: { opacity: 0, y: 40 },
                      visible: { opacity: 1, y: 0, transition: springBouncy },
                    }}
                    className="inline-block mr-[0.25em]"
                  >
                    {word}
                  </motion.span>
                ))}
              </motion.h1>
              <motion.p
                className="mt-4 sm:mt-6 text-base sm:text-lg lg:text-xl text-zinc-400 max-w-xl leading-relaxed"
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6, ...spring }}
              >
                Create professional invoices, lock funds in secure escrow smart contracts, and release payments automatically when work is approved. Non-custodial and transparent.
              </motion.p>
              
              {/* CTAs */}
              <motion.div
                className="mt-8 flex flex-wrap items-center gap-4"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.7, ...spring }}
              >
                <Link
                  href="/signup"
                  className="px-6 py-3.5 rounded-xl bg-teal-500 text-black font-semibold hover:bg-teal-400 hover:shadow-lg hover:shadow-teal-500/25 transition-all text-sm shrink-0"
                >
                  Get Started For Free
                </Link>
                <Link
                  href="/signin"
                  className="px-6 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white font-semibold hover:bg-white/10 hover:border-white/20 transition-all text-sm shrink-0"
                >
                  Explore Dashboard
                </Link>
              </motion.div>

              <motion.div
                className="mt-8 sm:mt-10 flex flex-wrap items-center gap-3 sm:gap-4 border-t border-white/5 pt-8"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.85, ...spring }}
              >
                <span className="text-xs sm:text-sm text-zinc-500">Supported networks</span>
                <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                  {chains.map((chain, i) => (
                    <motion.span
                      key={chain.slug}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.7 + i * 0.03 }}
                      className="inline-flex items-center rounded-full bg-white/5 border border-white/10 p-1.5"
                      title={chain.displayName}
                    >
                      {chain.logoUrl ? (
                        <img src={chain.logoUrl} alt={chain.displayName} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-contain" />
                      ) : (
                        <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-medium text-zinc-400">
                          {(chain.displayName || chain.slug).slice(0, 1)}
                        </span>
                      )}
                    </motion.span>
                  ))}
                </div>
              </motion.div>

              <motion.div
                className="mt-4 flex flex-wrap items-center gap-3"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.9 }}
              >
                <span className="text-xs sm:text-sm text-zinc-500">Stablecoins & Tokens</span>
                <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                  {assets.map((asset, i) => (
                    <motion.span
                      key={asset.symbol + (asset.name ?? '')}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.7 + i * 0.03 }}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-2.5 py-1.5"
                      title={asset.name ?? asset.symbol}
                    >
                      {asset.logoUrl ? (
                        <img src={asset.logoUrl} alt={asset.symbol} className="w-4 h-4 sm:w-5 sm:h-5 rounded-full object-contain" />
                      ) : (
                        <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-medium text-zinc-400">
                          {(asset.symbol || '?').slice(0, 1)}
                        </span>
                      )}
                      <span className="text-xs font-medium text-zinc-300">{asset.symbol}</span>
                    </motion.span>
                  ))}
                </div>
              </motion.div>
            </motion.div>

            {/* Interactive Mock Simulator Column */}
            <motion.div
              initial={{ opacity: 0, x: 80, scale: 0.92 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 1, delay: 0.3, ...springBouncy }}
              className="w-full flex justify-center lg:justify-end order-1 lg:order-2"
            >
              <div className="w-full max-w-md animate-landing-float">
                <PaymentSimulator />
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, ...spring }}
            className="mt-10 sm:mt-16 text-center"
          >
            <a href="#how-it-works" className="text-sm text-zinc-500 hover:text-teal-400 transition-colors inline-flex items-center gap-2">
              See how it works
              <motion.span
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
              </motion.span>
            </a>
          </motion.div>
        </div>
      </section>

      {/* Built for */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={container}
        className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 overflow-hidden border-t border-white/5"
      >
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(20,184,166,0.02)_50%,transparent_100%)] pointer-events-none" />
        <motion.div className="relative max-w-5xl mx-auto" variants={container}>
          <motion.h2
            className="text-center text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight"
            variants={sectionReveal}
          >
            Built for freelancers & businesses
          </motion.h2>
          <motion.p
            className="text-center mt-3 text-zinc-500 text-sm sm:text-base max-w-xl mx-auto"
            variants={sectionReveal}
          >
            Smart contract escrow and payments for the modern digital economy.
          </motion.p>
          <motion.div
            className="mt-12 sm:mt-16 grid sm:grid-cols-3 gap-4 sm:gap-6"
            variants={container}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
          >
            {[
              {
                title: 'Freelancers',
                desc: 'Get paid on delivery. Lock client funds in escrow, release when the work is done. No chasing invoices.',
                icon: (
                  <svg className="w-7 h-7 sm:w-8 sm:h-8 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                ),
              },
              {
                title: 'Contractors',
                desc: 'Contracts with clear milestones. Clients fund escrow; release per deliverable. Everyone stays aligned.',
                icon: (
                  <svg className="w-7 h-7 sm:w-8 sm:h-8 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                ),
              },
              {
                title: 'Businesses',
                desc: 'Simple escrow management. Provide funding for invoices and milestones securely on-chain. Transparent and non-custodial.',
                icon: (
                  <svg className="w-7 h-7 sm:w-8 sm:h-8 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                ),
              },
            ].map((card) => (
              <motion.div
                key={card.title}
                variants={item}
                whileHover={{ y: -12, scale: 1.02, transition: { duration: 0.3, ...spring } }}
                className="group relative rounded-2xl border border-white/10 bg-zinc-900/60 p-6 sm:p-8 backdrop-blur-sm hover:border-teal-500/30 hover:bg-zinc-900/80 transition-colors text-left"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/15 border border-teal-500/20 text-teal-400 mb-5">
                  {card.icon}
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-white">{card.title}</h3>
                <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{card.desc}</p>
              </motion.div>
            ))}
          </motion.div>
          <motion.div
            className="mt-10 sm:mt-14 flex flex-wrap items-center justify-center gap-3 sm:gap-4"
            variants={container}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
          >
            {[
              { label: 'Escrow Protection', sub: 'Funds held securely on-chain' },
              { label: 'Multi-Chain', sub: 'Low gas & high speed' },
              { label: 'Seamless UI', sub: 'Create contracts in 30s' },
              { label: 'Transparent', sub: 'Milestone tracking' },
            ].map((pill) => (
              <motion.span
                key={pill.label}
                variants={item}
                className="inline-flex flex-col items-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 sm:px-5 sm:py-3"
              >
                <span className="text-sm font-semibold text-teal-400">{pill.label}</span>
                <span className="text-xs text-zinc-500 mt-0.5">{pill.sub}</span>
              </motion.span>
            ))}
          </motion.div>
        </motion.div>
      </motion.section>

      {/* Calculator Section */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        variants={container}
        className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-t border-white/5"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_120%,rgba(20,184,166,0.04),transparent_60%)] pointer-events-none" />
        <motion.div className="max-w-5xl mx-auto" variants={container}>
          <motion.div className="text-center mb-16" variants={sectionReveal}>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight">
              Compare fees & payout times
            </h2>
            <p className="mt-4 text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto">
              Traditional processors take days to settle and eat into your margins with hidden charges. HoldisPay gets you paid instantly, with zero compliance wait.
            </p>
          </motion.div>
          <FeeCalculator />
        </motion.div>
      </motion.section>

      {/* Features */}
      <motion.section
        id="features"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        variants={container}
        className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-zinc-950/50 scroll-mt-20 border-t border-white/5"
      >
        <motion.div className="max-w-5xl mx-auto" variants={container}>
          <motion.div className="text-center mb-14" variants={sectionReveal}>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">Everything you need to get paid</h2>
            <p className="mt-3 text-zinc-400 max-w-xl mx-auto">Invoices, smart contract escrow, and payments. Non-custodial.</p>
          </motion.div>
          <motion.div
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8"
            variants={container}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
          >
            {[
              { icon: 'invoice', title: 'Invoices', desc: 'Create and send invoices. Get paid in crypto or via card. Track status in one dashboard.' },
              { icon: 'contract', title: 'Contracts', desc: 'Time-based or project-based. Set amount, schedule, and scope. Both sides are aligned.' },
              { icon: 'escrow', title: 'Smart contract escrow', desc: 'Non-custodial. Funds held in smart contracts until you approve. Release when work is done. No release, no payout.' },
              { icon: 'chain', title: 'Multi-chain', desc: 'Multiple networks and tokens. Funds held in smart contracts on-chain. Non-custodial.' },
              { icon: 'fiat', title: 'Fiat Off-ramps', desc: 'Withdraw funds seamlessly. Get paid in crypto and withdraw directly to your local bank account.' },
              { icon: 'shield', title: 'Secure', desc: 'Smart contracts enforce release conditions. Funds on-chain. Non-custodial.' },
              { icon: 'link', title: 'Payment Links', desc: 'Share a secure link to get paid instantly anywhere in the world. No complex integrations.' },
              { icon: 'recurring', title: 'Recurring Payments', desc: 'Automate ongoing subscriptions and salaries with customizable recurrence intervals.' },
              { icon: 'swap', title: 'Token Swaps', desc: 'Seamlessly swap between supported stablecoins and crypto directly in your dashboard wallet.' },
            ].map((feat, i) => (
              <motion.div
                key={i}
                variants={item}
                whileHover={{ y: -10, scale: 1.02, transition: { duration: 0.3, ...spring } }}
                className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-6 hover:border-zinc-700/80 transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-teal-500/20 flex items-center justify-center mb-4">
                  {feat.icon === 'invoice' && <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                  {feat.icon === 'contract' && <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
                  {feat.icon === 'escrow' && <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
                  {feat.icon === 'chain' && (
                    <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                  )}
                  {feat.icon === 'fiat' && <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3-3v8a3 3 0 003 3z" /></svg>}
                  {feat.icon === 'shield' && <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
                  {feat.icon === 'link' && <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>}
                  {feat.icon === 'recurring' && <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
                  {feat.icon === 'swap' && <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>}
                </div>
                <h3 className="text-lg font-semibold text-white">{feat.title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{feat.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </motion.section>

      {/* How it works */}
      <motion.section
        id="how-it-works"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.12 }}
        variants={container}
        className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 scroll-mt-20"
      >
        <motion.div className="max-w-4xl mx-auto" variants={container}>
          <motion.div className="text-center mb-14" variants={sectionReveal}>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">How it works</h2>
            <p className="mt-3 text-zinc-400">Three simple steps from agreement to payout.</p>
          </motion.div>
          <motion.div
            className="grid sm:grid-cols-3 gap-8 sm:gap-10"
            variants={container}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
          >
            {[
              { step: 1, title: 'Create & agree', desc: 'Create an invoice or milestone contract. Set the payment scope, and share a link with the other party.' },
              { step: 2, title: 'Fund smart contract', desc: 'The client deposits stablecoins or crypto into the escrow smart contract. Funds are locked securely on-chain.' },
              { step: 3, title: 'Release payment', desc: 'Approve deliverables or hit milestones to trigger fund release from the smart contract directly to the recipient.' },
            ].map((stepItem) => (
              <motion.div
                key={stepItem.step}
                variants={item}
                whileHover={{ scale: 1.05, transition: { duration: 0.25, ...spring } }}
                className="relative text-center sm:text-left"
              >
                <motion.div
                  className="inline-flex sm:flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-500/20 text-teal-400 font-bold text-xl border border-teal-500/30"
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + stepItem.step * 0.15, ...springBouncy }}
                >
                  {stepItem.step}
                </motion.div>
                <h3 className="mt-4 text-lg font-semibold text-white">{stepItem.title}</h3>
                <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{stepItem.desc}</p>
                {stepItem.step < 3 && (
                  <div className="hidden sm:block absolute top-7 left-[calc(50%+2.5rem)] w-[calc(100%-5rem)] h-px bg-linear-to-r from-teal-500/40 to-transparent" />
                )}
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </motion.section>

      {/* FAQ */}
      <motion.section
        id="faq"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        variants={container}
        className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-t border-white/5 scroll-mt-20"
      >
        <motion.div className="max-w-2xl mx-auto" variants={container}>
          <motion.h2 variants={sectionReveal} className="text-2xl sm:text-3xl font-bold text-white text-center mb-10">Frequently asked questions</motion.h2>
          <div className="space-y-3">
            {FAQ_ITEMS.map((faqItem, i) => (
              <motion.div
                key={i}
                variants={item}
                className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-white hover:bg-zinc-800/40 transition-colors"
                >
                  {faqItem.q}
                  <span className="shrink-0 text-zinc-500 transition-transform duration-200" style={{ transform: openFaq === i ? 'rotate(180deg)' : 'rotate(0)' }}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-4 pt-0">
                        <p className="text-sm text-zinc-400 leading-relaxed">{faqItem.a}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.section>

      {/* Final CTA */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={container}
        className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 border-t border-white/5 overflow-hidden"
      >
        {/* Soft glowing radial background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(20,184,166,0.07),transparent)] pointer-events-none" />
        
        <motion.div className="relative max-w-3xl mx-auto text-center" variants={container}>
          <motion.h2 variants={sectionReveal} className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight">
            Stop chasing payments.<br />Start shipping.
          </motion.h2>
          <motion.p variants={sectionReveal} className="mt-6 text-base sm:text-lg text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Create professional invoices, lock client funds in non-custodial escrow, and get paid automatically on Ethereum, Base, and other EVM networks.
          </motion.p>
          <motion.div
            variants={item}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="/signup"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-teal-500 text-black font-semibold hover:bg-teal-400 hover:shadow-lg hover:shadow-teal-500/25 transition-all text-base"
            >
              Get Started For Free
            </Link>
            <Link
              href="/signin"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white/5 border border-white/10 text-white font-semibold hover:bg-white/10 hover:border-white/20 transition-all text-base"
            >
              Explore Dashboard
            </Link>
          </motion.div>
          <motion.div
            variants={item}
            className="mt-8 flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-xs text-zinc-500"
          >
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              No setup fees
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Non-Custodial Escrow
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Multi-Chain support
            </span>
          </motion.div>
        </motion.div>
      </motion.section>
    </div>
  );
}
