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

/** A section heading: big index number next to the statement. */
function SectionHead({ index, title }: { index: string; title: ReactNode }) {
  return (
    <Reveal className="mb-14 flex items-baseline gap-6">
      <span className="hidden font-mono text-[56px] font-medium leading-none tracking-[-0.08em] text-[var(--hp-numeral)] sm:block">{index}</span>
      <h2 className="hp-h2">{title}</h2>
    </Reveal>
  );
}

// Bundled logos, used when the API doesn't return one (or isn't reachable).
const LOCAL_LOGOS: Record<string, string> = {
  ethereum: '/landing/logos/ethereum.png',
  base: '/landing/logos/base.png',
  arbitrum: '/landing/logos/arbitrum.png',
  optimism: '/landing/logos/optimism.png',
  polygon: '/landing/logos/polygon.png',
  usdc: '/landing/logos/usdc.png',
  usdt: '/landing/logos/usdt.png',
  dai: '/landing/logos/dai.png',
  eth: '/landing/logos/ethereum.png',
};

const localLogo = (name: string) => LOCAL_LOGOS[name.toLowerCase().split(' ')[0]];

/** A network or token shown by its logo; the name is the tooltip and the accessible label. */
function Logo({ name, logoUrl }: { name: string; logoUrl?: string }) {
  const src = logoUrl || localLogo(name);
  return (
    <span
      title={name}
      className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-white shadow-[0_0_0_1px_var(--hp-line),0_6px_14px_-8px_rgb(0_0_0/0.5)] transition-transform duration-500 [transition-timing-function:var(--ease-spring)] hover:scale-110"
    >
      {src ? (
        <img src={src} alt={name} className="h-7 w-7 object-contain" />
      ) : (
        <span className="font-mono text-[11px] font-semibold text-[#0e1210]" aria-label={name}>
          {name.slice(0, 2)}
        </span>
      )}
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
  const assetChips = assets.length
    ? assets.map((a) => ({ name: a.symbol, logoUrl: a.logoUrl }))
    : FALLBACK_ASSETS.map((name) => ({ name, logoUrl: undefined }));

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
          className="hp-shell grid scroll-mt-24 items-center gap-14 pt-36 lg:grid-cols-[1.1fr_1fr] lg:gap-8 lg:pt-44"
        >
          <div className="min-w-0">
            <h1 className="hp-display hp-rise text-[clamp(40px,5vw,72px)]">
              <span className="whitespace-nowrap">Pay and get paid</span>
              <br />
              with <span className="hp-text-gradient">confidence.</span>
            </h1>

            <p className="hp-rise mt-7 max-w-[46ch] text-[clamp(16px,1.5vw,19px)] leading-relaxed text-[var(--hp-dim)]" style={{ animationDelay: '80ms' }}>
              Create invoices, lock funds in smart contract escrow, and release payment automatically when work is approved.
              Non-custodial and transparent.
            </p>

            <div className="hp-rise mt-9 flex flex-wrap gap-3" style={{ animationDelay: '160ms' }}>
              <a href={SIGNUP_URL} className="hp-btn hp-btn-lg hp-btn-white">
                Get started for free
                <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.2} />
              </a>
              <a href={SIGNIN_URL} className="hp-btn hp-btn-lg hp-btn-ghost">
                <Wallet className="h-[18px] w-[18px]" />
                Explore dashboard
              </a>
            </div>

            <div className="hp-rise mt-12 border-t border-[var(--hp-line)] pt-6" style={{ animationDelay: '240ms' }}>
              <div className="flex flex-wrap items-center gap-x-10 gap-y-6">
                <div>
                  <p className="text-[13px] text-[var(--hp-mute)]">Settles on</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {chainChips.slice(0, 6).map((c) => (
                      <Logo key={c.name} {...c} />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[13px] text-[var(--hp-mute)]">Get paid in</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {assetChips.slice(0, 6).map((a) => (
                      <Logo key={a.name} {...a} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="hp-rise flex justify-center" style={{ animationDelay: '200ms' }}>
            <PaymentFlow />
          </div>
        </section>

        {/* 01 How it works */}
        <section id="how-it-works" className="hp-shell hp-section">
          <SectionHead index="01" title="From agreement to payout." />
          <div className="grid gap-5 lg:grid-cols-3">
            <Reveal scale className="h-full">
              <article className="hp-card flex h-full flex-col p-8">
                <p className="hp-kicker">Agree</p>
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
                <p className="hp-kicker">Lock</p>
                <p className="mt-4 text-[24px] font-semibold leading-tight tracking-[-0.03em]">Funds wait in escrow.</p>
                <p className="mt-3 text-[15px] leading-relaxed text-[var(--hp-dim)]">
                  The client deposits stablecoins into the contract. Committed, but nobody can move it alone.
                </p>
                <div className="mt-auto grid gap-3 pt-10 text-[13.5px]">
                  {[
                    ['Locked', '5,000 USDC'],
                    ['Can move it alone', 'Nobody'],
                  ].map(([k, v]) => (
                    <div key={k} className="hp-receipt-row">
                      <span className="text-[var(--hp-mute)]">{k}</span>
                      <span className="leader" />
                      <span>{v}</span>
                    </div>
                  ))}
                  <div className="hp-receipt-row">
                    <span className="text-[var(--hp-mute)]">Unlocks</span>
                    <span className="leader" />
                    <span className="inline-flex items-center gap-1.5 text-[var(--hp-accent)]">
                      <Lock className="h-3.5 w-3.5" />
                      On approval
                    </span>
                  </div>
                </div>
              </article>
            </Reveal>

            <Reveal scale delay={120} className="h-full">
              <article className="hp-card flex h-full flex-col p-8">
                <p className="hp-kicker">Release</p>
                <p className="mt-4 text-[24px] font-semibold leading-tight tracking-[-0.03em]">Paid on approval.</p>
                <p className="mt-3 text-[15px] leading-relaxed text-[var(--hp-dim)]">
                  Approve a deliverable or hit a milestone, and the contract pays the recipient directly.
                </p>
                <div className="mt-auto grid gap-3 pt-10 text-[13.5px]">
                  {[
                    ['Approved', 'Build milestone'],
                    ['Settled on', 'Base'],
                  ].map(([k, v]) => (
                    <div key={k} className="hp-receipt-row">
                      <span className="text-[var(--hp-mute)]">{k}</span>
                      <span className="leader" />
                      <span>{v}</span>
                    </div>
                  ))}
                  <div className="hp-receipt-row">
                    <span className="text-[var(--hp-mute)]">Paid to you</span>
                    <span className="leader" />
                    <span className="font-heading text-[16px] font-semibold tabular-nums text-[var(--hp-accent)]">2,500 USDC</span>
                  </div>
                </div>
              </article>
            </Reveal>
          </div>
        </section>

        {/* 02 Features: an open grid, no boxes, so the page can breathe */}
        <section id="features" className="hp-shell hp-section">
          <SectionHead index="02" title="Everything you need to get paid." />
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
          <SectionHead index="03" title="Built for both sides of the deal." />
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
          <SectionHead index="04" title="Before you trust us with a payment." />
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
