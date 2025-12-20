import { useState, useEffect } from "react";
import { useWallet } from "@/hooks/useWallet";
import { fetchUserLocks, TokenLock, parseAsset, formatUnlockTime, isClaimable, getTimeRemaining } from "@/lib/locker";
import { transact, WAXDAO_CONTRACT } from "@/lib/wax";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Unlock, RefreshCw, Clock, Coins } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function MyLocks() {
  const { session } = useWallet();
  const { toast } = useToast();
  const [locks, setLocks] = useState<TokenLock[]>([]);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState<number | null>(null);

  const loadLocks = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const userLocks = await fetchUserLocks(session.account);
      setLocks(userLocks);
    } catch (error) {
      console.error("Failed to load locks:", error);
      toast({
        title: "Error",
        description: "Failed to load your locks",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (session) {
      loadLocks();
    }
  }, [session]);

  const handleClaim = async (lock: TokenLock) => {
    if (!session) return;
    setClaiming(lock.lock_id);
    try {
      await transact(session, [
        {
          account: WAXDAO_CONTRACT,
          name: "claim",
          authorization: [{ actor: session.account, permission: "active" }],
          data: {
            lock_id: lock.lock_id,
          },
        },
      ]);
      toast({
        title: "Success!",
        description: "Tokens claimed successfully",
      });
      await loadLocks();
    } catch (error: any) {
      toast({
        title: "Claim Failed",
        description: error.message || "Failed to claim tokens",
        variant: "destructive",
      });
    }
    setClaiming(null);
  };

  if (!session) {
    return (
      <Card className="border-dashed border-muted-foreground/30">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Lock className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            Connect your wallet to view your locked tokens
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your Locks</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={loadLocks}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading && locks.length === 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-32" />
            </Card>
          ))}
        </div>
      ) : locks.length === 0 ? (
        <Card className="border-dashed border-muted-foreground/30">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Coins className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              You don't have any locked tokens yet
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {locks.map((lock) => {
            const { amount, symbol } = parseAsset(lock.locked_amount);
            const claimable = isClaimable(lock);
            const timeRemaining = getTimeRemaining(lock.unlock_time);

            return (
              <Card
                key={lock.lock_id}
                className={`transition-all ${
                  claimable ? "border-cheese/50 cheese-glow" : ""
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <span className="text-cheese">{symbol}</span>
                    </CardTitle>
                    <Badge
                      variant={lock.is_claimed ? "secondary" : claimable ? "default" : "outline"}
                      className={claimable ? "bg-cheese text-cheese-foreground" : ""}
                    >
                      {lock.is_claimed ? "Claimed" : claimable ? "Claimable" : "Locked"}
                    </Badge>
                  </div>
                  <CardDescription className="font-mono text-xs">
                    ID: {lock.lock_id}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Amount</span>
                    <span className="font-semibold">{amount} {symbol}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {claimable ? "Unlocked" : "Unlocks in"}
                    </span>
                    <span className="font-medium">
                      {lock.is_claimed ? "-" : timeRemaining}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatUnlockTime(lock.unlock_time)}
                  </div>
                  {claimable && !lock.is_claimed && (
                    <Button
                      onClick={() => handleClaim(lock)}
                      disabled={claiming === lock.lock_id}
                      className="w-full bg-cheese hover:bg-cheese-dark text-primary-foreground"
                    >
                      {claiming === lock.lock_id ? (
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Unlock className="h-4 w-4 mr-2" />
                      )}
                      Claim Tokens
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
