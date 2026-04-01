import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles } from 'lucide-react';
import { ATOMIC_API } from '@/lib/waxConfig';
import { playRandomFart } from '@/lib/fartSounds';
import { fetchWithFallback } from '@/lib/fetchWithFallback';
import { fetchTableRows } from '@/lib/waxRpcFallback';
import { getIpfsUrl, extractIpfsHash } from '@/lib/ipfsGateways';

/** Expected card counts per pack symbol */
const EXPECTED_CARDS: Record<string, number> = {
  GPKFIVE: 5,
  GPKTWOA: 8,
  GPKTWOB: 25,
  GPKTWOC: 55,
};

/* RevealCard is exported from the new declaration below */
function resolveImage(data: Record<string, unknown>): string | null {
  const raw = (data?.img || data?.image || data?.frontimg || data?.backimg || '') as string;
  if (!raw) return null;
  if (raw.startsWith('http')) return raw;
  const hash = extractIpfsHash(raw);
  if (hash) return getIpfsUrl(hash);
  if (raw.startsWith('Qm') || raw.startsWith('bafy') || raw.startsWith('bafk')) return getIpfsUrl(raw);
  return null;
}

function parseJsonSafe(str: string): Record<string, unknown> {
  try { return JSON.parse(str) || {}; } catch { return {}; }
}
export interface RevealCard {
  asset_id: string;
  name: string;
  image: string | null;
  rarity: string;
}

interface PackRevealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packSymbol: string;
  packLabel: string;
  packImage?: string;
  accountName: string;
  preOpenAssetIds: Set<string>;
  onComplete: () => void;
  demoCards?: RevealCard[];
}

const POLL_INTERVAL = 3000;
const MAX_POLL_TIME = 60000;

/** Fetch GPK assets from both AtomicAssets API and SimpleAssets on-chain table */
async function fetchGpkAssets(owner: string): Promise<{ id: string; name: string; image: string | null; rarity: string }[]> {
  const results: { id: string; name: string; image: string | null; rarity: string }[] = [];

  // AtomicAssets
  try {
    const path = `${ATOMIC_API.paths.assets}?owner=${owner}&collection_name=gpk.topps&order=desc&sort=asset_id&limit=200`;
    const resp = await fetchWithFallback(ATOMIC_API.baseUrls, path);
    const json = await resp.json();
    for (const a of json?.data ?? []) {
      results.push({
        id: `aa-${a.asset_id}`,
        name: a.name || a.data?.name || 'GPK Card',
        image: resolveImage(a.data || {}),
        rarity: a.data?.rarity || a.data?.quality || a.data?.variant || '',
      });
    }
  } catch { /* ignore */ }

  // SimpleAssets
  try {
    const saRows = await fetchTableRows<{ id: string; author: string; idata: string; mdata: string }>({
      code: 'simpleassets',
      scope: owner,
      table: 'sassets',
      limit: 200,
    });
    for (const r of saRows.rows) {
      if (r.author !== 'gpk.topps') continue;
      const combined = { ...parseJsonSafe(r.idata), ...parseJsonSafe(r.mdata) };
      results.push({
        id: `sa-${r.id}`,
        name: (combined.name as string) || `Asset #${r.id}`,
        image: resolveImage(combined),
        rarity: (combined.rarity as string) || (combined.quality as string) || (combined.variant as string) || '',
      });
    }
  } catch { /* ignore */ }

  return results;
}

export function PackRevealDialog({
  open,
  onOpenChange,
  packSymbol,
  packLabel,
  packImage,
  accountName,
  preOpenAssetIds,
  onComplete,
  demoCards,
}: PackRevealDialogProps) {
  const [phase, setPhase] = useState<'waiting' | 'revealing' | 'timeout'>('waiting');
  const [newCards, setNewCards] = useState<RevealCard[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const expectedCount = EXPECTED_CARDS[packSymbol] ?? 5;

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setPhase('waiting');
      setNewCards([]);
      setRevealedCount(0);
    } else {
      stopPolling();
    }
  }, [open, stopPolling]);

  // Demo mode: fake delay then reveal
  useEffect(() => {
    if (!open || phase !== 'waiting' || !demoCards || demoCards.length === 0) return;
    const timer = setTimeout(() => {
      setNewCards(demoCards);
      setPhase('revealing');
    }, 4000);
    return () => clearTimeout(timer);
  }, [open, phase, demoCards]);

  // Unified polling effect for real opens (skipped in demo mode)
  useEffect(() => {
    if (!open || !accountName || (demoCards && demoCards.length > 0)) return;
    // Skip if not in waiting phase
    if (phase !== 'waiting') return;

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const startTs = Date.now();

    const poll = async () => {
      try {
        const assets = await fetchGpkAssets(accountName);
        const fresh = assets.filter((a) => !preOpenAssetIds.has(a.id));
        console.log('[pack-reveal] poll', fresh.length, 'new cards found');

        if (cancelled) return;

        if (fresh.length >= expectedCount) {
          clearInterval(interval);
          clearTimeout(timeout);
          const cards: RevealCard[] = fresh.slice(0, expectedCount).map((a) => ({
            asset_id: a.id,
            name: a.name,
            image: a.image,
            rarity: a.rarity,
          }));
          console.log('[pack-reveal] success —', cards.length, 'cards revealed');
          setNewCards(cards);
          setPhase('revealing');
        } else if (Date.now() - startTs > MAX_POLL_TIME) {
          clearInterval(interval);
          clearTimeout(timeout);
          if (fresh.length > 0) {
            const cards: RevealCard[] = fresh.map((a) => ({
              asset_id: a.id,
              name: a.name,
              image: a.image,
              rarity: a.rarity,
            }));
            console.log('[pack-reveal] partial timeout —', cards.length, 'cards');
            setNewCards(cards);
            setPhase('revealing');
          } else {
            console.warn('[pack-reveal] timeout — no cards found after', MAX_POLL_TIME / 1000, 's');
            setPhase('timeout');
          }
        }
      } catch (e) {
        console.error('[pack-reveal] poll error', e);
      }
    };

    // Initial delay before first poll (give RNG oracle time)
    console.log('[pack-reveal] starting with 4s delay');
    const startDelay = setTimeout(() => {
      if (cancelled) return;
      console.log('[pack-reveal] polling started');
      poll();
      interval = setInterval(poll, POLL_INTERVAL);
    }, 4000);

    timeout = setTimeout(() => {
      if (!cancelled) {
        clearInterval(interval);
        console.warn('[pack-reveal] hard timeout');
        setPhase((p) => p === 'waiting' ? 'timeout' : p);
      }
    }, MAX_POLL_TIME + 5000);

    return () => {
      cancelled = true;
      clearTimeout(startDelay);
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [open, phase, accountName, preOpenAssetIds, expectedCount, demoCards]);

  // Staggered card reveal
  useEffect(() => {
    if (phase !== 'revealing' || newCards.length === 0) return;
    if (revealedCount >= newCards.length) return;

    const timer = setTimeout(() => {
      playRandomFart();
      setRevealedCount((c) => c + 1);
    }, 1600);
    return () => clearTimeout(timer);
  }, [phase, revealedCount, newCards.length]);

  const handleClose = () => {
    onOpenChange(false);
    onComplete();
  };

  const allRevealed = phase === 'revealing' && revealedCount >= newCards.length;

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogTitle className="sr-only">Pack Reveal</DialogTitle>

        {/* Waiting phase */}
        {phase === 'waiting' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            <div className="animate-pack-shake">
              {packImage ? (
                <img src={packImage} alt={packLabel} className="w-32 h-auto rounded-lg shadow-lg shadow-primary/30" />
              ) : (
                <span className="text-7xl">📦</span>
              )}
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg font-bold text-foreground">Opening {packLabel}...</p>
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Waiting for cards to be minted...</span>
              </div>
              <p className="text-xs text-muted-foreground/60">This usually takes 2-15 seconds</p>
            </div>
          </div>
        )}

        {/* Reveal phase */}
        {phase === 'revealing' && (
          <div className="space-y-6 py-4">
            <div className="text-center space-y-1">
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold text-foreground">
                  {allRevealed ? 'All Cards Revealed!' : 'Revealing Cards...'}
                </h2>
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                {newCards.length} card{newCards.length !== 1 ? 's' : ''} from {packLabel}
              </p>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3" style={{ perspective: '1000px' }}>
              {newCards.map((card, i) => {
                const isRevealed = i < revealedCount;
                return (
                  <div
                    key={card.asset_id}
                    className="relative aspect-[2/3] rounded-lg"
                    style={{
                      transformStyle: 'preserve-3d',
                      transition: 'transform 0.6s ease-out',
                      transform: isRevealed ? 'rotateY(0deg)' : 'rotateY(180deg)',
                    }}
                  >
                    {/* Front - card image */}
                    <div
                      className="absolute inset-0 rounded-lg overflow-hidden border border-border bg-card shadow-md"
                      style={{ backfaceVisibility: 'hidden' }}
                    >
                      {card.image ? (
                        <img
                          src={card.image}
                          alt={card.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted text-2xl">🃏</div>
                      )}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                        <p className="text-[10px] text-white font-medium truncate">{card.name}</p>
                        {card.rarity && (
                          <p className="text-[9px] text-primary-foreground/80 truncate">{card.rarity}</p>
                        )}
                      </div>
                    </div>

                    {/* Back - card back */}
                    <div
                      className="absolute inset-0 rounded-lg border-2 border-primary/30 bg-gradient-to-br from-primary/20 via-accent/20 to-primary/30 flex items-center justify-center shadow-md"
                      style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                    >
                      <div className="text-center space-y-1">
                        <span className="text-3xl">🧀</span>
                        <p className="text-[10px] text-muted-foreground font-medium">GPK</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {allRevealed && (
              <div className="flex justify-center pt-2">
                <Button onClick={handleClose} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  Awesome! Close
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Timeout phase */}
        {phase === 'timeout' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
            <span className="text-5xl">⏳</span>
            <p className="text-foreground font-semibold">Cards are still being minted</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              The WAX RNG oracle is processing your pack. Your new cards should appear in your collection shortly.
            </p>
            <Button onClick={handleClose} variant="outline">
              Close & Refresh
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
