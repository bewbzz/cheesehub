import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  buildStakeTokenAction,
  buildUnstakeTokenAction,
  buildStakeNFTAction,
  buildUnstakeNFTAction,
} from "@/lib/dao";
import { fetchUserNFTsBySchema } from "@/services/atomicApi";
import { Loader2, Coins, Image, Wallet, Plus, Minus, RefreshCw, CheckCircle, UserPlus } from "lucide-react";

interface DaoStakingProps {
  dao: DaoInfo;
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

export function DaoStaking({ dao }: DaoStakingProps) {
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
  const isTokenBalanceDao = dao.dao_type === 4; // Token Balance DAO - uses wallet balance for voting
  const isTokenStakingDao = [1, 3].includes(dao.dao_type); // Token staking DAOs
  // Type 4 DAOs also need to stake tokens to register, so show staking UI
  const isTokenDao = isTokenStakingDao || isTokenBalanceDao; 
  const isNFTDao = [2, 5].includes(dao.dao_type);
  
  // For Token Balance DAOs, check if user is registered (has a stakers record)
  const [isRegistered, setIsRegistered] = useState(false);
  
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
      // For Token Balance DAOs (Type 4), check staked tokens (for registration) and wallet balance
      if (isTokenBalanceDao && tokenSymbol && accountName) {
        const [staked, balance] = await Promise.all([
          fetchUserStakedTokens(dao.dao_name, accountName),
          fetchUserTokenBalance(dao.token_contract, tokenSymbol, accountName),
        ]);
        setStakedTokens(staked);
        setAvailableBalance(balance);
        // Registration is based on having staked tokens
        setIsRegistered(staked !== null);
        console.log(`Type 4 DAO staking data for ${accountName}:`, { staked, balance });
      }
      
      // For Token Staking DAOs (Type 1, 3)
      if (isTokenStakingDao && tokenSymbol && accountName) {
        const [staked, balance] = await Promise.all([
          fetchUserStakedTokens(dao.dao_name, accountName),
          fetchUserTokenBalance(dao.token_contract, tokenSymbol, accountName),
        ]);
        setStakedTokens(staked);
        setAvailableBalance(balance);
      }
      
      if (isNFTDao && accountName) {
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
      
      const action = buildStakeTokenAction(
        session.actor.toString(),
        dao.dao_name,
        quantity,
        dao.token_contract
      );
      
      await session.transact({ actions: [action] });
      
      toast({
        title: "Tokens Staked",
        description: `Successfully staked ${quantity} to ${dao.dao_name}`,
      });
      
      setStakeAmount("");
      await loadStakingData();
    } catch (error) {
      console.error("Stake failed:", error);
      toast({
        title: "Stake Failed",
        description: error instanceof Error ? error.message : "Failed to stake tokens",
        variant: "destructive",
      });
    } finally {
      setStaking(false);
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
    } catch (error) {
      console.error("Unstake failed:", error);
      toast({
        title: "Unstake Failed",
        description: error instanceof Error ? error.message : "Failed to unstake tokens",
        variant: "destructive",
      });
    } finally {
      setStaking(false);
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
    } catch (error) {
      console.error("Stake NFTs failed:", error);
      toast({
        title: "Stake Failed",
        description: error instanceof Error ? error.message : "Failed to stake NFTs",
        variant: "destructive",
      });
    } finally {
      setStaking(false);
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
    } catch (error) {
      console.error("Unstake NFTs failed:", error);
      toast({
        title: "Unstake Failed",
        description: error instanceof Error ? error.message : "Failed to unstake NFTs",
        variant: "destructive",
      });
    } finally {
      setStaking(false);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Wallet className="h-5 w-5 text-cheese" />
            {isTokenBalanceDao ? "Voting Registration" : "Staking"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {DAO_TYPES[dao.dao_type]} - {isTokenBalanceDao 
              ? "Voting power based on wallet balance" 
              : "Stake to gain voting power"}
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

      {/* Token Balance DAO Registration UI */}
      {isTokenBalanceDao && tokenSymbol && (
        <div className="space-y-4">
          {/* Wallet Balance Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Coins className="h-4 w-4 text-cheese" />
                <span className="text-sm text-muted-foreground">Staked (Voting)</span>
              </div>
              <p className="text-xl font-bold">
                {stakedTokens?.balance || `0 ${tokenSymbol}`}
              </p>
              {stakedTokens && (
                <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" /> Registered to vote
                </p>
              )}
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="h-4 w-4 text-cheese" />
                <span className="text-sm text-muted-foreground">Wallet Balance</span>
              </div>
              <p className="text-xl font-bold">{availableBalance}</p>
            </div>
          </div>

          {/* Registration Status & Staking UI */}
          {stakedTokens ? (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div>
                  <p className="font-medium text-green-500">Registered to Vote</p>
                  <p className="text-sm text-muted-foreground">
                    You can now vote on proposals. For Type 4 DAOs, your voting power is calculated from your staked balance.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-cheese/10 border border-cheese/20 rounded-lg p-4 space-y-4">
              <div className="flex items-start gap-3">
                <UserPlus className="h-8 w-8 text-cheese shrink-0" />
                <div>
                  <p className="font-medium text-cheese">Stake Tokens to Register</p>
                  <p className="text-sm text-muted-foreground">
                    To vote in this Token Balance DAO, you need to stake at least a small amount of {tokenSymbol} tokens. 
                    This registers you as a voter and activates your voting ability.
                  </p>
                </div>
              </div>
              
              {/* Stake Input */}
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder={`Amount to stake (e.g., 1)`}
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleStakeTokens}
                  disabled={staking || !stakeAmount || parseFloat(stakeAmount) <= 0}
                  className="bg-cheese hover:bg-cheese/90 text-cheese-foreground"
                >
                  {staking ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Stake to Register
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Stake any amount (even 0.00000001 {tokenSymbol}) to register for voting.
              </p>
            </div>
          )}

          <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
            <p className="font-medium mb-1">How Token Balance DAOs work:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Stake tokens to register as a voter</li>
              <li>Your voting power is based on your staked balance</li>
              <li>You can unstake tokens anytime after voting</li>
            </ul>
          </div>
        </div>
      )}

      {/* Token Staking UI (for Type 1, 3 DAOs) */}
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

      {/* NFT Staking UI */}
      {isNFTDao && (
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
      {!isTokenDao && !isNFTDao && (
        <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-lg">
          <Wallet className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Unknown DAO Type</p>
          <p className="text-sm">Staking not supported for this DAO type</p>
        </div>
      )}
    </div>
  );
}