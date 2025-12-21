import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useWax } from "@/context/WaxContext";
import { buildCreateDaoAction, DAO_CONTRACT } from "@/lib/dao";
import { toast } from "sonner";
import { Loader2, Plus, Wallet } from "lucide-react";

export function CreateDao() {
  const { session, isConnected, login } = useWax();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    daoName: "",
    description: "",
    logo: "",
    tokenContract: "",
    tokenSymbol: "",
  });

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

    setLoading(true);
    try {
      const action = buildCreateDaoAction(
        String(session.actor),
        formData
      );

      await session.transact({ actions: [action] });
      
      toast.success("DAO created successfully!");
      setFormData({
        daoName: "",
        description: "",
        logo: "",
        tokenContract: "",
        tokenSymbol: "",
      });
    } catch (error) {
      console.error("Failed to create DAO:", error);
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
    <Card className="max-w-2xl mx-auto bg-card/50 border-border/50">
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-cheese" />
            Create a New DAO
          </CardTitle>
          <span className="px-2.5 py-1 text-xs font-semibold bg-cheese/20 text-cheese border border-cheese/30 rounded-full">
            Stake to DAO (Custodial)
          </span>
        </div>
        <CardDescription className="space-y-2">
          <span className="block">
            Set up your decentralized autonomous organization on the WAX blockchain.
            Contract: <code className="text-cheese">{DAO_CONTRACT}</code>
          </span>
          <span className="block text-xs bg-muted/50 p-3 rounded-lg border border-border/50">
            <strong className="text-foreground">How it works:</strong> Members stake their governance tokens to the DAO contract to gain voting power. 
            Staked tokens are held custodially by the DAO until unstaked. Voting power equals the amount of tokens staked.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleCreate} className="space-y-6">
          {/* DAO Name */}
          <div className="space-y-2">
            <Label htmlFor="daoName">DAO Name *</Label>
            <Input
              id="daoName"
              placeholder="e.g., cheesedao"
              value={formData.daoName}
              onChange={(e) => setFormData({ ...formData, daoName: e.target.value })}
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

          {/* Logo URL */}
          <div className="space-y-2">
            <Label htmlFor="logo">Logo URL</Label>
            <Input
              id="logo"
              type="url"
              placeholder="https://example.com/logo.png"
              value={formData.logo}
              onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
            />
          </div>

          {/* Token Contract */}
          <div className="space-y-2">
            <Label htmlFor="tokenContract">Governance Token Contract</Label>
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
            <Label htmlFor="tokenSymbol">Token Symbol</Label>
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
                Create DAO
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
