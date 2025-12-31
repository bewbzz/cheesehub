import { Button } from '@/components/ui/button';
import { useWalletData } from '@/context/WalletDataContext';
import { RefreshCw } from 'lucide-react';

export interface AccountResources {
  ram_quota: number;
  ram_usage: number;
  cpu_limit: { used: number; max: number };
  net_limit: { used: number; max: number };
  core_liquid_balance?: string;
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
  const { accountData, isLoading, refetch } = useWalletData();

  // Convert to legacy format for onResourcesUpdate callback
  const resources: AccountResources | null = accountData ? {
    ram_quota: accountData.ramQuota,
    ram_usage: accountData.ramUsage,
    cpu_limit: accountData.cpuLimit,
    net_limit: accountData.netLimit,
    core_liquid_balance: `${accountData.liquidBalance.toFixed(8)} WAX`,
  } : null;

  // Call onResourcesUpdate when data changes
  if (onResourcesUpdate && resources) {
    onResourcesUpdate(resources);
  }

  const waxBalance = accountData?.liquidBalance ?? 0;
  const ramUsagePercent = accountData ? Math.round((accountData.ramUsage / accountData.ramQuota) * 100) : 0;
  const cpuPercent = accountData ? Math.min(100, Math.round((accountData.cpuLimit.used / accountData.cpuLimit.max) * 100)) : 0;
  const netPercent = accountData ? Math.min(100, Math.round((accountData.netLimit.used / accountData.netLimit.max) * 100)) : 0;

  return (
    <div className="space-y-4">
      {/* Account & Liquid Balance */}
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
        <div className="text-sm space-y-1">
          <div>
            <span className="text-muted-foreground">Account: </span>
            <span className="font-medium text-foreground">{accountData?.accountName}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Liquid: </span>
            <span className="font-medium text-cheese">{waxBalance.toFixed(8)} WAX</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={refetch}
          disabled={isLoading}
          className="h-8 w-8"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Resource Circles */}
      {accountData && (
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
            <div>{formatBytes(accountData.ramUsage)} / {formatBytes(accountData.ramQuota)}</div>
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
            <div>{formatCpu(accountData.cpuLimit.used)} / {formatCpu(accountData.cpuLimit.max)}</div>
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
            <div>{formatBytes(accountData.netLimit.used)} / {formatBytes(accountData.netLimit.max)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export { formatBytes, parseWaxBalance };
