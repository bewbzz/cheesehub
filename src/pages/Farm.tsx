import { useState } from "react";
import { useParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sprout, Search, FolderOpen, Plus, HelpCircle } from "lucide-react";
import { Layout } from "@/components/Layout";
import { BrowseFarms } from "@/components/farm/BrowseFarms";
import { MyFarms } from "@/components/farm/MyFarms";
import { CreateFarm } from "@/components/farm/CreateFarm";
import { FarmFaq } from "@/components/farm/FarmFaq";
import { FarmDetail } from "@/components/farm/FarmDetail";

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
        <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
          <div className="container py-8">
            <FarmDetail />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
        <div className="container py-8 space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-3">
              <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20">
                <Sprout className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-4xl font-bold">
                <span className="text-primary">CHEESE</span>
                <span className="text-foreground">Farm</span>
              </h1>
            </div>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Create and manage V2 NFT staking farms on WaxDAO. Reward your community 
              with tokens for staking their NFTs.
            </p>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-4 bg-muted/50">
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
              <TabsTrigger value="faq" className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4" />
                <span className="hidden sm:inline">FAQ</span>
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

            <TabsContent value="faq" className="mt-6">
              <FarmFaq />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
