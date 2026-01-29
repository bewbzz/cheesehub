import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, SkipBack, SkipForward, Maximize2, X } from 'lucide-react';
import { getAudioPlayer, formatTime, type PlaybackState } from '@/lib/musicPlayer';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import cheeseLogo from '@/assets/cheese-logo.png';

interface CheeseAmpMiniPlayerProps {
  onExpand: () => void;
  onClose: () => void;
}

export function CheeseAmpMiniPlayer({ onExpand, onClose }: CheeseAmpMiniPlayerProps) {
  const isMobile = useIsMobile();
  const [playbackState, setPlaybackState] = useState<PlaybackState>(() => getAudioPlayer().getState());
  const [currentTrack, setCurrentTrack] = useState(() => getAudioPlayer().getCurrentTrack());

  // Subscribe to playback state updates
  useEffect(() => {
    const audioPlayer = getAudioPlayer();
    
    const unsubscribe = audioPlayer.subscribe((state) => {
      setPlaybackState(state);
      setCurrentTrack(audioPlayer.getCurrentTrack());
    });

    // Also poll for track changes since getCurrentTrack isn't reactive
    const interval = setInterval(() => {
      setCurrentTrack(audioPlayer.getCurrentTrack());
    }, 500);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const handlePlayPause = useCallback(() => {
    const audioPlayer = getAudioPlayer();
    if (playbackState.isPlaying) {
      audioPlayer.pause();
    } else {
      audioPlayer.resume();
    }
  }, [playbackState.isPlaying]);

  const handleNext = useCallback(() => {
    // Dispatch custom event for auto-advance hook to handle
    window.dispatchEvent(new CustomEvent('cheeseamp-skip-next'));
  }, []);

  const handlePrevious = useCallback(() => {
    // Dispatch custom event for auto-advance hook to handle
    window.dispatchEvent(new CustomEvent('cheeseamp-skip-previous'));
  }, []);

  const handleClose = useCallback(() => {
    getAudioPlayer().stop();
    onClose();
  }, [onClose]);

  // Don't render if no track is loaded
  if (!currentTrack) {
    return null;
  }

  const trackTitle = currentTrack.title || currentTrack.name || 'Unknown Track';
  const artistName = currentTrack.artist || 'Unknown Artist';
  const displayText = `${trackTitle} - ${artistName}`;

  return (
    <div
      className={cn(
        "fixed z-50 flex items-center gap-2 px-3 py-2",
        "bg-background/95 backdrop-blur-sm",
        "border border-cheese/30 rounded-lg",
        "shadow-lg shadow-cheese/10",
        isMobile
          ? "bottom-0 left-0 right-0 mx-2 mb-2 rounded-lg"
          : "bottom-4 right-4 w-80"
      )}
    >
      {/* CHEESE branding */}
      <img src={cheeseLogo} alt="CHEESE" className="h-5 w-5 flex-shrink-0" />

      {/* Track info - truncated */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <p className="text-sm font-medium truncate text-foreground">
          {displayText}
        </p>
      </div>

      {/* Transport controls */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handlePrevious}
          aria-label="Previous track"
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handlePlayPause}
          aria-label={playbackState.isPlaying ? "Pause" : "Play"}
        >
          {playbackState.isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleNext}
          aria-label="Next track"
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>

      {/* Time display - hide on very small screens */}
      <span className="text-xs text-muted-foreground flex-shrink-0 hidden sm:block">
        {formatTime(playbackState.currentTime)}/{formatTime(playbackState.duration)}
      </span>

      {/* Expand button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 flex-shrink-0"
        onClick={onExpand}
        aria-label="Expand player"
      >
        <Maximize2 className="h-4 w-4" />
      </Button>

      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
        onClick={handleClose}
        aria-label="Close player"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
