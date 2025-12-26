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

// Utility to close any stuck Wharfkit modals
export function closeWharfkitModals() {
  // Remove any Wharfkit modal elements from the DOM
  const modals = document.querySelectorAll('wharf-modal, .wharf-modal, [class*="wharfkit"]');
  modals.forEach((modal) => modal.remove());
  
  // Also try to remove any overlay/backdrop elements
  const overlays = document.querySelectorAll('.wharf-overlay, [class*="wharfkit-overlay"]');
  overlays.forEach((overlay) => overlay.remove());
  
  // Reset body scroll if it was locked
  document.body.style.overflow = '';
  document.body.style.pointerEvents = '';
}

export { webRenderer };
