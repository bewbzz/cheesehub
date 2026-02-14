

## Fix Alcor Swap Memo Format in cheesefeefee and cheesebannad

### Problem
Alcor's `swapexactin` action requires the minimum output to be an **extended asset** with the token contract appended using `@`. Both contracts currently omit this, causing:
```
assertion failure with message: Invalid extended asset: Should be separated with '@'
```

### Changes

**`contracts/cheesefeefee/cheesefeefee.cpp`** (line ~130-133)

Current:
```text
string alcor_memo = string("swapexactin#") + to_string(WAXDAO_WAX_POOL_ID)
    + "#" + from.to_string()
    + "#" + waxdao_amount.to_string()
    + "#0";
```

Fixed -- append `@token.waxdao` to the minimum output:
```text
string alcor_memo = string("swapexactin#") + to_string(WAXDAO_WAX_POOL_ID)
    + "#" + from.to_string()
    + "#" + waxdao_amount.to_string() + "@" + WAXDAO_CONTRACT.to_string()
    + "#0";
```

Produces: `swapexactin#1236#username#123.45678901 WAXDAO@token.waxdao#0`

---

**`contracts/cheesebannad/cheesebannad.cpp`** (line ~271-272)

Current:
```text
string swap_memo = "swapexactin#" + to_string(CHEESE_WAX_POOL_ID) +
    "#" + get_self().to_string() + "#0.0001 CHEESE#0";
```

Fixed -- append `@cheeseburger` to the minimum output:
```text
string swap_memo = "swapexactin#" + to_string(CHEESE_WAX_POOL_ID) +
    "#" + get_self().to_string() + "#0.0001 CHEESE@" + CHEESE_CONTRACT.to_string() + "#0";
```

Produces: `swapexactin#1252#cheesebannad#0.0001 CHEESE@cheeseburger#0`

### Files Modified

| File | Change |
|------|--------|
| `contracts/cheesefeefee/cheesefeefee.cpp` | Append `@token.waxdao` to WAXDAO minimum output in Alcor swap memo |
| `contracts/cheesebannad/cheesebannad.cpp` | Append `@cheeseburger` to CHEESE minimum output in Alcor swap memo |

No frontend changes needed.

