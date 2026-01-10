import { useState, useEffect } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { RefreshCw, Loader2, Coins, Info, AlertCircle, CheckCircle2 } from "lucide-react";
import { useCheeseFeePricing } from "@/hooks/useCheeseFeePricing";
import {
  CHEESE_FEE_ENABLED,
  PaymentMethod,
  FeeType,
  WAX_FEE_AMOUNT,
  fetchContractWaxBalance,
} from "@/lib/cheeseFees";
import cheeseLogo from "@/assets/cheese-logo.png";

interface FeePaymentSelectorProps {
  waxFee?: number;
  feeType: FeeType;
  entityName: string;
  selectedMethod: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  onCheeseAmountChange: (amount: string) => void;
  disabled?: boolean;
}

export function FeePaymentSelector({
  waxFee = WAX_FEE_AMOUNT,
  feeType,
  entityName,
  selectedMethod,
  onMethodChange,
  onCheeseAmountChange,
  disabled = false,
}: FeePaymentSelectorProps) {
  const pricing = useCheeseFeePricing(waxFee);
  const [poolBalance, setPoolBalance] = useState<number | null>(null);
  const [isCheckingPool, setIsCheckingPool] = useState(false);

  // Update parent with CHEESE amount when pricing changes
  useEffect(() => {
    if (pricing.isAvailable) {
      onCheeseAmountChange(pricing.formattedForTx);
    }
  }, [pricing.formattedForTx, pricing.isAvailable, onCheeseAmountChange]);

  // Check pool balance when CHEESE is selected
  useEffect(() => {
    if (CHEESE_FEE_ENABLED && selectedMethod === "cheese") {
      checkPoolBalance();
    }
  }, [selectedMethod]);

  async function checkPoolBalance() {
    setIsCheckingPool(true);
    try {
      const balance = await fetchContractWaxBalance();
      setPoolBalance(balance);
    } catch (error) {
      console.error("Failed to check pool balance:", error);
      setPoolBalance(null);
    } finally {
      setIsCheckingPool(false);
    }
  }

  // If CHEESE fee is not enabled, show only WAX option
  if (!CHEESE_FEE_ENABLED) {
    return (
      <div className="p-4 rounded-lg border border-cheese/30 bg-cheese/5">
        <div className="flex items-center gap-2 mb-2">
          <Coins className="h-5 w-5 text-cheese" />
          <h3 className="text-sm font-medium text-foreground">
            {feeType === "dao" ? "DAO" : "Farm"} Creation Fee
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">
          A one-time fee of <span className="font-semibold text-cheese">{waxFee} WAX</span> is required.
        </p>
      </div>
    );
  }

  const poolHasEnoughWax = poolBalance !== null && poolBalance >= waxFee;

  return (
    <TooltipProvider>
      <div className="p-4 rounded-lg border border-cheese/30 bg-cheese/5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-cheese" />
            <h3 className="text-sm font-medium text-foreground">
              {feeType === "dao" ? "DAO" : "Farm"} Creation Fee
            </h3>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <Info className="h-4 w-4 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Pay with CHEESE at a 20% discount! You don't need WAX in your wallet - the system provides it for you.</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <RadioGroup
          value={selectedMethod}
          onValueChange={(v) => onMethodChange(v as PaymentMethod)}
          className="space-y-3"
          disabled={disabled}
        >
          {/* WAX Option */}
          <div
            className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
              selectedMethod === "wax"
                ? "border-blue-500/50 bg-blue-500/10"
                : "border-border/50 hover:bg-muted/30"
            }`}
            onClick={() => !disabled && onMethodChange("wax")}
          >
            <RadioGroupItem value="wax" id="payment-wax" disabled={disabled} />
            <Label htmlFor="payment-wax" className="flex-1 cursor-pointer">
              <div className="flex items-center justify-between">
                <span className="font-medium">{waxFee} WAX</span>
                <span className="text-xs text-muted-foreground">Standard</span>
              </div>
            </Label>
          </div>

          {/* CHEESE Option */}
          <div
            className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
              selectedMethod === "cheese"
                ? "border-cheese/50 bg-cheese/10"
                : "border-border/50 hover:bg-muted/30"
            } ${!pricing.isAvailable ? "opacity-50" : ""}`}
            onClick={() => !disabled && pricing.isAvailable && onMethodChange("cheese")}
          >
            <RadioGroupItem
              value="cheese"
              id="payment-cheese"
              disabled={disabled || !pricing.isAvailable}
              className="mt-1"
            />
            <Label htmlFor="payment-cheese" className="flex-1 cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src={cheeseLogo} alt="CHEESE" className="w-5 h-5" />
                  {pricing.isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <span className="font-medium">{pricing.displayAmount}</span>
                  )}
                </div>
                <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-xs">
                  {pricing.savingsDisplay}
                </Badge>
              </div>
              
              {selectedMethod === "cheese" && (
                <div className="mt-2 space-y-2">
                  {/* Pool status */}
                  <div className="flex items-center gap-2 text-xs">
                    {isCheckingPool ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="text-muted-foreground">Checking pool...</span>
                      </>
                    ) : poolBalance !== null ? (
                      poolHasEnoughWax ? (
                        <>
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          <span className="text-green-600">Pool ready ({poolBalance.toFixed(0)} WAX available)</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3 w-3 text-amber-500" />
                          <span className="text-amber-600">Pool low - please try WAX payment</span>
                        </>
                      )
                    ) : null}
                  </div>
                  
                  {/* Refresh button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-cheese hover:text-cheese/80"
                    onClick={(e) => {
                      e.stopPropagation();
                      pricing.refetch();
                      checkPoolBalance();
                    }}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Refresh price
                  </Button>
                </div>
              )}
            </Label>
          </div>
        </RadioGroup>

        {!pricing.isAvailable && !pricing.isLoading && (
          <p className="text-xs text-amber-600">
            CHEESE price unavailable. Please use WAX payment.
          </p>
        )}
      </div>
    </TooltipProvider>
  );
}
