import { useState, useEffect, useMemo } from 'react';
import { Loader2, Wallet, Coins, Info, Sparkles, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useWax } from '@/context/WaxContext';
import { toast } from 'sonner';
import { closeWharfkitModals } from '@/lib/wharfKit';
import { TemplatePicker } from './TemplatePicker';
import {
  fetchMintableCollections,
  fetchCollectionTemplates,
  buildMintWithBackingActions,
  validateMintConfig,
  type CollectionInfo,
  type TemplateInfo,
  type MintWithBackingConfig,
} from '@/lib/mintWithBacking';
import { WAX_TOKENS, getTokenConfig } from '@/lib/tokenRegistry';

// Token presets for quick selection
const TOKEN_PRESETS = [
  { key: 'CHEESE', label: '🧀 CHEESE', symbol: 'CHEESE', contract: 'cheeseburger', precision: 4 },
  { key: 'WAX', label: '💎 WAX', symbol: 'WAX', contract: 'eosio.token', precision: 8 },
  { key: 'CUSTOM', label: '⚙️ Custom Token', symbol: '', contract: '', precision: 4 },
] as const;

type TokenPresetKey = typeof TOKEN_PRESETS[number]['key'];

export function MintWithBacking() {
  const { session, isConnected, login, refreshBalance } = useWax();
  const accountName = session?.actor?.toString() || '';

  // Data states
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState(false);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  // Form states
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateInfo | null>(null);
  const [tokenPreset, setTokenPreset] = useState<TokenPresetKey>('CHEESE');
  const [showCustomToken, setShowCustomToken] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [amountPerNFT, setAmountPerNFT] = useState(100);
  const [recipient, setRecipient] = useState('');
  const [customToken, setCustomToken] = useState({ contract: '', symbol: '', precision: 4 });

  // Transaction state
  const [isMinting, setIsMinting] = useState(false);

  // Fetch collections when wallet connects
  useEffect(() => {
    if (accountName) {
      setIsLoadingCollections(true);
      fetchMintableCollections(accountName)
        .then(setCollections)
        .finally(() => setIsLoadingCollections(false));
      setRecipient(accountName); // Default recipient to self
    }
  }, [accountName]);

  // Fetch templates when collection changes
  useEffect(() => {
    if (selectedCollection) {
      setIsLoadingTemplates(true);
      setSelectedTemplate(null);
      fetchCollectionTemplates(selectedCollection)
        .then(setTemplates)
        .finally(() => setIsLoadingTemplates(false));
    } else {
      setTemplates([]);
    }
  }, [selectedCollection]);

  // Get current token details
  const tokenDetails = useMemo(() => {
    if (tokenPreset === 'CUSTOM') {
      return customToken;
    }
    const preset = TOKEN_PRESETS.find((t) => t.key === tokenPreset);
    return preset ? { contract: preset.contract, symbol: preset.symbol, precision: preset.precision } : null;
  }, [tokenPreset, customToken]);

  const totalAmount = amountPerNFT * quantity;

  // Build config for validation and action
  const buildConfig = (): MintWithBackingConfig | null => {
    if (!selectedTemplate || !tokenDetails) return null;
    return {
      collectionName: selectedCollection,
      schemaName: selectedTemplate.schema_name,
      templateId: parseInt(selectedTemplate.template_id),
      recipient: recipient || accountName,
      quantity,
      tokenSymbol: tokenDetails.symbol,
      tokenContract: tokenDetails.contract,
      tokenPrecision: tokenDetails.precision,
      amountPerNFT,
    };
  };

  const handleMint = async () => {
    if (!session) return;

    const config = buildConfig();
    if (!config) {
      toast.error('Please complete all fields');
      return;
    }

    const validationError = validateMintConfig(config);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsMinting(true);
    try {
      const actions = buildMintWithBackingActions(accountName, config, session.permissionLevel);
      await session.transact({ actions } as { actions: typeof actions });

      toast.success(
        `Successfully minted ${quantity} NFT${quantity > 1 ? 's' : ''} with ${totalAmount.toFixed(
          tokenDetails!.precision
        )} ${tokenDetails!.symbol} backing!`
      );

      // Reset selection
      setSelectedTemplate(null);
      setQuantity(1);
      await refreshBalance();
    } catch (error) {
      console.error('Minting failed:', error);
      closeWharfkitModals();

      const errorMessage = error instanceof Error ? error.message : 'Minting failed';
      if (!errorMessage.toLowerCase().includes('cancel')) {
        toast.error('Minting failed', { description: errorMessage });
      }
    } finally {
      setIsMinting(false);
      setTimeout(() => closeWharfkitModals(), 100);
    }
  };

  // Not connected state
  if (!isConnected) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="py-12 text-center">
          <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
          <p className="text-muted-foreground mb-6">
            Connect your WAX wallet to mint NFTs with token backing.
          </p>
          <Button onClick={login} className="bg-cheese hover:bg-cheese/90 text-cheese-foreground">
            Connect Wallet
          </Button>
        </CardContent>
      </Card>
    );
  }

  // No collections state
  if (!isLoadingCollections && collections.length === 0) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="py-12 text-center">
          <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Collections Found</h3>
          <p className="text-muted-foreground mb-6">
            You're not authorized to mint on any collections. Create a collection on AtomicHub first.
          </p>
          <Button variant="outline" asChild>
            <a
              href="https://atomichub.io/creator"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Create Collection on AtomicHub
            </a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Alert */}
      <Alert className="border-cheese/30 bg-cheese/5">
        <Info className="h-4 w-4 text-cheese" />
        <AlertDescription className="text-sm">
          Mint new NFTs from your templates with CHEESE or other tokens locked inside from birth.
          The backed tokens are released when the NFT is burned.
        </AlertDescription>
      </Alert>

      {/* Step 1: Collection Selection */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">1. Select Collection</CardTitle>
          <CardDescription>Choose a collection where you're authorized to mint</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingCollections ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading collections...
            </div>
          ) : (
            <Select value={selectedCollection} onValueChange={setSelectedCollection}>
              <SelectTrigger>
                <SelectValue placeholder="Select a collection" />
              </SelectTrigger>
              <SelectContent>
                {collections.map((col) => (
                  <SelectItem key={col.collection_name} value={col.collection_name}>
                    {col.collection_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Template Selection */}
      {selectedCollection && (
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">2. Select Template</CardTitle>
            <CardDescription>Pick the template you want to mint from</CardDescription>
          </CardHeader>
          <CardContent>
            <TemplatePicker
              templates={templates}
              isLoading={isLoadingTemplates}
              selectedTemplateId={selectedTemplate ? parseInt(selectedTemplate.template_id) : null}
              onSelect={setSelectedTemplate}
            />
          </CardContent>
        </Card>
      )}

      {/* Step 3: Token Configuration */}
      {selectedTemplate && (
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Coins className="h-5 w-5 text-cheese" />
              3. Token Backing
            </CardTitle>
            <CardDescription>Configure the tokens to lock inside each NFT</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Token</Label>
                <Select
                  value={tokenPreset}
                  onValueChange={(v) => {
                    const key = v as TokenPresetKey;
                    setTokenPreset(key);
                    setShowCustomToken(key === 'CUSTOM');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TOKEN_PRESETS.map((t) => (
                      <SelectItem key={t.key} value={t.key}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Amount per NFT</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={amountPerNFT}
                  onChange={(e) => setAmountPerNFT(parseFloat(e.target.value) || 0)}
                  placeholder="100"
                />
              </div>
            </div>

            {/* Custom Token Fields */}
            <Collapsible open={showCustomToken}>
              <CollapsibleContent className="space-y-4 pt-4 border-t border-border/50">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Token Contract</Label>
                    <Input
                      value={customToken.contract}
                      onChange={(e) =>
                        setCustomToken((prev) => ({ ...prev, contract: e.target.value.toLowerCase() }))
                      }
                      placeholder="e.g., cheeseburger"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Symbol</Label>
                    <Input
                      value={customToken.symbol}
                      onChange={(e) =>
                        setCustomToken((prev) => ({ ...prev, symbol: e.target.value.toUpperCase() }))
                      }
                      placeholder="e.g., CHEESE"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Precision</Label>
                    <Input
                      type="number"
                      min="0"
                      max="18"
                      value={customToken.precision}
                      onChange={(e) =>
                        setCustomToken((prev) => ({ ...prev, precision: parseInt(e.target.value) || 4 }))
                      }
                      placeholder="4"
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Mint Details */}
      {selectedTemplate && tokenDetails && tokenDetails.symbol && (
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">4. Mint Details</CardTitle>
            <CardDescription>Set quantity and recipient</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity (1-50)</Label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={quantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    setQuantity(Math.min(50, Math.max(1, val)));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Recipient</Label>
                <Input
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value.toLowerCase())}
                  placeholder={accountName}
                />
                <p className="text-xs text-muted-foreground">Leave as your account or send to someone else</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary & Action */}
      {selectedTemplate && tokenDetails && tokenDetails.symbol && (
        <Card className="bg-cheese/5 border-cheese/30">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <p className="text-sm text-muted-foreground">Total tokens to lock:</p>
                <p className="text-2xl font-bold text-cheese">
                  {totalAmount.toLocaleString(undefined, { maximumFractionDigits: tokenDetails.precision })}{' '}
                  {tokenDetails.symbol}
                </p>
                <p className="text-xs text-muted-foreground">
                  {amountPerNFT} {tokenDetails.symbol} × {quantity} NFT{quantity > 1 ? 's' : ''}
                </p>
              </div>
              <Button
                onClick={handleMint}
                disabled={isMinting || !selectedTemplate}
                size="lg"
                className="bg-cheese hover:bg-cheese/90 text-cheese-foreground min-w-[140px]"
              >
                {isMinting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Minting...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Mint NFTs
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
