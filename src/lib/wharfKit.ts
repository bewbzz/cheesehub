import { SessionKit, ChainDefinition } from '@wharfkit/session';
import { WebRenderer } from '@wharfkit/web-renderer';
import { WalletPluginAnchor } from '@wharfkit/wallet-plugin-anchor';
import { WalletPluginCloudWallet } from '@wharfkit/wallet-plugin-cloudwallet';

// Initialize the WebRenderer for wallet selection UI
const webRenderer = new WebRenderer();

// Define WAX mainnet with a more reliable primary RPC endpoint
const waxChain = ChainDefinition.from({
  id: '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4',
  url: 'https://wax.eosusa.io',
});

// Create SessionKit with both wallet plugins
export const sessionKit = new SessionKit({
  appName: 'CHEESEHub',
  chains: [waxChain],
  ui: webRenderer,
  walletPlugins: [
    new WalletPluginAnchor(),
    new WalletPluginCloudWallet(),
  ],
});

// Utility to close any stuck Wharfkit modals - more aggressive cleanup
export function closeWharfkitModals() {
  // Remove any Wharfkit modal elements from the DOM (multiple selectors for thoroughness)
  const modalSelectors = [
    'wharf-modal',
    '.wharf-modal',
    '[class*="wharfkit"]',
    '[class*="wharf-"]',
    'wharfkit-modal',
    '.wharfkit-modal',
    '[data-wharfkit]',
    // WebRenderer specific elements
    '.prompt-modal',
    '.prompt-overlay',
    '[class*="prompt-"]',
    // Anchor wallet modals
    '[class*="anchor-link"]',
    '.anchor-link-modal',
    'anchor-link',
    // Common modal patterns
    '[role="dialog"]',
  ];
  
  modalSelectors.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        // Don't remove Radix dialogs (our own modals)
        if (!el.closest('[data-radix-portal]') && !el.hasAttribute('data-radix-portal')) {
          el.remove();
        }
      });
    } catch (e) {
      // Ignore invalid selectors
    }
  });
  
  // Remove any fixed/absolute positioned overlays that might be blocking
  document.querySelectorAll('body > div').forEach(el => {
    const style = window.getComputedStyle(el);
    if (
      (style.position === 'fixed' || style.position === 'absolute') &&
      style.zIndex && parseInt(style.zIndex) > 9000 &&
      el.id !== 'root' &&
      !el.closest('[data-radix-portal]') &&
      !el.hasAttribute('data-radix-portal')
    ) {
      // Check if it looks like a wallet modal (dark overlay or modal-like)
      if (style.backgroundColor?.includes('rgba') || el.querySelector('[class*="modal"]') || el.querySelector('[class*="anchor"]')) {
        el.remove();
      }
    }
  });
  
  // Target Anchor Link web component specifically
  const anchorElements = document.querySelectorAll('anchor-link, anchor-link-browser-transport');
  anchorElements.forEach(el => el.remove());
  
  // Reset body scroll if it was locked
  document.body.style.overflow = '';
  document.body.style.pointerEvents = '';
  document.body.style.position = '';
  document.body.classList.remove('overflow-hidden', 'modal-open');
  document.documentElement.style.overflow = '';
  document.documentElement.style.pointerEvents = '';
  
  // Also clean up any shadow DOM elements from web components
  document.querySelectorAll('*').forEach(el => {
    if (el.shadowRoot) {
      // Try to find and click close buttons in shadow DOM
      const closeButtons = el.shadowRoot.querySelectorAll('button[class*="close"], [class*="close"], .x-button, [aria-label="Close"]');
      closeButtons.forEach(btn => {
        try {
          (btn as HTMLElement).click();
        } catch (e) {}
      });
      
      const shadowModals = el.shadowRoot.querySelectorAll('[class*="modal"], [class*="overlay"], [class*="dialog"]');
      shadowModals.forEach(modal => {
        try {
          modal.remove();
        } catch (e) {
          // Shadow DOM might not allow removal
        }
      });
      
      // If the host element itself looks like a modal wrapper, remove it
      if (el.tagName.toLowerCase().includes('anchor') || el.tagName.toLowerCase().includes('wharf')) {
        el.remove();
      }
    }
  });
  
  // Run cleanup again after a small delay to catch async-rendered elements
  setTimeout(() => {
    document.querySelectorAll('anchor-link, anchor-link-browser-transport, [class*="anchor-link"]').forEach(el => el.remove());
    document.body.style.overflow = '';
    document.body.style.pointerEvents = '';
  }, 100);
}

export { webRenderer };
