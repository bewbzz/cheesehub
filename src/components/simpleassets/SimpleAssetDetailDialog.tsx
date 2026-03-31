import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { IPFS_GATEWAYS, extractIpfsHash } from '@/lib/ipfsGateways';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';

interface Props {
  asset: SimpleAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MINT_KEYS = ['edition', 'mint', 'serial', 'num', 'mint_num'];

function getMintDisplay(asset: SimpleAsset): string | null {
  const combined = { ...asset.idata, ...asset.mdata };
  for (const key of MINT_KEYS) {
    const val = combined[key];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      const str = String(val);
      if (str.includes('/')) return str;
      const supply = combined.maxsupply ?? combined.max_supply ?? combined.supply;
      if (supply !== undefined && supply !== null) return `#${str} / ${supply}`;
      return `#${str}`;
    }
  }
  return null;
}

export function SimpleAssetDetailDialog({ asset, open, onOpenChange }: Props) {
  const [showRawJson, setShowRawJson] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [gatewayIndices, setGatewayIndices] = useState<number[]>([]);
  const [imgErrors, setImgErrors] = useState<boolean[]>([]);

  // Reset state when asset changes
  useEffect(() => {
    if (asset) {
      setImageIndex(0);
      setGatewayIndices(new Array(asset.images.length).fill(0));
      setImgErrors(new Array(asset.images.length).fill(false));
      setShowRawJson(false);
    }
  }, [asset?.id]);

  if (!asset) return null;

  const images = asset.images;
  const hasMultiple = images.length > 1;

  const handleImgError = (idx: number) => {
    const hash = extractIpfsHash(images[idx]);
    if (hash && gatewayIndices[idx] < IPFS_GATEWAYS.length - 1) {
      setGatewayIndices((prev) => {
        const next = [...prev];
        next[idx] = (next[idx] || 0) + 1;
        return next;
      });
    } else {
      setImgErrors((prev) => {
        const next = [...prev];
        next[idx] = true;
        return next;
      });
    }
  };

  const getDisplayUrl = (idx: number) => {
    if (imgErrors[idx]) return '/placeholder.svg';
    const gIdx = gatewayIndices[idx] || 0;
    const hash = extractIpfsHash(images[idx]);
    if (hash && gIdx > 0) return `${IPFS_GATEWAYS[gIdx]}${hash}`;
    return images[idx];
  };

  const mintDisplay = getMintDisplay(asset);
  const metaFields = Object.entries({ ...asset.idata, ...asset.mdata }).filter(
    ([key]) => !['img', 'image', 'icon', 'backimg', 'back', 'img2', 'image2', 'backimage', 'name', ...MINT_KEYS, 'maxsupply', 'max_supply', 'supply'].includes(key)
  );
  const hasContainer = asset.container.length > 0;
  const hasContainerf = asset.containerf.length > 0;
  const label = IMAGE_LABELS[imageIndex] || `Image ${imageIndex + 1}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{asset.name}</DialogTitle>
          <DialogDescription>
            Asset #{asset.id} · by {asset.author} · {asset.category}
          </DialogDescription>
        </DialogHeader>

        {/* Image gallery */}
        <div className="relative">
          <div className="aspect-square max-h-[400px] bg-muted/30 rounded-lg overflow-hidden flex items-center justify-center">
            <img
              src={getDisplayUrl(imageIndex)}
              alt={`${asset.name} - ${label}`}
              className="max-w-full max-h-full object-contain"
              onError={() => handleImgError(imageIndex)}
            />
          </div>

          {hasMultiple && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8 bg-background/70 hover:bg-background/90 rounded-full"
                onClick={() => setImageIndex((prev) => (prev - 1 + images.length) % images.length)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 bg-background/70 hover:bg-background/90 rounded-full"
                onClick={() => setImageIndex((prev) => (prev + 1) % images.length)}
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          )}

          {/* Label + dots */}
          {hasMultiple && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="text-xs font-semibold text-muted-foreground">{label}</span>
              <div className="flex gap-1">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setImageIndex(i)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      i === imageIndex ? 'bg-primary' : 'bg-muted-foreground/30'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {mintDisplay && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Mint</span>
            <span className="text-sm font-mono text-primary">{mintDisplay}</span>
          </div>
        )}

        {metaFields.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Metadata</h4>
            <div className="grid grid-cols-2 gap-2">
              {metaFields.map(([key, value]) => (
                <div key={key} className="bg-muted/30 rounded p-2">
                  <span className="text-[10px] text-muted-foreground uppercase">{key}</span>
                  <p className="text-sm text-foreground truncate">{String(value)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {(hasContainer || hasContainerf) && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">📎 Contained Assets</h4>
            {hasContainer && (
              <div className="bg-muted/30 rounded p-2">
                <span className="text-[10px] text-muted-foreground uppercase">NFTs ({asset.container.length})</span>
                <p className="text-xs text-foreground break-all">
                  {asset.container.map((c) => (typeof c === 'object' ? JSON.stringify(c) : String(c))).join(', ')}
                </p>
              </div>
            )}
            {hasContainerf && (
              <div className="bg-muted/30 rounded p-2">
                <span className="text-[10px] text-muted-foreground uppercase">FTs ({asset.containerf.length})</span>
                <p className="text-xs text-foreground break-all">
                  {asset.containerf.map((c) => (typeof c === 'object' ? JSON.stringify(c) : String(c))).join(', ')}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground">Owner: {asset.owner}</span>
          <Button variant="ghost" size="sm" onClick={() => setShowRawJson(!showRawJson)}>
            {showRawJson ? 'Hide' : 'Show'} Raw JSON
          </Button>
        </div>

        {showRawJson && (
          <div className="space-y-2">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">idata</p>
              <pre className="text-xs bg-muted/30 rounded p-3 overflow-x-auto text-foreground">
                {JSON.stringify(asset.idata, null, 2)}
              </pre>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">mdata</p>
              <pre className="text-xs bg-muted/30 rounded p-3 overflow-x-auto text-foreground">
                {JSON.stringify(asset.mdata, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
