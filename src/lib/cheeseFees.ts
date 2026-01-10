/**
 * CHEESE Fee Payment System
 * 
 * Enables users to pay DAO and Farm creation fees with CHEESE token
 * at a 20% discount instead of WAX/WAXDAO.
 * 
 * Feature is disabled by default. Set CHEESE_FEE_ENABLED = true after
 * deploying the cheesefeefee smart contract.
 */

import { fetchTableRows } from "./waxRpcFallback";

// ============================================================================
// FEATURE FLAG - Set to true when contract is deployed and funded
// ============================================================================
export const CHEESE_FEE_ENABLED = false;

// ============================================================================
// Contract Configuration
// ============================================================================
export const CHEESE_FEE_CONTRACT = "cheesefeefee";
export const CHEESE_TOKEN_CONTRACT = "cheeseburger";
export const CHEESE_TOKEN_SYMBOL = "CHEESE";
export const CHEESE_TOKEN_PRECISION = 8;

export const WAXDAO_TOKEN_CONTRACT = "mdcryptonfts";
export const WAXDAO_TOKEN_SYMBOL = "WAXDAO";
export const WAXDAO_TOKEN_PRECISION = 8;

// For reference/display
export const WAX_EQUIVALENT_FEE = 250; // 250 WAX equivalent
export const CHEESE_DISCOUNT = 0.20; // 20% discount when paying with CHEESE

// Legacy export for compatibility
export const WAX_FEE_AMOUNT = WAX_EQUIVALENT_FEE;

// ============================================================================
// Types
// ============================================================================
export type FeeType = "dao" | "farm";
export type PaymentMethod = "wax" | "cheese";

export interface Prepayment {
  id: number;
  user: string;
  fee_type: string;
  entity_name: string;
  cheese_paid: string;
  paid_at: string;
  used: boolean;
}

export interface ContractBalance {
  waxdao: number;
  cheese: number;
}

// ============================================================================
// Fetch Functions
// ============================================================================

/**
 * Fetch the WAXDAO balance of the cheesefeefee contract
 * Used to check if the pool has enough WAXDAO to process payments
 */
export async function fetchContractWaxdaoBalance(): Promise<number> {
  try {
    const response = await fetchTableRows<{ balance: string }>({
      code: WAXDAO_TOKEN_CONTRACT,
      scope: CHEESE_FEE_CONTRACT,
      table: "accounts",
      limit: 1,
    });

    if (response.rows.length === 0) return 0;
    
    const balanceStr = response.rows[0].balance;
    const amount = parseFloat(balanceStr.split(" ")[0]);
    return isNaN(amount) ? 0 : amount;
  } catch (error) {
    console.error("Failed to fetch contract WAXDAO balance:", error);
    return 0;
  }
}

/**
 * Fetch user's prepayment for a specific entity
 * Returns the full prepayment including ID for the finalise action
 */
export async function fetchUserPrepayment(
  user: string,
  feeType: FeeType,
  entityName: string
): Promise<Prepayment | null> {
  try {
    const response = await fetchTableRows<Prepayment>({
      code: CHEESE_FEE_CONTRACT,
      scope: CHEESE_FEE_CONTRACT,
      table: "prepayments",
      limit: 100,
    });

    // Find matching prepayment (unused for prepay check, or used for finalise)
    const prepayment = response.rows.find(
      (p) =>
        p.user === user &&
        p.fee_type === feeType &&
        p.entity_name === entityName
    );

    return prepayment || null;
  } catch (error) {
    console.error("Failed to fetch user prepayment:", error);
    return null;
  }
}

/**
 * Fetch user's unused prepayment (for checking if prepay is needed)
 */
export async function fetchUnusedPrepayment(
  user: string,
  feeType: FeeType,
  entityName: string
): Promise<Prepayment | null> {
  try {
    const response = await fetchTableRows<Prepayment>({
      code: CHEESE_FEE_CONTRACT,
      scope: CHEESE_FEE_CONTRACT,
      table: "prepayments",
      limit: 100,
    });

    const prepayment = response.rows.find(
      (p) =>
        p.user === user &&
        p.fee_type === feeType &&
        p.entity_name === entityName &&
        !p.used
    );

    return prepayment || null;
  } catch (error) {
    console.error("Failed to fetch user prepayment:", error);
    return null;
  }
}

// ============================================================================
// Action Builders
// ============================================================================

/**
 * Build action to send CHEESE as prepayment
 */
export function buildCheesePrepayAction(
  user: string,
  cheeseAmount: string,
  feeType: FeeType,
  entityName: string
) {
  const memo = `${feeType}fee|${entityName}`;
  
  return {
    account: CHEESE_TOKEN_CONTRACT,
    name: "transfer",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      from: user,
      to: CHEESE_FEE_CONTRACT,
      quantity: cheeseAmount,
      memo,
    },
  };
}

/**
 * Build action to request WAXDAO from the contract
 * This must be bundled with the creation action
 */
export function buildProvideAction(
  user: string,
  feeType: FeeType,
  entityName: string,
  waxdaoAmount: string
) {
  return {
    account: CHEESE_FEE_CONTRACT,
    name: "provide",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user,
      fee_type: feeType,
      entity_name: entityName,
      waxdao_amount: waxdaoAmount,
    },
  };
}

/**
 * Build action to finalise - transfer CHEESE to eosio.null
 * This must be called at the END of the bundled transaction
 */
export function buildFinaliseAction(
  user: string,
  prepaymentId: number
) {
  return {
    account: CHEESE_FEE_CONTRACT,
    name: "finalise",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user,
      prepayment_id: prepaymentId,
    },
  };
}

/**
 * Build action to pay WAXDAO fee to WaxDAO contracts
 */
export function buildWaxdaoFeeAction(
  sender: string,
  targetContract: string,
  waxdaoAmount: string,
  memo: string
) {
  return {
    account: WAXDAO_TOKEN_CONTRACT,
    name: "transfer",
    authorization: [{ actor: sender, permission: "active" }],
    data: {
      from: sender,
      to: targetContract,
      quantity: waxdaoAmount,
      memo,
    },
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format CHEESE amount with proper precision for transactions
 */
export function formatCheeseAmount(amount: number): string {
  return `${amount.toFixed(CHEESE_TOKEN_PRECISION)} ${CHEESE_TOKEN_SYMBOL}`;
}

/**
 * Format CHEESE amount for display (with commas)
 */
export function formatCheeseDisplay(amount: number): string {
  const rounded = Math.ceil(amount);
  return new Intl.NumberFormat().format(rounded);
}

/**
 * Calculate discounted CHEESE amount for a given WAX fee
 * @param waxAmount - The WAX fee amount (e.g., 250)
 * @param cheeseWaxPrice - Price of 1 CHEESE in WAX
 * @returns The discounted CHEESE amount
 */
export function calculateDiscountedCheeseAmount(
  waxAmount: number,
  cheeseWaxPrice: number
): number {
  if (cheeseWaxPrice <= 0) return 0;
  
  // Base amount: waxAmount / price per CHEESE
  const baseAmount = waxAmount / cheeseWaxPrice;
  
  // Apply 20% discount
  const discountedAmount = baseAmount * (1 - CHEESE_DISCOUNT);
  
  return discountedAmount;
}

/**
 * Check if the contract pool has enough WAXDAO for a payment
 * @param requiredAmount - The WAXDAO amount needed
 */
export async function hasEnoughPoolBalance(requiredAmount: number): Promise<boolean> {
  const balance = await fetchContractWaxdaoBalance();
  return balance >= requiredAmount;
}
