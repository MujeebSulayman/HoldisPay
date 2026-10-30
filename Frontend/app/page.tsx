'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Check, ChevronDown } from 'lucide-react';
import { blockchainApi, type PublicChain, type PublicAsset } from '@/lib/api/blockchain';
import { LandingNav } from '@/components/landing/LandingNav';
import { ProductShot } from '@/components/landing/ProductShot';
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

// Each block pairs a real screen of the app with what it does. Screenshots live in /public/landing.
const SHOWCASE = [
  {
    kicker: 'Invoices',
    title: 'Send an invoice. Share one link.',
    body: 'Set the amount, the token, and the due date. Your client pays from any wallet, and you see the status the moment it changes.',
    points: ['Stablecoins or crypto', 'Shareable payment links', 'Status tracked in one place'],
    shot: { src: '/landing/invoice.png', alt: 'Creating an invoice in HoldisPay', url: 'app.holdispay.xyz/dashboard/invoices/create' },
  },
  {
    kicker: 'Escrow contracts',
    title: 'Money committed before work starts.',
    body: 'Clients fund a smart contract up front. Funds release per milestone, on a schedule, or split across a team, and nobody can move them alone.',
    points: ['Milestone, recurring, or one-off', 'Team splits by percent or amount', 'Non-custodial, enforced on-chain'],
    shot: { src: '/landing/contract.png', alt: 'An escrow contract with milestones in HoldisPay', url: 'app.holdispay.xyz/dashboard/contracts' },
  },
  {
    kicker: 'Withdrawals',
    title: 'Keep stablecoins, or cash out to your bank.',
    body: 'Hold USDC in your wallet, move it on-chain, or withdraw straight to a local bank account when you need cash.',
    points: ['Bank off-ramp', 'Multi-chain wallet', 'Full transaction history'],
    shot: { src: '/landing/withdraw.png', alt: 'Withdrawing funds in HoldisPay', url: 'app.holdispay.xyz/dashboard/withdraw' },
  },
];

const STEPS = [
  { title: 'Agree', body: 'Create an invoice or contract and share the link.' },
  { title: 'Fund', body: 'The client locks stablecoins in the escrow contract.' },
  { title: 'Release', body: 'Approve the work, and the contract pays out.' },
];

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

  const chainList = chains.length
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
        {/* Hero: the promise, then the product itself */}
        <section className="hp-shell pt-36 text-center sm:pt-44">
          <h1 className="hp-display hp-rise mx-auto max-w-[14ch] text-[clamp(42px,6.2vw,80px)]">
            Pay and get paid with confidence.
          </h1>
          <p
            className="hp-rise mx-auto mt-6 max-w-[48ch] text-[clamp(16px,1.4vw,19px)] leading-relaxed text-[var(--hp-dim)]"
            style={{ animationDelay: '80ms' }}
          >
            Invoices, escrow contracts, and payouts, settled on-chain. Your client&apos;s money is locked before you start, and
            released when the work is done.
          </p>
          <div className="hp-rise mt-9 flex flex-wrap justify-center gap-3" style={{ animationDelay: '160ms' }}>
            <a href={SIGNUP_URL} className="hp-btn hp-btn-lg hp-btn-white">
              Get started for free
              <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </a>
            <a href="#product" className="hp-btn hp-btn-lg hp-btn-ghost">
              See how it works
            </a>
          </div>
          <p className="hp-rise mt-5 text-[13px] text-[var(--hp-mute)]" style={{ animationDelay: '200ms' }}>
            No setup fees. Non-custodial.
          </p>

          <div className="hp-rise mx-auto mt-16 max-w-[1120px] sm:mt-20" style={{ animationDelay: '260ms' }}>
            <ProductShot src="/landing/dashboard.png" alt="The HoldisPay dashboard" url="app.holdispay.xyz/dashboard" priority />
          </div>
        </section>

        {/* Where it settles */}
        <section className="hp-shell pt-20 text-center">
          <p className="text-[13px] text-[var(--hp-mute)]">
            Settles on these networks, in {assetNames.join(', ')}
          </p>
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {chainList.map((c) => (
              <li key={c.name} className="flex items-center gap-2.5 text-[15px] font-medium text-[var(--hp-dim)]">
                {c.logoUrl && <img src={c.logoUrl} alt="" className="h-6 w-6 rounded-full object-contain" />}
                {c.name}
              </li>
            ))}
          </ul>
        </section>

        {/* Product: real screens, one idea each */}
        <section id="product" className="hp-shell scroll-mt-24 pt-32 sm:pt-44">
          <div className="grid gap-28 sm:gap-40">
            {SHOWCASE.map((s, i) => (
              <Reveal key={s.kicker}>
                <div className="grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
                  <div className={i % 2 ? 'lg:order-2' : ''}>
                    <p className="text-[14px] font-medium text-[var(--hp-accent)]">{s.kicker}</p>
                    <h2 className="hp-h2 mt-3 !text-[clamp(28px,3.2vw,40px)]">{s.title}</h2>
                    <p className="mt-5 max-w-[44ch] text-[16.5px] leading-relaxed text-[var(--hp-dim)]">{s.body}</p>
                    <ul className="mt-7 grid gap-3 text-[15px]">
                      {s.points.map((p) => (
                        <li key={p} className="flex items-center gap-3">
                          <Check className="h-4 w-4 shrink-0 text-[var(--hp-accent)]" strokeWidth={2.4} />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <ProductShot {...s.shot} />
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="hp-shell scroll-mt-24 pt-36 sm:pt-48">
          <Reveal>
            <h2 className="hp-h2 max-w-[18ch]">Three steps, and nobody has to trust anybody.</h2>
          </Reveal>
          <ol className="mt-14 grid gap-10 border-t border-[var(--hp-line)] pt-10 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 60}>
                <li className="list-none">
                  <span className="font-mono text-[13px] text-[var(--hp-mute)]">{i + 1}</span>
                  <p className="mt-3 font-heading text-[22px] font-semibold tracking-[-0.03em]">{s.title}</p>
                  <p className="mt-2 max-w-[30ch] text-[15.5px] leading-relaxed text-[var(--hp-dim)]">{s.body}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </section>

        {/* FAQ */}
        <section id="faq" className="hp-shell scroll-mt-24 pt-36 sm:pt-48">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <h2 className="hp-h2 !text-[clamp(28px,3.2vw,40px)]">Questions</h2>
            <div className="border-t border-[var(--hp-line)]">
              {FAQ_ITEMS.map(({ q, a }, i) => {
                const on = openFaq === i;
                return (
                  <div key={q} className="border-b border-[var(--hp-line)]">
                    <button
                      type="button"
                      className="flex w-full items-center gap-4 py-5 text-left"
                      onClick={() => setOpenFaq(on ? null : i)}
                      aria-expanded={on}
                    >
                      <span className="flex-1 text-[16.5px] font-medium">{q}</span>
                      <ChevronDown
                        className={`h-5 w-5 shrink-0 text-[var(--hp-mute)] transition-transform duration-300 ${on ? 'rotate-180' : ''}`}
                      />
                    </button>
                    <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: on ? '1fr' : '0fr' }}>
                      <div className="overflow-hidden">
                        <p className="max-w-[62ch] pb-6 pr-10 text-[15.5px] leading-relaxed text-[var(--hp-dim)]">{a}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Closing */}
        <section className="hp-shell pb-32 pt-36 text-center sm:pt-48">
          <h2 className="hp-display mx-auto max-w-[16ch] text-[clamp(34px,4.6vw,56px)]">Stop chasing payments.</h2>
          <p className="mx-auto mt-5 max-w-[40ch] text-[17px] leading-relaxed text-[var(--hp-dim)]">
            Create your first invoice today. It’s free to start.
          </p>
          <div className="mt-9 flex justify-center">
            <a href={SIGNUP_URL} className="hp-btn hp-btn-lg hp-btn-white">
              Get started for free
              <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </a>
          </div>
        </section>
      </main>

      <footer className="hp-shell pb-10">
        <div className="flex flex-col gap-4 border-t border-[var(--hp-line)] pt-6 text-[13px] text-[var(--hp-mute)] md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" className="h-6 w-6 rounded-md" />
            <span>© {new Date().getFullYear()} HoldisPay</span>
          </div>
          <div className="flex gap-5">
            <a href="#product" className="transition-colors hover:text-[var(--hp-fg)]">Product</a>
            <a href="#faq" className="transition-colors hover:text-[var(--hp-fg)]">FAQ</a>
            <a href={SIGNIN_URL} className="transition-colors hover:text-[var(--hp-fg)]">Sign in</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
