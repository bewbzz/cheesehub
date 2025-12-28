import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useWax } from "@/context/WaxContext";
import { cn } from "@/lib/utils";
import { format, addDays } from "date-fns";
import { CalendarIcon, Plus, Trash2, ArrowLeft, ArrowRight, Loader2, Check, Sprout, AlertTriangle } from "lucide-react";
import {
  FARM_TYPES,
  FARM_TYPE_LABELS,
  PAYOUT_INTERVALS,
  FARM_CREATION_FEES,
  FarmType,
  StakableAsset,
  RewardToken,
  validateFarmName,
  buildFarmCreationFeeWaxAction,
  buildFarmCreationFeeWaxdaoAction,
  buildCreateFarmAction,
  buildAddCollectionAction,
  buildAddSchemaAction,
  buildAddTemplateAction,
  buildAddAttributeAction,
} from "@/lib/farm";

const STEPS = [
  { id: 1, title: "Basic Info", description: "Farm name and details" },
  { id: 2, title: "Stakable Assets", description: "What NFTs can be staked" },
  { id: 3, title: "Reward Tokens", description: "Up to 3 reward tokens" },
  { id: 4, title: "Configuration", description: "Payout and expiration" },
  { id: 5, title: "Review & Pay", description: "Confirm and create" },
];

const basicInfoSchema = z.object({
  farmName: z.string()
    .min(1, "Farm name is required")
    .max(12, "Farm name must be 12 characters or less")
    .regex(/^[a-z1-5.]+$/, "Only lowercase a-z, 1-5, and periods allowed")
    .refine(val => !val.startsWith(".") && !val.endsWith("."), "Cannot start or end with a period")
    .refine(val => !val.includes(".."), "Cannot contain consecutive periods"),
  logo: z.string().optional(),
  description: z.string().max(500, "Description must be 500 characters or less").optional(),
});

type PaymentMethod = "wax" | "waxdao" | "wojak";

export function CreateFarm() {
  const { session, accountName, isConnected } = useWax();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [farmType, setFarmType] = useState<FarmType>(FARM_TYPES.COLLECTIONS);
  const [stakableAssets, setStakableAssets] = useState<StakableAsset[]>([
    { collection: "", rewardPerHour: 1 }
  ]);
  const [rewardTokens, setRewardTokens] = useState<RewardToken[]>([
    { contract: "eosio.token", symbol: "WAX", precision: 8 }
  ]);
  const [payoutInterval, setPayoutInterval] = useState(3600);
  const [expirationDate, setExpirationDate] = useState<Date>(addDays(new Date(), 30));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("wax");

  const form = useForm({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: {
      farmName: "",
      logo: "",
      description: "",
    },
  });

  const addStakableAsset = () => {
    const newAsset: StakableAsset = { rewardPerHour: 1 };
    switch (farmType) {
      case FARM_TYPES.COLLECTIONS:
        newAsset.collection = "";
        break;
      case FARM_TYPES.SCHEMAS:
        newAsset.collection = "";
        newAsset.schema = "";
        break;
      case FARM_TYPES.TEMPLATES:
        newAsset.templateId = "";
        break;
      case FARM_TYPES.ATTRIBUTES:
        newAsset.attributeKey = "";
        newAsset.attributeValue = "";
        break;
    }
    setStakableAssets([...stakableAssets, newAsset]);
  };

  const removeStakableAsset = (index: number) => {
    if (stakableAssets.length > 1) {
      setStakableAssets(stakableAssets.filter((_, i) => i !== index));
    }
  };

  const updateStakableAsset = (index: number, field: keyof StakableAsset, value: string | number) => {
    const updated = [...stakableAssets];
    updated[index] = { ...updated[index], [field]: value };
    setStakableAssets(updated);
  };

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

  const handleFarmTypeChange = (newType: FarmType) => {
    setFarmType(newType);
    // Reset stakable assets for new type
    const newAsset: StakableAsset = { rewardPerHour: 1 };
    switch (newType) {
      case FARM_TYPES.COLLECTIONS:
        newAsset.collection = "";
        break;
      case FARM_TYPES.SCHEMAS:
        newAsset.collection = "";
        newAsset.schema = "";
        break;
      case FARM_TYPES.TEMPLATES:
        newAsset.templateId = "";
        break;
      case FARM_TYPES.ATTRIBUTES:
        newAsset.attributeKey = "";
        newAsset.attributeValue = "";
        break;
    }
    setStakableAssets([newAsset]);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        const values = form.getValues();
        const validation = validateFarmName(values.farmName);
        return validation.valid;
      case 2:
        return stakableAssets.every(asset => {
          if (farmType === FARM_TYPES.COLLECTIONS) return asset.collection?.trim();
          if (farmType === FARM_TYPES.SCHEMAS) return asset.collection?.trim() && asset.schema?.trim();
          if (farmType === FARM_TYPES.TEMPLATES) return asset.templateId?.trim();
          if (farmType === FARM_TYPES.ATTRIBUTES) return asset.attributeKey?.trim() && asset.attributeValue?.trim();
          return false;
        }) && stakableAssets.every(a => a.rewardPerHour > 0);
      case 3:
        return rewardTokens.every(t => t.contract.trim() && t.symbol.trim() && t.precision >= 0);
      case 4:
        return payoutInterval > 0 && expirationDate > new Date();
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    if (!session || !accountName) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to create a farm.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const values = form.getValues();
      const expirationTimestamp = Math.floor(expirationDate.getTime() / 1000);

      // Build actions array
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const actions: any[] = [];

      // Add payment action
      if (paymentMethod === "wax") {
        actions.push(buildFarmCreationFeeWaxAction(accountName));
      } else if (paymentMethod === "waxdao") {
        actions.push(buildFarmCreationFeeWaxdaoAction(accountName));
      }
      // Note: Wojak NFT payment would require asset selection UI

      // Add create farm action
      actions.push(
        buildCreateFarmAction(
          accountName,
          values.farmName,
          values.logo || "",
          payoutInterval,
          expirationTimestamp,
          rewardTokens
        )
      );

      // Add stakable asset actions
      for (const asset of stakableAssets) {
        const rewardStr = `${asset.rewardPerHour.toFixed(rewardTokens[0].precision)} ${rewardTokens[0].symbol}`;
        
        switch (farmType) {
          case FARM_TYPES.COLLECTIONS:
            actions.push(
              buildAddCollectionAction(accountName, values.farmName, asset.collection!, rewardStr)
            );
            break;
          case FARM_TYPES.SCHEMAS:
            actions.push(
              buildAddSchemaAction(accountName, values.farmName, asset.collection!, asset.schema!, rewardStr)
            );
            break;
          case FARM_TYPES.TEMPLATES:
            actions.push(
              buildAddTemplateAction(accountName, values.farmName, asset.templateId!, rewardStr)
            );
            break;
          case FARM_TYPES.ATTRIBUTES:
            actions.push(
              buildAddAttributeAction(accountName, values.farmName, asset.attributeKey!, asset.attributeValue!, rewardStr)
            );
            break;
        }
      }

      // Execute transaction
      await session.transact({ actions });

      toast({
        title: "Farm Created!",
        description: `Your farm "${values.farmName}" has been created successfully.`,
      });

      // Reset form
      form.reset();
      setCurrentStep(1);
      setStakableAssets([{ collection: "", rewardPerHour: 1 }]);
      setRewardTokens([{ contract: "eosio.token", symbol: "WAX", precision: 8 }]);

    } catch (error) {
      console.error("Error creating farm:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create farm",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isConnected) {
    return (
      <Card className="border-border/50 bg-card/50">
        <CardContent className="py-12 text-center">
          <Sprout className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
          <p className="text-muted-foreground">
            Connect your wallet to create a farm.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                  currentStep === step.id
                    ? "bg-primary text-primary-foreground"
                    : currentStep > step.id
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {currentStep > step.id ? <Check className="h-5 w-5" /> : step.id}
              </div>
              <span className="text-xs mt-1 text-muted-foreground hidden sm:block">
                {step.title}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-8 sm:w-16 mx-2",
                  currentStep > step.id ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle>{STEPS[currentStep - 1].title}</CardTitle>
          <CardDescription>{STEPS[currentStep - 1].description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <Form {...form}>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="farmName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Farm Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="myfarm12345"
                          {...field}
                          className="lowercase"
                          onChange={(e) => field.onChange(e.target.value.toLowerCase())}
                        />
                      </FormControl>
                      <FormDescription>
                        12 characters max, lowercase a-z, numbers 1-5, and periods only
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="logo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logo (IPFS Hash)</FormLabel>
                      <FormControl>
                        <Input placeholder="QmXxx..." {...field} />
                      </FormControl>
                      <FormDescription>
                        IPFS hash for your farm logo (optional)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe your farm..."
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Brief description of your farm (optional, max 500 characters)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Form>
          )}

          {/* Step 2: Stakable Assets */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <Label className="text-base">Farm Type</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Choose what type of NFTs can be staked
                </p>
                <RadioGroup
                  value={farmType}
                  onValueChange={(v) => handleFarmTypeChange(v as FarmType)}
                  className="grid grid-cols-2 gap-4"
                >
                  {Object.entries(FARM_TYPE_LABELS).map(([key, label]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <RadioGroupItem value={key} id={key} />
                      <Label htmlFor={key} className="cursor-pointer">{label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-base">Stakable Assets</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addStakableAsset}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Asset
                  </Button>
                </div>

                {stakableAssets.map((asset, index) => (
                  <Card key={index} className="p-4 border-border/50">
                    <div className="flex gap-4 items-end">
                      <div className="flex-1 space-y-4">
                        {farmType === FARM_TYPES.COLLECTIONS && (
                          <div>
                            <Label>Collection Name</Label>
                            <Input
                              value={asset.collection || ""}
                              onChange={(e) => updateStakableAsset(index, "collection", e.target.value)}
                              placeholder="mycollection"
                            />
                          </div>
                        )}

                        {farmType === FARM_TYPES.SCHEMAS && (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Collection</Label>
                              <Input
                                value={asset.collection || ""}
                                onChange={(e) => updateStakableAsset(index, "collection", e.target.value)}
                                placeholder="collection"
                              />
                            </div>
                            <div>
                              <Label>Schema</Label>
                              <Input
                                value={asset.schema || ""}
                                onChange={(e) => updateStakableAsset(index, "schema", e.target.value)}
                                placeholder="schema"
                              />
                            </div>
                          </div>
                        )}

                        {farmType === FARM_TYPES.TEMPLATES && (
                          <div>
                            <Label>Template ID</Label>
                            <Input
                              value={asset.templateId || ""}
                              onChange={(e) => updateStakableAsset(index, "templateId", e.target.value)}
                              placeholder="123456"
                            />
                          </div>
                        )}

                        {farmType === FARM_TYPES.ATTRIBUTES && (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Attribute Key</Label>
                              <Input
                                value={asset.attributeKey || ""}
                                onChange={(e) => updateStakableAsset(index, "attributeKey", e.target.value)}
                                placeholder="rarity"
                              />
                            </div>
                            <div>
                              <Label>Attribute Value</Label>
                              <Input
                                value={asset.attributeValue || ""}
                                onChange={(e) => updateStakableAsset(index, "attributeValue", e.target.value)}
                                placeholder="legendary"
                              />
                            </div>
                          </div>
                        )}

                        <div className="w-48">
                          <Label>Reward Per Hour</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.00000001"
                            value={asset.rewardPerHour}
                            onChange={(e) => updateStakableAsset(index, "rewardPerHour", parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      </div>

                      {stakableAssets.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeStakableAsset(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Reward Tokens */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <Label className="text-base">Reward Tokens</Label>
                  <p className="text-sm text-muted-foreground">
                    Configure up to 3 reward tokens
                  </p>
                </div>
                {rewardTokens.length < 3 && (
                  <Button type="button" variant="outline" size="sm" onClick={addRewardToken}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Token
                  </Button>
                )}
              </div>

              {rewardTokens.map((token, index) => (
                <Card key={index} className="p-4 border-border/50">
                  <div className="flex gap-4 items-end">
                    <div className="flex-1 grid grid-cols-3 gap-4">
                      <div>
                        <Label>Token Contract</Label>
                        <Input
                          value={token.contract}
                          onChange={(e) => updateRewardToken(index, "contract", e.target.value)}
                          placeholder="eosio.token"
                        />
                      </div>
                      <div>
                        <Label>Symbol</Label>
                        <Input
                          value={token.symbol}
                          onChange={(e) => updateRewardToken(index, "symbol", e.target.value.toUpperCase())}
                          placeholder="WAX"
                          className="uppercase"
                        />
                      </div>
                      <div>
                        <Label>Precision</Label>
                        <Input
                          type="number"
                          min="0"
                          max="18"
                          value={token.precision}
                          onChange={(e) => updateRewardToken(index, "precision", parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>

                    {rewardTokens.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRewardToken(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </Card>
              ))}

              <p className="text-xs text-muted-foreground">
                Common tokens: eosio.token (WAX), token.waxdao (WAXDAO), cheesetoken1 (CHEESE)
              </p>
            </div>
          )}

          {/* Step 4: Configuration */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <Label className="text-base">Payout Interval</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  How often stakers can claim rewards
                </p>
                <Select
                  value={payoutInterval.toString()}
                  onValueChange={(v) => setPayoutInterval(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select interval" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYOUT_INTERVALS.map((interval) => (
                      <SelectItem key={interval.value} value={interval.value.toString()}>
                        {interval.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-base">Expiration Date</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  When the farm will stop accepting stakes
                </p>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !expirationDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {expirationDate ? format(expirationDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={expirationDate}
                      onSelect={(date) => date && setExpirationDate(date)}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {/* Step 5: Review & Pay */}
          {currentStep === 5 && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="space-y-4">
                <h4 className="font-medium">Farm Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Farm Name:</span>
                    <p className="font-medium">{form.getValues("farmName")}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Farm Type:</span>
                    <p className="font-medium">{FARM_TYPE_LABELS[farmType]}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Stakable Assets:</span>
                    <p className="font-medium">{stakableAssets.length} configured</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Reward Tokens:</span>
                    <div className="flex gap-1">
                      {rewardTokens.map((t, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {t.symbol}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Payout Interval:</span>
                    <p className="font-medium">
                      {PAYOUT_INTERVALS.find(i => i.value === payoutInterval)?.label}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Expiration:</span>
                    <p className="font-medium">{format(expirationDate, "PPP")}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Payment Method */}
              <div>
                <Label className="text-base">Payment Method</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Choose how to pay the farm creation fee
                </p>
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2 p-3 rounded-lg border border-border/50 hover:border-primary/30 transition-colors">
                    <RadioGroupItem value="wax" id="pay-wax" />
                    <Label htmlFor="pay-wax" className="flex-1 cursor-pointer">
                      <span className="font-medium">250 WAX</span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 rounded-lg border border-border/50 hover:border-primary/30 transition-colors">
                    <RadioGroupItem value="waxdao" id="pay-waxdao" />
                    <Label htmlFor="pay-waxdao" className="flex-1 cursor-pointer">
                      <span className="font-medium">25,000 WAXDAO</span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 rounded-lg border border-border/50 hover:border-primary/30 transition-colors opacity-50">
                    <RadioGroupItem value="wojak" id="pay-wojak" disabled />
                    <Label htmlFor="pay-wojak" className="flex-1 cursor-pointer">
                      <span className="font-medium">1 Wojak NFT</span>
                      <span className="text-xs text-muted-foreground ml-2">(Coming soon)</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Warnings */}
              <Card className="p-4 border-yellow-500/30 bg-yellow-500/10">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-500 mb-1">Important Notes</p>
                    <ul className="text-muted-foreground space-y-1">
                      <li>• Farm creation fees are non-refundable</li>
                      <li>• Reward tokens cannot be removed once added</li>
                      <li>• You can extend expiration but not shorten it</li>
                      <li>• Make sure to deposit reward tokens after creation</li>
                    </ul>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(currentStep - 1)}
          disabled={currentStep === 1}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>

        {currentStep < 5 ? (
          <Button
            onClick={() => setCurrentStep(currentStep + 1)}
            disabled={!canProceed()}
          >
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !canProceed()}
            className="bg-primary hover:bg-primary/90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Sprout className="h-4 w-4 mr-2" />
                Create Farm
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
