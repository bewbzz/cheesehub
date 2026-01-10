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

// Function to ensure WharfKit modals are always on top with proper pointer events
export function ensureModalOnTop() {
  const wharfkitEl = document.getElementById('wharfkit-web-ui');
  if (wharfkitEl) {
    // Use setProperty with 'important' to override any CSS rules
    wharfkitEl.style.setProperty('z-index', '999999', 'important');
    wharfkitEl.style.setProperty('position', 'fixed', 'important');
    wharfkitEl.style.setProperty('top', '0', 'important');
    wharfkitEl.style.setProperty('left', '0', 'important');
    wharfkitEl.style.setProperty('width', '100vw', 'important');
    wharfkitEl.style.setProperty('height', '100vh', 'important');
    wharfkitEl.style.setProperty('pointer-events', 'auto', 'important');
    
    // Inject styles into shadow DOM to fix z-index and pointer-events
    if (wharfkitEl.shadowRoot) {
      const dialog = wharfkitEl.shadowRoot.querySelector('dialog');
      if (dialog) {
        (dialog as HTMLElement).style.setProperty('z-index', '999999', 'important');
        (dialog as HTMLElement).style.setProperty('position', 'fixed', 'important');
        (dialog as HTMLElement).style.setProperty('pointer-events', 'auto', 'important');
      }
      
      const backdrop = wharfkitEl.shadowRoot.querySelector('.backdrop, [class*="backdrop"]');
      if (backdrop) {
        (backdrop as HTMLElement).style.setProperty('z-index', '999998', 'important');
        (backdrop as HTMLElement).style.setProperty('pointer-events', 'auto', 'important');
      }
    }
  }
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
              // Apply z-index fix immediately when modal appears using setProperty for priority
              node.style.setProperty('z-index', '999999', 'important');
              node.style.setProperty('position', 'fixed', 'important');
              node.style.setProperty('top', '0', 'important');
              node.style.setProperty('left', '0', 'important');
              node.style.setProperty('width', '100vw', 'important');
              node.style.setProperty('height', '100vh', 'important');
              node.style.setProperty('pointer-events', 'auto', 'important');
              
              // Watch for shadow DOM content
              const checkShadow = () => {
                if (node.shadowRoot) {
                  const dialog = node.shadowRoot.querySelector('dialog');
                  if (dialog) {
                    (dialog as HTMLElement).style.setProperty('z-index', '999999', 'important');
                    (dialog as HTMLElement).style.setProperty('pointer-events', 'auto', 'important');
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
