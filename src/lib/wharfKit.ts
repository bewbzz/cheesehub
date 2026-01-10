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

// Track if a login is in progress to avoid removing modal during login
let isLoginInProgress = false;

export function setLoginInProgress(value: boolean) {
  isLoginInProgress = value;
}

// Utility to close any stuck Wharfkit modals - more aggressive cleanup
export function closeWharfkitModals() {
  // Skip cleanup if login is in progress to prevent removing modal during wallet selection
  if (isLoginInProgress) {
    console.log('Skipping modal cleanup - login in progress');
    return;
  }

  // Remove any Wharfkit modal elements from the DOM (multiple selectors for thoroughness)
  // BUT be careful not to remove the main container if it's actively being used
  const wharfkitEl = document.getElementById('wharfkit-web-ui');
  
  // Only remove WharfKit container if it has no open dialog
  if (wharfkitEl) {
    const hasOpenDialog = wharfkitEl.shadowRoot?.querySelector('dialog[open]');
    if (!hasOpenDialog) {
      // Safe to remove - no active dialog
      wharfkitEl.remove();
    }
  }
  
  const modalSelectors = [
    'wharf-modal',
    '.wharf-modal',
    '[class*="wharfkit"]:not(#wharfkit-web-ui)',
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
      elements.forEach((el) => {
        // Don't remove the main wharfkit container
        if (el.id !== 'wharfkit-web-ui') {
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
      el.id !== 'wharfkit-web-ui' &&
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
  
  // Also clean up any shadow DOM elements from web components (but not the main WharfKit one)
  document.querySelectorAll('*').forEach(el => {
    if (el.shadowRoot && el.id !== 'wharfkit-web-ui') {
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
if (typeof window !== 'undefined') {
  const initObserver = () => {
    if (!document.body) {
      setTimeout(initObserver, 50);
      return;
    }
    
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            if (node.id === 'wharfkit-web-ui' || node.id?.startsWith('wharfkit')) {
              // Ensure high z-index and full interactivity
              node.style.setProperty('z-index', '999999', 'important');
              node.style.setProperty('position', 'fixed', 'important');
              node.style.setProperty('pointer-events', 'auto', 'important');
              
              // Style shadow DOM elements
              const styleShadowDOM = () => {
                if (node.shadowRoot) {
                  // Style the dialog
                  const dialog = node.shadowRoot.querySelector('dialog');
                  if (dialog) {
                    (dialog as HTMLElement).style.setProperty('z-index', '999999', 'important');
                    (dialog as HTMLElement).style.setProperty('pointer-events', 'auto', 'important');
                  }
                  // Style all interactive elements inside shadow DOM
                  node.shadowRoot.querySelectorAll('button, a, input, [role="button"]').forEach(el => {
                    (el as HTMLElement).style.setProperty('pointer-events', 'auto', 'important');
                  });
                }
              };
              
              styleShadowDOM();
              setTimeout(styleShadowDOM, 50);
              setTimeout(styleShadowDOM, 150);
              setTimeout(styleShadowDOM, 300);
              setTimeout(styleShadowDOM, 500);
            }
          }
        }
        
        // Cleanup when modal is removed
        for (const node of mutation.removedNodes) {
          if (node instanceof HTMLElement && (node.id === 'wharfkit-web-ui' || node.id?.startsWith('wharfkit'))) {
            document.querySelectorAll('[data-radix-portal]').forEach(el => {
              (el as HTMLElement).style.pointerEvents = '';
            });
          }
        }
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
  };
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initObserver, 100));
  } else {
    setTimeout(initObserver, 100);
  }
}

export { webRenderer };
