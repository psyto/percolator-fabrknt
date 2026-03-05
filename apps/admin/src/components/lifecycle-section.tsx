'use client';

import { useState, useCallback } from 'react';
import type { MarketData } from '@/hooks/use-market';

interface LifecycleSectionProps {
  market: MarketData;
  onResolveMarket: () => Promise<string>;
  onUpdateAdmin: (newAdmin: string) => Promise<string>;
}

export function LifecycleSection({ market, onResolveMarket, onUpdateAdmin }: LifecycleSectionProps) {
  const [newAdmin, setNewAdmin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [confirmResolve, setConfirmResolve] = useState(false);
  const [confirmAdmin, setConfirmAdmin] = useState(false);

  const handle = useCallback(async (fn: () => Promise<string>) => {
    setSubmitting(true);
    setError(null);
    setLastTx(null);
    try {
      const sig = await fn();
      setLastTx(sig);
      setConfirmResolve(false);
      setConfirmAdmin(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, []);

  return (
    <div className="space-y-4">
      {/* Resolve Market */}
      <div className="rounded-lg border border-trade-red/30 bg-card p-4">
        <h3 className="text-sm font-medium text-trade-red mb-3">Resolve Market</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Sets the RESOLVED flag. All positions will be force-closed via crank at the authority price.
          This is irreversible. Requires authority price to be set first.
        </p>
        <div className="text-xs text-muted-foreground mb-3">
          Status: {market.header.resolved ? (
            <span className="text-trade-red font-medium">RESOLVED</span>
          ) : (
            <span className="text-trade-green font-medium">ACTIVE</span>
          )}
        </div>

        {!confirmResolve ? (
          <button
            onClick={() => setConfirmResolve(true)}
            disabled={submitting || market.header.resolved}
            className="w-full rounded border border-trade-red py-2 text-sm text-trade-red transition-colors hover:bg-trade-red/10 disabled:opacity-50"
          >
            {market.header.resolved ? 'Already Resolved' : 'Resolve Market...'}
          </button>
        ) : (
          <div className="space-y-2">
            <div className="rounded bg-trade-red/10 px-3 py-2 text-xs text-trade-red">
              Are you sure? This action is irreversible.
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handle(onResolveMarket)}
                disabled={submitting}
                className="flex-1 rounded bg-trade-red py-2 text-sm font-medium text-white"
              >
                Confirm Resolve
              </button>
              <button
                onClick={() => setConfirmResolve(false)}
                className="flex-1 rounded border border-border py-2 text-sm text-muted-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Update Admin */}
      <div className="rounded-lg border border-trade-red/30 bg-card p-4">
        <h3 className="text-sm font-medium text-trade-red mb-3">Update Admin</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Transfer admin authority to a new wallet. This is irreversible.
        </p>
        <div className="mb-3">
          <label className="mb-1 block text-xs text-muted-foreground">New Admin Pubkey</label>
          <input
            type="text"
            value={newAdmin}
            onChange={(e) => setNewAdmin(e.target.value)}
            placeholder="Enter new admin public key"
            className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground font-mono outline-none focus:border-accent placeholder-muted-foreground"
          />
        </div>

        {!confirmAdmin ? (
          <button
            onClick={() => setConfirmAdmin(true)}
            disabled={submitting || !newAdmin}
            className="w-full rounded border border-trade-red py-2 text-sm text-trade-red transition-colors hover:bg-trade-red/10 disabled:opacity-50"
          >
            Update Admin...
          </button>
        ) : (
          <div className="space-y-2">
            <div className="rounded bg-trade-red/10 px-3 py-2 text-xs text-trade-red">
              Are you sure? You will lose admin access.
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handle(() => onUpdateAdmin(newAdmin))}
                disabled={submitting}
                className="flex-1 rounded bg-trade-red py-2 text-sm font-medium text-white"
              >
                Confirm Transfer
              </button>
              <button
                onClick={() => setConfirmAdmin(false)}
                className="flex-1 rounded border border-border py-2 text-sm text-muted-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded bg-trade-red/10 px-3 py-2 text-xs text-trade-red">{error}</div>
      )}
      {lastTx && (
        <div className="text-xs text-muted-foreground">
          Tx: <span className="font-mono text-accent">{lastTx.slice(0, 24)}...</span>
        </div>
      )}
    </div>
  );
}
