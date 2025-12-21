import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";
import { ClaimTokenId } from "@/lib/faucet";

interface RewardRowProps {
  icon: LucideIcon;
  label: string;
  description: string;
  amount: string;
  tokenId: ClaimTokenId;
  disabled: boolean;
  isClaiming: boolean;
  onClaim: (tokenId: ClaimTokenId) => void;
  requiresWheel?: boolean;
  stakeType?: "wedge" | "wheel" | null;
}

export function RewardRow({
  icon: Icon,
  label,
  description,
  amount,
  tokenId,
  disabled,
  isClaiming,
  onClaim,
  requiresWheel,
  stakeType,
}: RewardRowProps) {
  const amountValue = parseFloat(amount.split(" ")[0] || "0");
  const canClaim = amountValue > 0 && !disabled;
  const isLocked = requiresWheel && stakeType !== "wheel";

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-cheese/10 border border-cheese/20 hover:bg-cheese/15 transition-colors">
      {/* Icon */}
      <div className="p-3 rounded-lg bg-cheese/20 shrink-0">
        <Icon className="h-6 w-6 text-cheese" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground truncate">{description}</p>
        {isLocked && (
          <p className="text-xs text-destructive mt-0.5">Requires WHEEL stake</p>
        )}
      </div>

      {/* Amount */}
      <div className="text-right shrink-0">
        <p className="text-lg font-bold text-cheese">{amount}</p>
      </div>

      {/* Claim Button */}
      <Button
        onClick={() => onClaim(tokenId)}
        disabled={!canClaim || isClaiming || isLocked}
        className={`shrink-0 min-w-[80px] ${
          canClaim && !isLocked
            ? "bg-cheese text-cheese-foreground hover:bg-cheese/90"
            : ""
        }`}
        variant={canClaim && !isLocked ? "default" : "outline"}
      >
        {isClaiming ? "..." : "CLAIM"}
      </Button>
    </div>
  );
}
