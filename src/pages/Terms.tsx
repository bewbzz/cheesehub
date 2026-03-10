import { Layout } from "@/components/Layout";

export default function Terms() {
  return (
    <Layout>
      <div className="container max-w-3xl py-12 space-y-10">
        <h1 className="text-3xl font-bold text-cheese">Terms of Use</h1>
        <p className="text-sm text-muted-foreground">Last updated: March 2025</p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">1. Acceptance of Terms</h2>
          <p className="text-muted-foreground leading-relaxed">
            By accessing or using CHEESEHub, you agree to be bound by these Terms of Use. If you do not agree with any part of these terms, you must not access or use the platform. Your continued use of CHEESEHub constitutes your acceptance of these terms as they may be updated from time to time.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">2. Platform Description</h2>
          <p className="text-muted-foreground leading-relaxed">
            CHEESEHub is a community-built frontend interface that provides access to decentralised applications and smart contracts deployed on the WAX blockchain. CHEESEHub is not a custodial service, does not hold or control user funds, and does not have the ability to execute, reverse, or modify any blockchain transaction on behalf of any user. All interactions with smart contracts are initiated and signed directly by the user through their own blockchain wallet.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">3. Immutable Token Contract</h2>
          <p className="text-muted-foreground leading-relaxed">
            The CHEESE token is issued by the <code className="text-cheese">cheeseburger</code> smart contract on the WAX blockchain, whose owner and active keys have been permanently nulled to <code className="text-cheese">eosio.null</code>. This renders the contract immutable — it cannot be modified, upgraded, paused, or controlled by any party. No new tokens can be minted beyond the fixed maximum supply, and no tokens can be frozen or seized. You acknowledge that immutability means any bugs or unintended behaviour in the contract cannot be patched, and you accept this risk by using the platform.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">4. Open-Source Software &amp; Transparency</h2>
          <p className="text-muted-foreground leading-relaxed">
            CHEESEHub is open-source software with its complete source code publicly hosted on GitHub. You acknowledge that: (a) the platform is a community-maintained codebase and not a proprietary commercial product; (b) all smart contracts accessible through CHEESEHub are deployed on the WAX blockchain with publicly available and on-chain auditable source code; (c) open-source availability does not constitute a formal security audit, and no guarantee is made that the code is free from bugs or vulnerabilities; and (d) you are responsible for independently reviewing any code — both frontend and on-chain contracts — before interacting with it. Any individual may fork, modify, or deploy their own instance of the CHEESEHub frontend independently.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">5. Eligibility</h2>
          <p className="text-muted-foreground leading-relaxed">
            You must be of legal age in your jurisdiction to use CHEESEHub. By using the platform, you represent and warrant that you meet this requirement. If the use of blockchain-based platforms, cryptocurrency, or digital assets is prohibited or restricted in your jurisdiction, you must not use CHEESEHub. It is your responsibility to ensure that your use of this platform complies with all applicable laws and regulations.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">5. User Responsibilities</h2>
          <ul className="list-disc list-inside text-muted-foreground leading-relaxed space-y-2">
            <li>You are solely responsible for the security of your blockchain wallet, private keys, and account credentials. CHEESEHub does not have access to your keys and cannot recover lost credentials.</li>
            <li>You are solely responsible for all transactions you initiate through the platform. All blockchain transactions are irreversible once confirmed.</li>
            <li>You are obligated to do your own research (DYOR) before interacting with any smart contract, token, NFT, or decentralised application accessible through CHEESEHub.</li>
            <li>You acknowledge that you understand the risks associated with blockchain technology, cryptocurrency, and decentralised finance.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">6. Intellectual Property</h2>
          <p className="text-muted-foreground leading-relaxed">
            The CHEESE branding, logo, and original site content are community and DAO-owned. Third-party content displayed on the platform — including but not limited to NFTs, collection logos, token symbols, and external media — belongs to their respective owners. CHEESEHub does not claim ownership of any user-generated or third-party content displayed through the interface.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">7. Prohibited Use</h2>
          <p className="text-muted-foreground leading-relaxed">
            You agree not to use CHEESEHub for any unlawful purpose or in any way that could damage, disable, or impair the platform. Prohibited activities include, but are not limited to:
          </p>
          <ul className="list-disc list-inside text-muted-foreground leading-relaxed space-y-2">
            <li>Engaging in any illegal activity, including money laundering, fraud, or financing of terrorism.</li>
            <li>Maliciously exploiting smart contracts, vulnerabilities, or bugs for personal gain or to cause harm to others.</li>
            <li>Attempting to disrupt, interfere with, or compromise the security or integrity of the platform or its underlying infrastructure.</li>
            <li>Using automated systems, bots, or scripts to interact with the platform in a manner that could degrade performance or availability for other users.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">8. Third-Party Services</h2>
          <p className="text-muted-foreground leading-relaxed">
            CHEESEHub may contain links to or integrations with third-party services, including but not limited to Alcor Exchange, AtomicHub, WaxDAO, NFTHive, and blockchain wallet providers. These third-party services are not operated or controlled by CHEESEHub. We are not responsible for the content, privacy policies, terms of service, availability, or practices of any third-party platforms. Your use of third-party services is at your own risk and subject to their respective terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">9. No Warranties</h2>
          <p className="text-muted-foreground leading-relaxed">
            CHEESEHub is provided on an "as is" and "as available" basis without warranties of any kind, whether express or implied. No guarantee is made regarding the uptime, accuracy, completeness, reliability, or availability of the platform or any content displayed on it. CHEESEHub may be modified, updated, interrupted, suspended, or discontinued at any time without notice or liability.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">10. Limitation of Liability</h2>
          <p className="text-muted-foreground leading-relaxed">
            To the fullest extent permitted by applicable law, the owner of this website, the CHEESE DAO, its contributors, members, developers, and any individuals or entities associated with the development or maintenance of CHEESEHub accept no liability for any direct, indirect, incidental, consequential, or punitive damages arising from your use of, or inability to use, the platform. This includes, but is not limited to, loss of funds, loss of profits, loss of data, or any other losses howsoever arising.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">11. Modifications to Terms</h2>
          <p className="text-muted-foreground leading-relaxed">
            These Terms of Use may be updated or modified at any time without prior notice. Changes will be effective immediately upon being published on this page. It is your responsibility to review these terms periodically. Your continued use of CHEESEHub after any modifications constitutes your acceptance of the updated terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">12. Governing Law</h2>
          <p className="text-muted-foreground leading-relaxed">
            These Terms of Use shall be governed by and construed in accordance with the applicable laws of the jurisdiction in which any dispute arises. Given the decentralised and global nature of the CHEESE DAO and the WAX blockchain, no specific jurisdiction is designated. Users are responsible for understanding and complying with the laws applicable to them in their own jurisdiction.
          </p>
        </section>
      </div>
    </Layout>
  );
}
