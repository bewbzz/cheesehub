import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DaoInfo, buildEditPropCostAction } from "@/lib/dao";
import { parseListingPrice, getTokenConfig } from "@/lib/tokenRegistry";
import { useWax } from "@/context/WaxContext";
import { useToast } from "@/hooks/use-toast";
import { closeWharfkitModals } from "@/lib/wharfKit";
import { Loader2, Coins } from "lucide-react";

interface EditProposalCostProps {
  dao: DaoInfo;
  open: boolean;
  onClose: () => void;
  onCostUpdated: (newCost: string) => void;
}

export function EditProposalCost({ dao, open, onClose, onCostUpdated }: EditProposalCostProps) {
  const { session, accountName } = useWax();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Parse current cost to get amount and symbol
  const parsed = parseListingPrice(dao.proposal_cost || "0 WAX");
  const currentAmount = parsed?.amount || 0;
  const tokenSymbol = parsed?.symbol || "WAX";

  // Get token precision for proper formatting
  const tokenConfig = getTokenConfig(tokenSymbol);
  const precision = tokenConfig?.precision || 8;

  // State for the new amount (user edits this)
  const [newAmount, setNewAmount] = useState(currentAmount.toString());

  const handleSubmit = async () => {
    if (!session || !accountName) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to update the proposal cost",
        variant: "destructive",
      });
      return;
    }

    const parsedAmount = parseFloat(newAmount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid number (0 or greater)",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Format with correct precision and symbol
      const formattedCost = `${parsedAmount.toFixed(precision)} ${tokenSymbol}`;
      const action = buildEditPropCostAction(accountName, dao.dao_name, formattedCost);

      await session.transact({ actions: [action] });

      toast({
        title: "Proposal Cost Updated",
        description: `New proposal cost: ${formattedCost}`,
      });

      onCostUpdated(formattedCost);
      onClose();
    } catch (error) {
      console.error("Failed to update proposal cost:", error);
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update proposal cost",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      // Don't call closeWharfkitModals() here - let the wallet plugin manage its own UI
    }
  };

  // Format the preview with correct precision
  const previewAmount = parseFloat(newAmount) || 0;
  const previewCost = `${previewAmount.toFixed(precision)} ${tokenSymbol}`;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-cheese" />
            Edit Proposal Cost
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="proposalCost">New Cost ({tokenSymbol})</Label>
            <Input
              id="proposalCost"
              type="number"
              min="0"
              step={Math.pow(10, -precision)}
              placeholder="0"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Enter 0 for free proposals
            </p>
          </div>

          {/* Preview */}
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">New proposal cost will be:</p>
            <p className="font-bold text-cheese">{previewCost}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
