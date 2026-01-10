import { useState, useEffect } from "react";
import { closeWharfkitModals } from "@/lib/wharfKit";
import { useWax } from "@/context/WaxContext";
import { getTokenBalances, WAXDAO_CONTRACT } from "@/lib/wax";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Lock, Calendar, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import cheeseLogo from "@/assets/cheese-logo.png";

interface TokenBalance {
  symbol: string;
  amount: string;
  contract: string;
}

export function CreateLock() {
  const { session, accountName, isConnected } = useWax();
  const { toast } = useToast();
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [unlockDate, setUnlockDate] = useState("");
  const [unlockTime, setUnlockTime] = useState("00:00");

  useEffect(() => {
    if (accountName) {
      loadTokens();
    }
  }, [accountName]);

  const loadTokens = async () => {
    if (!accountName) return;
    setLoading(true);
    try {
      const balances = await getTokenBalances(accountName);
      setTokens(balances);
    } catch (error) {
      console.error("Failed to load tokens:", error);
    }
    setLoading(false);
  };

  const getSelectedTokenInfo = () => {
    return tokens.find((t) => `${t.contract}:${t.symbol}` === selectedToken);
  };

  const handleCreate = async () => {
    if (!session || !accountName) return;

    const tokenInfo = getSelectedTokenInfo();
    if (!tokenInfo) {
      toast({
        title: "Error",
        description: "Please select a token",
        variant: "destructive",
      });
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    if (!unlockDate) {
      toast({
        title: "Error",
        description: "Please select an unlock date",
        variant: "destructive",
      });
      return;
    }

    // Construct unlock datetime
    const unlockDateTime = new Date(`${unlockDate}T${unlockTime}:00Z`);
    if (unlockDateTime <= new Date()) {
      toast({
        title: "Error",
        description: "Unlock time must be in the future",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      // Format amount with correct precision
      const precision = tokenInfo.amount.split(".")[1]?.length || 4;
      const formattedAmount = `${parseFloat(amount).toFixed(precision)} ${tokenInfo.symbol}`;
      const unlockTimestamp = Math.floor(unlockDateTime.getTime() / 1000);

      // Two-step process: 1) createlock, 2) deposit tokens
      await session.transact({
        actions: [
          // Step 1: Create the lock record
          {
            account: WAXDAO_CONTRACT,
            name: "createlock",
            authorization: [session.permissionLevel],
            data: {
              creator: accountName,
              receiver: accountName,
              amount: formattedAmount,
              token_contract: tokenInfo.contract,
              unlock_time: unlockTimestamp,
            },
          },
          // Step 2: Deposit tokens to activate the lock
          {
            account: tokenInfo.contract,
            name: "transfer",
            authorization: [session.permissionLevel],
            data: {
              from: accountName,
              to: WAXDAO_CONTRACT,
              quantity: formattedAmount,
              memo: "deposit_v2",
            },
          },
        ],
      });

      toast({
        title: "Lock Created!",
        description: `Successfully locked ${formattedAmount}`,
      });

      // Reset form
      setAmount("");
      setUnlockDate("");
      setUnlockTime("00:00");
      setSelectedToken("");
    } catch (error: any) {
      closeWharfkitModals();
      toast({
        title: "Lock Failed",
        description: error.message || "Failed to create lock",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  };

  if (!isConnected) {
    return (
      <Card className="border-dashed border-muted-foreground/30">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Lock className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            Connect your wallet to create a token lock
          </p>
        </CardContent>
      </Card>
    );
  }

  const tokenInfo = getSelectedTokenInfo();
  const minDate = new Date().toISOString().split("T")[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-cheese" />
          Create New Lock
        </CardTitle>
        <CardDescription>
          Lock your tokens until a specified date. Locked tokens cannot be accessed until the unlock time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Token Selection */}
        <div className="space-y-2">
          <Label htmlFor="token">Select Token</Label>
          <Select value={selectedToken} onValueChange={setSelectedToken}>
            <SelectTrigger id="token">
              <SelectValue placeholder={loading ? "Loading tokens..." : "Choose a token"} />
            </SelectTrigger>
            <SelectContent>
              {[...tokens]
                .sort((a, b) => {
                  const balanceDiff = parseFloat(b.amount) - parseFloat(a.amount);
                  if (balanceDiff !== 0) return balanceDiff;
                  return a.symbol.localeCompare(b.symbol);
                })
                .map((token) => (
                  <SelectItem
                    key={`${token.contract}:${token.symbol}`}
                    value={`${token.contract}:${token.symbol}`}
                  >
                    <span className="flex items-center gap-2">
                      <img src={cheeseLogo} alt={token.symbol} className="h-4 w-4" />
                      {token.symbol} - {token.amount}
                    </span>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {tokenInfo && (
            <p className="text-xs text-muted-foreground">
              Available: {tokenInfo.amount} {tokenInfo.symbol}
            </p>
          )}
        </div>

        {/* Amount Input */}
        <div className="space-y-2">
          <Label htmlFor="amount">Amount to Lock</Label>
          <div className="relative">
            <Input
              id="amount"
              type="number"
              placeholder="0.0000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pr-20"
            />
            {tokenInfo && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 text-xs text-cheese hover:text-cheese-dark"
                onClick={() => setAmount(tokenInfo.amount)}
              >
                MAX
              </Button>
            )}
          </div>
        </div>

        {/* Unlock Date & Time */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="unlock-date" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Unlock Date
            </Label>
            <Input
              id="unlock-date"
              type="date"
              min={minDate}
              value={unlockDate}
              onChange={(e) => setUnlockDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unlock-time">Unlock Time (UTC)</Label>
            <Input
              id="unlock-time"
              type="time"
              value={unlockTime}
              onChange={(e) => setUnlockTime(e.target.value)}
            />
          </div>
        </div>

        {/* Info Box */}
        <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border">
          <AlertCircle className="h-5 w-5 text-cheese shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Important</p>
            <p>
              Once locked, tokens cannot be retrieved until the unlock date. Make sure you've selected the correct amount and date.
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleCreate}
          disabled={creating || !selectedToken || !amount || !unlockDate}
          className="w-full bg-cheese hover:bg-cheese-dark text-primary-foreground font-semibold"
          size="lg"
        >
          {creating ? (
            <>
              <Lock className="h-4 w-4 mr-2 animate-pulse" />
              Creating Lock...
            </>
          ) : (
            <>
              <Lock className="h-4 w-4 mr-2" />
              Lock Tokens
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
