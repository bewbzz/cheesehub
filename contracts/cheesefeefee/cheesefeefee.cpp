#include "cheesefeefee.hpp"

/**
 * @brief Handles incoming CHEESE transfers - Single Atomic Transaction Flow
 * 
 * When CHEESE is received:
 * 1. Parse memo to get fee type, entity name, and required WAXDAO amount
 * 2. Verify creation action exists in the same transaction (bundled)
 * 3. Send WAXDAO to user via inline action (immediate)
 * 4. Burn CHEESE to eosio.null via inline action (immediate)
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
    
    // Parse memo: "daofee|entityname|250.00000000 WAXDAO"
    auto [fee_type, entity_name, waxdao_amount] = parse_memo_v2(memo);
    
    check(fee_type == "daofee" || fee_type == "farmfee", 
        "Invalid fee type. Use 'daofee|name|waxdao' or 'farmfee|name|waxdao'");
    check(entity_name.value != 0, "Entity name cannot be empty");
    check(waxdao_amount.symbol == WAXDAO_SYMBOL, "WAXDAO amount required in memo");
    check(waxdao_amount.amount > 0, "WAXDAO amount must be positive");
    
    // Extract "dao" or "farm" for action checking
    string type_short = (fee_type == "daofee") ? "dao" : "farm";
    
    // SECURITY: Verify the creation action exists in this transaction
    // This ensures provide + burn only happen when bundled with actual creation
    check(has_creation_action(type_short, entity_name, from),
        "Must be bundled with createdao/createfarm action");
    
    // 1. Send WAXDAO to user (inline - executes immediately within this transaction)
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
 * @brief Parse memo in extended format "feetype|entityname|waxdao_amount"
 */
tuple<string, name, asset> cheesefeefee::parse_memo_v2(const string& memo) {
    size_t first_delim = memo.find('|');
    size_t second_delim = memo.find('|', first_delim + 1);
    
    check(first_delim != string::npos && second_delim != string::npos,
        "Invalid memo format. Use: feetype|entityname|waxdao_amount");
    
    string fee_type = memo.substr(0, first_delim);
    string entity_str = memo.substr(first_delim + 1, second_delim - first_delim - 1);
    string waxdao_str = memo.substr(second_delim + 1);
    
    // Convert to lowercase
    for (auto& c : fee_type) c = tolower(c);
    for (auto& c : entity_str) c = tolower(c);
    
    // Trim whitespace from waxdao_str
    size_t start = waxdao_str.find_first_not_of(" \t\n\r");
    size_t end = waxdao_str.find_last_not_of(" \t\n\r");
    if (start != string::npos && end != string::npos) {
        waxdao_str = waxdao_str.substr(start, end - start + 1);
    }
    
    // Parse WAXDAO amount
    asset waxdao_amount = asset_from_string(waxdao_str);
    
    return make_tuple(fee_type, name(entity_str), waxdao_amount);
}

/**
 * @brief Convert asset string to asset object
 * Format: "250.00000000 WAXDAO"
 */
asset cheesefeefee::asset_from_string(const string& str) {
    size_t space_pos = str.find(' ');
    check(space_pos != string::npos, "Invalid asset format. Expected: '250.00000000 WAXDAO'");
    
    string amount_str = str.substr(0, space_pos);
    string symbol_str = str.substr(space_pos + 1);
    
    // Find decimal point to determine precision
    size_t dot_pos = amount_str.find('.');
    uint8_t precision = 0;
    if (dot_pos != string::npos) {
        precision = amount_str.size() - dot_pos - 1;
    }
    
    // Remove decimal point and convert to int64
    string int_str = amount_str;
    if (dot_pos != string::npos) {
        int_str = amount_str.substr(0, dot_pos) + amount_str.substr(dot_pos + 1);
    }
    
    int64_t amount = stoll(int_str);
    symbol sym = symbol(symbol_str, precision);
    
    return asset(amount, sym);
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
            // Additional validation could unpack action data if needed
            return true;
        }
    }
    
    return false;
}
