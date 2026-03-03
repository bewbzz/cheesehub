import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { useWax } from "@/context/WaxContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, X } from "lucide-react";
import { formatSlotDateUTC } from "./SlotCalendar";
import { IPFS_GATEWAYS } from "@/lib/ipfsGateways";
import { closeWharfkitModals, getTransactPlugins } from "@/lib/wharfKit";

export interface BulkSlotSelection {
  time: number;
  position: number;
  isJoining: boolean;
}

interface BulkRentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selections: BulkSlotSelection[];
  waxPricePerDay: number;
  onRemoveSlot: (time: number, position: number) => void;
  onSuccess: () => void;
}

export function BulkRentDialog({
  open,
  onOpenChange,
  selections,
  waxPricePerDay,
  onRemoveSlot,
  onSuccess,
}: BulkRentDialogProps) {
  const { session, refreshBalance } = useWax();
  const { toast } = useToast();
  const [rentalMode, setRentalMode] = useState<"exclusive" | "shared">("exclusive");
  const [ipfsHash, setIpfsHash] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const SHARED_DISCOUNT = 0.30;
  const PROMOZ_DISCOUNT = 0.50;

  const isPromoz = session?.actor?.toString() === "cheesepromoz";

  // Joining slots always use shared pricing; new rentals use selected mode
  const getSlotPrice = (slot: BulkSlotSelection) => {
    const baseMultiplier = slot.isJoining ? (1 - SHARED_DISCOUNT) : (rentalMode === "shared" ? (1 - SHARED_DISCOUNT) : 1);
    const promozMultiplier = isPromoz ? (1 - PROMOZ_DISCOUNT) : 1;
    return waxPricePerDay * baseMultiplier * promozMultiplier;
  };

  const totalWax = selections.reduce((sum, s) => sum + getSlotPrice(s), 0);

  const hasNewRentals = selections.some(s => !s.isJoining);
  const hasJoins = selections.some(s => s.isJoining);

  const previewUrl = ipfsHash ? `${IPFS_GATEWAYS[0]}${ipfsHash}` : "";

  const handleBulkRent = async () => {
    if (!session) {
      toast({ title: "Wallet Not Connected", description: "Please connect your wallet first", variant: "destructive" });
      return;
    }

    if (selections.length === 0) {
      toast({ title: "No Slots Selected", description: "Please select at least one slot", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const actions: any[] = [];

      // Build one transfer + edit action per selected slot
      for (const slot of selections) {
        const modeChar = slot.isJoining ? "j" : (rentalMode === "shared" ? "s" : "e");
        const slotPrice = getSlotPrice(slot);
        const memo = `banner|${slot.time}|1|${slot.position}|${modeChar}`;

        // Transfer action
        actions.push({
          account: "eosio.token",
          name: "transfer",
          authorization: [session.permissionLevel],
          data: {
            from: session.actor.toString(),
            to: "cheesebannad",
            quantity: `${slotPrice.toFixed(8)} WAX`,
            memo,
          },
        });

        // Edit action (if IPFS hash provided)
        if (ipfsHash) {
          const editAction = slot.isJoining ? "editsharedad" : "editadbanner";
          actions.push({
            account: "cheesebannad",
            name: editAction,
            authorization: [session.permissionLevel],
            data: {
              user: session.actor.toString(),
              start_time: slot.time,
              position: slot.position,
              ipfs_hash: ipfsHash,
              website_url: websiteUrl,
            },
          });
        }
      }

      await session.transact(
        { actions },
        { transactPlugins: getTransactPlugins(session) }
      );

      toast({
        title: "Slots Rented! 🧀",
        description: `${selections.length} slot${selections.length > 1 ? "s" : ""} rented successfully`,
      });
      refreshBalance?.();
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Bulk rent failed:", error);
      closeWharfkitModals();
      toast({
        title: "Rent Failed",
        description: error instanceof Error ? error.message : "Transaction failed",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => closeWharfkitModals(), 100);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rent {selections.length} Banner Slot{selections.length > 1 ? "s" : ""}</DialogTitle>
          <DialogDescription>
            All slots will be rented in a single transaction
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Selected slots list */}
          <div>
            <Label className="text-sm font-medium">Selected Slots</Label>
            <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
              {selections.map((slot) => (
                <div
                  key={`${slot.time}-${slot.position}`}
                  className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/30 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{formatSlotDateUTC(slot.time)}</span>
                    <Badge variant="outline" className="text-xs">Pos {slot.position}</Badge>
                    {slot.isJoining && (
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">Join</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{getSlotPrice(slot).toFixed(2)} WAX</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemoveSlot(slot.time, slot.position)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rental mode - only show if there are new (non-join) rentals */}
          {hasNewRentals && (
            <div>
              <Label>Rental Type {hasJoins && <span className="text-xs text-muted-foreground">(for new rentals only)</span>}</Label>
              <RadioGroup
                value={rentalMode}
                onValueChange={(v) => setRentalMode(v as "exclusive" | "shared")}
                className="mt-2 space-y-2"
              >
                <div className="flex items-center space-x-2 p-3 rounded-lg border border-border/50">
                  <RadioGroupItem value="exclusive" id="bulk-mode-exclusive" />
                  <Label htmlFor="bulk-mode-exclusive" className="cursor-pointer flex-1">
                    <span className="font-medium">Exclusive</span>
                    <span className="text-xs text-muted-foreground ml-2">100% display time, full price</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 rounded-lg border border-border/50">
                  <RadioGroupItem value="shared" id="bulk-mode-shared" />
                  <Label htmlFor="bulk-mode-shared" className="cursor-pointer flex-1">
                    <span className="font-medium">Shared (Save 30%)</span>
                    <span className="text-xs text-muted-foreground ml-2">50% display time with rotation</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Banner content - shared across all slots */}
          <div>
            <Label>IPFS Hash <span className="text-xs text-muted-foreground">(applied to all slots)</span></Label>
            <Input
              value={ipfsHash}
              onChange={(e) => setIpfsHash(e.target.value.replace(/^https?:\/\/.*$/i, ""))}
              placeholder="QmXyz... or bafyabc..."
              maxLength={128}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">IPFS hash only (no URLs). Max 128 characters.</p>
          </div>

          <div>
            <Label>Website URL <span className="text-xs text-muted-foreground">(applied to all slots)</span></Label>
            <Input
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com"
              maxLength={256}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">Max 256 characters</p>
          </div>

          <div className="rounded-lg border border-border/30 bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground text-sm">📐 Required Dimensions</p>
            <p><strong>580 × 150 px</strong> — exact size required</p>
            <p>Upload your image to IPFS and paste the hash here.</p>
            <p>Only IPFS hashes accepted (Qm… or bafy…), not direct image URLs.</p>
          </div>

          {previewUrl && (
            <div>
              <Label className="text-muted-foreground">Preview</Label>
              <div className="mt-2 rounded-lg overflow-hidden border border-border/30">
                <img
                  src={previewUrl}
                  alt="Banner preview"
                  className="w-full h-auto max-h-40 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            </div>
          )}

          {/* Total price */}
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p className="font-medium">{totalWax.toFixed(2)} WAX total</p>
            <p className="text-xs text-muted-foreground">
              {selections.length} slot{selections.length > 1 ? "s" : ""} × avg {(totalWax / selections.length).toFixed(2)} WAX each
            </p>
            {isPromoz && (
              <p className="text-xs font-medium mt-1" style={{ color: 'hsl(142 71% 45%)' }}>🧀 Promoz 50% discount applied</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleBulkRent}
            disabled={isSubmitting || !session || selections.length === 0}
            className="bg-cheese hover:bg-cheese-dark text-primary-foreground"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Rent {selections.length} Slot{selections.length > 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
