import { useState, useMemo, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, ImageOff, Loader2, Package, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { TemplateInfo } from '@/lib/mintWithBacking';

interface TemplatePickerProps {
  templates: TemplateInfo[];
  isLoading: boolean;
  selectedTemplateId: number | null;
  onSelect: (template: TemplateInfo) => void;
}

const ITEMS_PER_ROW = 3;
const ITEM_HEIGHT = 180;

// IPFS gateway fallback
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
];

function extractIpfsHash(url: string): string | null {
  if (!url) return null;
  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', '');
  }
  const ipfsMatch = url.match(/\/ipfs\/([a-zA-Z0-9]+.*)/);
  if (ipfsMatch) return ipfsMatch[1];
  if (/^Qm[a-zA-Z0-9]{44}/.test(url) || /^bafy[a-zA-Z0-9]+/.test(url)) {
    return url;
  }
  return null;
}

export function TemplatePicker({
  templates,
  isLoading,
  selectedTemplateId,
  onSelect,
}: TemplatePickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const parentRef = useRef<HTMLDivElement>(null);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    
    const query = searchQuery.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.template_id.includes(query) ||
        t.schema_name.toLowerCase().includes(query)
    );
  }, [templates, searchQuery]);

  // Virtualization
  const rowCount = Math.ceil(filteredTemplates.length / ITEMS_PER_ROW);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 3,
  });

  if (isLoading) {
    return (
      <div className="p-6 border border-dashed border-border/50 rounded-lg text-center space-y-4">
        <Loader2 className="h-8 w-8 mx-auto text-cheese animate-spin" />
        <p className="text-sm text-muted-foreground">Loading templates...</p>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="p-6 border border-dashed border-border/50 rounded-lg text-center">
        <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          No templates found in this collection
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search templates by name or ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Template count */}
      <p className="text-xs text-muted-foreground">
        {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} found
      </p>

      {/* Virtualized grid */}
      <div
        ref={parentRef}
        className="h-[320px] border border-border/50 rounded-lg overflow-auto"
        style={{ contain: 'strict' }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const startIndex = virtualRow.index * ITEMS_PER_ROW;
            const rowTemplates = filteredTemplates.slice(startIndex, startIndex + ITEMS_PER_ROW);

            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="grid grid-cols-3 gap-2 p-2"
              >
                {rowTemplates.map((template) => (
                  <TemplateCard
                    key={template.template_id}
                    template={template}
                    isSelected={selectedTemplateId === parseInt(template.template_id)}
                    onSelect={() => onSelect(template)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Template Card component
interface TemplateCardProps {
  template: TemplateInfo;
  isSelected: boolean;
  onSelect: () => void;
}

function TemplateCard({ template, isSelected, onSelect }: TemplateCardProps) {
  const [imageError, setImageError] = useState(false);
  const [currentGatewayIndex, setCurrentGatewayIndex] = useState(0);

  const isMaxSupplyReached = template.max_supply > 0 && template.issued_supply >= template.max_supply;
  const remainingSupply = template.max_supply > 0 
    ? template.max_supply - template.issued_supply 
    : 'Unlimited';

  const handleImageError = useCallback(() => {
    const hash = extractIpfsHash(template.image);
    if (hash && currentGatewayIndex < IPFS_GATEWAYS.length - 1) {
      setCurrentGatewayIndex((prev) => prev + 1);
    } else {
      setImageError(true);
    }
  }, [template.image, currentGatewayIndex]);

  const imageSrc = useMemo(() => {
    if (imageError) return '/placeholder.svg';
    const hash = extractIpfsHash(template.image);
    if (hash && currentGatewayIndex > 0) {
      return `${IPFS_GATEWAYS[currentGatewayIndex]}${hash}`;
    }
    return template.image || '/placeholder.svg';
  }, [template.image, imageError, currentGatewayIndex]);

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isMaxSupplyReached}
      className={cn(
        'relative flex flex-col items-center p-2 rounded-lg border-2 transition-all text-left',
        isSelected
          ? 'border-cheese bg-cheese/10'
          : isMaxSupplyReached
          ? 'border-transparent bg-muted/30 opacity-50 cursor-not-allowed'
          : 'border-transparent bg-muted/50 hover:border-cheese/50'
      )}
    >
      {/* Max supply warning */}
      {isMaxSupplyReached && (
        <div className="absolute top-1 right-1 z-10">
          <div className="bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Max
          </div>
        </div>
      )}

      {/* Image */}
      <div className="relative w-full aspect-square rounded overflow-hidden mb-2">
        {imageError ? (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <ImageOff className="h-6 w-6 text-muted-foreground/50" />
          </div>
        ) : (
          <img
            src={imageSrc}
            alt={template.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={handleImageError}
          />
        )}
        {isSelected && (
          <div className="absolute inset-0 bg-cheese/20 flex items-center justify-center">
            <div className="bg-cheese text-cheese-foreground rounded-full p-1">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <span className="text-xs font-medium truncate w-full text-center">
        {template.name}
      </span>
      <span className="text-[10px] text-muted-foreground">
        #{template.template_id}
      </span>
      <span className="text-[10px] text-muted-foreground">
        {template.issued_supply}/{template.max_supply > 0 ? template.max_supply : '∞'} minted
      </span>
    </button>
  );
}
