import { ATOMIC_API, CHEESE_CONFIG, NFTHIVE_CONFIG } from '@/lib/waxConfig';
import { fetchWithFallback } from '@/lib/fetchWithFallback';
import type { NFTDrop, AtomicSale, AtomicTemplate, AtomicDrop, NFTHiveDrop } from '@/types/drop';

const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';

function getImageUrl(img: string | undefined): string {
  if (!img) return '/placeholder.svg';
  if (img.startsWith('http')) return img;
  if (img.startsWith('Qm') || img.startsWith('bafy')) {
    return `${IPFS_GATEWAY}${img}`;
  }
  return img;
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

// Fetch NFT Hive drops that accept CHEESE
export async function fetchNFTHiveDrops(): Promise<NFTDrop[]> {
  try {
    // Use NFT Hive's own API endpoint
    const url = `${NFTHIVE_CONFIG.apiUrl}/api/drops?collection=${CHEESE_CONFIG.collectionName}`;

    const response = await fetch(url);
    const drops = await response.json() as NFTHiveDrop[];

    // Helper to extract data from NFT Hive's immutableData array format
    const getData = (immutableData: Array<{ key: string; value: [string, string] }>, key: string): string => {
      const item = immutableData.find(d => d.key === key);
      return item?.value?.[1] || '';
    };

    // Filter drops that accept CHEESE and map to NFTDrop format
    return drops
      .filter((drop) => drop.currency === 'CHEESE')
      .map((drop): NFTDrop => {
        const template = drop.templatesToMint?.[0];
        const immutableData = template?.immutableData || [];

        const name = drop.displayData?.name || getData(immutableData, 'name') || template?.name || `Drop #${drop.dropId}`;
        const displayDescription = drop.displayData?.description || '';
        const immutableDescription = getData(immutableData, 'description') || '';
        const description = displayDescription || immutableDescription || 'A unique NFT drop from the Cheese collection';
        const templateDescription = displayDescription && immutableDescription ? immutableDescription : undefined;
        const img = getData(immutableData, 'img') || getData(immutableData, 'image');

        // Build attributes from immutable data
        const excludeKeys = ['name', 'img', 'video', 'description', 'image'];
        const attributes = immutableData
          .filter(item => !excludeKeys.includes(item.key.toLowerCase()))
          .map(item => ({ trait: item.key, value: item.value?.[1] || '' }))
          .slice(0, 6);

        const maxClaimable = drop.maxClaimable || 0;
        const numClaimed = drop.numClaimed || 0;

        return {
          id: `nfthive-${drop.dropId}`,
          dropId: String(drop.dropId),
          templateId: template?.templateId ? String(template.templateId) : undefined,
          collectionName: drop.collection?.collectionName || CHEESE_CONFIG.collectionName,
          name,
          description,
          templateDescription,
          image: getImageUrl(img),
          price: drop.price,
          totalSupply: maxClaimable,
          remaining: Math.max(0, maxClaimable - numClaimed),
          attributes: attributes.length > 0 ? attributes : [{ trait: 'Rarity', value: 'Common' }],
          endDate: drop.endTime > 0 ? new Date(drop.endTime * 1000).toISOString() : undefined,
          dropSource: 'nfthive',
          settlementSymbol: `4,${drop.currency}`,
          listingPrice: `${drop.price.toFixed(4)} ${drop.currency}`,
        };
      });
  } catch (error) {
    console.error('Error fetching NFT Hive drops:', error);
    return [];
  }
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
      const url = `${NFTHIVE_CONFIG.apiUrl}/api/drops?collection=${CHEESE_CONFIG.collectionName}`;

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
      const numClaimed = drop.numClaimed || 0;

      return {
        id: `nfthive-${drop.dropId}`,
        dropId: String(drop.dropId),
        templateId: template?.templateId ? String(template.templateId) : undefined,
        collectionName: drop.collection?.collectionName || CHEESE_CONFIG.collectionName,
        name,
        description,
        templateDescription,
        image: getImageUrl(img),
        price: drop.price,
        totalSupply: maxClaimable,
        remaining: Math.max(0, maxClaimable - numClaimed),
        attributes: attributes.length > 0 ? attributes : [{ trait: 'Rarity', value: 'Common' }],
        endDate: drop.endTime > 0 ? new Date(drop.endTime * 1000).toISOString() : undefined,
        dropSource: 'nfthive',
        settlementSymbol: `4,${drop.currency}`,
        listingPrice: `${drop.price.toFixed(4)} ${drop.currency}`,
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
  const [nfthiveDrops, sales, otherDrops] = await Promise.all([
    fetchNFTHiveDrops(),
    fetchActiveSales(),
    fetchDrops(),
  ]);

  // Prioritize NFT Hive CHEESE drops, then other drops, then sales
  const combined = [...nfthiveDrops, ...otherDrops, ...sales];
  const seen = new Set<string>();

  return combined.filter((drop) => {
    // Use a composite key to avoid duplicates
    const key = drop.templateId ? `template-${drop.templateId}` : drop.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return drop.price > 0; // Only show items with prices
  });
}

// Fetch user's NFTs filtered by collections and schemas (for DAO staking)
export async function fetchUserNFTsBySchema(
  account: string,
  collections: string[],
  schemas: string[]
): Promise<{ asset_id: string; name: string; image: string; collection: string; schema: string; template_id: string }[]> {
  try {
    const results: { asset_id: string; name: string; image: string; collection: string; schema: string; template_id: string }[] = [];
    
    // Fetch NFTs for each collection/schema pair
    for (let i = 0; i < collections.length; i++) {
      const collection = collections[i];
      const schema = schemas[i];
      
      const params = new URLSearchParams({
        owner: account,
        collection_name: collection,
        limit: '100',
      });
      if (schema) {
        params.set('schema_name', schema);
      }
      const path = `${ATOMIC_API.paths.assets}?${params.toString()}`;
      
      const response = await fetchWithFallback(ATOMIC_API.baseUrls, path);
      const json = await response.json();
      
      if (json.success && json.data) {
        for (const asset of json.data) {
          results.push({
            asset_id: asset.asset_id,
            name: asset.data?.name || asset.name || `NFT #${asset.asset_id}`,
            image: getImageUrl(asset.data?.img || asset.data?.image),
            collection: asset.collection?.collection_name || collection,
            schema: asset.schema?.schema_name || schema,
            template_id: asset.template?.template_id || '',
          });
        }
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error fetching user NFTs by schema:', error);
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

// Fetch drops created by a specific user
export async function fetchUserDrops(account: string): Promise<Array<{
  dropId: number;
  name: string;
  image: string;
  price: number;
  maxClaimable: number;
  numClaimed: number;
  startTime: number;
  endTime: number;
}>> {
  try {
    // Use NFT Hive API to fetch drops by authorized account
    const url = `${NFTHIVE_CONFIG.apiUrl}/api/drops?authorized_account=${account}`;

    const response = await fetch(url);
    const drops = await response.json() as NFTHiveDrop[];

    return drops.map((drop) => {
      const template = drop.templatesToMint?.[0];
      const immutableData = template?.immutableData || [];
      
      const getData = (data: Array<{ key: string; value: [string, string] }>, key: string): string => {
        const item = data.find(d => d.key === key);
        return item?.value?.[1] || '';
      };

      const name = drop.displayData?.name || getData(immutableData, 'name') || template?.name || `Drop #${drop.dropId}`;
      const img = getData(immutableData, 'img') || getData(immutableData, 'image');

      return {
        dropId: drop.dropId,
        name,
        image: getImageUrl(img),
        price: drop.price,
        maxClaimable: drop.maxClaimable || 0,
        numClaimed: drop.numClaimed || 0,
        startTime: drop.startTime,
        endTime: drop.endTime,
      };
    });
  } catch (error) {
    console.error('Error fetching user drops:', error);
    return [];
  }
}
