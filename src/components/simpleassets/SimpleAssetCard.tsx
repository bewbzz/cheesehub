import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { IPFS_GATEWAYS, extractIpfsHash } from '@/lib/ipfsGateways';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';

interface SimpleAssetCardProps {
  asset: SimpleAsset;
  onClick: () => void;
}

function getMintInfo(asset: SimpleAsset): string | null {
  const combined = { ...asset.idata, ...asset.mdata };
  const mintKeys = ['edition', 'mint', 'serial', 'num', 'mint_num'];

  for (const key of mintKeys) {
    const val = combined[key];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      const str = String(val);
      // "34/356" format — show as-is
      if (str.includes('/')) return str;
      // Check for companion supply field
      const supply = combined.maxsupply ?? combined.max_supply ?? combined.supply;
      if (supply !== undefined && supply !== null) return `#${str} / ${supply}`;
      return `#${str}`;
    }
  }
  return null;
}

export function SimpleAssetCard({ asset, onClick }: SimpleAssetCardProps) {
  const [gatewayIdx, setGatewayIdx] = useState(0);
  const [imgError, setImgError] = useState(false);

  const handleImgError = () => {
    const hash = extractIpfsHash(asset.image);
    if (hash && gatewayIdx < IPFS_GATEWAYS.length - 1) {
      setGatewayIdx((prev) => prev + 1);
    } else {
      setImgError(true);
    }
  };

  const displayUrl = (() => {
    if (imgError) return '/placeholder.svg';
    const hash = extractIpfsHash(asset.image);
    if (hash && gatewayIdx > 0) return `${IPFS_GATEWAYS[gatewayIdx]}${hash}`;
    return asset.image;
  })();

  const mintInfo = getMintInfo(asset);
  const hasContained = (asset.container?.length ?? 0) > 0 || (asset.containerf?.length ?? 0) > 0;

  return (
    <Card
      className="overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-cheese/50 hover:shadow-lg hover:shadow-cheese/10 bg-card border-border"
      onClick={onClick}
    >
      <div className="aspect-square bg-muted/30 flex items-center justify-center overflow-hidden">
        <img
          src={displayUrl}
          alt={asset.name}
          className="w-full h-full object-contain"
          loading="lazy"
          onError={handleImgError}
        />
      </div>
      <CardContent className="p-3 space-y-1">
        <p className="text-sm font-semibold text-foreground truncate">{asset.name}</p>
        <p className="text-xs text-muted-foreground truncate">by {asset.author}</p>
        <div className="flex items-center justify-between">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground">
            {asset.category}
          </span>
          <span className="text-[10px] text-muted-foreground">#{asset.id}</span>
        </div>
        {(mintInfo || hasContained) && (
          <div className="flex items-center gap-1.5 pt-0.5">
            {mintInfo && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                {mintInfo}
              </span>
            )}
            {hasContained && (
              <span className="text-[10px] text-muted-foreground" title="Contains attached assets">
                📎
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
