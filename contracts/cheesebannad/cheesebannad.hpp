#pragma once

#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <eosio/system.hpp>

using namespace eosio;
using namespace std;

/**
 * @title cheesebannad
 * @dev Smart contract for CHEESEHub banner ad slots (dual-position)
 * 
 * Admin initializes 24-hour ad slots with 2 positions each. Users rent
 * individual positions by paying WAX (100 WAX per position per day) via
 * eosio.token transfer.
 * 
 * WAX payments: split 25% to cheeseburner financing, 25% to cheesepowerz
 * financing, 50% swapped to CHEESE via Alcor (66% burned, 34% to liquidity staking).
 * 
 * SECURITY:
 *   - Cannot rent already-rented or past slots
 *   - Overpayment is automatically refunded
 *   - Expired slots cannot be edited
 *   - Suspended slots cannot be edited by renters (admin moderation)
 *
 * PRIMARY KEY ENCODING:
 *   pk = time * 10 + position (position is 1 or 2)
 *   Decode: time = pk / 10, position = pk % 10
 */

// Token constants
static constexpr name WAX_CONTRACT    = "eosio.token"_n;
static constexpr symbol WAX_SYMBOL    = symbol("WAX", 8);

// CHEESE ecosystem constants
static constexpr name ALCOR_CONTRACT     = "swap.alcor"_n;
static constexpr uint64_t CHEESE_WAX_POOL_ID = 1252;
static constexpr name CHEESE_CONTRACT    = "cheeseburger"_n;
static constexpr symbol CHEESE_SYMBOL    = symbol("CHEESE", 4);
static constexpr name NULL_ACCOUNT       = "eosio.null"_n;
static constexpr name LIQUIDITY_STAKING  = "xcheeseliqst"_n;
static constexpr name CHEESEBURNER       = "cheeseburner"_n;
static constexpr name CHEESEPOWERZ       = "cheesepowerz"_n;

// Distribution percentages (integer-only: numerator / 100)
static constexpr uint64_t WAX_BURNER_NUMERATOR  = 25;   // 25% WAX to cheeseburner
static constexpr uint64_t WAX_POWERZ_NUMERATOR  = 25;   // 25% WAX to cheesepowerz
static constexpr uint64_t CHEESE_BURN_NUMERATOR = 66;   // 66% CHEESE burned

// Pricing
static constexpr uint64_t SECONDS_PER_DAY      = 86400;
static constexpr int64_t  DEFAULT_WAX_PRICE     = 10000000000; // 100.00000000 WAX
static constexpr uint64_t SHARED_NUMERATOR      = 70;          // 70% of full price (30% off)
static constexpr name     PROMOZ_ACCOUNT        = "cheesepromoz"_n;
static constexpr uint64_t PROMOZ_NUMERATOR      = 50;          // 50% of full price
static constexpr uint64_t PERCENT_BASE          = 100;
static constexpr double   DEFAULT_CHEESE_BASELINE = 1.5;       // default WAX per CHEESE baseline

// Input limits
static constexpr uint32_t MAX_IPFS_HASH_LEN = 128;
static constexpr uint32_t MAX_URL_LEN       = 256;

// Alcor swap safe floor: 0.0001 CHEESE (4 decimals)
static constexpr int64_t MIN_CHEESE_OUTPUT = 1;

// Time buffers (anti-gaming)
static constexpr uint32_t RENT_BUFFER_SECONDS = 48 * 3600;  // 48 hours
static constexpr uint32_t JOIN_BUFFER_SECONDS = 12 * 3600;  // 12 hours

// Max slots to erase per cleanup call (prevent timeout)
static constexpr uint32_t MAX_CLEANUP_SLOTS = 100;

CONTRACT cheesebannad : public contract {
public:
    using contract::contract;

    /**
     * @brief Admin creates empty banner ad slots (24h each, both positions)
     */
    ACTION initbannerad(uint64_t start_time, uint64_t amount_of_slots);

    /**
     * @brief User edits their rented banner (IPFS hash + URL)
     */
    ACTION editadbanner(name user, uint64_t start_time, uint8_t position, string ipfs_hash, string website_url);

    /**
     * @brief User edits their shared banner slot (when they are the secondary renter)
     */
    ACTION editsharedad(name user, uint64_t start_time, uint8_t position, string ipfs_hash, string website_url);

    /**
     * @brief Admin sets pricing config including WAX/CHEESE baseline for UI display
     */
    ACTION setconfig(asset wax_price_per_day, double wax_per_cheese_baseline);

    /**
     * @brief Admin withdraws any token from the contract
     */
    ACTION withdraw(name token_contract, name to, asset quantity);

    /**
     * @brief Admin prunes expired slots to recover RAM (max 100 per call)
     */
    ACTION cleanup(uint64_t before_time);

    /**
     * @brief Admin removes a banner ad (zeroes IPFS hash + URL, sets suspended = true)
     * @param caller      Admin account authorizing this action
     * @param start_time  Slot start timestamp
     * @param position    1 or 2
     * @param clear_shared If true, also clears the shared renter's content
     */
    ACTION removeadbnr(name caller, uint64_t start_time, uint8_t position, bool clear_shared);

    /**
     * @brief Admin reinstates a previously suspended banner (sets suspended = false, re-enables editing)
     * @param caller     Admin account authorizing this action
     * @param start_time Slot start timestamp
     * @param position   1 or 2
     */
    ACTION reinstatebnr(name caller, uint64_t start_time, uint8_t position);

    /**
     * @brief Contract owner adds a new admin account
     * @param account WAX account to grant admin privileges
     */
    ACTION addadmin(name account);

    /**
     * @brief Contract owner removes an admin account
     * @param account WAX account to revoke admin privileges
     */
    ACTION removeadmin(name account);

    // ---- Transfer notifications ----

    [[eosio::on_notify("eosio.token::transfer")]]
    void on_wax_transfer(name from, name to, asset quantity, string memo);

    [[eosio::on_notify("cheeseburger::transfer")]]
    void on_cheese_transfer(name from, name to, asset quantity, string memo);

    // ---- Tables ----

    TABLE bannerad {
        uint64_t time;              // slot start timestamp
        uint8_t  position;          // 1 or 2
        name     user;              // primary renter (contract account = available)
        string   ipfs_hash;
        string   website_url;
        uint8_t  rental_type;       // 0 = exclusive, 1 = shared
        name     shared_user;       // second renter (empty = not filled)
        string   shared_ipfs_hash;
        string   shared_website_url;
        bool     suspended;         // true = admin has pulled this ad; blocks renter editing

        uint64_t primary_key() const { return time * 10 + position; }
    };
    typedef multi_index<"bannerads"_n, bannerad> bannerads_table;

    TABLE config {
        uint64_t id = 1;
        asset    wax_price_per_day;
        double   wax_per_cheese_baseline;

        uint64_t primary_key() const { return id; }
    };
    typedef multi_index<"config"_n, config> config_table;

    TABLE admin_entry {
        name account;
        uint64_t primary_key() const { return account.value; }
    };
    typedef multi_index<"admins"_n, admin_entry> admins_table;

private:
    // Parse memo "banner|start_time|num_days|position[|mode]"
    // mode: 'e' = exclusive (default), 's' = shared-primary, 'j' = join-shared
    tuple<uint64_t, uint64_t, uint8_t, char> parse_banner_memo(const string& memo);

    // Get current config (uses defaults if not set)
    asset get_config();

    // Assign consecutive slots to user for a specific position (and mode: e/s/j)
    void assign_slots(name user, uint64_t start_time, uint64_t num_days, uint8_t position, char mode);

    // Split WAX: 25% to cheeseburner, 25% to cheesepowerz, 50% swapped to CHEESE via Alcor
    void distribute_wax_funds(asset quantity);

    // Split CHEESE: 66% burned to eosio.null, 34% to xcheeseliqst
    void distribute_cheese_funds(asset quantity);

    // Check that 'account' is either get_self() or in the admins table, then require_auth
    void require_admin(name account);
};
