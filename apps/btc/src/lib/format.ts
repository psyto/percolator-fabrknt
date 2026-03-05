/**
 * BTC/sats formatting utilities.
 * BTC is the primary unit of account; USD is always secondary.
 */

const BTC_DECIMALS = 8;
const SATS_PER_BTC = 100_000_000n;

/**
 * Format a sats amount as BTC string.
 * e.g. 84219341n → "0.84219341 BTC"
 */
export function formatBtc(sats: bigint): string {
  const negative = sats < 0n;
  const abs = negative ? -sats : sats;
  const whole = abs / SATS_PER_BTC;
  const frac = abs % SATS_PER_BTC;
  const fracStr = frac.toString().padStart(BTC_DECIMALS, '0');
  const sign = negative ? '-' : '';
  return `${sign}${whole}.${fracStr} BTC`;
}

/**
 * Format a sats amount with commas.
 * e.g. 84219341n → "84,219,341 sats"
 */
export function formatSats(sats: bigint): string {
  const negative = sats < 0n;
  const abs = negative ? -sats : sats;
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = negative ? '-' : '';
  return `${sign}${formatted} sats`;
}

/**
 * Format a price in E6 format for display.
 * Prices in the slab are stored as price_e6 (price * 1_000_000).
 * e.g. 150_000_000n (= $150.00) → "150.000000"
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

/**
 * Format USD as secondary text.
 * e.g. 84219.50 → "~$84,219"
 */
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

/**
 * Convert sats to USD value given BTC/USD price.
 */
export function satsToUsd(sats: bigint, btcUsd: number): number {
  return (Number(sats) / Number(SATS_PER_BTC)) * btcUsd;
}

/**
 * Format a funding rate in bps per slot to 8h rate.
 * Solana slots ≈ 400ms, so 8h ≈ 72000 slots.
 */
export function formatFundingRate8h(bpsPerSlot: bigint): string {
  const SLOTS_PER_8H = 72000;
  const rate8h = (Number(bpsPerSlot) * SLOTS_PER_8H) / 10000;
  const sign = rate8h >= 0 ? '+' : '';
  return `${sign}${rate8h.toFixed(4)}%`;
}

/**
 * Format lamports (or native token units) with appropriate decimals.
 */
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
