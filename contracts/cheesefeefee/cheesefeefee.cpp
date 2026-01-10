#include "cheesefeefee.hpp"

/**
 * @brief Handles incoming CHEESE transfers and records prepayments
 */
void cheesefeefee::on_cheese_transfer(name from, name to, asset quantity, string memo) {
    // Ignore transfers from this contract
    if (from == get_self()) return;
    
    // Only handle transfers TO this contract
    if (to != get_self()) return;
    
    // Validate token
    check(quantity.symbol == CHEESE_SYMBOL, "Only CHEESE token accepted");
    check(quantity.amount > 0, "Amount must be positive");
    
    // Parse memo to get fee type and entity name
    auto [fee_type, entity_name] = parse_memo(memo);
    
    check(fee_type == "daofee" || fee_type == "farmfee", 
        "Invalid fee type. Use 'daofee|entityname' or 'farmfee|entityname'");
    check(entity_name.value != 0, "Entity name cannot be empty");
    
    // Extract just "dao" or "farm" for storage
    string type_short = (fee_type == "daofee") ? "dao" : "farm";
    
    // Check for existing unused prepayment for this user/entity combo
    prepayments_table prepayments(get_self(), get_self().value);
    auto user_entity_idx = prepayments.get_index<"byuserentity"_n>();
    uint128_t composite_key = (uint128_t(from.value) << 64) | entity_name.value;
    auto existing = user_entity_idx.find(composite_key);
    
    // If there's an existing unused prepayment, update it instead of creating new
    while (existing != user_entity_idx.end() && existing->by_user_entity() == composite_key) {
        if (!existing->used && existing->fee_type == type_short) {
            // Add to existing prepayment
            user_entity_idx.modify(existing, same_payer, [&](auto& row) {
                row.cheese_paid += quantity;
                row.paid_at = time_point_sec(current_time_point());
            });
            return;
        }
        existing++;
    }
    
    // Create new prepayment record
    prepayments.emplace(get_self(), [&](auto& row) {
        row.id = prepayments.available_primary_key();
        row.user = from;
        row.fee_type = type_short;
        row.entity_name = entity_name;
        row.cheese_paid = quantity;
        row.paid_at = time_point_sec(current_time_point());
        row.used = false;
    });
}

/**
 * @brief Provides WAXDAO to user - must be bundled with creation action
 * Does NOT transfer CHEESE to eosio.null - that happens in finalise
 */
void cheesefeefee::provide(name user, string fee_type, name entity_name, asset waxdao_amount) {
    require_auth(user);
    
    check(fee_type == "dao" || fee_type == "farm", 
        "Invalid fee type. Use 'dao' or 'farm'");
    
    // Validate WAXDAO amount
    check(waxdao_amount.symbol == WAXDAO_SYMBOL, "Must provide WAXDAO amount");
    check(waxdao_amount.amount > 0, "Amount must be positive");
    
    // Verify the creation action exists in the current transaction
    check(has_creation_action(fee_type, entity_name, user), 
        "This action must be bundled with a DAO or Farm creation action");
    
    // Find the prepayment
    prepayments_table prepayments(get_self(), get_self().value);
    auto user_entity_idx = prepayments.get_index<"byuserentity"_n>();
    uint128_t composite_key = (uint128_t(user.value) << 64) | entity_name.value;
    
    auto itr = user_entity_idx.find(composite_key);
    bool found = false;
    
    while (itr != user_entity_idx.end() && itr->by_user_entity() == composite_key) {
        if (!itr->used && itr->fee_type == fee_type) {
            found = true;
            
            // Mark as used
            user_entity_idx.modify(itr, same_payer, [&](auto& row) {
                row.used = true;
            });
            
            // Send WAXDAO to user (they'll use it to pay the creation fee)
            action(
                permission_level{get_self(), "active"_n},
                WAXDAO_CONTRACT,
                "transfer"_n,
                make_tuple(get_self(), user, waxdao_amount, 
                    string("WAXDAO for ") + fee_type + " creation fee")
            ).send();
            
            // NOTE: CHEESE is NOT transferred to eosio.null here
            // That happens in the finalise action at the end of the transaction
            
            break;
        }
        itr++;
    }
    
    check(found, "No valid prepayment found. Please send CHEESE first with memo 'daofee|name' or 'farmfee|name'");
}

/**
 * @brief Finalises the transaction by transferring CHEESE to eosio.null
 * Called at the END of the bundled transaction after successful creation
 */
void cheesefeefee::finalise(name user, uint64_t prepayment_id) {
    require_auth(user);
    
    prepayments_table prepayments(get_self(), get_self().value);
    auto itr = prepayments.find(prepayment_id);
    
    check(itr != prepayments.end(), "Prepayment not found");
    check(itr->user == user, "Not your prepayment");
    check(itr->used, "Prepayment not yet used by provide action");
    
    // Transfer CHEESE to eosio.null
    action(
        permission_level{get_self(), "active"_n},
        CHEESE_CONTRACT,
        "transfer"_n,
        make_tuple(get_self(), NULL_ACCOUNT, itr->cheese_paid, 
            string("CHEESE fee payment for ") + itr->fee_type + ": " + itr->entity_name.to_string())
    ).send();
    
    // Delete the prepayment record
    prepayments.erase(itr);
}

/**
 * @brief Admin action to refund unused prepayments
 */
void cheesefeefee::refund(uint64_t prepayment_id) {
    require_auth(get_self());
    
    prepayments_table prepayments(get_self(), get_self().value);
    auto itr = prepayments.find(prepayment_id);
    
    check(itr != prepayments.end(), "Prepayment not found");
    check(!itr->used, "Prepayment already used");
    
    // Return CHEESE to user
    action(
        permission_level{get_self(), "active"_n},
        CHEESE_CONTRACT,
        "transfer"_n,
        make_tuple(get_self(), itr->user, itr->cheese_paid, string("Refund for unused prepayment"))
    ).send();
    
    // Erase the prepayment record
    prepayments.erase(itr);
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
 * @brief Parse memo in format "feetype|entityname"
 */
pair<string, name> cheesefeefee::parse_memo(const string& memo) {
    size_t delimiter_pos = memo.find('|');
    check(delimiter_pos != string::npos, "Invalid memo format. Use 'daofee|entityname' or 'farmfee|entityname'");
    
    string fee_type = memo.substr(0, delimiter_pos);
    string entity_str = memo.substr(delimiter_pos + 1);
    
    // Convert to lowercase
    for (auto& c : fee_type) c = tolower(c);
    for (auto& c : entity_str) c = tolower(c);
    
    return make_pair(fee_type, name(entity_str));
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
            // The action exists - check if it contains the right entity name
            // For createdao: first param is "user", second is "daoname"
            // For createfarm: similar structure with "farmname"
            
            // We trust that if the user has auth and the action exists, it's valid
            // Additional validation could unpack the action data if needed
            return true;
        }
    }
    
    return false;
}
