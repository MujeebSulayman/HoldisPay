'use client';

export function EthIcon({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2v8.5l7.5-4.25L12 2z" fill="#8B9BD7" />
      <path d="M12 10.5l7.5 4.25L12 22V10.5z" fill="#627EEA" />
      <path d="M12 10.5L4.5 14.75 12 22V10.5z" fill="#303F80" />
      <path d="M12 2L4.5 14.75 12 10.5V2z" fill="#627EEA" fillOpacity="0.7" />
    </svg>
  );
}

export function USDCIcon({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="11" fill="#2775CA" />
      <text x="12" y="15.5" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold" fontFamily="system-ui, sans-serif">USDC</text>
    </svg>
  );
}

export function WalletIcon({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 9h20" />
      <path d="M16 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" fill="currentColor" />
    </svg>
  );
}

export function NetworkIcon({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="19" cy="19" r="2" />
      <path d="M12 7v4l4 6M12 7l-4 6" />
      <path d="M12 11l-4 6" />
    </svg>
  );
}
