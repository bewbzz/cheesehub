// Fallback fetch utility for AtomicAssets API reliability

export async function fetchWithFallback(
  endpoints: string[],
  path: string,
  options?: RequestInit,
  timeout: number = 8000
): Promise<Response> {
  let lastError: Error | null = null;

  // If external signal is already aborted, abort immediately
  if (options?.signal?.aborted) {
    const abortError = new Error('Request aborted');
    abortError.name = 'AbortError';
    throw abortError;
  }

  for (const baseUrl of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Combine external abort with our timeout abort
      const externalSignal = options?.signal;
      let externalAbortHandler: (() => void) | undefined;
      if (externalSignal) {
        externalAbortHandler = () => controller.abort();
        externalSignal.addEventListener('abort', externalAbortHandler);
      }

      try {
        const response = await fetch(`${baseUrl}${path}`, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          return response;
        }
        
        // If response is not ok, try next endpoint
        console.warn(`Endpoint ${baseUrl} returned ${response.status}, trying next...`);
      } finally {
        // Clean up the external abort listener
        if (externalSignal && externalAbortHandler) {
          externalSignal.removeEventListener('abort', externalAbortHandler);
        }
      }
    } catch (error) {
      lastError = error as Error;
      // Don't log abort errors as warnings
      if ((error as Error).name !== 'AbortError') {
        console.warn(`Endpoint ${baseUrl} failed:`, (error as Error).message);
      } else {
        // Re-throw abort errors immediately
        throw error;
      }
    }
  }

  throw lastError || new Error('All API endpoints failed');
}

// Helper to build URL with query params
export function buildApiUrl(path: string, params: Record<string, string>): string {
  const url = new URL(path, 'https://placeholder.com');
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.pathname + url.search;
}
