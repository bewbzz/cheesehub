import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWax } from "@/context/WaxContext";
import { 
  buildCreateProposalAction, 
  buildTokenTransferProposalAction, 
  buildMultiOptionProposalAction,
  buildRankedChoiceProposalAction,
  buildNFTTransferProposalAction,
  buildProposalCostAction,
  fetchDaoTreasuryNFTs,
  TokenTransferProposalData,
  NFTTransferProposalData,
  TreasuryNFT
} from "@/lib/dao";
import { toast } from "sonner";
import { Loader2, X, FileText, Send, Plus, Trash2, ListOrdered, Vote, Trophy, ImageIcon, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreateProposalProps {
  daoName: string;
  proposalCost: string; // e.g. "100.00000000 WAX"
  onSuccess: () => void;
  onCancel: () => void;
}

type ProposalType = "yesnoabstain" | "transfer" | "mostvotes" | "rankedchoice" | "nfttransfer";

export function CreateProposal({ daoName, proposalCost, onSuccess, onCancel }: CreateProposalProps) {
  const { session } = useWax();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    proposalType: "yesnoabstain" as ProposalType,
  });
  const [transferData, setTransferData] = useState<TokenTransferProposalData>({
    recipient: "",
    amount: "",
    tokenSymbol: "WAX",
    tokenContract: "eosio.token",
  });
  const [nftTransferData, setNftTransferData] = useState<NFTTransferProposalData>({
    recipient: "",
    assetIds: [],
  });
  const [treasuryNFTs, setTreasuryNFTs] = useState<TreasuryNFT[]>([]);
  const [loadingNFTs, setLoadingNFTs] = useState(false);
  const [customOptions, setCustomOptions] = useState<string[]>(["", ""]);

  useEffect(() => {
    if (formData.proposalType === "nfttransfer") {
      loadTreasuryNFTs();
    }
  }, [formData.proposalType]);

  async function loadTreasuryNFTs() {
    setLoadingNFTs(true);
    try {
      const nfts = await fetchDaoTreasuryNFTs(daoName);
      setTreasuryNFTs(nfts);
    } catch (error) {
      console.error("Failed to load treasury NFTs:", error);
    } finally {
      setLoadingNFTs(false);
    }
  }

  function toggleNFTSelection(assetId: string) {
    setNftTransferData(prev => {
      const newAssetIds = prev.assetIds.includes(assetId)
        ? prev.assetIds.filter(id => id !== assetId)
        : [...prev.assetIds, assetId];
      return { ...prev, assetIds: newAssetIds };
    });
  }

  const addOption = () => {
    if (customOptions.length < 10) {
      setCustomOptions([...customOptions, ""]);
    }
  };

  const removeOption = (index: number) => {
    if (customOptions.length > 2) {
      setCustomOptions(customOptions.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...customOptions];
    newOptions[index] = value;
    setCustomOptions(newOptions);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!session) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!formData.title.trim()) {
      toast.error("Proposal title is required");
      return;
    }

    // Validate token transfer fields if transfer proposal
    if (formData.proposalType === "transfer") {
      if (!transferData.recipient.trim()) {
        toast.error("Recipient account is required for token transfer");
        return;
      }
      if (!transferData.amount.trim()) {
        toast.error("Amount is required for token transfer");
        return;
      }
    }

    // Validate custom options for multi-option and ranked choice
    if (formData.proposalType === "mostvotes" || formData.proposalType === "rankedchoice") {
      const validOptions = customOptions.filter(opt => opt.trim());
      if (validOptions.length < 2) {
        toast.error("At least 2 options are required");
        return;
      }
    }

    // Validate NFT transfer fields
    if (formData.proposalType === "nfttransfer") {
      if (!nftTransferData.recipient.trim()) {
        toast.error("Recipient account is required for NFT transfer");
        return;
      }
      if (nftTransferData.assetIds.length === 0) {
        toast.error("Please select at least one NFT to transfer");
        return;
      }
    }

    setLoading(true);
    try {
      let proposalAction;
      const actor = String(session.actor);
      
      switch (formData.proposalType) {
        case "transfer":
          proposalAction = buildTokenTransferProposalAction(actor, daoName, {
            title: formData.title,
            description: formData.description,
            transfer: transferData,
          });
          break;
        
        case "nfttransfer":
          proposalAction = buildNFTTransferProposalAction(actor, daoName, {
            title: formData.title,
            description: formData.description,
            transfer: nftTransferData,
          });
          break;
        
        case "mostvotes":
          proposalAction = buildMultiOptionProposalAction(actor, daoName, {
            title: formData.title,
            description: formData.description,
            options: customOptions.filter(opt => opt.trim()),
          });
          break;
        
        case "rankedchoice":
          proposalAction = buildRankedChoiceProposalAction(actor, daoName, {
            title: formData.title,
            description: formData.description,
            options: customOptions.filter(opt => opt.trim()),
          });
          break;
        
        default: // yesnoabstain
          proposalAction = buildCreateProposalAction(actor, daoName, {
            title: formData.title,
            description: formData.description,
            proposalType: "standard",
          });
      }

      // Build actions array - include payment if proposalCost > 0
      const actions = [];
      
      // Parse proposal cost to check if payment is required
      const costAmount = parseFloat(proposalCost.split(" ")[0]);
      if (costAmount > 0) {
        actions.push(buildProposalCostAction(actor, daoName, proposalCost));
      }
      actions.push(proposalAction);

      await session.transact({ actions });
      toast.success("Proposal created successfully!");
      onSuccess();
    } catch (error) {
      console.error("Failed to create proposal:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create proposal");
    } finally {
      setLoading(false);
    }
  }

  const proposalTypeInfo: Record<ProposalType, { icon: React.ReactNode; description: string }> = {
    yesnoabstain: {
      icon: <Vote className="h-4 w-4 text-cheese" />,
      description: "Voters choose Yes, No, or Abstain",
    },
    transfer: {
      icon: <Send className="h-4 w-4 text-cheese" />,
      description: "Transfer tokens from the DAO treasury when passed",
    },
    nfttransfer: {
      icon: <ImageIcon className="h-4 w-4 text-cheese" />,
      description: "Transfer NFTs from the DAO treasury when passed",
    },
    mostvotes: {
      icon: <Trophy className="h-4 w-4 text-cheese" />,
      description: "Multiple options - the one with most votes wins",
    },
    rankedchoice: {
      icon: <ListOrdered className="h-4 w-4 text-cheese" />,
      description: "Voters rank options by preference",
    },
  };

  return (
    <Card className="bg-muted/30 border-cheese/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-cheese" />
            New Proposal
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Proposal title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe your proposal..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          {/* Proposal Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Voting Type</Label>
            <Select
              value={formData.proposalType}
              onValueChange={(value: ProposalType) => setFormData({ ...formData, proposalType: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select voting type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yesnoabstain">
                  <span className="flex items-center gap-2">
                    <Vote className="h-3 w-3" />
                    Yes / No / Abstain
                  </span>
                </SelectItem>
                <SelectItem value="mostvotes">
                  <span className="flex items-center gap-2">
                    <Trophy className="h-3 w-3" />
                    Most Votes Wins
                  </span>
                </SelectItem>
                <SelectItem value="rankedchoice">
                  <span className="flex items-center gap-2">
                    <ListOrdered className="h-3 w-3" />
                    Ranked Choice
                  </span>
                </SelectItem>
                <SelectItem value="transfer">
                  <span className="flex items-center gap-2">
                    <Send className="h-3 w-3" />
                    Token Transfer
                  </span>
                </SelectItem>
                <SelectItem value="nfttransfer">
                  <span className="flex items-center gap-2">
                    <ImageIcon className="h-3 w-3" />
                    NFT Transfer
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              {proposalTypeInfo[formData.proposalType].icon}
              {proposalTypeInfo[formData.proposalType].description}
            </p>
          </div>

          {/* Token Transfer Fields */}
          {formData.proposalType === "transfer" && (
            <div className="space-y-3 p-3 bg-muted/50 rounded-lg border border-border/50">
              <p className="text-sm font-medium flex items-center gap-2">
                <Send className="h-4 w-4 text-cheese" />
                Token Transfer Details
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="recipient">Recipient Account *</Label>
                  <Input
                    id="recipient"
                    placeholder="e.g. user.wam"
                    value={transferData.recipient}
                    onChange={(e) => setTransferData({ ...transferData, recipient: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount *</Label>
                  <Input
                    id="amount"
                    placeholder="e.g. 100.00000000"
                    value={transferData.amount}
                    onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="tokenSymbol">Token Symbol</Label>
                  <Select
                    value={transferData.tokenSymbol}
                    onValueChange={(value) => {
                      const contract = value === "WAX" ? "eosio.token" : "token.waxdao";
                      setTransferData({ ...transferData, tokenSymbol: value, tokenContract: contract });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WAX">WAX</SelectItem>
                      <SelectItem value="WAXDAO">WAXDAO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tokenContract">Token Contract</Label>
                  <Input
                    id="tokenContract"
                    value={transferData.tokenContract}
                    onChange={(e) => setTransferData({ ...transferData, tokenContract: e.target.value })}
                    placeholder="e.g. eosio.token"
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                When this proposal passes, {transferData.amount || "0"} {transferData.tokenSymbol} will be transferred from the DAO treasury to {transferData.recipient || "[recipient]"}
              </p>
            </div>
          )}

          {/* NFT Transfer Fields */}
          {formData.proposalType === "nfttransfer" && (
            <div className="space-y-3 p-3 bg-muted/50 rounded-lg border border-border/50">
              <p className="text-sm font-medium flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-cheese" />
                NFT Transfer Details
              </p>
              
              <div className="space-y-2">
                <Label htmlFor="nftRecipient">Recipient Account *</Label>
                <Input
                  id="nftRecipient"
                  placeholder="e.g. user.wam"
                  value={nftTransferData.recipient}
                  onChange={(e) => setNftTransferData({ ...nftTransferData, recipient: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Select NFTs from Treasury *</Label>
                  {loadingNFTs && <Loader2 className="h-4 w-4 animate-spin text-cheese" />}
                </div>
                
                {loadingNFTs ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-cheese" />
                  </div>
                ) : treasuryNFTs.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground bg-muted/30 rounded-lg">
                    <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No NFTs in treasury</p>
                    <p className="text-xs">Deposit NFTs to the treasury first</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                    {treasuryNFTs.map((nft) => (
                      <button
                        key={nft.asset_id}
                        type="button"
                        onClick={() => toggleNFTSelection(nft.asset_id)}
                        className={cn(
                          "relative aspect-square rounded-lg overflow-hidden border-2 transition-all",
                          nftTransferData.assetIds.includes(nft.asset_id)
                            ? "border-cheese ring-2 ring-cheese/30"
                            : "border-border/50 hover:border-cheese/50"
                        )}
                      >
                        {nft.image ? (
                          <img
                            src={nft.image}
                            alt={nft.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        {nftTransferData.assetIds.includes(nft.asset_id) && (
                          <div className="absolute inset-0 bg-cheese/20 flex items-center justify-center">
                            <Check className="h-6 w-6 text-cheese" />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                          <p className="text-[10px] text-white truncate">{nft.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {nftTransferData.assetIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {nftTransferData.assetIds.length} NFT(s) selected for transfer to {nftTransferData.recipient || "[recipient]"}
                </p>
              )}
            </div>
          )}

          {/* Custom Options for Most Votes Wins & Ranked Choice */}
          {(formData.proposalType === "mostvotes" || formData.proposalType === "rankedchoice") && (
            <div className="space-y-3 p-3 bg-muted/50 rounded-lg border border-border/50">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium flex items-center gap-2">
                  {formData.proposalType === "mostvotes" ? (
                    <Trophy className="h-4 w-4 text-cheese" />
                  ) : (
                    <ListOrdered className="h-4 w-4 text-cheese" />
                  )}
                  Voting Options
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOption}
                  disabled={customOptions.length >= 10}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
              
              <div className="space-y-2">
                {customOptions.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-6">{index + 1}.</span>
                    <Input
                      placeholder={`Option ${index + 1}`}
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      className="flex-1"
                    />
                    {customOptions.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOption(index)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                {formData.proposalType === "mostvotes"
                  ? "Voters will select one option. The option with the most votes wins."
                  : "Voters will rank all options in order of preference. Uses instant-runoff voting."}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !formData.title.trim()}
              className="flex-1 bg-cheese hover:bg-cheese/90 text-cheese-foreground"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Proposal"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
