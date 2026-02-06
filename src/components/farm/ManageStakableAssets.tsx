import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Settings2, Plus, Loader2, Trash2, ExternalLink, Pencil, Info } from "lucide-react";
import { useWax } from "@/context/WaxContext";
import { toast } from "sonner";
import { closeWharfkitModals, getTransactPlugins } from "@/lib/wharfKit";
import {
  FarmInfo,
  RewardValue,
  buildSetTemplateValuesAction,
  buildSetSchemaValuesAction,
  buildSetCollectionValuesAction,
  buildSetAttributeValuesAction,
  buildEraseTemplateValuesAction,
  buildEraseSchemaValuesAction,
  buildEraseCollectionValuesAction,
  buildEraseAttributeValuesAction,
  fetchFarmStakableConfig,
  FarmStakableConfig,
} from "@/lib/farm";
import { useQuery } from "@tanstack/react-query";

interface ManageStakableAssetsProps {
  farm: FarmInfo;
  canEdit?: boolean;
  onSuccess?: () => void;
}

const FARM_TYPE_LABELS: Record<number, string> = {
  0: "Collections",
  1: "Schemas",
  2: "Templates",
  3: "Attributes",
};

interface RewardInput {
  quantity: string;
}

interface EditingAsset {
  type: "collection" | "schema" | "template" | "attribute";
  collection?: string;
  schema?: string;
  templateId?: number;
  attributeName?: string;
  attributeValue?: string;
  hourlyRates?: Array<{ quantity: string; contract?: string }>;
}

export function ManageStakableAssets({ farm, canEdit = false, onSuccess }: ManageStakableAssetsProps) {
  const { session, accountName } = useWax();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [editingAsset, setEditingAsset] = useState<EditingAsset | null>(null);
  const [assetToRemove, setAssetToRemove] = useState<EditingAsset | null>(null);

  // Form state based on farm type
  const [templateId, setTemplateId] = useState("");
  const [collectionName, setCollectionName] = useState("");
  const [schemaName, setSchemaName] = useState("");
  const [attributeName, setAttributeName] = useState("");
  const [attributeValue, setAttributeValue] = useState("");
  const [rewardInputs, setRewardInputs] = useState<RewardInput[]>(
    farm.reward_pools.map(() => ({ quantity: "" }))
  );

  // Fetch existing stakable config
  const { data: stakableConfig, isLoading: isLoadingConfig, refetch } = useQuery({
    queryKey: ["farmStakableConfig", farm.farm_name],
    queryFn: () => fetchFarmStakableConfig(farm.farm_name),
    enabled: open,
    staleTime: 30000,
  });

  const resetForm = () => {
    setTemplateId("");
    setCollectionName("");
    setSchemaName("");
    setAttributeName("");
    setAttributeValue("");
    setRewardInputs(farm.reward_pools.map(() => ({ quantity: "" })));
    setEditingAsset(null);
  };

  const buildRewardValues = (): RewardValue[] => {
    return farm.reward_pools.map((pool, index) => ({
      quantity: `${parseFloat(rewardInputs[index]?.quantity || "0").toFixed(pool.precision)} ${pool.symbol}`,
      contract: pool.contract,
    }));
  };

  const handleEditAsset = (asset: EditingAsset) => {
    setEditingAsset(asset);
    
    // Populate form based on asset type
    if (asset.collection) setCollectionName(asset.collection);
    if (asset.schema) setSchemaName(asset.schema);
    if (asset.templateId) setTemplateId(String(asset.templateId));
    if (asset.attributeName) setAttributeName(asset.attributeName);
    if (asset.attributeValue) setAttributeValue(asset.attributeValue);
    
    // Populate reward rates
    if (asset.hourlyRates) {
      const newInputs = farm.reward_pools.map((pool) => {
        const matchingRate = asset.hourlyRates?.find(r => r.quantity.includes(pool.symbol));
        if (matchingRate) {
          const amount = parseFloat(matchingRate.quantity.split(" ")[0]);
          return { quantity: String(amount) };
        }
        return { quantity: "" };
      });
      setRewardInputs(newInputs);
    }
  };

  const handleRemoveAsset = async () => {
    if (!session || !accountName || !assetToRemove) {
      return;
    }

    setIsRemoving(true);

    try {
      let action;

      switch (assetToRemove.type) {
        case "collection":
          action = buildEraseCollectionValuesAction(
            accountName,
            farm.farm_name,
            assetToRemove.collection!
          );
          break;
        case "schema":
          action = buildEraseSchemaValuesAction(
            accountName,
            farm.farm_name,
            assetToRemove.collection!,
            assetToRemove.schema!
          );
          break;
        case "template":
          action = buildEraseTemplateValuesAction(
            accountName,
            farm.farm_name,
            assetToRemove.templateId!
          );
          break;
        case "attribute":
          action = buildEraseAttributeValuesAction(
            accountName,
            farm.farm_name,
            assetToRemove.attributeName!,
            assetToRemove.attributeValue!
          );
          break;
      }

      await session.transact({ actions: [action] }, { transactPlugins: getTransactPlugins(session) });
      toast.success("Stakable asset removed successfully!");
      setAssetToRemove(null);
      refetch();
      onSuccess?.();
    } catch (error: unknown) {
      console.error("Error removing stakable asset:", error);
      const errorMessage = error instanceof Error ? error.message : "Transaction failed";
      toast.error(errorMessage);
    } finally {
      setIsRemoving(false);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  };

  const handleSubmit = async () => {
    if (!session || !accountName) {
      toast.error("Please connect your wallet");
      return;
    }

    // Validate inputs based on farm type
    if (farm.farm_type === 2 && (!templateId || !collectionName)) {
      toast.error("Please enter template ID and collection name");
      return;
    }
    if (farm.farm_type === 0 && !collectionName) {
      toast.error("Please enter a collection name");
      return;
    }
    if (farm.farm_type === 1 && (!collectionName || !schemaName)) {
      toast.error("Please enter collection and schema names");
      return;
    }
    if (farm.farm_type === 3 && (!attributeName || !attributeValue)) {
      toast.error("Please enter attribute name and value");
      return;
    }

    // Validate at least one reward is set
    const hasReward = rewardInputs.some(r => parseFloat(r.quantity || "0") > 0);
    if (!hasReward) {
      toast.error("Please set at least one reward amount");
      return;
    }

    setIsSubmitting(true);

    try {
      const rewardValues = buildRewardValues();
      let action;

      switch (farm.farm_type) {
        case 0: // Collections
          action = buildSetCollectionValuesAction(
            accountName,
            farm.farm_name,
            collectionName,
            rewardValues
          );
          break;
        case 1: // Schemas
          action = buildSetSchemaValuesAction(
            accountName,
            farm.farm_name,
            collectionName,
            schemaName,
            rewardValues
          );
          break;
        case 2: // Templates
          action = buildSetTemplateValuesAction(
            accountName,
            farm.farm_name,
            collectionName,
            parseInt(templateId),
            rewardValues
          );
          break;
        case 3: // Attributes
          action = buildSetAttributeValuesAction(
            accountName,
            farm.farm_name,
            attributeName,
            attributeValue,
            rewardValues
          );
          break;
        default:
          throw new Error("Invalid farm type");
      }

      await session.transact({ actions: [action] }, { transactPlugins: getTransactPlugins(session) });
      toast.success(editingAsset ? "Stakable asset updated successfully!" : "Stakable asset added successfully!");
      resetForm();
      refetch();
      onSuccess?.();
    } catch (error: unknown) {
      console.error("Error adding/updating stakable asset:", error);
      const errorMessage = error instanceof Error ? error.message : "Transaction failed";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  };

  const renderExistingAssets = () => {
    if (isLoadingConfig) {
      return <p className="text-sm text-muted-foreground">Loading existing assets...</p>;
    }

    if (!stakableConfig) {
      return <p className="text-sm text-muted-foreground">No stakable assets configured yet.</p>;
    }

    const getAssetList = (config: FarmStakableConfig) => {
      switch (farm.farm_type) {
        case 0:
          return config.collections?.map((c, i) => {
            const asset: EditingAsset = {
              type: "collection",
              collection: c.collection,
              hourlyRates: c.hourly_rates,
            };
            return (
              <div key={i} className="p-2 rounded bg-muted/50 border border-border/50 text-sm flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <a 
                    href={`https://atomichub.io/explorer/collection/wax-mainnet/${c.collection}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                  >
                    {c.collection}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <span className="text-muted-foreground ml-2">
                    ({c.hourly_rates?.map(r => r.quantity).join(" + ") || "No rates"})
                  </span>
                </div>
                {canEdit && (
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEditAsset(asset)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setAssetToRemove(asset)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            );
          });
        case 1:
          return config.schemas?.map((s, i) => {
            const asset: EditingAsset = {
              type: "schema",
              collection: s.collection,
              schema: s.schema,
              hourlyRates: s.hourly_rates,
            };
            return (
              <div key={i} className="p-2 rounded bg-muted/50 border border-border/50 text-sm flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <a 
                    href={`https://atomichub.io/explorer/schema/wax-mainnet/${s.collection}/${s.schema}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                  >
                    {s.collection}:{s.schema}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <span className="text-muted-foreground ml-2">
                    ({s.hourly_rates?.map(r => r.quantity).join(" + ") || "No rates"})
                  </span>
                </div>
                {canEdit && (
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEditAsset(asset)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setAssetToRemove(asset)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            );
          });
        case 2:
          return config.templates?.map((t, i) => {
            const asset: EditingAsset = {
              type: "template",
              templateId: t.template_id,
              hourlyRates: t.hourly_rates,
            };
            return (
              <div key={i} className="p-2 rounded bg-muted/50 border border-border/50 text-sm flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <a 
                    href={`https://wax.atomichub.io/explorer/template/wax-mainnet/_/${t.template_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Template #{t.template_id}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <span className="text-muted-foreground ml-2">
                    ({t.hourly_rates?.map(r => r.quantity).join(" + ") || "No rates"})
                  </span>
                </div>
                {canEdit && (
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEditAsset(asset)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setAssetToRemove(asset)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            );
          });
        case 3:
          return config.attributes?.map((a, i) => {
            const asset: EditingAsset = {
              type: "attribute",
              attributeName: a.attribute_name,
              attributeValue: a.attribute_value,
              hourlyRates: a.hourly_rates,
            };
            return (
              <div key={i} className="p-2 rounded bg-muted/50 border border-border/50 text-sm flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{a.attribute_name}={a.attribute_value}</span>
                  <span className="text-muted-foreground ml-2">
                    ({a.hourly_rates?.map(r => r.quantity).join(" + ") || "No rates"})
                  </span>
                </div>
                {canEdit && (
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEditAsset(asset)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setAssetToRemove(asset)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            );
          });
        default:
          return null;
      }
    };

    const assets = getAssetList(stakableConfig);
    if (!assets || assets.length === 0) {
      return <p className="text-sm text-muted-foreground">No stakable assets configured yet.</p>;
    }

    return <div className="space-y-2">{assets}</div>;
  };

  const renderFormFields = () => {
    switch (farm.farm_type) {
      case 0: // Collections
        return (
          <div className="space-y-2">
            <Label htmlFor="collectionName">Collection Name</Label>
            <Input
              id="collectionName"
              placeholder="e.g., cheesenfts111"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value.toLowerCase())}
            />
          </div>
        );
      case 1: // Schemas
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="collectionName">Collection Name</Label>
              <Input
                id="collectionName"
                placeholder="e.g., cheesenfts111"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value.toLowerCase())}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schemaName">Schema Name</Label>
              <Input
                id="schemaName"
                placeholder="e.g., cheese"
                value={schemaName}
                onChange={(e) => setSchemaName(e.target.value.toLowerCase())}
              />
            </div>
          </>
        );
      case 2: // Templates
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="templateCollectionName">Collection Name</Label>
              <Input
                id="templateCollectionName"
                placeholder="e.g., cheesenfts111"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value.toLowerCase())}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="templateId">Template ID</Label>
              <Input
                id="templateId"
                type="number"
                placeholder="e.g., 123456"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              />
            </div>
          </>
        );
      case 3: // Attributes
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="attributeName">Attribute Name</Label>
              <Input
                id="attributeName"
                placeholder="e.g., rarity"
                value={attributeName}
                onChange={(e) => setAttributeName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="attributeValue">Attribute Value</Label>
              <Input
                id="attributeValue"
                placeholder="e.g., legendary"
                value={attributeValue}
                onChange={(e) => setAttributeValue(e.target.value)}
              />
            </div>
          </>
        );
      default:
        return null;
    }
  };

  const getRemoveAssetDescription = () => {
    if (!assetToRemove) return "";
    switch (assetToRemove.type) {
      case "collection":
        return `collection "${assetToRemove.collection}"`;
      case "schema":
        return `schema "${assetToRemove.collection}:${assetToRemove.schema}"`;
      case "template":
        return `template #${assetToRemove.templateId}`;
      case "attribute":
        return `attribute "${assetToRemove.attributeName}=${assetToRemove.attributeValue}"`;
      default:
        return "this asset";
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(newOpen) => {
        setOpen(newOpen);
        if (!newOpen) resetForm();
      }}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Manage Stakable Assets
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              Manage Stakable Assets
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[70vh]">
            <div className="space-y-6 pr-2">
              {/* Farm Type Info */}
              <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Farm Type:</span>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                    {FARM_TYPE_LABELS[farm.farm_type] || "Unknown"}
                  </Badge>
                </div>
              </div>

              {/* Edit Mode Banner */}
              {canEdit && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 flex items-start gap-2">
                  <Info className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-green-400">Editing enabled</p>
                    <p className="text-muted-foreground">Farm is closed with no stakers. You can edit or remove existing assets.</p>
                  </div>
                </div>
              )}

              {/* Existing Assets */}
              <Card className="border-border/50 bg-card/50">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Current Stakable Assets</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {renderExistingAssets()}
                </CardContent>
              </Card>

              {/* Add/Edit Asset Form */}
              <Card className="border-border/50 bg-card/50">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {editingAsset ? (
                      <>
                        <Pencil className="h-4 w-4" />
                        Edit {FARM_TYPE_LABELS[farm.farm_type]?.slice(0, -1) || "Asset"}
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Add New {FARM_TYPE_LABELS[farm.farm_type]?.slice(0, -1) || "Asset"}
                      </>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {renderFormFields()}

                  {/* Reward Inputs */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Hourly Reward Rates</Label>
                    {farm.reward_pools.map((pool, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="any"
                          placeholder="0.0000"
                          className="flex-1"
                          value={rewardInputs[index]?.quantity || ""}
                          onChange={(e) => {
                            const newInputs = [...rewardInputs];
                            newInputs[index] = { quantity: e.target.value };
                            setRewardInputs(newInputs);
                          }}
                        />
                        <Badge variant="secondary" className="min-w-[80px] justify-center">
                          {pool.symbol}/hr
                        </Badge>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">
                      Set the hourly reward rate for each token. Users will earn this amount per hour per staked NFT.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {editingAsset && (
                      <Button
                        variant="outline"
                        onClick={resetForm}
                        className="flex-1"
                      >
                        Cancel Edit
                      </Button>
                    )}
                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting || !session}
                      className={`bg-cheese text-cheese-foreground hover:bg-cheese/90 ${editingAsset ? 'flex-1' : 'w-full'}`}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {editingAsset ? "Updating..." : "Adding..."}
                        </>
                      ) : (
                        <>
                          {editingAsset ? (
                            <>
                              <Pencil className="h-4 w-4 mr-2" />
                              Update Stakable Asset
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-2" />
                              Add Stakable Asset
                            </>
                          )}
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={!!assetToRemove} onOpenChange={(open) => !open && setAssetToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Stakable Asset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {getRemoveAssetDescription()} from this farm? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveAsset}
              disabled={isRemoving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemoving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
