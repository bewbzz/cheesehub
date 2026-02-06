
# Add Edit/Remove Stakable Assets Functionality

## Overview

Enhance the "Manage Stakable Assets" dialog to allow creators to edit reward values and remove stakable assets, but only when the farm is **closed (status 2)** and has **no stakers**.

## User Flow

```text
Farm Status Check
     │
     ├── Active/Under Construction/Perm Closed
     │   └── Add only (current behavior)
     │
     └── Closed + No Stakers
         └── Full editing enabled
             ├── Edit existing asset (click to populate form)
             ├── Remove existing asset (delete button)
             └── Add new asset (current behavior)
```

## Why This Restriction?

When a farm has active stakers, changing reward rates mid-stake could cause reward calculation issues. By requiring the farm to be closed with all users kicked, creators can safely reconfigure the farm before reopening.

## Files to Modify

### 1. src/lib/farm.ts

Add four new erase action builders for removing stakable assets:

| Function | Purpose | Contract Action |
|----------|---------|-----------------|
| `buildEraseTemplateValuesAction` | Remove a template from stakable assets | `erasetmpvalue` |
| `buildEraseSchemaValuesAction` | Remove a schema from stakable assets | `eraseschvalue` |
| `buildEraseCollectionValuesAction` | Remove a collection from stakable assets | `erasecolvalue` |
| `buildEraseAttributeValuesAction` | Remove an attribute from stakable assets | `eraseattvalue` |

### 2. src/components/farm/ManageStakableAssets.tsx

Update the component to support editing mode:

| Change | Description |
|--------|-------------|
| Add prop | `canEdit: boolean` - passed from FarmDetail based on status + staker count |
| Edit mode | When `canEdit` is true, show Edit/Remove buttons on each existing asset |
| Populate form | Clicking "Edit" on an asset fills the form with its current values |
| Remove action | Clicking "Remove" triggers the appropriate erase action |
| Visual indicator | Show a banner when in edit mode explaining why editing is allowed |

### 3. src/components/farm/FarmDetail.tsx

Pass the edit permission to ManageStakableAssets:

| Change | Description |
|--------|-------------|
| Calculate `canEditAssets` | True when `isClosed && !hasStakers && !isPermClosed` |
| Pass prop | `<ManageStakableAssets farm={farm} canEdit={canEditAssets} onSuccess={handleFarmUpdated} />` |

## UI Changes in ManageStakableAssets

### Current Assets Section (with editing enabled)

```text
┌─────────────────────────────────────────┐
│ Current Stakable Assets                 │
│ ℹ️ Editing enabled - farm is closed    │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ Template #123456           [✏️] [🗑️] │ │
│ │ (0.5000 CHEESE/hr + 0.1000 WAX/hr)  │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ Template #789012           [✏️] [🗑️] │ │
│ │ (1.0000 CHEESE/hr)                  │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Edit Flow

1. User clicks Edit button on an existing asset
2. Form is populated with the asset's current identifier and reward rates
3. User modifies values and clicks "Update Stakable Asset"
4. The set*values action is called (same action as add - it updates if exists)

### Remove Flow

1. User clicks Remove button on an existing asset
2. Confirmation dialog appears
3. User confirms, erase*value action is called
4. Asset is removed from the list

## Technical Details

### Erase Action Builders

```typescript
// Build action for erasing a template value
export function buildEraseTemplateValuesAction(
  user: string,
  farmname: string,
  templateId: number
) {
  return {
    account: FARM_CONTRACT,
    name: "erasetmpvalue",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user,
      farmname,
      template_id: templateId,
    },
  };
}

// Similar pattern for schemas, collections, and attributes
```

### ManageStakableAssets Updates

- New state: `editingAsset` to track which asset is being edited
- New state: `isRemoving` for removal loading state
- Updated `renderExistingAssets()` to include action buttons when `canEdit` is true
- New function `handleEditAsset()` to populate form with existing values
- New function `handleRemoveAsset()` to call erase action
- Updated submit button text: "Add" vs "Update" based on editing state

## Summary

| File | Action |
|------|--------|
| `src/lib/farm.ts` | Add 4 erase action builders |
| `src/components/farm/ManageStakableAssets.tsx` | Add edit/remove UI and logic |
| `src/components/farm/FarmDetail.tsx` | Pass `canEdit` prop based on farm status |
