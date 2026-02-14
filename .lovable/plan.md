

## Dual Banner Slots -- Contract and Frontend Update

### What changes

The banner ad system is upgraded from 1 slot per time period to 2 slots (position 1 and position 2). When both are rented, they display side by side at equal width. When only one is rented, it displays centered at the same single-banner width.

---

### Part 1: Smart Contract Changes

**File: `contracts/cheesebannad/cheesebannad.hpp`**

- Add `uint8_t position` field (1 or 2) to the `bannerad` table
- Change primary key from `time` to a composite: `time * 10 + position` (deterministic, reversible)
- Update `initbannerad` to accept a `position` parameter (1 or 2), or auto-create both positions per slot
- Update `editadbanner` to accept `position` parameter so users can target their specific slot
- Update memo format to `banner|start_time|num_days|position`

**Table change:**
```
TABLE bannerad {
    uint64_t time;
    uint8_t  position;    // 1 or 2
    name     user;
    string   ipfs_hash;
    string   website_url;

    uint64_t primary_key() const { return time * 10 + position; }
};
```

**File: `contracts/cheesebannad/cheesebannad.cpp`**

- `initbannerad`: Creates 2 rows per day (position 1 and position 2) instead of 1
- `parse_banner_memo`: Updated to parse 4-part memo `banner|start_time|num_days|position`
- `assign_slots`: Updated to find slot by `time * 10 + position`
- `editadbanner`: Updated to find slot by `time * 10 + position`
- `on_wax_transfer` / `on_cheese_transfer`: Price stays the same per slot (100 WAX per position per day) -- each position is rented independently

---

### Part 2: Frontend -- Banner Display Component

**New file: `src/components/home/BannerAd.tsx`**

- Fetches the `bannerads` table from the contract
- Filters for slots matching the current 24-hour window (both position 1 and 2)
- Layout logic:
  - **2 active banners**: Render side by side in a `grid grid-cols-2 gap-4` container, each taking 50% width
  - **1 active banner**: Render centered with `max-w-[50%] mx-auto` (same width as one half, centered)
  - **0 active banners**: Render nothing
- Each banner is a clickable image (IPFS gateway fallback) linking to the `website_url`
- Subtle "Ad" badge in the corner of each banner
- Responsive: on mobile, two banners stack vertically (`grid-cols-1`)

---

### Part 3: Frontend -- Marketplace Updates

**Files: `src/components/bannerads/SlotCalendar.tsx`, `RentSlotDialog.tsx`**

- Each day in the calendar shows two sub-slots (Position 1 / Position 2) with individual availability status
- Users pick a specific position when renting
- Memo format updated to include position: `banner|{start_time}|{num_days}|{position}`
- `EditBannerDialog` updated to pass position to the `editadbanner` action

**File: `src/hooks/useBannerSlots.ts`**

- Parse position from each row's primary key (`pk % 10` = position, `Math.floor(pk / 10)` = time)
- Group slots by time, each time entry has up to 2 positions

---

### Technical Details

- Primary key encoding: `time * 10 + position` -- position is always 1 or 2, so this is safe and reversible
- Price is per-position-per-day (100 WAX rents one position for one day)
- Renting both positions for the same day costs 200 WAX (two separate transactions or one with position specified)
- The `initbannerad` action creates both positions automatically for each day
- Frontend detects active banners by checking `slot.time <= now < slot.time + 86400` AND `slot.user !== contract_account`

