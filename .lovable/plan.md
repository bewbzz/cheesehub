
# Add Multi-Account Switching via WharfKit Sessions

## Overview
Implement a dropdown account switcher in the wallet menu that allows users to quickly switch between multiple logged-in WAX accounts without needing to fully logout and login each time. Similar to how bloks.io handles account switching.

## How It Works

**WharfKit's Built-in Multi-Session Support:**
- `sessionKit.getSessions()` - Retrieves all stored sessions from localStorage
- `sessionKit.restore(session)` - Switches to a specific session
- `sessionKit.login()` - Adds a new session (keeps existing ones)
- `sessionKit.logout(session)` - Removes only a specific session

Each login creates a new session stored in localStorage. Sessions persist across browser refreshes and can be restored/switched without re-authenticating (the wallet plugin handles this seamlessly).

## User Experience

**Current Flow:**
1. Connected as `cheesedao.gm`
2. Want to use `anotherwax` account
3. Click Disconnect -> Click Connect -> Choose wallet -> Select account
4. Repeat for each account switch

**New Flow:**
1. Connected as `cheesedao.gm`
2. Click wallet dropdown -> See "Switch Account" submenu
3. Click on `anotherwax` (previously logged in) -> Instant switch
4. Or click "Add Account" to login with another account

## UI Design

```text
+------------------------------------------+
| [Wallet]                                 |
|  Wallet                                  |
|  CHEESEAmp                              |
|  ─────────────────────────────────       |
|  ▼ Switch Account                        |
|     ● cheesedao.gm     (active)         |
|       anotherwax                         |
|       testwaxacc                         |
|     + Add Account                        |
|  ─────────────────────────────────       |
|  Disconnect                              |
+------------------------------------------+
```

Clicking an account name instantly switches to it. "Add Account" triggers a fresh login flow that adds to the existing sessions.

## Technical Implementation

### 1. Update WaxContext (`src/context/WaxContext.tsx`)

Add new context properties:
```typescript
interface WaxContextType {
  // ... existing properties
  
  // Multi-account support
  allSessions: SerializedSession[];
  switchAccount: (session: SerializedSession) => Promise<void>;
  addAccount: () => Promise<void>;
  removeAccount: (session: SerializedSession) => Promise<void>;
  refreshSessions: () => Promise<void>;
}
```

Implement the new functions:
- `refreshSessions()` - Calls `sessionKit.getSessions()` and updates state
- `switchAccount()` - Calls `sessionKit.restore(session)` and updates active session
- `addAccount()` - Calls `sessionKit.login()` without logging out first
- `removeAccount()` - Calls `sessionKit.logout(session)` for a specific session

### 2. Update WalletConnect Component (`src/components/WalletConnect.tsx`)

Add a submenu in the wallet dropdown that shows:
- All available sessions from `allSessions`
- Active session indicator (bullet point or checkmark)
- "Add Account" button at bottom of list
- Optional: Remove button per account (or hold-to-remove)

Use Radix's `DropdownMenuSub` for the nested submenu.

### 3. Update DropsHeader Component (`src/components/drops/DropsHeader.tsx`)

Mirror the same account switching UI for consistency on the Drops page.

## Files to Modify

| File | Changes |
|------|---------|
| `src/context/WaxContext.tsx` | Add `allSessions` state, `switchAccount`, `addAccount`, `removeAccount` functions |
| `src/components/WalletConnect.tsx` | Add "Switch Account" submenu with session list and "Add Account" option |
| `src/components/drops/DropsHeader.tsx` | Add same account switching submenu for Drops page consistency |

## Edge Cases Handled

- **No other sessions**: Hide "Switch Account" submenu if only one session
- **Session expired**: If restore fails, show toast and remove stale session
- **Same account selected**: No-op if clicking the already-active account
- **Cloud Wallet vs Anchor**: Both work, sessions track which wallet plugin was used

## Session Data Structure

WharfKit stores sessions with this structure:
```typescript
interface SerializedSession {
  actor: string;        // e.g., "cheesedao.gm"
  chain: string;        // WAX chain ID
  permission: string;   // e.g., "active"
  walletPlugin: {
    id: string;         // "anchor" or "cloudwallet"
    data?: any;
  };
  default?: boolean;
}
```

This allows us to display the account name and even show which wallet type each session uses.
