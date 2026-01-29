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
import { cn } from '@/lib/utils';

interface CheeseAmpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMinimize?: () => void;
  minimized?: boolean;
}

export function CheeseAmpDialog({ 
  open, 
  onOpenChange, 
  onMinimize,
  minimized = false 
}: CheeseAmpDialogProps) {
  const handleClose = () => {
    getAudioPlayer().stop();
    onOpenChange(false);
  };

  const handleMinimize = () => {
    // Just hide the dialog - music keeps playing
    onMinimize?.();
  };

  // Prevent Radix from triggering onOpenChange directly - we control open state ourselves
  // This ensures we can differentiate between minimize (keep playing) and close (stop)
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Dialog wants to close - only allow through our explicit close handler
      // This prevents accidental closes from stopping music
      return;
    }
    onOpenChange(newOpen);
  };

  return (
    <div className={minimized ? "[&_[data-radix-dialog-overlay]]:hidden" : ""}>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent 
          className={cn(
            "sm:max-w-[700px] max-h-[90vh] overflow-hidden [&>button]:hidden",
            minimized && "opacity-0 pointer-events-none scale-95"
          )}
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
    </div>
  );
}
