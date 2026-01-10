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
    '#wharfkit-web-ui',
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
  
  // Restore pointer events on Radix portals
  document.querySelectorAll('[data-radix-portal], [role="dialog"]').forEach(el => {
    (el as HTMLElement).style.pointerEvents = '';
  });
  
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

// Function to ensure WharfKit modals are always on top (z-index only, no pointer-events manipulation)
export function ensureModalOnTop() {
  const wharfkitEl = document.getElementById('wharfkit-web-ui');
  if (wharfkitEl) {
    wharfkitEl.style.zIndex = '999999';
    wharfkitEl.style.position = 'fixed';
    wharfkitEl.style.top = '0';
    wharfkitEl.style.left = '0';
    wharfkitEl.style.width = '100vw';
    wharfkitEl.style.height = '100vh';
    wharfkitEl.style.pointerEvents = 'auto';
    
    // Inject styles into shadow DOM to fix z-index
    if (wharfkitEl.shadowRoot) {
      const dialog = wharfkitEl.shadowRoot.querySelector('dialog');
      if (dialog) {
        (dialog as HTMLElement).style.zIndex = '999999';
        (dialog as HTMLElement).style.position = 'fixed';
        (dialog as HTMLElement).style.pointerEvents = 'auto';
      }
      
      const backdrop = wharfkitEl.shadowRoot.querySelector('.backdrop, [class*="backdrop"]');
      if (backdrop) {
        (backdrop as HTMLElement).style.zIndex = '999998';
        (backdrop as HTMLElement).style.pointerEvents = 'auto';
      }
    }
  }
  // NOTE: No longer disabling pointer-events on Radix elements - this was causing vote buttons to freeze
}

// Restore pointer events on Radix elements
export function restoreRadixPointerEvents() {
  document.querySelectorAll('[data-radix-portal], [role="dialog"]').forEach(el => {
    (el as HTMLElement).style.pointerEvents = '';
  });
}

// Auto-elevate WharfKit modals when they appear in the DOM
// Deferred initialization to avoid issues during React mount
if (typeof window !== 'undefined') {
  const initObserver = () => {
    // Only proceed if body exists
    if (!document.body) {
      setTimeout(initObserver, 50);
      return;
    }
    
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            if (node.id === 'wharfkit-web-ui' || node.id?.startsWith('wharfkit')) {
              // Apply z-index fix immediately when modal appears
              node.style.zIndex = '999999';
              node.style.position = 'fixed';
              node.style.top = '0';
              node.style.left = '0';
              node.style.width = '100vw';
              node.style.height = '100vh';
              node.style.pointerEvents = 'auto';
              
              // NOTE: No longer disabling Radix portal pointer events - this was breaking the UI
              
              // Watch for shadow DOM content
              const checkShadow = () => {
                if (node.shadowRoot) {
                  const dialog = node.shadowRoot.querySelector('dialog');
                  if (dialog) {
                    (dialog as HTMLElement).style.zIndex = '999999';
                    (dialog as HTMLElement).style.pointerEvents = 'auto';
                  }
                }
              };
              checkShadow();
              // Check again after a small delay in case shadow DOM loads later
              setTimeout(checkShadow, 100);
              setTimeout(checkShadow, 500);
            }
          }
        }
        
        // When WharfKit modal is removed, restore Radix pointer events
        for (const node of mutation.removedNodes) {
          if (node instanceof HTMLElement) {
            if (node.id === 'wharfkit-web-ui' || node.id?.startsWith('wharfkit')) {
              document.querySelectorAll('[data-radix-portal]').forEach(el => {
                (el as HTMLElement).style.pointerEvents = '';
              });
            }
          }
        }
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
  };
  
  // Defer observer initialization until after React has mounted
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Additional delay to ensure React has mounted
      setTimeout(initObserver, 100);
    });
  } else {
    // DOM already loaded, but still defer slightly
    setTimeout(initObserver, 100);
  }
}

export { webRenderer };
