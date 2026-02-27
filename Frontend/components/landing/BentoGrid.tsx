'use client';

import { motion } from 'framer-motion';

const BENTO_ITEMS = [
  {
    id: 'invoices',
    title: 'Invoices',
    subtitle: 'Create & send in one click',
    src: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&q=80',
    span: 'col-span-2 row-span-2',
    delay: 0,
  },
  {
    id: 'escrow',
    title: 'Escrow',
    subtitle: 'Funds held securely',
    src: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=600&q=80',
    span: 'col-span-1',
    delay: 0.05,
  },
  {
    id: 'contracts',
    title: 'Contracts',
    subtitle: 'Clear terms, clear pay',
    src: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&q=80',
    span: 'col-span-1 row-span-2',
    delay: 0.1,
  },
  {
    id: 'blockchain',
    title: 'On-chain',
    subtitle: 'Multi-chain payments',
    src: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=600&q=80',
    span: 'col-span-1',
    delay: 0.15,
  },
  {
    id: 'team',
    title: 'Teams & DAOs',
    subtitle: 'Collaborate with clarity',
    src: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80',
    span: 'col-span-2',
    delay: 0.2,
  },
  {
    id: 'secure',
    title: 'Secure',
    subtitle: 'Release when you approve',
    src: 'https://images.unsplash.com/photo-1614064548239-c4c2d0c44e5c?w=600&q=80',
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
          <img
            src={cell.src}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-5">
            <h3 className="text-lg sm:text-xl font-bold text-white">{cell.title}</h3>
            <p className="text-sm text-teal-300/90 mt-0.5">{cell.subtitle}</p>
          </div>
        </motion.article>
      ))}
    </div>
  );
}
