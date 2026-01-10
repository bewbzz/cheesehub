import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useWax } from "@/context/WaxContext";
import { buildCreateDaoAction, buildDaoCreationFeeAction, buildAssertPointAction, buildSetProfileAction, DAO_CONTRACT, PROPOSER_TYPES, DAO_TYPES } from "@/lib/dao";
import { toast } from "sonner";
import { closeWharfkitModals } from "@/lib/wharfKit";
import { Loader2, Plus, Wallet, ChevronDown, ChevronUp, HelpCircle, Info, Trash2 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { FeePaymentSelector } from "@/components/shared/FeePaymentSelector";
import {
  CHEESE_FEE_ENABLED,
  PaymentMethod,
  buildCheesePrepayAction,
  buildProvideWaxAction,
  WAX_FEE_AMOUNT,
} from "@/lib/cheeseFees";

// DAO Type descriptions for the selector
const DAO_TYPE_DESCRIPTIONS: Record<number, { short: string; long: string }> = {
  1: {
    short: "Stake NFTs to a V1 WaxDAO NFT Farm",
    long: "Members stake their NFTs to an existing V1 WaxDAO NFT farm (waxdaofarmer contract). Voting power is based on the number of NFTs staked. Requires an existing V1 NFT farm."
  },
  2: {
    short: "Stake Tokens to a V1 WaxDAO Token Farm",
    long: "Members stake tokens to an existing V1 WaxDAO token farm (waxdaofarmer contract). Voting power equals staked token amount. Requires an existing V1 token farm."
  },
  3: {
    short: "Stake to External V1 WaxDAO Pool",
    long: "Stakes to an external V1 WaxDAO farmer pool. Similar to Type 2 but uses external pool reference. Requires V1 farm."
  },
  4: {
    short: "Stake Tokens to DAO (Custodial)",
    long: "Members stake governance tokens directly to the DAO contract. Tokens are held custodially until unstaked. Voting power equals staked balance. No external farm needed."
  },
  5: {
    short: "Hold NFTs (Non-Custodial)",
    long: "NFTs stay in user's wallet - no staking required! Simply hold eligible NFTs to vote. Each NFT = 1 vote. Most user-friendly for NFT communities."
  },
};

export function CreateDao() {
  const { session, isConnected, login } = useWax();
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // CHEESE payment state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("wax");
  const [cheeseAmount, setCheeseAmount] = useState("");
  const [hasPrepaid, setHasPrepaid] = useState(false);
  
  const handleCheeseAmountChange = useCallback((amount: string) => {
    setCheeseAmount(amount);
  }, []);
  
  const [formData, setFormData] = useState({
    daoName: "",
    description: "",
    avatar: "",
    coverImage: "",
    // DAO Type selection (default to Type 4)
    daoType: 4,
    // For Type 4: Token Staking
    tokenContract: "",
    tokenSymbol: "",
    // For Types 1, 2, 3: Farm-based DAOs
    govFarmName: "",
    // For Types 1, 2, 5: NFT collections/schemas
    govSchemas: [] as { collection_name: string; schema_name: string }[],
    // Advanced settings
    threshold: 51,
    proposerType: 1,
    authors: "",
    minimumVotes: 1,
    minimumWeight: 0,
    proposalCost: 0,
    hoursPerProposal: 72,
  });
  
  // Temp state for adding new schema
  const [newSchema, setNewSchema] = useState({ collection_name: "", schema_name: "" });

  // Determine which fields to show based on DAO type
  const showTokenFields = formData.daoType === 4;
  const showFarmField = [1, 2, 3].includes(formData.daoType);
  const showSchemaFields = [1, 2, 5].includes(formData.daoType);

  function addSchema() {
    if (newSchema.collection_name.trim() && newSchema.schema_name.trim()) {
      setFormData({
        ...formData,
        govSchemas: [...formData.govSchemas, { 
          collection_name: newSchema.collection_name.trim().toLowerCase(),
          schema_name: newSchema.schema_name.trim().toLowerCase()
        }]
      });
      setNewSchema({ collection_name: "", schema_name: "" });
    }
  }

  function removeSchema(index: number) {
    setFormData({
      ...formData,
      govSchemas: formData.govSchemas.filter((_, i) => i !== index)
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    
    if (!session) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!formData.daoName.trim()) {
      toast.error("DAO name is required");
      return;
    }

    // Validate based on DAO type
    if (showTokenFields && (!formData.tokenContract.trim() || !formData.tokenSymbol.trim())) {
      toast.error("Token contract and symbol are required for Token Staking DAOs");
      return;
    }

    if (showFarmField && !formData.govFarmName.trim()) {
      toast.error("Farm name is required for Farm-based DAOs");
      return;
    }

    if (showSchemaFields && formData.govSchemas.length === 0) {
      toast.error("At least one collection/schema pair is required for NFT DAOs");
      return;
    }

    // Parse authors from comma-separated string
    const authorsArray = formData.authors
      .split(",")
      .map(a => a.trim().toLowerCase())
      .filter(a => a.length > 0);

    // Validate authors if proposer type is "Authors Only"
    if (formData.proposerType === 0 && authorsArray.length === 0) {
      toast.error("At least one author is required when using 'Authors Only' proposer type");
      return;
    }

    setLoading(true);
    try {
      const accountName = String(session.actor);
      
      // Build assertpoint action (required before createdao)
      const assertAction = buildAssertPointAction(accountName);
      
      // Build fee payment action (250 WAX)
      const feeAction = buildDaoCreationFeeAction(accountName);
      
      // Build DAO creation action with all type-specific fields
      const createAction = buildCreateDaoAction(
        accountName,
        {
          daoName: formData.daoName,
          daoType: formData.daoType,
          tokenContract: formData.tokenContract,
          tokenSymbol: formData.tokenSymbol,
          govFarmName: formData.govFarmName,
          govSchemas: formData.govSchemas,
          threshold: formData.threshold,
          hoursPerProposal: formData.hoursPerProposal,
          minimumWeight: formData.minimumWeight,
          minimumVotes: formData.minimumVotes,
          proposerType: formData.proposerType,
          authors: authorsArray,
          proposalCost: formData.proposalCost,
        }
      );

      // Handle CHEESE payment flow
      if (CHEESE_FEE_ENABLED && paymentMethod === "cheese") {
        // TX 1: Send CHEESE to cheesefeefee (if not already prepaid)
        if (!hasPrepaid) {
          const prepayAction = buildCheesePrepayAction(
            accountName,
            cheeseAmount,
            "dao",
            formData.daoName
          );
          await session.transact({ actions: [prepayAction] });
          setHasPrepaid(true);
          toast.success("CHEESE prepayment sent! Now creating DAO...");
        }
        
        // TX 2: Bundled creation with providewax
        const provideWaxAction = buildProvideWaxAction(accountName, "dao", formData.daoName);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const actions: any[] = [provideWaxAction, assertAction, feeAction, createAction];
        await session.transact({ actions });
      } else {
        // Standard WAX payment (unchanged)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const actions: any[] = [assertAction, feeAction, createAction];
        await session.transact({ actions });
      }
      
      toast.success("DAO created successfully!");
      setFormData({
        daoName: "",
        description: "",
        avatar: "",
        coverImage: "",
        daoType: 4,
        tokenContract: "",
        tokenSymbol: "",
        govFarmName: "",
        govSchemas: [],
        threshold: 51,
        proposerType: 1,
        authors: "",
        minimumVotes: 1,
        minimumWeight: 0,
        proposalCost: 0,
        hoursPerProposal: 72,
      });
      setPaymentMethod("wax");
      setHasPrepaid(false);
    } catch (error) {
      console.error("Failed to create DAO:", error);
      closeWharfkitModals();
      toast.error(error instanceof Error ? error.message : "Failed to create DAO");
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
            You need to connect your WAX wallet to create a DAO.
          </p>
          <Button onClick={login} className="bg-cheese hover:bg-cheese/90 text-cheese-foreground">
            Connect Wallet
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className="max-w-2xl mx-auto bg-card/50 border-border/50">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-cheese" />
              Create a New DAO
            </CardTitle>
            <div className="flex items-center gap-1.5">
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
                      DAO Creation Guide
                    </DialogTitle>
                  </DialogHeader>
                  <ScrollArea className="max-h-[65vh] pr-4">
                    <Accordion type="multiple" defaultValue={["dao-types", "settings"]} className="space-y-2">
                      
                      <AccordionItem value="dao-name" className="border border-border/50 rounded-lg px-4">
                        <AccordionTrigger className="text-sm font-medium hover:no-underline text-cheese">
                          DAO Name Format
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-foreground space-y-2">
                          <p>
                            Your DAO name must follow the WAX account name format:
                          </p>
                          <ul className="list-disc list-inside space-y-1 ml-2">
                            <li>Maximum 12 characters</li>
                            <li>Only lowercase letters <code className="text-cheese">a-z</code></li>
                            <li>Numbers <code className="text-cheese">1-5</code> only (no 0, 6, 7, 8, 9)</li>
                            <li>Periods <code className="text-cheese">.</code> are allowed</li>
                            <li>No capitals, spaces, or special characters</li>
                          </ul>
                          <p className="text-xs bg-muted/50 p-2 rounded">
                            Example: <code className="text-cheese">cheesedao</code>, <code className="text-cheese">my.dao.123</code>
                          </p>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="dao-types" className="border border-border/50 rounded-lg px-4">
                        <AccordionTrigger className="text-sm font-medium hover:no-underline text-cheese">
                          DAO Types Explained
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-foreground space-y-3">
                          <p className="font-medium">WaxDAO supports 5 different DAO types:</p>
                          
                          <div className="space-y-3">
                            <div className="p-2 rounded border border-amber-500/30 bg-amber-500/5">
                              <p className="font-medium text-amber-500">Type 1: Custodial NFT Farm (V1)</p>
                              <p className="text-xs mt-1">
                                Requires an existing <strong>V1 WaxDAO NFT farm</strong> (waxdaofarmer contract). 
                                Members stake NFTs to that farm to gain voting power. V2 farms are NOT compatible.
                              </p>
                            </div>
                            
                            <div className="p-2 rounded border border-amber-500/30 bg-amber-500/5">
                              <p className="font-medium text-amber-500">Type 2: Custodial Token Farm (V1)</p>
                              <p className="text-xs mt-1">
                                Requires an existing <strong>V1 WaxDAO token farm</strong> (waxdaofarmer contract). 
                                Members stake tokens to that farm for voting power. V2 farms are NOT compatible.
                              </p>
                            </div>
                            
                            <div className="p-2 rounded border border-amber-500/30 bg-amber-500/5">
                              <p className="font-medium text-amber-500">Type 3: Stake to V1 WaxDAO Pool</p>
                              <p className="text-xs mt-1">
                                Similar to Type 2, uses external V1 WaxDAO farmer pool reference. 
                                Requires existing V1 farm.
                              </p>
                            </div>
                            
                            <div className="p-2 rounded border border-cheese/50 bg-cheese/5">
                              <p className="font-medium text-cheese">Type 4: Stake Tokens (Custodial) ⭐ Popular</p>
                              <p className="text-xs mt-1">
                                Members stake governance tokens directly to the DAO. <strong>No external farm needed.</strong>
                                Tokens are held by the DAO contract until unstaked.
                              </p>
                            </div>
                            
                            <div className="p-2 rounded border border-green-500/50 bg-green-500/5">
                              <p className="font-medium text-green-500">Type 5: Hold NFTs (Non-Custodial) 🆕 Easiest</p>
                              <p className="text-xs mt-1">
                                <strong>No staking required!</strong> NFTs stay in user's wallet. 
                                Simply hold eligible NFTs to vote. Each NFT = 1 vote. 
                                Best for NFT communities.
                              </p>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="settings" className="border border-border/50 rounded-lg px-4">
                        <AccordionTrigger className="text-sm font-medium hover:no-underline text-cheese">
                          Configuration Settings
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-foreground space-y-4">
                          
                          <div>
                            <p className="font-medium text-cheese">Threshold</p>
                            <p className="text-xs mt-1">
                              The percentage of "Yes" votes required for a proposal to pass. 
                              A 51% threshold means a simple majority is needed. Higher thresholds 
                              require broader consensus but can make it harder to pass proposals.
                            </p>
                          </div>

                          <div>
                            <p className="font-medium text-cheese">Minimum Votes</p>
                            <p className="text-xs mt-1">
                              The minimum total vote weight needed for a proposal to be valid. 
                              This prevents proposals from passing with very few participants. 
                              Vote weight equals token balance in wallets. For example, if set to 1000, 
                              at least 1000 tokens worth of votes must be cast before the result counts.
                            </p>
                          </div>

                          <div>
                            <p className="font-medium text-cheese">Voting Duration</p>
                            <p className="text-xs mt-1">
                              How long voting stays open for each proposal. Common durations are 
                              24 hours (quick decisions), 72 hours (standard), or 168 hours (1 week for major decisions).
                            </p>
                          </div>

                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="proposer-types" className="border border-border/50 rounded-lg px-4">
                        <AccordionTrigger className="text-sm font-medium hover:no-underline text-cheese">
                          Proposer Types
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-foreground space-y-3">
                          <p>Control who can create proposals in your DAO:</p>
                          
                          <div className="space-y-2">
                            <div className="p-2 rounded border border-border/50">
                              <p className="font-medium text-cheese">Anyone</p>
                              <p className="text-xs mt-1">
                                Any WAX wallet can create proposals. Most democratic but may require 
                                proposal fees to prevent spam.
                              </p>
                            </div>
                            
                            <div className="p-2 rounded border border-border/50">
                              <p className="font-medium text-cheese">Authors Only</p>
                              <p className="text-xs mt-1">
                                Only wallets you specifically authorize can create proposals. 
                                Good for curated governance with trusted community members.
                              </p>
                            </div>
                            
                            <div className="p-2 rounded border border-border/50">
                              <p className="font-medium text-cheese">Token Balance</p>
                              <p className="text-xs mt-1">
                                Users must hold a minimum token balance in their wallet to create proposals. 
                                Ensures proposers have skin in the game.
                              </p>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="proposal-cost" className="border border-border/50 rounded-lg px-4">
                        <AccordionTrigger className="text-sm font-medium hover:no-underline text-cheese">
                          Proposal Cost
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-foreground space-y-2">
                          <p>
                            An optional WAX fee required to submit a proposal. This fee goes directly 
                            to your DAO's treasury and serves two purposes:
                          </p>
                          <ul className="list-disc list-inside space-y-1 ml-2 text-xs">
                            <li>Prevents spam proposals</li>
                            <li>Generates treasury revenue</li>
                          </ul>
                          <p className="text-xs">
                            Set to 0 for free proposals. Common values range from 1-100 WAX depending 
                            on how exclusive you want proposal creation to be.
                          </p>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="treasury" className="border border-border/50 rounded-lg px-4">
                        <AccordionTrigger className="text-sm font-medium hover:no-underline text-cheese">
                          Treasury & Deposits
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-foreground space-y-2">
                          <p>
                            After creating your DAO, you can deposit WAX, tokens, and NFTs to the treasury. 
                            These assets can then be distributed through governance proposals.
                          </p>
                          <p className="text-xs">
                            Treasury deposits are managed separately from the creation process. 
                            Visit your DAO's detail page after creation to make deposits.
                          </p>
                      </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="ipfs" className="border border-border/50 rounded-lg px-4">
                        <AccordionTrigger className="text-sm font-medium hover:no-underline text-cheese">
                          IPFS Hash (Avatar & Cover Image)
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-foreground space-y-2">
                          <p>
                            These are your DAO's logos - the <strong className="text-cheese">cover image</strong> is a large background pic, 
                            and the <strong className="text-cheese">avatar</strong> should be a small (e.g. 300 x 300) pic.
                          </p>
                          <p>
                            Both should be <strong className="text-cheese">IPFS hash only</strong>, do NOT put the full URL.
                          </p>
                          <p className="text-xs bg-muted/50 p-2 rounded">
                            Example hash: <code className="text-cheese">QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco</code>
                          </p>
                          <p className="text-xs">
                            Supported formats: <code className="text-cheese">jpeg</code> and <code className="text-cheese">png</code>
                          </p>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="modify" className="border border-border/50 rounded-lg px-4">
                        <AccordionTrigger className="text-sm font-medium hover:no-underline text-cheese">
                          Modifying Settings Later
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-foreground">
                          <p>
                            Once created, DAO settings <strong className="text-cheese">cannot be changed</strong>. 
                            Please review all configuration options carefully before submitting. Choose wisely!
                          </p>
                        </AccordionContent>
                      </AccordionItem>

                    </Accordion>
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <CardDescription className="space-y-2">
            <span className="block">
              Set up your decentralized autonomous organization on the WAX blockchain.
            </span>
            <span className="block text-xs">
              Contract: <code className="text-cheese">{DAO_CONTRACT}</code>
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-6">
            
            {/* DAO Type Selection */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">DAO Type</h3>
              <RadioGroup
                value={String(formData.daoType)}
                onValueChange={(value) => setFormData({ ...formData, daoType: parseInt(value) })}
                className="grid grid-cols-1 gap-2"
              >
                {[4, 5, 1, 2, 3].map((type) => (
                  <div 
                    key={type}
                    className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                      formData.daoType === type 
                        ? type === 5 
                          ? "border-green-500/50 bg-green-500/10" 
                          : "border-cheese/50 bg-cheese/10"
                        : "border-border/50 hover:bg-muted/30"
                    }`}
                    onClick={() => setFormData({ ...formData, daoType: type })}
                  >
                    <RadioGroupItem value={String(type)} id={`type-${type}`} className="mt-1" />
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`type-${type}`} className="font-medium cursor-pointer">
                          {DAO_TYPES[type]}
                        </Label>
                        {type === 4 && <Badge variant="secondary" className="text-xs">Popular</Badge>}
                        {type === 5 && <Badge className="text-xs bg-green-500/20 text-green-500 border-green-500/30">Easiest</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {DAO_TYPE_DESCRIPTIONS[type]?.short}
                      </p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Basic Info Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Basic Info</h3>
              
              {/* DAO Name */}
              <div className="space-y-2">
                <Label htmlFor="daoName">DAO Name *</Label>
                <Input
                  id="daoName"
                  placeholder="e.g., cheesedao"
                  value={formData.daoName}
                  onChange={(e) => setFormData({ ...formData, daoName: e.target.value.toLowerCase() })}
                  maxLength={12}
                  className="lowercase"
                />
                <p className="text-xs text-muted-foreground">
                  Max 12 characters, lowercase letters and numbers only (WAX account name format)
                </p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your DAO's purpose and goals..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              {/* IPFS Images */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="avatar">Avatar (IPFS Hash)</Label>
                  <Input
                    id="avatar"
                    placeholder="e.g., QmXoypiz..."
                    value={formData.avatar}
                    onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Small image (300x300), IPFS hash only
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coverImage">Cover Image (IPFS Hash)</Label>
                  <Input
                    id="coverImage"
                    placeholder="e.g., QmXoypiz..."
                    value={formData.coverImage}
                    onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Large background image, IPFS hash only
                  </p>
                </div>
              </div>
            </div>

            {/* Token Settings (Type 4 only) */}
            {showTokenFields && (
              <div className="space-y-4 p-4 bg-cheese/5 rounded-lg border border-cheese/30">
                <h3 className="text-sm font-medium text-cheese uppercase tracking-wide">Governance Token</h3>
                
                {/* Token Contract */}
                <div className="space-y-2">
                  <Label htmlFor="tokenContract">Token Contract *</Label>
                  <Input
                    id="tokenContract"
                    placeholder="e.g., eosio.token"
                    value={formData.tokenContract}
                    onChange={(e) => setFormData({ ...formData, tokenContract: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    The contract that holds your governance token
                  </p>
                </div>

                {/* Token Symbol */}
                <div className="space-y-2">
                  <Label htmlFor="tokenSymbol">Token Symbol *</Label>
                  <Input
                    id="tokenSymbol"
                    placeholder="e.g., 8,CHEESE"
                    value={formData.tokenSymbol}
                    onChange={(e) => setFormData({ ...formData, tokenSymbol: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Format: precision,SYMBOL (e.g., 8,CHEESE)
                  </p>
                </div>
              </div>
            )}

            {/* Farm Name (Types 1, 2, 3) */}
            {showFarmField && (
              <div className="space-y-4 p-4 bg-blue-500/5 rounded-lg border border-blue-500/30">
                <h3 className="text-sm font-medium text-blue-500 uppercase tracking-wide">WaxDAO Farm</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="govFarmName">Farm Name *</Label>
                  <Input
                    id="govFarmName"
                    placeholder="e.g., myfarm"
                    value={formData.govFarmName}
                    onChange={(e) => setFormData({ ...formData, govFarmName: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    The name of your existing WaxDAO farmer pool
                  </p>
                </div>
              </div>
            )}

            {/* NFT Collections/Schemas (Types 1, 2, 5) */}
            {showSchemaFields && (
              <div className="space-y-4 p-4 bg-green-500/5 rounded-lg border border-green-500/30">
                <h3 className="text-sm font-medium text-green-500 uppercase tracking-wide">
                  Eligible NFT Collections
                </h3>
                <p className="text-xs text-muted-foreground">
                  {formData.daoType === 5 
                    ? "Users holding NFTs from these collections can vote. Each NFT = 1 vote."
                    : "NFTs from these collections can be staked for voting power."}
                </p>
                
                {/* Current schemas */}
                {formData.govSchemas.length > 0 && (
                  <div className="space-y-2">
                    {formData.govSchemas.map((schema, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-background/50 rounded border border-border/50">
                        <Badge variant="outline" className="flex-1">
                          {schema.collection_name} / {schema.schema_name}
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSchema(idx)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Add new schema */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Collection Name</Label>
                    <Input
                      placeholder="e.g., cheesenfts"
                      value={newSchema.collection_name}
                      onChange={(e) => setNewSchema({ ...newSchema, collection_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Schema Name</Label>
                    <Input
                      placeholder="e.g., cards"
                      value={newSchema.schema_name}
                      onChange={(e) => setNewSchema({ ...newSchema, schema_name: e.target.value })}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addSchema}
                  disabled={!newSchema.collection_name.trim() || !newSchema.schema_name.trim()}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Collection/Schema
                </Button>
              </div>
            )}

            {/* Advanced Settings */}
            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <CollapsibleTrigger asChild>
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="w-full justify-between border border-border/50 hover:bg-muted/50"
                >
                  <span className="text-sm font-medium">Advanced Settings</span>
                  {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-6 pt-4">
                
                {/* Voting Rules Section */}
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Voting Rules</h3>
                  
                  {/* Threshold */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Label>Pass Threshold: {formData.threshold}%</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>The percentage of "Yes" votes required for a proposal to pass. 51% means a simple majority is needed.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Slider
                      value={[formData.threshold]}
                      onValueChange={([value]) => setFormData({ ...formData, threshold: value })}
                      min={1}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>1%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* Minimum Votes */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="minimumVotes">Minimum Vote Weight</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>The minimum total vote weight required for a proposal to be valid. This prevents proposals from passing with very few votes.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      id="minimumVotes"
                      type="number"
                      min={1}
                      value={formData.minimumVotes}
                      onChange={(e) => setFormData({ ...formData, minimumVotes: parseInt(e.target.value) || 1 })}
                    />
                  </div>

                  {/* Hours Per Proposal */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="hoursPerProposal">Voting Duration (hours)</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>How long voting stays open for each proposal. Common values: 24 hours (1 day), 72 hours (3 days), 168 hours (1 week).</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      id="hoursPerProposal"
                      type="number"
                      min={1}
                      value={formData.hoursPerProposal}
                      onChange={(e) => setFormData({ ...formData, hoursPerProposal: parseInt(e.target.value) || 72 })}
                    />
                    <p className="text-xs text-muted-foreground">
                      {formData.hoursPerProposal} hours = {(formData.hoursPerProposal / 24).toFixed(1)} days
                    </p>
                  </div>
                </div>

                {/* Proposal Permissions Section */}
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Proposal Permissions</h3>
                  
                  {/* Proposer Type */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Label>Who Can Create Proposals?</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Controls who is allowed to submit new proposals to your DAO.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <RadioGroup
                      value={String(formData.proposerType)}
                      onValueChange={(value) => setFormData({ ...formData, proposerType: parseInt(value) })}
                      className="space-y-2"
                    >
                      <div className="flex items-start space-x-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                        <RadioGroupItem value="1" id="proposer-anyone" className="mt-1" />
                        <div className="space-y-1">
                          <Label htmlFor="proposer-anyone" className="font-medium cursor-pointer">
                            {PROPOSER_TYPES[1]}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Any WAX wallet can create proposals. Most open and democratic option.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                        <RadioGroupItem value="0" id="proposer-authors" className="mt-1" />
                        <div className="space-y-1">
                          <Label htmlFor="proposer-authors" className="font-medium cursor-pointer">
                            {PROPOSER_TYPES[0]}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Only specific wallets you authorize can create proposals.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                        <RadioGroupItem value="2" id="proposer-stake" className="mt-1" />
                        <div className="space-y-1">
                          <Label htmlFor="proposer-stake" className="font-medium cursor-pointer">
                            {PROPOSER_TYPES[2]}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Must hold a minimum amount of governance tokens to create proposals.
                          </p>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Authors (conditional) */}
                  {formData.proposerType === 0 && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                      <Label htmlFor="authors">Authorized Authors</Label>
                      <Textarea
                        id="authors"
                        placeholder="wallet1.wam, wallet2.wam, wallet3.wam"
                        value={formData.authors}
                        onChange={(e) => setFormData({ ...formData, authors: e.target.value })}
                        rows={2}
                      />
                      <p className="text-xs text-muted-foreground">
                        Comma-separated list of WAX wallet addresses allowed to create proposals
                      </p>
                    </div>
                  )}

                  {/* Minimum Weight (conditional) */}
                  {formData.proposerType === 2 && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="minimumWeight">Minimum Token Balance</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>The minimum amount of governance tokens a user must hold to be able to create proposals.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input
                        id="minimumWeight"
                        type="number"
                        min={0}
                        value={formData.minimumWeight}
                        onChange={(e) => setFormData({ ...formData, minimumWeight: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  )}

                  {/* Proposal Cost */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="proposalCost">Proposal Submission Fee (WAX)</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>WAX fee required to submit a proposal. This goes to the DAO treasury and helps prevent spam. Set to 0 for free proposals.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="relative">
                      <Input
                        id="proposalCost"
                        type="number"
                        min={0}
                        step={0.1}
                        value={formData.proposalCost}
                        onChange={(e) => setFormData({ ...formData, proposalCost: parseFloat(e.target.value) || 0 })}
                        className="pr-12"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        WAX
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Set to 0 for free proposals
                    </p>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Creation Fee Section */}
            <FeePaymentSelector
              waxFee={WAX_FEE_AMOUNT}
              feeType="dao"
              entityName={formData.daoName}
              selectedMethod={paymentMethod}
              onMethodChange={setPaymentMethod}
              onCheeseAmountChange={handleCheeseAmountChange}
              disabled={loading}
            />

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading || !formData.daoName.trim()}
              className="w-full bg-cheese hover:bg-cheese/90 text-cheese-foreground"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating DAO...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create DAO (250 WAX)
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
