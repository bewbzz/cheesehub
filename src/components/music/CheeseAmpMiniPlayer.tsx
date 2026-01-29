import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Play, Pause, SkipBack, SkipForward, Maximize2, X } from 'lucide-react';
import { getAudioPlayer, formatTime, type PlaybackState } from '@/lib/musicPlayer';
import { useIsMobile } from '@/hooks/use-mobile';
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

  const miniPlayer = (
    <div
      style={{
        position: 'fixed',
        bottom: isMobile ? '8px' : '16px',
        right: isMobile ? '8px' : '16px',
        left: isMobile ? '8px' : 'auto',
        width: isMobile ? 'auto' : '320px',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 193, 7, 0.3)',
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(255, 193, 7, 0.1)',
      }}
    >
      {/* CHEESE branding */}
      <img src={cheeseLogo} alt="CHEESE" style={{ height: '20px', width: '20px', flexShrink: 0 }} />

      {/* Track info - truncated */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <p style={{ 
          fontSize: '14px', 
          fontWeight: 500, 
          whiteSpace: 'nowrap', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis',
          color: 'white',
          margin: 0,
        }}>
          {displayText}
        </p>
      </div>

      {/* Transport controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white hover:text-cheese hover:bg-white/10"
          onClick={handlePrevious}
          aria-label="Previous track"
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white hover:text-cheese hover:bg-white/10"
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
          className="h-8 w-8 text-white hover:text-cheese hover:bg-white/10"
          onClick={handleNext}
          aria-label="Next track"
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>

      {/* Time display - hide on very small screens */}
      {!isMobile && (
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', flexShrink: 0 }}>
          {formatTime(playbackState.currentTime)}/{formatTime(playbackState.duration)}
        </span>
      )}

      {/* Expand button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-white hover:text-cheese hover:bg-white/10"
        onClick={onExpand}
        aria-label="Expand player"
      >
        <Maximize2 className="h-4 w-4" />
      </Button>

      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-white/70 hover:text-red-400 hover:bg-white/10"
        onClick={handleClose}
        aria-label="Close player"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );

  // Use portal to render at document body level, ensuring correct positioning
  return createPortal(miniPlayer, document.body);
}
