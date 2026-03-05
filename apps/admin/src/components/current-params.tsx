'use client';

import type { MarketData } from '@/hooks/use-market';
import type { MarketConfig } from '@/lib/solana/config';
import { formatPriceE6, formatNativeUnits } from '@/lib/format';

interface CurrentParamsProps {
  market: MarketData;
  marketConfig: MarketConfig;
}

export function CurrentParams({ market, marketConfig }: CurrentParamsProps) {
  const { config, engine, params } = market;

  const sections = [
    {
      title: 'Market Config',
      items: [
        { label: 'Admin', value: market.header.admin.toBase58() },
        { label: 'Collateral Mint', value: config.collateralMint.toBase58() },
        { label: 'Vault', value: config.vaultPubkey.toBase58() },
        { label: 'Inverted', value: config.invert ? 'Yes' : 'No' },
        { label: 'Unit Scale', value: String(config.unitScale) },
        { label: 'Mark Price', value: `$${formatPriceE6(market.markPriceE6)}` },
        { label: 'Oracle Authority', value: config.oracleAuthority.toBase58() },
        { label: 'Authority Price E6', value: config.authorityPriceE6.toString() },
        { label: 'Oracle Price Cap (e2bps)', value: config.oraclePriceCapE2bps.toString() },
        { label: 'Resolved', value: market.header.resolved ? 'Yes' : 'No' },
      ],
    },
    {
      title: 'Funding Config',
      items: [
        { label: 'Horizon Slots', value: config.fundingHorizonSlots.toString() },
        { label: 'K (bps)', value: config.fundingKBps.toString() },
        { label: 'Inv Scale Notional E6', value: config.fundingInvScaleNotionalE6.toString() },
        { label: 'Max Premium (bps)', value: config.fundingMaxPremiumBps.toString() },
        { label: 'Max Bps/Slot', value: config.fundingMaxBpsPerSlot.toString() },
      ],
    },
    {
      title: 'Threshold Config',
      items: [
        { label: 'Floor', value: config.threshFloor.toString() },
        { label: 'Risk (bps)', value: config.threshRiskBps.toString() },
        { label: 'Update Interval', value: `${config.threshUpdateIntervalSlots} slots` },
        { label: 'Step (bps)', value: config.threshStepBps.toString() },
        { label: 'Alpha (bps)', value: config.threshAlphaBps.toString() },
        { label: 'Min', value: config.threshMin.toString() },
        { label: 'Max', value: config.threshMax.toString() },
        { label: 'Min Step', value: config.threshMinStep.toString() },
      ],
    },
    {
      title: 'Risk Parameters',
      items: [
        { label: 'Maintenance Margin', value: `${Number(params.maintenanceMarginBps)} bps` },
        { label: 'Initial Margin', value: `${Number(params.initialMarginBps)} bps` },
        { label: 'Trading Fee', value: `${Number(params.tradingFeeBps)} bps` },
        { label: 'Liquidation Fee', value: `${Number(params.liquidationFeeBps)} bps` },
        { label: 'Liquidation Buffer', value: `${Number(params.liquidationBufferBps)} bps` },
        { label: 'Liquidation Fee Cap', value: params.liquidationFeeCap.toString() },
        { label: 'Min Liquidation Abs', value: params.minLiquidationAbs.toString() },
        { label: 'Max Accounts', value: params.maxAccounts.toString() },
        { label: 'New Account Fee', value: formatNativeUnits(params.newAccountFee, marketConfig.decimals, marketConfig.symbol) },
        { label: 'Risk Reduction Threshold', value: params.riskReductionThreshold.toString() },
        { label: 'Maintenance Fee/Slot', value: params.maintenanceFeePerSlot.toString() },
        { label: 'Max Crank Staleness', value: `${params.maxCrankStalenessSlots} slots` },
        { label: 'Warmup Period', value: `${params.warmupPeriodSlots} slots` },
      ],
    },
    {
      title: 'Engine State',
      items: [
        { label: 'Vault Balance', value: formatNativeUnits(engine.vault, marketConfig.decimals, marketConfig.symbol) },
        { label: 'Insurance Balance', value: formatNativeUnits(engine.insuranceFund.balance, marketConfig.decimals, marketConfig.symbol) },
        { label: 'Insurance Fee Revenue', value: formatNativeUnits(engine.insuranceFund.feeRevenue, marketConfig.decimals, marketConfig.symbol) },
        { label: 'Total OI', value: formatNativeUnits(engine.totalOpenInterest, marketConfig.decimals, marketConfig.symbol) },
        { label: 'Used Accounts', value: String(engine.numUsedAccounts) },
        { label: 'Last Crank Slot', value: engine.lastCrankSlot.toString() },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section.title} className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-xs text-muted-foreground mb-3 font-medium">{section.title}</h3>
          <div className="space-y-1.5 text-sm">
            {section.items.map((item) => (
              <div key={item.label} className="flex justify-between gap-4">
                <span className="text-muted-foreground whitespace-nowrap">{item.label}</span>
                <span className="text-foreground font-mono text-xs text-right break-all">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
