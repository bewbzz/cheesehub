import { useState, useMemo, useEffect } from "react";
import { useBannerSlots, BannerSlotGroup, BannerSlot } from "@/hooks/useBannerSlots";
import { useWax } from "@/context/WaxContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, RefreshCw, Eye } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { IPFS_GATEWAYS } from "@/lib/ipfsGateways";
import { sanitizeUrl } from "@/lib/sanitizeUrl";
import { RentSlotDialog } from "./RentSlotDialog";
import { EditBannerDialog } from "./EditBannerDialog";
import { RemoveBannerDialog } from "./RemoveBannerDialog";
import { ReinstateBannerDialog } from "./ReinstateBannerDialog";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { format } from "date-fns";

function PreviewBannerImage({ ipfsHash, label }: { ipfsHash: string; label: string }) {
  const [gatewayIdx, setGatewayIdx] = useState(0);
  if (!ipfsHash) return null;
  const imgUrl = `${IPFS_GATEWAYS[gatewayIdx]}${ipfsHash}`;
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <img
        src={imgUrl}
        alt={label}
        className="w-full h-auto rounded-md border border-border/50 object-cover"
        onError={() => { if (gatewayIdx < IPFS_GATEWAYS.length - 1) setGatewayIdx((i) => i + 1); }}
      />
    </div>
  );
}

function PreviewBannerDialog({ open, onOpenChange, slot }: { open: boolean; onOpenChange: (o: boolean) => void; slot: BannerSlot }) {
  const hasShared = slot.rentalType === "shared" && !!slot.sharedUser;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-cheese" />
            Preview — Pos {slot.position}, {format(new Date(slot.time * 1000), "MMM d yyyy")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
            <p><span className="text-muted-foreground">Renter:</span> <span className="font-mono font-medium">{slot.user}</span></p>
            {slot.websiteUrl && <p><span className="text-muted-foreground">URL:</span> <a href={sanitizeUrl(slot.websiteUrl)} target="_blank" rel="noopener noreferrer" className="text-cheese hover:underline break-all">{slot.websiteUrl}</a></p>}
            {hasShared && <p><span className="text-muted-foreground">Shared renter:</span> <span className="font-mono font-medium">{slot.sharedUser}</span></p>}
            {hasShared && slot.sharedWebsiteUrl && <p><span className="text-muted-foreground">Shared URL:</span> <a href={sanitizeUrl(slot.sharedWebsiteUrl)} target="_blank" rel="noopener noreferrer" className="text-cheese hover:underline break-all">{slot.sharedWebsiteUrl}</a></p>}
          </div>
          {slot.ipfsHash && <PreviewBannerImage ipfsHash={slot.ipfsHash} label={`Banner by ${slot.user}`} />}
          {hasShared && slot.sharedIpfsHash && <PreviewBannerImage ipfsHash={slot.sharedIpfsHash} label={`Banner by ${slot.sharedUser}`} />}
          {!slot.ipfsHash && !(hasShared && slot.sharedIpfsHash) && (
            <p className="text-sm text-muted-foreground text-center py-4">No banner images uploaded yet.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const BANNER_CONTRACT = "cheesebannad";
const MIN_RENT_BUFFER_HOURS = 48;
const MIN_JOIN_BUFFER_HOURS = 12;

function isWithinBuffer(slotTime: number, bufferHours: number): boolean {
  const cutoff = Math.floor(Date.now() / 1000) + bufferHours * 3600;
  return slotTime >= cutoff;
}

function SlotBadge({ slot, accountName }: { slot: BannerSlot; accountName: string | null }) {
  if (!slot.isOnChain) {
    return <Badge className="bg-green-500/20 text-green-600 border-green-500/30 text-xs">Available</Badge>;
  }

  // Suspended by admin — shown to everyone
  if (slot.suspended) {
    return <Badge variant="destructive" className="text-xs">Suspended</Badge>;
  }
  
  // Exclusive slot, rented by current user
  if (slot.rentalType === "exclusive" && slot.user === accountName) {
    return <Badge className="bg-cheese/20 text-cheese border-cheese/30 text-xs">Yours</Badge>;
  }
  
  // Exclusive slot, rented by someone else
  if (slot.rentalType === "exclusive" && slot.user !== BANNER_CONTRACT) {
    return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">Rented</Badge>;
  }
  
  // Shared slot, primary renter is current user
  if (slot.rentalType === "shared" && slot.user === accountName) {
    if (slot.sharedUser) {
      return <Badge className="bg-cheese/20 text-cheese border-cheese/30 text-xs">Yours (Shared)</Badge>;
    }
    return <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30 text-xs">Yours (Open)</Badge>;
  }
  
  // Shared slot, secondary renter is current user
  if (slot.rentalType === "shared" && slot.sharedUser === accountName) {
    return <Badge className="bg-cheese/20 text-cheese border-cheese/30 text-xs">Yours (Shared)</Badge>;
  }
  
  // Shared slot, open for joining
  if (slot.rentalType === "shared" && !slot.sharedUser) {
    return <Badge className="bg-green-500/20 text-green-600 border-green-500/30 text-xs">Shared - Open</Badge>;
  }
  
  // Shared slot, both filled
  if (slot.rentalType === "shared" && slot.sharedUser) {
    return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">Shared - Full</Badge>;
  }
  
  // Default: available
  return <Badge className="bg-green-500/20 text-green-600 border-green-500/30 text-xs">Available</Badge>;
}

/** Normalize any on-chain slot time to midnight UTC of that date */
function toMidnightUTC(slotTime: number): number {
  const d = new Date(slotTime * 1000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000;
}

/** Filter to only show future slots (exclude already-live / past days) */
function filterFutureGroups(groups: BannerSlotGroup[]): BannerSlotGroup[] {
  const now = Math.floor(Date.now() / 1000);
  const todayMidnightUTC = toMidnightUTC(now);
  return groups.filter((g) => toMidnightUTC(g.time) > todayMidnightUTC);
}

/** Live countdown component — shows minutes when < 1 hr, updates every 30s */
function LiveCountdown({ slotTime }: { slotTime: number }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const midnight = useMemo(() => toMidnightUTC(slotTime), [slotTime]);
  const diffSec = Math.max(0, midnight - now);
  const isUnderOneHour = diffSec < 3600;

  useEffect(() => {
    if (!isUnderOneHour) return;
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30_000);
    return () => clearInterval(id);
  }, [isUnderOneHour]);

  if (!isUnderOneHour) {
    const hrs = Math.round(diffSec / 3600);
    return <>{hrs === 1 ? "~1 hr" : `~${hrs} hrs`}</>;
  }
  const mins = Math.floor(diffSec / 60);
  if (mins < 1) return <>{"< 1 min"}</>;
  return <>{`${mins} min`}</>;
}

export function SlotCalendar() {
  const { slotGroups, pricing, isLoading, refetch } = useBannerSlots();
  const { accountName } = useWax();
  const [rentTarget, setRentTarget] = useState<{ time: number; position: number; isJoining?: boolean } | null>(null);
  const [editTarget, setEditTarget] = useState<BannerSlot | null>(null);
  const [removeTarget, setRemoveTarget] = useState<BannerSlot | null>(null);
  const [reinstateTarget, setReinstateTarget] = useState<BannerSlot | null>(null);
  const [previewTarget, setPreviewTarget] = useState<BannerSlot | null>(null);

  const { isWhitelisted: isAdmin } = useAdminAccess();

  const futureGroups = useMemo(() => filterFutureGroups(slotGroups), [slotGroups]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-cheese" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col items-center text-center mb-4 gap-3">
        <div className="flex items-start gap-4 text-sm w-full justify-center pl-16">
          <span className="text-foreground font-medium whitespace-nowrap pt-0.5">Exclusive Slot: {pricing.waxPerDay} WAX/day</span>
          <span className="text-muted-foreground pt-0.5">|</span>
          <div className="flex flex-col items-start">
            <span className="text-foreground font-medium">Shared Slot: {(pricing.waxPerDay * 0.7).toFixed(0)} WAX/day</span>
            <span className="text-xs text-muted-foreground">30% off, 50% display time</span>
            <span className="text-xs text-muted-foreground">BUT if nobody rents the other shared slot,</span>
            <span className="text-xs text-muted-foreground">you get exclusive for the cheaper price!</span>
            <span className="text-xs text-muted-foreground">OR rent both shared slots and show 2 banners</span>
            <span className="text-xs text-muted-foreground">for less than 2 exclusive slots</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={refetch} className="text-cheese">
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
        <span className="font-semibold">⚠️ Warning:</span> Content is moderated and if deemed offensive may be removed without warning. However you may question this decision in the{" "}
        <a
          href="https://t.me/cheeseonwaxofficial"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-amber-600 dark:hover:text-amber-300 transition-colors"
        >
          $CHEESE Telegram group
        </a>{" "}
        and have it reviewed and possibly reinstated.
      </div>

      <div className="space-y-3">
        {futureGroups.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-medium">No banner slots available</p>
            <p className="text-sm mt-1">No initialized slots found on-chain. Check back later.</p>
          </div>
        )}
        {futureGroups.map((group) => (
          <Card key={group.time} className="border-border/50 bg-card/50">
            <CardContent className="py-4 px-5">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="md:w-40 shrink-0">
                  <p className="font-medium text-foreground">{format(group.date, "EEE, MMM d yyyy")}</p>
                  <p className="text-xs text-muted-foreground">UTC Day</p>
                  <p className="text-xs text-cheese font-medium mt-0.5">Live in <LiveCountdown slotTime={group.time} /></p>
                </div>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {group.slots.map((slot) => (
                    <div
                      key={slot.position}
                      className="flex items-center justify-between rounded-lg border border-border/30 p-3 bg-background/50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground">Pos {slot.position}</span>
                        <SlotBadge slot={slot} accountName={accountName} />
                      </div>
                      <div className="flex items-center gap-2">
                         {/* Rent / Join buttons for non-admin users */}
                         {(slot.isAvailable || !slot.isOnChain) && slot.rentalType !== "shared" && !isAdmin && isWithinBuffer(slot.time, MIN_RENT_BUFFER_HOURS) && (
                           <Button
                             size="sm"
                             className="bg-cheese hover:bg-cheese-dark text-primary-foreground text-xs h-7"
                             onClick={() => setRentTarget({ time: slot.time, position: slot.position })}
                           >
                             Rent
                           </Button>
                         )}
                         {slot.isOnChain && slot.isAvailable && slot.rentalType === "shared" && !slot.sharedUser && !isAdmin && isWithinBuffer(slot.time, MIN_JOIN_BUFFER_HOURS) && (
                           <Button
                             size="sm"
                             className="bg-cheese hover:bg-cheese-dark text-primary-foreground text-xs h-7"
                             onClick={() => setRentTarget({ time: slot.time, position: slot.position, isJoining: true })}
                           >
                             Join
                           </Button>
                         )}

                         {/* Edit button - admin only (users set content during rental) */}
                         {isAdmin && slot.isOnChain && !slot.suspended && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-cheese/30 text-cheese text-xs h-7"
                              onClick={() => setEditTarget(slot)}
                            >
                              Edit
                            </Button>
                          )}

                         {/* Admin: Preview button (rented slots) */}
                         {isAdmin && slot.isOnChain && slot.user !== BANNER_CONTRACT && (
                           <Button
                             size="sm"
                             variant="outline"
                             className="border-green-500/50 text-green-600 text-xs h-7 hover:bg-green-500/10"
                             onClick={() => setPreviewTarget(slot)}
                           >
                             <Eye className="h-3 w-3 mr-1" />
                             Preview
                           </Button>
                         )}

                         {/* Admin: Remove button (active rented, not suspended) */}
                         {isAdmin && slot.isOnChain && slot.user !== BANNER_CONTRACT && !slot.suspended && (
                           <Button
                             size="sm"
                             variant="destructive"
                             className="text-xs h-7"
                             onClick={() => setRemoveTarget(slot)}
                           >
                             Remove
                           </Button>
                         )}

                         {/* Admin: Reinstate button (suspended slots) */}
                         {isAdmin && slot.isOnChain && slot.suspended && (
                           <Button
                             size="sm"
                             variant="outline"
                             className="border-green-500/50 text-green-600 text-xs h-7 hover:bg-green-500/10"
                             onClick={() => setReinstateTarget(slot)}
                           >
                             Reinstate
                           </Button>
                         )}
                       </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {rentTarget && (
        <RentSlotDialog
          open={!!rentTarget}
          onOpenChange={(open) => !open && setRentTarget(null)}
          startTime={rentTarget.time}
          position={rentTarget.position}
          waxPricePerDay={pricing.waxPerDay}
          isJoining={rentTarget.isJoining || false}
          onSuccess={refetch}
        />
      )}

      {editTarget && (
        <EditBannerDialog
          open={!!editTarget}
          onOpenChange={(open) => !open && setEditTarget(null)}
          slot={editTarget}
          onSuccess={refetch}
        />
      )}

      {removeTarget && (
        <RemoveBannerDialog
          open={!!removeTarget}
          onOpenChange={(open) => !open && setRemoveTarget(null)}
          slot={removeTarget}
          onSuccess={refetch}
        />
      )}

      {reinstateTarget && (
        <ReinstateBannerDialog
          open={!!reinstateTarget}
          onOpenChange={(open) => !open && setReinstateTarget(null)}
          slot={reinstateTarget}
          onSuccess={refetch}
        />
      )}

      {previewTarget && (
        <PreviewBannerDialog
          open={!!previewTarget}
          onOpenChange={(open) => !open && setPreviewTarget(null)}
          slot={previewTarget}
        />
      )}
    </TooltipProvider>
  );
}
