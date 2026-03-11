

## Plan: Add Fee-Routing Contract Disclosure to Section 6

**File**: `src/pages/Disclaimer.tsx`

### Change

Add a new paragraph to **Section 6 (No Dealing, Advising or Market Making)** after the existing two paragraphs (after line 61, before the closing `</section>` tag). This paragraph will disclose that:

- Certain platform operations (e.g., DAO/Farm creation) use a deterministic smart contract (`cheesefeefee`) that performs atomic on-chain token conversions as part of a single user-signed transaction
- The contract functions as a utility router — it does not exercise discretion, negotiate prices, or select counterparties
- The contract does not custody funds between transactions; if any step fails, the entire transaction reverts atomically and the user retains their tokens
- This automated conversion is not "dealing" or "arranging deals" — it is a fixed-logic smart contract executing a user-initiated, user-authorised transaction

This resolves the tension with the existing "does not intermediate" language by clarifying that deterministic inline contract actions within a user-signed atomic transaction are distinct from intermediation or dealing.

