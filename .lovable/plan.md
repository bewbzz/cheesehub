

# Rename CHEESEDrop to CHEESEShoppe (🛒) and Give CHEESEDrip the 💧 Emoji

## Summary
- Rename all "CHEESEDrop" display text to "CHEESEShoppe"
- Assign 🛒 (shopping cart) emoji to CHEESEShoppe
- Assign 💧 (droplet) emoji to CHEESEDrip (replacing 🫧)
- Routes (`/drops`, `/drip`) and filenames stay unchanged

## Changes

### 1. `src/components/Header.tsx`
- Line 127: Comment `CHEESEDrop` to `CHEESEShoppe`
- Line 137: Change emoji from 💧 to 🛒
- Line 138: Change label from `CHEESEDrop` to `CHEESEShoppe`
- Line 163: Change CHEESEDrip emoji from 🫧 to 💧

### 2. `src/components/drops/DropsHero.tsx`
- Line 32: Change flanking emoji from 💧 to 🛒
- Line 34: Change title from `Drop` to `Shoppe`
- Line 37: Change flanking emoji from 💧 to 🛒

### 3. `src/components/drops/DropsHeader.tsx`
- Line 58: Change `CHEESEDrops` to `CHEESEShoppe`

### 4. `src/pages/Index.tsx`
- Line 180: Comment `CHEESEDrop` to `CHEESEShoppe`
- Line 184: Change emoji from 💧 to 🛒
- Line 186: Change title text from `Drop` to `Shoppe`
- Line 188: Change description text from `CHEESEDrop` to `CHEESEShoppe`
- Line 192: Change button text from `Go to CHEESEDrop` to `Go to CHEESEShoppe`

### 5. `src/pages/Drip.tsx`
- Already correct title ("CHEESEDrip") and 💧 emojis -- no changes needed

