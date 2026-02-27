import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ReactNode } from 'react';

interface StatusRow {
  label: string;
  value: string | number | ReactNode;
  warn?: boolean;
  critical?: boolean;
}

interface ContractStatusCardProps {
  title: string;
  icon?: ReactNode;
  rows: StatusRow[];
  children?: ReactNode;
  status?: 'ok' | 'warn' | 'critical';
}

export function ContractStatusCard({ title, icon, rows, children, status = 'ok' }: ContractStatusCardProps) {
  const statusColors = {
    ok: 'border-green-500/30',
    warn: 'border-yellow-500/30',
    critical: 'border-red-500/30',
  };
  const badgeColors = {
    ok: 'bg-green-500/20 text-green-400',
    warn: 'bg-yellow-500/20 text-yellow-400',
    critical: 'bg-red-500/20 text-red-400',
  };

  return (
    <Card className={`${statusColors[status]} border-2`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          <Badge variant="outline" className={badgeColors[status]}>
            {status === 'ok' ? 'OK' : status === 'warn' ? 'Warning' : 'Critical'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">{row.label}</span>
            <span className={`font-mono ${row.critical ? 'text-red-400 font-bold' : row.warn ? 'text-yellow-400' : ''}`}>
              {row.value}
            </span>
          </div>
        ))}
        {children}
      </CardContent>
    </Card>
  );
}
