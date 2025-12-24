import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useWax } from "@/context/WaxContext";
import { buildDropCreationActions, validateDropFormData, DropFormData, DropType, TokenBacking } from "@/lib/drops";
import { toast } from "sonner";
import { Loader2, Plus, Wallet, Info, Calendar, Image as ImageIcon, Package, Zap, Check, Coins, X } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchUserCollections, fetchTemplateById, fetchUserAssets } from "@/services/atomicApi";
import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";

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
    price: 0,
    maxClaimable: 100,
    accountLimit: 1,
    startTime: new Date(),
    endTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    isHidden: false,
    priceRecipient: "",
    assetIds: [],
    tokensToBack: [],
  });

  // Fetch user's NFTs for pre-mint when collection is selected
  const { data: userAssets = [], isLoading: assetsLoading } = useQuery({
    queryKey: ['userAssets', accountName, formData.collectionName],
    queryFn: () => fetchUserAssets(accountName, formData.collectionName || undefined),
    enabled: !!accountName && formData.dropType === 'premint',
  });

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
        price: 0,
        maxClaimable: 100,
        accountLimit: 1,
        startTime: new Date(),
        endTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isHidden: false,
        priceRecipient: "",
        assetIds: [],
        tokensToBack: [],
      });
      setTemplatePreview(null);
    } catch (error) {
      console.error("Failed to create drop:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create drop");
    } finally {
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
                        and all sales are priced in <strong className="text-cheese">CHEESE</strong> tokens.
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
                    <AccordionTrigger className="text-sm font-medium hover:no-underline text-cheese">
                      Token Backing
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-foreground space-y-2">
                      <p>
                        Token backing allows you to lock WAX or CHEESE tokens inside each NFT. 
                        When the NFT is burned, the backed tokens are released to the burner.
                      </p>
                      <p className="font-medium text-cheese mt-3">Use cases:</p>
                      <ul className="list-disc list-inside space-y-1 ml-2 text-xs">
                        <li>Give your NFTs intrinsic value</li>
                        <li>Create "treasure" NFTs with hidden rewards</li>
                        <li>Incentivize burning for token recycling</li>
                        <li>Build deflationary mechanics</li>
                      </ul>
                      <p className="text-xs bg-muted/50 p-2 rounded mt-2">
                        <strong>Note:</strong> Only available for Mint-on-Demand drops. 
                        The tokens are locked when each NFT is minted.
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
              {!formData.collectionName ? (
                <div className="p-6 border border-dashed border-border/50 rounded-lg text-center">
                  <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Select a collection first to see your NFTs
                  </p>
                </div>
              ) : assetsLoading ? (
                <div className="p-6 border border-dashed border-border/50 rounded-lg text-center">
                  <Loader2 className="h-8 w-8 mx-auto text-cheese animate-spin mb-2" />
                  <p className="text-sm text-muted-foreground">Loading your NFTs...</p>
                </div>
              ) : userAssets.length === 0 ? (
                <div className="p-6 border border-dashed border-border/50 rounded-lg text-center">
                  <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No NFTs found in this collection
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">
                      {formData.assetIds.length} of {userAssets.length} selected
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (formData.assetIds.length === userAssets.length) {
                          setFormData(prev => ({ ...prev, assetIds: [] }));
                        } else {
                          setFormData(prev => ({ ...prev, assetIds: userAssets.map(a => a.asset_id) }));
                        }
                      }}
                    >
                      {formData.assetIds.length === userAssets.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>
                  <ScrollArea className="h-64 border border-border/50 rounded-lg">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2">
                      {userAssets.map((asset) => {
                        const isSelected = formData.assetIds.includes(asset.asset_id);
                        return (
                          <button
                            key={asset.asset_id}
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                assetIds: isSelected
                                  ? prev.assetIds.filter(id => id !== asset.asset_id)
                                  : [...prev.assetIds, asset.asset_id],
                              }));
                            }}
                            className={cn(
                              "relative flex flex-col items-center p-2 rounded-lg border-2 transition-all",
                              isSelected
                                ? "border-cheese bg-cheese/10"
                                : "border-transparent bg-muted/50 hover:border-cheese/50"
                            )}
                          >
                            <div className="relative w-full aspect-square rounded overflow-hidden mb-2">
                              <img
                                src={asset.image}
                                alt={asset.name}
                                className="w-full h-full object-cover"
                              />
                              {isSelected && (
                                <div className="absolute inset-0 bg-cheese/20 flex items-center justify-center">
                                  <Check className="h-8 w-8 text-cheese" />
                                </div>
                              )}
                            </div>
                            <span className="text-xs font-medium truncate w-full text-center">
                              {asset.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              #{asset.mint || asset.asset_id}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                  <p className="text-xs text-muted-foreground">
                    These NFTs will be transferred to the drop contract when you create the drop.
                  </p>
                </>
              )}
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

          {/* Price & Supply */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="price">Price (CHEESE) *</Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.0001"
                placeholder="e.g. 1500"
                value={formData.price || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="maxClaimable">Max Claimable *</Label>
              <Input
                id="maxClaimable"
                type="number"
                min="1"
                placeholder="e.g. 100"
                value={formData.dropType === 'premint' ? formData.assetIds.length : formData.maxClaimable}
                disabled={formData.dropType === 'premint'}
                onChange={(e) => setFormData(prev => ({ ...prev, maxClaimable: parseInt(e.target.value) || 1 }))}
              />
              {formData.dropType === 'premint' && (
                <p className="text-xs text-muted-foreground">
                  Auto-set based on selected NFTs
                </p>
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

              {/* Token Backing - Only for Mint-on-Demand */}
              {formData.dropType === 'mint-on-demand' && (
                <div className="space-y-3 rounded-lg border border-border/50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Coins className="h-4 w-4 text-cheese" />
                      <Label>Token Backing</Label>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        tokensToBack: [...prev.tokensToBack, { symbol: 'CHEESE', amount: '' }]
                      }))}
                      className="h-7 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Token
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Lock tokens inside each NFT. Released when burned.
                  </p>
                  
                  {formData.tokensToBack.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic text-center py-2">
                      No token backing configured
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {formData.tokensToBack.map((token, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Select
                            value={token.symbol}
                            onValueChange={(value) => {
                              const updated = [...formData.tokensToBack];
                              updated[index] = { ...updated[index], symbol: value };
                              setFormData(prev => ({ ...prev, tokensToBack: updated }));
                            }}
                          >
                            <SelectTrigger className="w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CHEESE">CHEESE</SelectItem>
                              <SelectItem value="WAX">WAX</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            min="0"
                            step="0.0001"
                            placeholder="Amount per NFT"
                            value={token.amount}
                            onChange={(e) => {
                              const updated = [...formData.tokensToBack];
                              updated[index] = { ...updated[index], amount: e.target.value };
                              setFormData(prev => ({ ...prev, tokensToBack: updated }));
                            }}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const updated = formData.tokensToBack.filter((_, i) => i !== index);
                              setFormData(prev => ({ ...prev, tokensToBack: updated }));
                            }}
                            className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {formData.tokensToBack.length > 0 && formData.maxClaimable > 0 && (
                    <div className="text-xs bg-cheese/10 text-cheese p-2 rounded">
                      Total tokens needed: {formData.tokensToBack.map(t => {
                        const amount = parseFloat(t.amount) || 0;
                        const total = amount * formData.maxClaimable;
                        return `${total.toLocaleString()} ${t.symbol}`;
                      }).join(' + ')}
                    </div>
                  )}
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
