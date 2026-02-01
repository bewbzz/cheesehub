
# Claim Vote RAM Feature for Type 5 NFT DAOs

## Overview

When users vote on proposals in Type 5 (Hold NFT) DAOs, the dao.waxdao contract consumes RAM to store their vote records. After proposals end, users can reclaim this RAM by calling the `claimvoteram` action. This feature will allow users to see their reclaimable RAM and claim it back.

## How It Works

In Type 5 DAOs:
1. User votes on a proposal using their NFT asset IDs
2. The contract stores vote records in the `votesbyprop` and `votesbynft` tables, consuming the user's RAM
3. After the proposal ends/finalizes, users can call `claimvoteram` to reclaim their RAM
4. The action parameters are: `user` (voter account), `dao` (DAO name), `proposal_id` (the proposal they voted on)

## Where to Add This Feature

The feature will be added in two strategic locations:

1. **DaoStaking.tsx** - In the "Hold NFTs to Vote" section for Type 5 DAOs, add a "Claim Vote RAM" card that shows:
   - Past proposals the user has voted on
   - A button to claim RAM for each eligible proposal

2. **ProposalCard.tsx** - For past proposals where the user has voted, show a "Claim RAM" button if the proposal has ended

## Technical Details

### New Function in `src/lib/dao.ts`

```typescript
// Build action for claiming vote RAM after proposal ends
export function buildClaimVoteRamAction(
  user: string,
  daoName: string,
  proposalId: number
) {
  return {
    account: DAO_CONTRACT,
    name: "claimvoteram",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user: user,
      dao: daoName,
      proposal_id: proposalId,
    },
  };
}

// Fetch user's vote RAM claims (proposals they've voted on that have ended)
export async function fetchUserVoteRamClaims(
  daoName: string,
  userAccount: string,
  proposals: Proposal[]
): Promise<{ proposalId: number; canClaim: boolean }[]> {
  // Filter to past proposals where user has voted
  const now = Math.floor(Date.now() / 1000);
  const pastProposals = proposals.filter(p => p.end_time_ts < now);
  
  // Check which ones user voted on by querying votesbyprop
  const claims: { proposalId: number; canClaim: boolean }[] = [];
  
  for (const proposal of pastProposals) {
    const vote = await fetchUserVote(daoName, proposal.proposal_id, userAccount);
    if (vote) {
      claims.push({
        proposalId: proposal.proposal_id,
        canClaim: true, // They voted, so they can claim
      });
    }
  }
  
  return claims;
}
```

### UI Component: ClaimVoteRam.tsx

New component in `src/components/dao/ClaimVoteRam.tsx`:
- Shows a list of past proposals the user voted on
- "Claim RAM" button for each proposal
- "Claim All" button to batch claim multiple proposals
- Success feedback when RAM is claimed

### Integration Points

| File | Change |
|------|--------|
| `src/lib/dao.ts` | Add `buildClaimVoteRamAction` function |
| `src/components/dao/ClaimVoteRam.tsx` | New component for RAM claiming UI |
| `src/components/dao/DaoStaking.tsx` | Import and render ClaimVoteRam for Type 5 DAOs |
| `src/components/dao/ProposalCard.tsx` | Add "Claim RAM" button for past voted proposals |

### User Flow

```text
1. User navigates to DAO detail
2. Goes to "Stake" tab (for Type 5 = "Hold NFTs")
3. Sees new "Claim Vote RAM" section below NFT info
4. Section shows past proposals they voted on with claimable RAM
5. User clicks "Claim RAM" on a proposal
6. Transaction is signed
7. RAM is returned to user's account
```

### Alternative: Button on ProposalCard

For past proposals where user has voted, add a small "Claim RAM" button:
- Only visible for Type 5 DAOs
- Only visible when proposal has ended
- Only visible if user has voted on that proposal
- Clicking it calls the claimvoteram action

## UI Design

### In DaoStaking.tsx (Type 5 section)

```text
+-----------------------------------------------+
| Hold NFTs to Vote                             |
+-----------------------------------------------+
| No staking required! This is a "Hold NFT" DAO |
| ...existing content...                        |
+-----------------------------------------------+
| Claim Vote RAM                          [?]   |
+-----------------------------------------------+
| When you vote on proposals, RAM is consumed.  |
| After proposals end, reclaim your RAM here.   |
|                                               |
| Proposal #1: "Budget for Q1"    [Claim RAM]   |
| Proposal #3: "New logo vote"    [Claim RAM]   |
|                                               |
| [Claim All (2)]                               |
+-----------------------------------------------+
```

### On ProposalCard (for past proposals)

```text
+----------------------------------+
| Proposal #1: Budget Q1   PASSED  |
| ...existing content...           |
|                                  |
| You voted: Yes (3 NFTs)          |
| [Claim Vote RAM]  <-- new button |
+----------------------------------+
```

## Edge Cases

1. **Already claimed**: The contract will error if RAM already claimed - we'll catch this and show appropriate message
2. **Proposal still active**: Button disabled for active proposals
3. **User didn't vote**: Button not shown if user has no vote record
4. **Non-Type 5 DAOs**: Feature only shown for Type 5 (Hold NFT) DAOs since token staking DAOs handle RAM differently
