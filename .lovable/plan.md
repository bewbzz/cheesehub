

# Configure GitHub Pages Deployment

Deploy CHEESEHub to `https://cheeseonwax.github.io/cheesehub/`

## What We'll Do

### 1. Update Vite Configuration
Add the `base` path so all links and assets load from the correct `/cheesehub/` subfolder.

**File:** `vite.config.ts`

```typescript
export default defineConfig(({ mode }) => ({
  base: '/cheesehub/',  // ← Add this line
  server: {
    host: "::",
    port: 8080,
  },
  // ... rest stays the same
}));
```

### 2. Add 404.html Workaround
GitHub Pages doesn't understand React Router. When someone visits `cheeseonwax.github.io/cheesehub/drops` directly, GitHub says "page not found" because there's no actual `drops.html` file.

The fix: Create a special `404.html` that redirects to your app, which then handles the routing.

**New file:** `public/404.html`

This file will redirect any "not found" page back to your main app while preserving the URL, so React Router can handle it.

### 3. Update index.html
Add a small script to catch the redirect and restore the correct URL.

## Files to Change

| File | Change |
|------|--------|
| `vite.config.ts` | Add `base: '/cheesehub/'` |
| `public/404.html` | New file - redirect script for client-side routing |
| `index.html` | Add script to handle the redirect |

## After These Changes

1. Push the code to the `cheeseonwax/cheesehub` repository
2. In GitHub: Go to **Settings → Pages → Source** and select your branch (usually `main`) and folder (`/root` or `/docs`)
3. Wait a few minutes for GitHub to build and deploy
4. Visit `https://cheeseonwax.github.io/cheesehub/` 

All your routes (`/drops`, `/farm`, `/dao`, etc.) will work correctly, even when accessed directly or refreshed.

