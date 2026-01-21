import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DaoInfo, buildFixWgtNVotesAction } from "@/lib/dao";
import { useWax } from "@/context/WaxContext";
import { useToast } from "@/hooks/use-toast";
import { closeWharfkitModals } from "@/lib/wharfKit";
import { Loader2, Scale } from "lucide-react";

interface EditMinWeightProps {
  dao: DaoInfo;
  open: boolean;
  onClose: () => void;
  onUpdated: (newWeight: number) => void;
}

export function EditMinWeight({ dao, open, onClose, onUpdated }: EditMinWeightProps) {
  const { session, accountName } = useWax();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentWeight = dao.minimum_weight ?? 0;
  const [newWeight, setNewWeight] = useState(currentWeight.toString());

  const handleSubmit = async () => {
    if (!session || !accountName) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to update the minimum weight",
        variant: "destructive",
      });
      return;
    }

    const parsedWeight = parseInt(newWeight, 10);
    if (isNaN(parsedWeight) || parsedWeight < 0) {
      toast({
        title: "Invalid weight",
        description: "Please enter a valid number (0 or greater)",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Pass the new weight but keep the existing minimum_votes unchanged
      const action = buildFixWgtNVotesAction(
        accountName,
        dao.dao_name,
        parsedWeight,
        dao.minimum_votes ?? 0
      );

      await session.transact({ actions: [action] });

      toast({
        title: "Minimum Weight Updated",
        description: `New minimum weight: ${parsedWeight.toLocaleString()}`,
      });

      onUpdated(parsedWeight);
      onClose();
    } catch (error) {
      console.error("Failed to update minimum weight:", error);
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update minimum weight",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      closeWharfkitModals();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-cheese" />
            Edit Minimum Weight
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="minWeight">Minimum Weight Required</Label>
            <Input
              id="minWeight"
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Minimum token balance needed to create proposals (Token Holders)
            </p>
          </div>

          {/* Preview */}
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">New minimum weight will be:</p>
            <p className="font-bold text-cheese">{(parseInt(newWeight) || 0).toLocaleString()}</p>
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
