import { useState, useEffect, useRef, useCallback } from 'react';
import { getAudioPlayer } from '@/lib/musicPlayer';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Disc3, Video, Music2 } from 'lucide-react';

const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
];

function extractIpfsHash(url: string): string | null {
  if (!url) return null;
  if (url.startsWith('Qm') || url.startsWith('bafy')) return url;
  const match = url.match(/ipfs[:/]+(.+)/);
  return match ? match[1] : null;
}

interface MediaDisplayProps {
  coverArt: string;
  videoUrl?: string;
  alt: string;
  isPlaying: boolean;
  isVideo: boolean;
  hasVideo: boolean;
  onToggleVideo?: () => void;
}

export function MediaDisplay({ 
  coverArt, 
  videoUrl,
  alt, 
  isPlaying, 
  isVideo,
  hasVideo,
  onToggleVideo,
}: MediaDisplayProps) {
  const [imgSrc, setImgSrc] = useState(coverArt);
  const [gatewayIndex, setGatewayIndex] = useState(0);
  const [hasError, setHasError] = useState(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    setImgSrc(coverArt);
    setGatewayIndex(0);
    setHasError(false);
  }, [coverArt]);

  // Mount video element when in video mode
  useEffect(() => {
    const audioPlayer = getAudioPlayer();
    
    if (isVideo && videoContainerRef.current) {
      audioPlayer.mountVideo(videoContainerRef.current);
    }
    
    return () => {
      // Don't unmount on cleanup - let the player manage the video element
    };
  }, [isVideo]);

  const handleError = useCallback(() => {
    const hash = extractIpfsHash(coverArt);
    if (hash && gatewayIndex < IPFS_GATEWAYS.length - 1) {
      const nextIndex = gatewayIndex + 1;
      setGatewayIndex(nextIndex);
      setImgSrc(`${IPFS_GATEWAYS[nextIndex]}${hash}`);
    } else {
      setHasError(true);
    }
  }, [coverArt, gatewayIndex]);

  // Fallback disc display
  const FallbackDisc = () => (
    <div className="w-full h-full bg-muted/50 flex items-center justify-center">
      <Disc3 className={cn(
        "h-16 w-16 text-cheese/50",
        isPlaying && "animate-spin"
      )} style={{ animationDuration: '3s' }} />
    </div>
  );

  return (
    <div 
      className="relative w-full h-full"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Video container - shown when in video mode */}
      {isVideo && (
        <div 
          ref={videoContainerRef}
          className="absolute inset-0 rounded-lg overflow-hidden bg-black"
        />
      )}
      
      {/* Cover art - shown when in audio mode or video is loading */}
      {!isVideo && (
        hasError || !coverArt ? (
          <FallbackDisc />
        ) : (
          <img
            src={imgSrc}
            alt={alt}
            className="w-full h-full object-cover"
            onError={handleError}
          />
        )
      )}

      {/* Video toggle button - only show when track has video */}
      {hasVideo && onToggleVideo && (isHovering || isVideo) && (
        <div className="absolute bottom-2 right-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className={cn(
                    "h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-background/90",
                    isVideo && "text-cheese"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleVideo();
                  }}
                >
                  {isVideo ? (
                    <Music2 className="h-4 w-4" />
                  ) : (
                    <Video className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {isVideo ? 'Switch to audio' : 'Watch music video'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}

// Small video indicator for track list
interface VideoIndicatorProps {
  hasVideo: boolean;
}

export function VideoIndicator({ hasVideo }: VideoIndicatorProps) {
  if (!hasVideo) return null;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Video className="h-3 w-3 text-muted-foreground shrink-0" />
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>This track has a music video</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
