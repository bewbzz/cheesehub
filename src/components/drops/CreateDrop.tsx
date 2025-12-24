import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useWax } from "@/context/WaxContext";
import { buildDropCreationActions, validateDropFormData, DropFormData } from "@/lib/drops";
import { toast } from "sonner";
import { Loader2, Plus, Wallet, Info, Calendar, Image as ImageIcon } from "lucide-react";
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

    setLoading(true);
    try {
      const actions = buildDropCreationActions(String(session.actor), formData);

      await session.transact({ actions });
      
      toast.success("Drop created successfully!");
      
      // Reset form
      setFormData({
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

                  <AccordionItem value="ram" className="border border-border/50 rounded-lg px-4">
                    <AccordionTrigger className="text-sm font-medium hover:no-underline text-cheese">
                      RAM & Boost Requirements
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-foreground space-y-2">
                      <p>
                        Drops on NFT Hive use "mint-on-demand" - NFTs are minted when claimed, not upfront.
                      </p>
                      <p>
                        When you create a drop, we automatically send a <strong className="text-cheese">boost</strong> action 
                        to the <code className="text-cheese">nft.hive</code> contract which reserves RAM for future minting.
                      </p>
                      <p className="text-xs bg-muted/50 p-2 rounded">
                        💡 This is handled automatically - no extra steps needed on your part!
                      </p>
                    </AccordionContent>
                  </AccordionItem>

                </Accordion>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>
        <CardDescription>
          Create an NFT drop priced in CHEESE on NFT Hive. You must have an existing template to create a drop.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleCreate} className="space-y-6">
          {/* Collection & Template */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="collectionName">Collection Name *</Label>
              {userCollections.length > 0 ? (
                <Select
                  value={formData.collectionName}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, collectionName: value }))}
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
                  onChange={(e) => setFormData(prev => ({ ...prev, collectionName: e.target.value.toLowerCase() }))}
                />
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="templateId">Template ID *</Label>
              <Input
                id="templateId"
                placeholder="e.g. 894299"
                value={formData.templateId}
                onChange={(e) => setFormData(prev => ({ ...prev, templateId: e.target.value.replace(/\D/g, '') }))}
              />
            </div>
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
                value={formData.maxClaimable}
                onChange={(e) => setFormData(prev => ({ ...prev, maxClaimable: parseInt(e.target.value) || 1 }))}
              />
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
              <Button variant="ghost" type="button" className="w-full justify-between">
                Advanced Settings
                <span className="text-xs text-muted-foreground">{showAdvanced ? '▲' : '▼'}</span>
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
            Creating a drop requires WAX for RAM. The drop will be live on NFT Hive.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
