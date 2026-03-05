'use client';

import { useState, useCallback } from 'react';
import type { MarketData } from '@/hooks/use-market';

interface ConfigSectionProps {
  market: MarketData;
  onSubmit: (args: Record<string, string>) => Promise<string>;
}

export function ConfigSection({ market, onSubmit }: ConfigSectionProps) {
  const { config } = market;

  const [fields, setFields] = useState({
    fundingHorizonSlots: config.fundingHorizonSlots.toString(),
    fundingKBps: config.fundingKBps.toString(),
    fundingInvScaleNotionalE6: config.fundingInvScaleNotionalE6.toString(),
    fundingMaxPremiumBps: config.fundingMaxPremiumBps.toString(),
    fundingMaxBpsPerSlot: config.fundingMaxBpsPerSlot.toString(),
    threshFloor: config.threshFloor.toString(),
    threshRiskBps: config.threshRiskBps.toString(),
    threshUpdateIntervalSlots: config.threshUpdateIntervalSlots.toString(),
    threshStepBps: config.threshStepBps.toString(),
    threshAlphaBps: config.threshAlphaBps.toString(),
    threshMin: config.threshMin.toString(),
    threshMax: config.threshMax.toString(),
    threshMinStep: config.threshMinStep.toString(),
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    setLastTx(null);
    try {
      const sig = await onSubmit(fields);
      setLastTx(sig);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [fields, onSubmit]);

  const updateField = (key: string, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const fieldGroups = [
    {
      title: 'Funding Parameters',
      fields: [
        { key: 'fundingHorizonSlots', label: 'Horizon Slots' },
        { key: 'fundingKBps', label: 'K (bps)' },
        { key: 'fundingInvScaleNotionalE6', label: 'Inv Scale Notional E6' },
        { key: 'fundingMaxPremiumBps', label: 'Max Premium (bps)' },
        { key: 'fundingMaxBpsPerSlot', label: 'Max Bps/Slot' },
      ],
    },
    {
      title: 'Threshold Parameters',
      fields: [
        { key: 'threshFloor', label: 'Floor' },
        { key: 'threshRiskBps', label: 'Risk (bps)' },
        { key: 'threshUpdateIntervalSlots', label: 'Update Interval (slots)' },
        { key: 'threshStepBps', label: 'Step (bps)' },
        { key: 'threshAlphaBps', label: 'Alpha (bps)' },
        { key: 'threshMin', label: 'Min' },
        { key: 'threshMax', label: 'Max' },
        { key: 'threshMinStep', label: 'Min Step' },
      ],
    },
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-medium text-foreground mb-4">Update Config</h3>

      {fieldGroups.map((group) => (
        <div key={group.title} className="mb-4">
          <h4 className="text-xs text-muted-foreground mb-2">{group.title}</h4>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {group.fields.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs text-muted-foreground">{f.label}</label>
                <input
                  type="text"
                  value={fields[f.key as keyof typeof fields]}
                  onChange={(e) => updateField(f.key, e.target.value)}
                  className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground font-mono outline-none focus:border-accent"
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full rounded bg-accent py-2 text-sm font-medium text-white transition-colors hover:bg-accent/80 disabled:opacity-50"
      >
        {submitting ? 'Submitting...' : 'Update Config'}
      </button>

      {error && (
        <div className="mt-2 rounded bg-trade-red/10 px-3 py-2 text-xs text-trade-red">{error}</div>
      )}
      {lastTx && (
        <div className="mt-2 text-xs text-muted-foreground">
          Tx: <span className="font-mono text-accent">{lastTx.slice(0, 24)}...</span>
        </div>
      )}
    </div>
  );
}
