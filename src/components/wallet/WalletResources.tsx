import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useWax } from '@/context/WaxContext';
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
  const [isLoading, setIsLoading] = useState(false);

  const fetchResources = async () => {
    if (!accountName) return;
    setIsLoading(true);
    try {
      const response = await fetch('https://wax.eosphere.io/v1/chain/get_account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_name: accountName }),
      });
      const data = await response.json();
      const newResources = {
        ram_quota: data.ram_quota || 0,
        ram_usage: data.ram_usage || 0,
        cpu_limit: data.cpu_limit || { used: 0, max: 0 },
        net_limit: data.net_limit || { used: 0, max: 0 },
        core_liquid_balance: data.core_liquid_balance,
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
    }
  }, [accountName]);

  const waxBalance = parseWaxBalance(resources?.core_liquid_balance);
  const ramUsagePercent = resources ? Math.round((resources.ram_usage / resources.ram_quota) * 100) : 0;
  const cpuPercent = resources ? Math.min(100, Math.round((resources.cpu_limit.used / resources.cpu_limit.max) * 100)) : 0;
  const netPercent = resources ? Math.min(100, Math.round((resources.net_limit.used / resources.net_limit.max) * 100)) : 0;

  return (
    <div className="space-y-4">
      {/* Liquid Balance */}
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
        <div className="text-sm">
          <span className="text-muted-foreground">Liquid: </span>
          <span className="font-medium text-cheese">{waxBalance.toFixed(8)} WAX</span>
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
          </div>
        </div>
      )}
    </div>
  );
}

export { formatBytes, parseWaxBalance };
