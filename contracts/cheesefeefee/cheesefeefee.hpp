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
 * SIMPLIFIED SINGLE-TRANSACTION FLOW:
 * 1. User sends CHEESE to this contract with memo "daofee|entityname|250.00000000 WAXDAO"
 * 2. Contract immediately (inline) sends WAXDAO back to user
 * 3. Contract immediately (inline) burns CHEESE to eosio.null
 * 4. User's bundled transaction uses the WAXDAO to pay creation fee
 * 5. If any step fails, entire transaction reverts atomically
 */

// Constants
static constexpr name CHEESE_CONTRACT = "cheeseburger"_n;
static constexpr symbol CHEESE_SYMBOL = symbol("CHEESE", 8);
static constexpr name WAXDAO_CONTRACT = "token.waxdao"_n;
static constexpr symbol WAXDAO_SYMBOL = symbol("WAXDAO", 8);
static constexpr name DAO_CONTRACT = "dao.waxdao"_n;
static constexpr name FARM_CONTRACT = "farms.waxdao"_n;
static constexpr name NULL_ACCOUNT = "eosio.null"_n;

// Alcor DEX integration for on-chain price validation
static constexpr name ALCOR_CONTRACT = "swap.alcor"_n;
static constexpr uint64_t CHEESE_WAX_POOL_ID = 1095;  // CHEESE/WAX pool
static constexpr uint64_t WAXDAO_WAX_POOL_ID = 274;   // WAXDAO/WAX pool

// 1:1 WAX value exchange: 200 WAX of CHEESE -> 200 WAX of WAXDAO
// The "20% discount" is from reduced fee (200 WAX instead of 250 WAX), not exchange rate
static constexpr double MIN_WAX_VALUE = 200.0;      // Minimum WAX value of CHEESE required
static constexpr double WAX_VALUE_TOLERANCE = 0.025; // 2.5% tolerance for price fluctuations

CONTRACT cheesefeefee : public contract {
public:
    using contract::contract;

    /**
     * @brief Called when user sends CHEESE to this contract
     * Immediately sends WAXDAO back and burns CHEESE in a single atomic transaction
     * @param from - Sender
     * @param to - Receiver (this contract)
     * @param quantity - Amount of CHEESE
     * @param memo - Format: "daofee|entityname|250.00000000 WAXDAO" or "farmfee|entityname|250.00000000 WAXDAO"
     */
    [[eosio::on_notify("cheeseburger::transfer")]]
    void on_cheese_transfer(name from, name to, asset quantity, string memo);

    /**
     * @brief Admin action to withdraw any token from the contract
     * @param token_contract - Contract of the token to withdraw
     * @param to - Recipient of the tokens
     * @param quantity - Amount to withdraw
     */
    ACTION withdraw(name token_contract, name to, asset quantity);

    // Alcor pool table struct (read from swap.alcor)
    struct alcor_pool {
        uint64_t id;
        bool active;
        struct {
            uint128_t sqrtPriceX64;
            int32_t tick;
        } currSlot;
        
        uint64_t primary_key() const { return id; }
    };
    typedef multi_index<"pools"_n, alcor_pool> alcor_pools_table;

private:
    /**
     * @brief Parse memo in simplified format "feetype|entityname"
     * @return tuple of (fee_type, entity_name)
     */
    tuple<string, name> parse_memo(const string& memo);
    
    /**
     * @brief Get token price in WAX from Alcor pool
     * @param pool_id - The Alcor pool ID
     * @return Price as a double
     */
    double get_price_from_pool(uint64_t pool_id);
    
    /**
     * @brief Calculate WAXDAO amount from CHEESE amount using live Alcor prices
     * @param cheese_amount - Amount of CHEESE received
     * @return Calculated WAXDAO amount with 20% discount applied
     */
    asset calculate_waxdao_amount(asset cheese_amount);
    
    /**
     * @brief Check if a specific action exists in the current transaction
     */
    bool has_creation_action(const string& fee_type, name entity_name, name user);
};
