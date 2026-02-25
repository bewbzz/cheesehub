import { useState, useEffect } from "react";
import { useBannerAds, ActiveBanner } from "@/hooks/useBannerAds";
import { IPFS_GATEWAYS } from "@/lib/ipfsGateways";
import { Badge } from "@/components/ui/badge";

function BannerImage({ banner, isShared = false }: { banner: ActiveBanner; isShared?: boolean }) {
  const [gatewayIdx, setGatewayIdx] = useState(0);

  const imgUrl = `${IPFS_GATEWAYS[gatewayIdx]}${banner.ipfsHash}`;

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
        width={580}
        height={150}
        className="w-[580px] h-[150px] object-cover opacity-100 transition-opacity duration-1000"
        onError={handleError}
        loading="lazy"
      />
      <Badge
        variant="outline"
        className="absolute top-2 right-2 bg-background/80 text-muted-foreground text-[10px] px-1.5 py-0.5 opacity-60 group-hover:opacity-100 transition-opacity"
      >
        {isShared ? "Ad (Shared)" : "Ad"}
      </Badge>
    </a>
  );
}

function SharedBannerRotator({ banners }: { banners: ActiveBanner[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const primaryBanner = banners[0];
  const secondaryBanner = banners[1];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIdx((prev) => (prev === 0 ? 1 : 0));
    }, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, []);

  const displayBanner = activeIdx === 0 ? primaryBanner : secondaryBanner;

  return (
    <div className="relative">
      <BannerImage banner={displayBanner} isShared={true} />
      <div className="absolute bottom-2 left-2 flex gap-1">
        <div
          className="w-2 h-2 rounded-full bg-white/60 transition-all"
          style={{ opacity: activeIdx === 0 ? 1 : 0.3 }}
        />
        <div
          className="w-2 h-2 rounded-full bg-white/60 transition-all"
          style={{ opacity: activeIdx === 1 ? 1 : 0.3 }}
        />
      </div>
    </div>
  );
}

export function BannerAd() {
  const { data: banners, isLoading } = useBannerAds();

  const hasRealBanners = !isLoading && banners && banners.length > 0;

  // Show placeholder banners when no real ones exist
  if (!hasRealBanners) {
    return (
      <div className="container py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 justify-items-center">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="w-[580px] h-[150px] max-w-full rounded-lg border-2 border-dashed border-cheese/30 bg-cheese/5 flex items-center justify-center"
            >
              <span className="text-cheese/40 text-sm font-medium">Banner Ad — Position {i} (580×150)</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Separate by display mode
  const fullBanners = banners.filter((b) => b.displayMode === "full");
  const sharedBannerPairs = banners.filter((b) => b.displayMode === "shared");

  // Pair shared banners by position (only show one per position, rotating)
  const sharedByPosition = new Map<number, ActiveBanner[]>();
  for (const banner of sharedBannerPairs) {
    const key = banner.position;
    if (!sharedByPosition.has(key)) {
      sharedByPosition.set(key, []);
    }
    sharedByPosition.get(key)!.push(banner);
  }

  const allDisplayBanners = [
    ...fullBanners,
    ...[...sharedByPosition.values()].filter((pair) => pair.length === 2).map((pair) => pair[0]),
  ];

  if (allDisplayBanners.length === 0) return null;

  // 2+ banners: side by side; 1 banner: centered
  if (allDisplayBanners.length >= 2) {
    const displayPair = allDisplayBanners.slice(0, 2);
    return (
      <div className="container py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayPair[0].displayMode === "shared" && sharedByPosition.has(displayPair[0].position) ? (
            <SharedBannerRotator banners={sharedByPosition.get(displayPair[0].position)!} />
          ) : (
            <BannerImage banner={displayPair[0]} />
          )}
          {displayPair[1] ? (
            displayPair[1].displayMode === "shared" && sharedByPosition.has(displayPair[1].position) ? (
              <SharedBannerRotator banners={sharedByPosition.get(displayPair[1].position)!} />
            ) : (
              <BannerImage banner={displayPair[1]} />
            )
          ) : null}
        </div>
      </div>
    );
  }

  const banner = allDisplayBanners[0];
  return (
    <div className="container py-4">
      <div className="max-w-[50%] mx-auto max-md:max-w-full">
        {banner.displayMode === "shared" && sharedByPosition.has(banner.position) ? (
          <SharedBannerRotator banners={sharedByPosition.get(banner.position)!} />
        ) : (
          <BannerImage banner={banner} />
        )}
      </div>
    </div>
  );
}
