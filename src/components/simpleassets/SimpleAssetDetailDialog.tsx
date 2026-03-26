import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { IPFS_GATEWAYS, extractIpfsHash } from '@/lib/ipfsGateways';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';

interface Props {
  asset: SimpleAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SimpleAssetDetailDialog({ asset, open, onOpenChange }: Props) {
  const [showRawJson, setShowRawJson] = useState(false);
  const [gatewayIdx, setGatewayIdx] = useState(0);
  const [imgError, setImgError] = useState(false);

  if (!asset) return null;

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

  const metaFields = Object.entries({ ...asset.idata, ...asset.mdata }).filter(
    ([key]) => !['img', 'image', 'icon', 'name'].includes(key)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{asset.name}</DialogTitle>
          <DialogDescription>
            Asset #{asset.id} · by {asset.author} · {asset.category}
          </DialogDescription>
        </DialogHeader>

        <div className="aspect-square max-h-[400px] bg-muted/30 rounded-lg overflow-hidden flex items-center justify-center">
          <img
            src={displayUrl}
            alt={asset.name}
            className="max-w-full max-h-full object-contain"
            onError={handleImgError}
          />
        </div>

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
