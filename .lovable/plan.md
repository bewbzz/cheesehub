
## Add "Advertise on CHEESEHub" Link to Footer & Remove BannerAds from Header

### What changes

1. **Remove BannerAds from Header** (`src/components/Header.tsx`)
   - Delete lines 150-162 (the entire BannerAds `Link` block in Row 2 / Secondary Nav)
   - This removes the `<Megaphone />` icon and "BannerAds" text from the navigation

2. **Add Advertise Link to Footer** (`src/components/Footer.tsx`)
   - Import `Link` from `react-router-dom` 
   - Add a new paragraph below the copyright text with an "Advertise on CHEESEHub" link
   - Style it as `text-cheese hover:text-cheese-dark transition-colors` for brand consistency
   - Points to `/bannerads` route

### Technical Details

**File: `src/components/Header.tsx`** (lines 150-162)
- Delete the entire BannerAds link block (the commented `{/* BannerAds */}` through the closing `</Link>`)

**File: `src/components/Footer.tsx`** (lines 1-31)
- Add import: `import { Link } from "react-router-dom";` at the top
- After the copyright `<p>` closing tag (line 28), add a new paragraph:
  ```tsx
  <p className="mt-4">
    <Link to="/bannerads" className="text-cheese hover:text-cheese-dark transition-colors">
      Advertise on CHEESEHub
    </Link>
  </p>
  ```

### Result

- BannerAds navigation link is removed from the header's secondary row
- The BannerAds page remains accessible via the footer "Advertise on CHEESEHub" call-to-action
- Footer now directs visitors to the ad rental marketplace without cluttering the main navigation

