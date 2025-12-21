import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWax } from "@/context/WaxContext";
import { buildDepositToTreasuryAction, fetchUserTokenBalance } from "@/lib/dao";
import { toast } from "sonner";
import { Loader2, ArrowDownToLine, Wallet } from "lucide-react";
import { useEffect } from "react";

interface TreasuryDepositProps {
  daoName: string;
  onSuccess: () => void;
}

const COMMON_TOKENS = [
  { symbol: "WAX", contract: "eosio.token", precision: 8 },
  { symbol: "WAXDAO", contract: "token.waxdao", precision: 8 },
];

export function TreasuryDeposit({ daoName, onSuccess }: TreasuryDepositProps) {
  const { session } = useWax();
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState(COMMON_TOKENS[0]);
  const [userBalance, setUserBalance] = useState<string>("0");
  const [loadingBalance, setLoadingBalance] = useState(false);

  useEffect(() => {
    if (session) {
      loadUserBalance();
    }
  }, [session, selectedToken]);

  async function loadUserBalance() {
    if (!session) return;
    setLoadingBalance(true);
    try {
      const balance = await fetchUserTokenBalance(
        selectedToken.contract,
        selectedToken.symbol,
        String(session.actor)
      );
      setUserBalance(balance);
    } catch (error) {
      console.error("Failed to load balance:", error);
    } finally {
      setLoadingBalance(false);
    }
  }

  async function handleDeposit() {
    if (!session) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setLoading(true);
    try {
      // Format amount with correct precision
      const formattedAmount = `${parseFloat(amount).toFixed(selectedToken.precision)} ${selectedToken.symbol}`;
      
      const action = buildDepositToTreasuryAction(
        String(session.actor),
        daoName,
        formattedAmount,
        selectedToken.contract
      );

      await session.transact({ actions: [action] });
      toast.success(`Successfully deposited ${formattedAmount} to treasury!`);
      setAmount("");
      onSuccess();
    } catch (error) {
      console.error("Failed to deposit:", error);
      toast.error(error instanceof Error ? error.message : "Failed to deposit");
    } finally {
      setLoading(false);
    }
  }

  if (!session) {
    return (
      <div className="p-4 bg-muted/30 rounded-lg text-center">
        <Wallet className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Connect your wallet to deposit tokens</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
      <div className="flex items-center gap-2">
        <ArrowDownToLine className="h-5 w-5 text-cheese" />
        <h4 className="font-medium">Deposit to Treasury</h4>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Token</Label>
          <Select
            value={selectedToken.symbol}
            onValueChange={(value) => {
              const token = COMMON_TOKENS.find(t => t.symbol === value);
              if (token) setSelectedToken(token);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMON_TOKENS.map((token) => (
                <SelectItem key={token.symbol} value={token.symbol}>
                  {token.symbol}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Amount</Label>
          <Input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="0"
            step="0.00000001"
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Your Balance:</span>
        <span className="font-medium">
          {loadingBalance ? (
            <Loader2 className="h-3 w-3 animate-spin inline" />
          ) : (
            userBalance
          )}
        </span>
      </div>

      <Button
        onClick={handleDeposit}
        disabled={loading || !amount || parseFloat(amount) <= 0}
        className="w-full bg-cheese hover:bg-cheese/90 text-cheese-foreground"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Depositing...
          </>
        ) : (
          <>
            <ArrowDownToLine className="h-4 w-4 mr-2" />
            Deposit {amount ? `${amount} ${selectedToken.symbol}` : ""}
          </>
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        Anyone can deposit tokens. To withdraw, create a Token Transfer proposal.
      </p>
    </div>
  );
}
