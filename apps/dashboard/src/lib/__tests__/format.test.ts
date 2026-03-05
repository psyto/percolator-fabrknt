import {
  formatPriceE6,
  formatUsdSecondary,
  formatFundingRate8h,
  formatNativeUnits,
} from '../format';

describe('formatPriceE6', () => {
  it('formats whole dollar amount', () => {
    expect(formatPriceE6(100_000_000n)).toBe('100.000000');
  });

  it('formats price with all 6 decimal places', () => {
    expect(formatPriceE6(123_456_789n)).toBe('123.456789');
  });

  it('formats zero', () => {
    expect(formatPriceE6(0n)).toBe('0.000000');
  });

  it('formats negative price', () => {
    expect(formatPriceE6(-50_000_000n)).toBe('-50.000000');
  });

  it('pads fractional part with leading zeros', () => {
    // 1_000_001 => whole=1, frac=1 => "1.000001"
    expect(formatPriceE6(1_000_001n)).toBe('1.000001');
  });
});

describe('formatUsdSecondary', () => {
  it('formats values >= $1M with M suffix', () => {
    expect(formatUsdSecondary(1_000_000)).toBe('~$1.00M');
    expect(formatUsdSecondary(5_250_000)).toBe('~$5.25M');
  });

  it('formats values >= $1K with commas', () => {
    expect(formatUsdSecondary(1000)).toBe('~$1,000');
    expect(formatUsdSecondary(999_999)).toBe('~$999,999');
  });

  it('formats values < $1K with 2 decimal places', () => {
    expect(formatUsdSecondary(0)).toBe('~$0.00');
    expect(formatUsdSecondary(0.5)).toBe('~$0.50');
    expect(formatUsdSecondary(999.99)).toBe('~$999.99');
  });

  it('handles non-finite inputs', () => {
    expect(formatUsdSecondary(Infinity)).toBe('');
    expect(formatUsdSecondary(-Infinity)).toBe('');
    expect(formatUsdSecondary(NaN)).toBe('');
  });

  it('handles negative values', () => {
    expect(formatUsdSecondary(-500)).toBe('~-$500.00');
    expect(formatUsdSecondary(-10_000)).toBe('~-$10,000');
    expect(formatUsdSecondary(-2_000_000)).toBe('~-$2.00M');
  });
});

describe('formatFundingRate8h', () => {
  it('formats rate with + for positive', () => {
    expect(formatFundingRate8h(1n)).toBe('+7.2000%');
  });

  it('formats rate with + for zero', () => {
    expect(formatFundingRate8h(0n)).toBe('+0.0000%');
  });

  it('formats rate with - for negative', () => {
    expect(formatFundingRate8h(-1n)).toBe('-7.2000%');
  });
});

describe('formatNativeUnits', () => {
  it('formats standard SOL amount', () => {
    expect(formatNativeUnits(2_500_000_000n, 9, 'SOL')).toBe('2.5 SOL');
  });

  it('formats zero', () => {
    expect(formatNativeUnits(0n, 9, 'SOL')).toBe('0.0 SOL');
  });

  it('formats sub-unit amount', () => {
    expect(formatNativeUnits(1n, 9, 'SOL')).toBe('0.000000001 SOL');
  });

  it('formats large amount', () => {
    expect(formatNativeUnits(1_000_000_000_000n, 9, 'SOL')).toBe('1000.0 SOL');
  });

  it('formats negative amount', () => {
    expect(formatNativeUnits(-1_000_000_000n, 9, 'SOL')).toBe('-1.0 SOL');
  });

  it('formats USDC (6 decimals)', () => {
    expect(formatNativeUnits(50_000_000n, 6, 'USDC')).toBe('50.0 USDC');
  });
});
