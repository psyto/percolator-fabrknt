'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import type { MarketData } from '@/hooks/use-market';

interface AdminGateProps {
  market: MarketData | null | undefined;
  children: React.ReactNode;
}

export function AdminGate({ market, children }: AdminGateProps) {
  const { publicKey, connected } = useWallet();

  if (!connected) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <div className="text-lg font-bold text-foreground mb-2">Connect Wallet</div>
          <p className="text-sm text-muted-foreground">
            Connect your admin wallet to access the admin panel.
          </p>
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Loading market data...
      </div>
    );
  }

  const adminPubkey = market.header.admin.toBase58();
  const walletPubkey = publicKey?.toBase58();
  const isAdmin = walletPubkey === adminPubkey;

  if (!isAdmin) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="rounded-lg border border-trade-red/30 bg-trade-red/10 p-8 text-center max-w-md">
          <div className="text-lg font-bold text-trade-red mb-2">Access Denied</div>
          <p className="text-sm text-muted-foreground mb-4">
            Your wallet is not the market admin.
          </p>
          <div className="space-y-1 text-xs text-muted-foreground font-mono">
            <div>Your wallet: {walletPubkey?.slice(0, 16)}...</div>
            <div>Admin: {adminPubkey.slice(0, 16)}...</div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function useIsAdmin(market: MarketData | null | undefined): boolean {
  const { publicKey } = useWallet();
  if (!publicKey || !market) return false;
  return publicKey.toBase58() === market.header.admin.toBase58();
}
