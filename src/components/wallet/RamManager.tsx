import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useWax } from '@/context/WaxContext';
import { Loader2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { AccountResources, formatBytes } from './WalletResources';

interface RamManagerProps {
  resources: AccountResources | null;
  onTransactionComplete?: () => void;
}

export function RamManager({ resources, onTransactionComplete }: RamManagerProps) {
  const { session, accountName } = useWax();
  const [isTransacting, setIsTransacting] = useState(false);
  
  // Buy RAM state
  const [buyReceiver, setBuyReceiver] = useState('');
  const [buyMode, setBuyMode] = useState<'wax' | 'bytes'>('wax');
  const [buyAmount, setBuyAmount] = useState('');
  
  // Sell RAM state
  const [sellBytes, setSellBytes] = useState('');

  useEffect(() => {
    if (accountName) {
      setBuyReceiver(accountName);
    }
  }, [accountName]);

  // Estimated bytes for WAX amount (rough estimate: 1 WAX ≈ 1.5KB at current prices)
  const estimatedBytes = buyMode === 'wax' 
    ? Math.floor((parseFloat(buyAmount) || 0) * 1500)
    : parseInt(buyAmount) || 0;

  const handleBuyRam = async () => {
    if (!session || !buyReceiver || !buyAmount) return;
    
    setIsTransacting(true);
    try {
      const actions = buyMode === 'wax' 
        ? [{
            account: 'eosio',
            name: 'buyram',
            authorization: [session.permissionLevel],
            data: {
              payer: accountName,
              receiver: buyReceiver,
              quant: `${parseFloat(buyAmount).toFixed(8)} WAX`,
            },
          }]
        : [{
            account: 'eosio',
            name: 'buyrambytes',
            authorization: [session.permissionLevel],
            data: {
              payer: accountName,
              receiver: buyReceiver,
              bytes: parseInt(buyAmount),
            },
          }];

      await session.transact({ actions });

      toast.success('RAM purchased successfully!');
      setBuyAmount('');
      onTransactionComplete?.();
    } catch (error: any) {
      console.error('Buy RAM error:', error);
      toast.error(error?.message || 'Failed to buy RAM');
    } finally {
      setIsTransacting(false);
    }
  };

  const handleSellRam = async () => {
    if (!session || !sellBytes) return;
    
    const bytes = parseInt(sellBytes);
    if (bytes <= 0) {
      toast.error('Enter a valid amount of bytes to sell');
      return;
    }

    setIsTransacting(true);
    try {
      const actions = [{
        account: 'eosio',
        name: 'sellram',
        authorization: [session.permissionLevel],
        data: {
          account: accountName,
          bytes: bytes,
        },
      }];

      await session.transact({ actions });

      toast.success('RAM sold successfully!');
      setSellBytes('');
      onTransactionComplete?.();
    } catch (error: any) {
      console.error('Sell RAM error:', error);
      toast.error(error?.message || 'Failed to sell RAM');
    } finally {
      setIsTransacting(false);
    }
  };

  const isValidReceiver = buyReceiver.length > 0 && /^[a-z1-5.]{1,12}$/.test(buyReceiver);
  const availableRam = resources ? resources.ram_quota - resources.ram_usage : 0;

  return (
    <Tabs defaultValue="buy" className="w-full">
      <TabsList className="w-full">
        <TabsTrigger value="buy" className="flex-1">Buy RAM</TabsTrigger>
        <TabsTrigger value="sell" className="flex-1">Sell RAM</TabsTrigger>
      </TabsList>

      <TabsContent value="buy" className="space-y-4 mt-4">
        {/* RAM Receiver */}
        <div className="space-y-2">
          <Label>RAM Receiver:</Label>
          <div className="relative">
            <Input
              placeholder="Enter WAX account"
              value={buyReceiver}
              onChange={(e) => setBuyReceiver(e.target.value.toLowerCase())}
              className="pr-10"
            />
            {buyReceiver.length > 0 && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isValidReceiver ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <X className="h-4 w-4 text-destructive" />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Buy Mode */}
        <div className="space-y-2">
          <Label>Buy in WAX or Bytes?</Label>
          <RadioGroup
            value={buyMode}
            onValueChange={(v) => {
              setBuyMode(v as 'wax' | 'bytes');
              setBuyAmount('');
            }}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="wax" id="wax" />
              <Label htmlFor="wax" className="cursor-pointer">WAX</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="bytes" id="bytes" />
              <Label htmlFor="bytes" className="cursor-pointer">Bytes</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Amount */}
        <div className="space-y-2">
          <Label>
            {buyMode === 'wax' ? 'Amount of RAM to Buy in WAX' : 'Amount of Bytes to Buy'}
          </Label>
          <Input
            type="number"
            placeholder={buyMode === 'wax' ? 'Amount of RAM to Buy in WAX' : 'Amount of Bytes'}
            value={buyAmount}
            onChange={(e) => setBuyAmount(e.target.value)}
            min={0}
            step={buyMode === 'wax' ? 0.00000001 : 1}
          />
          {buyMode === 'wax' && buyAmount && (
            <p className="text-xs text-muted-foreground">≈ {formatBytes(estimatedBytes)}</p>
          )}
        </div>

        <Button
          onClick={handleBuyRam}
          disabled={!isValidReceiver || !buyAmount || isTransacting}
          className="w-full bg-cheese hover:bg-cheese-dark text-primary-foreground"
        >
          {isTransacting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Buying RAM...
            </>
          ) : (
            'Buy RAM'
          )}
        </Button>
      </TabsContent>

      <TabsContent value="sell" className="space-y-4 mt-4">
        {/* Available RAM */}
        <div className="p-3 bg-muted/50 rounded-lg text-sm">
          <span className="text-muted-foreground">Available RAM: </span>
          <span className="font-medium">{formatBytes(availableRam)}</span>
          <span className="text-muted-foreground ml-1">({availableRam.toLocaleString()} bytes)</span>
        </div>

        {/* Sell Amount */}
        <div className="space-y-2">
          <Label>Amount of Bytes to Sell</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Bytes to sell"
              value={sellBytes}
              onChange={(e) => setSellBytes(e.target.value)}
              min={0}
              step={1}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSellBytes(availableRam.toString())}
              className="shrink-0"
            >
              Max
            </Button>
          </div>
        </div>

        <Button
          onClick={handleSellRam}
          disabled={!sellBytes || parseInt(sellBytes) <= 0 || isTransacting}
          className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
        >
          {isTransacting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Selling RAM...
            </>
          ) : (
            'Sell RAM'
          )}
        </Button>
      </TabsContent>
    </Tabs>
  );
}
