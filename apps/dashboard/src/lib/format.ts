/**
 * Generic formatting utilities.
 */

export function formatPriceE6(priceE6: bigint): string {
  const negative = priceE6 < 0n;
  const abs = negative ? -priceE6 : priceE6;
  const whole = abs / 1_000_000n;
  const frac = abs % 1_000_000n;
  const fracStr = frac.toString().padStart(6, '0');
  const sign = negative ? '-' : '';
  return `${sign}${whole}.${fracStr}`;
}

export function formatUsdSecondary(usdValue: number): string {
  if (!isFinite(usdValue)) return '';
  const abs = Math.abs(usdValue);
  const sign = usdValue < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    return `~${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1000) {
    return `~${sign}$${Math.round(abs).toLocaleString()}`;
  }
  return `~${sign}$${abs.toFixed(2)}`;
}

export function formatFundingRate8h(bpsPerSlot: bigint): string {
  const SLOTS_PER_8H = 72000;
  const rate8h = (Number(bpsPerSlot) * SLOTS_PER_8H) / 10000;
  const sign = rate8h >= 0 ? '+' : '';
  return `${sign}${rate8h.toFixed(4)}%`;
}

export function formatNativeUnits(amount: bigint, decimals: number, symbol: string): string {
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const divisor = 10n ** BigInt(decimals);
  const whole = abs / divisor;
  const frac = abs % divisor;
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '') || '0';
  const sign = negative ? '-' : '';
  return `${sign}${whole}.${fracStr} ${symbol}`;
}
