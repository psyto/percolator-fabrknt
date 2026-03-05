'use client';

import { useState, useCallback } from 'react';

interface RiskSectionProps {
  currentThreshold: bigint;
  currentMaintenanceFee: bigint;
  onSetRiskThreshold: (threshold: string) => Promise<string>;
  onSetMaintenanceFee: (fee: string) => Promise<string>;
}

export function RiskSection({
  currentThreshold,
  currentMaintenanceFee,
  onSetRiskThreshold,
  onSetMaintenanceFee,
}: RiskSectionProps) {
  const [threshold, setThreshold] = useState(currentThreshold.toString());
  const [maintenanceFee, setMaintenanceFee] = useState(currentMaintenanceFee.toString());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);

  const handleThreshold = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      const sig = await onSetRiskThreshold(threshold);
      setLastTx(sig);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [threshold, onSetRiskThreshold]);

  const handleFee = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      const sig = await onSetMaintenanceFee(maintenanceFee);
      setLastTx(sig);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [maintenanceFee, onSetMaintenanceFee]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-medium text-foreground mb-3">Set Risk Threshold</h3>
        <div className="mb-3">
          <label className="mb-1 block text-xs text-muted-foreground">New Threshold (u128)</label>
          <input
            type="text"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground font-mono outline-none focus:border-accent"
          />
        </div>
        <button
          onClick={handleThreshold}
          disabled={submitting}
          className="w-full rounded bg-accent py-2 text-sm font-medium text-white transition-colors hover:bg-accent/80 disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Set Risk Threshold'}
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-medium text-foreground mb-3">Set Maintenance Fee</h3>
        <div className="mb-3">
          <label className="mb-1 block text-xs text-muted-foreground">New Fee (u128)</label>
          <input
            type="text"
            value={maintenanceFee}
            onChange={(e) => setMaintenanceFee(e.target.value)}
            className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground font-mono outline-none focus:border-accent"
          />
        </div>
        <button
          onClick={handleFee}
          disabled={submitting}
          className="w-full rounded bg-accent py-2 text-sm font-medium text-white transition-colors hover:bg-accent/80 disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Set Maintenance Fee'}
        </button>
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
