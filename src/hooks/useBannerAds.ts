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

      // For multi-day rentals, content may only exist on the first day's row.
      // Inherit content from the most recent previous row with the same user+position.
      const sortedByTime = [...rows].sort((a, b) => a.time - b.time);
      for (const row of sortedByTime) {
        if (
          row.user !== BANNER_CONTRACT &&
          row.ipfs_hash.length === 0
        ) {
          const donor = sortedByTime
            .filter(
              (r) =>
                r.position === row.position &&
                r.user === row.user &&
                r.time < row.time &&
                r.ipfs_hash.length > 0
            )
            .pop(); // most recent earlier row with content
          if (donor) {
            row.ipfs_hash = donor.ipfs_hash;
            row.website_url = donor.website_url;
            row.rental_type = donor.rental_type;
            row.shared_user = donor.shared_user;
            row.shared_ipfs_hash = donor.shared_ipfs_hash;
            row.shared_website_url = donor.shared_website_url;
          }
        }
      }

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
