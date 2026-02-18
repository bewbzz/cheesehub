import { useQuery } from "@tanstack/react-query";
import { fetchTable } from "@/lib/wax";

const BANNER_CONTRACT = "cheesebannad";

interface BannerAdRow {
  time: number;
  position: number;
  user: string;
  ipfs_hash: string;
  website_url: string;
  rental_type: number;
  shared_user: string;
  shared_ipfs_hash: string;
  shared_website_url: string;
  suspended: boolean;
}

export interface ActiveBanner {
  time: number;
  position: number;
  user: string;
  ipfsHash: string;
  websiteUrl: string;
  rentalType: "exclusive" | "shared";
  sharedUser?: string;
  sharedIpfsHash?: string;
  sharedWebsiteUrl?: string;
  displayMode: "full" | "shared"; // 'full' = 100%, 'shared' = 50% w/ rotation
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

      // Find slots in the current 24h window that are rented, have content, and are not suspended
      const active = rows.filter((row) => {
        const slotStart = row.time;
        const slotEnd = slotStart + 86400;
        return (
          nowSec >= slotStart &&
          nowSec < slotEnd &&
          row.user !== BANNER_CONTRACT &&
          row.ipfs_hash.length > 0 &&
          !row.suspended
        );
      });

      return active.map((row) => ({
        time: row.time,
        position: row.position,
        user: row.user,
        ipfsHash: row.ipfs_hash,
        websiteUrl: row.website_url,
        rentalType: row.rental_type === 1 ? "shared" : "exclusive",
        sharedUser: row.shared_user && row.shared_user !== BANNER_CONTRACT ? row.shared_user : undefined,
        sharedIpfsHash: row.shared_ipfs_hash,
        sharedWebsiteUrl: row.shared_website_url,
        displayMode:
          row.rental_type === 1 && row.shared_user && row.shared_user !== BANNER_CONTRACT
            ? "shared"
            : "full",
      }));
    },
    refetchInterval: 60000, // Poll every 60s
    staleTime: 30000,
  });
}
