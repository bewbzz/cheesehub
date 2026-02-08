#include "cheesebannad.hpp"
#include <cmath>

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

        // Skip if slot already exists
        auto itr = ads.find(slot_time);
        if (itr != ads.end()) continue;

        ads.emplace(get_self(), [&](auto& row) {
            row.time        = slot_time;
            row.user        = get_self();  // available = owned by contract
            row.ipfs_hash   = "";
            row.website_url = "";
        });
    }
}

void cheesebannad::editadbanner(name user, uint64_t start_time, string ipfs_hash, string website_url) {
    require_auth(user);

    check(ipfs_hash.length() <= MAX_IPFS_HASH_LEN, "IPFS hash too long");
    check(website_url.length() <= MAX_URL_LEN, "URL too long");

    bannerads_table ads(get_self(), get_self().value);
    auto itr = ads.find(start_time);
    check(itr != ads.end(), "Slot not found");
    check(itr->user == user, "You do not own this slot");

    ads.modify(itr, user, [&](auto& row) {
        row.ipfs_hash   = ipfs_hash;
        row.website_url = website_url;
    });
}

void cheesebannad::setconfig(asset wax_price_per_day, double wax_per_cheese_baseline) {
    require_auth(get_self());

    check(wax_price_per_day.symbol == WAX_SYMBOL, "Price must be in WAX");
    check(wax_price_per_day.amount > 0, "Price must be positive");
    check(wax_per_cheese_baseline > 0, "Baseline must be positive");

    config_table configs(get_self(), get_self().value);
    auto itr = configs.find(1);

    if (itr == configs.end()) {
        configs.emplace(get_self(), [&](auto& c) {
            c.id                      = 1;
            c.wax_price_per_day       = wax_price_per_day;
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

// ============================================================================
// Transfer Notifications
// ============================================================================

void cheesebannad::on_wax_transfer(name from, name to, asset quantity, string memo) {
    if (from == get_self() || to != get_self()) return;
    if (quantity.symbol != WAX_SYMBOL) return;

    // Only process banner memos
    if (memo.substr(0, 7) != "banner|") return;

    check(quantity.amount > 0, "Amount must be positive");

    auto [start_time, num_days] = parse_banner_memo(memo);
    auto [price_per_day, baseline] = get_config();

    // Validate payment: num_days * price_per_day
    int64_t required = price_per_day.amount * static_cast<int64_t>(num_days);
    check(quantity.amount >= required,
        "Insufficient WAX. Need " + to_string(required / 100000000) + " WAX for " + to_string(num_days) + " day(s)");

    assign_slots(from, start_time, num_days);
}

void cheesebannad::on_cheese_transfer(name from, name to, asset quantity, string memo) {
    if (from == get_self() || to != get_self()) return;

    check(quantity.symbol == CHEESE_SYMBOL, "Only CHEESE accepted");
    check(quantity.amount > 0, "Amount must be positive");

    // Only process banner memos
    if (memo.substr(0, 7) != "banner|") return;

    auto [start_time, num_days] = parse_banner_memo(memo);
    auto [price_per_day, baseline] = get_config();

    // Get CHEESE→WAX price from Alcor
    double wax_per_cheese = get_cheese_wax_price();
    check_price_deviation(wax_per_cheese, baseline);

    // Calculate WAX value of sent CHEESE
    double cheese_units = static_cast<double>(quantity.amount) / 10000.0; // 4 decimals
    double wax_value = cheese_units * wax_per_cheese;

    // Required WAX value
    double required_wax = static_cast<double>(price_per_day.amount * static_cast<int64_t>(num_days)) / 100000000.0;

    check(wax_value >= required_wax,
        "Insufficient CHEESE value. Need " + to_string(static_cast<int64_t>(required_wax)) +
        " WAX worth. Sent: " + to_string(static_cast<int64_t>(wax_value)) + " WAX worth");

    assign_slots(from, start_time, num_days);
    distribute_cheese(quantity);
}

// ============================================================================
// Private Helpers
// ============================================================================

tuple<uint64_t, uint64_t> cheesebannad::parse_banner_memo(const string& memo) {
    // Format: "banner|start_time|num_days"
    size_t first = memo.find('|');
    check(first != string::npos, "Invalid memo. Use: banner|start_time|num_days");

    size_t second = memo.find('|', first + 1);
    check(second != string::npos, "Invalid memo. Use: banner|start_time|num_days");

    string start_str = memo.substr(first + 1, second - first - 1);
    string days_str  = memo.substr(second + 1);

    uint64_t start_time = stoull(start_str);
    uint64_t num_days   = stoull(days_str);

    check(start_time > 0, "Invalid start time");
    check(num_days > 0 && num_days <= 365, "Days must be 1-365");

    return make_tuple(start_time, num_days);
}

double cheesebannad::get_cheese_wax_price() {
    alcor_pools_table pools(ALCOR_CONTRACT, ALCOR_CONTRACT.value);
    auto pool_itr = pools.find(CHEESE_WAX_POOL_ID);
    check(pool_itr != pools.end(), "Alcor pool 1252 not found");
    check(pool_itr->active, "Alcor pool is not active");

    double reserveA = static_cast<double>(pool_itr->tokenA.quantity.amount);
    double reserveB = static_cast<double>(pool_itr->tokenB.quantity.amount);
    uint8_t precisionA = pool_itr->tokenA.quantity.symbol.precision();
    uint8_t precisionB = pool_itr->tokenB.quantity.symbol.precision();

    reserveA /= pow(10.0, precisionA);
    reserveB /= pow(10.0, precisionB);

    // Pool 1252: CHEESE=tokenA, WAX=tokenB → WAX per CHEESE = reserveB / reserveA
    symbol_code symbolA = pool_itr->tokenA.quantity.symbol.code();
    if (symbolA == symbol_code("CHEESE")) {
        return reserveB / reserveA;
    } else {
        return reserveA / reserveB;
    }
}

pair<asset, double> cheesebannad::get_config() {
    config_table configs(get_self(), get_self().value);
    auto itr = configs.find(1);

    if (itr != configs.end()) {
        return make_pair(itr->wax_price_per_day, itr->wax_per_cheese_baseline);
    }

    // Defaults
    return make_pair(asset(DEFAULT_WAX_PRICE, WAX_SYMBOL), DEFAULT_WAX_PER_CHEESE);
}

void cheesebannad::check_price_deviation(double actual, double baseline) {
    double deviation = fabs(actual - baseline) / baseline;
    check(deviation <= MAX_PRICE_DEVIATION,
        "CHEESE/WAX price deviation too high (" + to_string(static_cast<int>(deviation * 100)) +
        "%). Possible manipulation. Try again later.");
}

void cheesebannad::assign_slots(name user, uint64_t start_time, uint64_t num_days) {
    bannerads_table ads(get_self(), get_self().value);
    uint32_t now = current_time_point().sec_since_epoch();

    for (uint64_t i = 0; i < num_days; i++) {
        uint64_t slot_time = start_time + (i * SECONDS_PER_DAY);

        // Cannot rent past slots
        check(slot_time + SECONDS_PER_DAY > now, "Cannot rent expired slot at " + to_string(slot_time));

        auto itr = ads.find(slot_time);
        check(itr != ads.end(), "Slot at " + to_string(slot_time) + " does not exist. Admin must init first.");
        check(itr->user == get_self(), "Slot at " + to_string(slot_time) + " is already rented");

        ads.modify(itr, get_self(), [&](auto& row) {
            row.user = user;
        });
    }
}

void cheesebannad::distribute_cheese(asset quantity) {
    int64_t burn_amount  = static_cast<int64_t>(quantity.amount * BURN_PERCENT);
    int64_t stake_amount = quantity.amount - burn_amount;

    if (burn_amount > 0) {
        action(
            permission_level{get_self(), "active"_n},
            CHEESE_CONTRACT,
            "transfer"_n,
            make_tuple(get_self(), NULL_ACCOUNT, asset(burn_amount, CHEESE_SYMBOL),
                string("CHEESE burn - banner ad"))
        ).send();
    }

    if (stake_amount > 0) {
        action(
            permission_level{get_self(), "active"_n},
            CHEESE_CONTRACT,
            "transfer"_n,
            make_tuple(get_self(), LIQUIDITY_STAKING, asset(stake_amount, CHEESE_SYMBOL),
                string("CHEESE liquidity staking - banner ad"))
        ).send();
    }
}
