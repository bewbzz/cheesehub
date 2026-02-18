
# Admin Moderation: Remove and Reinstate Banner Ads

## Overview

Admins need to be able to pull down a bad ad immediately, and reverse that decision later (e.g. after a community vote clears the advertiser). This requires:

1. **Contract**: Two new actions — `removeadbanner` (wipe content) and `reinstateadbanner` (restore a flag so the renter can re-upload)
2. **Frontend**: A `RemoveBannerDialog` component and admin buttons wired into `SlotCalendar`

---

## How Removal and Reinstatement Work

The key insight is that the contract does **not** store a separate "suspended" flag field — instead it uses the existing `ipfs_hash` and `website_url` fields as the source of truth for display. The `useBannerAds` hook already skips any slot where `ipfs_hash.length === 0`. So:

- **Remove**: Admin zeroes out `ipfs_hash`, `website_url` (and optionally shared fields). The slot still belongs to the renter — the ad just disappears from the live display.
- **Reinstate**: Admin sets a placeholder back on the record that signals the slot is restored. The renter can then call `editadbanner` again to upload new content. This is the "reversible" part — the admin restores the slot, community review happens off-chain, then the renter re-uploads.

This is clean because no new table fields are needed and the existing `BannerAd.tsx` already handles empty `ipfs_hash` gracefully (returns `null`).

---

## Contract Changes

### `contracts/cheesebannad/cheesebannad.hpp`

**New Actions:**

```cpp
/**
 * @brief Admin removes a banner ad (zeroes IPFS hash + URL)
 * @param caller     Admin account authorizing this action
 * @param start_time Slot start timestamp
 * @param position   1 or 2
 * @param clear_shared If true, also clears the shared renter's content
 */
ACTION removeadbanner(name caller, uint64_t start_time, uint8_t position, bool clear_shared);

/**
 * @brief Admin reinstates a previously removed banner (restores renter's ability to upload)
 * @param caller     Admin account authorizing this action
 * @param start_time Slot start timestamp
 * @param position   1 or 2
 */
ACTION reinstateadbanner(name caller, uint64_t start_time, uint8_t position);
```

Both use `require_admin(caller)` from the multi-admin system planned previously (or fall back to `require_auth(get_self())` if that system isn't deployed yet — see sequencing note below).

**New `admins` TABLE** (included here since multi-admin is required for the `caller` pattern):

```cpp
TABLE admin_entry {
    name account;
    uint64_t primary_key() const { return account.value; }
};
typedef multi_index<"admins"_n, admin_entry> admins_table;
```

**New Actions for admin management:**

```cpp
ACTION addadmin(name account);
ACTION removeadmin(name account);
```

**Private helper:**

```cpp
void require_admin(name account);
```

---

### `contracts/cheesebannad/cheesebannad.cpp`

**`removeadbanner` implementation:**
- `require_admin(caller)`
- Validate `position == 1 || position == 2`
- Look up slot by `start_time * 10 + position`
- `check` slot exists
- `check` slot is rented (user != `get_self()`) — can't remove an unrented slot
- `ads.modify(itr, get_self(), ...)` — zeroes `ipfs_hash` and `website_url`
- If `clear_shared == true`, also zeroes `shared_ipfs_hash` and `shared_website_url`
- RAM payer is `get_self()` (admin is shrinking content, net RAM release)

**`reinstateadbanner` implementation:**
- `require_admin(caller)`
- Validate `position == 1 || position == 2`
- Look up slot by `start_time * 10 + position`
- `check` slot exists and is still rented (user != `get_self()`)
- `check` slot is currently removed (ipfs_hash is empty) — otherwise it's already live
- No data written — this action is a **signal** (the renter sees the slot is back and re-uploads via `editadbanner`)
- Actually: we set `ipfs_hash` to a special sentinel like `"reinstated"` so the slot visually appears as "awaiting content" in the frontend without showing a broken image

Wait — simpler approach: do nothing to the data for reinstatement. The admin simply tells the renter off-chain "you can re-upload." The renter calls `editadbanner` normally. BUT the problem is `editadbanner` might fail if the admin zeroed the hash and the contract has a guard preventing empty-hash edits.

Looking at the current `editadbanner` code — it has NO guard against empty ipfs_hash, it just writes whatever the user provides. So the renter CAN always call `editadbanner` again after removal. The `reinstateadbanner` action is still valuable as an on-chain signal / audit trail. It sets `ipfs_hash` to `""` (already is) and sets a new boolean field... 

Actually, cleanest design: **add a `bool suspended` field to the `bannerad` table.** This separates "removed by admin" from "renter hasn't uploaded yet." The `editadbanner` action should `check(!suspended, "Slot is suspended by admin")`. `reinstateadbanner` sets `suspended = false`, which re-enables `editadbanner`. This gives:

- Clear on-chain audit state
- Prevents renter from re-uploading while suspended
- Admin can cleanly reverse: `reinstateadbanner` → renter re-uploads
- Frontend can show "Suspended" badge to admin

### Updated `bannerad` TABLE:

```cpp
TABLE bannerad {
    uint64_t time;
    uint8_t  position;
    name     user;
    string   ipfs_hash;
    string   website_url;
    uint8_t  rental_type;
    name     shared_user;
    string   shared_ipfs_hash;
    string   shared_website_url;
    bool     suspended;            // NEW: true = admin has pulled this ad

    uint64_t primary_key() const { return time * 10 + position; }
};
```

`suspended` defaults to `false` in `initbannerad` and `assign_slots`.

`editadbanner` and `editsharedbanner` get a new guard:
```cpp
check(!itr->suspended, "This slot has been suspended by an admin. Contact support.");
```

---

## Frontend Changes

### 1. `src/hooks/useBannerSlots.ts`

Add `suspended: boolean` to `BannerAdRow` interface and `BannerSlot` interface. Map it from `row.suspended`.

### 2. `src/hooks/useBannerAds.ts`

Add filter: skip suspended slots from the active display:
```typescript
row.user !== BANNER_CONTRACT &&
row.ipfs_hash.length > 0 &&
!row.suspended   // NEW: skip admin-suspended ads
```

### 3. `src/components/bannerads/SlotCalendar.tsx`

- Detect admin: `const isAdmin = accountName === "cheesebannad"` (extend later when multi-admin table is queryable)
- Add `removeTarget: BannerSlot | null` state
- Show a red **"Remove"** button when `isAdmin && slot.isOnChain && slot.user !== "cheesebannad" && !slot.suspended`
- Show a green **"Reinstate"** button when `isAdmin && slot.isOnChain && slot.suspended`
- Add suspended badge to `SlotBadge` component: when `slot.suspended`, show a red "Suspended" badge visible to all users (so the renter knows their ad is down)

### 4. New `src/components/bannerads/RemoveBannerDialog.tsx`

A dialog with:
- Title: "Remove Banner Ad"
- Shows renter account, date, position
- Checkbox: "Also clear shared banner content" (shown only if shared slot with a shared renter)
- Reason field (string) — stored locally for UI reference only, not sent to contract (contract doesn't need it)
- Two buttons: Cancel / Remove Ad (destructive red)
- Calls `removeadbanner` action on `cheesebannad`
- On success: toast + refetch

### 5. New `src/components/bannerads/ReinstateBannerDialog.tsx`

A simple confirmation dialog:
- Title: "Reinstate Banner Ad"
- Description: "This will allow the renter to re-upload content. The slot was previously removed."
- Two buttons: Cancel / Reinstate
- Calls `reinstateadbanner` action on `cheesebannad`
- On success: toast + refetch

---

## Data Flow

```text
Admin sees bad ad in SlotCalendar
  → Clicks "Remove" → RemoveBannerDialog opens
  → Submits → cheesebannad::removeadbanner(caller, start_time, position, clear_shared)
  → Contract: zeroes ipfs_hash + website_url, sets suspended = true
  → editadbanner now blocked for this slot
  → BannerAd.tsx: slot filtered out (suspended = true) → ad disappears from all pages
  → SlotCalendar: slot shows red "Suspended" badge

[Community votes, decides to reinstate]

Admin clicks "Reinstate" → ReinstateBannerDialog opens
  → Submits → cheesebannad::reinstateadbanner(caller, start_time, position)
  → Contract: sets suspended = false, ipfs_hash stays ""
  → editadbanner now unblocked
  → Renter can re-upload new content via Edit button
  → Once re-uploaded, ad goes live again
```

---

## Files to Create / Modify

| File | Change |
|---|---|
| `contracts/cheesebannad/cheesebannad.hpp` | Add `suspended` field to `bannerad` table; add `removeadbanner`, `reinstateadbanner`, `addadmin`, `removeadmin` actions; add `admin_entry` table; add `require_admin` helper |
| `contracts/cheesebannad/cheesebannad.cpp` | Implement all above; add `suspended = false` in `initbannerad` and `assign_slots`; add `check(!suspended)` guard to `editadbanner` and `editsharedbanner`; implement `require_admin`, `addadmin`, `removeadmin` |
| `contracts/cheesebannad/README.md` | Document new actions with block explorer examples |
| `src/hooks/useBannerSlots.ts` | Add `suspended` to interfaces and mapping |
| `src/hooks/useBannerAds.ts` | Filter out suspended slots from active display |
| `src/components/bannerads/SlotCalendar.tsx` | Add admin Remove/Reinstate buttons; add Suspended badge |
| `src/components/bannerads/RemoveBannerDialog.tsx` | New dialog (create) |
| `src/components/bannerads/ReinstateBannerDialog.tsx` | New dialog (create) |

---

## Important Note: Contract Redeployment

Adding `suspended bool` to the `bannerad` TABLE is a **schema change**. Because existing on-chain rows won't have this field, the new contract code must treat a missing `suspended` field as `false` — EOSIO handles this correctly for added fields at the end of a struct as long as existing rows are read with the new ABI. Existing rows will deserialize `suspended` as `false` (the default). No migration SQL is needed.

