import { ATOMIC_API, CHEESE_CONFIG, NFTHIVE_CONFIG } from '@/lib/waxConfig';
import { fetchWithFallback } from '@/lib/fetchWithFallback';
import type { NFTDrop, AtomicSale, AtomicTemplate, AtomicDrop, NFTHiveDrop } from '@/types/drop';

// Use reliable IPFS gateways with fallbacks
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
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

// Fetch drops directly from on-chain nfthivedrops contract
async function fetchOnChainNFTHiveDrops(collection?: string): Promise<NFTDrop[]> {
  try {
    const { fetchTableRows } = await import('@/lib/waxRpcFallback');

    const result = await fetchTableRows<OnChainNFTHiveDrop>({
      code: 'nfthivedrops',
      scope: 'nfthivedrops',
      table: 'drops',
      limit: 1000,
    });

    let drops = result.rows;

    // Filter by collection if specified
    if (collection) {
      drops = drops.filter(d => d.collection_name === collection);
    }

    // Filter out hidden drops and apply time-based filtering
    const now = Math.floor(Date.now() / 1000);
    drops = drops.filter(d => {
      if (d.is_hidden) return false;
      // Show drops that haven't ended (end_time 0 means no end)
      if (d.end_time > 0 && d.end_time < now) return false;
      return true;
    });

    // Enrich drops with template metadata from AtomicAssets
    const enrichedDrops = await Promise.all(
      drops.map(async (drop): Promise<NFTDrop | null> => {
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

        let name = displayData.name || `Drop #${drop.drop_id}`;
        let description = displayData.description || 'A unique NFT drop';
        let image = '/placeholder.svg';
        let attributes: { trait: string; value: string }[] = [{ trait: 'Rarity', value: 'Common' }];

        // Fetch template data for image and additional metadata
        if (templateId) {
          try {
            const templateData = await fetchTemplateById(String(templateId), drop.collection_name);
            if (templateData) {
              image = templateData.image || image;
              if (templateData.name && !displayData.name) {
                name = templateData.name;
              }
            }
          } catch (e) {
            console.warn('Could not fetch template for drop:', drop.drop_id, e);
          }
        }

        const maxClaimable = drop.max_claimable || 0;
        const remaining = Math.max(0, maxClaimable - drop.current_claimed);

        return {
          id: `nfthive-${drop.drop_id}`,
          dropId: String(drop.drop_id),
          templateId: templateId ? String(templateId) : undefined,
          collectionName: drop.collection_name,
          name,
          description,
          image,
          price,
          totalSupply: maxClaimable,
          remaining,
          attributes,
          endDate: drop.end_time > 0 ? new Date(drop.end_time * 1000).toISOString() : undefined,
          dropSource: 'nfthive',
          settlementSymbol: drop.settlement_symbol,
          listingPrice: drop.listing_price,
          currency,
          authRequired: drop.auth_required === 1,
          isFree: price === 0,
          accountLimit: drop.account_limit || undefined,
        };
      })
    );

    return enrichedDrops.filter((d): d is NFTDrop => d !== null);
  } catch (error) {
    console.error('Error fetching on-chain NFTHive drops:', error);
    return [];
  }
}

// Fetch NFT Hive drops - tries API first, then falls back to on-chain data
export async function fetchNFTHiveDrops(collection?: string): Promise<NFTDrop[]> {
  // Try API first (may be down or CORS blocked)
  try {
    const url = collection 
      ? `${NFTHIVE_CONFIG.apiUrl}/api/drops?collection=${collection}`
      : `${NFTHIVE_CONFIG.apiUrl}/api/drops`;

    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      const drops = await response.json() as NFTHiveDrop[];

      if (drops && drops.length > 0) {
        // Helper to extract data from NFT Hive's immutableData array format
        const getData = (immutableData: Array<{ key: string; value: [string, string] }>, key: string): string => {
          const item = immutableData.find(d => d.key === key);
          return item?.value?.[1] || '';
        };

        // Map all drops to NFTDrop format and enrich with template data if needed
        const enrichedDrops = await Promise.all(
          drops.map(async (drop): Promise<NFTDrop> => {
            const template = drop.templatesToMint?.[0];
            const immutableData = template?.immutableData || [];

            const name = drop.displayData?.name || getData(immutableData, 'name') || template?.name || `Drop #${drop.dropId}`;
            const displayDescription = drop.displayData?.description || '';
            const immutableDescription = getData(immutableData, 'description') || '';
            const description = displayDescription || immutableDescription || 'A unique NFT drop from the Cheese collection';
            const templateDescription = displayDescription && immutableDescription ? immutableDescription : undefined;
            const img = getData(immutableData, 'img') || getData(immutableData, 'image');

            const excludeKeys = ['name', 'img', 'video', 'description', 'image'];
            const attributes = immutableData
              .filter(item => !excludeKeys.includes(item.key.toLowerCase()))
              .map(item => ({ trait: item.key, value: item.value?.[1] || '' }))
              .slice(0, 6);

            const maxClaimable = drop.maxClaimable || 0;
            let numClaimed = drop.numClaimed;
            
            if (numClaimed === null || numClaimed === undefined) {
              const templateStats = (template as any)?.stats;
              if (templateStats?.numMinted !== undefined) {
                numClaimed = templateStats.numMinted;
              }
            }
            
            if ((numClaimed === null || numClaimed === undefined) && template?.templateId) {
              try {
                const templateData = await fetchTemplateById(
                  String(template.templateId),
                  drop.collection?.collectionName
                );
                if (templateData) {
                  numClaimed = templateData.issuedSupply;
                }
              } catch (e) {
                console.warn('Could not fetch template supply:', e);
              }
            }
            
            const claimCount = numClaimed || 0;

            // Check if drop is auth-required (look for authRequired in API response)
            const isAuthRequired = (drop as any).authRequired === true || (drop as any).auth_required === 1;
            
            return {
              id: `nfthive-${drop.dropId}`,
              dropId: String(drop.dropId),
              templateId: template?.templateId ? String(template.templateId) : undefined,
              collectionName: drop.collection?.collectionName || 'unknown',
              name,
              description,
              templateDescription,
              image: getImageUrl(img),
              price: drop.price,
              totalSupply: maxClaimable,
              remaining: Math.max(0, maxClaimable - claimCount),
              attributes: attributes.length > 0 ? attributes : [{ trait: 'Rarity', value: 'Common' }],
              endDate: drop.endTime > 0 ? new Date(drop.endTime * 1000).toISOString() : undefined,
              dropSource: 'nfthive',
              settlementSymbol: `4,${drop.currency}`,
              listingPrice: `${drop.price.toFixed(4)} ${drop.currency}`,
              currency: drop.currency,
              tokenContract: drop.contract,
              authRequired: isAuthRequired,
              isFree: drop.price === 0,
            };
          })
        );

        return enrichedDrops;
      }
    }
  } catch (error) {
    console.warn('NFTHive API unavailable, falling back to on-chain data:', error);
  }

  // Fallback: fetch directly from blockchain
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
export async function fetchDropById(dropId: string): Promise<NFTDrop | null> {
  try {
    // Handle NFT Hive drops
    if (dropId.startsWith('nfthive-')) {
      const nfthiveDropId = dropId.replace('nfthive-', '');
      const url = `${NFTHIVE_CONFIG.apiUrl}/api/drops`;

      const response = await fetch(url);
      const drops = await response.json() as NFTHiveDrop[];

      const drop = drops.find(d => String(d.dropId) === nfthiveDropId);
      if (!drop) return null;

      const getData = (immutableData: Array<{ key: string; value: [string, string] }>, key: string): string => {
        const item = immutableData.find(d => d.key === key);
        return item?.value?.[1] || '';
      };

      const template = drop.templatesToMint?.[0];
      const immutableData = template?.immutableData || [];

      const name = drop.displayData?.name || getData(immutableData, 'name') || template?.name || `Drop #${drop.dropId}`;
      const displayDescription = drop.displayData?.description || '';
      const immutableDescription = getData(immutableData, 'description') || '';
      const description = displayDescription || immutableDescription || 'A unique NFT drop from the Cheese collection';
      const templateDescription = displayDescription && immutableDescription ? immutableDescription : undefined;
      const img = getData(immutableData, 'img') || getData(immutableData, 'image');

      const excludeKeys = ['name', 'img', 'video', 'description', 'image'];
      const attributes = immutableData
        .filter(item => !excludeKeys.includes(item.key.toLowerCase()))
        .map(item => ({ trait: item.key, value: item.value?.[1] || '' }))
        .slice(0, 6);

      const maxClaimable = drop.maxClaimable || 0;
      
      // Get numClaimed with fallbacks for accurate sold out status
      let numClaimed = drop.numClaimed;
      
      // Fallback 1: Use template stats.numMinted from NFTHive response
      if (numClaimed === null || numClaimed === undefined) {
        const templateStats = (template as any)?.stats;
        if (templateStats?.numMinted !== undefined) {
          numClaimed = templateStats.numMinted;
        }
      }
      
      // Fallback 2: Fetch issuedSupply from AtomicAssets API
      if ((numClaimed === null || numClaimed === undefined) && template?.templateId) {
        try {
          const templateData = await fetchTemplateById(
            String(template.templateId),
            drop.collection?.collectionName
          );
          if (templateData) {
            numClaimed = templateData.issuedSupply;
          }
        } catch (e) {
          console.warn('Could not fetch template supply:', e);
        }
      }
      
      const claimCount = numClaimed || 0;

      // Check if drop is auth-required
      const isAuthRequired = (drop as any).authRequired === true || (drop as any).auth_required === 1;

      return {
        id: `nfthive-${drop.dropId}`,
        dropId: String(drop.dropId),
        templateId: template?.templateId ? String(template.templateId) : undefined,
        collectionName: drop.collection?.collectionName || 'unknown',
        name,
        description,
        templateDescription,
        image: getImageUrl(img),
        price: drop.price,
        totalSupply: maxClaimable,
        remaining: Math.max(0, maxClaimable - claimCount),
        attributes: attributes.length > 0 ? attributes : [{ trait: 'Rarity', value: 'Common' }],
        endDate: drop.endTime > 0 ? new Date(drop.endTime * 1000).toISOString() : undefined,
        dropSource: 'nfthive',
        settlementSymbol: `4,${drop.currency}`,
        listingPrice: `${drop.price.toFixed(4)} ${drop.currency}`,
        currency: drop.currency,
        authRequired: isAuthRequired,
        isFree: drop.price === 0,
      };
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
