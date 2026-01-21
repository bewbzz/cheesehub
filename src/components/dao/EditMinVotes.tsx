import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DaoInfo, buildFixWgtNVotesAction } from "@/lib/dao";
import { useWax } from "@/context/WaxContext";
import { useToast } from "@/hooks/use-toast";
import { closeWharfkitModals } from "@/lib/wharfKit";
import { Loader2, Users } from "lucide-react";

interface EditMinVotesProps {
  dao: DaoInfo;
  open: boolean;
  onClose: () => void;
  onUpdated: (newVotes: number) => void;
}

export function EditMinVotes({ dao, open, onClose, onUpdated }: EditMinVotesProps) {
  const { session, accountName } = useWax();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentVotes = dao.minimum_votes ?? 0;
  const [newVotes, setNewVotes] = useState(currentVotes.toString());

  const handleSubmit = async () => {
    if (!session || !accountName) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to update the minimum votes",
        variant: "destructive",
      });
      return;
    }

    const parsedVotes = parseInt(newVotes, 10);
    if (isNaN(parsedVotes) || parsedVotes < 0) {
      toast({
        title: "Invalid votes",
        description: "Please enter a valid number (0 or greater)",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Pass the new minimum_votes but keep the existing minimum_weight unchanged
      const action = buildFixWgtNVotesAction(
        accountName,
        dao.dao_name,
        dao.minimum_weight ?? 0,
        parsedVotes
      );

      await session.transact({ actions: [action] });

      toast({
        title: "Minimum Votes Updated",
        description: `New minimum votes required: ${parsedVotes.toLocaleString()}`,
      });

      onUpdated(parsedVotes);
      onClose();
    } catch (error) {
      console.error("Failed to update minimum votes:", error);
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update minimum votes",
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
            <Users className="h-5 w-5 text-cheese" />
            Edit Minimum Votes
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="minVotes">Minimum Votes Required</Label>
            <Input
              id="minVotes"
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={newVotes}
              onChange={(e) => setNewVotes(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Minimum number of votes required for a proposal to pass
            </p>
          </div>

          {/* Preview */}
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">New minimum votes will be:</p>
            <p className="font-bold text-cheese">{(parseInt(newVotes) || 0).toLocaleString()}</p>
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
