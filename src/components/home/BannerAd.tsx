import { useState } from "react";
import { useBannerAds, ActiveBanner } from "@/hooks/useBannerAds";
import { IPFS_GATEWAYS } from "@/lib/ipfsGateways";
import { Badge } from "@/components/ui/badge";

function BannerImage({ banner }: { banner: ActiveBanner }) {
  const [gatewayIdx, setGatewayIdx] = useState(0);

  const imgUrl = banner.ipfsHash.startsWith("http")
    ? banner.ipfsHash
    : `${IPFS_GATEWAYS[gatewayIdx]}${banner.ipfsHash}`;

  const handleError = () => {
    if (gatewayIdx < IPFS_GATEWAYS.length - 1) {
      setGatewayIdx((i) => i + 1);
    }
  };

  return (
    <a
      href={banner.websiteUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="relative block rounded-lg overflow-hidden border border-border/30 hover:border-cheese/30 transition-colors group"
    >
      <img
        src={imgUrl}
        alt="Banner Ad"
        className="w-full h-auto object-cover"
        onError={handleError}
        loading="lazy"
      />
      <Badge
        variant="outline"
        className="absolute top-2 right-2 bg-background/80 text-muted-foreground text-[10px] px-1.5 py-0.5 opacity-60 group-hover:opacity-100 transition-opacity"
      >
        Ad
      </Badge>
    </a>
  );
}

export function BannerAd() {
  const { data: banners, isLoading } = useBannerAds();

  if (isLoading || !banners || banners.length === 0) return null;

  // 2 banners: side by side; 1 banner: centered at half width
  if (banners.length >= 2) {
    return (
      <div className="container py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <BannerImage banner={banners[0]} />
          <BannerImage banner={banners[1]} />
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="max-w-[50%] mx-auto max-md:max-w-full">
        <BannerImage banner={banners[0]} />
      </div>
    </div>
  );
}
