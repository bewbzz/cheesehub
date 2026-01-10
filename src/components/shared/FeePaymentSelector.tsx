import { useState, useEffect } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { RefreshCw, Loader2, Coins, Info, AlertCircle, CheckCircle2 } from "lucide-react";
import { useCheeseFeePricing } from "@/hooks/useCheeseFeePricing";
import { useWaxdaoFeePricing } from "@/hooks/useWaxdaoFeePricing";
import {
  CHEESE_FEE_ENABLED,
  PaymentMethod,
  FeeType,
  WAX_FEE_AMOUNT,
  fetchContractWaxdaoBalance,
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
  const cheesePricing = useCheeseFeePricing(waxFee);
  const waxdaoPricing = useWaxdaoFeePricing();
  const [poolBalance, setPoolBalance] = useState<number | null>(null);
  const [isCheckingPool, setIsCheckingPool] = useState(false);

  // Update parent with CHEESE amount when pricing changes
  useEffect(() => {
    if (cheesePricing.isAvailable) {
      onCheeseAmountChange(cheesePricing.formattedForTx);
    }
  }, [cheesePricing.formattedForTx, cheesePricing.isAvailable, onCheeseAmountChange]);

  // Check pool balance when CHEESE is selected
  useEffect(() => {
    if (CHEESE_FEE_ENABLED && selectedMethod === "cheese") {
      checkPoolBalance();
    }
  }, [selectedMethod]);

  async function checkPoolBalance() {
    setIsCheckingPool(true);
    try {
      const balance = await fetchContractWaxdaoBalance();
      setPoolBalance(balance);
    } catch (error) {
      console.error("Failed to check pool balance:", error);
      setPoolBalance(null);
    } finally {
      setIsCheckingPool(false);
    }
  }

  // Check if pool has enough WAXDAO for the calculated amount
  const poolHasEnoughWaxdao = poolBalance !== null && waxdaoPricing.isAvailable && poolBalance >= waxdaoPricing.waxdaoAmount;

  // Determine if CHEESE option is fully available
  const isCheeseSelectable = CHEESE_FEE_ENABLED && cheesePricing.isAvailable;

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
              <p>Pay with CHEESE at a 20% discount! You don't need WAX or WAXDAO in your wallet - the system provides it for you.</p>
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
            className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
              !CHEESE_FEE_ENABLED
                ? "opacity-50 cursor-not-allowed border-border/30 bg-muted/10"
                : selectedMethod === "cheese"
                  ? "border-cheese/50 bg-cheese/10 cursor-pointer"
                  : "border-border/50 hover:bg-muted/30 cursor-pointer"
            } ${CHEESE_FEE_ENABLED && !cheesePricing.isAvailable ? "opacity-50" : ""}`}
            onClick={() => isCheeseSelectable && !disabled && onMethodChange("cheese")}
          >
            <RadioGroupItem
              value="cheese"
              id="payment-cheese"
              disabled={!isCheeseSelectable || disabled}
              className="mt-1"
            />
            <Label htmlFor="payment-cheese" className={`flex-1 ${isCheeseSelectable ? "cursor-pointer" : "cursor-not-allowed"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src={cheeseLogo} alt="CHEESE" className="w-5 h-5" />
                  <span className="font-medium">Pay with CHEESE</span>
                </div>
                <div className="flex items-center gap-2">
                  {!CHEESE_FEE_ENABLED && (
                    <Badge className="bg-muted text-muted-foreground border-muted-foreground/30 text-xs">
                      Coming Soon
                    </Badge>
                  )}
                  <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-xs">
                    Save 20%
                  </Badge>
                </div>
              </div>
              
              {/* Description when CHEESE is not enabled */}
              {!CHEESE_FEE_ENABLED && (
                <p className="text-xs text-muted-foreground mt-2">
                  Pay creation fees with CHEESE tokens and receive a 20% discount
                </p>
              )}
              
              {/* Show pricing and pool status only when enabled */}
              {CHEESE_FEE_ENABLED && (
                <>
                  <div className="flex items-center gap-2 mt-1">
                    {cheesePricing.isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <span className="text-sm text-muted-foreground">{cheesePricing.displayAmount}</span>
                    )}
                  </div>
                  
                  {selectedMethod === "cheese" && (
                    <div className="mt-2 space-y-2">
                      {/* Pool status */}
                      <div className="flex items-center gap-2 text-xs">
                        {isCheckingPool || waxdaoPricing.isLoading ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span className="text-muted-foreground">Checking pool...</span>
                          </>
                        ) : poolBalance !== null && waxdaoPricing.isAvailable ? (
                          poolHasEnoughWaxdao ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                              <span className="text-green-600">Pool ready ({Math.floor(poolBalance).toLocaleString()} WAXDAO available)</span>
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
                          cheesePricing.refetch();
                          waxdaoPricing.refetch();
                          checkPoolBalance();
                        }}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Refresh price
                      </Button>
                    </div>
                  )}
                </>
              )}
            </Label>
          </div>
        </RadioGroup>

        {CHEESE_FEE_ENABLED && !cheesePricing.isAvailable && !cheesePricing.isLoading && (
          <p className="text-xs text-amber-600">
            CHEESE price unavailable. Please use WAX payment.
          </p>
        )}
      </div>
    </TooltipProvider>
  );
}
