#include "cheesebannad.hpp"

// ============================================================================
// Admin Actions
// ============================================================================

void cheesebannad::initbannerad(uint64_t start_time, uint64_t amount_of_slots) {
    require_auth(get_self());
    check(amount_of_slots > 0 && amount_of_slots <= 365, "Slots must be 1-365");
    check(start_time > 0, "Invalid start time");

    bannerads_table ads(get_self(), get_self().value);

    for (uint64_t i = 0; i < amount_of_slots; i++) {
        uint64_t slot_time = start_time + (i * SECONDS_PER_DAY);

        // Create both positions (1 and 2) for each day
        for (uint8_t pos = 1; pos <= 2; pos++) {
            uint64_t pk = slot_time * 10 + pos;
            auto itr = ads.find(pk);
            if (itr != ads.end()) continue; // Skip if already exists

            ads.emplace(get_self(), [&](auto& row) {
                row.time              = slot_time;
                row.position          = pos;
                row.user              = get_self();  // available = owned by contract
                row.ipfs_hash         = "";
                row.website_url       = "";
                row.rental_type       = 0;           // default exclusive
                row.shared_user       = name();      // empty
                row.shared_ipfs_hash  = "";
                row.shared_website_url = "";
            });
        }
    }
}

void cheesebannad::editadbanner(name user, uint64_t start_time, uint8_t position, string ipfs_hash, string website_url) {
    require_auth(user);

    check(position == 1 || position == 2, "Position must be 1 or 2");
    check(ipfs_hash.length() <= MAX_IPFS_HASH_LEN, "IPFS hash too long");
    check(website_url.length() <= MAX_URL_LEN, "URL too long");

    bannerads_table ads(get_self(), get_self().value);
    uint64_t pk = start_time * 10 + position;
    auto itr = ads.find(pk);
    check(itr != ads.end(), "Slot not found");
    check(itr->user == user, "You do not own this slot");

    ads.modify(itr, user, [&](auto& row) {
        row.ipfs_hash   = ipfs_hash;
        row.website_url = website_url;
    });
}

void cheesebannad::editsharedbanner(name user, uint64_t start_time, uint8_t position, string ipfs_hash, string website_url) {
    require_auth(user);

    check(position == 1 || position == 2, "Position must be 1 or 2");
    check(ipfs_hash.length() <= MAX_IPFS_HASH_LEN, "IPFS hash too long");
    check(website_url.length() <= MAX_URL_LEN, "URL too long");

    bannerads_table ads(get_self(), get_self().value);
    uint64_t pk = start_time * 10 + position;
    auto itr = ads.find(pk);
    check(itr != ads.end(), "Slot not found");
    check(itr->shared_user == user, "You do not own this shared slot");

    ads.modify(itr, user, [&](auto& row) {
        row.shared_ipfs_hash   = ipfs_hash;
        row.shared_website_url = website_url;
    });
}

void cheesebannad::setconfig(asset wax_price_per_day) {
    require_auth(get_self());

    check(wax_price_per_day.symbol == WAX_SYMBOL, "Price must be in WAX");
    check(wax_price_per_day.amount > 0, "Price must be positive");

    config_table configs(get_self(), get_self().value);
    auto itr = configs.find(1);

    if (itr == configs.end()) {
        configs.emplace(get_self(), [&](auto& c) {
            c.id                = 1;
            c.wax_price_per_day = wax_price_per_day;
        });
    } else {
        configs.modify(itr, get_self(), [&](auto& c) {
            c.wax_price_per_day = wax_price_per_day;
        });
    }
}

void cheesebannad::withdraw(name token_contract, name to, asset quantity) {
    require_auth(get_self());

    check(quantity.amount > 0, "Amount must be positive");
    check(is_account(to), "Invalid recipient");
    check(is_account(token_contract), "Invalid token contract");

    action(
        permission_level{get_self(), "active"_n},
        token_contract,
        "transfer"_n,
        make_tuple(get_self(), to, quantity, string("Admin withdrawal"))
    ).send();
}

// ============================================================================
// Transfer Notifications
// ============================================================================

void cheesebannad::on_wax_transfer(name from, name to, asset quantity, string memo) {
    if (from == get_self() || to != get_self()) return;
    if (quantity.symbol != WAX_SYMBOL) return;

    // Only process banner memos
    if (memo.substr(0, 7) != "banner|") return;

    check(quantity.amount > 0, "Amount must be positive");

    auto [start_time, num_days, position, mode] = parse_banner_memo(memo);
    asset price_per_day = get_config();

    // Shared slots cost 20% less
    double multiplier = (mode == 's' || mode == 'j') ? (1.0 - SHARED_DISCOUNT) : 1.0;
    int64_t required = static_cast<int64_t>(static_cast<double>(price_per_day.amount) * multiplier) * static_cast<int64_t>(num_days);
    check(quantity.amount >= required,
        "Insufficient WAX. Need " + to_string(required / 100000000) + " WAX for " + to_string(num_days) + " day(s)");

    assign_slots(from, start_time, num_days, position, mode);

    // Distribute WAX: 20% financing, 80% swapped to CHEESE (all atomic)
    distribute_wax_funds(quantity);
}

// ============================================================================
// CHEESE Transfer Notification (receives CHEESE back from Alcor swap)
// ============================================================================

void cheesebannad::on_cheese_transfer(name from, name to, asset quantity, string memo) {
    if (from == get_self() || to != get_self()) return;
    if (quantity.symbol != CHEESE_SYMBOL) return;

    // Only process CHEESE arriving from Alcor (swap result)
    if (from == ALCOR_CONTRACT) {
        distribute_cheese_funds(quantity);
    }
    // Ignore all other CHEESE transfers
}
// Private Helpers
// ============================================================================

tuple<uint64_t, uint64_t, uint8_t, char> cheesebannad::parse_banner_memo(const string& memo) {
    // Format: "banner|start_time|num_days|position|mode" or "banner|start_time|num_days|position"
    // mode: 'e' = exclusive (default), 's' = shared-primary, 'j' = join-shared
    size_t first = memo.find('|');
    check(first != string::npos, "Invalid memo. Use: banner|start_time|num_days|position[|mode]");

    size_t second = memo.find('|', first + 1);
    check(second != string::npos, "Invalid memo. Use: banner|start_time|num_days|position[|mode]");

    size_t third = memo.find('|', second + 1);
    check(third != string::npos, "Invalid memo. Use: banner|start_time|num_days|position[|mode]");

    string start_str    = memo.substr(first + 1, second - first - 1);
    string days_str     = memo.substr(second + 1, third - second - 1);
    string position_str = memo.substr(third + 1);

    uint64_t start_time = stoull(start_str);
    uint64_t num_days   = stoull(days_str);
    
    // Check if there's a 5th component (mode)
    size_t fourth = position_str.find('|');
    char mode = 'e'; // default
    if (fourth != string::npos) {
        string mode_str = position_str.substr(fourth + 1);
        mode = mode_str.length() > 0 ? mode_str[0] : 'e';
        position_str = position_str.substr(0, fourth);
    }

    uint8_t  position   = static_cast<uint8_t>(stoul(position_str));

    check(start_time > 0, "Invalid start time");
    check(num_days > 0 && num_days <= 365, "Days must be 1-365");
    check(position == 1 || position == 2, "Position must be 1 or 2");
    check(mode == 'e' || mode == 's' || mode == 'j', "Mode must be 'e', 's', or 'j'");

    return make_tuple(start_time, num_days, position, mode);
}

asset cheesebannad::get_config() {
    config_table configs(get_self(), get_self().value);
    auto itr = configs.find(1);

    if (itr != configs.end()) {
        return itr->wax_price_per_day;
    }

    // Default
    return asset(DEFAULT_WAX_PRICE, WAX_SYMBOL);
}

void cheesebannad::assign_slots(name user, uint64_t start_time, uint64_t num_days, uint8_t position, char mode) {
    bannerads_table ads(get_self(), get_self().value);
    uint32_t now = current_time_point().sec_since_epoch();

    for (uint64_t i = 0; i < num_days; i++) {
        uint64_t slot_time = start_time + (i * SECONDS_PER_DAY);

        // Cannot rent past slots
        check(slot_time + SECONDS_PER_DAY > now, "Cannot rent expired slot at " + to_string(slot_time));

        uint64_t pk = slot_time * 10 + position;
        auto itr = ads.find(pk);
        check(itr != ads.end(), "Slot at " + to_string(slot_time) + " position " + to_string(position) + " does not exist. Admin must init first.");

        if (mode == 'e') {
            // Exclusive mode: slot must be unrented
            check(itr->user == get_self(), "Slot at " + to_string(slot_time) + " position " + to_string(position) + " is already rented");
            
            ads.modify(itr, get_self(), [&](auto& row) {
                row.user = user;
                row.rental_type = 0;  // exclusive
            });
        } else if (mode == 's') {
            // Shared-primary mode: slot must be unrented, sets as shared
            check(itr->user == get_self(), "Slot at " + to_string(slot_time) + " position " + to_string(position) + " is already rented");
            
            ads.modify(itr, get_self(), [&](auto& row) {
                row.user = user;
                row.rental_type = 1;  // shared
                row.shared_user = name();  // empty for now
            });
        } else if (mode == 'j') {
            // Join-shared mode: slot must exist and be shared with no secondary renter
            check(itr->rental_type == 1, "Slot must be a shared slot to join");
            check(itr->shared_user == name(), "Shared slot is already full");
            
            ads.modify(itr, get_self(), [&](auto& row) {
                row.shared_user = user;  // this user is the secondary renter
            });
        }
    }
}

// ============================================================================
// Fund Distribution
// ============================================================================

void cheesebannad::distribute_wax_funds(asset quantity) {
    int64_t burner_amount = static_cast<int64_t>(quantity.amount * WAX_BURNER_PERCENT);
    int64_t swap_amount = quantity.amount - burner_amount;

    // 20% WAX to cheeseburner (ecosystem financing)
    if (burner_amount > 0) {
        action(
            permission_level{get_self(), "active"_n},
            WAX_CONTRACT,
            "transfer"_n,
            make_tuple(get_self(), CHEESEBURNER, asset(burner_amount, WAX_SYMBOL),
                string("CHEESEAds ecosystem financing"))
        ).send();
    }

    // 80% WAX to Alcor swap -> CHEESE comes back to this contract
    if (swap_amount > 0) {
        string swap_memo = "swapexactin#" + to_string(CHEESE_WAX_POOL_ID) +
            "#" + get_self().to_string() + "#0.0001 CHEESE@" + CHEESE_CONTRACT.to_string() + "#0";

        action(
            permission_level{get_self(), "active"_n},
            WAX_CONTRACT,
            "transfer"_n,
            make_tuple(get_self(), ALCOR_CONTRACT, asset(swap_amount, WAX_SYMBOL), swap_memo)
        ).send();
    }
}

void cheesebannad::distribute_cheese_funds(asset quantity) {
    int64_t burn_amount = static_cast<int64_t>(quantity.amount * CHEESE_BURN_PERCENT);
    int64_t stake_amount = quantity.amount - burn_amount;

    // 66% CHEESE burned
    if (burn_amount > 0) {
        action(
            permission_level{get_self(), "active"_n},
            CHEESE_CONTRACT,
            "transfer"_n,
            make_tuple(get_self(), NULL_ACCOUNT, asset(burn_amount, CHEESE_SYMBOL),
                string("CHEESEAds CHEESE burn"))
        ).send();
    }

    // 34% CHEESE to liquidity staking
    if (stake_amount > 0) {
        action(
            permission_level{get_self(), "active"_n},
            CHEESE_CONTRACT,
            "transfer"_n,
            make_tuple(get_self(), LIQUIDITY_STAKING, asset(stake_amount, CHEESE_SYMBOL),
                string("CHEESEAds liquidity staking"))
        ).send();
    }
}
