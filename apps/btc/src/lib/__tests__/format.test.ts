import {
  formatBtc,
  formatSats,
  formatPriceE6,
  formatUsdSecondary,
  satsToUsd,
  formatFundingRate8h,
  formatNativeUnits,
} from '../format';

describe('formatBtc', () => {
  it('formats whole BTC', () => {
    expect(formatBtc(100_000_000n)).toBe('1.00000000 BTC');
  });

  it('formats fractional BTC', () => {
    expect(formatBtc(84_219_341n)).toBe('0.84219341 BTC');
  });

  it('formats zero', () => {
    expect(formatBtc(0n)).toBe('0.00000000 BTC');
  });

  it('formats negative amounts', () => {
    expect(formatBtc(-50_000_000n)).toBe('-0.50000000 BTC');
  });

  it('formats large amounts', () => {
    expect(formatBtc(2_100_000_000_000_000n)).toBe('21000000.00000000 BTC');
  });

  it('formats small amounts (1 sat)', () => {
    expect(formatBtc(1n)).toBe('0.00000001 BTC');
  });
});

describe('formatSats', () => {
  it('formats with comma separators', () => {
    expect(formatSats(84_219_341n)).toBe('84,219,341 sats');
  });

  it('formats zero sats', () => {
    expect(formatSats(0n)).toBe('0 sats');
  });

  it('formats negative sats', () => {
    expect(formatSats(-1_000_000n)).toBe('-1,000,000 sats');
  });

  it('formats small amounts without commas', () => {
    expect(formatSats(999n)).toBe('999 sats');
  });

  it('formats 1000 with comma', () => {
    expect(formatSats(1000n)).toBe('1,000 sats');
  });
});

describe('formatPriceE6', () => {
  it('formats standard price', () => {
    expect(formatPriceE6(150_000_000n)).toBe('150.000000');
  });

  it('formats price with fractional part', () => {
    expect(formatPriceE6(68_432_123456n)).toBe('68432.123456');
  });

  it('formats zero', () => {
    expect(formatPriceE6(0n)).toBe('0.000000');
  });

  it('formats negative price', () => {
    expect(formatPriceE6(-100_500_000n)).toBe('-100.500000');
  });

  it('formats sub-dollar price', () => {
    expect(formatPriceE6(500_000n)).toBe('0.500000');
  });

  it('formats price with trailing zeros preserved', () => {
    expect(formatPriceE6(1_000_000n)).toBe('1.000000');
  });
});

describe('formatUsdSecondary', () => {
  it('formats millions', () => {
    expect(formatUsdSecondary(2_500_000)).toBe('~$2.50M');
  });

  it('formats thousands', () => {
    expect(formatUsdSecondary(84_219.5)).toBe('~$84,220');
  });

  it('formats small amounts', () => {
    expect(formatUsdSecondary(42.5)).toBe('~$42.50');
  });

  it('formats exact thousand boundary', () => {
    expect(formatUsdSecondary(1000)).toBe('~$1,000');
  });

  it('returns empty string for Infinity', () => {
    expect(formatUsdSecondary(Infinity)).toBe('');
  });

  it('returns empty string for NaN', () => {
    expect(formatUsdSecondary(NaN)).toBe('');
  });

  it('formats negative millions', () => {
    expect(formatUsdSecondary(-1_500_000)).toBe('~-$1.50M');
  });

  it('formats negative thousands', () => {
    expect(formatUsdSecondary(-5000)).toBe('~-$5,000');
  });

  it('formats negative small amounts', () => {
    expect(formatUsdSecondary(-9.99)).toBe('~-$9.99');
  });

  it('formats zero', () => {
    expect(formatUsdSecondary(0)).toBe('~$0.00');
  });
});

describe('satsToUsd', () => {
  it('converts 1 BTC at $100k', () => {
    expect(satsToUsd(100_000_000n, 100_000)).toBe(100_000);
  });

  it('converts 0.5 BTC at $68,000', () => {
    expect(satsToUsd(50_000_000n, 68_000)).toBe(34_000);
  });

  it('converts zero sats', () => {
    expect(satsToUsd(0n, 100_000)).toBe(0);
  });

  it('converts 1 sat at $100k', () => {
    const result = satsToUsd(1n, 100_000);
    expect(result).toBeCloseTo(0.001, 5);
  });
});

describe('formatFundingRate8h', () => {
  it('formats positive funding rate', () => {
    const result = formatFundingRate8h(1n);
    // 1 * 72000 / 10000 = 7.2
    expect(result).toBe('+7.2000%');
  });

  it('formats zero funding rate', () => {
    expect(formatFundingRate8h(0n)).toBe('+0.0000%');
  });

  it('formats negative funding rate', () => {
    const result = formatFundingRate8h(-1n);
    expect(result).toBe('-7.2000%');
  });
});

describe('formatNativeUnits', () => {
  it('formats SOL (9 decimals)', () => {
    expect(formatNativeUnits(1_500_000_000n, 9, 'SOL')).toBe('1.5 SOL');
  });

  it('formats BTC (8 decimals)', () => {
    expect(formatNativeUnits(100_000_000n, 8, 'BTC')).toBe('1.0 BTC');
  });

  it('formats USDC (6 decimals)', () => {
    expect(formatNativeUnits(1_000_000n, 6, 'USDC')).toBe('1.0 USDC');
  });

  it('formats zero', () => {
    expect(formatNativeUnits(0n, 9, 'SOL')).toBe('0.0 SOL');
  });

  it('formats negative amounts', () => {
    expect(formatNativeUnits(-500_000_000n, 9, 'SOL')).toBe('-0.5 SOL');
  });

  it('formats amounts with trailing zeros trimmed', () => {
    // 1_234_567_890 lamports = 1.23456789 SOL (no trailing zeros)
    expect(formatNativeUnits(1_234_567_890n, 9, 'SOL')).toBe('1.23456789 SOL');
  });

  it('formats sub-unit amounts', () => {
    expect(formatNativeUnits(1n, 9, 'SOL')).toBe('0.000000001 SOL');
  });
});
