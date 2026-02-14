import { useQuery } from "@tanstack/react-query";
import { fetchTable } from "@/lib/wax";

const BANNER_CONTRACT = "cheesebannad";

interface BannerAdRow {
  time: number;
  position: number;
  user: string;
  ipfs_hash: string;
  website_url: string;
}

interface BannerConfig {
  id: number;
  wax_price_per_day: string;
  wax_per_cheese_baseline: number;
}

export interface BannerSlot {
  time: number;
  position: number;
  user: string;
  ipfsHash: string;
  websiteUrl: string;
  isAvailable: boolean;
  isOnChain: boolean;
}

export interface BannerSlotGroup {
  time: number;
  date: Date;
  slots: BannerSlot[];
}

export interface BannerPricing {
  waxPerDay: number; // e.g. 100
  waxPerCheeseBaseline: number;
}

/**
 * Fetches all banner ad slots and config for the marketplace view.
 */
export function useBannerSlots() {
  const slotsQuery = useQuery({
    queryKey: ["bannerSlots", "all"],
    queryFn: async (): Promise<BannerSlotGroup[]> => {
      const rows = await fetchTable<BannerAdRow>(
        BANNER_CONTRACT,
        BANNER_CONTRACT,
        "bannerads",
        { limit: 1000 }
      );

      // Group by time
      const grouped = new Map<number, BannerSlot[]>();
      for (const row of rows) {
        const slot: BannerSlot = {
          time: row.time,
          position: row.position,
          user: row.user,
          ipfsHash: row.ipfs_hash,
          websiteUrl: row.website_url,
          isAvailable: row.user === BANNER_CONTRACT,
          isOnChain: true,
        };

        const existing = grouped.get(row.time) || [];
        existing.push(slot);
        grouped.set(row.time, existing);
      }

      // Convert to array sorted by time
      return Array.from(grouped.entries())
        .sort(([a], [b]) => a - b)
        .map(([time, slots]) => ({
          time,
          date: new Date(time * 1000),
          slots: slots.sort((a, b) => a.position - b.position),
        }));
    },
    staleTime: 15000,
  });

  const configQuery = useQuery({
    queryKey: ["bannerConfig"],
    queryFn: async (): Promise<BannerPricing> => {
      const rows = await fetchTable<BannerConfig>(
        BANNER_CONTRACT,
        BANNER_CONTRACT,
        "config",
        { limit: 1 }
      );

      if (rows.length > 0) {
        // Parse "100.00000000 WAX" format
        const amount = parseFloat(rows[0].wax_price_per_day.split(" ")[0]);
        return {
          waxPerDay: amount,
          waxPerCheeseBaseline: rows[0].wax_per_cheese_baseline,
        };
      }

      // Defaults matching contract
      return { waxPerDay: 100, waxPerCheeseBaseline: 1.5 };
    },
    staleTime: 60000,
  });

  return {
    slotGroups: slotsQuery.data ?? [],
    pricing: configQuery.data ?? { waxPerDay: 100, waxPerCheeseBaseline: 1.5 },
    isLoading: slotsQuery.isLoading || configQuery.isLoading,
    refetch: () => {
      slotsQuery.refetch();
      configQuery.refetch();
    },
  };
}
