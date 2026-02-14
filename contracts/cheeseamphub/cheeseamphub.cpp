#include "cheeseamphub.hpp"

/**
 * @brief Catches NFTs sent to the contract. Reads collection_name and template_id
 * from AtomicAssets assets table and inserts into deposits.
 */
void cheeseamphub::on_nft_transfer(name from, name to, vector<uint64_t> asset_ids, string memo) {
    if (from == get_self()) return;
    if (to != get_self()) return;

    deposits_table deps(get_self(), get_self().value);

    for (auto asset_id : asset_ids) {
        // Read asset info from AtomicAssets
        aa_assets_table assets(ATOMICASSETS, from.value);
        auto asset_itr = assets.find(asset_id);
        check(asset_itr != assets.end(), "Asset not found in AtomicAssets");
        check(asset_itr->template_id > 0, "Asset must have a template");

        deps.emplace(get_self(), [&](auto& d) {
            d.asset_id = asset_id;
            d.depositor = from;
            d.collection_name = asset_itr->collection_name;
            d.template_id = static_cast<uint32_t>(asset_itr->template_id);
        });
    }
}

/**
 * @brief Log a single play. Used by Anchor sessions with session keys.
 */
void cheeseamphub::logplay(name caller, uint32_t template_id) {
    require_auth(caller);
    _log_play(caller, template_id);
}

/**
 * @brief Log multiple plays in a single transaction. Used by Cloud Wallet batch.
 */
void cheeseamphub::logplays(name caller, vector<uint32_t> template_ids) {
    require_auth(caller);
    check(template_ids.size() > 0, "Must provide at least one template_id");
    check(template_ids.size() <= 50, "Maximum 50 plays per batch");

    for (auto tid : template_ids) {
        _log_play(caller, tid);
    }
}

/**
 * @brief Internal play logging with cooldown check.
 */
void cheeseamphub::_log_play(name caller, uint32_t template_id) {
    // Verify template_id exists in deposits
    deposits_table deps(get_self(), get_self().value);
    auto tpl_idx = deps.get_index<"bytemplate"_n>();
    auto dep_itr = tpl_idx.find(static_cast<uint64_t>(template_id));
    check(dep_itr != tpl_idx.end(), "Template not registered in deposits");

    name collection = dep_itr->collection_name;
    uint32_t now = current_time_point().sec_since_epoch();

    // Cooldown check: find most recent play by this caller for this template
    playlogs_table logs(get_self(), get_self().value);
    auto ct_idx = logs.get_index<"bycallertpl"_n>();
    uint128_t composite_key = (static_cast<uint128_t>(caller.value) << 32) | static_cast<uint128_t>(template_id);
    auto ct_itr = ct_idx.lower_bound(composite_key);

    // Walk through all matching entries to find most recent
    uint32_t latest_timestamp = 0;
    while (ct_itr != ct_idx.end() && ct_itr->by_caller_template() == composite_key) {
        if (ct_itr->timestamp > latest_timestamp) {
            latest_timestamp = ct_itr->timestamp;
        }
        ++ct_itr;
    }

    if (latest_timestamp > 0) {
        check(now - latest_timestamp >= PLAY_COOLDOWN,
            "Play cooldown: wait " + to_string(PLAY_COOLDOWN - (now - latest_timestamp)) + " more seconds");
    }

    // Insert play log
    logs.emplace(caller, [&](auto& l) {
        l.id = logs.available_primary_key();
        l.caller = caller;
        l.template_id = template_id;
        l.timestamp = now;
    });

    // Increment play counts
    playcounts_table counts(get_self(), get_self().value);
    auto count_itr = counts.find(collection.value);

    if (count_itr == counts.end()) {
        counts.emplace(get_self(), [&](auto& c) {
            c.collection_name = collection;
            c.total_plays = 1;
            c.unclaimed_plays = 1;
        });
    } else {
        counts.modify(count_itr, same_payer, [&](auto& c) {
            c.total_plays += 1;
            c.unclaimed_plays += 1;
        });
    }
}

/**
 * @brief Collection creators claim earned CHEESE royalties.
 * Payout = unclaimed_plays * config.royalty_per_play
 */
void cheeseamphub::claimroyalty(name collection_account) {
    require_auth(collection_account);

    // Read config
    config_table cfg(get_self(), get_self().value);
    auto cfg_itr = cfg.find(1);
    check(cfg_itr != cfg.end(), "Config not set. Admin must call setconfig first.");

    // Read play counts for this collection
    playcounts_table counts(get_self(), get_self().value);
    auto count_itr = counts.find(collection_account.value);
    check(count_itr != counts.end(), "No play data for this collection");
    check(count_itr->unclaimed_plays > 0, "No unclaimed plays");

    // Calculate payout
    int64_t payout_amount = static_cast<int64_t>(count_itr->unclaimed_plays) * cfg_itr->royalty_per_play.amount;
    asset payout = asset(payout_amount, cfg_itr->royalty_per_play.symbol);

    check(payout.amount > 0, "Payout amount is zero");

    // Send royalty payment
    action(
        permission_level{get_self(), "active"_n},
        cfg_itr->token_contract,
        "transfer"_n,
        make_tuple(get_self(), collection_account, payout,
            string("CHEESEAmp royalty: ") + to_string(count_itr->unclaimed_plays) + " plays")
    ).send();

    // Reset unclaimed plays
    counts.modify(count_itr, same_payer, [&](auto& c) {
        c.unclaimed_plays = 0;
    });
}

/**
 * @brief Admin: set royalty configuration.
 */
void cheeseamphub::setconfig(asset royalty_per_play, name token_contract) {
    require_auth(get_self());
    check(royalty_per_play.amount > 0, "Royalty per play must be positive");
    check(is_account(token_contract), "Invalid token contract");

    config_table cfg(get_self(), get_self().value);
    auto cfg_itr = cfg.find(1);

    if (cfg_itr == cfg.end()) {
        cfg.emplace(get_self(), [&](auto& c) {
            c.id = 1;
            c.royalty_per_play = royalty_per_play;
            c.token_contract = token_contract;
        });
    } else {
        cfg.modify(cfg_itr, get_self(), [&](auto& c) {
            c.royalty_per_play = royalty_per_play;
            c.token_contract = token_contract;
        });
    }
}

/**
 * @brief Admin: withdraw any token from the contract.
 */
void cheeseamphub::withdraw(name token_contract, name to, asset quantity) {
    require_auth(get_self());
    check(quantity.amount > 0, "Amount must be positive");
    check(is_account(to), "Invalid recipient account");
    check(is_account(token_contract), "Invalid token contract");

    action(
        permission_level{get_self(), "active"_n},
        token_contract,
        "transfer"_n,
        make_tuple(get_self(), to, quantity, string("Admin withdrawal"))
    ).send();
}

/**
 * @brief Admin: remove a deposit entry.
 */
void cheeseamphub::removedepo(uint64_t asset_id) {
    require_auth(get_self());

    deposits_table deps(get_self(), get_self().value);
    auto dep_itr = deps.find(asset_id);
    check(dep_itr != deps.end(), "Deposit not found");
    deps.erase(dep_itr);
}
