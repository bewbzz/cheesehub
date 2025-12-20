import { SessionKit, Chains } from '@wharfkit/session';
import { WebRenderer } from '@wharfkit/web-renderer';
import { WalletPluginAnchor } from '@wharfkit/wallet-plugin-anchor';
import { WalletPluginCloudWallet } from '@wharfkit/wallet-plugin-cloudwallet';

// Initialize the WebRenderer for wallet selection UI
const webRenderer = new WebRenderer();

// Create SessionKit with both wallet plugins
export const sessionKit = new SessionKit({
  appName: 'CHEESEHub',
  chains: [Chains.WAX],
  ui: webRenderer,
  walletPlugins: [
    new WalletPluginAnchor(),
    new WalletPluginCloudWallet(),
  ],
});

export { webRenderer };
