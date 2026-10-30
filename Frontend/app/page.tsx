'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  ChevronDown,
  FileText,
  Landmark,
  Layers,
  LinkIcon,
  Lock,
  RefreshCw,
  Split,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { blockchainApi, type PublicChain, type PublicAsset } from '@/lib/api/blockchain';
import { LandingNav } from '@/components/landing/LandingNav';
import { PaymentFlow } from '@/components/landing/PaymentFlow';
import { Reveal } from '@/components/landing/Reveal';

// Absolute URLs so landing page (holdispay.xyz) links to the app subdomain
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.holdispay.xyz';
const SIGNIN_URL = `${APP_URL}/signin`;
const SIGNUP_URL = `${APP_URL}/signup`;

// Shown until the public chain/asset lists load (or if they fail).
const FALLBACK_CHAINS = ['Ethereum', 'Base', 'Arbitrum', 'Optimism', 'Polygon'];
const FALLBACK_ASSETS = ['USDC', 'USDT', 'DAI', 'ETH'];

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

const FEATURES: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: FileText, title: 'Invoices', desc: 'Create and send invoices. Get paid in stablecoins or crypto and track status in one dashboard.' },
  { icon: RefreshCw, title: 'Recurring & milestones', desc: 'Weekly, monthly, or per-milestone payouts. Set the terms once and the contract runs itself.' },
  { icon: Layers, title: 'Multi-chain', desc: 'Settle on Base, Arbitrum, Mainnet, and other EVM networks with minimal gas fees.' },
  { icon: Landmark, title: 'Fiat off-ramps', desc: 'Get paid in stablecoins and withdraw directly to your bank account.' },
  { icon: Split, title: 'Team splits', desc: 'One payment, distributed automatically to every contributor by percentage or fixed amount.' },
  { icon: LinkIcon, title: 'Payment links', desc: 'Share a secure link and get paid anywhere in the world. No integrations required.' },
];

const AUDIENCES = [
  { title: 'Freelancers', desc: 'Get paid on delivery. Client funds are locked before you start, and released when the work is done.' },
  { title: 'Contractors', desc: 'Clear milestones, funded up front. Each deliverable releases its own payment.' },
  { title: 'Businesses', desc: 'Fund invoices and milestones on-chain, and pay whole teams in one transaction.' },
];

/** A section heading: big index number, kicker, statement. */
function SectionHead({ index, eyebrow, title }: { index: string; eyebrow: string; title: ReactNode }) {
  return (
    <Reveal className="mb-14 flex items-end gap-6">
      <span className="hidden font-mono text-[64px] font-medium leading-[0.8] tracking-[-0.08em] text-[var(--hp-numeral)] sm:block">{index}</span>
      <div>
        <p className="hp-eyebrow">{eyebrow}</p>
        <h2 className="hp-h2 mt-3">{title}</h2>
      </div>
    </Reveal>
  );
}

function Chip({ name, logoUrl }: { name: string; logoUrl?: string }) {
  return (
    <span className="hp-pill !h-9 !pl-2 !pr-3.5 !text-[13px]">
      {logoUrl ? (
        <img src={logoUrl} alt="" className="h-5 w-5 rounded-full object-contain" />
      ) : (
        <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--hp-line)] font-mono text-[10px]">{name[0]}</span>
      )}
      {name}
    </span>
  );
}

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
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

  const chainChips = chains.length
    ? chains.map((c) => ({ name: c.displayName, logoUrl: c.logoUrl }))
    : FALLBACK_CHAINS.map((name) => ({ name, logoUrl: undefined }));
  const assetNames = assets.length ? assets.map((a) => a.symbol) : FALLBACK_ASSETS;

  return (
    <div className="hp-landing min-h-screen overflow-x-clip font-sans">
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

      <LandingNav signInUrl={SIGNIN_URL} signUpUrl={SIGNUP_URL} />

      <main>
        {/* Hero */}
        <section
          id="hero"
          className="hp-shell grid scroll-mt-24 items-center gap-14 pt-32 lg:min-h-[min(100vh,960px)] lg:grid-cols-[1.1fr_1fr] lg:gap-8 lg:pt-24"
        >
          <div className="min-w-0">
            <span className="hp-pill hp-rise">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_10px_rgb(52_211_153)]" />
              Non-custodial escrow · live on-chain
            </span>

            <h1 className="hp-display hp-rise mt-7 text-[clamp(40px,5vw,72px)]" style={{ animationDelay: '80ms' }}>
              <span className="whitespace-nowrap">Pay and get paid</span>
              <br />
              with <span className="hp-text-gradient">confidence.</span>
            </h1>

            <p className="hp-rise mt-7 max-w-[46ch] text-[clamp(16px,1.5vw,19px)] leading-relaxed text-[var(--hp-dim)]" style={{ animationDelay: '160ms' }}>
              Create invoices, lock funds in smart contract escrow, and release payment automatically when work is approved.
              Non-custodial and transparent.
            </p>

            <div className="hp-rise mt-9 flex flex-wrap gap-3" style={{ animationDelay: '240ms' }}>
              <a href={SIGNUP_URL} className="hp-btn hp-btn-lg hp-btn-white">
                Get started for free
                <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.2} />
              </a>
              <a href={SIGNIN_URL} className="hp-btn hp-btn-lg hp-btn-ghost">
                <Wallet className="h-[18px] w-[18px]" />
                Explore dashboard
              </a>
            </div>

            <div className="hp-rise mt-10" style={{ animationDelay: '320ms' }}>
              <p className="hp-label">Settles on</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {chainChips.slice(0, 5).map((c) => (
                  <Chip key={c.name} {...c} />
                ))}
              </div>
              <p className="mt-3 font-mono text-[12px] text-[var(--hp-mute)]">in {assetNames.join(' · ')}</p>
            </div>
          </div>

          <div className="hp-rise flex justify-center" style={{ animationDelay: '200ms' }}>
            <PaymentFlow />
          </div>
        </section>

        {/* 01 How it works */}
        <section id="how-it-works" className="hp-shell hp-section">
          <SectionHead index="01" eyebrow="How it works" title="From agreement to payout." />
          <div className="grid gap-5 lg:grid-cols-3">
            <Reveal scale className="h-full">
              <article className="hp-card flex h-full flex-col p-8">
                <p className="hp-kicker">01 / Agree</p>
                <p className="mt-4 text-[24px] font-semibold leading-tight tracking-[-0.03em]">Terms first, then money.</p>
                <p className="mt-3 text-[15px] leading-relaxed text-[var(--hp-dim)]">
                  Create an invoice or milestone contract and share one link with the other party.
                </p>
                <div className="mt-auto grid gap-3 pt-10 text-[13.5px]">
                  {[
                    ['Client', 'Acme Corp'],
                    ['Due', 'Nov 14'],
                  ].map(([k, v]) => (
                    <div key={k} className="hp-receipt-row">
                      <span className="text-[var(--hp-mute)]">{k}</span>
                      <span className="leader" />
                      <span>{v}</span>
                    </div>
                  ))}
                  <div className="hp-receipt-row">
                    <span className="text-[var(--hp-mute)]">Amount</span>
                    <span className="leader" />
                    <span className="font-heading text-[16px] font-semibold tabular-nums">5,000 USDC</span>
                  </div>
                </div>
              </article>
            </Reveal>

            <Reveal scale delay={60} className="h-full">
              <article className="hp-card flex h-full flex-col p-8">
                <p className="hp-kicker">02 / Lock</p>
                <p className="mt-4 text-[24px] font-semibold leading-tight tracking-[-0.03em]">Funds wait in escrow.</p>
                <p className="mt-3 text-[15px] leading-relaxed text-[var(--hp-dim)]">
                  The client deposits stablecoins into the contract. Committed, but nobody can move it alone.
                </p>
                <div className="mt-auto flex items-center justify-between gap-2 pt-10 font-mono text-[12px] text-[var(--hp-mute)]">
                  <span>Client</span>
                  <span className="h-px flex-1 bg-[var(--hp-line)]" />
                  <span className="hp-pill hp-pill-accent !h-8">
                    <Lock className="h-3.5 w-3.5" />
                    Escrow
                  </span>
                  <span className="h-px flex-1 bg-[var(--hp-line)]" />
                  <span>You</span>
                </div>
              </article>
            </Reveal>

            <Reveal scale delay={120} className="h-full">
              <article className="hp-card flex h-full flex-col p-8">
                <p className="hp-kicker">03 / Release</p>
                <p className="mt-4 text-[24px] font-semibold leading-tight tracking-[-0.03em]">Paid on approval.</p>
                <p className="mt-3 text-[15px] leading-relaxed text-[var(--hp-dim)]">
                  Approve a deliverable or hit a milestone, and the contract pays the recipient directly.
                </p>
                <div className="mt-auto grid gap-3 pt-10">
                  {[
                    { label: 'Design', width: 100, accent: true },
                    { label: 'Build', width: 100, accent: true },
                    { label: 'Launch', width: 6 },
                  ].map((row) => (
                    <div key={row.label} className="grid grid-cols-[4rem_1fr] items-center gap-3 font-mono text-[12px]">
                      <span className={row.accent ? 'text-[var(--hp-accent)]' : 'text-[var(--hp-mute)]'}>{row.label}</span>
                      <span className={`hp-meter ${row.accent ? 'is-accent' : ''}`}>
                        <i style={{ width: `${row.width}%` }} />
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            </Reveal>
          </div>
        </section>

        {/* 02 Features: an open grid, no boxes, so the page can breathe */}
        <section id="features" className="hp-shell hp-section">
          <SectionHead index="02" eyebrow="Features" title="Everything you need to get paid." />
          <div className="grid gap-x-12 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={title} delay={(i % 3) * 60}>
                <Icon className="h-6 w-6 text-[var(--hp-accent)]" strokeWidth={1.6} />
                <p className="mt-5 text-[17px] font-semibold tracking-[-0.02em]">{title}</p>
                <p className="mt-2 max-w-[34ch] text-[15px] leading-relaxed text-[var(--hp-dim)]">{desc}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* 03 Who it's for */}
        <section id="who" className="hp-shell hp-section">
          <SectionHead index="03" eyebrow="Who it's for" title="Built for both sides of the deal." />
          <div className="grid gap-10 md:grid-cols-3">
            {AUDIENCES.map(({ title, desc }, i) => (
              <Reveal key={title} delay={i * 60} className="border-t border-[var(--hp-line)] pt-6">
                <p className="font-heading text-[22px] font-semibold tracking-[-0.03em]">{title}</p>
                <p className="mt-3 text-[15px] leading-relaxed text-[var(--hp-dim)]">{desc}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* 04 FAQ */}
        <section id="faq" className="hp-shell hp-section">
          <SectionHead index="04" eyebrow="Questions" title="Before you trust us with a payment." />
          <div className="max-w-3xl border-t border-[var(--hp-line)]">
            {FAQ_ITEMS.map(({ q, a }, i) => {
              const on = openFaq === i;
              return (
                <div key={q} className="border-b border-[var(--hp-line)]">
                  <button
                    type="button"
                    className="flex w-full items-center gap-4 py-6 text-left"
                    onClick={() => setOpenFaq(on ? null : i)}
                    aria-expanded={on}
                  >
                    <span className="flex-1 text-[17px] font-semibold tracking-[-0.015em]">{q}</span>
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition-all duration-500 [transition-timing-function:var(--ease-spring)] ${
                        on ? 'rotate-180 bg-[var(--hp-accent)] text-[var(--hp-accent-ink)]' : 'bg-[var(--hp-tint)] text-[var(--hp-dim)]'
                      }`}
                    >
                      <ChevronDown className="h-4 w-4" strokeWidth={2.2} />
                    </span>
                  </button>
                  <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: on ? '1fr' : '0fr' }}>
                    <div className="overflow-hidden">
                      <p className="max-w-[62ch] pb-6 pr-12 text-[15.5px] leading-relaxed text-[var(--hp-dim)]">{a}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Closing */}
        <section className="hp-shell hp-section pb-32">
          <Reveal scale>
            <div className="glass-strong rounded-[40px] px-6 py-20 text-center sm:px-12 sm:py-24">
              <h2 className="hp-display text-[clamp(34px,4.6vw,60px)]">
                Stop chasing payments.
                <br />
                <span className="hp-text-gradient">Start shipping.</span>
              </h2>
              <p className="mx-auto mt-6 max-w-[44ch] text-[17px] leading-relaxed text-[var(--hp-dim)]">
                No setup fees. Non-custodial escrow. Payouts on Ethereum, Base, and other EVM networks.
              </p>
              <div className="mt-10 flex flex-wrap justify-center gap-3">
                <a href={SIGNUP_URL} className="hp-btn hp-btn-lg hp-btn-white">
                  Get started for free
                  <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.2} />
                </a>
                <a href={SIGNIN_URL} className="hp-btn hp-btn-lg hp-btn-ghost">
                  Explore dashboard
                </a>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="hp-shell pb-10">
        <div className="flex flex-col gap-4 border-t border-[var(--hp-line)] pt-6 text-[13px] text-[var(--hp-mute)] md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" className="h-6 w-6 rounded-md" />
            <span>© {new Date().getFullYear()} HoldisPay. Pay and get paid with confidence.</span>
          </div>
          <div className="flex gap-5">
            <a href="#features" className="transition-colors hover:text-[var(--hp-fg)]">Features</a>
            <a href="#faq" className="transition-colors hover:text-[var(--hp-fg)]">FAQ</a>
            <a href={SIGNIN_URL} className="transition-colors hover:text-[var(--hp-fg)]">Sign in</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
