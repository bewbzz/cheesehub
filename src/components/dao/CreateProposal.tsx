import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWax } from "@/context/WaxContext";
import { buildCreateProposalAction, buildTokenTransferProposalAction, TokenTransferProposalData } from "@/lib/dao";
import { toast } from "sonner";
import { Loader2, X, FileText, Send } from "lucide-react";

interface CreateProposalProps {
  daoName: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function CreateProposal({ daoName, onSuccess, onCancel }: CreateProposalProps) {
  const { session } = useWax();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    proposalType: "standard",
  });
  const [transferData, setTransferData] = useState<TokenTransferProposalData>({
    recipient: "",
    amount: "",
    tokenSymbol: "WAX",
    tokenContract: "eosio.token",
  });

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

    setLoading(true);
    try {
      let action;
      
      if (formData.proposalType === "transfer") {
        // Build token transfer proposal with the transfer action included
        action = buildTokenTransferProposalAction(
          String(session.actor),
          daoName,
          {
            title: formData.title,
            description: formData.description,
            transfer: transferData,
          }
        );
      } else {
        // Build standard proposal
        action = buildCreateProposalAction(
          String(session.actor),
          daoName,
          {
            title: formData.title,
            description: formData.description,
            proposalType: formData.proposalType,
          }
        );
      }

      await session.transact({ actions: [action] });
      toast.success("Proposal created successfully!");
      onSuccess();
    } catch (error) {
      console.error("Failed to create proposal:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create proposal");
    } finally {
      setLoading(false);
    }
  }

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
            <Label htmlFor="type">Type</Label>
            <Select
              value={formData.proposalType}
              onValueChange={(value) => setFormData({ ...formData, proposalType: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="transfer">
                  <span className="flex items-center gap-2">
                    <Send className="h-3 w-3" />
                    Token Transfer (Treasury Withdrawal)
                  </span>
                </SelectItem>
                <SelectItem value="funding">Funding Request</SelectItem>
                <SelectItem value="governance">Governance Change</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Token Transfer Fields - shown only for transfer type */}
          {formData.proposalType === "transfer" && (
            <div className="space-y-3 p-3 bg-muted/50 rounded-lg border border-border/50">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
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
