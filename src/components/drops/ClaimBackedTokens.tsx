import { useState } from 'react';
import { Coins, Loader2, Info, Flame } from 'lucide-react';
import { useWax } from '@/context/WaxContext';
import { buildWaxdaoClaimAction } from '@/lib/tokenBacking';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { closeWharfkitModals, isLoginActive } from '@/lib/wharfKit';

/**
 * Manual claim for WaxDAO backed tokens
 * Use this when backing info failed to load during burn
 * and the claim action wasn't included in the transaction
 */
export function ClaimBackedTokens() {
  const { session, accountName } = useWax();
  const [assetIds, setAssetIds] = useState('');
  const [isClaiming, setIsClaiming] = useState(false);

  const handleClaim = async () => {
    if (!session || !assetIds.trim()) return;

    // Parse asset IDs (comma or space separated)
    const ids = assetIds
      .split(/[\s,]+/)
      .map(id => id.trim())
      .filter(id => id.length > 0 && /^\d+$/.test(id));

    if (ids.length === 0) {
      toast.error('Please enter valid asset IDs (numbers only)');
      return;
    }

    if (ids.length > 100) {
      toast.error('Maximum 100 asset IDs per claim');
      return;
    }

    setIsClaiming(true);
    try {
      const action = buildWaxdaoClaimAction(
        accountName!,
        ids,
        session.permissionLevel
      );

      await session.transact({ actions: [action] as any });
      
      toast.success(`Successfully claimed backed tokens from ${ids.length} NFT(s)!`);
      setAssetIds('');
    } catch (error: any) {
      console.error('Claim failed:', error);
      
      // Check for common errors
      if (error?.message?.includes('no tokens to claim')) {
        toast.error('No tokens to claim for these asset IDs. Either the NFTs were not backed via WaxDAO, or tokens were already claimed.');
      } else if (error?.message?.includes('CPU')) {
        toast.error('Not enough CPU. Power up your account first.', {
          action: {
            label: 'Power Up',
            onClick: () => window.open('/powerup', '_blank'),
          },
        });
      } else {
        toast.error(error?.message || 'Failed to claim tokens');
      }
    } finally {
      setIsClaiming(false);
      if (!isLoginActive()) {
        closeWharfkitModals();
        setTimeout(() => closeWharfkitModals(), 300);
      }
    }
  };

  if (!session) {
    return (
      <div className="text-center py-12">
        <Coins className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Connect Wallet</h3>
        <p className="text-muted-foreground">
          Connect your wallet to claim backed tokens.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert className="border-primary/30 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          <strong>What is this?</strong> If you burned NFTs that had WaxDAO backing but the backing 
          fetch failed during the burn, your backed tokens are still claimable. Enter the asset IDs 
          of the burned NFTs below to claim your tokens.
        </AlertDescription>
      </Alert>

      <Card className="bg-card/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Claim WaxDAO Backed Tokens
          </CardTitle>
          <CardDescription>
            Enter the asset IDs of NFTs you've burned that had WaxDAO backing.
            You can find these IDs in your transaction history.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Asset IDs <span className="text-muted-foreground">(comma or space separated)</span>
            </label>
            <Input
              placeholder="e.g., 123456789, 123456790, 123456791"
              value={assetIds}
              onChange={(e) => setAssetIds(e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Find asset IDs in your burn transaction on{' '}
              <a 
                href={`https://waxblock.io/account/${accountName}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                waxblock.io
              </a>
            </p>
          </div>

          <Button
            onClick={handleClaim}
            disabled={isClaiming || !assetIds.trim()}
            className="w-full gap-2"
          >
            {isClaiming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Coins className="h-4 w-4" />
            )}
            Claim Tokens
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <Flame className="h-4 w-4 text-destructive" />
            How to find your asset IDs
          </h4>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>Go to <a href={`https://waxblock.io/account/${accountName}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">waxblock.io/account/{accountName}</a></li>
            <li>Find your burn transaction (atomicassets::burnasset action)</li>
            <li>Look for the "asset_id" in the action data</li>
            <li>Copy those IDs and paste them above</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
