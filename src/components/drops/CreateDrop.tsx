import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useWax } from "@/context/WaxContext";
import { buildDropCreationActions, validateDropFormData, fetchCollectionRamBalance, DropFormData, DropType, TokenBacking, RamBalance } from "@/lib/drops";
import { closeWharfkitModals } from "@/lib/wharfKit";
import { toast } from "sonner";
import { Loader2, Plus, Wallet, Info, Calendar, Image as ImageIcon, Package, Zap, Check, Coins, X, HardDrive, AlertTriangle } from "lucide-react";
import { ManageRamDialog } from "./ManageRamDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchUserCollections, fetchTemplateById } from "@/services/atomicApi";
import { useQuery } from "@tanstack/react-query";
import { TokenPriceInput, PriceOption } from "./TokenPriceInput";
import { PremintNFTPicker } from "./PremintNFTPicker";

const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';

export function CreateDrop() {
  const { session, isConnected, login } = useWax();
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [templatePreview, setTemplatePreview] = useState<{
    name: string;
    image: string;
    maxSupply: number;
    issuedSupply: number;
  } | null>(null);
  
  const accountName = session?.actor?.toString() || '';

  const { data: userCollections = [] } = useQuery({
    queryKey: ['userCollections', accountName],
    queryFn: () => fetchUserCollections(accountName),
    enabled: !!accountName,
  });

  const [formData, setFormData] = useState<DropFormData>({
    dropType: 'mint-on-demand',
    collectionName: "",
    templateId: "",
    name: "",
    description: "",
    prices: [{ token: 'CHEESE', amount: 0 }],
    maxClaimable: 0,
    accountLimit: 1,
    startTime: new Date(),
    endTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    isHidden: false,
    priceRecipient: "",
    assetIds: [],
    tokensToBack: [],
  });

  // RAM balance tracking for mint-on-demand drops
  const [ramBalance, setRamBalance] = useState<RamBalance | null>(null);
  const [loadingRamBalance, setLoadingRamBalance] = useState(false);

  // ~151 bytes per NFT for mint-on-demand (consistent with ManageRamDialog)
  const BYTES_PER_NFT = 151;
  const WAX_PER_KB = 0.01; // Approximate cost

  // Fetch RAM balance when collection changes for mint-on-demand
  const fetchRamBalanceForCollection = useCallback(async (collectionName: string) => {
    if (!collectionName) {
      setRamBalance(null);
      return;
    }
    setLoadingRamBalance(true);
    try {
      const balance = await fetchCollectionRamBalance(collectionName);
      setRamBalance(balance);
    } catch (error) {
      console.error('Failed to fetch RAM balance:', error);
      setRamBalance(null);
    } finally {
      setLoadingRamBalance(false);
    }
  }, []);

  useEffect(() => {
    if (formData.dropType === 'mint-on-demand' && formData.collectionName) {
      fetchRamBalanceForCollection(formData.collectionName);
    } else {
      setRamBalance(null);
    }
  }, [formData.collectionName, formData.dropType, fetchRamBalanceForCollection]);

  // Calculate RAM shortage for mint-on-demand drops
  const ramShortage = (() => {
    if (formData.dropType !== 'mint-on-demand' || formData.maxClaimable <= 0) {
      return null;
    }
    
    const requiredBytes = formData.maxClaimable * BYTES_PER_NFT;
    const availableBytes = ramBalance?.bytes || 0;
    
    if (availableBytes >= requiredBytes) {
      return null; // Sufficient RAM
    }
    
    const shortageBytes = requiredBytes - availableBytes;
    const availableNFTs = Math.floor(availableBytes / BYTES_PER_NFT);
    const estimatedWax = (shortageBytes / 1024) * WAX_PER_KB;
    
    return {
      shortageBytes,
      availableNFTs,
      availableBytes,
      requiredBytes,
      estimatedWax: estimatedWax.toFixed(2),
    };
  })();

  // Handle asset selection change for premint
  const handleAssetSelectionChange = (assetIds: string[]) => {
    setFormData(prev => ({ ...prev, assetIds }));
  };

  // Fetch template preview when templateId changes
  useEffect(() => {
    const fetchTemplate = async () => {
      if (!formData.templateId || !formData.collectionName) {
        setTemplatePreview(null);
        return;
      }

      try {
        const template = await fetchTemplateById(formData.templateId, formData.collectionName);
        if (template) {
          setTemplatePreview(template);
          // Auto-fill name if empty
          if (!formData.name && template.name) {
            setFormData(prev => ({ ...prev, name: template.name }));
          }
        } else {
          setTemplatePreview(null);
        }
      } catch {
        setTemplatePreview(null);
      }
    };

    const debounce = setTimeout(fetchTemplate, 500);
    return () => clearTimeout(debounce);
  }, [formData.templateId, formData.collectionName, formData.name]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    
    if (!session) {
      toast.error("Please connect your wallet first");
      return;
    }

    const validationError = validateDropFormData(formData);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    // For pre-mint, set maxClaimable to asset count
    const submissionData = {
      ...formData,
      maxClaimable: formData.dropType === 'premint' ? formData.assetIds.length : formData.maxClaimable,
    };

    setLoading(true);
    try {
      const actions = buildDropCreationActions(String(session.actor), submissionData);

      // Debug: Log the complete actions array before submitting
      console.log('🧀 Submitting drop creation with actions:', JSON.stringify(actions, null, 2));

      await session.transact({ actions });

      toast.success("Drop created successfully!");
      
      // Reset form
      setFormData({
        dropType: 'mint-on-demand',
        collectionName: "",
        templateId: "",
        name: "",
        description: "",
        prices: [{ token: 'CHEESE', amount: 0 }],
        maxClaimable: 0,
        accountLimit: 1,
        startTime: new Date(),
        endTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isHidden: false,
        priceRecipient: "",
        assetIds: [],
        tokensToBack: [],
      });
      setRamBalance(null);
      setTemplatePreview(null);
    } catch (error) {
      closeWharfkitModals();
      console.error("Failed to create drop:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create drop");
    } finally {
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
      setLoading(false);
    }
  }

  if (!isConnected) {
    return (
      <Card className="max-w-2xl mx-auto bg-card/50 border-border/50">
        <CardContent className="py-12 text-center">
          <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
          <p className="text-muted-foreground mb-6">
            You need to connect your WAX wallet to create a drop.
          </p>
          <Button onClick={login} className="bg-cheese hover:bg-cheese/90 text-cheese-foreground">
            Connect Wallet
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto bg-card/50 border-border/50">
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-cheese" />
            Create a New Drop
          </CardTitle>
          <ManageRamDialog />
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="p-1.5 h-auto hover:bg-cheese/10 flex items-center gap-1.5">
                <Info className="h-6 w-6 text-cheese hover:text-cheese/80 transition-colors" />
                <span className="text-xs text-cheese font-medium">click me for help</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <Info className="h-5 w-5 text-cheese" />
                  Drop Creation Guide
                </DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[65vh] pr-4">
                <Accordion type="multiple" defaultValue={["overview", "template"]} className="space-y-2">
                  
                  <AccordionItem value="overview" className="border border-border/50 rounded-lg px-4">
                    <AccordionTrigger className="text-sm font-medium hover:no-underline text-cheese">
                      What is a Drop?
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-foreground space-y-2">
                      <p>
                        A drop is a way to sell NFTs at a fixed price. When users claim your drop, 
                        they receive a freshly minted NFT from your specified template.
                      </p>
                      <p>
                        Drops are powered by the <strong className="text-cheese">nfthivedrops</strong> smart contract 
                        and can be priced in various tokens including <strong className="text-cheese">CHEESE</strong>, WAX, and others.
                      </p>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="template" className="border border-border/50 rounded-lg px-4">
                    <AccordionTrigger className="text-sm font-medium hover:no-underline text-cheese">
                      Template ID
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-foreground space-y-2">
                      <p>
                        The template ID is the blueprint for the NFT you want to sell. You can find this on:
                      </p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li><a href="https://wax.atomichub.io" target="_blank" rel="noopener noreferrer" className="text-cheese hover:underline">AtomicHub</a> - Go to your collection → Templates</li>
                        <li><a href="https://nfthive.io" target="_blank" rel="noopener noreferrer" className="text-cheese hover:underline">NFT Hive</a> - View your collection's templates</li>
                      </ul>
                      <p className="text-xs bg-muted/50 p-2 rounded">
                        Example: <code className="text-cheese">894299</code>
                      </p>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="supply" className="border border-border/50 rounded-lg px-4">
                    <AccordionTrigger className="text-sm font-medium hover:no-underline text-cheese">
                      Supply Settings
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-foreground space-y-4">
                      <div>
                        <p className="font-medium text-cheese">Max Claimable</p>
                        <p className="text-xs mt-1">
                          The total number of NFTs that can be minted from this drop. 
                          Set this to match your template's remaining supply.
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-cheese">Account Limit</p>
                        <p className="text-xs mt-1">
                          Maximum NFTs a single wallet can claim. Set to 1 for fair distribution, 
                          or higher to allow bulk purchases.
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="timing" className="border border-border/50 rounded-lg px-4">
                    <AccordionTrigger className="text-sm font-medium hover:no-underline text-cheese">
                      Start & End Time
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-foreground space-y-2">
                      <p>
                        Control when your drop is available for purchase:
                      </p>
                      <ul className="list-disc list-inside space-y-1 ml-2 text-xs">
                        <li><strong>Start Time:</strong> When users can begin claiming</li>
                        <li><strong>End Time:</strong> When the drop closes (even if supply remains)</li>
                      </ul>
                      <p className="text-xs">
                        All times are in your local timezone.
                      </p>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="advanced" className="border border-border/50 rounded-lg px-4">
                    <AccordionTrigger className="text-sm font-medium hover:no-underline text-cheese">
                      Advanced Settings
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-foreground space-y-4">
                      <div>
                        <p className="font-medium text-cheese">Price Recipient</p>
                        <p className="text-xs mt-1">
                          The WAX account that receives the CHEESE payments. 
                          Defaults to your connected wallet if left empty.
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-cheese">Hide from Listings</p>
                        <p className="text-xs mt-1">
                          When enabled, your drop won't appear in public listings. 
                          Useful for exclusive drops shared via direct link.
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="backing" className="border border-border/50 rounded-lg px-4">
                    <AccordionTrigger className="text-sm font-medium hover:no-underline text-muted-foreground">
                      Token Backing (Coming Soon)
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-foreground space-y-2">
                      <p className="text-xs bg-amber-500/10 text-amber-500 p-2 rounded">
                        <strong>Note:</strong> Token backing for drops is not yet supported by the nfthivedrops smart contract. 
                        This feature is planned for a future update.
                      </p>
                      <p className="mt-2">
                        Token backing would allow you to lock WAX or CHEESE tokens inside each NFT. 
                        When the NFT is burned, the backed tokens are released to the burner.
                      </p>
                      <p className="font-medium text-muted-foreground mt-3">Planned use cases:</p>
                      <ul className="list-disc list-inside space-y-1 ml-2 text-xs text-muted-foreground">
                        <li>Give your NFTs intrinsic value</li>
                        <li>Create "treasure" NFTs with hidden rewards</li>
                        <li>Incentivize burning for token recycling</li>
                        <li>Build deflationary mechanics</li>
                      </ul>
                      <p className="text-xs bg-muted/50 p-2 rounded mt-2">
                        <strong>Alternative:</strong> For token-infused NFTs now, try the{' '}
                        <a href="https://nfthive.io/pack" target="_blank" rel="noopener noreferrer" className="text-cheese hover:underline">
                          NFTHive Pack Creator
                        </a>.
                      </p>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="ram" className="border border-border/50 rounded-lg px-4">
                    <AccordionTrigger className="text-sm font-medium hover:no-underline text-cheese">
                      Mint-on-Demand vs Pre-mint
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-foreground space-y-4">
                      <div>
                        <p className="font-medium text-cheese">Mint-on-Demand (Recommended)</p>
                        <ul className="text-xs mt-1 list-disc list-inside space-y-1 ml-2">
                          <li>NFTs are created automatically when buyers claim</li>
                          <li>Requires WAX RAM (handled automatically via boost action)</li>
                          <li>Just specify a template ID and max supply</li>
                          <li>Best for: Most drops, especially large supplies</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-medium text-cheese">Pre-mint</p>
                        <ul className="text-xs mt-1 list-disc list-inside space-y-1 ml-2">
                          <li>Use NFTs you've already minted</li>
                          <li>No RAM required - NFTs already exist</li>
                          <li>Full control over exact mint numbers</li>
                          <li>Best for: Specific serialized NFTs, backed NFTs, rare 1/1s</li>
                        </ul>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                </Accordion>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>
        <CardDescription>
          Create an NFT drop priced in CHEESE on NFT Hive.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleCreate} className="space-y-6">
          {/* Drop Type Selector */}
          <div className="space-y-3">
            <Label>Drop Type</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, dropType: 'mint-on-demand', assetIds: [] }))}
                className={cn(
                  "flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-all",
                  formData.dropType === 'mint-on-demand'
                    ? "border-cheese bg-cheese/10"
                    : "border-border/50 hover:border-cheese/50"
                )}
              >
                <div className={cn(
                  "rounded-full p-2",
                  formData.dropType === 'mint-on-demand' ? "bg-cheese/20" : "bg-muted"
                )}>
                  <Zap className={cn(
                    "h-5 w-5",
                    formData.dropType === 'mint-on-demand' ? "text-cheese" : "text-muted-foreground"
                  )} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Mint-on-Demand</span>
                    <span className="text-[10px] bg-cheese/20 text-cheese px-1.5 py-0.5 rounded">Recommended</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    NFTs are created when buyers claim. Just specify a template.
                  </p>
                </div>
                {formData.dropType === 'mint-on-demand' && (
                  <Check className="h-5 w-5 text-cheese" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, dropType: 'premint', templateId: '' }))}
                className={cn(
                  "flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-all",
                  formData.dropType === 'premint'
                    ? "border-cheese bg-cheese/10"
                    : "border-border/50 hover:border-cheese/50"
                )}
              >
                <div className={cn(
                  "rounded-full p-2",
                  formData.dropType === 'premint' ? "bg-cheese/20" : "bg-muted"
                )}>
                  <Package className={cn(
                    "h-5 w-5",
                    formData.dropType === 'premint' ? "text-cheese" : "text-muted-foreground"
                  )} />
                </div>
                <div className="flex-1">
                  <span className="font-medium">Pre-mint</span>
                  <p className="text-xs text-muted-foreground mt-1">
                    Use existing NFTs from your wallet. No RAM needed.
                  </p>
                </div>
                {formData.dropType === 'premint' && (
                  <Check className="h-5 w-5 text-cheese" />
                )}
              </button>
            </div>
          </div>

          {/* Collection Selection */}
          <div className="space-y-2">
            <Label htmlFor="collectionName">Collection Name *</Label>
            {userCollections.length > 0 ? (
              <Select
                value={formData.collectionName}
                onValueChange={(value) => setFormData(prev => ({ ...prev, collectionName: value, assetIds: [] }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select collection" />
                </SelectTrigger>
                <SelectContent>
                  {userCollections.map((collection) => (
                    <SelectItem key={collection} value={collection}>
                      {collection}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="collectionName"
                placeholder="e.g. cheesenftwax"
                value={formData.collectionName}
                onChange={(e) => setFormData(prev => ({ ...prev, collectionName: e.target.value.toLowerCase(), assetIds: [] }))}
              />
            )}
          </div>

          {/* Template ID - Only for Mint-on-Demand */}
          {formData.dropType === 'mint-on-demand' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="templateId">Template ID *</Label>
                <Input
                  id="templateId"
                  placeholder="e.g. 894299"
                  value={formData.templateId}
                  onChange={(e) => setFormData(prev => ({ ...prev, templateId: e.target.value.replace(/\D/g, '') }))}
                />
              </div>

              {/* Template Preview */}
              {templatePreview && (
                <div className="flex items-center gap-4 p-4 rounded-lg border border-cheese/30 bg-cheese/5">
                  <div className="relative h-20 w-20 rounded-lg overflow-hidden bg-muted">
                    <img 
                      src={templatePreview.image} 
                      alt={templatePreview.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-cheese" />
                      <span className="font-medium">{templatePreview.name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Supply: {templatePreview.issuedSupply} / {templatePreview.maxSupply === 0 ? '∞' : templatePreview.maxSupply}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* NFT Picker - Only for Pre-mint */}
          {formData.dropType === 'premint' && (
            <div className="space-y-3">
              <Label>Select NFTs to Drop *</Label>
              <PremintNFTPicker
                collectionName={formData.collectionName}
                selectedAssetIds={formData.assetIds}
                onSelectionChange={handleAssetSelectionChange}
              />
            </div>
          )}

          {/* Drop Name & Description */}
          <div className="space-y-2">
            <Label htmlFor="name">Drop Name *</Label>
            <Input
              id="name"
              placeholder="e.g. Limited Edition Cheese Mug"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe your drop..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Pricing */}
          <TokenPriceInput
            prices={formData.prices}
            onChange={(prices) => setFormData(prev => ({ ...prev, prices }))}
            minPrices={1}
            maxPrices={10}
          />

          {/* Supply Settings */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="maxClaimable">Max Claimable *</Label>
              <Input
                id="maxClaimable"
                type="number"
                min="0"
                placeholder="e.g. 100"
                value={formData.dropType === 'premint' ? formData.assetIds.length : formData.maxClaimable}
                disabled={formData.dropType === 'premint'}
                onChange={(e) => setFormData(prev => ({ ...prev, maxClaimable: parseInt(e.target.value) || 0 }))}
              />
              {formData.dropType === 'premint' && (
                <p className="text-xs text-muted-foreground">
                  Auto-set based on selected NFTs
                </p>
              )}
              {/* RAM Warning for Mint-on-Demand */}
              {formData.dropType === 'mint-on-demand' && loadingRamBalance && formData.collectionName && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Checking RAM balance...
                </div>
              )}
              {formData.dropType === 'mint-on-demand' && ramShortage && !loadingRamBalance && (
                <div className="mt-2 p-3 rounded-lg border border-destructive/50 bg-destructive/10 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-destructive">
                        Insufficient RAM allocated
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Your collection has ~{ramShortage.availableNFTs} NFTs worth of RAM ({ramShortage.availableBytes.toLocaleString()} bytes) 
                        but you're creating a drop for {formData.maxClaimable} NFTs.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Shortfall:</span> ~{ramShortage.shortageBytes.toLocaleString()} bytes 
                        (approximately {ramShortage.estimatedWax} WAX)
                      </p>
                      <p className="text-xs text-cheese font-medium mt-2">
                        Use <span className="underline">Manage RAM</span> at the top of this page to deposit more before creating this drop.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="accountLimit">Account Limit *</Label>
              <Input
                id="accountLimit"
                type="number"
                min="1"
                placeholder="e.g. 1"
                value={formData.accountLimit}
                onChange={(e) => setFormData(prev => ({ ...prev, accountLimit: parseInt(e.target.value) || 1 }))}
              />
            </div>
          </div>

          {/* Date/Time Pickers */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Start Date & Time *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.startTime && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {formData.startTime ? format(formData.startTime, "PPP p") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={formData.startTime}
                    onSelect={(date) => date && setFormData(prev => ({ ...prev, startTime: date }))}
                    initialFocus
                    className="pointer-events-auto"
                  />
                  <div className="p-3 border-t">
                    <Input
                      type="time"
                      value={format(formData.startTime, "HH:mm")}
                      onChange={(e) => {
                        const [hours, minutes] = e.target.value.split(':');
                        const newDate = new Date(formData.startTime);
                        newDate.setHours(parseInt(hours), parseInt(minutes));
                        setFormData(prev => ({ ...prev, startTime: newDate }));
                      }}
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date & Time *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.endTime && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {formData.endTime ? format(formData.endTime, "PPP p") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={formData.endTime}
                    onSelect={(date) => date && setFormData(prev => ({ ...prev, endTime: date }))}
                    initialFocus
                    className="pointer-events-auto"
                  />
                  <div className="p-3 border-t">
                    <Input
                      type="time"
                      value={format(formData.endTime, "HH:mm")}
                      onChange={(e) => {
                        const [hours, minutes] = e.target.value.split(':');
                        const newDate = new Date(formData.endTime);
                        newDate.setHours(parseInt(hours), parseInt(minutes));
                        setFormData(prev => ({ ...prev, endTime: newDate }));
                      }}
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Advanced Settings */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" type="button" className="w-full justify-between bg-cheese/20 hover:bg-cheese/30 text-cheese border border-cheese/30">
                Advanced Settings
                <span className="text-xs">{showAdvanced ? '▲' : '▼'}</span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="priceRecipient">Price Recipient</Label>
                <Input
                  id="priceRecipient"
                  placeholder={`Leave empty to use ${accountName}`}
                  value={formData.priceRecipient}
                  onChange={(e) => setFormData(prev => ({ ...prev, priceRecipient: e.target.value.toLowerCase() }))}
                />
                <p className="text-xs text-muted-foreground">
                  WAX account that receives the CHEESE payments
                </p>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/50 p-4">
                <div>
                  <Label htmlFor="isHidden">Hide from Listings</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Drop won't appear in public listings
                  </p>
                </div>
                <Switch
                  id="isHidden"
                  checked={formData.isHidden}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isHidden: checked }))}
                />
              </div>

              {/* Token Backing - Coming Soon */}
              {formData.dropType === 'mint-on-demand' && (
                <div className="space-y-3 rounded-lg border border-border/30 p-4 opacity-60">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Coins className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-muted-foreground">Token Backing</Label>
                      <span className="text-[10px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded font-medium">
                        Coming Soon
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Lock tokens inside each NFT. Released when burned.
                  </p>
                  <p className="text-xs bg-amber-500/10 text-amber-500 p-2 rounded">
                    Token backing is not yet supported by the nfthivedrops contract. 
                    For token-infused NFTs, try the{' '}
                    <a 
                      href="https://nfthive.io/pack" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="underline hover:text-amber-400"
                    >
                      NFTHive Pack Creator
                    </a>.
                  </p>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Submit Button */}
          <Button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-cheese hover:bg-cheese/90 text-cheese-foreground"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Drop...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Create Drop
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            {formData.dropType === 'premint' 
              ? 'Your NFTs will be transferred to the drop contract. The drop will be live on NFT Hive.'
              : 'Creating a drop requires WAX for RAM. The drop will be live on NFT Hive.'
            }
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
