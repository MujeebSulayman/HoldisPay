'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { joinWaitlist } from '@/lib/api/waitlist';
import { HeroWireGrid } from '@/components/landing/HeroWireGrid';
import { SUPPORTED_NETWORKS } from '@/lib/chain-assets';
import { SUPPORTED_TOKENS } from '@/lib/token-assets';

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
    a: 'Yes. HoldisPay uses smart contracts on multiple networks. Get paid in USDC and other supported tokens. All non-custodial: funds stay in the contract until release conditions are met.',
  },
  {
    q: 'Is there a waitlist?',
    a: 'Yes. Join the waitlist above and we’ll notify you when HoldisPay is ready for you. Early joiners get priority access.',
  },
];

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');
    setMessage('');
    const res = await joinWaitlist(email, name || undefined);
    setStatus(res.success ? 'success' : 'error');
    setMessage(res.success ? (res.message || "You're on the list.") : (res.error || 'Something went wrong'));
    if (res.success) {
      setEmail('');
      setName('');
    }
  };

  const container = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } } };
  const item = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      {/* Nav */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0a0a0a]/90 backdrop-blur-md"
      >
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          <Link href="/landing" className="flex shrink-0 items-center gap-2.5 rounded-lg py-1.5 pr-2 transition-colors hover:bg-white/5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500 text-black shadow-[0_0_20px_-4px_rgba(20,184,166,0.4)]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-lg font-semibold tracking-tight text-white sm:text-xl">HoldisPay</span>
          </Link>

          <div className="hidden items-center gap-1 rounded-full bg-white/5 px-1.5 py-1 backdrop-blur-sm md:flex">
            <a href="#features" className="rounded-full px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white">Features</a>
            <a href="#how-it-works" className="rounded-full px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white">How it works</a>
            <a href="#faq" className="rounded-full px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white">FAQ</a>
          </div>

          <div className="flex items-center md:hidden">
            <button
              type="button"
              onClick={() => setNavOpen((o) => !o)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Hero */}
      <section id="hero" className="relative min-h-0 lg:min-h-[90vh] flex flex-col justify-center pt-20 pb-16 sm:pt-24 sm:pb-20 lg:pt-28 lg:pb-28 px-4 sm:px-6 lg:px-8 scroll-mt-20 overflow-hidden">
        <HeroWireGrid />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_20%_50%,rgba(20,184,166,0.06),transparent_50%)]" />
        <div className="relative max-w-6xl mx-auto w-full z-10">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr,400px] gap-10 sm:gap-12 lg:gap-16 items-start">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="text-left w-full order-2 lg:order-1"
            >
              <motion.h1
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white tracking-tight max-w-2xl"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: {},
                  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
                }}
              >
                {'Invoices, contracts & payments held in one place.'.split(' ').map((word, i) => (
                  <motion.span key={i} variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="inline-block mr-[0.25em]">
                    {word}
                  </motion.span>
                ))}
              </motion.h1>
              <motion.p
                className="mt-4 sm:mt-6 text-base sm:text-lg lg:text-xl text-zinc-400 max-w-xl"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                Create invoices, lock funds in smart contract escrow, release when done. Non-custodial and on-chain.
              </motion.p>
              <motion.div
                className="mt-6 sm:mt-8 flex flex-wrap items-center gap-3 sm:gap-4"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.55 }}
              >
                <span className="text-xs sm:text-sm text-zinc-500">Supported networks</span>
                <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                  {SUPPORTED_NETWORKS.map((chain, i) => (
                    <motion.span
                      key={chain.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.6 + i * 0.03 }}
                      className="inline-flex items-center rounded-full bg-white/5 border border-white/10 p-1.5"
                      title={chain.name}
                    >
                      <img src={chain.logo} alt={chain.name} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-contain" />
                    </motion.span>
                  ))}
                </div>
              </motion.div>
              <motion.div
                className="mt-4 flex flex-wrap items-center gap-3"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.75 }}
              >
                <span className="text-xs sm:text-sm text-zinc-500">Tokens</span>
                <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                  {SUPPORTED_TOKENS.map((token, i) => (
                    <motion.span
                      key={token.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.6 + i * 0.03 }}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-2.5 py-1.5"
                      title={token.name}
                    >
                      <img src={token.logo} alt={token.name} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-contain" />
                      <span className="text-xs font-medium text-zinc-300">{token.symbol}</span>
                    </motion.span>
                  ))}
                </div>
              </motion.div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="w-full flex justify-center lg:justify-end order-1 lg:order-2"
            >
              <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900/90 p-5 sm:p-6 lg:p-8 shadow-2xl backdrop-blur-md shrink-0">
                <h2 className="text-lg font-semibold text-white mb-1">Join the waitlist</h2>
                <p className="text-sm text-zinc-400 mb-6">Get notified when HoldisPay is ready.</p>
                <form onSubmit={handleWaitlist} className="space-y-4">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    disabled={status === 'loading'}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                  />
                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="w-full px-6 py-3.5 rounded-xl bg-teal-500 text-black font-semibold hover:bg-teal-400 transition-colors disabled:opacity-60"
                  >
                    {status === 'loading' ? 'Joining…' : 'Join waitlist'}
                  </button>
                </form>
                <AnimatePresence mode="wait">
                  {message && (
                    <motion.p
                      key={message}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={`mt-4 text-sm ${status === 'success' ? 'text-teal-400' : 'text-red-400'}`}
                    >
                      {message}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-10 sm:mt-16 text-center"
          >
            <a href="#how-it-works" className="text-sm text-zinc-500 hover:text-teal-400 transition-colors inline-flex items-center gap-2">
              See how it works
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
            </a>
          </motion.div>
        </div>
      </section>

      {/* Built for */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.5 }}
        className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 overflow-hidden"
      >
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(20,184,166,0.03)_50%,transparent_100%)]" />
        <div className="relative max-w-5xl mx-auto">
          <motion.h2
            className="text-center text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            Built for freelancers, teams & DAOs
          </motion.h2>
          <motion.p
            className="text-center mt-3 text-zinc-500 text-sm sm:text-base max-w-xl mx-auto"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            Smart contract escrow and payments for how you work.
          </motion.p>
          <motion.div
            className="mt-12 sm:mt-16 grid sm:grid-cols-3 gap-4 sm:gap-6"
            variants={container}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
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
                title: 'Teams',
                desc: 'Contracts with clear milestones. Employers fund escrow; release per deliverable. Everyone stays aligned.',
                icon: (
                  <svg className="w-7 h-7 sm:w-8 sm:h-8 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                ),
              },
              {
                title: 'DAOs',
                desc: 'Treasury-friendly escrow. Fund proposals or bounties on-chain; release on approval. Transparent and non-custodial.',
                icon: (
                  <svg className="w-7 h-7 sm:w-8 sm:h-8 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                ),
              },
            ].map((card, i) => (
              <motion.div
                key={card.title}
                variants={item}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="group relative rounded-2xl border border-white/10 bg-zinc-900/60 p-6 sm:p-8 backdrop-blur-sm hover:border-teal-500/30 hover:bg-zinc-900/80 transition-colors"
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
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            {[
              { label: 'Escrow', sub: 'Funds held securely' },
              { label: 'Multi-chain', sub: 'Many networks' },
              { label: 'Simple', sub: 'No complex setup' },
              { label: 'Transparent', sub: 'Clear milestones' },
            ].map((pill) => (
              <span
                key={pill.label}
                className="inline-flex flex-col items-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 sm:px-5 sm:py-3"
              >
                <span className="text-sm font-semibold text-teal-400">{pill.label}</span>
                <span className="text-xs text-zinc-500 mt-0.5">{pill.sub}</span>
              </span>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* Problem / Why */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.5 }}
        className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8"
      >
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">
            Stop chasing payments. Start shipping.
          </h2>
          <p className="mt-4 text-lg text-zinc-400 max-w-2xl mx-auto">
            Agree on scope, lock funds in smart contract escrow, and release when work is done. Non-custodial: we never hold your funds.
          </p>
          <motion.div
            className="mt-14 grid sm:grid-cols-3 gap-6 text-left"
            variants={container}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
          >
            {[
              { title: 'Clear terms', desc: 'Contracts with deliverables and payment schedule. Everyone knows what\'s due when.' },
              { title: 'Smart contract escrow', desc: 'Funds held on-chain in escrow. Release only when you approve work or hit a milestone. Non-custodial.' },
              { title: 'One platform', desc: 'Invoices and contracts in one place. Track everything without spreadsheets.' },
            ].map((card, i) => (
              <motion.div key={i} variants={item} className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700/80 transition-colors">
                <h3 className="font-semibold text-white text-lg">{card.title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{card.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* Features */}
      <motion.section
        id="features"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.5 }}
        className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-zinc-950/50 scroll-mt-20"
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">Everything you need to get paid</h2>
            <p className="mt-3 text-zinc-400 max-w-xl mx-auto">Invoices, smart contract escrow, and payments. Non-custodial.</p>
          </div>
          <motion.div
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8"
            variants={container}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
          >
            {[
              { icon: 'invoice', title: 'Invoices', desc: 'Create and send invoices. Get paid in crypto or via card. Track status in one dashboard.' },
              { icon: 'contract', title: 'Contracts', desc: 'Time-based or project-based. Set amount, schedule, and scope. Both sides are aligned.' },
              { icon: 'escrow', title: 'Smart contract escrow', desc: 'Non-custodial. Funds held in smart contracts until you approve. Release when work is done. No release, no payout.' },
              { icon: 'chain', title: 'Multi-chain', desc: 'Multiple networks and tokens. Funds held in smart contracts on-chain. Non-custodial.' },
              { icon: 'team', title: 'Teams & roles', desc: 'Invite team members. Assign employer vs contractor. Clear visibility for everyone.' },
              { icon: 'shield', title: 'Secure', desc: 'Smart contracts enforce release conditions. Funds on-chain. Non-custodial.' },
            ].map((feat, i) => (
              <motion.div
                key={i}
                variants={item}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-6 hover:border-zinc-700/80 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-teal-500/20 flex items-center justify-center mb-4">
                  {feat.icon === 'invoice' && <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                  {feat.icon === 'contract' && <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
                  {feat.icon === 'escrow' && <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
                  {feat.icon === 'chain' && (
                    <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                  )}
                  {feat.icon === 'team' && <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
                  {feat.icon === 'shield' && <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
                </div>
                <h3 className="text-lg font-semibold text-white">{feat.title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{feat.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* How it works */}
      <motion.section
        id="how-it-works"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.5 }}
        className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 scroll-mt-20"
      >
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">How it works</h2>
            <p className="mt-3 text-zinc-400">Three steps from agreement to payment.</p>
          </div>
          <motion.div
            className="grid sm:grid-cols-3 gap-8 sm:gap-10"
            variants={container}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
          >
            {[
              { step: 1, title: 'Create & agree', desc: 'Create an invoice or contract. Set amount, scope, and schedule. Share with the other party.' },
              { step: 2, title: 'Fund smart contract', desc: 'Fund the escrow smart contract. Funds are held on-chain until conditions are met. Non-custodial.' },
              { step: 3, title: 'Release payment', desc: 'Approve work or hit a milestone. Trigger release from the smart contract. Done.' },
            ].map((stepItem) => (
              <motion.div key={stepItem.step} variants={item} className="relative text-center sm:text-left">
                <div className="inline-flex sm:flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-500/20 text-teal-400 font-bold text-xl border border-teal-500/30">
                  {stepItem.step}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">{stepItem.title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{stepItem.desc}</p>
                {stepItem.step < 3 && (
                  <div className="hidden sm:block absolute top-7 left-[calc(50%+2.5rem)] w-[calc(100%-5rem)] h-px bg-gradient-to-r from-teal-500/40 to-transparent" />
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* FAQ */}
      <motion.section
        id="faq"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.5 }}
        className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-t border-white/5 scroll-mt-20"
      >
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-10">Frequently asked questions</h2>
          <div className="space-y-3">
            {FAQ_ITEMS.map((faqItem, i) => (
              <div
                key={i}
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
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Final CTA / Waitlist */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.5 }}
        className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_100%,rgba(20,184,166,0.12),transparent)]" />
        <div className="relative max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">Get early access</h2>
          <p className="mt-3 text-zinc-400">Join the waitlist. We’ll notify you when HoldisPay is ready for you.</p>
          <motion.form
            onSubmit={handleWaitlist}
            className="mt-8 flex flex-col sm:flex-row gap-3 max-w-md sm:max-w-lg mx-auto"
            whileHover={{ scale: 1.01 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (optional)"
              disabled={status === 'loading'}
              className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              disabled={status === 'loading'}
              className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="px-6 py-3 rounded-xl bg-teal-500 text-black font-semibold hover:bg-teal-400 transition-colors disabled:opacity-60 shrink-0"
            >
              {status === 'loading' ? '…' : 'Join'}
            </button>
          </motion.form>
          <AnimatePresence mode="wait">
            {message && (
              <motion.p
                key={message}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`mt-3 text-sm ${status === 'success' ? 'text-teal-400' : 'text-red-400'}`}
              >
                {message}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </motion.section>
    </div>
  );
}
