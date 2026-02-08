#pragma once

#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <eosio/system.hpp>

using namespace eosio;
using namespace std;

/**
 * @title cheesebannad
 * @dev Smart contract for CHEESEHub banner ad slots
 * 
 * Admin initializes 24-hour ad slots. Users rent slots by paying either:
 *   - WAX (100 WAX per day) via eosio.token transfer
 *   - CHEESE (equivalent to 100 WAX at current Alcor pool price) via cheeseburger transfer
 * 
 * CHEESE payments: 66% burned to eosio.null, 34% sent to xcheeseliqst
 * WAX payments: held in contract for admin withdrawal
 * 
 * SECURITY:
 *   - Alcor Pool 1252 reserves-based pricing (same model as cheesefeefee)
 *   - Price deviation check against admin-set baseline
 *   - Cannot rent already-rented or past slots
 */

// Token constants
static constexpr name WAX_CONTRACT    = "eosio.token"_n;
static constexpr symbol WAX_SYMBOL    = symbol("WAX", 8);
static constexpr name CHEESE_CONTRACT = "cheeseburger"_n;
static constexpr symbol CHEESE_SYMBOL = symbol("CHEESE", 4);
static constexpr name NULL_ACCOUNT    = "eosio.null"_n;
static constexpr name LIQUIDITY_STAKING = "xcheeseliqst"_n;

// Alcor pool
static constexpr name     ALCOR_CONTRACT     = "swap.alcor"_n;
static constexpr uint64_t CHEESE_WAX_POOL_ID = 1252;

// Fee distribution
static constexpr double BURN_PERCENT = 0.66;

// Pricing
static constexpr uint64_t SECONDS_PER_DAY      = 86400;
static constexpr int64_t  DEFAULT_WAX_PRICE     = 10000000000; // 100.00000000 WAX
static constexpr double   MAX_PRICE_DEVIATION   = 0.10;        // 10%
static constexpr double   DEFAULT_WAX_PER_CHEESE = 1.50;       // baseline

// Input limits
static constexpr uint32_t MAX_IPFS_HASH_LEN = 128;
static constexpr uint32_t MAX_URL_LEN       = 256;

CONTRACT cheesebannad : public contract {
public:
    using contract::contract;

    /**
     * @brief Admin creates empty banner ad slots (24h each)
     */
    ACTION initbannerad(uint64_t start_time, uint64_t amount_of_slots);

    /**
     * @brief User edits their rented banner (IPFS hash + URL)
     */
    ACTION editadbanner(name user, uint64_t start_time, string ipfs_hash, string website_url);

    /**
     * @brief Admin sets pricing config
     */
    ACTION setconfig(asset wax_price_per_day, double wax_per_cheese_baseline);

    /**
     * @brief Admin withdraws any token from the contract
     */
    ACTION withdraw(name token_contract, name to, asset quantity);

    // ---- Transfer notifications ----

    [[eosio::on_notify("eosio.token::transfer")]]
    void on_wax_transfer(name from, name to, asset quantity, string memo);

    [[eosio::on_notify("cheeseburger::transfer")]]
    void on_cheese_transfer(name from, name to, asset quantity, string memo);

    // ---- Tables ----

    TABLE bannerad {
        uint64_t time;        // slot start timestamp (primary key)
        name     user;        // renter (contract account = available)
        string   ipfs_hash;
        string   website_url;

        uint64_t primary_key() const { return time; }
    };
    typedef multi_index<"bannerads"_n, bannerad> bannerads_table;

    TABLE config {
        uint64_t id = 1;
        asset    wax_price_per_day;
        double   wax_per_cheese_baseline;

        uint64_t primary_key() const { return id; }
    };
    typedef multi_index<"config"_n, config> config_table;

    // Alcor pool struct (matches cheesefeefee / cheesepowerz)
    struct [[eosio::table]] alcor_pool {
        uint64_t       id;
        bool           active;
        extended_asset tokenA;
        extended_asset tokenB;
        uint32_t       fee;
        uint32_t       feeProtocol;
        int32_t        tickSpacing;
        uint128_t      maxLiquidityPerTick;

        uint64_t primary_key() const { return id; }
    };
    typedef multi_index<"pools"_n, alcor_pool> alcor_pools_table;

private:
    // Parse memo "banner|start_time|num_days"
    tuple<uint64_t, uint64_t> parse_banner_memo(const string& memo);

    // Get WAX-per-CHEESE price from Alcor Pool 1252
    double get_cheese_wax_price();

    // Get current config (uses defaults if not set)
    pair<asset, double> get_config();

    // Validate price deviation
    void check_price_deviation(double actual, double baseline);

    // Assign consecutive slots to user
    void assign_slots(name user, uint64_t start_time, uint64_t num_days);

    // Distribute CHEESE: 66% burn, 34% liquidity staking
    void distribute_cheese(asset quantity);
};
