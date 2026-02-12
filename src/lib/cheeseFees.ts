/**
 * CHEESE Fee Payment System - Secure Two-Pool Pricing
 * 
 * Enables users to pay DAO and Farm creation fees with CHEESE token
 * at a 20% discount instead of WAX/WAXDAO.
 * 
 * SECURE FLOW (Single Transaction):
 * 1. User sends CHEESE to cheesefeefee
 * 2. Contract validates CHEESE value >= 200 WAX via Pool 1252
 * 3. Contract calculates WAXDAO via WAX-value exchange (Pool 1252 + Pool 277)
 * 4. Contract sends WAXDAO to user, burns 66% CHEESE, stakes 34%
 * 5. User's bundled transaction pays WAXDAO to WaxDAO and creates farm/dao
 * 6. If any step fails, entire transaction reverts atomically
 * 
 * SECURITY FEATURES:
 * - Two-pool pricing prevents flash manipulation
 * - Minimum WAXDAO output check prevents dust attacks
 * - Price deviation bounds catch extreme manipulation
 */

import { fetchTableRows } from "./waxRpcFallback";

// ============================================================================
// FEATURE FLAG - Set to true when contract is deployed and funded
// ============================================================================
export const CHEESE_FEE_ENABLED = true;

// ============================================================================
// Contract Configuration
// ============================================================================
export const CHEESE_FEE_CONTRACT = "cheesefeefee";
export const CHEESE_TOKEN_CONTRACT = "cheeseburger";
export const CHEESE_TOKEN_SYMBOL = "CHEESE";
export const CHEESE_TOKEN_PRECISION = 4;

export const WAXDAO_TOKEN_CONTRACT = "token.waxdao";
export const WAXDAO_TOKEN_SYMBOL = "WAXDAO";
export const WAXDAO_TOKEN_PRECISION = 8;

// Fee configuration
export const WAX_EQUIVALENT_FEE = 250; // 250 WAX equivalent (standard fee)
export const CHEESE_DISCOUNT = 0.20; // 20% discount when paying with CHEESE
export const CHEESE_SAFETY_BUFFER = 0.025; // 2.5% buffer for price drift

// WAX payment routing through cheesefeefee
export const WAX_TO_WAXDAO = 205; // WAX used to calculate WAXDAO for user
export const WAX_TO_BURNER = 45; // WAX sent to cheeseburner

// Security: Minimum WAXDAO output (must match contract)
export const MIN_WAXDAO_OUTPUT = 5.0; // 5 WAXDAO minimum

// Legacy export for compatibility
export const WAX_FEE_AMOUNT = WAX_EQUIVALENT_FEE;

// ============================================================================
// Types
// ============================================================================
export type FeeType = "dao" | "farm";
export type PaymentMethod = "wax" | "cheese";

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

// ============================================================================
// Action Builders
// ============================================================================

/**
 * Build CHEESE transfer action - contract calculates WAXDAO via two-pool pricing
 * This is the FIRST action in the bundled transaction
 * 
 * @param user - User sending CHEESE
 * @param cheeseAmount - Formatted CHEESE amount (e.g., "41840.5000 CHEESE")
 * @param feeType - "dao" or "farm"
 * @param entityName - Name of the entity being created
 */
export function buildCheesePaymentAction(
  user: string,
  cheeseAmount: string,
  feeType: FeeType,
  entityName: string
) {
  // Simplified memo - contract calculates WAXDAO from two-pool pricing
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
 * Build action to pay WAXDAO fee to WaxDAO contracts
 * This is the SECOND action - user pays WAXDAO received from inline action
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

/**
 * Build WAX payment action that routes through cheesefeefee
 * Instead of sending 250 WAX directly to WaxDAO, routes through contract:
 * - 205 WAX → converted to WAXDAO and sent to user (inline)
 * - 45 WAX → sent to cheeseburner (inline)
 * 
 * @param user - User sending WAX
 * @param feeType - "dao" or "farm"
 * @param entityName - Name of the entity being created
 */
export function buildWaxPaymentAction(
  user: string,
  feeType: FeeType,
  entityName: string
) {
  const memo = `wax${feeType}fee|${entityName}`;
  
  return {
    account: "eosio.token",
    name: "transfer",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      from: user,
      to: CHEESE_FEE_CONTRACT,
      quantity: `${WAX_EQUIVALENT_FEE}.00000000 WAX`,
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
 * Calculate discounted CHEESE amount for a given WAX fee using two-pool pricing
 * Mirrors the contract's calculation: WAX value of CHEESE → WAXDAO
 * 
 * @param waxAmount - The WAX fee amount (e.g., 250)
 * @param cheeseWaxPrice - Price of 1 CHEESE in WAX (from Pool 1252 or API)
 * @returns The discounted CHEESE amount with safety buffer
 */
export function calculateDiscountedCheeseAmount(
  waxAmount: number,
  cheeseWaxPrice: number
): number {
  if (cheeseWaxPrice <= 0) return 0;
  
  // Base amount: waxAmount / price per CHEESE
  const baseAmount = waxAmount / cheeseWaxPrice;
  
  // Apply 20% discount (user pays equivalent of 200 WAX instead of 250)
  const discountedAmount = baseAmount * (1 - CHEESE_DISCOUNT);
  
  // Add safety buffer to prevent failures from price drift
  const finalAmount = discountedAmount * (1 + CHEESE_SAFETY_BUFFER);
  
  return finalAmount;
}

/**
 * Calculate expected WAXDAO output using two-pool pricing
 * This should match what the contract calculates
 * 
 * @param cheeseAmount - Amount of CHEESE being sent
 * @param cheeseWaxPrice - Price of 1 CHEESE in WAX
 * @param waxdaoWaxPrice - Price of 1 WAXDAO in WAX (inverse of what we need)
 * @returns Expected WAXDAO output
 */
export function calculateExpectedWaxdaoOutput(
  cheeseAmount: number,
  cheeseWaxPrice: number,
  waxdaoWaxPrice: number
): number {
  if (cheeseWaxPrice <= 0 || waxdaoWaxPrice <= 0) return 0;
  
  // Step 1: Calculate WAX value of CHEESE
  const waxValue = cheeseAmount * cheeseWaxPrice;
  
  // Step 2: Convert WAX value to WAXDAO (waxdao_per_wax = 1 / waxdaoWaxPrice)
  const waxdaoPerWax = 1 / waxdaoWaxPrice;
  const waxdaoAmount = waxValue * waxdaoPerWax;
  
  return waxdaoAmount;
}

/**
 * Check if the contract pool has enough WAXDAO for a payment
 * @param requiredAmount - The WAXDAO amount needed
 */
export async function hasEnoughPoolBalance(requiredAmount: number): Promise<boolean> {
  const balance = await fetchContractWaxdaoBalance();
  return balance >= requiredAmount;
}
