import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWax } from "@/context/WaxContext";
import { buildCreateProposalAction } from "@/lib/dao";
import { toast } from "sonner";
import { Loader2, X, FileText } from "lucide-react";

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

    setLoading(true);
    try {
      const action = buildCreateProposalAction(
        String(session.actor),
        daoName,
        {
          title: formData.title,
          description: formData.description,
          proposalType: formData.proposalType,
        }
      );

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
                <SelectItem value="funding">Funding Request</SelectItem>
                <SelectItem value="governance">Governance Change</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
