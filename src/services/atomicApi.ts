import { ATOMIC_API, CHEESE_CONFIG, NFTHIVE_CONFIG } from '@/lib/waxConfig';
import { fetchWithFallback } from '@/lib/fetchWithFallback';
import type { NFTDrop, AtomicSale, AtomicTemplate, AtomicDrop, NFTHiveDrop, DropPrice } from '@/types/drop';

// Optimized IPFS gateways - CDN-backed first for speed
const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://nftstorage.link/ipfs/',
  'https://dweb.link/ipfs/',
  'https://ipfs.io/ipfs/',
];

// Get the primary IPFS gateway URL
function getIpfsUrl(hash: string): string {
  return `${IPFS_GATEWAYS[0]}${hash}`;
}

function getImageUrl(img: string | undefined): string {
  if (!img) return '/placeholder.svg';
  
  // Handle direct URLs (http/https)
  if (img.startsWith('http://') || img.startsWith('https://')) {
    return img;
  }
  
  // Handle IPFS protocol URLs (ipfs://...)
  if (img.startsWith('ipfs://')) {
    const hash = img.replace('ipfs://', '');
    return getIpfsUrl(hash);
  }
  
  // Handle IPFS hashes - CIDv0 (Qm...) and CIDv1 (bafy..., bafk...)
  if (img.startsWith('Qm') || img.startsWith('bafy') || img.startsWith('bafk')) {
    return getIpfsUrl(img);
  }
  
  // Handle paths that might be relative IPFS paths
  if (img.startsWith('/ipfs/')) {
    return `https://ipfs.io${img}`;
  }
  
  // Fallback: assume it's an IPFS hash if it looks like one (starts with alphanumeric, 46+ chars)
  if (/^[a-zA-Z0-9]{46,}$/.test(img)) {
    return getIpfsUrl(img);
  }
  
  // Return as-is if we can't determine the format
  return img || '/placeholder.svg';
}

// Helper to split array into chunks
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Batch fetch multiple templates in a single API call.
 * Uses the AtomicAssets API `ids` parameter to fetch up to 100 templates per request.
 * This is ~50x faster than individual fetchTemplateById calls.
 */
export async function fetchTemplatesBatch(
  requests: { templateId: string; collectionName: string }[]
): Promise<Map<string, { name: string; image: string }>> {
  // Deduplicate requests
  const uniqueRequests = new Map<string, { templateId: string; collectionName: string }>();
  for (const req of requests) {
    const key = `${req.collectionName}:${req.templateId}`;
    uniqueRequests.set(key, req);
  }

  // Group by collection (API requires collection_name filter with ids)
  const byCollection = new Map<string, string[]>();
  for (const req of uniqueRequests.values()) {
    const ids = byCollection.get(req.collectionName) || [];
    ids.push(req.templateId);
    byCollection.set(req.collectionName, ids);
  }

  const results = new Map<string, { name: string; image: string }>();
  
  console.log(`[NFTHive Batch] Fetching templates for ${byCollection.size} collections, ${uniqueRequests.size} unique templates`);

  // Fetch each collection's templates in parallel (max 100 per request)
  await Promise.all(
    Array.from(byCollection.entries()).map(async ([collection, ids]) => {
      // Split into chunks of 100 if needed
      const chunks = chunkArray(ids, 100);
      
      for (const chunk of chunks) {
        try {
          const params = new URLSearchParams({
            collection_name: collection,
            ids: chunk.join(','),
            limit: '100',
          });
          const path = `${ATOMIC_API.paths.templates}?${params}`;
          const response = await fetchWithFallback(ATOMIC_API.baseUrls, path, undefined, 10000);
          const json = await response.json();

          if (json.success && json.data) {
            for (const template of json.data) {
              const data = template.immutable_data || {};
              const key = `${collection}:${template.template_id}`;
              results.set(key, {
                name: data.name || template.name || `Template #${template.template_id}`,
                image: getImageUrl(data.img || data.image),
              });
            }
          }
        } catch (error) {
          console.warn(`[NFTHive Batch] Failed to fetch templates for ${collection}:`, error);
        }
      }
    })
  );

  console.log(`[NFTHive Batch] Successfully fetched ${results.size} templates`);
  return results;
}

function extractRarity(data: Record<string, string>): string {
  const rarityKeys = ['rarity', 'Rarity', 'RARITY', 'tier', 'Tier'];
  for (const key of rarityKeys) {
    if (data[key]) return data[key];
  }
  return 'Common';
}

function buildAttributes(data: Record<string, string>): { trait: string; value: string }[] {
  const excludeKeys = ['name', 'img', 'video', 'description', 'image'];
  return Object.entries(data)
    .filter(([key]) => !excludeKeys.includes(key.toLowerCase()))
    .map(([trait, value]) => ({ trait, value: String(value) }))
    .slice(0, 6);
}

// Fetch active sales for your collection (marketplace listings)
export async function fetchActiveSales(): Promise<NFTDrop[]> {
  try {
    const params = new URLSearchParams({
      collection_name: CHEESE_CONFIG.collectionName,
      state: '1',
      order: 'desc',
      sort: 'created',
      limit: '50',
    });
    const path = `${ATOMIC_API.paths.sales}?${params.toString()}`;

    const response = await fetchWithFallback(ATOMIC_API.baseUrls, path);
    const json = await response.json();

    if (!json.success || !json.data) {
      console.error('Failed to fetch sales:', json);
      return [];
    }

    return (json.data as AtomicSale[]).map((sale): NFTDrop => {
      const asset = sale.assets[0];
      const data = { ...asset?.immutable_data, ...asset?.data };
      const template = asset?.template;

      return {
        id: sale.sale_id,
        saleId: sale.sale_id,
        templateId: template?.template_id,
        collectionName: sale.collection_name,
        name: data.name || asset?.name || `NFT #${sale.sale_id}`,
        description: data.description || 'A unique NFT from the Cheese collection',
        image: getImageUrl(data.img || data.image),
        price: parseFloat(sale.listing_price) / Math.pow(10, sale.price.token_precision),
        totalSupply: template ? parseInt(template.max_supply) || 1 : 1,
        remaining: template ? Math.max(0, parseInt(template.max_supply) - parseInt(template.issued_supply)) : 1,
        seller: sale.seller,
        attributes: [
          { trait: 'Rarity', value: extractRarity(data) },
          ...buildAttributes(data).slice(0, 5),
        ],
        dropSource: 'sale',
      };
    });
  } catch (error) {
    console.error('Error fetching sales:', error);
    return [];
  }
}

// Fetch templates for your collection (for drops created via AtomicHub drops)
export async function fetchTemplates(): Promise<NFTDrop[]> {
  try {
    const params = new URLSearchParams({
      collection_name: CHEESE_CONFIG.collectionName,
      has_assets: 'true',
      order: 'desc',
      sort: 'created',
      limit: '50',
    });
    const path = `${ATOMIC_API.paths.templates}?${params.toString()}`;

    const response = await fetchWithFallback(ATOMIC_API.baseUrls, path);
    const json = await response.json();

    if (!json.success || !json.data) {
      console.error('Failed to fetch templates:', json);
      return [];
    }

    return (json.data as AtomicTemplate[]).map((template): NFTDrop => {
      const data = template.immutable_data;
      const maxSupply = parseInt(template.max_supply) || 0;
      const issuedSupply = parseInt(template.issued_supply) || 0;

      return {
        id: template.template_id,
        templateId: template.template_id,
        collectionName: template.collection.collection_name,
        name: data.name || template.name || `Template #${template.template_id}`,
        description: data.description || 'A unique NFT from the Cheese collection',
        image: getImageUrl(data.img || data.image),
        price: 0,
        totalSupply: maxSupply,
        remaining: maxSupply > 0 ? Math.max(0, maxSupply - issuedSupply) : 0,
        attributes: [
          { trait: 'Rarity', value: extractRarity(data) },
          ...buildAttributes(data).slice(0, 5),
        ],
        dropSource: 'atomichub',
      };
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return [];
  }
}

// On-chain NFTHive drops table row type
interface OnChainNFTHiveDrop {
  drop_id: number;
  authorized_account: string;
  collection_name: string;
  assets_to_mint: Array<{
    template_id: number;
    tokens_to_back: unknown[];
    pool_id: number;
  }>;
  listing_price: string;
  settlement_symbol: string;
  price_recipient: string;
  fee_rate: string;
  auth_required: number;
  is_hidden: number;
  max_claimable: number;
  current_claimed: number;
  account_limit: number;
  account_limit_cooldown: number;
  start_time: number;
  end_time: number;
  display_data: string;
}

// On-chain dropprices table row type - contains array of all prices for a drop
interface OnChainDropPrice {
  drop_id: number;
  listing_prices: string[];  // Array like ["100.00000000 WAX", "1500.00000000 SQS", ...]
}

// Parse price string like "4.00 USD" or "5.90000000 LIMBO" into number and currency
function parseListingPrice(listingPrice: string): { price: number; currency: string } {
  const parts = listingPrice.trim().split(' ');
  if (parts.length >= 2) {
    return {
      price: parseFloat(parts[0]) || 0,
      currency: parts[1] || 'WAX',
    };
  }
  return { price: 0, currency: 'WAX' };
}

// Fetch all prices for a specific drop from dropprices table
// Each row has drop_id and listing_prices array containing all price options
async function fetchDropPrices(dropId: string | number): Promise<DropPrice[]> {
  try {
    const numericDropId = typeof dropId === 'string' ? parseInt(dropId) : dropId;
    
    // Query dropprices table with lower_bound to efficiently find our drop
    const response = await fetch('https://wax.eosusa.io/v1/chain/get_table_rows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        json: true,
        code: 'nfthivedrops',
        scope: 'nfthivedrops',
        table: 'dropprices',
        lower_bound: numericDropId.toString(),
        upper_bound: numericDropId.toString(),
        limit: 1,
      }),
    });
    
    const data = await response.json();
    const rows: OnChainDropPrice[] = data.rows || [];
    
    console.log(`[NFTHive] Drop ${numericDropId} dropprices row:`, rows);
    
    if (!rows.length || rows[0].drop_id !== numericDropId) {
      console.log(`[NFTHive] No dropprices entry for drop ${numericDropId}`);
      return [];
    }
    
    const priceRow = rows[0];
    
    // Parse all prices from the listing_prices array
    return priceRow.listing_prices.map((priceStr): DropPrice => {
      const { price, currency } = parseListingPrice(priceStr);
      return {
        price,
        currency,
        listingPrice: priceStr,
      };
    });
  } catch (error) {
    console.warn('[NFTHive] Failed to fetch drop prices:', error);
    return [];
  }
}

// Convert raw on-chain drop to NFTDrop with placeholder image
function rawDropToNFTDrop(drop: OnChainNFTHiveDrop): NFTDrop {
  const templateId = drop.assets_to_mint?.[0]?.template_id;
  const { price, currency } = parseListingPrice(drop.listing_price);

  // Parse display_data JSON
  let displayData: { name?: string; description?: string } = {};
  try {
    if (drop.display_data) {
      displayData = JSON.parse(drop.display_data);
    }
  } catch (e) {
    // Invalid JSON, ignore
  }

  const name = displayData.name || `Drop #${drop.drop_id}`;
  const description = displayData.description || 'A unique NFT drop';
  const maxClaimable = drop.max_claimable || 0;
  const remaining = Math.max(0, maxClaimable - drop.current_claimed);

  return {
    id: `nfthive-${drop.drop_id}`,
    dropId: String(drop.drop_id),
    templateId: templateId ? String(templateId) : undefined,
    collectionName: drop.collection_name,
    name,
    description,
    image: '/placeholder.svg', // Placeholder - will be enriched later
    price,
    totalSupply: maxClaimable,
    remaining,
    attributes: [{ trait: 'Rarity', value: 'Common' }],
    endDate: drop.end_time > 0 ? new Date(drop.end_time * 1000).toISOString() : undefined,
    dropSource: 'nfthive',
    settlementSymbol: drop.settlement_symbol,
    listingPrice: drop.listing_price,
    currency,
    authRequired: drop.auth_required === 1,
    isFree: price === 0,
    accountLimit: drop.account_limit || undefined,
  };
}

// Fetch raw drops from on-chain without template enrichment (fast)
export async function fetchRawDrops(collection?: string): Promise<NFTDrop[]> {
  try {
    const { fetchTableRows } = await import('@/lib/waxRpcFallback');

    let allDrops: OnChainNFTHiveDrop[] = [];
    let hasMore = true;
    let upperBound: string | undefined = undefined;
    const MAX_ITERATIONS = 10; // Safety limit (10,000 drops max)
    let iterations = 0;

    // Fetch all drops with pagination (newest first using reverse)
    while (hasMore && iterations < MAX_ITERATIONS) {
      const result = await fetchTableRows<OnChainNFTHiveDrop>({
        code: 'nfthivedrops',
        scope: 'nfthivedrops',
        table: 'drops',
        limit: 1000,
        reverse: true,
        ...(upperBound ? { upper_bound: upperBound } : {}),
      });

      allDrops.push(...result.rows);
      hasMore = result.more || false;

      if (result.rows.length > 0) {
        const lastDropId = result.rows[result.rows.length - 1].drop_id;
        upperBound = String(lastDropId - 1);
      } else {
        hasMore = false;
      }

      iterations++;
    }

    console.log(`[NFTHive] Fetched ${allDrops.length} total drops from chain in ${iterations} pages`);

    let drops = allDrops;

    // Filter by collection if specified
    if (collection) {
      drops = drops.filter(d => d.collection_name === collection);
    }

    // Only filter hidden drops - let UI handle time-based filtering
    drops = drops.filter(d => !d.is_hidden);
    
    console.log(`[NFTHive] After filtering hidden: ${drops.length} drops`);

    // Convert to NFTDrop format with placeholder images
    return drops.map(rawDropToNFTDrop);
  } catch (error) {
    console.error('Error fetching raw drops:', error);
    return [];
  }
}

// Enrichment progress callback type
export type EnrichmentProgressCallback = (
  progress: { loaded: number; total: number },
  partialDrops: NFTDrop[]
) => void;

// Enrich drops with template metadata (images, names) using BATCH fetching
// This reduces 50+ API calls to just 1-2 calls, making page load ~10x faster
export async function enrichDropTemplates(
  drops: NFTDrop[],
  signal?: AbortSignal,
  onProgress?: EnrichmentProgressCallback
): Promise<NFTDrop[]> {
  // Collect unique template IDs to fetch
  const requests: { templateId: string; collectionName: string }[] = [];
  for (const drop of drops) {
    if (drop.templateId && drop.collectionName) {
      requests.push({ templateId: drop.templateId, collectionName: drop.collectionName });
    }
  }

  if (requests.length === 0) {
    onProgress?.({ loaded: 0, total: 0 }, drops);
    return drops;
  }

  // Report progress start
  onProgress?.({ loaded: 0, total: requests.length }, drops);

  // Check abort signal
  if (signal?.aborted) {
    console.log('[NFTHive] Template enrichment aborted');
    return drops;
  }

  try {
    // SINGLE BATCH FETCH - replaces 50+ individual calls with 1-2 API requests
    const templateCache = await fetchTemplatesBatch(requests);

    // Build enriched drops
    const enrichedDrops = drops.map(drop => {
      if (!drop.templateId) return drop;
      const key = `${drop.collectionName}:${drop.templateId}`;
      const cached = templateCache.get(key);
      if (cached) {
        // Preload image in background for faster rendering
        if (cached.image && !cached.image.includes('placeholder')) {
          const preload = new Image();
          preload.src = cached.image;
        }
        return {
          ...drop,
          image: cached.image || drop.image,
          name: cached.name && drop.name.startsWith('Drop #') ? cached.name : drop.name,
        };
      }
      return drop;
    });

    // Report completion
    onProgress?.({ loaded: requests.length, total: requests.length }, enrichedDrops);

    console.log(`[NFTHive] Enriched ${templateCache.size} templates for ${drops.length} drops`);
    return enrichedDrops;
  } catch (error) {
    console.warn('[NFTHive] Batch template fetch failed:', error);
    // Return original drops on failure
    onProgress?.({ loaded: requests.length, total: requests.length }, drops);
    return drops;
  }
}

// Fetch drops directly from on-chain nfthivedrops contract with full enrichment
// (kept for backwards compatibility - prefer fetchRawDrops + enrichDropTemplates for better UX)
async function fetchOnChainNFTHiveDrops(collection?: string): Promise<NFTDrop[]> {
  const rawDrops = await fetchRawDrops(collection);
  return enrichDropTemplates(rawDrops);
}

// Fetch NFT Hive drops - always uses on-chain data for accuracy
export async function fetchNFTHiveDrops(collection?: string): Promise<NFTDrop[]> {
  // Always fetch from blockchain for accurate, complete data
  // The NFTHive API returns incomplete/filtered results
  return fetchOnChainNFTHiveDrops(collection);
}

// Fetch NeftyBlocks/AtomicHub drops (WAX only, for reference)
export async function fetchDrops(): Promise<NFTDrop[]> {
  try {
    const params = new URLSearchParams({
      collection_name: CHEESE_CONFIG.collectionName,
      state: '1',
      order: 'desc',
      sort: 'created',
      limit: '50',
    });
    const path = `${ATOMIC_API.paths.drops}?${params.toString()}`;

    const response = await fetchWithFallback(ATOMIC_API.baseUrls, path);
    const json = await response.json();

    if (!json.success || !json.data) {
      return [];
    }

    return (json.data as AtomicDrop[]).map((drop): NFTDrop => {
      const template = drop.templates_to_mint?.[0];
      const data = template?.immutable_data || {};
      const maxClaimable = parseInt(drop.max_claimable) || 0;
      const currentClaimed = parseInt(drop.current_claimed) || 0;

      return {
        id: drop.drop_id,
        dropId: drop.drop_id,
        saleId: drop.drop_id,
        templateId: template?.template_id,
        collectionName: drop.collection_name,
        name: data.name || template?.name || `Drop #${drop.drop_id}`,
        description: data.description || 'A unique NFT drop from the Cheese collection',
        image: getImageUrl(data.img || data.image),
        price: parseFloat(drop.listing_price) || 0,
        totalSupply: maxClaimable,
        remaining: Math.max(0, maxClaimable - currentClaimed),
        attributes: [
          { trait: 'Rarity', value: extractRarity(data) },
          ...buildAttributes(data).slice(0, 5),
        ],
        endDate: drop.end_time !== '0' ? new Date(parseInt(drop.end_time) * 1000).toISOString() : undefined,
        dropSource: 'neftyblocks',
        settlementSymbol: drop.settlement_symbol,
        listingPrice: drop.listing_price,
      };
    });
  } catch (error) {
    console.error('Error fetching drops:', error);
    return [];
  }
}

// Fetch a single sale by ID
export async function fetchSaleById(saleId: string): Promise<NFTDrop | null> {
  try {
    const path = `${ATOMIC_API.paths.sales}/${saleId}`;
    const response = await fetchWithFallback(ATOMIC_API.baseUrls, path);
    const json = await response.json();

    if (!json.success || !json.data) {
      return null;
    }

    const sale = json.data as AtomicSale;
    const asset = sale.assets[0];
    const data = { ...asset?.immutable_data, ...asset?.data };
    const template = asset?.template;

    return {
      id: sale.sale_id,
      saleId: sale.sale_id,
      templateId: template?.template_id,
      collectionName: sale.collection_name,
      name: data.name || asset?.name || `NFT #${sale.sale_id}`,
      description: data.description || 'A unique NFT from the Cheese collection',
      image: getImageUrl(data.img || data.image),
      price: parseFloat(sale.listing_price) / Math.pow(10, sale.price.token_precision),
      totalSupply: template ? parseInt(template.max_supply) || 1 : 1,
      remaining: template ? Math.max(0, parseInt(template.max_supply) - parseInt(template.issued_supply)) : 1,
      seller: sale.seller,
      attributes: [
        { trait: 'Rarity', value: extractRarity(data) },
        ...buildAttributes(data).slice(0, 5),
      ],
      dropSource: 'sale',
    };
  } catch (error) {
    console.error('Error fetching sale:', error);
    return null;
  }
}

// Fetch a single drop by ID (supports nfthive-{dropId} format)
// Uses on-chain data to support both active and ended drops
export async function fetchDropById(dropId: string): Promise<NFTDrop | null> {
  try {
    // Handle NFT Hive drops - fetch directly from blockchain for reliability
    if (dropId.startsWith('nfthive-')) {
      const nfthiveDropId = dropId.replace('nfthive-', '');
      
      // Fetch from on-chain table instead of NFTHive API (which only returns active drops)
      const { fetchTableRows } = await import('@/lib/waxRpcFallback');
      
      // Fetch drop data and prices in parallel
      const [dropResult, prices] = await Promise.all([
        fetchTableRows<OnChainNFTHiveDrop>({
          code: 'nfthivedrops',
          scope: 'nfthivedrops',
          table: 'drops',
          lower_bound: nfthiveDropId,
          upper_bound: nfthiveDropId,
          limit: 1,
        }),
        fetchDropPrices(nfthiveDropId),
      ]);
      
      if (!dropResult.rows.length) return null;
      
      const onChainDrop = dropResult.rows[0];
      
      // Convert to base NFTDrop format
      const baseDrop = rawDropToNFTDrop(onChainDrop);
      
      // Use prices from dropprices table if available (contains ALL price options)
      // Otherwise fall back to the single listing_price from drops table
      if (prices.length > 0) {
        baseDrop.prices = prices;
        console.log(`[NFTHive] Drop ${nfthiveDropId} has ${prices.length} price options from dropprices:`, prices);
      } else {
        // No dropprices entry - use single price from drops table
        const primaryPrice: DropPrice = {
          price: baseDrop.price,
          currency: baseDrop.currency || 'WAX',
          listingPrice: onChainDrop.listing_price,
        };
        baseDrop.prices = [primaryPrice];
        console.log(`[NFTHive] Drop ${nfthiveDropId} using single price from drops table:`, baseDrop.prices);
      }
      
      // Fetch template metadata for images/name
      if (baseDrop.templateId && baseDrop.collectionName) {
        const templateData = await fetchTemplateById(baseDrop.templateId, baseDrop.collectionName);
        if (templateData) {
          return {
            ...baseDrop,
            image: templateData.image || baseDrop.image,
            name: templateData.name || baseDrop.name,
          };
        }
      }
      
      return baseDrop;
    }

    // Try fetching as a sale
    return await fetchSaleById(dropId);
  } catch (error) {
    console.error('Error fetching drop by ID:', error);
    return null;
  }
}

// Combined fetch for all available NFTs - prioritizes NFT Hive CHEESE drops
export async function fetchAllDrops(): Promise<NFTDrop[]> {
  const [nfthiveDrops, cheeseDrops, sales, otherDrops] = await Promise.all([
    fetchNFTHiveDrops(),
    fetchNFTHiveDrops(CHEESE_CONFIG.collectionName), // Explicitly fetch cheesenftwax drops
    fetchActiveSales(),
    fetchDrops(),
  ]);

  // Prioritize cheese collection drops, then other NFT Hive drops, then other drops, then sales
  const combined = [...cheeseDrops, ...nfthiveDrops, ...otherDrops, ...sales];
  const seen = new Set<string>();

  return combined.filter((drop) => {
    // Use a composite key to avoid duplicates
    const key = drop.templateId ? `template-${drop.templateId}` : drop.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return drop.price > 0; // Only show items with prices
  });
}

// Fetch user's NFTs filtered by collections and schemas (for DAO voting)
// Uses hybrid approach: on-chain ownership + API metadata with template fallback
export async function fetchUserNFTsBySchema(
  account: string,
  collections: string[],
  schemas: string[]
): Promise<{ asset_id: string; name: string; image: string; collection: string; schema: string; template_id: string }[]> {
  try {
    console.log('[NFT Fetch] Starting hybrid fetch for', account);
    console.log('[NFT Fetch] Eligible collections:', collections);
    console.log('[NFT Fetch] Eligible schemas:', schemas);

    // Import waxRpcCall dynamically to avoid circular deps
    const { fetchTableRows: fetchTableRowsRpc } = await import('@/lib/waxRpcFallback');

    // Step 1: Query blockchain directly for user's owned assets
    // The atomicassets contract stores assets in a table scoped by owner
    const onChainAssets: Array<{
      asset_id: string;
      collection_name: string;
      schema_name: string;
      template_id: number;
    }> = [];

    let lower_bound = '';
    let hasMore = true;

    while (hasMore) {
      const response = await fetchTableRowsRpc<{
        asset_id: string;
        collection_name: string;
        schema_name: string;
        template_id: number;
      }>({
        code: 'atomicassets',
        scope: account,
        table: 'assets',
        limit: 1000,
        lower_bound,
      });

      for (const asset of response.rows) {
        // Filter by eligible collection/schema pairs
        const isEligible = collections.some((col, idx) => {
          const targetSchema = schemas[idx];
          const colMatch = asset.collection_name === col;
          const schemaMatch = !targetSchema || asset.schema_name === targetSchema;
          return colMatch && schemaMatch;
        });

        if (isEligible) {
          onChainAssets.push(asset);
        }
      }

      hasMore = response.more && response.rows.length > 0;
      if (hasMore && response.rows.length > 0) {
        // Use next key or increment last asset_id
        lower_bound = response.next_key || String(BigInt(response.rows[response.rows.length - 1].asset_id) + 1n);
      }
    }

    console.log('[NFT Fetch] Found', onChainAssets.length, 'eligible assets on-chain');

    if (onChainAssets.length === 0) {
      return [];
    }

    // Step 2: Try to fetch metadata from AtomicAssets API in batches
    const results: { asset_id: string; name: string; image: string; collection: string; schema: string; template_id: string }[] = [];
    const missingMetadata: typeof onChainAssets = [];

    // Batch fetch from API (max 100 per request)
    const assetIds = onChainAssets.map(a => a.asset_id);
    const batchSize = 100;

    for (let i = 0; i < assetIds.length; i += batchSize) {
      const batch = assetIds.slice(i, i + batchSize);
      try {
        const params = new URLSearchParams({
          ids: batch.join(','),
          limit: String(batchSize),
        });
        const path = `${ATOMIC_API.paths.assets}?${params.toString()}`;
        const response = await fetchWithFallback(ATOMIC_API.baseUrls, path);
        const json = await response.json();

        if (json.success && json.data) {
          const apiAssets = new Map<string, { asset_id: string; name?: string; data?: { name?: string; img?: string; image?: string } }>(
            json.data.map((a: { asset_id: string; name?: string; data?: { name?: string; img?: string; image?: string } }) => [a.asset_id, a])
          );

          for (const onChain of onChainAssets.filter(a => batch.includes(a.asset_id))) {
            const apiData = apiAssets.get(onChain.asset_id);
            if (apiData) {
              results.push({
                asset_id: onChain.asset_id,
                name: apiData.data?.name || apiData.name || `NFT #${onChain.asset_id}`,
                image: getImageUrl(apiData.data?.img || apiData.data?.image),
                collection: onChain.collection_name,
                schema: onChain.schema_name,
                template_id: String(onChain.template_id || ''),
              });
            } else {
              missingMetadata.push(onChain);
            }
          }
        } else {
          // API failed for this batch, add all to missing
          missingMetadata.push(...onChainAssets.filter(a => batch.includes(a.asset_id)));
        }
      } catch (err) {
        console.warn('[NFT Fetch] API batch failed, will fallback to template:', err);
        missingMetadata.push(...onChainAssets.filter(a => batch.includes(a.asset_id)));
      }
    }

    // Step 3: Fallback to template metadata for missing assets
    if (missingMetadata.length > 0) {
      console.log('[NFT Fetch] Fetching template metadata for', missingMetadata.length, 'unindexed assets');

      // Group by template_id to minimize API calls
      const templateGroups = new Map<string, typeof missingMetadata>();
      for (const asset of missingMetadata) {
        const key = `${asset.collection_name}:${asset.template_id}`;
        if (!templateGroups.has(key)) {
          templateGroups.set(key, []);
        }
        templateGroups.get(key)!.push(asset);
      }

      for (const [key, assets] of templateGroups) {
        const [collectionName, templateId] = key.split(':');
        if (templateId && templateId !== '0') {
          try {
            const templateData = await fetchTemplateById(templateId, collectionName);
            for (const asset of assets) {
              results.push({
                asset_id: asset.asset_id,
                name: templateData?.name || `NFT #${asset.asset_id}`,
                image: templateData?.image || '/placeholder.svg',
                collection: asset.collection_name,
                schema: asset.schema_name,
                template_id: String(asset.template_id || ''),
              });
            }
          } catch {
            // Last resort: placeholder
            for (const asset of assets) {
              results.push({
                asset_id: asset.asset_id,
                name: `NFT #${asset.asset_id}`,
                image: '/placeholder.svg',
                collection: asset.collection_name,
                schema: asset.schema_name,
                template_id: String(asset.template_id || ''),
              });
            }
          }
        } else {
          // No template, use placeholder
          for (const asset of assets) {
            results.push({
              asset_id: asset.asset_id,
              name: `NFT #${asset.asset_id}`,
              image: '/placeholder.svg',
              collection: asset.collection_name,
              schema: asset.schema_name,
              template_id: '',
            });
          }
        }
      }
    }

    console.log('[NFT Fetch] Total results:', results.length);
    return results;
  } catch (error) {
    console.error('[NFT Fetch] Error fetching user NFTs by schema:', error);
    return [];
  }
}

// Fetch collections the user is authorized to create drops for
export async function fetchUserCollections(account: string): Promise<string[]> {
  try {
    const params = new URLSearchParams({
      authorized_account: account,
      limit: '100',
    });
    const path = `${ATOMIC_API.paths.collections}?${params.toString()}`;

    const response = await fetchWithFallback(ATOMIC_API.baseUrls, path);
    const json = await response.json();

    if (!json.success || !json.data) {
      return [];
    }

    return json.data.map((c: { collection_name: string }) => c.collection_name);
  } catch (error) {
    console.error('Error fetching user collections:', error);
    return [];
  }
}

// Fetch template by ID for preview
export async function fetchTemplateById(
  templateId: string,
  collectionName?: string
): Promise<{ name: string; image: string; maxSupply: number; issuedSupply: number } | null> {
  try {
    const path = collectionName 
      ? `${ATOMIC_API.paths.templates}/${collectionName}/${templateId}`
      : `${ATOMIC_API.paths.templates}/${templateId}`;

    const response = await fetchWithFallback(ATOMIC_API.baseUrls, path);
    const json = await response.json();

    if (!json.success || !json.data) {
      return null;
    }

    const template = json.data;
    const data = template.immutable_data || {};

    return {
      name: data.name || template.name || `Template #${templateId}`,
      image: getImageUrl(data.img || data.image),
      maxSupply: parseInt(template.max_supply) || 0,
      issuedSupply: parseInt(template.issued_supply) || 0,
    };
  } catch (error) {
    console.error('Error fetching template:', error);
    return null;
  }
}

// Fetch user's owned NFTs for pre-mint drops
export async function fetchUserAssets(
  account: string,
  collectionName?: string
): Promise<Array<{
  asset_id: string;
  name: string;
  image: string;
  collection: string;
  template_id: string;
  mint: string;
}>> {
  try {
    const params = new URLSearchParams({
      owner: account,
      limit: '100',
      order: 'desc',
      sort: 'asset_id',
    });
    if (collectionName) {
      params.set('collection_name', collectionName);
    }
    const path = `${ATOMIC_API.paths.assets}?${params.toString()}`;

    const response = await fetchWithFallback(ATOMIC_API.baseUrls, path);
    const json = await response.json();

    if (!json.success || !json.data) {
      return [];
    }

    return json.data.map((asset: {
      asset_id: string;
      name?: string;
      data?: { name?: string; img?: string; image?: string };
      collection?: { collection_name?: string };
      template?: { template_id?: string };
      template_mint?: string;
    }) => ({
      asset_id: asset.asset_id,
      name: asset.data?.name || asset.name || `NFT #${asset.asset_id}`,
      image: getImageUrl(asset.data?.img || asset.data?.image),
      collection: asset.collection?.collection_name || '',
      template_id: asset.template?.template_id || '',
      mint: asset.template_mint || '',
    }));
  } catch (error) {
    console.error('Error fetching user assets:', error);
    return [];
  }
}

// Fetch drops created by a specific user (based on their authorized collections)
export async function fetchUserDrops(account: string): Promise<Array<{
  dropId: number;
  name: string;
  image: string;
  price: number;
  currency: string;
  maxClaimable: number;
  numClaimed: number;
  startTime: number;
  endTime: number;
  collectionName: string;
}>> {
  try {
    // Step 1: Get collections where user is an authorized account
    const userCollections = await fetchUserCollections(account);
    
    if (userCollections.length === 0) {
      console.log('User has no authorized collections');
      return [];
    }
    
    console.log('User authorized for collections:', userCollections);
    
    // Helper to extract data from NFT Hive's immutableData array format
    const getData = (immutableData: Array<{ key: string; value: [string, string] }>, key: string): string => {
      const item = immutableData.find(d => d.key === key);
      return item?.value?.[1] || '';
    };
    
    // Step 2: Fetch drops for EACH user collection from NFTHive API
    const allUserDrops: Array<{
      dropId: number;
      name: string;
      image: string;
      price: number;
      currency: string;
      maxClaimable: number;
      numClaimed: number;
      startTime: number;
      endTime: number;
      collectionName: string;
    }> = [];
    
    for (const collectionName of userCollections) {
      try {
        const url = `${NFTHIVE_CONFIG.apiUrl}/api/drops?collection=${collectionName}`;
        console.log('Fetching drops for collection:', collectionName, url);
        
        const response = await fetch(url);
        const drops = await response.json() as NFTHiveDrop[];
        
        console.log(`Found ${drops.length} drops for collection ${collectionName}`);
        
        // Map each drop to the expected format
        for (const drop of drops) {
          const template = drop.templatesToMint?.[0];
          const immutableData = template?.immutableData || [];
          const name = drop.displayData?.name || getData(immutableData, 'name') || template?.name || `Drop #${drop.dropId}`;
          const img = getData(immutableData, 'img') || getData(immutableData, 'image');
          
          allUserDrops.push({
            dropId: drop.dropId,
            name,
            image: getImageUrl(img),
            price: drop.price,
            currency: drop.currency || 'WAX',
            maxClaimable: drop.maxClaimable || 0,
            numClaimed: drop.numClaimed || 0,
            startTime: drop.startTime || 0,
            endTime: drop.endTime || 0,
            collectionName: drop.collection?.collectionName || collectionName,
          });
        }
      } catch (error) {
        console.error(`Error fetching drops for collection ${collectionName}:`, error);
      }
    }
    
    console.log('Total user drops found:', allUserDrops.length);
    return allUserDrops;
  } catch (error) {
    console.error('Error fetching user drops:', error);
    return [];
  }
}

// Fetch CHEESE drop stats from nfthivedrops contract (includes historical data)
// This queries drops that accept CHEESE token as payment
export async function fetchCheeseDropStats(): Promise<{ activeDrops: number; totalSold: number }> {
  try {
    // First, get all drops from nfthivedrops
    const dropsResponse = await fetch('https://wax.eosusa.io/v1/chain/get_table_rows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        json: true,
        code: 'nfthivedrops',
        scope: 'nfthivedrops',
        table: 'drops',
        limit: 1000,
      }),
    });

    const dropsData = await dropsResponse.json();
    const allDrops = dropsData.rows || [];

    // Get drop prices to find drops that accept CHEESE
    const pricesResponse = await fetch('https://wax.eosusa.io/v1/chain/get_table_rows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        json: true,
        code: 'nfthivedrops',
        scope: 'nfthivedrops',
        table: 'dropprices',
        limit: 1000,
      }),
    });

    const pricesData = await pricesResponse.json();
    const allPrices = pricesData.rows || [];

    // Find drops that accept CHEESE token or are from cheesenftwax collection
    const cheeseDropIds = new Set<number>();
    
    // Check prices for CHEESE token
    for (const price of allPrices) {
      const tokenSymbol = price.token_symbol || '';
      const tokenContract = price.token_contract || '';
      if (tokenSymbol.includes('CHEESE') || tokenContract === 'cheeseburger') {
        cheeseDropIds.add(price.drop_id);
      }
    }

    // Also include drops from cheesenftwax collection
    for (const drop of allDrops) {
      if (drop.collection_name === CHEESE_CONFIG.collectionName) {
        cheeseDropIds.add(drop.drop_id);
      }
    }

    console.log('CHEESE drop IDs found:', Array.from(cheeseDropIds));

    const now = Math.floor(Date.now() / 1000);
    let activeDrops = 0;
    let totalSold = 0;

    // Calculate stats for CHEESE drops
    for (const drop of allDrops) {
      if (!cheeseDropIds.has(drop.drop_id)) continue;

      // Count claims (sold)
      const claimed = drop.current_claimed || 0;
      totalSold += claimed;

      // Check if drop is active
      const startTime = drop.start_time || 0;
      const endTime = drop.end_time || 0;
      const isStarted = startTime === 0 || startTime <= now;
      const isNotEnded = endTime === 0 || endTime > now;
      
      if (isStarted && isNotEnded) {
        activeDrops++;
      }
    }

    console.log('CHEESE drop stats:', { activeDrops, totalSold });
    return { activeDrops, totalSold };
  } catch (error) {
    console.error('Error fetching CHEESE drop stats:', error);
    return { activeDrops: 0, totalSold: 0 };
  }
}
