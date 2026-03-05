import { computeMarginRatio } from '../health';
import { PublicKey } from '@solana/web3.js';
import type { Account } from '@/lib/percolator';

function makeAccount(overrides: {
  positionSize: bigint;
  capital: bigint;
}): Account {
  return {
    owner: PublicKey.default,
    positionSize: overrides.positionSize,
    capital: overrides.capital,
    entryPrice: 0n,
    pnl: 0n,
    kind: 0,
    lastFundingSlot: 0n,
    cumulativeFundingAtEntry: 0n,
  } as Account;
}

describe('computeMarginRatio', () => {
  const decimals = 9;
  const markPriceE6 = 150_000_000n; // $150.00
  const maintenanceMarginBps = 500n; // 5%

  it('returns healthy for zero position', () => {
    const account = makeAccount({ positionSize: 0n, capital: 1_000_000_000n });
    const result = computeMarginRatio(account, markPriceE6, decimals, maintenanceMarginBps);
    expect(result).toEqual({
      marginRatioBps: 10000,
      riskLevel: 'healthy',
      liquidatable: false,
    });
  });

  it('returns healthy for zero mark price', () => {
    const account = makeAccount({ positionSize: 1_000_000_000n, capital: 1_000_000_000n });
    const result = computeMarginRatio(account, 0n, decimals, maintenanceMarginBps);
    expect(result).toEqual({
      marginRatioBps: 10000,
      riskLevel: 'healthy',
      liquidatable: false,
    });
  });

  it('classifies healthy account (margin >= 20%)', () => {
    // 10 SOL position, 10 SOL capital -> ~6666 bps (66.66%)
    const account = makeAccount({
      positionSize: 10_000_000_000n,
      capital: 10_000_000_000n,
    });
    const result = computeMarginRatio(account, markPriceE6, decimals, maintenanceMarginBps);
    expect(result.riskLevel).toBe('healthy');
    expect(result.liquidatable).toBe(false);
    expect(result.marginRatioBps).toBeGreaterThanOrEqual(2000);
  });

  it('classifies warning account (10-20%)', () => {
    // Target: 1500 bps (15%)
    // capital = 1500 * 10e9 * 150e6 / (10000 * 1e9) = 225_000_000
    const account = makeAccount({
      positionSize: 10_000_000_000n,
      capital: 225_000_000n,
    });
    const result = computeMarginRatio(account, markPriceE6, decimals, maintenanceMarginBps);
    expect(result.riskLevel).toBe('warning');
    expect(result.liquidatable).toBe(false);
  });

  it('classifies danger account (<10% but above maintenance)', () => {
    // Target: 800 bps (8%)
    // capital = 800 * 10e9 * 150e6 / (10000 * 1e9) = 120_000_000
    const account = makeAccount({
      positionSize: 10_000_000_000n,
      capital: 120_000_000n,
    });
    const result = computeMarginRatio(account, markPriceE6, decimals, maintenanceMarginBps);
    expect(result.riskLevel).toBe('danger');
    expect(result.liquidatable).toBe(false);
  });

  it('classifies liquidatable account (below maintenance margin)', () => {
    // Target: 300 bps (3%), below maintenance of 500 bps
    // capital = 300 * 10e9 * 150e6 / (10000 * 1e9) = 45_000_000
    const account = makeAccount({
      positionSize: 10_000_000_000n,
      capital: 45_000_000n,
    });
    const result = computeMarginRatio(account, markPriceE6, decimals, maintenanceMarginBps);
    expect(result.riskLevel).toBe('liquidatable');
    expect(result.liquidatable).toBe(true);
  });

  it('handles short positions (negative positionSize)', () => {
    const account = makeAccount({
      positionSize: -10_000_000_000n,
      capital: 10_000_000_000n,
    });
    const result = computeMarginRatio(account, markPriceE6, decimals, maintenanceMarginBps);
    // Same abs value, same result
    expect(result.riskLevel).toBe('healthy');
    expect(result.liquidatable).toBe(false);
  });

  it('uses maintenance margin to determine liquidatable flag', () => {
    // An account that is in the "danger" zone (marginRatio < 10%) with default 5% maintenance
    // should become liquidatable if we raise the maintenance margin above its margin ratio.
    // capital = 120_000_000 gives ~800 bps (8%) margin ratio.
    // With maintenanceMarginBps = 1000 (10%), this account becomes liquidatable.
    const highMaintenanceMarginBps = 1000n; // 10%
    const account = makeAccount({
      positionSize: 10_000_000_000n,
      capital: 120_000_000n,
    });
    const result = computeMarginRatio(account, markPriceE6, decimals, highMaintenanceMarginBps);
    expect(result.liquidatable).toBe(true);
    expect(result.riskLevel).toBe('liquidatable');
  });
});
