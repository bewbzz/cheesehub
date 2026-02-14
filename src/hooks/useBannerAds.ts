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

export interface ActiveBanner {
  time: number;
  position: number;
  user: string;
  ipfsHash: string;
  websiteUrl: string;
}

/**
 * Fetches the currently active banner ads for the current 24-hour window.
 * Returns up to 2 active banners (position 1 and/or position 2).
 */
export function useBannerAds() {
  return useQuery({
    queryKey: ["bannerAds", "active"],
    queryFn: async (): Promise<ActiveBanner[]> => {
      const nowSec = Math.floor(Date.now() / 1000);

      // Fetch a reasonable range of slots around now
      const rows = await fetchTable<BannerAdRow>(
        BANNER_CONTRACT,
        BANNER_CONTRACT,
        "bannerads",
        { limit: 100 }
      );

      // Find slots in the current 24h window that are rented (user !== contract)
      const active = rows.filter((row) => {
        const slotStart = row.time;
        const slotEnd = slotStart + 86400;
        return (
          nowSec >= slotStart &&
          nowSec < slotEnd &&
          row.user !== BANNER_CONTRACT &&
          row.ipfs_hash.length > 0
        );
      });

      return active.map((row) => ({
        time: row.time,
        position: row.position,
        user: row.user,
        ipfsHash: row.ipfs_hash,
        websiteUrl: row.website_url,
      }));
    },
    refetchInterval: 60000, // Poll every 60s
    staleTime: 30000,
  });
}
