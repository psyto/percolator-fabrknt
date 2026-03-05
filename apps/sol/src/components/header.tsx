'use client';

import dynamic from 'next/dynamic';

const WalletMultiButton = dynamic(
  async () =>
    (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-accent text-lg font-bold tracking-tight">
          Percolator
        </span>
        <span className="text-muted-foreground text-sm">SOL/USD</span>
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
