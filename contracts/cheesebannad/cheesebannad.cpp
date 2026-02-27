#include "cheesebannad.hpp"
#include <limits>

// ============================================================================
// Admin Auth Helper
// ============================================================================

void cheesebannad::require_admin(name account) {
    if (account == get_self()) {
        require_auth(get_self());
        return;
    }
    admins_table admins(get_self(), get_self().value);
    auto itr = admins.find(account.value);
    check(itr != admins.end(), "Not authorized: " + account.to_string() + " is not an admin");
    require_auth(account);
}

// ============================================================================
// Admin Management Actions
// ============================================================================

void cheesebannad::addadmin(name account) {
    require_auth(get_self());
    check(is_account(account), "Account does not exist: " + account.to_string());
    check(account != get_self(), "Contract account is already the owner/admin");

    admins_table admins(get_self(), get_self().value);
    auto itr = admins.find(account.value);
    check(itr == admins.end(), "Account is already an admin");

    admins.emplace(get_self(), [&](auto& row) {
        row.account = account;
    });
}

void cheesebannad::removeadmin(name account) {
    require_auth(get_self());

    admins_table admins(get_self(), get_self().value);
    auto itr = admins.find(account.value);
    check(itr != admins.end(), "Account is not an admin");

    admins.erase(itr);
}

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
                row.time               = slot_time;
                row.position           = pos;
                row.user               = get_self();  // available = owned by contract
                row.ipfs_hash          = "";
                row.website_url        = "";
                row.rental_type        = 0;           // default exclusive
                row.shared_user        = name();      // empty
                row.shared_ipfs_hash   = "";
                row.shared_website_url = "";
                row.suspended          = false;
            });
        }
    }
}

void cheesebannad::editadbanner(name user, uint64_t start_time, uint8_t position, string ipfs_hash, string website_url) {
    require_auth(user);

    check(position == 1 || position == 2, "Position must be 1 or 2");
    check(ipfs_hash.length() <= MAX_IPFS_HASH_LEN, "IPFS hash too long");
    check(website_url.length() <= MAX_URL_LEN, "URL too long");

    // Guard: cannot edit an expired slot
    uint32_t now = current_time_point().sec_since_epoch();
    check(start_time + SECONDS_PER_DAY > now, "Slot has already expired");

    bannerads_table ads(get_self(), get_self().value);
    uint64_t pk = start_time * 10 + position;
    auto itr = ads.find(pk);
    check(itr != ads.end(), "Slot not found");
    check(itr->user == user, "You do not own this slot");

    // Guard: cannot edit a suspended slot
    check(!itr->suspended, "This slot has been suspended by an admin. Contact support.");

    ads.modify(itr, user, [&](auto& row) {
        row.ipfs_hash   = ipfs_hash;
        row.website_url = website_url;
    });
}

void cheesebannad::editsharedad(name user, uint64_t start_time, uint8_t position, string ipfs_hash, string website_url) {
    require_auth(user);

    check(position == 1 || position == 2, "Position must be 1 or 2");
    check(ipfs_hash.length() <= MAX_IPFS_HASH_LEN, "IPFS hash too long");
    check(website_url.length() <= MAX_URL_LEN, "URL too long");

    // Guard: cannot edit an expired slot
    uint32_t now = current_time_point().sec_since_epoch();
    check(start_time + SECONDS_PER_DAY > now, "Slot has already expired");

    bannerads_table ads(get_self(), get_self().value);
    uint64_t pk = start_time * 10 + position;
    auto itr = ads.find(pk);
    check(itr != ads.end(), "Slot not found");
    check(itr->shared_user == user, "You do not own this shared slot");

    // Guard: cannot edit a suspended slot
    check(!itr->suspended, "This slot has been suspended by an admin. Contact support.");

    ads.modify(itr, user, [&](auto& row) {
        row.shared_ipfs_hash   = ipfs_hash;
        row.shared_website_url = website_url;
    });
} // editsharedad()

void cheesebannad::removeadbnr(name caller, uint64_t start_time, uint8_t position, bool clear_shared) {
    require_admin(caller);

    check(position == 1 || position == 2, "Position must be 1 or 2");

    bannerads_table ads(get_self(), get_self().value);
    uint64_t pk = start_time * 10 + position;
    auto itr = ads.find(pk);
    check(itr != ads.end(), "Slot not found");
    check(itr->user != get_self(), "Cannot remove an unrented slot");

    ads.modify(itr, get_self(), [&](auto& row) {
        row.ipfs_hash   = "";
        row.website_url = "";
        row.suspended   = true;
        if (clear_shared) {
            row.shared_ipfs_hash   = "";
            row.shared_website_url = "";
        }
    });
} // removeadbnr()

void cheesebannad::reinstatebnr(name caller, uint64_t start_time, uint8_t position) {
    require_admin(caller);

    check(position == 1 || position == 2, "Position must be 1 or 2");

    bannerads_table ads(get_self(), get_self().value);
    uint64_t pk = start_time * 10 + position;
    auto itr = ads.find(pk);
    check(itr != ads.end(), "Slot not found");
    check(itr->user != get_self(), "Slot is not rented");
    check(itr->suspended, "Slot is not currently suspended");

    ads.modify(itr, get_self(), [&](auto& row) {
        row.suspended = false;
    });
} // reinstatebnr()

void cheesebannad::setconfig(asset wax_price_per_day, double wax_per_cheese_baseline) {
    require_auth(get_self());

    check(wax_price_per_day.symbol == WAX_SYMBOL, "Price must be in WAX");
    check(wax_price_per_day.amount > 0, "Price must be positive");
    check(wax_per_cheese_baseline > 0, "Baseline must be positive");

    config_table configs(get_self(), get_self().value);
    auto itr = configs.find(1);

    if (itr == configs.end()) {
        configs.emplace(get_self(), [&](auto& c) {
            c.id                     = 1;
            c.wax_price_per_day      = wax_price_per_day;
            c.wax_per_cheese_baseline = wax_per_cheese_baseline;
        });
    } else {
        configs.modify(itr, get_self(), [&](auto& c) {
            c.wax_price_per_day       = wax_price_per_day;
            c.wax_per_cheese_baseline = wax_per_cheese_baseline;
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

void cheesebannad::cleanup(uint64_t before_time) {
    require_auth(get_self());
    check(before_time > 0, "Invalid before_time");

    bannerads_table ads(get_self(), get_self().value);
    auto itr = ads.begin();
    uint32_t count = 0;

    while (itr != ads.end() && itr->time < before_time && count < MAX_CLEANUP_SLOTS) {
        itr = ads.erase(itr);
        count++;
    }

    check(count > 0, "No expired slots found before the given time");
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

    // Shared slots cost 30% less
    double multiplier = (mode == 's' || mode == 'j') ? (1.0 - SHARED_DISCOUNT) : 1.0;

    // Permanent 50% discount for cheesepromoz (stacks multiplicatively with shared discount)
    if (from == PROMOZ_ACCOUNT) {
        multiplier *= (1.0 - PROMOZ_DISCOUNT);
    }

    int64_t required = static_cast<int64_t>(
        static_cast<double>(price_per_day.amount) * multiplier
    ) * static_cast<int64_t>(num_days);
    check(quantity.amount >= required,
        "Insufficient WAX. Need " + to_string(required / 100000000) + " WAX for " + to_string(num_days) + " day(s)");

    // Refund any overpayment before distributing
    int64_t overpay = quantity.amount - required;
    if (overpay > 0) {
        action(
            permission_level{get_self(), "active"_n},
            WAX_CONTRACT,
            "transfer"_n,
            make_tuple(get_self(), from, asset(overpay, WAX_SYMBOL), string("Banner ad overpayment refund"))
        ).send();
    }

    assign_slots(from, start_time, num_days, position, mode);

    // Distribute exactly the required WAX (not the full quantity)
    distribute_wax_funds(asset(required, WAX_SYMBOL));
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

// ============================================================================
// Private Helpers
// ============================================================================

tuple<uint64_t, uint64_t, uint8_t, char> cheesebannad::parse_banner_memo(const string& memo) {
    // Format: "banner|start_time|num_days|position[|mode]"
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

    // Check if there's a 5th component (mode)
    size_t fourth = position_str.find('|');
    char mode = 'e'; // default
    if (fourth != string::npos) {
        string mode_str = position_str.substr(fourth + 1);
        mode = mode_str.length() > 0 ? mode_str[0] : 'e';
        position_str = position_str.substr(0, fourth);
    }

    auto parse_u64 = [](const string& value, const char* field_name) -> uint64_t {
        check(!value.empty(), string("Invalid memo: empty ") + field_name);

        uint64_t parsed = 0;
        for (char ch : value) {
            check(ch >= '0' && ch <= '9', string("Invalid memo: non-numeric ") + field_name);
            uint64_t digit = static_cast<uint64_t>(ch - '0');
            check(
                parsed <= (std::numeric_limits<uint64_t>::max() - digit) / 10,
                string("Invalid memo: ") + field_name + " is too large"
            );
            parsed = parsed * 10 + digit;
        } // for (char ch : value)

        return parsed;
    };

    uint64_t start_time = parse_u64(start_str, "start_time");
    uint64_t num_days   = parse_u64(days_str, "num_days");
    uint64_t position_u64 = parse_u64(position_str, "position");
    check(position_u64 <= std::numeric_limits<uint8_t>::max(), "Invalid memo: position is too large");
    uint8_t position = static_cast<uint8_t>(position_u64);

    check(start_time > 0, "Invalid start time");
    check(num_days > 0 && num_days <= 365, "Days must be 1-365");
    check(position == 1 || position == 2, "Position must be 1 or 2");
    check(mode == 'e' || mode == 's' || mode == 'j', "Mode must be 'e', 's', or 'j'");

    return make_tuple(start_time, num_days, position, mode);
} // parse_banner_memo()

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

        // Enforce minimum lead-time buffers
        if (mode == 'e' || mode == 's') {
            check(slot_time >= now + RENT_BUFFER_SECONDS,
                "Must rent at least 48 hours before slot goes live");
        } else if (mode == 'j') {
            check(slot_time >= now + JOIN_BUFFER_SECONDS,
                "Must join at least 12 hours before slot goes live");
        }

        uint64_t pk = slot_time * 10 + position;
        auto itr = ads.find(pk);
        check(itr != ads.end(), "Slot at " + to_string(slot_time) + " position " + to_string(position) + " does not exist. Admin must init first.");

        if (mode == 'e') {
            // Exclusive mode: slot must be unrented
            check(itr->user == get_self(), "Slot at " + to_string(slot_time) + " position " + to_string(position) + " is already rented");

            // Contract pays RAM (required in notify context)
            ads.modify(itr, get_self(), [&](auto& row) {
                row.user        = user;
                row.rental_type = 0;  // exclusive
                row.suspended   = false;
            });
        } else if (mode == 's') {
            // Shared-primary mode: slot must be unrented, sets as shared
            check(itr->user == get_self(), "Slot at " + to_string(slot_time) + " position " + to_string(position) + " is already rented");

            ads.modify(itr, get_self(), [&](auto& row) {
                row.user        = user;
                row.rental_type = 1;     // shared
                row.shared_user = name(); // empty for now
                row.suspended   = false;
            });
        } else if (mode == 'j') {
            // Join-shared mode: slot must exist and be shared with no secondary renter
            check(itr->rental_type == 1, "Slot must be a shared slot to join");
            check(itr->shared_user == name(), "Shared slot is already full");

            // Contract pays RAM (required in notify context)
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
    int64_t powerz_amount = static_cast<int64_t>(quantity.amount * WAX_POWERZ_PERCENT);
    int64_t swap_amount   = quantity.amount - burner_amount - powerz_amount;

    // 25% WAX to cheeseburner (ecosystem financing)
    if (burner_amount > 0) {
        action(
            permission_level{get_self(), "active"_n},
            WAX_CONTRACT,
            "transfer"_n,
            make_tuple(get_self(), CHEESEBURNER, asset(burner_amount, WAX_SYMBOL),
                string("CHEESEAds ecosystem financing"))
        ).send();
    }

    // 25% WAX to cheesepowerz (ecosystem financing)
    if (powerz_amount > 0) {
        action(
            permission_level{get_self(), "active"_n},
            WAX_CONTRACT,
            "transfer"_n,
            make_tuple(get_self(), CHEESEPOWERZ, asset(powerz_amount, WAX_SYMBOL),
                string("CHEESEAds ecosystem financing"))
        ).send();
    }

    // 50% WAX to Alcor swap -> CHEESE comes back to this contract
    if (swap_amount > 0) {
        asset min_cheese_out = asset(MIN_CHEESE_OUTPUT, CHEESE_SYMBOL);
        string swap_memo = string("swapexactin#") + to_string(CHEESE_WAX_POOL_ID)
            + "#" + get_self().to_string()
            + "#" + min_cheese_out.to_string() + "@" + CHEESE_CONTRACT.to_string()
            + "#0";

        action(
            permission_level{get_self(), "active"_n},
            WAX_CONTRACT,
            "transfer"_n,
            make_tuple(get_self(), ALCOR_CONTRACT, asset(swap_amount, WAX_SYMBOL), swap_memo)
        ).send();
    }
}

void cheesebannad::distribute_cheese_funds(asset quantity) {
    int64_t burn_amount  = static_cast<int64_t>(quantity.amount * CHEESE_BURN_PERCENT);
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
