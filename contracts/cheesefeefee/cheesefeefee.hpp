#pragma once

#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <eosio/singleton.hpp>
#include <eosio/system.hpp>

using namespace eosio;
using namespace std;

/**
 * @title cheesefeefee
 * @dev Smart contract for CHEESE token fee payments for DAO and Farm creation
 * 
 * Flow:
 * 1. User sends CHEESE to this contract with memo "daofee|entityname" or "farmfee|entityname"
 * 2. Contract records prepayment, CHEESE is held in contract balance
 * 3. User calls providewax bundled with createdao/createfarm action
 * 4. Contract verifies creation action exists, sends 250 WAX to user, transfers CHEESE to eosio.null
 * 5. User receives WAX and uses it to pay the creation fee in the same transaction
 */

// Constants
static constexpr name CHEESE_CONTRACT = "cheeseburger"_n;
static constexpr symbol CHEESE_SYMBOL = symbol("CHEESE", 8);
static constexpr name WAX_CONTRACT = "eosio.token"_n;
static constexpr symbol WAX_SYMBOL = symbol("WAX", 8);
static constexpr name DAO_CONTRACT = "dao.waxdao"_n;
static constexpr name FARM_CONTRACT = "farms.waxdao"_n;
static constexpr name NULL_ACCOUNT = "eosio.null"_n;
static constexpr uint64_t WAX_FEE_AMOUNT = 25000000000; // 250 WAX with 8 decimals

CONTRACT cheesefeefee : public contract {
public:
    using contract::contract;

    /**
     * @brief Table to store prepayments
     * @param id - Unique identifier
     * @param user - User who made the prepayment
     * @param fee_type - "dao" or "farm"
     * @param entity_name - Name of the DAO or Farm being created
     * @param cheese_paid - Amount of CHEESE paid
     * @param paid_at - Block time when payment was made
     * @param used - Whether this prepayment has been consumed
     */
    TABLE prepayment {
        uint64_t id;
        name user;
        string fee_type;
        name entity_name;
        asset cheese_paid;
        time_point_sec paid_at;
        bool used;

        uint64_t primary_key() const { return id; }
        uint128_t by_user_entity() const { 
            return (uint128_t(user.value) << 64) | entity_name.value; 
        }
    };

    typedef eosio::multi_index<"prepayments"_n, prepayment,
        indexed_by<"byuserentity"_n, const_mem_fun<prepayment, uint128_t, &prepayment::by_user_entity>>
    > prepayments_table;

    /**
     * @brief Called when user sends CHEESE to this contract
     * @param from - Sender
     * @param to - Receiver (this contract)
     * @param quantity - Amount of CHEESE
     * @param memo - Format: "daofee|entityname" or "farmfee|entityname"
     */
    [[eosio::on_notify("cheeseburger::transfer")]]
    void on_cheese_transfer(name from, name to, asset quantity, string memo);

    /**
     * @brief Provides WAX to user and burns CHEESE - must be bundled with creation action
     * @param user - User requesting WAX
     * @param fee_type - "dao" or "farm"
     * @param entity_name - Name of the entity being created
     */
    ACTION providewax(name user, string fee_type, name entity_name);

    /**
     * @brief Admin action to refund unused prepayments
     * @param prepayment_id - ID of the prepayment to refund
     */
    ACTION refund(uint64_t prepayment_id);

    /**
     * @brief Admin action to withdraw WAX from the pool
     * @param to - Recipient of the WAX
     * @param quantity - Amount to withdraw
     */
    ACTION withdraw(name to, asset quantity);

private:
    // Helper to parse memo format "feetype|entityname"
    pair<string, name> parse_memo(const string& memo);
    
    // Helper to check if a specific action exists in the current transaction
    bool has_creation_action(const string& fee_type, name entity_name, name user);
};
