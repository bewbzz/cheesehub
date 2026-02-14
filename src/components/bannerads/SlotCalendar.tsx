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
import { format } from "date-fns";

function SlotBadge({ slot, accountName }: { slot: BannerSlot; accountName: string | null }) {
  if (!slot.isOnChain) {
    return <Badge variant="secondary" className="text-xs">Not Live</Badge>;
  }
  if (slot.isAvailable) {
    return <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-xs">Available</Badge>;
  }
  if (slot.user === accountName) {
    return <Badge className="bg-cheese/20 text-cheese border-cheese/30 text-xs">Yours</Badge>;
  }
  return <Badge variant="outline" className="text-muted-foreground text-xs">Rented</Badge>;
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
        isAvailable: true,
        isOnChain: false,
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
  const [rentTarget, setRentTarget] = useState<{ time: number; position: number } | null>(null);
  const [editTarget, setEditTarget] = useState<BannerSlot | null>(null);

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
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground">
          Price: <span className="text-foreground font-medium">{pricing.waxPerDay} WAX</span> per position per day
        </p>
        <Button variant="ghost" size="sm" onClick={refetch} className="text-cheese">
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
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
                      <div>
                        {slot.isOnChain && slot.isAvailable && (
                          <Button
                            size="sm"
                            className="bg-cheese hover:bg-cheese-dark text-primary-foreground text-xs h-7"
                            onClick={() => setRentTarget({ time: slot.time, position: slot.position })}
                          >
                            Rent
                          </Button>
                        )}
                        {!slot.isOnChain && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  size="sm"
                                  className="bg-cheese hover:bg-cheese-dark text-primary-foreground text-xs h-7 opacity-50 cursor-not-allowed"
                                  disabled
                                >
                                  Rent
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Contract not yet initialized</TooltipContent>
                          </Tooltip>
                        )}
                        {slot.isOnChain && slot.user === accountName && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-cheese/30 text-cheese text-xs h-7"
                            onClick={() => setEditTarget(slot)}
                          >
                            Edit
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
    </TooltipProvider>
  );
}