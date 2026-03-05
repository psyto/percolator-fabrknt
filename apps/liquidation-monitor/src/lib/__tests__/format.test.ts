import {
  formatPriceE6,
  formatUsdSecondary,
  formatFundingRate8h,
  formatNativeUnits,
} from '../format';

describe('formatPriceE6', () => {
  it('formats standard price', () => {
    expect(formatPriceE6(150_000_000n)).toBe('150.000000');
  });

  it('formats sub-dollar price', () => {
    expect(formatPriceE6(500_000n)).toBe('0.500000');
  });

  it('formats zero', () => {
    expect(formatPriceE6(0n)).toBe('0.000000');
  });

  it('formats negative price', () => {
    expect(formatPriceE6(-100_500_000n)).toBe('-100.500000');
  });

  it('formats large price', () => {
    expect(formatPriceE6(100_000_000_000n)).toBe('100000.000000');
  });
});

describe('formatUsdSecondary', () => {
  it('formats millions', () => {
    expect(formatUsdSecondary(2_500_000)).toBe('~$2.50M');
  });

  it('formats thousands', () => {
    expect(formatUsdSecondary(50_000)).toBe('~$50,000');
  });

  it('formats small amounts with two decimals', () => {
    expect(formatUsdSecondary(42.5)).toBe('~$42.50');
  });

  it('returns empty string for non-finite values', () => {
    expect(formatUsdSecondary(Infinity)).toBe('');
    expect(formatUsdSecondary(-Infinity)).toBe('');
    expect(formatUsdSecondary(NaN)).toBe('');
  });

  it('formats negative values', () => {
    expect(formatUsdSecondary(-2_500_000)).toBe('~-$2.50M');
    expect(formatUsdSecondary(-5000)).toBe('~-$5,000');
    expect(formatUsdSecondary(-9.99)).toBe('~-$9.99');
  });
});

describe('formatFundingRate8h', () => {
  it('formats positive rate with + sign', () => {
    expect(formatFundingRate8h(1n)).toBe('+7.2000%');
  });

  it('formats zero rate with + sign', () => {
    expect(formatFundingRate8h(0n)).toBe('+0.0000%');
  });

  it('formats negative rate with - sign', () => {
    expect(formatFundingRate8h(-1n)).toBe('-7.2000%');
  });

  it('formats fractional slot rates correctly', () => {
    // 2 bps per slot * 72000 slots / 10000 = 14.4%
    expect(formatFundingRate8h(2n)).toBe('+14.4000%');
  });
});

describe('formatNativeUnits', () => {
  it('formats SOL amounts (9 decimals)', () => {
    expect(formatNativeUnits(1_500_000_000n, 9, 'SOL')).toBe('1.5 SOL');
  });

  it('formats whole units', () => {
    expect(formatNativeUnits(1_000_000_000n, 9, 'SOL')).toBe('1.0 SOL');
  });

  it('formats zero', () => {
    expect(formatNativeUnits(0n, 9, 'SOL')).toBe('0.0 SOL');
  });

  it('formats negative amounts', () => {
    expect(formatNativeUnits(-2_000_000_000n, 9, 'SOL')).toBe('-2.0 SOL');
  });

  it('strips trailing zeros from fractional part', () => {
    expect(formatNativeUnits(1_230_000_000n, 9, 'SOL')).toBe('1.23 SOL');
  });

  it('preserves significant digits', () => {
    expect(formatNativeUnits(1_234_567_890n, 9, 'SOL')).toBe('1.23456789 SOL');
  });

  it('formats with different decimal counts', () => {
    expect(formatNativeUnits(1_000_000n, 6, 'USDC')).toBe('1.0 USDC');
  });
});
