

# Add Shareable DAO URLs (`/dao/:daoName`)

## Summary
Add a `/dao/:daoName` route so each DAO gets a unique, shareable URL (e.g., `cheesehub.com/dao/cheesedao`). This mirrors how farms already work with `/farm/:farmName`.

## Changes

### 1. Create a new `DaoDetailPage` component
**New file: `src/pages/DaoDetail.tsx`**

A route-level page that:
- Reads `daoName` from the URL params (`useParams`)
- Fetches the DAO data using `fetchDaoDetails(daoName)`
- Renders the DAO detail view in a full-page layout (not a dialog) using `Layout`
- Shows loading/error/not-found states
- Includes a "Back to DAOs" button linking to `/dao`

This will reuse the existing `DaoDetail` component's internal logic but rendered as a page instead of a dialog. The simplest approach is to refactor `DaoDetail` to support both modes (dialog and inline), or create a wrapper that passes `open={true}` and renders it within a page layout.

### 2. Add route to `App.tsx`
Add a new route: `<Route path="/dao/:daoName" element={<DaoDetail />} />`

### 3. Update `DaoCard` to use navigation links
**File: `src/components/dao/DaoCard.tsx`**

Change the "View DAO" button from opening a dialog (`setShowDetail(true)`) to navigating to `/dao/${dao.dao_name}` using `useNavigate` from react-router-dom. Remove the inline `DaoDetail` dialog rendering.

### 4. Update `DaoDetail` to support page mode
**File: `src/components/dao/DaoDetail.tsx`**

Refactor so it can render either as a dialog (for backward compatibility) or as a full-page component when accessed via URL. When used as a page:
- Skip the `Dialog` wrapper
- Use `useParams` to get the DAO name and fetch data
- Show a back button to `/dao`
- Render the same sidebar + content layout directly in the page

## Technical Notes

- The existing `fetchDaoDetails` function in `src/lib/dao.ts` already supports fetching a single DAO by name
- The pattern follows exactly how `FarmDetail` works: `useParams` to get the name, fetch data, render full page with back navigation
- Links shared externally (e.g., `cheesehub.com/dao/mydao`) will load the DAO directly
- The Browse DAOs grid cards will navigate to the URL instead of opening a dialog
