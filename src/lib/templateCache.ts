 // ============================================================================
 // Template Cache - Shared NFT template metadata cache across CHEESEHub
 // Provides in-memory caching with batch fetching for performance
 // ============================================================================
 
 import { fetchTemplatesBatch } from '@/services/atomicApi';
 
 const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
 const MAX_CACHE_SIZE = 500; // Limit memory usage
 
 interface TemplateData {
   name: string;
   image: string;
   isVideo?: boolean;
   timestamp: number;
 }
 
 // In-memory cache for fast access
 const memoryCache = new Map<string, TemplateData>();
 
 /**
  * Generate cache key from template and collection
  */
 function makeKey(templateId: string, collectionName: string): string {
   return `${collectionName}:${templateId}`;
 }
 
 /**
  * Evict oldest entries if cache exceeds max size
  */
 function evictOldestIfNeeded(): void {
   if (memoryCache.size <= MAX_CACHE_SIZE) return;
   
   // Sort by timestamp and remove oldest 20%
   const entries = Array.from(memoryCache.entries())
     .sort((a, b) => a[1].timestamp - b[1].timestamp);
   
   const toRemove = Math.floor(entries.length * 0.2);
   for (let i = 0; i < toRemove; i++) {
     memoryCache.delete(entries[i][0]);
   }
   
   console.log(`[TemplateCache] Evicted ${toRemove} oldest entries`);
 }
 
 /**
  * Get cached template data if valid (not expired)
  */
 export function getCachedTemplate(templateId: string, collectionName: string): TemplateData | null {
   const key = makeKey(templateId, collectionName);
   const cached = memoryCache.get(key);
   
   if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
     return cached;
   }
   
   // Expired - remove from cache
   if (cached) {
     memoryCache.delete(key);
   }
   
   return null;
 }
 
 /**
  * Set template data in cache
  */
 export function setCachedTemplate(
   templateId: string, 
   collectionName: string, 
   data: Omit<TemplateData, 'timestamp'>
 ): void {
   evictOldestIfNeeded();
   
   const key = makeKey(templateId, collectionName);
   memoryCache.set(key, { ...data, timestamp: Date.now() });
 }
 
 /**
  * Batch get templates - checks cache first, fetches missing from API
  * Returns Map with keys in format "collection:templateId"
  */
 export async function batchGetOrFetch(
   requests: { templateId: string; collectionName: string }[]
 ): Promise<Map<string, TemplateData>> {
   const results = new Map<string, TemplateData>();
   const toFetch: { templateId: string; collectionName: string }[] = [];
   
   // Check cache first
   for (const req of requests) {
     const cached = getCachedTemplate(req.templateId, req.collectionName);
     if (cached) {
       results.set(makeKey(req.templateId, req.collectionName), cached);
     } else {
       toFetch.push(req);
     }
   }
   
   console.log(`[TemplateCache] Cache hit: ${results.size}, need to fetch: ${toFetch.length}`);
   
   // Batch fetch missing from API
   if (toFetch.length > 0) {
     try {
       const fetched = await fetchTemplatesBatch(toFetch);
       
       for (const [key, data] of fetched) {
         const withTimestamp: TemplateData = { ...data, timestamp: Date.now() };
         memoryCache.set(key, withTimestamp);
         results.set(key, withTimestamp);
       }
       
       evictOldestIfNeeded();
     } catch (error) {
       console.error('[TemplateCache] Batch fetch failed:', error);
     }
   }
   
   return results;
 }
 
 /**
  * Clear all cached templates (useful for manual refresh)
  */
 export function clearTemplateCache(): void {
   memoryCache.clear();
   console.log('[TemplateCache] Cache cleared');
 }
 
 /**
  * Get cache statistics for debugging
  */
 export function getCacheStats(): { size: number; maxSize: number } {
   return {
     size: memoryCache.size,
     maxSize: MAX_CACHE_SIZE,
   };
 }