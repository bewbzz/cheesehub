import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { CheeseAmpPlayer } from './CheeseAmpPlayer';
import { getAudioPlayer } from '@/lib/musicPlayer';
import { Music2, Minus, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface CheeseAmpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMinimize?: () => void;
}

export function CheeseAmpDialog({ open, onOpenChange, onMinimize }: CheeseAmpDialogProps) {
  const isMobile = useIsMobile();
  
  const handleClose = () => {
    getAudioPlayer().stop();
    onOpenChange(false);
  };

  const handleMinimize = () => {
    onMinimize?.();
  };

  const headerContent = (
    <div className="relative pr-16">
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
      <div className="text-xl flex items-center gap-2">
        <Music2 className="h-6 w-6 text-cheese" />
        <span>
          <span className="text-cheese cheese-text-glow">CHEESE</span>
          <span className="text-foreground">Amp</span>
        </span>
      </div>
    </div>
  );

  // Mobile: Use full-screen Sheet
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent 
          side="right" 
          className="w-full sm:max-w-full p-4 flex flex-col [&>button]:hidden"
        >
          <SheetHeader className="shrink-0">
            <SheetTitle asChild>{headerContent}</SheetTitle>
            <SheetDescription className="sr-only">
              Play music NFTs from your collection
            </SheetDescription>
          </SheetHeader>
          
          <div className="flex-1 overflow-y-auto mt-4 -mx-4 px-4">
            <CheeseAmpPlayer />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Use centered Dialog
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[700px] max-h-[90vh] overflow-hidden [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle asChild>{headerContent}</DialogTitle>
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
