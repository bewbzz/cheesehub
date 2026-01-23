#include "cheesefeefee.hpp"
#include <cmath>

/**
 * @brief Handles incoming CHEESE transfers - Single Atomic Transaction Flow
 * 
 * When CHEESE is received:
 * 1. Parse memo to get fee type and entity name
 * 2. Query Alcor pools for CHEESE/WAX and WAXDAO/WAX prices
 * 3. Calculate WAXDAO amount based on CHEESE value with 20% discount
 * 4. Verify creation action exists in the same transaction (bundled)
 * 5. Send calculated WAXDAO to user via inline action
 * 6. Burn CHEESE to eosio.null via inline action
 * 
 * If any step fails, entire transaction reverts atomically - no WAXDAO lost.
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
    
    // SECURITY: Calculate WAXDAO from Alcor on-chain prices (not from memo!)
    asset waxdao_amount = calculate_waxdao_amount(quantity);
    check(waxdao_amount.amount > 0, "Calculated WAXDAO amount is zero - check pool prices");
    
    // 1. Send calculated WAXDAO to user (inline - executes immediately)
    action(
        permission_level{get_self(), "active"_n},
        WAXDAO_CONTRACT,
        "transfer"_n,
        make_tuple(get_self(), from, waxdao_amount, 
            string("WAXDAO for ") + type_short + " creation fee")
    ).send();
    
    // 2. Burn CHEESE to eosio.null (inline - executes immediately)
    action(
        permission_level{get_self(), "active"_n},
        CHEESE_CONTRACT,
        "transfer"_n,
        make_tuple(get_self(), NULL_ACCOUNT, quantity, 
            string("CHEESE fee payment for ") + type_short + ": " + entity_name.to_string())
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
 * @brief Get token price from Alcor pool using sqrtPriceX64
 * Returns price of tokenB per tokenA, adjusted for decimal precision
 * 
 * Formula: price = (sqrtPriceX64 / 2^64)^2 * 10^(precisionA - precisionB)
 * 
 * Pool 1252: CHEESE(A) / WAX(B)    - returns WAX per CHEESE (for validation)
 * Pool 8017: CHEESE(A) / WAXDAO(B) - returns WAXDAO per CHEESE (for conversion)
 */
double cheesefeefee::get_price_from_pool(uint64_t pool_id) {
    alcor_pools_table pools(ALCOR_CONTRACT, ALCOR_CONTRACT.value);
    auto pool = pools.find(pool_id);
    check(pool != pools.end(), "Alcor pool not found");
    check(pool->active, "Alcor pool is not active");
    
    // Get token precisions from pool
    uint8_t precisionA = pool->tokenA.sym.precision();
    uint8_t precisionB = pool->tokenB.sym.precision();
    
    // Convert sqrtPriceX64 to raw price
    // Raw price = (sqrtPriceX64 / 2^64)^2
    uint128_t sqrtPrice = pool->currSlot.sqrtPriceX64;
    double normalized = (double)sqrtPrice / (double)(1ULL << 64);
    double raw_price = normalized * normalized;
    
    // Apply decimal precision adjustment
    // Adjusted price = raw_price * 10^(precisionA - precisionB)
    int precision_diff = (int)precisionA - (int)precisionB;
    double adjusted_price = raw_price * pow(10.0, precision_diff);
    
    return adjusted_price;
}

/**
 * @brief Calculate WAXDAO amount from CHEESE amount using live Alcor prices
 * Uses Pool 8017 for direct CHEESE→WAXDAO conversion
 * Uses Pool 1252 only to validate minimum WAX value requirement
 */
asset cheesefeefee::calculate_waxdao_amount(asset cheese_amount) {
    // Get prices from Alcor pools
    double wax_per_cheese = get_price_from_pool(CHEESE_WAX_POOL_ID);       // Pool 1252
    double waxdao_per_cheese = get_price_from_pool(CHEESE_WAXDAO_POOL_ID); // Pool 8017
    
    check(wax_per_cheese > 0, "Invalid CHEESE/WAX price from Alcor");
    check(waxdao_per_cheese > 0, "Invalid CHEESE/WAXDAO price from Alcor");
    
    // Convert CHEESE amount to double (4 decimals)
    double cheese_value = (double)cheese_amount.amount / 10000.0;
    
    // SECURITY: Validate user sent at least 200 WAX worth of CHEESE
    double wax_value = cheese_value * wax_per_cheese;
    double min_required = MIN_WAX_VALUE * (1.0 - WAX_VALUE_TOLERANCE);
    check(wax_value >= min_required, 
        "Insufficient CHEESE. Need at least 200 WAX worth.");
    
    // DIRECT CONVERSION using Pool 8017: CHEESE → WAXDAO
    double waxdao_value = cheese_value * waxdao_per_cheese;
    
    // Convert to asset (8 decimals for WAXDAO)
    int64_t waxdao_amount = (int64_t)(waxdao_value * 100000000.0);
    
    return asset(waxdao_amount, WAXDAO_SYMBOL);
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
