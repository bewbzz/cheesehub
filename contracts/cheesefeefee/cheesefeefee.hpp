#pragma once

#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <eosio/system.hpp>
#include <eosio/transaction.hpp>

using namespace eosio;
using namespace std;

/**
 * @title cheesefeefee
 * @dev Smart contract for CHEESE token fee payments for DAO and Farm creation
 * 
 * SECURE SINGLE-TRANSACTION FLOW:
 * 1. User sends CHEESE to this contract with memo "daofee|entityname" or "farmfee|entityname"
 * 2. Contract validates CHEESE value >= 200 WAX via Pool 1252
 * 3. Contract calculates WAXDAO via WAX-value exchange (Pool 1252 + Pool 277)
 * 4. Contract immediately (inline) sends WAXDAO back to user
 * 5. Contract immediately (inline) burns 66% CHEESE to eosio.null, 34% to xcheeseliqst
 * 6. If any step fails, entire transaction reverts atomically
 * 
 * SECURITY FEATURES:
 * - Two-pool pricing prevents flash manipulation (must manipulate 2 pools)
 * - Minimum WAXDAO output check prevents dust attacks
 * - Price deviation bounds catch extreme manipulation
 */

// Token Constants
static constexpr name CHEESE_CONTRACT = "cheeseburger"_n;
static constexpr symbol CHEESE_SYMBOL = symbol("CHEESE", 4);
static constexpr name WAXDAO_CONTRACT = "token.waxdao"_n;
static constexpr symbol WAXDAO_SYMBOL = symbol("WAXDAO", 8);
static constexpr name WAX_CONTRACT = "eosio.token"_n;
static constexpr symbol WAX_SYMBOL = symbol("WAX", 8);
static constexpr name DAO_CONTRACT = "dao.waxdao"_n;
static constexpr name FARM_CONTRACT = "farms.waxdao"_n;
static constexpr name NULL_ACCOUNT = "eosio.null"_n;
static constexpr name LIQUIDITY_STAKING = "xcheeseliqst"_n;
static constexpr name CHEESEBURNER = "cheeseburner"_n;

// Fee Distribution (66% burn, 34% liquidity staking)
static constexpr double BURN_PERCENT = 0.66;

// Alcor DEX integration - TWO-POOL PRICING (Security: requires manipulating both pools)
static constexpr name ALCOR_CONTRACT = "swap.alcor"_n;
static constexpr uint64_t CHEESE_WAX_POOL_ID = 1252;    // CHEESE/WAX pool - validates CHEESE value
static constexpr uint64_t WAXDAO_WAX_POOL_ID = 1236;    // WAX/WAXDAO pool (WAX=tokenA, WAXDAO=tokenB)

// Security: Value-based exchange prevents Pool 8017 manipulation
// User sends 200 WAX worth of CHEESE → receives 200 WAX worth of WAXDAO
static constexpr double MIN_WAX_VALUE = 200.0;          // Minimum WAX value required
static constexpr double WAX_VALUE_TOLERANCE = 0.025;    // 2.5% tolerance for price fluctuations

// WAX payment routing: 205 WAX → WAXDAO for user, 45 WAX → cheeseburner
static constexpr int64_t WAX_FEE_REQUIRED = 25000000000;  // 250 WAX (8 decimals)
static constexpr double WAX_TO_WAXDAO = 205.0;            // WAX used to calculate WAXDAO
static constexpr double WAX_TO_BURNER = 45.0;             // WAX sent to cheeseburner

// Security: Minimum output prevents dust attacks
static constexpr int64_t MIN_WAXDAO_OUTPUT = 500000000; // 5 WAXDAO minimum (8 decimals)

// Security: Price deviation bounds catch extreme manipulation
static constexpr double MAX_PRICE_DEVIATION = 0.10;     // 10% max deviation from baseline
static constexpr double BASELINE_WAX_PER_CHEESE = 1.50; // ~expected CHEESE price
static constexpr double BASELINE_WAXDAO_PER_WAX = 32.0; // ~expected WAXDAO price

CONTRACT cheesefeefee : public contract {
public:
    using contract::contract;

    /**
     * @brief Called when user sends CHEESE to this contract
     * Validates value, calculates WAXDAO via two-pool pricing, sends WAXDAO, burns CHEESE
     * @param from - Sender
     * @param to - Receiver (this contract)
     * @param quantity - Amount of CHEESE
     * @param memo - Format: "daofee|entityname" or "farmfee|entityname"
     */
    [[eosio::on_notify("cheeseburger::transfer")]]
    void on_cheese_transfer(name from, name to, asset quantity, string memo);

    /**
     * @brief Called when user sends WAX to this contract for fee payment
     * Routes 205 WAX worth of WAXDAO to user, sends 45 WAX to cheeseburner
     * @param from - Sender
     * @param to - Receiver (this contract)
     * @param quantity - Amount of WAX (must be exactly 250 WAX)
     * @param memo - Format: "waxdaofee|entityname" or "waxfarmfee|entityname"
     */
    [[eosio::on_notify("eosio.token::transfer")]]
    void on_wax_transfer(name from, name to, asset quantity, string memo);

    /**
     * @brief Admin action to withdraw any token from the contract
     * @param token_contract - Contract of the token to withdraw
     * @param to - Recipient of the tokens
     * @param quantity - Amount to withdraw
     */
    ACTION withdraw(name token_contract, name to, asset quantity);
    
    /**
     * @brief Admin action to update baseline prices for deviation checks
     * Allows adjusting baselines as market conditions change
     * @param wax_per_cheese - New baseline CHEESE price in WAX
     * @param waxdao_per_wax - New baseline WAXDAO price per WAX
     */
    ACTION setbaseline(double wax_per_cheese, double waxdao_per_wax);

    // Alcor AMM Swap pools table - matches working cheesepowerz contract
    // Simple reserves-based pricing, no V3 sqrtPriceX64 complexity
    struct [[eosio::table]] alcor_pool {
        uint64_t id;
        bool active;
        extended_asset tokenA;  // First token with reserves
        extended_asset tokenB;  // Second token with reserves
        uint32_t fee;
        uint32_t feeProtocol;   // MUST be uint32_t (not uint8_t)
        int32_t tickSpacing;
        uint128_t maxLiquidityPerTick;
        
        uint64_t primary_key() const { return id; }
    };
    typedef multi_index<"pools"_n, alcor_pool> alcor_pools_table;
    
    // Config table for admin-adjustable baselines
    TABLE config {
        uint64_t id = 1;  // Singleton
        double wax_per_cheese_baseline;
        double waxdao_per_wax_baseline;
        
        uint64_t primary_key() const { return id; }
    };
    typedef multi_index<"config"_n, config> config_table;

private:
    /**
     * @brief Parse memo in simplified format "feetype|entityname"
     * @return tuple of (fee_type, entity_name)
     */
    tuple<string, name> parse_memo(const string& memo);
    
    /**
     * @brief Get token price from Alcor pool using reserves
     * @param pool_id - The Alcor pool ID
     * @param base_symbol - Symbol of token to get price for (in terms of other token)
     * @return Price as a double (other_token per base_token)
     */
    double get_price_from_pool(uint64_t pool_id, symbol_code base_symbol);
    
    /**
     * @brief Get current baseline prices (from config table or constants)
     */
    pair<double, double> get_baselines();
    
    /**
     * @brief Validate price is within acceptable deviation from baseline
     */
    void check_price_deviation(double actual, double baseline, const string& price_name);
    
    /**
     * @brief Calculate WAXDAO amount using secure two-pool WAX-value exchange
     * 1. Get WAX value of CHEESE from Pool 1252
     * 2. Validate minimum 200 WAX value
     * 3. Get WAXDAO per WAX from Pool 1236
     * 4. Calculate WAXDAO amount
     * 5. Validate minimum output
     * @param cheese_amount - Amount of CHEESE received
     * @return WAXDAO amount based on WAX-value equivalence
     */
    asset calculate_waxdao_amount(asset cheese_amount);
    
    /**
     * @brief Check if a specific action exists in the current transaction
     */
    bool has_creation_action(const string& fee_type, name entity_name, name user);
    
    /**
     * @brief Calculate WAXDAO amount from WAX using Pool 1236 only
     * @param wax_amount - Amount of WAX to convert
     * @return WAXDAO amount based on Pool 1236 rate
     */
    asset calculate_waxdao_from_wax(double wax_value);
};
