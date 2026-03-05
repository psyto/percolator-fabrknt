import type { Account } from '@/lib/percolator';

export type RiskLevel = 'healthy' | 'warning' | 'danger' | 'liquidatable';

export interface AccountHealth {
  marginRatioBps: number;
  riskLevel: RiskLevel;
  liquidatable: boolean;
}

/**
 * Compute margin ratio for an account.
 * marginRatio = capital / notionalPosition (in bps)
 * where notionalPosition = abs(positionSize) * markPriceE6 / 10^decimals
 */
export function computeMarginRatio(
  account: Account,
  markPriceE6: bigint,
  decimals: number,
  maintenanceMarginBps: bigint,
): AccountHealth {
  const absPos = account.positionSize < 0n ? -account.positionSize : account.positionSize;

  // No position = fully healthy
  if (absPos === 0n || markPriceE6 === 0n) {
    return { marginRatioBps: 10000, riskLevel: 'healthy', liquidatable: false };
  }

  // marginRatioBps = (capital * 10000 * 10^decimals) / (absPos * markPriceE6)
  const numerator = account.capital * 10000n * (10n ** BigInt(decimals));
  const denominator = absPos * markPriceE6;
  const marginRatioBps = denominator > 0n ? Number(numerator / denominator) : 10000;

  const liquidatable = marginRatioBps < Number(maintenanceMarginBps);

  let riskLevel: RiskLevel;
  if (liquidatable) {
    riskLevel = 'liquidatable';
  } else if (marginRatioBps < 1000) {
    // < 10%
    riskLevel = 'danger';
  } else if (marginRatioBps < 2000) {
    // < 20%
    riskLevel = 'warning';
  } else {
    riskLevel = 'healthy';
  }

  return { marginRatioBps, riskLevel, liquidatable };
}
