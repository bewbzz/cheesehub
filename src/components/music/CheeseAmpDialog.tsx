import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CheeseAmpPlayer } from './CheeseAmpPlayer';
import { Music2 } from 'lucide-react';

interface CheeseAmpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CheeseAmpDialog({ open, onOpenChange }: CheeseAmpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[700px] max-h-[90vh] overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
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
