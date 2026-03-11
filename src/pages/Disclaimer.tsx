import { Layout } from "@/components/Layout";

export default function Disclaimer() {
  return (
    <Layout>
      <div className="container max-w-3xl py-12 space-y-10">
        <h1 className="text-3xl font-bold text-cheese">Clause</h1>
        <p className="text-sm text-muted-foreground">Last updated: March 2025</p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">1. General Clause</h2>
          <p className="text-muted-foreground leading-relaxed">
            CHEESEHub is a community-built interface that provides access to decentralised applications and smart contracts on the WAX blockchain. The information presented on this platform is for general informational purposes only and does not constitute financial, legal, tax, or investment advice. No representation or warranty, express or implied, is made regarding the accuracy, completeness, or reliability of any content on this platform. Use of CHEESEHub is entirely at your own risk.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">2. Nature of CHEESE</h2>
          <p className="text-muted-foreground leading-relaxed">
            CHEESE is a memecoin — a cryptocurrency token created primarily for entertainment and community engagement. It has no intrinsic value, is not backed by any asset or reserve, and carries no promise of return. CHEESE is governed by a decentralised autonomous organisation (DAO) with members located in countries around the world. Any member of the DAO may, propose, vote on and even execute proposals should they pass. CHEESE is not intended to be, and should not be treated as, a security, financial product, investment contract, or regulated instrument under the laws of any jurisdiction.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            CHEESE was not issued through an initial coin offering (ICO), token sale, fundraising event, or any mechanism designed to raise capital for a commercial enterprise. The token does not represent equity, debt, a share of profits, or any contractual right against any person or entity. There is no expectation that the efforts of any individual, team, or issuer will generate returns for token holders — the token contract is immutable and no party has the ability to influence its supply, functionality, or value.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">3. Immutable Token Contract</h2>
          <p className="text-muted-foreground leading-relaxed">
            The CHEESE token is issued by the <code className="text-cheese">cheeseburger</code> smart contract on the WAX blockchain. The owner and active keys of this contract have been permanently nulled to <code className="text-cheese">eosio.null</code>, rendering the contract immutable. This means no individual, group, or entity — including the CHEESE DAO — has the ability to modify, upgrade, pause, or otherwise alter the contract's code or behaviour. No new tokens can be minted beyond the fixed maximum supply, and no tokens can be frozen, seized, or blacklisted. While immutability provides transparency and resistance to tampering, it also means that any bugs, vulnerabilities, or unintended behaviour in the contract cannot be patched or corrected.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">4. Open-Source Software &amp; Public Hosting</h2>
          <p className="text-muted-foreground leading-relaxed">
            CHEESEHub is open-source software hosted publicly on GitHub. The entire source code of this frontend interface is freely available for inspection, review, and audit by any member of the public. CHEESEHub does not operate as a proprietary platform or commercial service — it is a community-maintained codebase that serves as an interface to independently deployed smart contracts on the WAX blockchain.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            All smart contracts accessible through CHEESEHub — including but not limited to <code className="text-cheese">cheeseburger</code>, <code className="text-cheese">cheesefeefee</code>, <code className="text-cheese">cheesebannad</code>, and <code className="text-cheese">cheeseamphub</code> — are deployed on the WAX blockchain and their source code is publicly available and auditable on-chain. Smart contracts on the WAX blockchain are inherently transparent; any user can independently verify the logic, permissions, and behaviour of any contract before interacting with it.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            While open-source transparency allows for public scrutiny and community-driven security review, it does not constitute a formal security audit. Open-source software is provided without warranty, and no guarantee is made that the code is free from bugs, vulnerabilities, or exploits. Users interact with all smart contracts and this interface entirely at their own risk, and are encouraged to conduct their own independent review of both the frontend code and any on-chain contracts before use.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">5. Financial Services</h2>
          <p className="text-muted-foreground leading-relaxed">
            CHEESEHub does not hold a financial services licence, authorisation, or registration in any jurisdiction. The platform is not regulated or supervised by any financial regulator, securities commission, or government authority. CHEESEHub does not provide financial product advice, deal in financial products, or operate as a financial services provider. Any interaction with tokens, smart contracts, or blockchain protocols through this platform is conducted on a peer-to-peer, permissionless basis. At no time does CHEESEHub have custody of your assets nor your private keys. CHEESEWallet is merely an interface for your ACTUAL wallet (Anchor Greymass or WAX Cloud Wallet). All performable actions are actionable directly from these interfaces.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">6. No Dealing, Advising or Market Making</h2>
          <p className="text-muted-foreground leading-relaxed">
            CHEESEHub does not deal in digital assets, arrange for any person to deal in digital assets, make a market for digital assets, operate a financial market or exchange, or provide financial product advice of any kind. The platform is a passive, read-only interface that displays publicly available blockchain data and allows users to construct and sign their own transactions through their own wallets.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Features such as staking, farming, token locking, and NFT drops are direct interactions between the user and independently deployed smart contracts on the WAX blockchain. CHEESEHub does not intermediate, execute, settle, or arrange these transactions. The user initiates and signs every action through their own wallet provider — CHEESEHub merely renders the interface. Any price information displayed on the platform is sourced from publicly available on-chain data and third-party decentralised exchanges (such as Alcor Exchange) for informational purposes only. Price displays do not constitute a recommendation, forecast, or representation about the future value or performance of any digital asset.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">7. Tax Obligations</h2>
          <p className="text-muted-foreground leading-relaxed">
            The tax treatment of cryptocurrency and digital assets varies by jurisdiction. In many countries, crypto assets are treated as property, commodities, or taxable assets, and transactions involving them — including buying, selling, swapping, staking, or receiving rewards — may give rise to capital gains tax, income tax, goods and services tax, or other tax obligations. You are solely responsible for determining your own tax obligations, reporting all relevant transactions to the appropriate tax authority, and maintaining adequate records. CHEESEHub does not provide tax advice. You should consult a qualified tax professional in your jurisdiction before engaging in any cryptocurrency transactions.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">8. International Users</h2>
          <p className="text-muted-foreground leading-relaxed">
            CHEESEHub is accessible globally but makes no representation that its content or services are appropriate or available for use in any particular jurisdiction. Users are responsible for ensuring that their use of CHEESEHub complies with all applicable local, national, and international laws and regulations. If the use of this platform or any associated tokens is prohibited or restricted in your jurisdiction, you must not use them.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">9. Risk Warnings</h2>
          <ul className="list-disc list-inside text-muted-foreground leading-relaxed space-y-2">
            <li>Cryptocurrency markets are extremely volatile. The value of CHEESE and other tokens can fluctuate dramatically and may fall to zero.</li>
            <li>Smart contracts may contain bugs, vulnerabilities, or exploits that could result in the partial or total loss of funds. All smart contracts are auditable on chain and you are obligated to do your own research.</li>
            <li>Transactions on the blockchain are irreversible. There is no central authority, bank, or institution that can reverse or refund a transaction.</li>
            <li>There is no deposit protection, insurance, or compensation scheme covering crypto assets on the WAX Blockchain.</li>
            <li>Past performance is not indicative of future results. You should never invest more than you can afford to lose.</li>
            <li>If you are inexperienced with blockchain or decentralised protocols, it is recommended that you proceed with extreme caution and even ask for help in the appropriate channels.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">9. Liability</h2>
          <p className="text-muted-foreground leading-relaxed">
            To the fullest extent permitted by applicable law, the owner of this website, the CHEESE DAO, its contributors, members, developers, and any individuals or entities associated with the development or maintenance of CHEESEHub accept no liability for any direct, indirect, incidental, consequential, or punitive damages arising from the use of this platform, the CHEESE token, or any associated smart contracts. This includes, but is not limited to, loss of funds, loss of profits, loss of data, or any other losses howsoever arising.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">10. Not Professional Advice</h2>
          <p className="text-muted-foreground leading-relaxed">
            Nothing on CHEESEHub constitutes legal, financial, tax, accounting, or investment advice. Before making any decisions related to cryptocurrency, you should seek independent professional advice from a qualified adviser licensed in your jurisdiction. Do not rely solely on information provided by this platform when making financial or tax decisions.
          </p>
        </section>
      </div>
    </Layout>
  );
}