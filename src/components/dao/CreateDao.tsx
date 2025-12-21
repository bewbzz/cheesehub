import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useWax } from "@/context/WaxContext";
import { buildCreateDaoAction, DAO_CONTRACT, PROPOSER_TYPES } from "@/lib/dao";
import { toast } from "sonner";
import { Loader2, Plus, Wallet, ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function CreateDao() {
  const { session, isConnected, login } = useWax();
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formData, setFormData] = useState({
    daoName: "",
    description: "",
    logo: "",
    tokenContract: "",
    tokenSymbol: "",
    // Advanced settings
    threshold: 51,
    proposerType: 1,
    authors: "",
    minimumVotes: 1,
    minimumWeight: 0,
    proposalCost: 0,
    hoursPerProposal: 72,
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
      const action = buildCreateDaoAction(
        String(session.actor),
        {
          ...formData,
          authors: authorsArray,
        }
      );

      await session.transact({ actions: [action] });
      
      toast.success("DAO created successfully!");
      setFormData({
        daoName: "",
        description: "",
        logo: "",
        tokenContract: "",
        tokenSymbol: "",
        threshold: 51,
        proposerType: 1,
        authors: "",
        minimumVotes: 1,
        minimumWeight: 0,
        proposalCost: 0,
        hoursPerProposal: 72,
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
    <TooltipProvider>
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
            </div>

            {/* Governance Token Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Governance Token</h3>
              
              {/* Token Contract */}
              <div className="space-y-2">
                <Label htmlFor="tokenContract">Token Contract</Label>
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
            </div>

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
    </TooltipProvider>
  );
}
