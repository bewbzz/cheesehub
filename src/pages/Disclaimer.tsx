import { Layout } from "@/components/Layout";

export default function Disclaimer() {
  return (
    <Layout>
      <div className="container max-w-3xl py-12 space-y-10">
        <h1 className="text-3xl font-bold text-cheese">Disclaimer</h1>
        <p className="text-sm text-muted-foreground">Last updated: March 2025</p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">1. General Disclaimer</h2>
          <p className="text-muted-foreground leading-relaxed">
            CHEESEHub is a community-built interface that provides access to decentralised applications and smart contracts on the WAX blockchain. The information presented on this platform is for general informational purposes only and does not constitute financial, legal, tax, or investment advice. No representation or warranty, express or implied, is made regarding the accuracy, completeness, or reliability of any content on this platform. Use of CHEESEHub is entirely at your own risk.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">2. Immutable Token Contract</h2>
          <p className="text-muted-foreground leading-relaxed">
            The CHEESE token is issued by the <code className="text-cheese">cheeseburger</code> smart contract on the WAX blockchain. The owner and active keys of this contract have been permanently nulled to <code className="text-cheese">eosio.null</code>, rendering the contract immutable. This means no individual, group, or entity — including the CHEESE DAO — has the ability to modify, upgrade, pause, or otherwise alter the contract's code or behaviour. No new tokens can be minted beyond the fixed maximum supply, and no tokens can be frozen, seized, or blacklisted. While immutability provides transparency and resistance to tampering, it also means that any bugs, vulnerabilities, or unintended behaviour in the contract cannot be patched or corrected.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">3. Nature of CHEESE</h2>
          <p className="text-muted-foreground leading-relaxed">
            CHEESE is a memecoin — a cryptocurrency token created primarily for entertainment and community engagement. It has no intrinsic value, is not backed by any asset or reserve, and carries no promise of return. CHEESE is governed by a decentralised autonomous organisation (DAO) with members located in countries around the world. CHEESE is not intended to be, and should not be treated as, a security, financial product, investment contract, or regulated instrument under the laws of any jurisdiction.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">4. Financial Services</h2>
          <p className="text-muted-foreground leading-relaxed">
            CHEESEHub does not hold a financial services licence, authorisation, or registration in any jurisdiction. The platform is not regulated or supervised by any financial regulator, securities commission, or government authority. CHEESEHub does not provide financial product advice, deal in financial products, or operate as a financial services provider. Any interaction with tokens, smart contracts, or blockchain protocols through this platform is conducted on a peer-to-peer, permissionless basis.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">5. Tax Obligations</h2>
          <p className="text-muted-foreground leading-relaxed">
            The tax treatment of cryptocurrency and digital assets varies by jurisdiction. In many countries, crypto assets are treated as property, commodities, or taxable assets, and transactions involving them — including buying, selling, swapping, staking, or receiving rewards — may give rise to capital gains tax, income tax, goods and services tax, or other tax obligations. You are solely responsible for determining your own tax obligations, reporting all relevant transactions to the appropriate tax authority, and maintaining adequate records. CHEESEHub does not provide tax advice. You should consult a qualified tax professional in your jurisdiction before engaging in any cryptocurrency transactions.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">6. International Users</h2>
          <p className="text-muted-foreground leading-relaxed">
            CHEESEHub is accessible globally but makes no representation that its content or services are appropriate or available for use in any particular jurisdiction. Users are responsible for ensuring that their use of CHEESEHub complies with all applicable local, national, and international laws and regulations. If the use of this platform or any associated tokens is prohibited or restricted in your jurisdiction, you must not use them.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">7. Risk Warnings</h2>
          <ul className="list-disc list-inside text-muted-foreground leading-relaxed space-y-2">
            <li>Cryptocurrency markets are extremely volatile. The value of CHEESE and other tokens can fluctuate dramatically and may fall to zero.</li>
            <li>Smart contracts may contain bugs, vulnerabilities, or exploits that could result in the partial or total loss of funds. All smart contracts are auditable on chain and you are obligated to do your own research.</li>
            <li>Transactions on the blockchain are irreversible. There is no central authority, bank, or institution that can reverse or refund a transaction.</li>
            <li>There is no deposit protection, insurance, or compensation scheme covering crypto assets on the WAX Blockchain.</li>
            <li>Past performance is not indicative of future results. You should never invest more than you can afford to lose.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">8. No Liability</h2>
          <p className="text-muted-foreground leading-relaxed">
            To the fullest extent permitted by applicable law, the owner of this website, the CHEESE DAO, its contributors, members, developers, and any individuals or entities associated with the development or maintenance of CHEESEHub accept no liability for any direct, indirect, incidental, consequential, or punitive damages arising from the use of this platform, the CHEESE token, or any associated smart contracts. This includes, but is not limited to, loss of funds, loss of profits, loss of data, or any other losses howsoever arising.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">9. Not Professional Advice</h2>
          <p className="text-muted-foreground leading-relaxed">
            Nothing on CHEESEHub constitutes legal, financial, tax, accounting, or investment advice. Before making any decisions related to cryptocurrency, you should seek independent professional advice from a qualified adviser licensed in your jurisdiction. Do not rely solely on information provided by this platform when making financial or tax decisions.
          </p>
        </section>
      </div>
    </Layout>
  );
}