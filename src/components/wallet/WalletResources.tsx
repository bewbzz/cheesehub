import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useWax } from '@/context/WaxContext';
import { waxRpcCall } from '@/lib/waxRpcFallback';
import { RefreshCw } from 'lucide-react';

export interface AccountResources {
  ram_quota: number;
  ram_usage: number;
  cpu_limit: { used: number; max: number };
  net_limit: { used: number; max: number };
  core_liquid_balance?: string;
  cpu_weight?: string;
  net_weight?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatCpu(us: number): string {
  if (us < 1000) return `${us} µs`;
  if (us < 1000000) return `${(us / 1000).toFixed(2)} ms`;
  return `${(us / 1000000).toFixed(2)} s`;
}

function parseWaxBalance(balance: string | undefined): number {
  if (!balance) return 0;
  return parseFloat(balance.replace(' WAX', '')) || 0;
}

interface WalletResourcesProps {
  onResourcesUpdate?: (resources: AccountResources | null) => void;
}

export function WalletResources({ onResourcesUpdate }: WalletResourcesProps) {
  const { accountName } = useWax();
  const [resources, setResources] = useState<AccountResources | null>(null);
  const [ramPrice, setRamPrice] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRamPrice = async () => {
    try {
      const data = await waxRpcCall<{ rows: Array<{ quote: { balance: string }; base: { balance: string } }> }>(
        '/v1/chain/get_table_rows',
        {
          code: 'eosio',
          scope: 'eosio',
          table: 'rammarket',
          limit: 1,
          json: true,
        }
      );
      if (data.rows?.[0]) {
        const quoteBalance = parseFloat(data.rows[0].quote.balance.replace(' WAX', ''));
        const baseBalance = parseFloat(data.rows[0].base.balance.replace(' RAM', ''));
        // Price per KB of RAM
        const pricePerByte = quoteBalance / baseBalance;
        setRamPrice(pricePerByte);
      }
    } catch (error) {
      console.error('Failed to fetch RAM price:', error);
    }
  };

  const fetchResources = async () => {
    if (!accountName) return;
    setIsLoading(true);
    try {
      const data = await waxRpcCall<AccountResources & Record<string, unknown>>(
        '/v1/chain/get_account',
        { account_name: accountName }
      );
      const newResources = {
        ram_quota: data.ram_quota || 0,
        ram_usage: data.ram_usage || 0,
        cpu_limit: data.cpu_limit || { used: 0, max: 0 },
        net_limit: data.net_limit || { used: 0, max: 0 },
        core_liquid_balance: data.core_liquid_balance,
        cpu_weight: data.cpu_weight as string | undefined,
        net_weight: data.net_weight as string | undefined,
      };
      setResources(newResources);
      onResourcesUpdate?.(newResources);
    } catch (error) {
      console.error('Failed to fetch resources:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (accountName) {
      fetchResources();
      fetchRamPrice();
    }
  }, [accountName]);

  const waxBalance = parseWaxBalance(resources?.core_liquid_balance);
  const ramUsagePercent = resources ? Math.round((resources.ram_usage / resources.ram_quota) * 100) : 0;
  const cpuPercent = resources ? Math.min(100, Math.round((resources.cpu_limit.used / resources.cpu_limit.max) * 100)) : 0;
  const netPercent = resources ? Math.min(100, Math.round((resources.net_limit.used / resources.net_limit.max) * 100)) : 0;

  // Calculate WAX values
  const ramWaxValue = resources && ramPrice ? (resources.ram_quota * ramPrice) : null;
  // cpu_weight and net_weight can be strings like "10.0000 WAX" or raw numbers (divide by 10^8)
  const parseStakedWeight = (weight: string | number | undefined): number => {
    if (!weight) return 0;
    if (typeof weight === 'string') {
      if (weight.includes(' WAX')) {
        return parseFloat(weight.replace(' WAX', ''));
      }
      // Raw number as string - divide by 10^8
      return Number(weight) / 100000000;
    }
    return Number(weight) / 100000000;
  };
  const cpuStaked = parseStakedWeight(resources?.cpu_weight);
  const netStaked = parseStakedWeight(resources?.net_weight);

  return (
    <div className="space-y-4">
      {/* Account & Liquid Balance */}
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
        <div className="text-sm space-y-1">
          <div>
            <span className="text-muted-foreground">Account: </span>
            <span className="font-medium text-foreground">{accountName}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Liquid: </span>
            <span className="font-medium text-cheese">{waxBalance.toFixed(8)} WAX</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={fetchResources}
          disabled={isLoading}
          className="h-8 w-8"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Resource Circles */}
      {resources && (
        <div className="grid grid-cols-3 gap-3 text-center text-xs">
          <div className="space-y-1">
            <div className="relative w-12 h-12 mx-auto">
              <svg className="w-12 h-12 transform -rotate-90">
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-muted"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeDasharray={`${ramUsagePercent * 1.26} 126`}
                  className="text-cheese"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-medium">
                {ramUsagePercent}%
              </span>
            </div>
            <div className="text-muted-foreground">RAM</div>
            <div>{formatBytes(resources.ram_usage)} / {formatBytes(resources.ram_quota)}</div>
            <div className="text-cheese text-[10px]">
              {ramWaxValue !== null ? `${ramWaxValue.toFixed(4)} WAX` : '...'}
            </div>
          </div>
          <div className="space-y-1">
            <div className="relative w-12 h-12 mx-auto">
              <svg className="w-12 h-12 transform -rotate-90">
                <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted" />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeDasharray={`${cpuPercent * 1.26} 126`}
                  className="text-green-500"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-medium text-xs">
                {cpuPercent}%
              </span>
            </div>
            <div className="text-muted-foreground">CPU</div>
            <div>{formatCpu(resources.cpu_limit.used)} / {formatCpu(resources.cpu_limit.max)}</div>
            <div className="text-green-500 text-[10px]">
              {cpuStaked.toFixed(4)} WAX staked
            </div>
          </div>
          <div className="space-y-1">
            <div className="relative w-12 h-12 mx-auto">
              <svg className="w-12 h-12 transform -rotate-90">
                <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted" />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeDasharray={`${netPercent * 1.26} 126`}
                  className="text-blue-500"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-medium text-xs">
                {netPercent}%
              </span>
            </div>
            <div className="text-muted-foreground">NET</div>
            <div>{formatBytes(resources.net_limit.used)} / {formatBytes(resources.net_limit.max)}</div>
            <div className="text-blue-500 text-[10px]">
              {netStaked.toFixed(4)} WAX staked
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { formatBytes, parseWaxBalance };
