

# Add Farm Profile Editing Capability

## Overview
This implementation adds the ability for farm owners to edit their farm's profile from the farm detail page, matching the WaxDAO interface shown in the reference image. The solution mirrors the existing DAO profile editing pattern.

## Reference Image Analysis
From the WaxDAO "Manage Farm" interface, the Profile tab includes:
- **Cover Image** (IPFS hash input, e.g., "QMabc123...")
- **Avatar** (IPFS hash input, e.g., "QMabc123...")
- **Description** (multi-line textarea)
- **Socials Section**:
  - Website (e.g., waxdao.io)
  - Twitter (e.g., twitter.com/MikeD_Cryo)
  - Telegram (e.g., t.me/hoodpunks)
  - Discord (e.g., discord.gg/helio)
  - Medium (e.g., medium.com/wax)
  - YouTube (e.g., youtube.com/MikeDCryp)
  - AtomicHub (e.g., wax.atomichub.io/waxd)
  - WaxDAO (e.g., waxdao.io/u/mikedeypnr)

## Implementation Plan

### 1. Add Action Builder to `src/lib/farm.ts`

Add a new `buildSetFarmProfileAction` function to construct the `setprofile` action for the `farms.waxdao` contract:

```typescript
export function buildSetFarmProfileAction(
  user: string,
  farmName: string,
  profile: {
    avatar: string;
    cover_image: string;
    description: string;
  },
  socials: FarmSocials
) {
  return {
    account: FARM_CONTRACT,
    name: "setprofile",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user,
      farmname: farmName,
      profile: {
        avatar: profile.avatar || "",
        cover_image: profile.cover_image || "",
        description: profile.description || "",
      },
      // Socials must be in ALPHABETICAL ORDER per contract ABI
      socials: {
        atomichub: socials.atomichub || "",
        discord: socials.discord || "",
        medium: socials.medium || "",
        telegram: socials.telegram || "",
        twitter: socials.twitter || "",
        waxdao: socials.waxdao || "",
        website: socials.website || "",
        youtube: socials.youtube || "",
      },
    },
  };
}
```

### 2. Create `src/components/farm/EditFarmProfile.tsx`

New dialog component based on the DAO pattern with:

**Profile Fields:**
- Cover Image (IPFS hash input with placeholder "e.g. QMabc123...")
- Avatar (IPFS hash input with placeholder "e.g. QMabc123...")
- Description (textarea, 500 char max with counter)

**Social Links Section (Collapsible):**
- Website
- Twitter
- Telegram
- Discord
- Medium
- YouTube
- AtomicHub
- WaxDAO

**Features:**
- Dialog modal matching existing UI patterns
- Pre-populated with current farm profile data
- Submit handler calls `buildSetFarmProfileAction` and executes transaction
- Success callback triggers farm data refresh
- Loading state during transaction
- Toast notifications for success/error states
- Prevents accidental close on outside click (per project memory)

### 3. Update `src/components/farm/FarmDetail.tsx`

Add the Edit Profile button in the header section:

**Import Changes:**
```typescript
import { EditFarmProfile } from "./EditFarmProfile";
import { Pencil } from "lucide-react";
```

**State Addition:**
```typescript
const [editProfileOpen, setEditProfileOpen] = useState(false);
```

**UI Addition (after "Copy Name" button, only for creators):**
```typescript
{isCreator && (
  <Button 
    size="sm" 
    variant="outline" 
    onClick={() => setEditProfileOpen(true)}
  >
    <Pencil className="h-4 w-4 mr-1" />
    Edit Profile
  </Button>
)}
```

**Dialog Render:**
```typescript
{isCreator && (
  <EditFarmProfile
    farm={farm}
    open={editProfileOpen}
    onClose={() => setEditProfileOpen(false)}
    onProfileUpdated={handleFarmUpdated}
  />
)}
```

## Technical Details

### Contract ABI Requirements
The `setprofile` action on `farms.waxdao` expects:
- `user`: Account name executing the action
- `farmname`: The farm identifier
- `profile`: Object with `avatar`, `cover_image`, `description` strings
- `socials`: Object with fields in **alphabetical order** (atomichub, discord, medium, telegram, twitter, waxdao, website, youtube)

### UI Placement
The "Edit Profile" button will appear:
- In the header section next to "Copy Name" and "Manage Stakable Assets"
- Only visible to the farm creator (`isCreator === true`)
- Styled consistently with other action buttons using variant="outline"

### Dialog Behavior
- Prevents accidental close on outside click (`onInteractOutside={(e) => e.preventDefault()}`)
- Pre-populates all fields from current farm data
- Shows loading spinner during transaction
- Auto-refreshes farm data on successful update
- Toast notifications for success/error states

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `src/lib/farm.ts` | Modify | Add `buildSetFarmProfileAction` function |
| `src/components/farm/EditFarmProfile.tsx` | Create | New dialog component for editing farm profile |
| `src/components/farm/FarmDetail.tsx` | Modify | Add Edit Profile button for farm creators |

