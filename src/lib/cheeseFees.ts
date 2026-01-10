/**
 * CHEESE Fee Payment System
 * 
 * Enables users to pay DAO and Farm creation fees with CHEESE token
 * at a 20% discount instead of WAX.
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

export const WAX_TOKEN_CONTRACT = "eosio.token";
export const WAX_TOKEN_SYMBOL = "WAX";
export const WAX_TOKEN_PRECISION = 8;

// Creation fee amounts
export const WAX_FEE_AMOUNT = 250; // 250 WAX
export const CHEESE_DISCOUNT = 0.20; // 20% discount when paying with CHEESE

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
  wax: number;
  cheese: number;
}

// ============================================================================
// Fetch Functions
// ============================================================================

/**
 * Fetch the WAX balance of the cheesefeefee contract
 * Used to check if the pool has enough WAX to process payments
 */
export async function fetchContractWaxBalance(): Promise<number> {
  try {
    const response = await fetchTableRows<{ balance: string }>({
      code: WAX_TOKEN_CONTRACT,
      scope: CHEESE_FEE_CONTRACT,
      table: "accounts",
      limit: 1,
    });

    if (response.rows.length === 0) return 0;
    
    const balanceStr = response.rows[0].balance;
    const amount = parseFloat(balanceStr.split(" ")[0]);
    return isNaN(amount) ? 0 : amount;
  } catch (error) {
    console.error("Failed to fetch contract WAX balance:", error);
    return 0;
  }
}

/**
 * Fetch user's prepayment for a specific entity
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

    // Find matching prepayment
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
 * Build action to request WAX from the contract
 * This must be bundled with the creation action
 */
export function buildProvideWaxAction(
  user: string,
  feeType: FeeType,
  entityName: string
) {
  return {
    account: CHEESE_FEE_CONTRACT,
    name: "providewax",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user,
      fee_type: feeType,
      entity_name: entityName,
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
 * Check if the contract pool has enough WAX for a payment
 */
export async function hasEnoughPoolBalance(): Promise<boolean> {
  const balance = await fetchContractWaxBalance();
  return balance >= WAX_FEE_AMOUNT;
}
