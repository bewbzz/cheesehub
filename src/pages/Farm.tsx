import { useState } from "react";
import { useParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, FolderOpen, Plus } from "lucide-react";
import { Layout } from "@/components/Layout";
import { BrowseFarms } from "@/components/farm/BrowseFarms";
import { MyFarms } from "@/components/farm/MyFarms";
import { CreateFarm } from "@/components/farm/CreateFarm";
import { FarmDetail } from "@/components/farm/FarmDetail";
import cheeseFarmOrb from "@/assets/cheesefarm.png";
import { playRandomFart } from "@/lib/fartSounds";

export default function Farm() {
  const { farmName } = useParams<{ farmName: string }>();
  const [activeTab, setActiveTab] = useState("browse");

  const handleCreateFarm = () => {
    setActiveTab("create");
  };

  // If viewing a specific farm, show detail view
  if (farmName) {
    return (
      <Layout>
        <div className="min-h-screen">
          <div className="container py-8">
            <FarmDetail />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen">
        {/* Hero Section */}
        <section className="relative py-20 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
          <div className="container relative z-10">
            <div className="flex flex-col items-center gap-8">
              <div className="h-32 w-32 animate-float cheese-bubble rounded-full flex items-center justify-center cursor-pointer" onClick={playRandomFart}>
                <img src={cheeseFarmOrb} alt="CHEESE" className="w-28 h-28 object-contain" />
              </div>

              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl">🌱</span>
                  <h1 className="text-3xl md:text-4xl font-bold">
                    <span className="text-cheese">CHEESE</span>
                    <span className="text-foreground">Farm</span>
                  </h1>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese border border-cheese/30 leading-none">BETA</span>
                  <span className="text-2xl">🌱</span>
                </div>
                <p className="text-muted-foreground max-w-lg mx-auto">
                  Create and Manage V2 Non-Custodial NFT Farms Utilizing WAXDAOs Battle Tested Smart Contract. Reward Your Community With Tokens While the NFTs Never Leave their Wallet.
                </p>
              </div>
            </div>
          </div>
        </section>

        <main className="container pb-12 space-y-8">

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full max-w-lg mx-auto grid-cols-3 bg-muted/50">
              <TabsTrigger value="browse" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline">Browse</span>
              </TabsTrigger>
              <TabsTrigger value="my-farms" className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                <span className="hidden sm:inline">My Farms</span>
              </TabsTrigger>
              <TabsTrigger value="create" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Create</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="browse" className="mt-6">
              <BrowseFarms />
            </TabsContent>

            <TabsContent value="my-farms" className="mt-6">
              <MyFarms onCreateFarm={handleCreateFarm} />
            </TabsContent>

            <TabsContent value="create" className="mt-6">
              <CreateFarm />
            </TabsContent>
          </Tabs>

          <p className="text-muted-foreground text-sm text-center max-w-lg mx-auto mt-8">
            Powered by the{" "}
            <a href="https://waxblock.io/account/farms.waxdao" target="_blank" rel="noopener noreferrer" className="text-cheese hover:text-cheese-dark underline underline-offset-2 font-semibold">
              FARMS.WAXDAO
            </a>{" "}
            Smart Contract
          </p>
        </main>
      </div>
    </Layout>
  );
}
