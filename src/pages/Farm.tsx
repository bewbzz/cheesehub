import { useState } from "react";
import { useParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, FolderOpen, Plus } from "lucide-react";
import { Layout } from "@/components/Layout";
import { BrowseFarms } from "@/components/farm/BrowseFarms";
import { MyFarms } from "@/components/farm/MyFarms";
import { CreateFarm } from "@/components/farm/CreateFarm";
import { FarmDetail } from "@/components/farm/FarmDetail";
import cheeseLogo from "@/assets/cheese-logo.png";

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
            <div className="flex flex-col items-center text-center">
              <div className="h-32 w-32 animate-float cheese-glow rounded-full flex items-center justify-center">
                <img src={cheeseLogo} alt="CHEESE" className="w-24 h-24 object-contain" />
              </div>

              <h1 className="mt-8 font-display text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
                <span className="text-primary cheese-text-glow">CHEESE</span>
                <span className="text-foreground">Farm</span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
                Create and manage V2 NFT staking farms on WaxDAO. Reward your community 
                with tokens for staking their NFTs.
              </p>
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
        </main>
      </div>
    </Layout>
  );
}
