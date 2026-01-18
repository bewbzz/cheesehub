import { Coins, Send, Flame, Wrench } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { TokenBacking } from './TokenBacking';

export function NFTTools() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="font-display text-3xl font-bold text-foreground flex items-center gap-3">
          <Wrench className="h-8 w-8 text-cheese" />
          NFT Tools
        </h2>
        <p className="text-muted-foreground mt-2">
          Utility tools for managing your NFTs on the WAX blockchain
        </p>
      </div>

      {/* Tools Accordion */}
      <Accordion type="single" collapsible defaultValue="backing" className="space-y-4">
        {/* Token Backing */}
        <AccordionItem value="backing" className="border border-border/50 rounded-xl bg-card/30 px-4">
          <AccordionTrigger className="text-lg font-semibold hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cheese/10">
                <Coins className="h-5 w-5 text-cheese" />
              </div>
              <div className="text-left">
                <span className="block">Token Backing</span>
                <span className="text-sm font-normal text-muted-foreground">
                  Lock CHEESE, WAX, or custom tokens inside your NFTs
                </span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-6">
            <TokenBacking />
          </AccordionContent>
        </AccordionItem>

        {/* Bulk Transfer - Coming Soon */}
        <AccordionItem value="bulk-transfer" className="border border-border/50 rounded-xl bg-card/30 px-4 opacity-60">
          <AccordionTrigger className="text-lg font-semibold hover:no-underline py-4" disabled>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Send className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="text-left">
                <span className="block">Bulk Transfer</span>
                <span className="text-sm font-normal text-muted-foreground">
                  Coming Soon — Send NFTs to multiple recipients
                </span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-6">
            <p className="text-muted-foreground text-sm">
              This feature will allow you to send multiple NFTs to different recipients in a single transaction.
              Perfect for airdrops, rewards distribution, and community giveaways.
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* Burn & Claim - Coming Soon */}
        <AccordionItem value="burn-claim" className="border border-border/50 rounded-xl bg-card/30 px-4 opacity-60">
          <AccordionTrigger className="text-lg font-semibold hover:no-underline py-4" disabled>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Flame className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="text-left">
                <span className="block">Burn & Claim</span>
                <span className="text-sm font-normal text-muted-foreground">
                  Coming Soon — Burn NFTs and claim backed tokens
                </span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-6">
            <p className="text-muted-foreground text-sm">
              This feature will allow you to burn NFTs that have backed tokens and automatically receive
              the locked tokens in your wallet. Great for token-backed collectibles and reward mechanics.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Footer Info */}
      <div className="text-center text-sm text-muted-foreground pt-4">
        <p>
          Powered by the{' '}
          <a
            href="https://wax.bloks.io/account/backbywaxpls"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cheese hover:underline"
          >
            backbywaxpls
          </a>{' '}
          smart contract.
        </p>
      </div>
    </div>
  );
}
