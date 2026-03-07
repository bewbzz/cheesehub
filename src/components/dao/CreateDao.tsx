import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useWax } from "@/context/WaxContext";
import { buildCreateDaoAction, buildAssertPointAction, buildSetProfileActionWithSocials, DAO_CONTRACT, PROPOSER_TYPES, DAO_TYPES } from "@/lib/dao";
import { toast } from "sonner";
import { closeWharfkitModals, getTransactPlugins } from "@/lib/wharfKit";
import { Loader2, Plus, Wallet, ChevronDown, ChevronUp, HelpCircle, Info, Trash2, Globe, Youtube, BookOpen, AlertTriangle } from "lucide-react";
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
  buildCheesePaymentAction,
  buildWaxdaoFeeAction,
  buildWaxPaymentAction,
  WAX_FEE_AMOUNT,
  CHEESE_DISCOUNT,
} from "@/lib/cheeseFees";
import { useWaxdaoFeePricing } from "@/hooks/useWaxdaoFeePricing";
import { useCheeseFeePricing } from "@/hooks/useCheeseFeePricing";

// DAO Type descriptions for the selector (only Type 4 and 5 available)
const DAO_TYPE_DESCRIPTIONS: Record<number, { short: string; long: string }> = {
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
  const [helpOpen, setHelpOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSocials, setShowSocials] = useState(false);
  
  // Payment state - null until user selects
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [cheeseAmount, setCheeseAmount] = useState("");
  const [waxdaoAmount, setWaxdaoAmount] = useState("");
  
  // Pricing hooks
  const waxdaoPricing = useWaxdaoFeePricing();
  const cheesePricing = useCheeseFeePricing(WAX_FEE_AMOUNT);
  
  const handleCheeseAmountChange = useCallback((amount: string) => {
    setCheeseAmount(amount);
  }, []);
  
  const handleWaxdaoAmountChange = useCallback((amount: string) => {
    setWaxdaoAmount(amount);
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
    // Social links
    twitter: "",
    discord: "",
    telegram: "",
    website: "",
    youtube: "",
    medium: "",
  });
  
  // Temp state for adding new schema
  const [newSchema, setNewSchema] = useState({ collection_name: "", schema_name: "" });

  // Determine which fields to show based on DAO type (only Type 4 and 5 available)
  const showTokenFields = formData.daoType === 4;
  const showSchemaFields = formData.daoType === 5;

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

    // Validate payment method is selected
    if (!paymentMethod) {
      toast.error("Please select a payment method");
      return;
    }

    setLoading(true);
    try {
      const accountName = String(session.actor);
      
      // Build assertpoint action (required before createdao)
      const assertAction = buildAssertPointAction(accountName);
      
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

      // Build setprofile action for DAO metadata (description, avatar, cover, socials)
      const setProfileAction = buildSetProfileActionWithSocials(
        accountName,
        formData.daoName,
        formData.description,
        formData.avatar,
        formData.coverImage,
        {
          twitter: formData.twitter.trim(),
          discord: formData.discord.trim(),
          telegram: formData.telegram.trim(),
          website: formData.website.trim(),
          youtube: formData.youtube.trim(),
          medium: formData.medium.trim(),
          atomichub: "",
          waxdao: "",
        }
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let actions: any[];

      if (paymentMethod === "cheese" && CHEESE_FEE_ENABLED) {
        // CHEESE payment flow - Single atomic transaction
        // 1. User sends CHEESE → contract sends WAXDAO back (inline) and burns CHEESE (inline)
        // 2. User pays WAXDAO to dao.waxdao
        // 3. Assert point
        // 4. Create DAO
        // 5. Set profile
        
        if (!cheesePricing.isAvailable || !waxdaoPricing.isAvailable) {
          toast.error("Pricing data not available. Please try again.");
          setLoading(false);
          return;
        }
        
        const cheesePayAction = buildCheesePaymentAction(
          accountName,
          cheeseAmount || cheesePricing.formattedForTx,
          "dao",
          formData.daoName
        );
        
        const waxdaoFeeAction = buildWaxdaoFeeAction(
          accountName,
          DAO_CONTRACT,
          waxdaoAmount || waxdaoPricing.formattedForTx,
          "|dao_payment|"
        );
        
        actions = [
          cheesePayAction,  // 1. User sends CHEESE, contract sends WAXDAO back + burns CHEESE (inline)
          assertAction,     // 2. Assert point (must come before fee payment)
          waxdaoFeeAction,  // 3. User pays WAXDAO to dao.waxdao
          createAction,     // 4. Create DAO
          setProfileAction, // 5. Set DAO profile
        ];
      } else {
        // WAX payment routed through cheesefeefee
        // 1. Send 265 WAX → contract sends WAXDAO to user + 50 WAX to cheeseburner (inline)
        // 2. Assert point
        // 3. User pays WAXDAO to dao.waxdao
        // 4. Create DAO
        // 5. Set profile
        
        if (!waxdaoPricing.isAvailable) {
          toast.error("WAXDAO pricing data not available. Please try again.");
          setLoading(false);
          return;
        }
        
        const waxPayAction = buildWaxPaymentAction(
          accountName,
          "dao",
          formData.daoName
        );
        
        const waxdaoFeeAction = buildWaxdaoFeeAction(
          accountName,
          DAO_CONTRACT,
          waxdaoAmount || waxdaoPricing.formattedForTx,
          "|dao_payment|"
        );
        
        actions = [
          waxPayAction,     // 1. Send WAX to cheesefeefee, contract sends WAXDAO + burns WAX
          assertAction,     // 2. Assert point
          waxdaoFeeAction,  // 3. User pays WAXDAO to dao.waxdao
          createAction,     // 4. Create DAO
          setProfileAction, // 5. Set DAO profile
        ];
      }
      
      await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
      
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
        twitter: "",
        discord: "",
        telegram: "",
        website: "",
        youtube: "",
        medium: "",
      });
      setPaymentMethod(null);
      setShowSocials(false);
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
              <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
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
                    <Accordion type="multiple" defaultValue={["cheese-payment", "dao-types", "settings"]} className="space-y-2">
                      
                      <AccordionItem value="cheese-payment" className="border border-border/50 rounded-lg px-4">
                        <AccordionTrigger className="text-sm font-medium hover:no-underline text-cheese">
                          <span className="flex items-center gap-2">
                            Paying with CHEESE Tokens
                            {!CHEESE_FEE_ENABLED && (
                              <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                            )}
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-foreground space-y-2">
                          <p>
                            You can <strong className="text-cheese">pay with CHEESE tokens</strong> and receive a 
                            <strong className="text-green-500"> 20% discount</strong> on the {WAX_FEE_AMOUNT} WAX creation fee.
                          </p>
                          <p>
                            Simply select the CHEESE payment option and the transaction will handle everything 
                            automatically in a single step - no prepayment required!
                          </p>
                        </AccordionContent>
                      </AccordionItem>

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
                          <p className="font-medium">CHEESEDao supports 2 DAO types:</p>
                          
                          <div className="space-y-3">
                            <div className="p-2 rounded border border-cheese/50 bg-cheese/5">
                              <p className="font-medium text-cheese">Stake Tokens (Custodial)</p>
                              <p className="text-xs mt-1">
                                Members stake governance tokens directly to the DAO. <strong>No external farm needed.</strong>
                                Tokens are held by the DAO contract until unstaked. Voting power equals staked balance.
                              </p>
                            </div>
                            
                            <div className="p-2 rounded border border-green-500/50 bg-green-500/5">
                              <p className="font-medium text-green-500">Hold NFTs (Non-Custodial)</p>
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

                      <AccordionItem value="anchor-warning" className="border border-amber-500/30 rounded-lg px-4 bg-amber-500/5">
                        <AccordionTrigger className="text-sm font-medium hover:no-underline text-amber-500">
                          Why does Anchor show a "Dangerous Transaction" warning?
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-foreground space-y-2">
                          <p>
                            This transaction includes <strong className="text-cheese">inline actions</strong> from the 
                            <code className="text-cheese"> cheesefeefee</code> smart contract — it sends WAXDAO tokens to your 
                            wallet and burns fees automatically. These are standard, safe operations and the contract is open source.
                          </p>
                          <p className="font-medium">To proceed in Anchor Wallet:</p>
                          <ol className="list-decimal list-inside space-y-1 ml-2 text-xs">
                            <li>Tap the gear/settings icon</li>
                            <li>Toggle <strong>"Allow Dangerous Transactions"</strong> ON</li>
                            <li>Sign the transaction</li>
                            <li>Optionally toggle it back OFF afterward</li>
                          </ol>
                          <p className="text-xs bg-muted/50 p-2 rounded">
                            Some versions of Anchor also show an <strong>"Allow for this transaction only"</strong> checkbox — you can use that instead.
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
                {[4, 5].map((type) => (
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
                          {DAO_TYPE_DESCRIPTIONS[type]?.short || `Type ${type}`}
                        </Label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {DAO_TYPE_DESCRIPTIONS[type]?.long}
                      </p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Basic Information</h3>
              
              {/* DAO Name */}
              <div className="space-y-2">
                <Label htmlFor="daoName">DAO Name *</Label>
                <Input
                  id="daoName"
                  placeholder="e.g., cheesedao"
                  value={formData.daoName}
                  onChange={(e) => setFormData({ ...formData, daoName: e.target.value.toLowerCase() })}
                  maxLength={12}
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

            {/* Social Links Section */}
            <Collapsible open={showSocials} onOpenChange={setShowSocials}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  type="button"
                  className={`w-full justify-between border-cheese/50 text-cheese hover:bg-cheese/10 ${
                    !showSocials ? "animate-pulse" : ""
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Social Links (Optional)
                  </span>
                  {showSocials ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 space-y-4 p-4 border border-cheese/30 rounded-lg bg-cheese/5">
                <p className="text-xs text-muted-foreground">
                  Add social links for your DAO. All links should be full URLs.
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Twitter */}
                  <div className="space-y-2">
                    <Label htmlFor="twitter" className="flex items-center gap-2">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                      Twitter / X
                    </Label>
                    <Input
                      id="twitter"
                      placeholder="https://x.com/yourdao"
                      value={formData.twitter}
                      onChange={(e) => setFormData({ ...formData, twitter: e.target.value })}
                    />
                  </div>

                  {/* Discord */}
                  <div className="space-y-2">
                    <Label htmlFor="discord" className="flex items-center gap-2">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                      </svg>
                      Discord
                    </Label>
                    <Input
                      id="discord"
                      placeholder="https://discord.gg/invite"
                      value={formData.discord}
                      onChange={(e) => setFormData({ ...formData, discord: e.target.value })}
                    />
                  </div>

                  {/* Telegram */}
                  <div className="space-y-2">
                    <Label htmlFor="telegram" className="flex items-center gap-2">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                      </svg>
                      Telegram
                    </Label>
                    <Input
                      id="telegram"
                      placeholder="https://t.me/yourdao"
                      value={formData.telegram}
                      onChange={(e) => setFormData({ ...formData, telegram: e.target.value })}
                    />
                  </div>

                  {/* Website */}
                  <div className="space-y-2">
                    <Label htmlFor="website" className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Website
                    </Label>
                    <Input
                      id="website"
                      placeholder="https://yourdao.com"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    />
                  </div>

                  {/* YouTube */}
                  <div className="space-y-2">
                    <Label htmlFor="youtube" className="flex items-center gap-2">
                      <Youtube className="h-4 w-4" />
                      YouTube
                    </Label>
                    <Input
                      id="youtube"
                      placeholder="https://youtube.com/@yourdao"
                      value={formData.youtube}
                      onChange={(e) => setFormData({ ...formData, youtube: e.target.value })}
                    />
                  </div>

                  {/* Medium */}
                  <div className="space-y-2">
                    <Label htmlFor="medium" className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      Medium
                    </Label>
                    <Input
                      id="medium"
                      placeholder="https://medium.com/@yourdao"
                      value={formData.medium}
                      onChange={(e) => setFormData({ ...formData, medium: e.target.value })}
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Token Settings (Type 4 only) */}
            {showTokenFields && (
              <div className="space-y-4 p-4 bg-cheese/5 rounded-lg border border-cheese/30">
                <h3 className="text-sm font-medium text-cheese uppercase tracking-wide">Governance Token</h3>
                
                {/* Token Contract */}
                <div className="space-y-2">
                  <Label htmlFor="tokenContract">Token Contract *</Label>
                  <Input
                    id="tokenContract"
                    placeholder="e.g., cheeseburger"
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
                    placeholder="e.g., 4,CHEESE"
                    value={formData.tokenSymbol}
                    onChange={(e) => setFormData({ ...formData, tokenSymbol: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Format: precision,SYMBOL (e.g., 4,CHEESE)
                  </p>
                </div>
              </div>
            )}


            {/* NFT Collections/Schemas (Type 5 only) */}
            {showSchemaFields && (
              <div className="space-y-4 p-4 bg-green-500/5 rounded-lg border border-green-500/30">
                <h3 className="text-sm font-medium text-green-500 uppercase tracking-wide">
                  Eligible NFT Collections
                </h3>
                <p className="text-xs text-muted-foreground">
                  Users holding NFTs from these collections can vote. Each NFT = 1 vote.
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
            <div className="space-y-6">
              <h3 className="text-sm font-medium text-cheese uppercase tracking-wide border-b border-cheese/30 pb-2">
                Advanced Settings
              </h3>
                
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
            </div>

            {/* Payment Selection */}
            <FeePaymentSelector
              waxFee={WAX_FEE_AMOUNT}
              selectedMethod={paymentMethod}
              onMethodChange={setPaymentMethod}
              onCheeseAmountChange={handleCheeseAmountChange}
              onWaxdaoAmountChange={handleWaxdaoAmountChange}
              disabled={loading}
            />

            {/* Anchor Wallet Warning */}
            <div className="flex items-start gap-2 text-xs text-amber-500/90 bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 rounded-md">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Anchor Wallet Users:</strong> This transaction includes inline actions and may trigger a "Dangerous Transaction" warning. This is normal and safe — see the <button type="button" onClick={() => setHelpOpen(true)} className="text-foreground underline font-semibold hover:text-cheese transition-colors">help guide</button> above for instructions on how to allow it.
              </span>
            </div>

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
              ) : paymentMethod === "cheese" && CHEESE_FEE_ENABLED ? (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create DAO ({cheesePricing.displayAmount} - Save {Math.round(CHEESE_DISCOUNT * 100)}%)
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create DAO ({WAX_FEE_AMOUNT} WAX)
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
