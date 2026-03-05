'use client';

import dynamic from 'next/dynamic';
import { MARKETS } from '@/lib/solana/config';

const WalletMultiButton = dynamic(
  async () =>
    (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

interface HeaderProps {
  marketKey: string;
  onMarketChange: (key: string) => void;
}

export function Header({ marketKey, onMarketChange }: HeaderProps) {
  const marketKeys = Object.keys(MARKETS);

  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-accent text-lg font-bold tracking-tight">
          Percolator
        </span>
        <span className="text-muted-foreground text-sm">LP Manager</span>
      </div>

      <div className="flex items-center gap-1">
        {marketKeys.map((key) => (
          <button
            key={key}
            onClick={() => onMarketChange(key)}
            className={`rounded px-3 py-1 text-sm transition-colors ${
              marketKey === key
                ? 'bg-accent/20 text-accent'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {MARKETS[key].symbol}/USD
          </button>
        ))}
      </div>

      <WalletMultiButton
        style={{
          fontSize: '13px',
          height: '36px',
          borderRadius: '6px',
          backgroundColor: 'hsl(220 15% 14%)',
        }}
      />
    </header>
  );
}
