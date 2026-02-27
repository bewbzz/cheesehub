

## Security Fixes for CHEESEAds

### 1. XSS Prevention: Sanitize `websiteUrl` in Banner Display (Frontend)

**Problem:** `BannerAd.tsx` renders `banner.websiteUrl` directly as an `<a href>`. A malicious renter could set their `website_url` on-chain to `javascript:alert(...)` or `data:text/html,...`, executing code when users click the banner.

The same issue exists in the `PreviewBannerDialog` inside `SlotCalendar.tsx` (lines 48, 50) where admin preview links use raw URLs.

**Fix:** Create a URL sanitizer utility and apply it everywhere banner URLs are rendered.

**File: `src/lib/sanitizeUrl.ts`** (new)
- Export a `sanitizeUrl(url: string)` function that only allows `https://` and `http://` schemes
- Returns `#` for any other scheme (javascript:, data:, vbscript:, etc.)

**File: `src/components/home/BannerAd.tsx`**
- Import `sanitizeUrl` and wrap `banner.websiteUrl` in the `<a href>`:
  - Line 20: `href={sanitizeUrl(banner.websiteUrl)}`

**File: `src/components/bannerads/SlotCalendar.tsx`**
- Import `sanitizeUrl` and wrap URLs in the PreviewBannerDialog:
  - Line 48: `href={sanitizeUrl(slot.websiteUrl)}`
  - Line 50: `href={sanitizeUrl(slot.sharedWebsiteUrl)}`

---

### 2. Contract-Level URL Validation (Smart Contract)

**Problem:** The contract accepts any string as `website_url` with no scheme validation, storing malicious URLs permanently on-chain.

**Fix:** Add a URL prefix check in both `editadbanner` and `editsharedad`.

**File: `contracts/cheesebannad/cheesebannad.cpp`**
- After existing length checks in `editadbanner` (line 88) and `editsharedad` (line 114), add:

```cpp
if (website_url.length() > 0) {
    check(
        website_url.substr(0, 8) == "https://" || website_url.substr(0, 7) == "http://",
        "website_url must start with https:// or http://"
    );
}
```

This blocks `javascript:`, `data:`, and any other dangerous schemes at the contract level.

---

### 3. Integer-Only Pricing Math (Smart Contract)

**Problem:** The pricing calculation in `on_wax_transfer` uses `double` multiplication which can cause 1-satoshi rounding errors, potentially allowing underpayment.

```cpp
int64_t required = static_cast<int64_t>(
    static_cast<double>(price_per_day.amount) * multiplier
) * static_cast<int64_t>(num_days);
```

**Fix:** Replace with integer arithmetic using basis-point percentages.

**File: `contracts/cheesebannad/cheesebannad.hpp`**
- Replace the `double` discount constants with integer basis points:

```text
// Replace:
static constexpr double SHARED_DISCOUNT = 0.30;
static constexpr double PROMOZ_DISCOUNT = 0.50;

// With:
static constexpr uint64_t SHARED_NUMERATOR = 70;   // 70% of full price
static constexpr uint64_t PROMOZ_NUMERATOR = 50;    // 50% of full price
static constexpr uint64_t PERCENT_BASE     = 100;
```

**File: `contracts/cheesebannad/cheesebannad.cpp`** (in `on_wax_transfer`)
- Replace the floating-point calculation with:

```cpp
int64_t unit_price = price_per_day.amount;

if (mode == 's' || mode == 'j') {
    unit_price = unit_price * SHARED_NUMERATOR / PERCENT_BASE;
}
if (from == PROMOZ_ACCOUNT) {
    unit_price = unit_price * PROMOZ_NUMERATOR / PERCENT_BASE;
}

int64_t required = unit_price * static_cast<int64_t>(num_days);
```

Integer division truncates consistently, no floating-point surprises.

Also update `distribute_wax_funds` and `distribute_cheese_funds` similarly -- replace the `double` percent constants with integer ratios (25/100, 66/100).

---

### Summary

| Issue | Severity | Layer | Fix |
|-------|----------|-------|-----|
| XSS via javascript: URLs | High | Frontend | sanitizeUrl utility |
| Malicious URL storage | Medium | Contract | URL scheme check |
| Floating-point pricing | Low | Contract | Integer-only math |

### Deployment Note
The contract changes (items 2 and 3) require recompiling and redeploying `cheesebannad`. The frontend XSS fix (item 1) takes effect immediately on build.

