import { useState, useMemo } from "react";
import { useBannerSlots, BannerSlotGroup, BannerSlot } from "@/hooks/useBannerSlots";
import { useWax } from "@/context/WaxContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { RentSlotDialog } from "./RentSlotDialog";
import { EditBannerDialog } from "./EditBannerDialog";
import { RemoveBannerDialog } from "./RemoveBannerDialog";
import { ReinstateBannerDialog } from "./ReinstateBannerDialog";
import { format } from "date-fns";

const BANNER_CONTRACT = "cheesebannad";

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
    return <Badge variant="outline" className="text-muted-foreground text-xs">Rented</Badge>;
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
    return <Badge variant="outline" className="text-muted-foreground text-xs">Shared - Full</Badge>;
  }
  
  // Default: available
  return <Badge className="bg-green-500/20 text-green-600 border-green-500/30 text-xs">Available</Badge>;
}

/** Generate 30 days of placeholder groups starting from today's UTC midnight */
function generatePlaceholderGroups(): BannerSlotGroup[] {
  const now = new Date();
  const todayMidnightUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000;
  const groups: BannerSlotGroup[] = [];

  for (let d = 0; d < 30; d++) {
    const time = todayMidnightUTC + d * 86400;
    groups.push({
      time,
      date: new Date(time * 1000),
      slots: [1, 2].map((position) => ({
        time,
        position,
        user: "",
        ipfsHash: "",
        websiteUrl: "",
        rentalType: "exclusive" as const,
        isAvailable: true,
        isOnChain: false,
        suspended: false,
      })),
    });
  }
  return groups;
}

/** Merge on-chain data over placeholders */
function mergeGroups(placeholders: BannerSlotGroup[], onChain: BannerSlotGroup[]): BannerSlotGroup[] {
  const chainMap = new Map<string, BannerSlot>();
  for (const g of onChain) {
    for (const s of g.slots) {
      chainMap.set(`${s.time}-${s.position}`, s);
    }
  }

  return placeholders.map((group) => ({
    ...group,
    slots: group.slots.map((slot) => {
      const real = chainMap.get(`${slot.time}-${slot.position}`);
      return real ?? slot;
    }),
  }));
}

export function SlotCalendar() {
  const { slotGroups, pricing, isLoading, refetch } = useBannerSlots();
  const { accountName } = useWax();
  const [rentTarget, setRentTarget] = useState<{ time: number; position: number; isJoining?: boolean } | null>(null);
  const [editTarget, setEditTarget] = useState<BannerSlot | null>(null);
  const [removeTarget, setRemoveTarget] = useState<BannerSlot | null>(null);
  const [reinstateTarget, setReinstateTarget] = useState<BannerSlot | null>(null);

  const isAdmin = accountName === BANNER_CONTRACT;

  const placeholders = useMemo(() => generatePlaceholderGroups(), []);
  const mergedGroups = useMemo(() => mergeGroups(placeholders, slotGroups), [placeholders, slotGroups]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-cheese" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col items-center text-center mb-4 gap-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-foreground font-medium">Exclusive: {pricing.waxPerDay} WAX/day</span>
          <span className="text-muted-foreground">|</span>
          <span className="text-foreground font-medium">Shared: {(pricing.waxPerDay * 0.7).toFixed(0)} WAX/day</span>
        </div>
        <p className="text-xs text-muted-foreground">30% off, 50% display time</p>
        <p className="text-xs text-muted-foreground">BUT if nobody rents the other shared slot, you get exclusive for the cheaper price!</p>
        <Button variant="ghost" size="sm" onClick={refetch} className="text-cheese mt-1">
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
        {mergedGroups.map((group) => (
          <Card key={group.time} className="border-border/50 bg-card/50">
            <CardContent className="py-4 px-5">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="md:w-40 shrink-0">
                  <p className="font-medium text-foreground">{format(group.date, "EEE, MMM d yyyy")}</p>
                  <p className="text-xs text-muted-foreground">UTC Day</p>
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
                         {(slot.isAvailable || !slot.isOnChain) && slot.rentalType !== "shared" && !isAdmin && (
                           <Button
                             size="sm"
                             className="bg-cheese hover:bg-cheese-dark text-primary-foreground text-xs h-7"
                             onClick={() => setRentTarget({ time: slot.time, position: slot.position })}
                           >
                             Rent
                           </Button>
                         )}
                         {slot.isOnChain && slot.isAvailable && slot.rentalType === "shared" && !slot.sharedUser && !isAdmin && (
                           <Button
                             size="sm"
                             className="bg-cheese hover:bg-cheese-dark text-primary-foreground text-xs h-7"
                             onClick={() => setRentTarget({ time: slot.time, position: slot.position, isJoining: true })}
                           >
                             Join
                           </Button>
                         )}

                         {/* Edit button for slot owners */}
                         {slot.isOnChain && !slot.suspended && (slot.user === accountName || slot.sharedUser === accountName) && (
                           <Button
                             size="sm"
                             variant="outline"
                             className="border-cheese/30 text-cheese text-xs h-7"
                             onClick={() => setEditTarget(slot)}
                           >
                             Edit
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
    </TooltipProvider>
  );
}
