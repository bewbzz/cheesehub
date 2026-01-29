import { useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheeseAmpPlayer } from './CheeseAmpPlayer';
import { getAudioPlayer } from '@/lib/musicPlayer';
import { Music2, Minus, X } from 'lucide-react';

interface CheeseAmpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMinimize?: () => void;
}

export function CheeseAmpDialog({ open, onOpenChange, onMinimize }: CheeseAmpDialogProps) {
  // Track if we're minimizing to prevent stopping music
  const isMinimizingRef = useRef(false);

  const handleClose = () => {
    getAudioPlayer().stop();
    onOpenChange(false);
  };

  const handleMinimize = () => {
    isMinimizingRef.current = true;
    onMinimize?.();
    // Reset after a tick
    setTimeout(() => {
      isMinimizingRef.current = false;
    }, 100);
  };

  // Only stop music when explicitly closing (X button), not when minimizing
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isMinimizingRef.current) {
      // Dialog is closing and NOT minimizing - stop the music
      getAudioPlayer().stop();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="sm:max-w-[700px] max-h-[90vh] overflow-hidden [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="relative pr-16">
          <div className="absolute right-0 top-0 flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-sm opacity-70 hover:opacity-100"
              onClick={handleMinimize}
              title="Minimize - music keeps playing"
            >
              <Minus className="h-4 w-4" />
              <span className="sr-only">Minimize</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-sm opacity-70 hover:opacity-100"
              onClick={handleClose}
              title="Close - stops music"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Music2 className="h-6 w-6 text-cheese" />
            <span>
              <span className="text-cheese cheese-text-glow">CHEESE</span>
              <span className="text-foreground">Amp</span>
            </span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Play music NFTs from your collection
          </DialogDescription>
        </DialogHeader>
        
        <div className="h-[600px] overflow-y-auto">
          <CheeseAmpPlayer />
        </div>
      </DialogContent>
    </Dialog>
  );
}
