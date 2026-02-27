import { getDeviationSeverity, type Severity } from '@/lib/adminData';
import { Badge } from '@/components/ui/badge';
import { WarningCircle, CheckCircle, Warning } from '@phosphor-icons/react';

interface PriceDeviationGaugeProps {
  label: string;
  baseline: number;
  live: number | null;
  deviationPct: number | null;
  unit?: string;
}

const severityConfig: Record<Severity, { bg: string; text: string; Icon: typeof CheckCircle; label: string }> = {
  green: { bg: 'bg-green-500/20', text: 'text-green-400', Icon: CheckCircle, label: 'Safe' },
  yellow: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', Icon: Warning, label: 'Warning' },
  red: { bg: 'bg-red-500/20', text: 'text-red-400', Icon: WarningCircle, label: 'Critical' },
};

export function PriceDeviationGauge({ label, baseline, live, deviationPct, unit = '' }: PriceDeviationGaugeProps) {
  const severity = deviationPct !== null ? getDeviationSeverity(deviationPct) : 'green';
  const config = severityConfig[severity];

  return (
    <div className={`rounded-lg border p-3 ${config.bg} border-${severity === 'green' ? 'border' : severity === 'yellow' ? 'yellow-500/30' : 'red-500/30'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <Badge variant="outline" className={`${config.text} text-[10px] px-1.5 py-0`}>
          <config.Icon size={12} weight="fill" className="mr-0.5" />
          {config.label}
        </Badge>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Baseline:</span>
          <span className="font-mono">{Number(baseline).toFixed(4)} {unit}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Live:</span>
          <span className="font-mono">{live !== null ? `${live.toFixed(4)} ${unit}` : '—'}</span>
        </div>
        {deviationPct !== null && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Deviation:</span>
            <span className={`font-mono font-bold ${config.text}`}>
              {deviationPct >= 0 ? '+' : ''}{deviationPct.toFixed(2)}%
            </span>
          </div>
        )}
      </div>
      {/* Visual bar */}
      <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden relative">
        {/* Threshold markers at 5%, 8%, 10% */}
        <div className="absolute left-[50%] top-0 h-full w-px bg-yellow-500/50" />
        <div className="absolute left-[80%] top-0 h-full w-px bg-red-500/50" />
        {deviationPct !== null && (
          <div
            className={`absolute top-0 h-full rounded-full transition-all ${
              severity === 'green' ? 'bg-green-500' : severity === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{
              width: `${Math.min(Math.abs(deviationPct) * 10, 100)}%`,
              left: deviationPct >= 0 ? '50%' : undefined,
              right: deviationPct < 0 ? '50%' : undefined,
            }}
          />
        )}
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
        <span>-10%</span>
        <span>0%</span>
        <span>+10%</span>
      </div>
    </div>
  );
}
