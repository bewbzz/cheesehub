#pragma once

#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <eosio/system.hpp>

using namespace eosio;
using namespace std;

// Token Constants
static constexpr name CHEESE_CONTRACT = "cheeseburger"_n;
static constexpr symbol CHEESE_SYMBOL = symbol("CHEESE", 4);
static constexpr name ATOMICASSETS = "atomicassets"_n;

// Play cooldown: 5 minutes per caller+template
static constexpr uint32_t PLAY_COOLDOWN = 300;

CONTRACT cheeseamphub : public contract {
public:
    using contract::contract;

    /**
     * @brief Catches music NFTs sent to the contract for royalty tracking.
     * Reads collection_name and template_id from AtomicAssets assets table.
     */
    [[eosio::on_notify("atomicassets::transfer")]]
    void on_nft_transfer(name from, name to, vector<uint64_t> asset_ids, string memo);

    /**
     * @brief Log a single play (used by Anchor sessions with session keys).
     * @param caller - The user who played the track
     * @param template_id - The template ID of the music NFT
     */
    ACTION logplay(name caller, uint32_t template_id);

    /**
     * @brief Log multiple plays in a single transaction (used by Cloud Wallet batch).
     * @param caller - The user who played the tracks
     * @param template_ids - Vector of template IDs played
     */
    ACTION logplays(name caller, vector<uint32_t> template_ids);

    /**
     * @brief Collection creators claim earned CHEESE royalties.
     * @param collection_account - The collection creator's account
     */
    ACTION claimroyalty(name collection_account);

    /**
     * @brief Admin: set royalty configuration.
     * @param royalty_per_play - CHEESE amount paid per play
     * @param token_contract - Contract of the royalty token
     */
    ACTION setconfig(asset royalty_per_play, name token_contract);

    /**
     * @brief Admin: withdraw any token from the contract.
     */
    ACTION withdraw(name token_contract, name to, asset quantity);

    /**
     * @brief Admin: remove a deposit entry (e.g., if NFT is withdrawn).
     */
    ACTION removedepo(uint64_t asset_id);

    // ---- Tables ----

    // Deposited music NFTs
    TABLE deposits {
        uint64_t asset_id;
        name depositor;
        name collection_name;
        uint32_t template_id;

        uint64_t primary_key() const { return asset_id; }
        uint64_t by_template() const { return static_cast<uint64_t>(template_id); }
    };
    typedef multi_index<"deposits"_n, deposits,
        indexed_by<"bytemplate"_n, const_mem_fun<deposits, uint64_t, &deposits::by_template>>
    > deposits_table;

    // Play counts per collection
    TABLE playcounts {
        name collection_name;
        uint64_t total_plays;
        uint64_t unclaimed_plays;

        uint64_t primary_key() const { return collection_name.value; }
    };
    typedef multi_index<"playcounts"_n, playcounts> playcounts_table;

    // Singleton config
    TABLE config {
        uint64_t id = 1;
        asset royalty_per_play;
        name token_contract;

        uint64_t primary_key() const { return id; }
    };
    typedef multi_index<"config"_n, config> config_table;

    // Play logs for cooldown tracking
    TABLE playlogs {
        uint64_t id;
        name caller;
        uint32_t template_id;
        uint32_t timestamp;

        uint64_t primary_key() const { return id; }
        // Secondary index: caller + template_id combined for fast lookup
        uint128_t by_caller_template() const {
            return (static_cast<uint128_t>(caller.value) << 32) | static_cast<uint128_t>(template_id);
        }
    };
    typedef multi_index<"playlogs"_n, playlogs,
        indexed_by<"bycallertpl"_n, const_mem_fun<playlogs, uint128_t, &playlogs::by_caller_template>>
    > playlogs_table;

    // AtomicAssets assets table (external, read-only)
    struct aa_asset {
        uint64_t asset_id;
        name collection_name;
        name schema_name;
        int32_t template_id;
        // ... other fields we don't need

        uint64_t primary_key() const { return asset_id; }
    };
    typedef multi_index<"assets"_n, aa_asset> aa_assets_table;

private:
    /**
     * @brief Internal: log a single play with cooldown check.
     */
    void _log_play(name caller, uint32_t template_id);
};
