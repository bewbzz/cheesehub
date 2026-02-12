#include "cheesefeefee.hpp"
#include <cmath>

/**
 * @brief Handles incoming CHEESE transfers - Secure Atomic Transaction Flow
 * 
 * SECURITY: Uses two-pool pricing to prevent flash manipulation
 * 1. Pool 1252 (CHEESE/WAX): Validates CHEESE value >= 200 WAX
 * 2. Pool 1236 (WAX/WAXDAO): Converts WAX value to WAXDAO
 * 
 * Attacker would need to manipulate BOTH pools simultaneously to exploit,
 * which is significantly more expensive/difficult than single-pool attacks.
 */
void cheesefeefee::on_cheese_transfer(name from, name to, asset quantity, string memo) {
    // Ignore transfers from this contract (our own inline actions)
    if (from == get_self()) return;
    
    // Only handle transfers TO this contract
    if (to != get_self()) return;
    
    // Validate token
    check(quantity.symbol == CHEESE_SYMBOL, "Only CHEESE token accepted");
    check(quantity.amount > 0, "Amount must be positive");
    
    // Parse simplified memo: "daofee|entityname"
    auto [fee_type, entity_name] = parse_memo(memo);
    
    check(fee_type == "daofee" || fee_type == "farmfee", 
        "Invalid fee type. Use 'daofee|name' or 'farmfee|name'");
    check(entity_name.value != 0, "Entity name cannot be empty");
    
    // Extract "dao" or "farm" for action checking
    string type_short = (fee_type == "daofee") ? "dao" : "farm";
    
    // SECURITY: Verify the creation action exists in this transaction
    check(has_creation_action(type_short, entity_name, from),
        "Must be bundled with createdao/createfarm action");
    
    // SECURITY: Calculate WAXDAO using two-pool WAX-value exchange
    asset waxdao_amount = calculate_waxdao_amount(quantity);
    
    // SECURITY: Minimum output check prevents dust attacks
    check(waxdao_amount.amount >= MIN_WAXDAO_OUTPUT, 
        "Calculated WAXDAO below minimum (5 WAXDAO). Send more CHEESE.");
    
    // 1. Send calculated WAXDAO to user (inline - executes immediately)
    action(
        permission_level{get_self(), "active"_n},
        WAXDAO_CONTRACT,
        "transfer"_n,
        make_tuple(get_self(), from, waxdao_amount, 
            string("WAXDAO for ") + type_short + " creation fee")
    ).send();
    
    // 2. Calculate fee distribution: 66% burn, 34% liquidity staking
    int64_t burn_amount = static_cast<int64_t>(quantity.amount * BURN_PERCENT);
    int64_t stake_amount = quantity.amount - burn_amount;  // Remainder ensures no loss
    
    asset burn_quantity = asset(burn_amount, CHEESE_SYMBOL);
    asset stake_quantity = asset(stake_amount, CHEESE_SYMBOL);
    
    // 3. Burn 66% to eosio.null
    if (burn_amount > 0) {
        action(
            permission_level{get_self(), "active"_n},
            CHEESE_CONTRACT,
            "transfer"_n,
            make_tuple(get_self(), NULL_ACCOUNT, burn_quantity, 
                string("CHEESE burn for ") + type_short + ": " + entity_name.to_string())
        ).send();
    }
    
    // 4. Send 34% to liquidity staking
    if (stake_amount > 0) {
        action(
            permission_level{get_self(), "active"_n},
            CHEESE_CONTRACT,
            "transfer"_n,
            make_tuple(get_self(), LIQUIDITY_STAKING, stake_quantity, 
                string("CHEESE liquidity staking for ") + type_short + ": " + entity_name.to_string())
        ).send();
    }
}

/**
 * @brief Handles incoming WAX transfers - Routes WAX through cheesefeefee
 * 
 * Instead of 250 WAX going directly to WaxDAO (no benefit to CHEESE),
 * this routes WAX through the contract:
 * 1. 205 WAX worth of WAXDAO is calculated via Pool 1236 and sent to user
 * 2. 45 WAX is sent to cheeseburner (benefits CHEESE ecosystem)
 * 3. User's bundled transaction pays WAXDAO to WaxDAO and creates farm/dao
 */
void cheesefeefee::on_wax_transfer(name from, name to, asset quantity, string memo) {
    // Ignore transfers from this contract (our own inline actions)
    if (from == get_self()) return;
    
    // Only handle transfers TO this contract
    if (to != get_self()) return;
    
    // Validate token
    check(quantity.symbol == WAX_SYMBOL, "Only WAX token accepted");
    check(quantity.amount == WAX_FEE_REQUIRED, "Must send exactly 250 WAX");
    
    // Parse memo: "waxdaofee|entityname" or "waxfarmfee|entityname"
    auto [fee_type, entity_name] = parse_memo(memo);
    
    check(fee_type == "waxdaofee" || fee_type == "waxfarmfee", 
        "Invalid fee type. Use 'waxdaofee|name' or 'waxfarmfee|name'");
    check(entity_name.value != 0, "Entity name cannot be empty");
    
    // Extract "dao" or "farm" for action checking
    string type_short = (fee_type == "waxdaofee") ? "dao" : "farm";
    
    // SECURITY: Verify the creation action exists in this transaction
    check(has_creation_action(type_short, entity_name, from),
        "Must be bundled with createdao/createfarm action");
    
    // Calculate WAXDAO from 205 WAX using Pool 1236
    asset waxdao_amount = calculate_waxdao_from_wax(WAX_TO_WAXDAO);
    
    // SECURITY: Minimum output check prevents dust attacks
    check(waxdao_amount.amount >= MIN_WAXDAO_OUTPUT, 
        "Calculated WAXDAO below minimum (5 WAXDAO). Pool may be depleted.");
    
    // 1. Swap 205 WAX for WAXDAO via Alcor Pool 1236 (sent directly to user)
    int64_t wax_to_swap = static_cast<int64_t>(WAX_TO_WAXDAO * 100000000.0); // 8 decimals
    asset wax_swap_quantity = asset(wax_to_swap, WAX_SYMBOL);
    
    string alcor_memo = string("swapexactin#") + to_string(WAXDAO_WAX_POOL_ID)
        + "#" + from.to_string()
        + "#" + waxdao_amount.to_string()
        + "#0";
    
    action(
        permission_level{get_self(), "active"_n},
        WAX_CONTRACT,
        "transfer"_n,
        make_tuple(get_self(), ALCOR_CONTRACT, wax_swap_quantity, alcor_memo)
    ).send();
    
    // 2. Send 45 WAX to cheeseburner (inline)
    int64_t burner_amount = static_cast<int64_t>(WAX_TO_BURNER * 100000000.0); // 8 decimals
    asset burner_quantity = asset(burner_amount, WAX_SYMBOL);
    
    action(
        permission_level{get_self(), "active"_n},
        WAX_CONTRACT,
        "transfer"_n,
        make_tuple(get_self(), CHEESEBURNER, burner_quantity, 
            string("WAX for CHEESE burn via ") + type_short + " creation: " + entity_name.to_string())
    ).send();
}

/**
 * @brief Admin action to withdraw any token from the contract
 */
void cheesefeefee::withdraw(name token_contract, name to, asset quantity) {
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
 * @brief Admin action to update baseline prices for deviation checks
 */
void cheesefeefee::setbaseline(double wax_per_cheese, double waxdao_per_wax) {
    require_auth(get_self());
    
    check(wax_per_cheese > 0, "wax_per_cheese must be positive");
    check(waxdao_per_wax > 0, "waxdao_per_wax must be positive");
    
    config_table configs(get_self(), get_self().value);
    auto itr = configs.find(1);
    
    if (itr == configs.end()) {
        configs.emplace(get_self(), [&](auto& c) {
            c.id = 1;
            c.wax_per_cheese_baseline = wax_per_cheese;
            c.waxdao_per_wax_baseline = waxdao_per_wax;
        });
    } else {
        configs.modify(itr, get_self(), [&](auto& c) {
            c.wax_per_cheese_baseline = wax_per_cheese;
            c.waxdao_per_wax_baseline = waxdao_per_wax;
        });
    }
}

/**
 * @brief Parse memo in simplified format "feetype|entityname"
 */
tuple<string, name> cheesefeefee::parse_memo(const string& memo) {
    size_t delim = memo.find('|');
    
    check(delim != string::npos,
        "Invalid memo format. Use: feetype|entityname");
    
    string fee_type = memo.substr(0, delim);
    string entity_str = memo.substr(delim + 1);
    
    // Convert to lowercase
    for (auto& c : fee_type) c = tolower(c);
    for (auto& c : entity_str) c = tolower(c);
    
    // Trim whitespace from entity_str
    size_t start = entity_str.find_first_not_of(" \t\n\r");
    size_t end = entity_str.find_last_not_of(" \t\n\r");
    if (start != string::npos && end != string::npos) {
        entity_str = entity_str.substr(start, end - start + 1);
    }
    
    return make_tuple(fee_type, name(entity_str));
}

/**
 * @brief Get token price from Alcor pool using reserves
 * @param pool_id - The Alcor pool ID
 * @param base_symbol - Symbol of token to get price for
 * @return Price as other_token per base_token
 */
double cheesefeefee::get_price_from_pool(uint64_t pool_id, symbol_code base_symbol) {
    alcor_pools_table pools(ALCOR_CONTRACT, ALCOR_CONTRACT.value);
    auto pool_itr = pools.find(pool_id);
    check(pool_itr != pools.end(), "Alcor swap pool not found");
    check(pool_itr->active, "Alcor pool is not active");
    
    // Get reserves and precisions from extended_asset
    double reserveA = static_cast<double>(pool_itr->tokenA.quantity.amount);
    double reserveB = static_cast<double>(pool_itr->tokenB.quantity.amount);
    uint8_t precisionA = pool_itr->tokenA.quantity.symbol.precision();
    uint8_t precisionB = pool_itr->tokenB.quantity.symbol.precision();
    
    // Normalize reserves by precision
    reserveA /= pow(10.0, precisionA);
    reserveB /= pow(10.0, precisionB);
    
    // Determine which is the base token and return "other token per base"
    symbol_code symbolA = pool_itr->tokenA.quantity.symbol.code();
    
    if (symbolA == base_symbol) {
        // Base is tokenA, return tokenB per base
        return reserveB / reserveA;
    } else {
        // Base is tokenB, return tokenA per base
        return reserveA / reserveB;
    }
}

/**
 * @brief Get current baseline prices from config table or use constants
 */
pair<double, double> cheesefeefee::get_baselines() {
    config_table configs(get_self(), get_self().value);
    auto itr = configs.find(1);
    
    if (itr != configs.end()) {
        return make_pair(itr->wax_per_cheese_baseline, itr->waxdao_per_wax_baseline);
    }
    
    // Use compiled-in defaults
    return make_pair(BASELINE_WAX_PER_CHEESE, BASELINE_WAXDAO_PER_WAX);
}

/**
 * @brief Validate price is within acceptable deviation from baseline
 */
void cheesefeefee::check_price_deviation(double actual, double baseline, const string& price_name) {
    double deviation = fabs(actual - baseline) / baseline;
    check(deviation <= MAX_PRICE_DEVIATION,
        price_name + " deviation too high (" + to_string(static_cast<int>(deviation * 100)) + 
        "%). Possible manipulation or high volatility. Try again later.");
}

/**
 * @brief Calculate WAXDAO using secure two-pool WAX-value exchange
 * 
 * SECURITY: This approach requires manipulating TWO pools to exploit:
 * 1. CHEESE/WAX (Pool 1252) - high liquidity
 * 2. WAX/WAXDAO (Pool 1236) - high liquidity
 * 
 * Exchange principle: 200 WAX of CHEESE → 200 WAX of WAXDAO
 */
asset cheesefeefee::calculate_waxdao_amount(asset cheese_amount) {
    // Step 1: Get WAX per CHEESE from Pool 1252
    double wax_per_cheese = get_price_from_pool(CHEESE_WAX_POOL_ID, symbol_code("CHEESE"));
    check(wax_per_cheese > 0, "Invalid CHEESE/WAX price from Alcor");
    
    // Step 2: Get WAXDAO per WAX from Pool 1236
    // Note: WAX is tokenA, WAXDAO is tokenB; base_symbol is WAX → returns WAXDAO per WAX
    double waxdao_per_wax = get_price_from_pool(WAXDAO_WAX_POOL_ID, symbol_code("WAX"));
    check(waxdao_per_wax > 0, "Invalid WAXDAO/WAX price from Alcor");
    
    // SECURITY: Check price deviation from baselines
    auto [baseline_cheese, baseline_waxdao] = get_baselines();
    check_price_deviation(wax_per_cheese, baseline_cheese, "CHEESE/WAX price");
    check_price_deviation(waxdao_per_wax, baseline_waxdao, "WAXDAO/WAX price");
    
    // Step 3: Calculate WAX value of CHEESE
    double cheese_units = static_cast<double>(cheese_amount.amount) / 10000.0;  // 4 decimals
    double wax_value = cheese_units * wax_per_cheese;
    
    // Step 4: Validate minimum 200 WAX value (with 2.5% tolerance)
    double min_required = MIN_WAX_VALUE * (1.0 - WAX_VALUE_TOLERANCE);
    check(wax_value >= min_required, 
        "Need at least 200 WAX worth of CHEESE. Sent: " + 
        to_string(static_cast<int64_t>(wax_value)) + " WAX worth");
    
    // Step 5: Convert WAX value to WAXDAO using Pool 1236 rate
    double waxdao_amount = wax_value * waxdao_per_wax;
    int64_t waxdao_units = static_cast<int64_t>(waxdao_amount * 100000000.0); // 8 decimals
    
    check(waxdao_units > 0, "Calculated WAXDAO amount too small");
    
    return asset(waxdao_units, WAXDAO_SYMBOL);
}

/**
 * @brief Calculate WAXDAO amount from WAX using Pool 1236 only
 * Used for WAX payment routing - simpler than CHEESE flow since input is already WAX
 * 
 * @param wax_value - WAX amount to convert (e.g., 205.0)
 * @return WAXDAO asset amount
 */
asset cheesefeefee::calculate_waxdao_from_wax(double wax_value) {
    // Get WAXDAO per WAX from Pool 1236
    double waxdao_per_wax = get_price_from_pool(WAXDAO_WAX_POOL_ID, symbol_code("WAX"));
    check(waxdao_per_wax > 0, "Invalid WAXDAO/WAX price from Alcor");
    
    // SECURITY: Check price deviation from baseline
    auto [baseline_cheese, baseline_waxdao] = get_baselines();
    check_price_deviation(waxdao_per_wax, baseline_waxdao, "WAXDAO/WAX price");
    
    // Convert WAX value to WAXDAO
    double waxdao_amount = wax_value * waxdao_per_wax;
    int64_t waxdao_units = static_cast<int64_t>(waxdao_amount * 100000000.0); // 8 decimals
    
    check(waxdao_units > 0, "Calculated WAXDAO amount too small");
    
    return asset(waxdao_units, WAXDAO_SYMBOL);
}

/**
 * @brief Check if the current transaction contains the expected creation action
 */
bool cheesefeefee::has_creation_action(const string& fee_type, name entity_name, name user) {
    // Get the transaction from the current context
    size_t size = transaction_size();
    char* buffer = (char*)malloc(size);
    read_transaction(buffer, size);
    transaction trx = unpack<transaction>(buffer, size);
    free(buffer);
    
    name expected_contract = (fee_type == "dao") ? DAO_CONTRACT : FARM_CONTRACT;
    name expected_action = (fee_type == "dao") ? "createdao"_n : "createfarm"_n;
    
    for (const auto& act : trx.actions) {
        if (act.account == expected_contract && act.name == expected_action) {
            // The action exists - we trust the bundled transaction is valid
            return true;
        }
    }
    
    return false;
}
