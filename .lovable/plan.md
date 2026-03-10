

## Disclaimer Page for CHEESEHub (Generalized)

### Overview
Create a `/disclaimer` page with comprehensive legal/tax disclaimer content. All references to Australian law, ASIC, AFSL, ATO, and the Corporations Act are removed. The content is generalized for a global audience while retaining all the same sections and substance.

### Changes

**1. Create `src/pages/Disclaimer.tsx`**

Full-page disclaimer using `<Layout>`, with these sections:

1. **General Disclaimer** — CHEESEHub is a community-built interface; not financial, legal, or tax advice; no warranties
2. **Nature of CHEESE** — memecoin with no intrinsic value; governed by a decentralized DAO with members worldwide; not a security or financial product under any jurisdiction
3. **Financial Services** — CHEESEHub does not hold any financial services licence in any jurisdiction; does not provide regulated financial product advice; is not supervised by any financial regulator
4. **Tax Obligations** — crypto assets may be treated as property, commodities, or otherwise depending on your jurisdiction; users are responsible for reporting gains/losses and maintaining records; goods and services taxes may apply; consult a qualified tax professional
5. **International Users** — users must comply with all applicable laws and regulations in their own country or region
6. **Risk Warnings** — extreme volatility, smart contract risk, total loss of funds possible, no recourse or deposit protection
7. **No Liability** — the DAO, its contributors, and the platform accept no liability for any losses
8. **Not Professional Advice** — users should seek independent legal, financial, and tax advice from qualified professionals in their jurisdiction

**2. Update `src/App.tsx`**
- Import and add route: `<Route path="/disclaimer" element={<Disclaimer />} />`

**3. Update `src/components/Footer.tsx`**
- Add a "Disclaimer" link next to the existing "Advertise on CHEESEHub" link

