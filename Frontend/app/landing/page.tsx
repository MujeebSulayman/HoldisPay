'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { joinWaitlist } from '@/lib/api/waitlist';
import { WireNetworkBackground } from '@/components/landing/WireNetworkBackground';
import { BentoGrid } from '@/components/landing/BentoGrid';

const FAQ_ITEMS = [
  {
    q: 'What is holDis?',
    a: 'holDis is a platform for invoices, payment contracts, and escrow. Create invoices, agree on contracts with clients or contractors, lock funds in escrow, and release payment when work is done—all with clear tracking and optional crypto payments.',
  },
  {
    q: 'How does escrow work?',
    a: 'You fund a contract or invoice. Funds are held securely until you approve delivery or hit a milestone. Then you release payment. No release, no payout—so both sides are protected.',
  },
  {
    q: 'Can I get paid in crypto?',
    a: 'Yes. holDis supports on-chain payments and multiple chains. You can create invoices and contracts that are funded and paid in supported tokens.',
  },
  {
    q: 'Is there a waitlist?',
    a: 'Yes. Join the waitlist above and we’ll notify you when holDis is ready for you. Early joiners get priority access.',
  },
];

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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
      <WireNetworkBackground />
      {/* Nav */}
      <motion.nav
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-white/5"
      >
        <Link href="/landing" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 bg-teal-500 rounded-lg flex items-center justify-center shadow-lg shadow-teal-500/20 transition-transform group-hover:scale-105">
            <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight">holDis</span>
        </Link>
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-zinc-400 hover:text-white transition-colors">Features</a>
          <a href="#how-it-works" className="text-sm text-zinc-400 hover:text-white transition-colors">How it works</a>
          <a href="#faq" className="text-sm text-zinc-400 hover:text-white transition-colors">FAQ</a>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/signin" className="text-sm text-zinc-400 hover:text-white transition-colors">Sign in</Link>
          <Link href="/signup" className="rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-teal-400 transition-colors">Get started</Link>
        </div>
      </motion.nav>

      {/* Hero */}
      <section id="hero" className="relative pt-28 pb-16 sm:pt-36 sm:pb-24 px-4 sm:px-6 lg:px-8 scroll-mt-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(20,184,166,0.18),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,#0a0a0a_60%)]" />
        <motion.div
          className="relative max-w-4xl mx-auto text-center"
          initial="hidden"
          animate="visible"
          variants={container}
        >
          <motion.span variants={item} className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-teal-500/20 text-teal-400 border border-teal-500/30 mb-6">
            Now in private beta — join the waitlist
          </motion.span>
          <motion.h1 variants={item} className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight">
            Invoices, contracts & payments.
            <br />
            <span className="text-teal-400">Held in one place.</span>
          </motion.h1>
          <motion.p variants={item} className="mt-6 text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto">
            Create invoices, lock funds in escrow, and release payment when work is done. Simple, secure, on-chain.
          </motion.p>
          <motion.div variants={item} className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <motion.form
              onSubmit={handleWaitlist}
              className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto max-w-md sm:max-w-lg"
              whileHover={{ scale: 1.01 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                disabled={status === 'loading'}
                className="flex-1 min-w-0 px-4 py-3.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
              />
              <button
                type="submit"
                disabled={status === 'loading'}
                className="px-6 py-3.5 rounded-lg bg-teal-500 text-black font-semibold hover:bg-teal-400 transition-colors disabled:opacity-60 shrink-0"
              >
                {status === 'loading' ? 'Joining…' : 'Join waitlist'}
              </button>
            </motion.form>
            <a href="#how-it-works" className="text-sm text-zinc-400 hover:text-teal-400 transition-colors sm:ml-2">
              See how it works →
            </a>
          </motion.div>
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
        </motion.div>
      </section>

      {/* Social proof / stats */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.5 }}
        className="relative py-12 sm:py-16 px-4 sm:px-6 lg:px-8 border-y border-white/5"
      >
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-sm font-medium text-zinc-500 uppercase tracking-wider mb-8">
            Built for freelancers, teams & DAOs
          </p>
          <motion.div
            className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8"
            variants={container}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
          >
            {[
              { value: 'Escrow', label: 'Funds held securely' },
              { value: 'On-chain', label: 'Crypto-native' },
              { value: 'Simple', label: 'No complex setup' },
              { value: 'Transparent', label: 'Clear milestones' },
            ].map((stat, i) => (
              <motion.div key={i} variants={item} className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-teal-400">{stat.value}</p>
                <p className="mt-1 text-sm text-zinc-500">{stat.label}</p>
              </motion.div>
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
        className="relative py-16 sm:py-24 px-4 sm:px-6 lg:px-8"
      >
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">
            Stop chasing payments. Start shipping.
          </h2>
          <p className="mt-4 text-lg text-zinc-400 max-w-2xl mx-auto">
            Agree on scope, lock funds in escrow, and release when work is done. No more “invoice sent, payment pending” for months.
          </p>
          <motion.div
            className="mt-12 grid sm:grid-cols-3 gap-6 text-left"
            variants={container}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
          >
            {[
              { title: 'Clear terms', desc: 'Contracts with deliverables and payment schedule. Everyone knows what’s due when.' },
              { title: 'Protected funds', desc: 'Money is held in escrow. Release only when you approve work or hit a milestone.' },
              { title: 'One platform', desc: 'Invoices and contracts in one place. Track everything without spreadsheets.' },
            ].map((card, i) => (
              <motion.div key={i} variants={item} className="p-5 rounded-xl bg-zinc-900/50 border border-zinc-800/80">
                <h3 className="font-semibold text-white">{card.title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{card.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* Bento grid */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.5 }}
        className="relative py-16 sm:py-24 px-4 sm:px-6 lg:px-8"
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">
              One place for invoices, contracts & payments
            </h2>
            <p className="mt-3 text-zinc-400 max-w-xl mx-auto">
              From creation to release—see it in action.
            </p>
          </div>
          <BentoGrid />
        </div>
      </motion.section>

      {/* Features */}
      <motion.section
        id="features"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.5 }} className="relative py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-zinc-950/50 scroll-mt-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">Everything you need to get paid</h2>
            <p className="mt-3 text-zinc-400 max-w-xl mx-auto">Invoices, contracts, and escrow in one product.</p>
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
              { icon: 'escrow', title: 'Escrow', desc: 'Funds held securely until you approve. Release when work is done. No release, no payout.' },
              { icon: 'chain', title: 'Multi-chain', desc: 'Support for multiple networks and tokens. Choose the chain that fits your workflow.' },
              { icon: 'team', title: 'Teams & roles', desc: 'Invite team members. Assign employer vs contractor. Clear visibility for everyone.' },
              { icon: 'shield', title: 'Secure', desc: 'Built for real payments. Funds are held on-chain with clear release conditions.' },
            ].map((item, i) => (
              <motion.div
                key={i}
                variants={item}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="rounded-xl bg-zinc-900/60 border border-zinc-800/80 p-6 hover:border-zinc-700/80 transition-colors"
              >
                <div className="w-11 h-11 rounded-lg bg-teal-500/20 flex items-center justify-center mb-4">
                  {item.icon === 'invoice' && <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                  {item.icon === 'contract' && <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
                  {item.icon === 'escrow' && <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
                  {item.icon === 'chain' && <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>}
                  {item.icon === 'team' && <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
                  {item.icon === 'shield' && <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
                </div>
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{item.desc}</p>
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
        transition={{ duration: 0.5 }} className="relative py-16 sm:py-24 px-4 sm:px-6 lg:px-8 scroll-mt-20">
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
              { step: 2, title: 'Fund escrow', desc: 'Fund the contract or invoice. Funds are held securely until conditions are met.' },
              { step: 3, title: 'Release payment', desc: 'Approve work or hit a milestone. Release payment in one click. Done.' },
            ].map((stepItem) => (
              <motion.div key={stepItem.step} variants={item} className="relative text-center sm:text-left">
                <div className="inline-flex sm:flex items-center justify-center w-12 h-12 rounded-xl bg-teal-500/20 text-teal-400 font-bold text-lg border border-teal-500/30">
                  {stepItem.step}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">{stepItem.title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{stepItem.desc}</p>
                {stepItem.step < 3 && (
                  <div className="hidden sm:block absolute top-6 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-px bg-gradient-to-r from-teal-500/40 to-transparent" />
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
        transition={{ duration: 0.5 }} className="relative py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-white/5 scroll-mt-20">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-10">Frequently asked questions</h2>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item, i) => (
              <div
                key={i}
                className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-white hover:bg-zinc-800/40 transition-colors"
                >
                  {item.q}
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
                        <p className="text-sm text-zinc-400 leading-relaxed">{item.a}</p>
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
        className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_100%,rgba(20,184,166,0.12),transparent)]" />
        <div className="relative max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">Get early access</h2>
          <p className="mt-3 text-zinc-400">Join the waitlist. We’ll notify you when holDis is ready for you.</p>
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
              className="flex-1 min-w-0 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              disabled={status === 'loading'}
              className="flex-1 min-w-0 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="px-6 py-3 rounded-lg bg-teal-500 text-black font-semibold hover:bg-teal-400 transition-colors disabled:opacity-60 shrink-0"
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

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="border-t border-white/5 py-12 sm:py-16 px-4 sm:px-6 lg:px-8"
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 sm:gap-12">
            <div className="col-span-2 sm:col-span-1">
              <Link href="/landing" className="flex items-center gap-2">
                <div className="w-9 h-9 bg-teal-500 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className="font-bold text-white">holDis</span>
              </Link>
              <p className="mt-3 text-sm text-zinc-500 max-w-[200px]">Invoices, contracts & payments. Held in one place.</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider">Product</h4>
              <ul className="mt-4 space-y-3">
                <li><a href="#features" className="text-sm text-zinc-400 hover:text-white transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="text-sm text-zinc-400 hover:text-white transition-colors">How it works</a></li>
                <li><a href="#faq" className="text-sm text-zinc-400 hover:text-white transition-colors">FAQ</a></li>
                <li><Link href="/signup" className="text-sm text-zinc-400 hover:text-white transition-colors">Sign up</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider">Company</h4>
              <ul className="mt-4 space-y-3">
                <li><Link href="/signin" className="text-sm text-zinc-400 hover:text-white transition-colors">Sign in</Link></li>
                <li><Link href="/landing" className="text-sm text-zinc-400 hover:text-white transition-colors">Landing</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-zinc-500">© {new Date().getFullYear()} holDis. All rights reserved.</p>
            <div className="flex items-center gap-6 text-sm text-zinc-500">
              <Link href="/signin" className="hover:text-white transition-colors">Sign in</Link>
              <Link href="/signup" className="hover:text-white transition-colors">Get started</Link>
            </div>
          </div>
        </div>
      </motion.footer>
    </div>
  );
}
