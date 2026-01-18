import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle } from "lucide-react";

const FAQ_ITEMS = [
  {
    question: "What is the correct format for my farm name?",
    answer: "Farm names must be 12 characters or less and can only contain lowercase letters (a-z), numbers (1-5), and periods. Names cannot start or end with a period, and cannot contain consecutive periods.",
  },
  {
    question: "How much does it cost to create a farm?",
    answer: "You can create a farm by paying 250 WAX, 25,000 WAXDAO tokens, or by using 1 NFT from the Wojak collection (ourwojaksart). These payment options help support the WaxDAO ecosystem.",
  },
  {
    question: "Is there a limit to how many NFTs can be staked in my farm?",
    answer: "There is no hard limit on the number of NFTs that can be staked in a V2 farm. However, you should ensure you have enough reward tokens deposited to cover payouts for all stakers.",
  },
  {
    question: "Where can I view/edit my farms after creation?",
    answer: "You can view your farms in the 'My Farms' tab. To edit or manage your farm (add rewards, extend expiration, etc.), you can also use the WaxDAO interface directly at waxdao.io/v2/farm/[your-farm-name].",
  },
  {
    question: "What do 'Last Update' and 'Claimable Balance' mean?",
    answer: "'Last Update' shows when the farm's payout was last processed. 'Claimable Balance' shows how many tokens stakers can currently claim based on their staking duration and the hourly rate.",
  },
  {
    question: "If someone stakes more NFTs, does their claimable balance restart?",
    answer: "No, staking additional NFTs does not reset the timer for existing stakes. Each NFT's rewards are calculated independently from when it was staked.",
  },
  {
    question: "Why am I getting a 'reward pool insufficient' error?",
    answer: "This error occurs when your farm's reward pool doesn't have enough tokens to pay out claimers. You need to deposit more reward tokens using the 'Add Rewards' feature.",
  },
  {
    question: "How far in the future should I set the expiration date?",
    answer: "Set the expiration date based on how long you want your farm to run. A minimum of 30 days is recommended. You can always extend the expiration later, but you cannot shorten it.",
  },
  {
    question: "I need to extend my farm. What do I do?",
    answer: "Go to your farm's management page and use the 'Extend Farm' feature to set a new expiration date. The new date must be later than the current expiration. There is no additional fee for extending.",
  },
  {
    question: "Can I kick/ban certain users from staking?",
    answer: "V2 farms do not support kicking or banning individual users. All users who hold eligible NFTs can stake in your farm. Consider your stakable asset configuration carefully before creating the farm.",
  },
  {
    question: "I added the wrong token. Can I remove it?",
    answer: "Unfortunately, reward tokens cannot be removed once added to a farm. You can stop adding rewards for that token, and any remaining balance will stay in the farm until claimed or the farm expires.",
  },
  {
    question: "I want to close my farm and get a refund. Is that possible?",
    answer: "WaxDAO does not offer refunds for farm creation fees or deposited reward tokens. All tokens deposited into a farm are committed to that farm. Plan carefully before creating your farm.",
  },
  {
    question: "How do I migrate from a V1 farm to V2?",
    answer: "V1 and V2 farms are separate systems. To migrate, create a new V2 farm with your desired configuration, then ask your stakers to unstake from the V1 farm and stake in the new V2 farm.",
  },
  {
    question: "I'm getting RAM errors when trying to create a farm.",
    answer: "You need sufficient RAM on the WAX blockchain to create a farm. Try buying more RAM through your WAX wallet or a RAM market. You typically need at least 1KB of RAM for basic operations.",
  },
  {
    question: "Can I have multiple reward tokens?",
    answer: "Yes! V2 farms support up to 3 different reward tokens. You can configure different tokens when creating the farm, allowing you to reward stakers with multiple tokens simultaneously.",
  },
  {
    question: "How often are rewards paid out?",
    answer: "Rewards accumulate continuously based on the hourly rate you set. The payout interval determines how often the farm processes payouts, but stakers can claim anytime after the minimum interval.",
  },
  {
    question: "Can I integrate royalties from my collection?",
    answer: "V2 farms don't directly integrate with AtomicHub royalties. However, you can manually deposit royalty earnings as rewards into your farm to share them with stakers.",
  },
  {
    question: "Do I need to authorize the farm contract for my collection?",
    answer: "No, V2 farms don't require collection authorization. Users stake their NFTs directly to the farm contract, which holds them in custody during the staking period.",
  },
  {
    question: "Can an NFT be staked in multiple farms?",
    answer: "No, each NFT can only be staked in one farm at a time. The NFT is transferred to the farm contract when staked and returned when unstaked.",
  },
  {
    question: "What happens if I transfer a staked NFT?",
    answer: "Staked NFTs are held by the farm contract and cannot be transferred while staked. Users must unstake their NFTs first before they can transfer or sell them.",
  },
  {
    question: "How long until I can claim my rewards?",
    answer: "You can claim rewards after the payout interval has passed since your last claim or since you staked. The interval is set by the farm creator (1 hour to 30 days).",
  },
  {
    question: "Are my staked NFTs safe?",
    answer: "V2 farms are non-custodial in the sense that only you can unstake your NFTs. The smart contract ensures NFTs can only be returned to the original staker. WaxDAO has been audited and running since 2021.",
  },
  {
    question: "What are the different farm types?",
    answer: "Collections: stake any NFT from specified collections. Schemas: stake NFTs from specific schemas within collections. Templates: stake specific template IDs. Attributes: stake NFTs with matching attribute key/value pairs.",
  },
];

export function FarmFaq() {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-primary" />
          Frequently Asked Questions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {FAQ_ITEMS.map((item, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-left hover:text-primary">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
