import { Layout } from '@/components/Layout';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { useContractConfigs } from '@/hooks/useContractConfigs';
import { useFailedTransactions } from '@/hooks/useFailedTransactions';
import { ContractStatusCard } from '@/components/admin/ContractStatusCard';
import { PriceDeviationGauge } from '@/components/admin/PriceDeviationGauge';
import { FailedTransactionLog } from '@/components/admin/FailedTransactionLog';
import { parseAssetAmount, getDeviationSeverity } from '@/lib/adminData';
import { Flame, CurrencyCircleDollar, Megaphone, Lightning, ShieldCheck, ArrowsClockwise } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function Admin() {
  const { isWhitelisted, isLoading: accessLoading, isConnected } = useAdminAccess();
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data, isLoading: configsLoading } = useContractConfigs(isWhitelisted && autoRefresh);
  const { data: failedTxs, isLoading: txsLoading } = useFailedTransactions(isWhitelisted);

  // Access gate
  if (accessLoading) {
    return (
      <Layout>
        <section className="py-12 px-4">
          <div className="max-w-5xl mx-auto text-center">
            <Skeleton className="h-8 w-48 mx-auto mb-4" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </div>
        </section>
      </Layout>
    );
  }

  if (!isConnected || !isWhitelisted) {
    return (
      <Layout>
        <section className="py-24 px-4">
          <div className="max-w-md mx-auto text-center space-y-4">
            <ShieldCheck size={48} weight="duotone" className="mx-auto text-muted-foreground" />
            <h1 className="text-xl font-semibold">Not Authorized</h1>
            <p className="text-muted-foreground text-sm">
              {!isConnected
                ? 'Connect your wallet to access this page.'
                : 'Your account is not whitelisted for admin access.'}
            </p>
          </div>
        </section>
      </Layout>
    );
  }

  // Derive overall statuses
  const burnerDisabled = data?.burnerConfig && !data.burnerConfig.enabled;
  const cheeseWaxSeverity = data?.deviations.cheeseWax !== null
    ? getDeviationSeverity(data.deviations.cheeseWax!)
    : 'green';
  const waxdaoWaxSeverity = data?.deviations.waxdaoWax !== null
    ? getDeviationSeverity(data.deviations.waxdaoWax!)
    : 'green';
  const feefeeStatus = cheeseWaxSeverity === 'red' || waxdaoWaxSeverity === 'red'
    ? 'critical' : cheeseWaxSeverity === 'yellow' || waxdaoWaxSeverity === 'yellow'
    ? 'warn' : 'ok';
  const bannadSeverity = data?.deviations.bannadCheese !== null
    ? getDeviationSeverity(data.deviations.bannadCheese!)
    : 'green';

  return (
    <Layout>
      <section className="py-8 px-4">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <ShieldCheck size={28} weight="duotone" className="text-cheese" />
                CHEESE Contract Monitor
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Admin-only dashboard • Live on-chain data</p>
            </div>
            <div className="flex items-center gap-2">
              <ArrowsClockwise size={16} className={autoRefresh ? 'text-green-400 animate-spin' : 'text-muted-foreground'} style={{ animationDuration: '3s' }} />
              <Label htmlFor="auto-refresh" className="text-xs">Auto-refresh</Label>
              <Switch id="auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            </div>
          </div>

          {configsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-64" />)}
            </div>
          ) : data ? (
            <>
              {/* Contract Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* cheeseburner */}
                <ContractStatusCard
                  title="cheeseburner"
                  icon={<Flame size={20} weight="bold" className="text-destructive" />}
                  status={burnerDisabled ? 'critical' : 'ok'}
                  rows={[
                    {
                      label: 'Status',
                      value: data.burnerConfig?.enabled
                        ? <Badge className="bg-green-500/20 text-green-400">Enabled</Badge>
                        : <Badge className="bg-red-500/20 text-red-400">Disabled</Badge>,
                      critical: !data.burnerConfig?.enabled,
                    },
                    { label: 'Min WAX to Burn', value: data.burnerConfig?.min_wax_to_burn ?? '—' },
                    { label: 'Pool ID', value: data.burnerConfig?.alcor_pool_id ?? '—' },
                    { label: 'Admin', value: data.burnerConfig?.admin ?? '—' },
                    { label: 'Total Burns', value: data.burnerStats?.total_burns?.toLocaleString() ?? '—' },
                    { label: 'WAX Claimed', value: data.burnerStats?.total_wax_claimed ?? '—' },
                    { label: 'CHEESE Burned', value: data.burnerStats?.total_cheese_burned ?? '—' },
                  ]}
                />

                {/* cheesefeefee */}
                <ContractStatusCard
                  title="cheesefeefee"
                  icon={<CurrencyCircleDollar size={20} weight="bold" className="text-cheese" />}
                  status={feefeeStatus as 'ok' | 'warn' | 'critical'}
                  rows={[
                    { label: 'Max Deviation', value: '10% (hardcoded)' },
                  ]}
                >
                  <div className="space-y-3 mt-3">
                    <PriceDeviationGauge
                      label="CHEESE/WAX (Pool 1252)"
                      baseline={data.feefeeConfig?.wax_per_cheese_baseline ?? 0}
                      live={data.poolPrices.pool1252?.waxPerCheese ?? null}
                      deviationPct={data.deviations.cheeseWax}
                      unit="WAX"
                    />
                    <PriceDeviationGauge
                      label="WAXDAO/WAX (Pool 1236)"
                      baseline={data.feefeeConfig?.waxdao_per_wax_baseline ?? 0}
                      live={data.poolPrices.pool1236?.waxdaoPerWax ?? null}
                      deviationPct={data.deviations.waxdaoWax}
                      unit="WAXDAO"
                    />
                  </div>
                </ContractStatusCard>

                {/* cheesebannad */}
                <ContractStatusCard
                  title="cheesebannad"
                  icon={<Megaphone size={20} weight="bold" className="text-accent" />}
                  status={bannadSeverity === 'red' ? 'critical' : bannadSeverity === 'yellow' ? 'warn' : 'ok'}
                  rows={[
                    { label: 'Price/Day', value: data.bannadConfig?.wax_price_per_day ?? '—' },
                    { label: 'WAX/CHEESE Baseline', value: data.bannadConfig?.wax_per_cheese_baseline?.toFixed(4) ?? '—' },
                    { label: 'Live WAX/CHEESE', value: data.poolPrices.pool1252?.waxPerCheese?.toFixed(4) ?? '—' },
                    {
                      label: 'Baseline Drift',
                      value: data.deviations.bannadCheese !== null
                        ? `${data.deviations.bannadCheese >= 0 ? '+' : ''}${data.deviations.bannadCheese.toFixed(2)}%`
                        : '—',
                      warn: bannadSeverity === 'yellow',
                      critical: bannadSeverity === 'red',
                    },
                    { label: 'Admins', value: data.bannadAdmins.length },
                  ]}
                >
                  {data.bannadAdmins.length > 0 && (
                    <div className="mt-2">
                      <span className="text-xs text-muted-foreground">Admin accounts: </span>
                      <span className="text-xs font-mono">
                        {data.bannadAdmins.map(a => a.account).join(', ')}
                      </span>
                    </div>
                  )}
                </ContractStatusCard>

                {/* cheesepowerz */}
                <ContractStatusCard
                  title="cheesepowerz"
                  icon={<Lightning size={20} weight="bold" className="text-yellow-400" />}
                  status="ok"
                  rows={[
                    { label: 'Total Powerups', value: data.powerzStats?.total_powerups?.toLocaleString() ?? '—' },
                    { label: 'WAX Spent', value: data.powerzStats?.total_wax_spent ?? '—' },
                    { label: 'CHEESE Received', value: data.powerzStats?.total_cheese_received ?? '—' },
                  ]}
                />
              </div>

              {/* Live Market Prices Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg border bg-card p-3 text-center">
                  <p className="text-xs text-muted-foreground">WAX per CHEESE</p>
                  <p className="text-lg font-mono font-bold">{data.poolPrices.pool1252?.waxPerCheese?.toFixed(4) ?? '—'}</p>
                </div>
                <div className="rounded-lg border bg-card p-3 text-center">
                  <p className="text-xs text-muted-foreground">CHEESE per WAX</p>
                  <p className="text-lg font-mono font-bold">{data.poolPrices.pool1252?.cheesePerWax?.toFixed(2) ?? '—'}</p>
                </div>
                <div className="rounded-lg border bg-card p-3 text-center">
                  <p className="text-xs text-muted-foreground">WAXDAO per WAX</p>
                  <p className="text-lg font-mono font-bold">{data.poolPrices.pool1236?.waxdaoPerWax?.toFixed(2) ?? '—'}</p>
                </div>
                <div className="rounded-lg border bg-card p-3 text-center">
                  <p className="text-xs text-muted-foreground">WAX per WAXDAO</p>
                  <p className="text-lg font-mono font-bold">{data.poolPrices.pool1236?.waxPerWaxdao?.toFixed(6) ?? '—'}</p>
                </div>
              </div>

              {/* Failed Transactions */}
              <FailedTransactionLog transactions={failedTxs ?? []} isLoading={txsLoading} />
            </>
          ) : null}
        </div>
      </section>
    </Layout>
  );
}
