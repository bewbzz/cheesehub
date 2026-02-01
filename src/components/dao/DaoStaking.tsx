import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useWax } from "@/context/WaxContext";
import { useToast } from "@/hooks/use-toast";
import {
  DaoInfo,
  DAO_TYPES,
  StakedToken,
  StakedNFT,
  UserNFT,
  fetchUserStakedTokens,
  fetchUserStakedNFTs,
  fetchUserTokenBalance,
  buildStakeTokenActions,
  buildUnstakeTokenAction,
  buildStakeNFTAction,
  buildUnstakeNFTAction,
} from "@/lib/dao";
import { fetchUserNFTsBySchema } from "@/services/atomicApi";
import { closeWharfkitModals } from "@/lib/wharfKit";
import { ClaimVoteRam } from "./ClaimVoteRam";
import { Loader2, Coins, Image, Wallet, Plus, Minus, RefreshCw, CheckCircle, UserPlus, AlertCircle, Lock } from "lucide-react";

interface DaoStakingProps {
  dao: DaoInfo;
  onStakingChange?: () => void;
}

const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';

function getImageUrl(img: string): string {
  if (!img) return '/placeholder.svg';
  if (img.startsWith('http')) return img;
  if (img.startsWith('Qm') || img.startsWith('bafy')) {
    return `${IPFS_GATEWAY}${img}`;
  }
  return img;
}

export function DaoStaking({ dao, onStakingChange }: DaoStakingProps) {
  const { session, isConnected, accountName } = useWax();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [staking, setStaking] = useState(false);
  
  // Token staking state
  const [stakedTokens, setStakedTokens] = useState<StakedToken | null>(null);
  const [availableBalance, setAvailableBalance] = useState<string>("0");
  const [stakeAmount, setStakeAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");
  
  // NFT staking state
  const [stakedNFTs, setStakedNFTs] = useState<StakedNFT[]>([]);
  const [availableNFTs, setAvailableNFTs] = useState<UserNFT[]>([]);
  const [selectedToStake, setSelectedToStake] = useState<string[]>([]);
  const [selectedToUnstake, setSelectedToUnstake] = useState<string[]>([]);
  
  // Determine DAO type
  // Type 4 "Token Balance" DAOs actually require staking tokens to the DAO for voting weight
  // Type 5 "Hold NFTs" is non-custodial - no staking needed!
  const isTokenStakingDao = [1, 3, 4].includes(dao.dao_type); // All token staking DAOs including Type 4
  const isNFTStakingDao = dao.dao_type === 2; // Only Type 2 requires NFT staking
  const isHoldNFTDao = dao.dao_type === 5; // Type 5 = Hold NFTs (non-custodial)
  
  // Parse token info
  const tokenSymbol = dao.token_symbol !== "0,NULL" 
    ? dao.token_symbol.split(",")[1] 
    : null;
  const tokenPrecision = dao.token_symbol !== "0,NULL"
    ? parseInt(dao.token_symbol.split(",")[0])
    : 4;

  useEffect(() => {
    if (isConnected && accountName) {
      loadStakingData();
    } else {
      setLoading(false);
    }
  }, [isConnected, accountName, dao.dao_name]);

  async function loadStakingData() {
    setLoading(true);
    try {
      // For Token Staking DAOs (Type 1, 3, 4)
      if (isTokenStakingDao && tokenSymbol && accountName) {
        const [staked, balance] = await Promise.all([
          fetchUserStakedTokens(dao.dao_name, accountName),
          fetchUserTokenBalance(dao.token_contract, tokenSymbol, accountName),
        ]);
        setStakedTokens(staked);
        setAvailableBalance(balance);
      }
      
      if (isNFTStakingDao && accountName) {
        const collections = dao.gov_schemas.map(s => s.collection_name);
        const schemas = dao.gov_schemas.map(s => s.schema_name);
        
        const [staked, available] = await Promise.all([
          fetchUserStakedNFTs(dao.dao_name, accountName),
          fetchUserNFTsBySchema(accountName, collections, schemas),
        ]);
        setStakedNFTs(staked);
        setAvailableNFTs(available);
      }
    } catch (error) {
      console.error("Failed to load staking data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleStakeTokens() {
    if (!session || !stakeAmount || !tokenSymbol) return;
    
    setStaking(true);
    try {
      const amount = parseFloat(stakeAmount);
      const quantity = `${amount.toFixed(tokenPrecision)} ${tokenSymbol}`;
      
      // Use the new combined actions (staketokens + transfer in same tx)
      const actions = buildStakeTokenActions(
        session.actor.toString(),
        dao.dao_name,
        quantity,
        dao.token_contract
      );
      
      await session.transact({ actions });
      
      toast({
        title: "Tokens Staked",
        description: `Successfully staked ${quantity} to ${dao.dao_name}`,
      });
      
      setStakeAmount("");
      await loadStakingData();
      // Delay membership check to allow blockchain indexer to catch up
      setTimeout(() => onStakingChange?.(), 2000);
    } catch (error) {
      console.error("Stake failed:", error);
      closeWharfkitModals();
      toast({
        title: "Stake Failed",
        description: error instanceof Error ? error.message : "Failed to stake tokens",
        variant: "destructive",
      });
    } finally {
      setStaking(false);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  }

  async function handleUnstakeTokens() {
    if (!session || !unstakeAmount || !tokenSymbol) return;
    
    setStaking(true);
    try {
      const amount = parseFloat(unstakeAmount);
      const quantity = `${amount.toFixed(tokenPrecision)} ${tokenSymbol}`;
      
      const action = buildUnstakeTokenAction(
        session.actor.toString(),
        dao.dao_name,
        quantity
      );
      
      await session.transact({ actions: [action] });
      
      toast({
        title: "Tokens Unstaked",
        description: `Successfully unstaked ${quantity} from ${dao.dao_name}`,
      });
      
      setUnstakeAmount("");
      await loadStakingData();
      // Delay membership check to allow blockchain indexer to catch up
      setTimeout(() => onStakingChange?.(), 2000);
    } catch (error) {
      console.error("Unstake failed:", error);
      closeWharfkitModals();
      toast({
        title: "Unstake Failed",
        description: error instanceof Error ? error.message : "Failed to unstake tokens",
        variant: "destructive",
      });
    } finally {
      setStaking(false);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  }

  async function handleStakeNFTs() {
    if (!session || selectedToStake.length === 0) return;
    
    setStaking(true);
    try {
      const action = buildStakeNFTAction(
        session.actor.toString(),
        dao.dao_name,
        selectedToStake
      );
      
      await session.transact({ actions: [action] });
      
      toast({
        title: "NFTs Staked",
        description: `Successfully staked ${selectedToStake.length} NFT(s) to ${dao.dao_name}`,
      });
      
      setSelectedToStake([]);
      await loadStakingData();
      // Delay membership check to allow blockchain indexer to catch up
      setTimeout(() => onStakingChange?.(), 2000);
    } catch (error) {
      console.error("Stake NFTs failed:", error);
      closeWharfkitModals();
      toast({
        title: "Stake Failed",
        description: error instanceof Error ? error.message : "Failed to stake NFTs",
        variant: "destructive",
      });
    } finally {
      setStaking(false);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  }

  async function handleUnstakeNFTs() {
    if (!session || selectedToUnstake.length === 0) return;
    
    setStaking(true);
    try {
      const action = buildUnstakeNFTAction(
        session.actor.toString(),
        dao.dao_name,
        selectedToUnstake
      );
      
      await session.transact({ actions: [action] });
      
      toast({
        title: "NFTs Unstaked",
        description: `Successfully unstaked ${selectedToUnstake.length} NFT(s) from ${dao.dao_name}`,
      });
      
      setSelectedToUnstake([]);
      await loadStakingData();
      // Delay membership check to allow blockchain indexer to catch up
      setTimeout(() => onStakingChange?.(), 2000);
    } catch (error) {
      console.error("Unstake NFTs failed:", error);
      closeWharfkitModals();
      toast({
        title: "Unstake Failed",
        description: error instanceof Error ? error.message : "Failed to unstake NFTs",
        variant: "destructive",
      });
    } finally {
      setStaking(false);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  }

  function toggleStakeSelection(assetId: string) {
    setSelectedToStake(prev => 
      prev.includes(assetId) 
        ? prev.filter(id => id !== assetId)
        : [...prev, assetId]
    );
  }

  function toggleUnstakeSelection(assetId: string) {
    setSelectedToUnstake(prev => 
      prev.includes(assetId) 
        ? prev.filter(id => id !== assetId)
        : [...prev, assetId]
    );
  }

  if (!isConnected) {
    return (
      <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-lg">
        <Wallet className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Wallet Not Connected</p>
        <p className="text-sm">Connect your wallet to stake in this DAO</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-cheese" />
      </div>
    );
  }

  // Type 5 Hold NFT DAOs don't need staking
  if (isHoldNFTDao) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Image className="h-5 w-5 text-green-500" />
          <h3 className="text-lg font-semibold">Hold NFTs to Vote</h3>
        </div>
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <p className="text-sm text-foreground mb-2">
            <strong>No staking required!</strong> This is a "Hold NFT" DAO.
          </p>
          <p className="text-sm text-muted-foreground">
            Your NFTs stay in your wallet and are used directly when voting.
            Each eligible NFT = 1 vote. Simply hold NFTs from the eligible collections to participate in governance.
          </p>
        </div>
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground mb-2">Eligible NFT Collections:</p>
          <div className="flex flex-wrap gap-2">
            {dao.gov_schemas.map((schema, idx) => (
              <Badge key={idx} variant="secondary">
                {schema.collection_name}/{schema.schema_name}
              </Badge>
            ))}
          </div>
        </div>
        
        {/* Claim Vote RAM Section for Type 5 DAOs */}
        {accountName && (
          <ClaimVoteRam dao={dao} userAccount={accountName} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Wallet className="h-5 w-5 text-cheese" />
            Staking
          </h3>
          <p className="text-sm text-muted-foreground">
            {DAO_TYPES[dao.dao_type]} - Stake to gain voting power
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadStakingData}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Token Staking UI (for Type 1, 3, 4 DAOs) */}
      {isTokenStakingDao && tokenSymbol && (
        <div className="space-y-4">
          {/* Current Stake Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Coins className="h-4 w-4 text-cheese" />
                <span className="text-sm text-muted-foreground">Your Staked</span>
              </div>
              <p className="text-xl font-bold">
                {stakedTokens?.balance || `0 ${tokenSymbol}`}
              </p>
              {stakedTokens && stakedTokens.weight > 0 && (
                <p className="text-xs text-muted-foreground">
                  Voting Weight: {stakedTokens.weight.toLocaleString()}
                </p>
              )}
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="h-4 w-4 text-cheese" />
                <span className="text-sm text-muted-foreground">Available</span>
              </div>
              <p className="text-xl font-bold">{availableBalance}</p>
            </div>
          </div>

          {/* Stake Section */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Plus className="h-4 w-4" /> Stake Tokens
            </h4>
            
            {/* Stake Note */}
            <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-sm text-amber-200">
                <strong>Note:</strong> Tokens can be staked at any time but vote weight will not increase for any proposals already voted upon.
              </AlertDescription>
            </Alert>
            
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder={`Amount to stake`}
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleStakeTokens}
                disabled={staking || !stakeAmount}
                className="bg-cheese hover:bg-cheese/90 text-cheese-foreground"
              >
                {staking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Stake"}
              </Button>
            </div>
          </div>

          {/* Unstake Section */}
          {stakedTokens && stakedTokens.balance !== "0" && (
            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Minus className="h-4 w-4" /> Unstake Tokens
              </h4>
              
              {/* Vote Lock Warning */}
              <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
                <Lock className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-sm text-amber-200">
                  <strong>Note:</strong> Tokens used as voting weight on open proposals cannot be unstaked until those proposals end.
                </AlertDescription>
              </Alert>
              
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder={`Amount to unstake`}
                  value={unstakeAmount}
                  onChange={(e) => setUnstakeAmount(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleUnstakeTokens}
                  disabled={staking || !unstakeAmount}
                  variant="outline"
                >
                  {staking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unstake"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* NFT Staking UI (Type 2 only - custodial) */}
      {isNFTStakingDao && (
        <div className="space-y-4">
          {/* NFT Collections Info */}
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-2">Eligible NFT Collections:</p>
            <div className="flex flex-wrap gap-2">
              {dao.gov_schemas.map((schema, idx) => (
                <Badge key={idx} variant="secondary">
                  {schema.collection_name}/{schema.schema_name}
                </Badge>
              ))}
            </div>
          </div>

          {/* Staked NFTs */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2">
                <Image className="h-4 w-4" /> Your Staked NFTs ({stakedNFTs.length})
              </h4>
              {selectedToUnstake.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleUnstakeNFTs}
                  disabled={staking}
                >
                  {staking ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Unstake ({selectedToUnstake.length})
                </Button>
              )}
            </div>
            
            {/* Vote Lock Warning for NFTs */}
            {stakedNFTs.length > 0 && (
              <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
                <Lock className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-sm text-amber-200">
                  <strong>Note:</strong> NFTs used as voting weight on open proposals cannot be unstaked until those proposals end.
                </AlertDescription>
              </Alert>
            )}
            
            {stakedNFTs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No NFTs staked yet
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {stakedNFTs.map((nft) => (
                  <div
                    key={nft.asset_id}
                    onClick={() => toggleUnstakeSelection(nft.asset_id)}
                    className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                      selectedToUnstake.includes(nft.asset_id)
                        ? "border-cheese ring-2 ring-cheese/30"
                        : "border-transparent hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="aspect-square bg-muted">
                      <img
                        src={getImageUrl(nft.image)}
                        alt={nft.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute top-1 right-1">
                      <Checkbox
                        checked={selectedToUnstake.includes(nft.asset_id)}
                        className="bg-background/80"
                      />
                    </div>
                    <p className="text-xs p-1 truncate bg-background/80">{nft.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Available NFTs to Stake */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2">
                <Plus className="h-4 w-4" /> Available to Stake ({availableNFTs.length})
              </h4>
              {selectedToStake.length > 0 && (
                <Button
                  size="sm"
                  onClick={handleStakeNFTs}
                  disabled={staking}
                  className="bg-cheese hover:bg-cheese/90 text-cheese-foreground"
                >
                  {staking ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Stake ({selectedToStake.length})
                </Button>
              )}
            </div>
            {availableNFTs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No eligible NFTs in your wallet
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {availableNFTs.map((nft) => (
                  <div
                    key={nft.asset_id}
                    onClick={() => toggleStakeSelection(nft.asset_id)}
                    className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                      selectedToStake.includes(nft.asset_id)
                        ? "border-cheese ring-2 ring-cheese/30"
                        : "border-transparent hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="aspect-square bg-muted">
                      <img
                        src={getImageUrl(nft.image)}
                        alt={nft.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute top-1 right-1">
                      <Checkbox
                        checked={selectedToStake.includes(nft.asset_id)}
                        className="bg-background/80"
                      />
                    </div>
                    <p className="text-xs p-1 truncate bg-background/80">{nft.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Unknown DAO Type */}
      {!isTokenStakingDao && !isNFTStakingDao && !isHoldNFTDao && (
        <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-lg">
          <Wallet className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Unknown DAO Type</p>
          <p className="text-sm">Staking not supported for this DAO type</p>
        </div>
      )}
    </div>
  );
}