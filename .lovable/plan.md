

# Standardize CHEESENull Containers to Match Other dApps

## The Problem

The CHEESENull page uses different card/container styling compared to CHEESEFarm, CHEESEDao, and other dApps:

| Property | CHEESENull | Other dApps (Farm, DAO) |
|----------|-----------|------------------------|
| Background | `bg-card/80`, `bg-card/60` | `bg-card/50` |
| Border | `border-cheese/20`, `border-cheese/10` | `border-border/50` |
| Shadow | `shadow-[0_0_15px_rgba(255,204,0,0.1)]` (cheese glow) | None (standard) |
| Hover | None | `hover:border-cheese/30` or `hover:border-primary/30` |

## Changes

### 1. NullStats.tsx (line 30)
Change the Card class from:
`bg-card/80 backdrop-blur border-cheese/20 shadow-[0_0_15px_rgba(255,204,0,0.1)]`
to:
`bg-card/50 border-border/50`

### 2. NullTotalStats.tsx (line 19)
Change the Card class from:
`bg-card/60 backdrop-blur border-cheese/10`
to:
`bg-card/50 border-border/50`

### 3. NullerLeaderboard.tsx (line 58)
Change the Card class from:
`bg-card/60 backdrop-blur border-cheese/10`
to:
`bg-card/50 border-border/50`

All three components keep their `w-full max-w-md` width since CHEESENull uses a centered single-column layout (unlike the grid layouts of Farm/DAO browse pages). The internal content, fonts, and spacing remain unchanged as they are already consistent.

