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
static constexpr name WAXDAO_CONTRACT = "mdcryptonfts"_n;
static constexpr symbol WAXDAO_SYMBOL = symbol("WAXDAO", 8);
static constexpr name DAO_CONTRACT = "dao.waxdao"_n;
static constexpr name FARM_CONTRACT = "farms.waxdao"_n;
static constexpr name NULL_ACCOUNT = "eosio.null"_n;

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

private:
    /**
     * @brief Parse memo in extended format "feetype|entityname|waxdao_amount"
     * @return tuple of (fee_type, entity_name, waxdao_amount)
     */
    tuple<string, name, asset> parse_memo_v2(const string& memo);
    
    /**
     * @brief Convert asset string (e.g., "250.00000000 WAXDAO") to asset
     */
    asset asset_from_string(const string& str);
    
    /**
     * @brief Check if a specific action exists in the current transaction
     */
    bool has_creation_action(const string& fee_type, name entity_name, name user);
};
