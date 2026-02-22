#include "cheeseburner.hpp"
#include <cmath>

// ==================== ACTIONS ====================

ACTION cheeseburner::setconfig(
    name admin,
    uint64_t alcor_pool_id,
    bool enabled,
    asset min_wax_to_burn,
    uint32_t priority_window
) {
    config_table config_singleton(get_self(), get_self().value);
    
    if (config_singleton.exists()) {
        if (has_auth(get_self())) {
            // Contract owner can always update config
        } else {
            configrow current = config_singleton.get();
            require_auth(current.admin);
        }
    } else {
        require_auth(get_self());
    }

    check(is_account(admin), "Admin account does not exist");
    check(alcor_pool_id > 0, "Invalid Alcor pool ID");
    check(min_wax_to_burn.symbol == WAX_SYMBOL, "min_wax_to_burn must be in WAX");
    check(min_wax_to_burn.amount >= 0, "min_wax_to_burn cannot be negative");

    configrow new_config = {
        .admin = admin,
        .alcor_pool_id = alcor_pool_id,
        .enabled = enabled,
        .min_wax_to_burn = min_wax_to_burn,
        .priority_window = priority_window
    };
    config_singleton.set(new_config, get_self());
}

ACTION cheeseburner::burn(name caller) {
    require_auth(caller);
    
    configrow config = get_config();
    check(config.enabled, "Burns are currently disabled");

    pending_burn_table pending(get_self(), get_self().value);
    pending.set({
        .caller = caller,
        .timestamp = current_time_point(),
        .wax_claimed = asset(0, WAX_SYMBOL),
        .wax_swapped = asset(0, WAX_SYMBOL)
    }, get_self());

    action(
        permission_level{get_self(), "active"_n},
        EOSIO_CONTRACT,
        "claimgbmvote"_n,
        make_tuple(get_self())
    ).send();
}

// ==================== WHITELIST ACTIONS ====================

ACTION cheeseburner::addwhitelist(name account) {
    configrow config = get_config();
    require_auth(config.admin);

    check(is_account(account), "Account does not exist");

    whitelist_table whitelist(get_self(), get_self().value);
    auto itr = whitelist.find(account.value);
    check(itr == whitelist.end(), "Account is already whitelisted");

    whitelist.emplace(get_self(), [&](auto& row) {
        row.account = account;
    });
}

ACTION cheeseburner::rmwhitelist(name account) {
    configrow config = get_config();
    require_auth(config.admin);

    whitelist_table whitelist(get_self(), get_self().value);
    auto itr = whitelist.find(account.value);
    check(itr != whitelist.end(), "Account is not whitelisted");

    whitelist.erase(itr);
}

// ==================== WAX TRANSFER HANDLER ====================

void cheeseburner::on_wax_transfer(name from, name to, asset quantity, string memo) {
    if (to != get_self() || from == get_self()) {
        return;
    }

    if (from != "eosio.voters"_n && from != "eosio.vpay"_n && from != "eosio.bpay"_n) {
        return;
    }

    check(quantity.symbol == WAX_SYMBOL, "Only WAX tokens expected");
    check(quantity.amount > 0, "Amount must be positive");

    pending_burn_table pending(get_self(), get_self().value);
    check(pending.exists(), "No pending burn found - call burn() first");

    configrow config = get_config();

    int64_t stake_amount = quantity.amount * 15 / 100;
    int64_t powerz_amount = quantity.amount * 5 / 100;
    int64_t swap_amount = quantity.amount - stake_amount - powerz_amount;
    
    asset to_stake = asset(stake_amount, WAX_SYMBOL);
    asset to_powerz = asset(powerz_amount, WAX_SYMBOL);
    asset to_swap = asset(swap_amount, WAX_SYMBOL);

    if (to_stake.amount > 0) {
        action(
            permission_level{get_self(), "active"_n},
            EOSIO_CONTRACT,
            "delegatebw"_n,
            make_tuple(
                get_self(),
                get_self(),
                asset(0, WAX_SYMBOL),
                to_stake,
                false
            )
        ).send();
    }

    if (to_powerz.amount > 0) {
        action(
            permission_level{get_self(), "active"_n},
            EOSIO_TOKEN,
            "transfer"_n,
            make_tuple(
                get_self(),
                CHEESE_POWER_ACCOUNT,
                to_powerz,
                string("WAX allocation to cheesepowerz")
            )
        ).send();
    }

    string swap_memo = "swapexactin#" + to_string(config.alcor_pool_id)
        + "#" + get_self().to_string()
        + "#0.0000 CHEESE@cheeseburger"
        + "#0";

    action(
        permission_level{get_self(), "active"_n},
        EOSIO_TOKEN,
        "transfer"_n,
        make_tuple(
            get_self(),
            ALCOR_SWAP_CONTRACT,
            to_swap,
            swap_memo
        )
    ).send();

    pendingburnr updated_pending = pending.get();
    updated_pending.wax_claimed = quantity;
    updated_pending.wax_swapped = to_swap;
    pending.set(updated_pending, get_self());

    update_stats(quantity, to_stake, asset(0, CHEESE_SYMBOL), asset(0, CHEESE_SYMBOL), asset(0, CHEESE_SYMBOL), to_powerz, false);
}

// ==================== MIGRATE ACTION ====================
// Uses raw DB intrinsics to bypass multi_index deserialization.
// multi_index::find() and erase() both attempt to deserialize the row,
// which crashes when the on-chain data has a different schema (missing fields).
// db_find_i64 / db_remove_i64 operate on raw iterators — no deserialization.

ACTION cheeseburner::migrate(name caller) {
    require_auth(get_self());

    // Use raw DB intrinsics to delete without deserializing
    auto raw_itr = eosio::internal_use_do_not_use::db_find_i64(
        get_self().value,   // code
        get_self().value,   // scope
        "stats"_n.value,    // table
        0                   // primary key
    );
    if (raw_itr >= 0) {
        eosio::internal_use_do_not_use::db_remove_i64(raw_itr);
    }

    // Now emplace a fresh row with the correct schema (all fields present)
    stats_table stats_tbl(get_self(), get_self().value);
    stats_tbl.emplace(get_self(), [&](auto& row) {
        row.total_burns            = 0;
        row.total_wax_claimed      = asset(0, WAX_SYMBOL);
        row.total_wax_staked       = asset(0, WAX_SYMBOL);
        row.total_cheese_burned    = asset(0, CHEESE_SYMBOL);
        row.total_cheese_rewards   = asset(0, CHEESE_SYMBOL);
        row.total_cheese_liquidity = asset(0, CHEESE_SYMBOL);
        row.total_wax_cheesepowerz = asset(0, WAX_SYMBOL);
    });
}

ACTION cheeseburner::logburn(
    name caller,
    asset wax_claimed,
    asset wax_swapped,
    asset cheese_burned
) {
    require_auth(get_self());
    require_recipient(caller);
}

// ==================== CHEESE TRANSFER HANDLER ====================

void cheeseburner::on_cheese_transfer(name from, name to, asset quantity, string memo) {
    if (to != get_self() || from == get_self()) {
        return;
    }

    if (from != ALCOR_SWAP_CONTRACT) {
        check(false, "This contract only accepts CHEESE from Alcor swaps");
    }

    check(quantity.symbol == CHEESE_SYMBOL, "Only CHEESE tokens accepted");
    check(quantity.amount > 0, "Amount must be positive");

    pending_burn_table pending(get_self(), get_self().value);
    check(pending.exists(), "No pending burn found");
    pendingburnr burn_info = pending.get();

    int64_t reward_amount = quantity.amount * 10 / 80;
    int64_t liquidity_amount = quantity.amount * 10 / 80;
    int64_t burn_amount = quantity.amount - liquidity_amount - reward_amount;
    
    asset reward = asset(reward_amount, CHEESE_SYMBOL);
    asset liquidity = asset(liquidity_amount, CHEESE_SYMBOL);
    asset to_burn = asset(burn_amount, CHEESE_SYMBOL);

    if (reward.amount > 0) {
        action(
            permission_level{get_self(), "active"_n},
            CHEESE_CONTRACT,
            "transfer"_n,
            make_tuple(
                get_self(),
                burn_info.caller,
                reward,
                string("CHEESE burn caller reward")
            )
        ).send();
    }

    if (liquidity.amount > 0) {
        action(
            permission_level{get_self(), "active"_n},
            CHEESE_CONTRACT,
            "transfer"_n,
            make_tuple(
                get_self(),
                CHEESE_LIQ_ACCOUNT,
                liquidity,
                string("CHEESE liquidity allocation")
            )
        ).send();
    }

    burn_cheese(to_burn);
    update_stats(asset(0, WAX_SYMBOL), asset(0, WAX_SYMBOL), to_burn, reward, liquidity, asset(0, WAX_SYMBOL), true);

    action(
        permission_level{get_self(), "active"_n},
        get_self(),
        "logburn"_n,
        make_tuple(burn_info.caller, burn_info.wax_claimed, burn_info.wax_swapped, to_burn)
    ).send();

    pending.remove();
}

// ==================== HELPERS ====================

double cheeseburner::get_wax_cheese_rate(uint64_t pool_id) {
    alcor_pools pools(ALCOR_SWAP_CONTRACT, ALCOR_SWAP_CONTRACT.value);
    auto pool_itr = pools.find(pool_id);
    
    check(pool_itr != pools.end(), "Alcor swap pool not found");
    
    double wax_reserve, cheese_reserve;
    uint8_t wax_precision, cheese_precision;
    
    if (pool_itr->tokenA.quantity.symbol.code() == WAX_SYMBOL.code()) {
        wax_reserve = static_cast<double>(pool_itr->tokenA.quantity.amount);
        wax_precision = pool_itr->tokenA.quantity.symbol.precision();
        cheese_reserve = static_cast<double>(pool_itr->tokenB.quantity.amount);
        cheese_precision = pool_itr->tokenB.quantity.symbol.precision();
    } else {
        wax_reserve = static_cast<double>(pool_itr->tokenB.quantity.amount);
        wax_precision = pool_itr->tokenB.quantity.symbol.precision();
        cheese_reserve = static_cast<double>(pool_itr->tokenA.quantity.amount);
        cheese_precision = pool_itr->tokenA.quantity.symbol.precision();
    }
    
    double wax_divisor = pow(10.0, wax_precision);
    double cheese_divisor = pow(10.0, cheese_precision);
    
    wax_reserve /= wax_divisor;
    cheese_reserve /= cheese_divisor;
    
    return cheese_reserve / wax_reserve;
}

asset cheeseburner::get_wax_balance(name account) {
    token_accounts accounts(EOSIO_TOKEN, account.value);
    auto itr = accounts.find(WAX_SYMBOL.code().raw());
    if (itr == accounts.end()) return asset(0, WAX_SYMBOL);
    return itr->balance;
}

asset cheeseburner::get_cheese_balance(name account) {
    token_accounts accounts(CHEESE_CONTRACT, account.value);
    auto itr = accounts.find(CHEESE_SYMBOL.code().raw());
    if (itr == accounts.end()) return asset(0, CHEESE_SYMBOL);
    return itr->balance;
}

void cheeseburner::burn_cheese(asset quantity) {
    action(
        permission_level{get_self(), "active"_n},
        CHEESE_CONTRACT,
        "transfer"_n,
        make_tuple(
            get_self(),
            BURN_ACCOUNT,
            quantity,
            string("CHEESE burned via cheeseburner")
        )
    ).send();
}

void cheeseburner::update_stats(asset wax_claimed, asset wax_staked, asset cheese_burned, asset cheese_reward, asset cheese_liquidity, asset wax_cheesepowerz, bool count_burn) {
    stats_table stats(get_self(), get_self().value);
    
    auto itr = stats.find(0);
    if (itr == stats.end()) {
        stats.emplace(get_self(), [&](auto& row) {
            row.total_burns = count_burn ? 1 : 0;
            row.total_wax_claimed = wax_claimed;
            row.total_wax_staked = wax_staked;
            row.total_cheese_burned = cheese_burned;
            row.total_cheese_rewards = cheese_reward;
            row.total_cheese_liquidity = cheese_liquidity;
            row.total_wax_cheesepowerz = wax_cheesepowerz;
        });
    } else {
        stats.modify(itr, same_payer, [&](auto& row) {
            if (count_burn) row.total_burns += 1;
            row.total_wax_claimed += wax_claimed;
            row.total_wax_staked += wax_staked;
            row.total_cheese_burned += cheese_burned;
            row.total_cheese_rewards += cheese_reward;
            row.total_cheese_liquidity += cheese_liquidity;
            row.total_wax_cheesepowerz += wax_cheesepowerz;
        });
    }
}

cheeseburner::configrow cheeseburner::get_config() {
    config_table config_singleton(get_self(), get_self().value);
    check(config_singleton.exists(), "Contract not configured. Run setconfig first.");
    return config_singleton.get();
}

bool cheeseburner::is_whitelisted(name account) {
    whitelist_table whitelist(get_self(), get_self().value);
    return whitelist.find(account.value) != whitelist.end();
}
