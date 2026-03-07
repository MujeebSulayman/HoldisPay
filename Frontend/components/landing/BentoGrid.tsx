'use client';

import { motion } from 'framer-motion';
import { EthIcon, USDCIcon, WalletIcon, NetworkIcon } from './CryptoIcons';

const BENTO_ITEMS = [
  {
    id: 'invoices',
    title: 'Invoices',
    subtitle: 'Create & send in one click',
    type: 'image' as const,
    src: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&q=80',
    span: 'col-span-2 row-span-2',
    delay: 0,
  },
  {
    id: 'pay-with',
    title: 'Pay with',
    subtitle: 'ETH · stablecoins · more',
    type: 'icons' as const,
    span: 'col-span-1',
    delay: 0.05,
  },
  {
    id: 'contracts',
    title: 'Contracts',
    subtitle: 'Clear terms, clear pay',
    type: 'image' as const,
    src: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&q=80',
    span: 'col-span-1 row-span-2',
    delay: 0.1,
  },
  {
    id: 'wallet',
    title: 'Wallet-ready',
    subtitle: 'Connect & pay on-chain',
    type: 'icon' as const,
    icon: 'wallet',
    span: 'col-span-1',
    delay: 0.15,
  },
  {
    id: 'team',
    title: 'Teams & DAOs',
    subtitle: 'Collaborate with clarity',
    type: 'image' as const,
    src: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80',
    span: 'col-span-2',
    delay: 0.2,
  },
  {
    id: 'network',
    title: 'Multi-chain',
    subtitle: 'Ethereum & more',
    type: 'icon' as const,
    icon: 'network',
    span: 'col-span-1',
    delay: 0.25,
  },
];

export function BentoGrid() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 auto-rows-[minmax(160px,1fr)] max-w-5xl mx-auto">
      {BENTO_ITEMS.map((cell) => (
        <motion.article
          key={cell.id}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.4, delay: cell.delay }}
          whileHover={{ scale: 1.02 }}
          className={`relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/80 ${cell.span} min-h-[180px] sm:min-h-[200px]`}
        >
          {cell.type === 'image' && cell.src && (
            <>
              <img
                src={cell.src}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
            </>
          )}
          {cell.type === 'icons' && (
            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 via-zinc-900 to-indigo-500/10 flex items-center justify-center gap-4 p-4">
              <EthIcon className="w-12 h-12 sm:w-14 sm:h-14 drop-shadow-lg" />
              <USDCIcon className="w-12 h-12 sm:w-14 sm:h-14 drop-shadow-lg" />
              <WalletIcon className="w-10 h-10 sm:w-12 sm:h-12 text-teal-400" />
            </div>
          )}
          {cell.type === 'icon' && (
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/80 to-zinc-900 flex items-center justify-center">
              {cell.icon === 'wallet' && <WalletIcon className="w-16 h-16 sm:w-20 sm:h-20 text-teal-400" />}
              {cell.icon === 'network' && <NetworkIcon className="w-16 h-16 sm:w-20 sm:h-20 text-teal-400" />}
            </div>
          )}
          <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-5">
            <div className="relative z-10">
              <h3 className="text-lg sm:text-xl font-bold text-white">{cell.title}</h3>
              <p className="text-sm text-teal-300/90 mt-0.5">{cell.subtitle}</p>
            </div>
          </div>
          {cell.type === 'image' && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
          )}
          {cell.type === 'icons' && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
          )}
        </motion.article>
      ))}
    </div>
  );
}
