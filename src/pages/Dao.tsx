import { Header } from "@/components/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrowseDaos } from "@/components/dao/BrowseDaos";
import { CreateDao } from "@/components/dao/CreateDao";
import { MyDaos } from "@/components/dao/MyDaos";
import { Users, Plus, User } from "lucide-react";

export default function Dao() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-cheese/5 to-transparent" />
        <div className="container relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="text-cheese">CHEESE</span>
              <span className="text-foreground">Dao</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Create and manage decentralized autonomous organizations on WAX.
              Propose, vote, and govern your community with on-chain transparency.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="container pb-16">
        <Tabs defaultValue="browse" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-3 mb-8">
            <TabsTrigger value="browse" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Browse DAOs</span>
              <span className="sm:hidden">Browse</span>
            </TabsTrigger>
            <TabsTrigger value="create" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Create DAO</span>
              <span className="sm:hidden">Create</span>
            </TabsTrigger>
            <TabsTrigger value="my-daos" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">My DAOs</span>
              <span className="sm:hidden">Mine</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="browse">
            <BrowseDaos />
          </TabsContent>

          <TabsContent value="create">
            <CreateDao />
          </TabsContent>

          <TabsContent value="my-daos">
            <MyDaos />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
