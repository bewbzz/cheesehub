#pragma once

#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <eosio/singleton.hpp>
#include <eosio/system.hpp>

using namespace eosio;
using namespace std;

// CHEESE token contract
static constexpr name CHEESE_CONTRACT = "cheeseburger"_n;
static constexpr symbol CHEESE_SYMBOL = symbol("CHEESE", 4);

// WAX system contracts
static constexpr name EOSIO_CONTRACT = "eosio"_n;
static constexpr name EOSIO_TOKEN = "eosio.token"_n;
static constexpr symbol WAX_SYMBOL = symbol("WAX", 8);

// Alcor AMM Swap contract
static constexpr name ALCOR_SWAP_CONTRACT = "swap.alcor"_n;

// Burn account
static constexpr name BURN_ACCOUNT = "eosio.null"_n;

// Liquidity staking account
static constexpr name CHEESE_LIQ_ACCOUNT = "xcheeseliqst"_n;

// Default Alcor pool ID for WAX/CHEESE
static constexpr uint64_t DEFAULT_POOL_ID = 1252;

CONTRACT cheeseburner : public contract {
public:
    using contract::contract;

    // ==================== TABLES ====================

    // Configuration singleton
    TABLE configrow {
        name admin;                 // Contract admin account
        uint64_t alcor_pool_id;     // Alcor pool ID for WAX/CHEESE pair (1252)
        bool enabled;               // Whether burns are enabled
        asset min_wax_to_burn;      // Minimum WAX required to proceed with burn
    };
    typedef singleton<"config"_n, configrow> config_table;

    // Pending burn caller - stores who initiated the current burn
    TABLE pendingburnr {
        name caller;               // Account that called burn()
        time_point_sec timestamp;  // When burn was initiated
        asset wax_claimed;         // Total WAX received from vote rewards
        asset wax_swapped;         // The 75% portion sent to Alcor

        uint64_t primary_key() const { return 0; }
    };
    typedef singleton<"pendingburn"_n, pendingburnr> pending_burn_table;

    // Statistics table
    TABLE stats_row {
        uint64_t total_burns;           // Total number of burn transactions
        asset total_wax_claimed;        // Total WAX claimed from voting rewards
        asset total_wax_staked;         // Total WAX staked as CPU
        asset total_cheese_burned;      // Total CHEESE burned
        asset total_cheese_rewards;     // Total CHEESE paid as caller rewards (legacy, always 0)
        asset total_cheese_liquidity;   // Total CHEESE sent to xcheeseliqst

        uint64_t primary_key() const { return 0; }
    };
    typedef multi_index<"stats"_n, stats_row> stats_table;

    // CheesePowerz tracking table (separate from stats to avoid migration issues)
    TABLE cpowerrow {
        asset total_wax_cheesepowerz;   // Total WAX sent to cheesepowerz
        uint64_t primary_key() const { return 0; }
    };
    typedef multi_index<"cpowerstats"_n, cpowerrow> cpowerstats_table;

    // Alcor AMM Swap pools table (external - read only)
    TABLE alcor_pool {
        uint64_t id;
        bool active;
        extended_asset tokenA;
        extended_asset tokenB;
        uint32_t fee;
        uint32_t feeProtocol;
        int32_t tickSpacing;
        uint128_t maxLiquidityPerTick;

        uint64_t primary_key() const { return id; }
    };
    typedef multi_index<"pools"_n, alcor_pool> alcor_pools;

    // eosio.token accounts table (external - read only)
    TABLE token_account {
        asset balance;
        uint64_t primary_key() const { return balance.symbol.code().raw(); }
    };
    typedef multi_index<"accounts"_n, token_account> token_accounts;

    // ==================== ACTIONS ====================

    ACTION setconfig(
        name admin,
        uint64_t alcor_pool_id,
        bool enabled,
        asset min_wax_to_burn
    );

    ACTION burn(name caller);

    [[eosio::on_notify("cheeseburger::transfer")]]
    void on_cheese_transfer(name from, name to, asset quantity, string memo);

    [[eosio::on_notify("eosio.token::transfer")]]
    void on_wax_transfer(name from, name to, asset quantity, string memo);

    ACTION logburn(
        name caller,
        asset wax_claimed,
        asset wax_swapped,
        asset cheese_burned
    );

private:
    double get_wax_cheese_rate(uint64_t pool_id);
    asset get_wax_balance(name account);
    asset get_cheese_balance(name account);
    void burn_cheese(asset quantity);
    void update_stats(asset wax_claimed, asset wax_staked, asset cheese_burned, asset cheese_reward, asset cheese_liquidity, bool count_burn);
    configrow get_config();
    void update_cpowerstats(asset wax_sent);
};
