import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DaoInfo, buildSetProfileActionWithSocials, DaoSocials } from "@/lib/dao";
import { useWax } from "@/context/WaxContext";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  Save, 
  ChevronDown,
  Globe,
  MessageCircle,
  Youtube,
  BookOpen,
  Link as LinkIcon
} from "lucide-react";

// Twitter/X icon component since lucide doesn't have it
function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// Discord icon component
function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  );
}

// Telegram icon component
function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  );
}

interface EditDaoProfileProps {
  dao: DaoInfo;
  open: boolean;
  onClose: () => void;
  onProfileUpdated: () => void;
}

export function EditDaoProfile({ dao, open, onClose, onProfileUpdated }: EditDaoProfileProps) {
  const { session, accountName } = useWax();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [socialsOpen, setSocialsOpen] = useState(false);

  // Form state
  const [description, setDescription] = useState(dao.description || "");
  const [avatar, setAvatar] = useState(dao.logo || "");
  const [coverImage, setCoverImage] = useState(dao.cover_image || "");
  const [socials, setSocials] = useState<DaoSocials>({
    twitter: dao.socials?.twitter || "",
    discord: dao.socials?.discord || "",
    telegram: dao.socials?.telegram || "",
    website: dao.socials?.website || "",
    youtube: dao.socials?.youtube || "",
    medium: dao.socials?.medium || "",
    atomichub: dao.socials?.atomichub || "",
    waxdao: dao.socials?.waxdao || "",
  });

  const handleSocialChange = (key: keyof DaoSocials, value: string) => {
    setSocials(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!session || !accountName) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to update the DAO profile",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Ensure all socials fields are present as strings
      const sanitizedSocials = {
        twitter: socials?.twitter || "",
        discord: socials?.discord || "",
        telegram: socials?.telegram || "",
        website: socials?.website || "",
        youtube: socials?.youtube || "",
        medium: socials?.medium || "",
        atomichub: socials?.atomichub || "",
        waxdao: socials?.waxdao || "",
      };
      
      const action = buildSetProfileActionWithSocials(
        accountName,
        dao.dao_name,
        description || "",
        avatar || "",
        coverImage || "",
        sanitizedSocials
      );
      
      console.log("SetProfile action data:", JSON.stringify(action.data, null, 2));

      await session.transact({ actions: [action] });

      toast({
        title: "Profile Updated",
        description: `Successfully updated ${dao.dao_name} profile`,
      });

      onProfileUpdated();
      onClose();
    } catch (error) {
      console.error("Failed to update DAO profile:", error);
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update DAO profile",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Edit {dao.dao_name} Profile
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Enter a description for your DAO..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[100px] resize-none"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {description.length}/500
            </p>
          </div>

          {/* Avatar */}
          <div className="space-y-2">
            <Label htmlFor="avatar">Avatar (IPFS Hash or URL)</Label>
            <Input
              id="avatar"
              placeholder="QmHash... or https://..."
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Enter an IPFS hash (starting with Qm or bafy) or a direct image URL
            </p>
          </div>

          {/* Cover Image */}
          <div className="space-y-2">
            <Label htmlFor="coverImage">Cover Image (IPFS Hash or URL)</Label>
            <Input
              id="coverImage"
              placeholder="QmHash... or https://..."
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
            />
          </div>

          {/* Social Links - Collapsible */}
          <Collapsible open={socialsOpen} onOpenChange={setSocialsOpen}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full justify-between border-cheese/50 text-cheese hover:bg-cheese/10"
              >
                <span className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4" />
                  Social Links
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${socialsOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              {/* Twitter */}
              <div className="space-y-1">
                <Label htmlFor="twitter" className="flex items-center gap-2 text-sm">
                  <TwitterIcon className="h-4 w-4" />
                  Twitter / X
                </Label>
                <Input
                  id="twitter"
                  placeholder="https://twitter.com/yourhandle"
                  value={socials.twitter}
                  onChange={(e) => handleSocialChange("twitter", e.target.value)}
                />
              </div>

              {/* Discord */}
              <div className="space-y-1">
                <Label htmlFor="discord" className="flex items-center gap-2 text-sm">
                  <DiscordIcon className="h-4 w-4" />
                  Discord
                </Label>
                <Input
                  id="discord"
                  placeholder="https://discord.gg/invite"
                  value={socials.discord}
                  onChange={(e) => handleSocialChange("discord", e.target.value)}
                />
              </div>

              {/* Telegram */}
              <div className="space-y-1">
                <Label htmlFor="telegram" className="flex items-center gap-2 text-sm">
                  <TelegramIcon className="h-4 w-4" />
                  Telegram
                </Label>
                <Input
                  id="telegram"
                  placeholder="https://t.me/yourgroup"
                  value={socials.telegram}
                  onChange={(e) => handleSocialChange("telegram", e.target.value)}
                />
              </div>

              {/* Website */}
              <div className="space-y-1">
                <Label htmlFor="website" className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4" />
                  Website
                </Label>
                <Input
                  id="website"
                  placeholder="https://yourwebsite.com"
                  value={socials.website}
                  onChange={(e) => handleSocialChange("website", e.target.value)}
                />
              </div>

              {/* YouTube */}
              <div className="space-y-1">
                <Label htmlFor="youtube" className="flex items-center gap-2 text-sm">
                  <Youtube className="h-4 w-4" />
                  YouTube
                </Label>
                <Input
                  id="youtube"
                  placeholder="https://youtube.com/@yourchannel"
                  value={socials.youtube}
                  onChange={(e) => handleSocialChange("youtube", e.target.value)}
                />
              </div>

              {/* Medium */}
              <div className="space-y-1">
                <Label htmlFor="medium" className="flex items-center gap-2 text-sm">
                  <BookOpen className="h-4 w-4" />
                  Medium
                </Label>
                <Input
                  id="medium"
                  placeholder="https://medium.com/@yourblog"
                  value={socials.medium}
                  onChange={(e) => handleSocialChange("medium", e.target.value)}
                />
              </div>

              {/* AtomicHub */}
              <div className="space-y-1">
                <Label htmlFor="atomichub" className="flex items-center gap-2 text-sm">
                  <MessageCircle className="h-4 w-4" />
                  AtomicHub
                </Label>
                <Input
                  id="atomichub"
                  placeholder="https://wax.atomichub.io/explorer/collection/..."
                  value={socials.atomichub}
                  onChange={(e) => handleSocialChange("atomichub", e.target.value)}
                />
              </div>

              {/* WaxDAO */}
              <div className="space-y-1">
                <Label htmlFor="waxdao" className="flex items-center gap-2 text-sm">
                  <MessageCircle className="h-4 w-4" />
                  WaxDAO
                </Label>
                <Input
                  id="waxdao"
                  placeholder="https://waxdao.io/dao/..."
                  value={socials.waxdao}
                  onChange={(e) => handleSocialChange("waxdao", e.target.value)}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="bg-cheese hover:bg-cheese/90 text-cheese-foreground"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Profile
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
