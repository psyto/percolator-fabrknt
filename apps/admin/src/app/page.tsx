'use client';

import { useState, useCallback } from 'react';
import { Header } from '@/components/header';
import { AdminGate, useIsAdmin } from '@/components/admin-gate';
import { CurrentParams } from '@/components/current-params';
import { ConfigSection } from '@/components/config-section';
import { RiskSection } from '@/components/risk-section';
import { OracleSection } from '@/components/oracle-section';
import { InsuranceSection } from '@/components/insurance-section';
import { LifecycleSection } from '@/components/lifecycle-section';
import { useMarket } from '@/hooks/use-market';
import { useAdminActions } from '@/hooks/use-admin-actions';
import { MARKETS } from '@/lib/solana/config';

type Tab = 'state' | 'config' | 'risk' | 'oracle' | 'insurance' | 'lifecycle';

export default function AdminPage() {
  const [marketKey, setMarketKey] = useState(() => {
    const keys = Object.keys(MARKETS);
    return keys[0] || 'SOL';
  });
  const [tab, setTab] = useState<Tab>('state');

  const marketConfig = MARKETS[marketKey];
  const { data: market, error } = useMarket(marketKey);
  const isAdmin = useIsAdmin(market);
  const actions = useAdminActions(marketKey, market);

  const handleUpdateConfig = useCallback(
    async (fields: Record<string, string>) => {
      return actions.updateConfig({
        fundingHorizonSlots: fields.fundingHorizonSlots,
        fundingKBps: fields.fundingKBps,
        fundingInvScaleNotionalE6: fields.fundingInvScaleNotionalE6,
        fundingMaxPremiumBps: fields.fundingMaxPremiumBps,
        fundingMaxBpsPerSlot: fields.fundingMaxBpsPerSlot,
        threshFloor: fields.threshFloor,
        threshRiskBps: fields.threshRiskBps,
        threshUpdateIntervalSlots: fields.threshUpdateIntervalSlots,
        threshStepBps: fields.threshStepBps,
        threshAlphaBps: fields.threshAlphaBps,
        threshMin: fields.threshMin,
        threshMax: fields.threshMax,
        threshMinStep: fields.threshMinStep,
      });
    },
    [actions]
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: 'state', label: 'Current State' },
    { key: 'config', label: 'Config' },
    { key: 'risk', label: 'Risk' },
    { key: 'oracle', label: 'Oracle' },
    { key: 'insurance', label: 'Insurance' },
    { key: 'lifecycle', label: 'Lifecycle' },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Header marketKey={marketKey} onMarketChange={setMarketKey} isAdmin={isAdmin} />

      {marketConfig ? (
        <AdminGate market={market}>
          <div className="flex-1 p-4 space-y-4">
            {error && (
              <div className="rounded-lg border border-trade-red/30 bg-trade-red/10 px-4 py-3 text-sm text-trade-red">
                Failed to fetch market: {String(error)}
              </div>
            )}

            {/* Tab bar */}
            <div className="flex flex-wrap gap-1 border-b border-border pb-1">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`rounded-t px-4 py-2 text-sm transition-colors ${
                    tab === t.key
                      ? 'bg-card text-accent border-b-2 border-accent'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {market && (
              <div className="max-w-3xl">
                {tab === 'state' && (
                  <CurrentParams market={market} marketConfig={marketConfig} />
                )}
                {tab === 'config' && (
                  <ConfigSection market={market} onSubmit={handleUpdateConfig} />
                )}
                {tab === 'risk' && (
                  <RiskSection
                    currentThreshold={market.params.riskReductionThreshold}
                    currentMaintenanceFee={market.params.maintenanceFeePerSlot}
                    onSetRiskThreshold={(t) => actions.setRiskThreshold({ newThreshold: t })}
                    onSetMaintenanceFee={(f) => actions.setMaintenanceFee({ newFee: f })}
                  />
                )}
                {tab === 'oracle' && (
                  <OracleSection
                    market={market}
                    onSetOracleAuthority={(a) =>
                      actions.setOracleAuthority({ newAuthority: a })
                    }
                    onPushOraclePrice={(p, t) =>
                      actions.pushOraclePrice({ priceE6: p, timestamp: t })
                    }
                    onSetOraclePriceCap={(c) =>
                      actions.setOraclePriceCap({ maxChangeE2bps: c })
                    }
                  />
                )}
                {tab === 'insurance' && (
                  <InsuranceSection
                    market={market}
                    marketConfig={marketConfig}
                    onTopUp={(a) => actions.topUpInsurance({ amount: a })}
                    onWithdraw={actions.withdrawInsurance}
                  />
                )}
                {tab === 'lifecycle' && (
                  <LifecycleSection
                    market={market}
                    onResolveMarket={actions.resolveMarket}
                    onUpdateAdmin={(a) => actions.updateAdmin({ newAdmin: a })}
                  />
                )}
              </div>
            )}
          </div>
        </AdminGate>
      ) : (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          No market configured.
        </div>
      )}
    </div>
  );
}
