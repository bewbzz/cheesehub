import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useWax } from "@/context/WaxContext";
import { toast } from "sonner";
import { closeWharfkitModals } from "@/lib/wharfKit";
import { Loader2, Plus, Wallet, Trash2, Info, Sprout, AlertTriangle, ExternalLink, Play, CheckCircle2, RefreshCw, ChevronDown, Globe, Youtube, BookOpen } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  FARM_TYPES,
  FARM_TYPE_LABELS,
  FarmType,
  RewardToken,
  validateFarmName,
  buildAssertPointAction,
  buildFarmCreationFeeWaxAction,
  buildCreateFarmAction,
} from "@/lib/farm";
import { FeePaymentSelector } from "@/components/shared/FeePaymentSelector";
import {
  CHEESE_FEE_ENABLED,
  PaymentMethod,
  buildCheesePrepayAction,
  buildProvideAction,
  buildFinaliseAction,
  buildWaxdaoFeeAction,
  fetchUserPrepayment,
  WAX_FEE_AMOUNT,
  CHEESE_DISCOUNT,
} from "@/lib/cheeseFees";
import { useWaxdaoFeePricing } from "@/hooks/useWaxdaoFeePricing";
import { useCheeseFeePricing } from "@/hooks/useCheeseFeePricing";



const FAQ_ITEMS = [
  {
    question: "Can I pay with CHEESE tokens?",
    answer: "Yes! You can prepay with CHEESE tokens and receive a 20% discount on the creation fee. Due to smart contract limitations, you must complete the CHEESE prepayment before filling in the rest of the form. The prepayment locks in your farm name. If you decide not to create the farm after prepaying, your CHEESE is 100% refundable.",
  },
  {
    question: "What is the correct format for my farm name?",
    answer: "Farm names must be 12 characters or less and can only contain lowercase letters (a-z), numbers (1-5), and periods. Names cannot start or end with a period, and cannot contain consecutive periods.",
  },
  {
    question: "How much does it cost to create a farm?",
    answer: "You can create a farm by paying 250 WAX, 25,000 WAXDAO tokens, or by using 1 NFT from the Wojak collection (ourwojaksart). These payment options help support the WaxDAO ecosystem.",
  },
  {
    question: "What are the different farm types?",
    answer: "Collections: stake any NFT from specified collections. Schemas: stake NFTs from specific schemas within collections. Templates: stake specific template IDs. Attributes: stake NFTs with matching attribute key/value pairs.",
  },
  {
    question: "How do I add stakable assets after creation?",
    answer: "After creating your farm, you need to add stakable assets (collections, schemas, templates, or attributes) using separate actions. Visit your farm's detail page to configure which NFTs can be staked.",
  },
  {
    question: "Is there a limit to how many NFTs can be staked?",
    answer: "There is no hard limit on the number of NFTs that can be staked in a V2 farm. However, you should ensure you have enough reward tokens deposited to cover payouts for all stakers.",
  },
  {
    question: "Can I have multiple reward tokens?",
    answer: "Yes! V2 farms support up to 3 different reward tokens. You can configure different tokens when creating the farm, allowing you to reward stakers with multiple tokens simultaneously.",
  },
  {
    question: "How often are rewards paid out?",
    answer: "Rewards accumulate continuously based on the hourly rate you set. The 'Hours Between Payouts' setting determines the minimum interval between claim transactions. Enter a number between 1 and 720 hours.",
  },
  {
    question: "Are staked NFTs safe?",
    answer: "V2 farms are non-custodial - NFTs remain in your wallet while staked. The smart contract only tracks which NFTs are registered for rewards. WaxDAO has been audited and running since 2021.",
  },
  {
    question: "What are the IPFS hash fields for?",
    answer: "Avatar Image is a small profile picture (e.g. 300x300px). Cover Image is a large background banner. Both should be IPFS hashes only (e.g. QmXxx...), not full URLs. Supported formats: JPEG and PNG.",
  },
];

const CONFIRMATION_PHRASE = "I understand how the new farms work";

export function CreateFarm() {
  const { session, isConnected, login } = useWax();
  const [loading, setLoading] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  
  // CHEESE prepayment state
  const [wantsCheesePrepay, setWantsCheesePrepay] = useState(CHEESE_FEE_ENABLED);
  const [prepayFarmName, setPrepayFarmName] = useState("");
  const [hasPrepaid, setHasPrepaid] = useState(false);
  const [isPrepaying, setIsPrepaying] = useState(false);
  
  // Legacy payment state for WAX option
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("wax");
  const [cheeseAmount, setCheeseAmount] = useState("");
  
  // Pricing hooks
  const waxdaoPricing = useWaxdaoFeePricing();
  const cheesePricing = useCheeseFeePricing(WAX_FEE_AMOUNT);
  
  const handleCheeseAmountChange = useCallback((amount: string) => {
    setCheeseAmount(amount);
  }, []);
  
  const [formData, setFormData] = useState({
    farmName: "",
    avatar: "",
    coverImage: "",
    description: "",
    hoursBetweenPayouts: "1",
    farmType: FARM_TYPES.COLLECTIONS as FarmType,
    // Social links
    twitter: "",
    discord: "",
    telegram: "",
    website: "",
    youtube: "",
    medium: "",
  });

  const [rewardTokens, setRewardTokens] = useState<RewardToken[]>([
    { contract: "eosio.token", symbol: "WAX", precision: 8 }
  ]);

  const addRewardToken = () => {
    if (rewardTokens.length < 3) {
      setRewardTokens([...rewardTokens, { contract: "", symbol: "", precision: 8 }]);
    }
  };

  const removeRewardToken = (index: number) => {
    if (rewardTokens.length > 1) {
      setRewardTokens(rewardTokens.filter((_, i) => i !== index));
    }
  };

  const updateRewardToken = (index: number, field: keyof RewardToken, value: string | number) => {
    const updated = [...rewardTokens];
    updated[index] = { ...updated[index], [field]: value };
    setRewardTokens(updated);
  };

  // Handle CHEESE prepayment (separate from creation)
  async function handlePrepayment() {
    if (!session) {
      toast.error("Please connect your wallet first");
      return;
    }
    
    if (!prepayFarmName.trim()) {
      toast.error("Enter farm name before prepaying");
      return;
    }
    
    // Validate farm name
    const nameValidation = validateFarmName(prepayFarmName);
    if (!nameValidation.valid) {
      toast.error(nameValidation.error || "Invalid farm name");
      return;
    }
    
    if (!cheesePricing.isAvailable) {
      toast.error("CHEESE pricing not available. Please try again.");
      return;
    }
    
    setIsPrepaying(true);
    try {
      const accountName = String(session.actor);
      const prepayAction = buildCheesePrepayAction(
        accountName,
        cheesePricing.formattedForTx,
        "farm",
        prepayFarmName
      );
      await session.transact({ actions: [prepayAction] });
      setHasPrepaid(true);
      // Sync farm name to main form
      setFormData(prev => ({ ...prev, farmName: prepayFarmName }));
      toast.success("CHEESE prepayment successful! Now complete the form and create your farm.");
    } catch (error) {
      console.error("Prepayment failed:", error);
      closeWharfkitModals();
      toast.error(error instanceof Error ? error.message : "Prepayment failed");
    } finally {
      setIsPrepaying(false);
      closeWharfkitModals();
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    
    if (!session) {
      toast.error("Please connect your wallet first");
      return;
    }

    // Validate farm name
    const nameValidation = validateFarmName(formData.farmName);
    if (!nameValidation.valid) {
      toast.error(nameValidation.error || "Invalid farm name");
      return;
    }

    // Validate hours between payouts
    const hours = parseInt(formData.hoursBetweenPayouts);
    if (isNaN(hours) || hours < 1 || hours > 720) {
      toast.error("Hours between payouts must be between 1 and 720");
      return;
    }

    // Validate reward tokens
    if (!rewardTokens.every(t => t.contract.trim() && t.symbol.trim())) {
      toast.error("All reward tokens must have a contract and symbol");
      return;
    }

    setLoading(true);
    try {
      const accountName = String(session.actor);

      // Build assertpoint action (required before fee payment)
      const assertAction = buildAssertPointAction(accountName);
      
      // Build fee payment action (250 WAX)
      const feeAction = buildFarmCreationFeeWaxAction(accountName);

      // Build profile object
      const profile = {
        avatar: formData.avatar.trim(),
        cover_image: formData.coverImage.trim(),
        description: formData.description.trim(),
      };

      // Build socials object from form data
      const socials = {
        atomichub: "",
        discord: formData.discord.trim(),
        medium: formData.medium.trim(),
        telegram: formData.telegram.trim(),
        twitter: formData.twitter.trim(),
        waxdao: "",
        website: formData.website.trim(),
        youtube: formData.youtube.trim(),
      };

      // Build create farm action
      const createAction = buildCreateFarmAction(
        accountName,
        formData.farmName,
        formData.farmType,
        hours,
        rewardTokens,
        profile,
        socials
      );

      // Handle CHEESE prepayment flow (user already prepaid)
      if (hasPrepaid) {
        // Fetch prepayment to get ID for finalise action
        const prepayment = await fetchUserPrepayment(accountName, "farm", formData.farmName);
        if (!prepayment) {
          throw new Error("Prepayment not found. Please try again.");
        }
        
        // Bundled creation with WAXDAO + finalise at end
        const provideAction = buildProvideAction(
          accountName, 
          "farm", 
          formData.farmName, 
          waxdaoPricing.formattedForTx
        );
        const waxdaoFeeAction = buildWaxdaoFeeAction(
          accountName,
          "farms.waxdao",
          waxdaoPricing.formattedForTx,
          "|create_farm|"
        );
        const finaliseAction = buildFinaliseAction(accountName, prepayment.id);
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const actions: any[] = [
          provideAction,      // 1. Contract sends WAXDAO to user
          waxdaoFeeAction,    // 2. User pays WAXDAO to farms.waxdao
          assertAction,       // 3. Assert point
          createAction,       // 4. Create Farm
          finaliseAction,     // 5. Transfer CHEESE to eosio.null (only if all above succeed)
        ];
        await session.transact({ actions });
      } else {
        // Standard WAX payment
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const actions: any[] = [assertAction, feeAction, createAction];
        await session.transact({ actions });
      }
      
      toast.success("Farm created successfully! You can now add stakable assets via the farm detail page.");
      
      // Reset form
      setFormData({
        farmName: "",
        avatar: "",
        coverImage: "",
        description: "",
        hoursBetweenPayouts: "1",
        farmType: FARM_TYPES.COLLECTIONS,
        twitter: "",
        discord: "",
        telegram: "",
        website: "",
        youtube: "",
        medium: "",
      });
      setRewardTokens([{ contract: "eosio.token", symbol: "WAX", precision: 8 }]);
      setPaymentMethod("wax");
      setHasPrepaid(false);
      setWantsCheesePrepay(CHEESE_FEE_ENABLED);
      setPrepayFarmName("");
      
    } catch (error) {
      console.error("Failed to create farm:", error);
      closeWharfkitModals();
      toast.error(error instanceof Error ? error.message : "Failed to create farm");
    } finally {
      setLoading(false);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  }

  if (!isConnected) {
    return (
      <Card className="max-w-2xl mx-auto bg-card/50 border-border/50">
        <CardContent className="py-12 text-center">
          <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
          <p className="text-muted-foreground mb-6">
            You need to connect your WAX wallet to create a farm.
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
            Create a New Farm
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <span className="px-2.5 py-1 text-xs font-semibold bg-cheese/20 text-cheese border border-cheese/30 rounded-full">
              V2 Non-Custodial
            </span>
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
                    Farm Creation Guide
                  </DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[65vh] pr-4">
                  <Accordion type="single" collapsible className="space-y-2">
                    {FAQ_ITEMS.map((item, index) => (
                      <AccordionItem key={index} value={`item-${index}`} className="border border-border/50 rounded-lg px-4">
                        <AccordionTrigger className="text-sm font-medium hover:no-underline text-cheese">
                          <span className="flex items-center gap-2">
                            {item.question}
                            {index === 0 && !CHEESE_FEE_ENABLED && (
                              <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                            )}
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-foreground">
                          {item.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <CardDescription className="space-y-2">
          <span className="block">
            Set up your NFT staking farm on the WAX blockchain.
          </span>
          <span className="flex items-center gap-2 text-xs text-amber-500/80 bg-amber-500/10 px-3 py-2 rounded-md">
            <Sprout className="h-4 w-4 flex-shrink-0" />
            <span>Be aware that in order for you to add stakable assets to this farm, you must be authorized on the NFT collection(s).</span>
          </span>
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Video Warning Section - Always visible */}
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-destructive font-semibold">
            <AlertTriangle className="h-5 w-5" />
            <span>VERY IMPORTANT!!!!! You must confirm that you understand how these new farms work before you are allowed to create one.</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Watch the following video and then enter "{CONFIRMATION_PHRASE}" (without quotes) into the box below. Once you do that, the farm creation form will magically appear.
          </p>
          
          {/* Embedded YouTube Video */}
          <div className="aspect-video w-full rounded-lg overflow-hidden bg-black/20">
            <iframe
              className="w-full h-full"
              src="https://www.youtube.com/embed/PIV_ojHzkS8"
              title="How to Create a Farm on WaxDAO"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          
          {/* Fallback link */}
          <a
            href="https://www.youtube.com/watch?v=PIV_ojHzkS8"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-destructive hover:text-destructive/80 underline"
          >
            <Play className="h-4 w-4" />
            Watch on YouTube
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Confirmation Gate */}
        {!isUnlocked && (
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <div className="space-y-1">
              <Label htmlFor="confirmation" className="font-semibold">Confirm</Label>
              <p className="text-sm text-muted-foreground">
                Enter '{CONFIRMATION_PHRASE}' without quotes (case sensitive)
              </p>
            </div>
            <Textarea
              id="confirmation"
              value={confirmationText}
              onChange={(e) => {
                setConfirmationText(e.target.value);
                if (e.target.value === CONFIRMATION_PHRASE) {
                  setIsUnlocked(true);
                }
              }}
              className="resize-none min-h-[120px]"
            />
            {confirmationText.length > 0 && confirmationText !== CONFIRMATION_PHRASE && (
              <p className="text-xs text-destructive">
                Text doesn't match. Make sure to type exactly: {CONFIRMATION_PHRASE}
              </p>
            )}
          </div>
        )}

        {/* Farm Creation Form - Only visible after confirmation */}
        {isUnlocked && (
        <form onSubmit={handleCreate} className="space-y-6">
          
          {/* CHEESE Prepayment Section */}
          <div className={`p-4 rounded-lg border space-y-4 ${
            hasPrepaid 
              ? "border-green-500/50 bg-green-500/5" 
              : wantsCheesePrepay 
                ? "border-cheese/50 bg-cheese/5" 
                : "border-border/50 bg-muted/30"
          }`}>
            <div className="flex items-start gap-3">
              <RadioGroup
                value={wantsCheesePrepay || hasPrepaid ? "cheese" : "wax"}
                onValueChange={(val) => {
                  if (!hasPrepaid) {
                    setWantsCheesePrepay(val === "cheese");
                  }
                }}
                className="mt-0.5"
              >
                <RadioGroupItem 
                  value="cheese" 
                  disabled={hasPrepaid || !CHEESE_FEE_ENABLED}
                  className="border-cheese data-[state=checked]:bg-cheese data-[state=checked]:border-cheese"
                />
              </RadioGroup>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">Prepay with CHEESE</span>
                  <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-xs">
                    Save {Math.round(CHEESE_DISCOUNT * 100)}%
                  </Badge>
                  {!CHEESE_FEE_ENABLED && (
                    <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Pay creation fees with CHEESE tokens and receive a 20% discount
                </p>
                <p className="text-xs text-foreground/90 mt-1">
                  <strong>Why prepay?</strong> Due to smart contract limitations, if selecting this option you must complete the prepayment before filling in the rest of the form.
                </p>
                <p className="text-xs text-foreground/90">
                  Don't worry — if you decide not to create a farm after prepaying, your CHEESE is 100% refundable.
                </p>
              </div>
            </div>
            
            {/* Prepayment form - shown when dot is selected and not yet prepaid */}
            {wantsCheesePrepay && !hasPrepaid && CHEESE_FEE_ENABLED && (
              <div className="space-y-4 pl-6 border-l-2 border-cheese/30 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="space-y-2">
                  <Label htmlFor="prepayFarmName">Farm Name *</Label>
                  <Input
                    id="prepayFarmName"
                    value={prepayFarmName}
                    onChange={(e) => setPrepayFarmName(e.target.value.toLowerCase())}
                    placeholder="e.g. myawesomefarm"
                    maxLength={12}
                    className="lowercase"
                  />
                  <p className="text-xs text-muted-foreground">
                    12 characters max, lowercase a-z, numbers 1-5, and periods only
                  </p>
                </div>
                
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm">Amount:</span>
                  {cheesePricing.isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <span className="font-medium text-cheese">{cheesePricing.displayAmount}</span>
                      <span className="text-xs text-muted-foreground">
                        (~{Math.round(WAX_FEE_AMOUNT * (1 - CHEESE_DISCOUNT))} WAX equivalent)
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => cheesePricing.refetch()}
                        className="h-6 px-2"
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
                
                <Button 
                  type="button"
                  onClick={handlePrepayment} 
                  disabled={isPrepaying || !prepayFarmName.trim() || !cheesePricing.isAvailable}
                  className="bg-cheese hover:bg-cheese/90 text-cheese-foreground"
                >
                  {isPrepaying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Prepaying...
                    </>
                  ) : (
                    "Prepay CHEESE"
                  )}
                </Button>
                
                <p className="text-xs text-muted-foreground">
                  <span className="text-yellow-500">*</span> Prepaid CHEESE is 100% refundable 
                  if your farm is not created after prepaying.
                </p>
              </div>
            )}
            
            {/* Confirmation shown after successful prepayment */}
            {hasPrepaid && (
              <div className="pl-6 border-l-2 border-green-500/50 space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-medium">Prepayment confirmed for "{prepayFarmName}"</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  <span className="text-yellow-500">*</span> Prepaid CHEESE is 100% refundable 
                  if your farm is not created after prepaying.
                </p>
              </div>
            )}
          </div>

          {/* Farm Info Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-cheese border-b border-border/50 pb-2">Farm Info</h3>
            
            <div className="space-y-2">
              <Label htmlFor="farmName">Farm Name *</Label>
              <Input
                id="farmName"
                placeholder="e.g. myawesomefarm"
                value={formData.farmName}
                onChange={(e) => setFormData({ ...formData, farmName: e.target.value.toLowerCase() })}
                className={`lowercase ${hasPrepaid ? "opacity-60" : ""}`}
                maxLength={12}
                disabled={hasPrepaid}
              />
              {hasPrepaid ? (
                <p className="text-xs text-green-600">
                  Farm name locked (used in prepayment)
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  12 characters max, lowercase a-z, numbers 1-5, and periods only
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="avatar">Avatar Image IPFS Hash</Label>
              <Input
                id="avatar"
                placeholder="e.g. QmXoypiz..."
                value={formData.avatar}
                onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Small profile image (e.g. 300x300px). IPFS hash only, not full URL.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="coverImage">Cover Image IPFS Hash</Label>
              <Input
                id="coverImage"
                placeholder="e.g. QmXoypiz..."
                value={formData.coverImage}
                onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Large background banner. IPFS hash only, not full URL.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Provide some info about your farm"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="resize-none min-h-[100px]"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                Brief description of your farm (optional, max 500 characters)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hoursBetweenPayouts">Hours Between Payouts *</Label>
              <Input
                id="hoursBetweenPayouts"
                type="number"
                placeholder="e.g. 1"
                value={formData.hoursBetweenPayouts}
                onChange={(e) => setFormData({ ...formData, hoursBetweenPayouts: e.target.value })}
                min={1}
                max={720}
              />
              <p className="text-xs text-muted-foreground">
                Enter a number between 1-720 hours
              </p>
            </div>

            <div className="space-y-2">
              <Label>Farm Type *</Label>
              <Select
                value={formData.farmType}
                onValueChange={(v) => setFormData({ ...formData, farmType: v as FarmType })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose farm type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FARM_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Determines what type of NFTs can be staked in your farm
              </p>
            </div>
          </div>

          {/* Social Links Section (Collapsible) */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 rounded-lg border border-cheese/50 bg-cheese/5 hover:bg-cheese/10 transition-colors text-cheese font-medium text-sm">
              <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
              Social Links (Optional)
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <p className="text-xs text-muted-foreground">
                Add social media links to help users connect with your project. All fields are optional.
              </p>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="twitter" className="flex items-center gap-2">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    Twitter / X
                  </Label>
                  <Input
                    id="twitter"
                    placeholder="https://twitter.com/yourproject"
                    value={formData.twitter}
                    onChange={(e) => setFormData({ ...formData, twitter: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discord" className="flex items-center gap-2">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.317 4.369a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037c-1.687.29-3.33.8-4.885 1.515a.07.07 0 00-.032.028C.533 9.045-.32 13.58.099 18.058a.082.082 0 00.031.056 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.009c.12.098.246.198.373.293a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.363 1.225 1.993a.076.076 0 00.084.029 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.055c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 00-.031-.03zM8.02 15.331c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.332-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.332-.946 2.418-2.157 2.418z" />
                    </svg>
                    Discord
                  </Label>
                  <Input
                    id="discord"
                    placeholder="https://discord.gg/yourserver"
                    value={formData.discord}
                    onChange={(e) => setFormData({ ...formData, discord: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telegram" className="flex items-center gap-2">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.015 3.333-1.386 4.025-1.627 4.477-1.635z" />
                    </svg>
                    Telegram
                  </Label>
                  <Input
                    id="telegram"
                    placeholder="https://t.me/yourgroup"
                    value={formData.telegram}
                    onChange={(e) => setFormData({ ...formData, telegram: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website" className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Website
                  </Label>
                  <Input
                    id="website"
                    placeholder="https://yourproject.com"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="youtube" className="flex items-center gap-2">
                    <Youtube className="h-4 w-4" />
                    YouTube
                  </Label>
                  <Input
                    id="youtube"
                    placeholder="https://youtube.com/@yourchannel"
                    value={formData.youtube}
                    onChange={(e) => setFormData({ ...formData, youtube: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="medium" className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Medium
                  </Label>
                  <Input
                    id="medium"
                    placeholder="https://medium.com/@yourprofile"
                    value={formData.medium}
                    onChange={(e) => setFormData({ ...formData, medium: e.target.value })}
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="border-t border-border/50" />

          {/* Reward Tokens Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-cheese">Reward Tokens</h3>
              <span className="text-xs text-muted-foreground">
                You can reward people with up to 3 different tokens when they stake to your farm.
              </span>
            </div>

            {rewardTokens.map((token, index) => (
              <Card key={index} className="bg-muted/30 border-border/50">
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-cheese">Reward Token {index + 1}</span>
                    {rewardTokens.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRewardToken(index)}
                        className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Remove This Token
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Token Symbol *</Label>
                      <Input
                        placeholder="e.g. WAX"
                        value={token.symbol}
                        onChange={(e) => updateRewardToken(index, "symbol", e.target.value.toUpperCase())}
                        className="uppercase"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Decimal Places *</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 8"
                        value={token.precision}
                        onChange={(e) => updateRewardToken(index, "precision", parseInt(e.target.value) || 0)}
                        min={0}
                        max={18}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Token Contract *</Label>
                      <Input
                        placeholder="e.g. eosio.token"
                        value={token.contract}
                        onChange={(e) => updateRewardToken(index, "contract", e.target.value.toLowerCase())}
                        className="lowercase"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {rewardTokens.length < 3 && (
              <Button
                type="button"
                variant="outline"
                onClick={addRewardToken}
                className="w-full border-dashed border-cheese/50 text-cheese hover:bg-cheese/10"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Reward Token
              </Button>
            )}
          </div>

          {/* Payment Info - Only visible if NOT prepaid with CHEESE and NOT wanting CHEESE prepay */}
          {!wantsCheesePrepay && !hasPrepaid && (
            <FeePaymentSelector
              waxFee={WAX_FEE_AMOUNT}
              feeType="farm"
              entityName={formData.farmName}
              selectedMethod={paymentMethod}
              onMethodChange={setPaymentMethod}
              onCheeseAmountChange={handleCheeseAmountChange}
              disabled={loading}
              hideCheeseOption
            />
          )}
          
          {/* Alternative payment note */}
          {!hasPrepaid && (
            <p className="text-xs text-muted-foreground text-center">
              {wantsCheesePrepay ? (
                <>Alternatively, unselect the CHEESE option above to pay with <span className="font-medium">250 WAX</span> (20% more)</>
              ) : (
                <>Alternatively, select the CHEESE prepayment option above to <span className="font-medium text-green-500">save 20%</span></>
              )}
            </p>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading || !formData.farmName.trim() || (wantsCheesePrepay && !hasPrepaid)}
            className="w-full bg-cheese hover:bg-cheese/90 text-cheese-foreground"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Farm...
              </>
            ) : hasPrepaid ? (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Create Farm (CHEESE Prepaid)
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Create Farm (250 WAX)
              </>
            )}
          </Button>
        </form>
        )}
      </CardContent>
    </Card>
  );
}
