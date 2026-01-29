
# Fix Template Values Action Structure

## Problem

The error `Encoding error at root<settmpvalues>.values<TEMPLATE_REWARD[]>.0.collection_name<name>: Found undefined for non-optional type` indicates that the WaxDAO V2 contract now requires `collection_name` as a mandatory field in the `TEMPLATE_REWARD` struct, but the current implementation only sends `template_id` and `hourly_rewards`.

## Root Cause

The `buildSetTemplateValuesAction` function in `src/lib/farm.ts` builds a values array without the required `collection_name`:

```typescript
// Current (broken)
values: [{
  template_id: templateId,
  hourly_rewards: [...]  // Missing collection_name!
}]
```

The WaxDAO contract expects:

```typescript
// Expected by contract
values: [{
  template_id: templateId,
  collection_name: "somecollection",  // Required!
  hourly_rewards: [...]
}]
```

## Solution

1. Update `buildSetTemplateValuesAction` in `src/lib/farm.ts` to accept a `collectionName` parameter
2. Update `ManageStakableAssets.tsx` to:
   - Show a collection name input field for template-based farms (type 2)
   - Pass the collection name when calling `buildSetTemplateValuesAction`
   - Validate that collection name is provided

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/farm.ts` | Add `collectionName` parameter to `buildSetTemplateValuesAction` |
| `src/components/farm/ManageStakableAssets.tsx` | Add collection name input for template farms, pass to action builder |

## Technical Details

### 1. Update farm.ts (lines 265-287)

Add `collectionName` as a required parameter:

```typescript
export function buildSetTemplateValuesAction(
  user: string,
  farmname: string,
  collectionName: string,  // New required parameter
  templateId: number,
  rewardValues: RewardValue[]
) {
  return {
    account: FARM_CONTRACT,
    name: "settmpvalues",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user,
      farmname,
      values: [{
        template_id: templateId,
        collection_name: collectionName,  // Include in values
        hourly_rewards: rewardValues.map(rv => ({
          quantity: rv.quantity,
          contract: rv.contract,
        })),
      }],
    },
  };
}
```

### 2. Update ManageStakableAssets.tsx

**Update validation (line 88-91):**
```typescript
if (farm.farm_type === 2 && (!templateId || !collectionName)) {
  toast.error("Please enter template ID and collection name");
  return;
}
```

**Update form fields for template type (lines 294-306):**
Add collection name input alongside template ID:
```typescript
case 2: // Templates
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="collectionName">Collection Name</Label>
        <Input
          id="collectionName"
          placeholder="e.g., cheesenfts111"
          value={collectionName}
          onChange={(e) => setCollectionName(e.target.value.toLowerCase())}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="templateId">Template ID</Label>
        <Input
          id="templateId"
          type="number"
          placeholder="e.g., 123456"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
        />
      </div>
    </>
  );
```

**Update action call (lines 136-142):**
```typescript
case 2: // Templates
  action = buildSetTemplateValuesAction(
    accountName,
    farm.farm_name,
    collectionName,  // Pass collection name
    parseInt(templateId),
    rewardValues
  );
  break;
```

## Why This Happened

The WaxDAO V2 contract structure requires templates to be associated with a collection for proper validation and indexing. This ensures the template actually belongs to the specified collection and enables better filtering/querying of stakable assets.
