/**
 * Mint with Backing utilities
 * Allows minting new NFTs from templates with tokens (CHEESE, WAX, etc.) locked inside
 * Uses native atomicassets::mintasset with tokens_to_back parameter
 */

import { fetchWithFallback } from './fetchWithFallback';
import { ATOMIC_API } from './waxConfig';
import { fetchTableRows } from './waxRpcFallback';

// ============================================================================
// TYPES
// ============================================================================

export interface CollectionInfo {
  collection_name: string;
  author: string;
  authorized_accounts: string[];
  notify_accounts: string[];
  market_fee: number;
  data: Record<string, unknown>;
}

export interface TemplateInfo {
  template_id: string;
  collection_name: string;
  schema_name: string;
  name: string;
  image: string;
  max_supply: number;
  issued_supply: number;
  is_transferable: boolean;
  is_burnable: boolean;
}

export interface MintWithBackingConfig {
  collectionName: string;
  schemaName: string;
  templateId: number;
  recipient: string;
  quantity: number; // Number of NFTs to mint (1-50)
  tokenSymbol: string;
  tokenContract: string;
  tokenPrecision: number;
  amountPerNFT: number;
}

// ============================================================================
// FETCH FUNCTIONS
// ============================================================================

/**
 * Fetch collections where user is authorized to mint
 */
export async function fetchMintableCollections(accountName: string): Promise<CollectionInfo[]> {
  try {
    // Fetch from AtomicAssets API - collections where user is authorized
    const params = new URLSearchParams({
      authorized_account: accountName,
      order: 'desc',
      sort: 'created',
      limit: '100',
    });
    const path = `/atomicassets/v1/collections?${params.toString()}`;

    const response = await fetchWithFallback(ATOMIC_API.baseUrls, path);
    const json = await response.json();

    if (!json.success || !json.data) {
      console.error('Failed to fetch collections:', json);
      return [];
    }

    return json.data.map((col: any) => ({
      collection_name: col.collection_name,
      author: col.author,
      authorized_accounts: col.authorized_accounts || [],
      notify_accounts: col.notify_accounts || [],
      market_fee: parseFloat(col.market_fee) || 0,
      data: col.data || {},
    }));
  } catch (error) {
    console.error('Error fetching mintable collections:', error);
    return [];
  }
}

/**
 * Fetch templates for a collection
 */
export async function fetchCollectionTemplates(collectionName: string): Promise<TemplateInfo[]> {
  try {
    const params = new URLSearchParams({
      collection_name: collectionName,
      order: 'desc',
      sort: 'created',
      limit: '200',
    });
    const path = `/atomicassets/v1/templates?${params.toString()}`;

    const response = await fetchWithFallback(ATOMIC_API.baseUrls, path);
    const json = await response.json();

    if (!json.success || !json.data) {
      console.error('Failed to fetch templates:', json);
      return [];
    }

    return json.data.map((template: any) => {
      const data = template.immutable_data || {};
      const maxSupply = parseInt(template.max_supply) || 0;
      const issuedSupply = parseInt(template.issued_supply) || 0;

      return {
        template_id: template.template_id,
        collection_name: template.collection?.collection_name || collectionName,
        schema_name: template.schema?.schema_name || '',
        name: data.name || `Template #${template.template_id}`,
        image: getImageUrl(data.img || data.image || ''),
        max_supply: maxSupply,
        issued_supply: issuedSupply,
        is_transferable: template.is_transferable !== false,
        is_burnable: template.is_burnable !== false,
      };
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return [];
  }
}

// ============================================================================
// ACTION BUILDERS
// ============================================================================

/**
 * Format token amount with correct precision
 */
export function formatTokenAmount(
  amount: number,
  precision: number,
  symbol: string
): string {
  return `${amount.toFixed(precision)} ${symbol}`;
}

/**
 * Build the actions needed to mint NFTs with token backing
 * Transaction flow:
 * 1. announcedepo - Prepare deposit slot for the token symbol
 * 2. transfer - Send total tokens to atomicassets with memo "deposit"
 * 3. mintasset (x quantity) - Mint each NFT with tokens_to_back parameter
 */
export function buildMintWithBackingActions(
  owner: string,
  config: MintWithBackingConfig,
  permissionLevel: { actor: { toString: () => string }; permission: { toString: () => string } }
) {
  const { tokenSymbol, tokenContract, tokenPrecision, amountPerNFT, quantity } = config;
  
  const totalAmount = amountPerNFT * quantity;
  const totalQuantity = formatTokenAmount(totalAmount, tokenPrecision, tokenSymbol);
  const perNftQuantity = formatTokenAmount(amountPerNFT, tokenPrecision, tokenSymbol);
  
  // Symbol format for announcedepo: "precision,SYMBOL"
  const symbolToAnnounce = `${tokenPrecision},${tokenSymbol}`;

  const actions = [];

  // 1. Announce deposit for the token symbol
  actions.push({
    account: 'atomicassets',
    name: 'announcedepo',
    authorization: [permissionLevel],
    data: {
      owner,
      symbol_to_announce: symbolToAnnounce,
    },
  });

  // 2. Transfer total tokens to atomicassets with memo "deposit"
  actions.push({
    account: tokenContract,
    name: 'transfer',
    authorization: [permissionLevel],
    data: {
      from: owner,
      to: 'atomicassets',
      quantity: totalQuantity,
      memo: 'deposit',
    },
  });

  // 3. Mint each NFT with tokens_to_back
  for (let i = 0; i < quantity; i++) {
    actions.push({
      account: 'atomicassets',
      name: 'mintasset',
      authorization: [permissionLevel],
      data: {
        authorized_minter: owner,
        collection_name: config.collectionName,
        schema_name: config.schemaName,
        template_id: config.templateId,
        new_asset_owner: config.recipient,
        immutable_data: [],
        mutable_data: [],
        tokens_to_back: [perNftQuantity],
      },
    });
  }

  return actions;
}

/**
 * Validate mint configuration
 */
export function validateMintConfig(config: MintWithBackingConfig): string | null {
  if (!config.collectionName) {
    return 'Please select a collection';
  }
  if (!config.templateId || config.templateId <= 0) {
    return 'Please select a template';
  }
  if (!config.schemaName) {
    return 'Schema name is missing';
  }
  if (config.quantity <= 0 || config.quantity > 50) {
    return 'Quantity must be between 1 and 50';
  }
  if (!config.recipient) {
    return 'Recipient address is required';
  }
  if (config.amountPerNFT <= 0) {
    return 'Amount per NFT must be greater than 0';
  }
  if (!config.tokenSymbol) {
    return 'Please select a token';
  }
  if (!config.tokenContract) {
    return 'Token contract is required';
  }
  if (config.tokenPrecision < 0 || config.tokenPrecision > 18) {
    return 'Token precision must be between 0 and 18';
  }
  return null;
}

// ============================================================================
// HELPERS
// ============================================================================

const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
];

function getImageUrl(img: string): string {
  if (!img) return '/placeholder.svg';
  
  if (img.startsWith('http://') || img.startsWith('https://')) {
    return img;
  }
  
  if (img.startsWith('ipfs://')) {
    const hash = img.replace('ipfs://', '');
    return `${IPFS_GATEWAYS[0]}${hash}`;
  }
  
  if (img.startsWith('Qm') || img.startsWith('bafy') || img.startsWith('bafk')) {
    return `${IPFS_GATEWAYS[0]}${img}`;
  }
  
  if (img.startsWith('/ipfs/')) {
    return `https://ipfs.io${img}`;
  }
  
  if (/^[a-zA-Z0-9]{46,}$/.test(img)) {
    return `${IPFS_GATEWAYS[0]}${img}`;
  }
  
  return img || '/placeholder.svg';
}
