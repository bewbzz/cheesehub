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
  ];
  
  modalSelectors.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => el.remove());
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
      !el.closest('[data-radix-portal]')
    ) {
      // Check if it looks like a wallet modal (dark overlay or modal-like)
      if (style.backgroundColor?.includes('rgba') || el.querySelector('[class*="modal"]')) {
        el.remove();
      }
    }
  });
  
  // Reset body scroll if it was locked
  document.body.style.overflow = '';
  document.body.style.pointerEvents = '';
  document.body.style.position = '';
  document.body.classList.remove('overflow-hidden', 'modal-open');
  
  // Also clean up any shadow DOM elements from web components
  document.querySelectorAll('*').forEach(el => {
    if (el.shadowRoot) {
      const shadowModals = el.shadowRoot.querySelectorAll('[class*="modal"], [class*="overlay"]');
      shadowModals.forEach(modal => {
        try {
          modal.remove();
        } catch (e) {
          // Shadow DOM might not allow removal
        }
      });
    }
  });
}

// Function to ensure WharfKit modals are always on top
export function ensureModalOnTop() {
  const wharfkitEl = document.getElementById('wharfkit-web-ui');
  if (wharfkitEl) {
    wharfkitEl.style.zIndex = '999999';
    wharfkitEl.style.position = 'fixed';
    
    // Also check shadow DOM for the dialog
    if (wharfkitEl.shadowRoot) {
      const dialog = wharfkitEl.shadowRoot.querySelector('dialog');
      if (dialog) {
        (dialog as HTMLElement).style.zIndex = '999999';
      }
    }
  }
}

// Auto-elevate WharfKit modals when they appear in the DOM
if (typeof window !== 'undefined') {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          if (node.id === 'wharfkit-web-ui' || node.id?.startsWith('wharfkit')) {
            node.style.zIndex = '999999';
            node.style.position = 'fixed';
          }
        }
      }
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
}

export { webRenderer };
