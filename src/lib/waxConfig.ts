// WAX Mainnet Configuration
export const WAX_CHAIN = {
  id: '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4',
  url: 'https://wax.greymass.com',
};

// Your CHEESE project configuration
export const CHEESE_CONFIG = {
  collectionName: 'cheesenftwax',
  tokenContract: 'cheeseburger',
  paymentWallet: 'cheesenftwax',
  tokenSymbol: 'CHEESE',
  tokenPrecision: 4,
};

// NFT Hive Drop Contract Configuration
export const NFTHIVE_CONFIG = {
  dropContract: 'nfthivedrops',
  boostContract: 'nft.hive',
  apiUrl: 'https://wax-api.hivebp.io', // NFT Hive's own API
};

// AtomicAssets API endpoints
export const ATOMIC_API = {
  baseUrl: 'https://wax.api.atomicassets.io',
  endpoints: {
    sales: '/atomicmarket/v1/sales',
    templates: '/atomicassets/v1/templates',
    assets: '/atomicassets/v1/assets',
    collections: '/atomicassets/v1/collections',
  },
};

// WAX Block Explorer
export const WAX_EXPLORER = 'https://waxblock.io/transaction/';
