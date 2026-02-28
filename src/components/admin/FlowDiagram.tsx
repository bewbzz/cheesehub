import { cn } from '@/lib/utils';

export interface FlowStep {
  label: string;
  items: { pct: string; dest: string; highlight?: 'burn' | 'liq' | 'power' | 'stake' | 'swap' | 'fee' | 'neutral' }[];
}

const highlightClasses: Record<string, string> = {
  burn: 'bg-red-500/20 text-red-300 border-red-500/30',
  liq: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  power: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  stake: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  swap: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  fee: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  neutral: 'bg-muted text-muted-foreground border-border',
};

export function FlowDiagram({ steps }: { steps: FlowStep[] }) {
  return (
    <div className="space-y-3">
      {steps.map((step, si) => (
        <div key={si}>
          {/* Source label */}
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-md border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-300">
              {step.label}
            </div>
          </div>
          {/* Arrow */}
          <div className="ml-5 h-4 border-l-2 border-dashed border-muted-foreground/40" />
          {/* Split items */}
          <div className="ml-2 space-y-1.5">
            {step.items.map((item, ii) => (
              <div
                key={ii}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium w-full',
                  highlightClasses[item.highlight ?? 'neutral']
                )}
              >
                <span className="font-bold min-w-[3rem]">{item.pct}</span>
                <span className="opacity-80">→</span>
                <span>{item.dest}</span>
              </div>
            ))}
          </div>
          {/* Connector between steps */}
          {si < steps.length - 1 && (
            <div className="ml-5 h-4 border-l-2 border-dashed border-muted-foreground/40" />
          )}
        </div>
      ))}
    </div>
  );
}
