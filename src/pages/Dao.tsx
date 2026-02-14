import { Layout } from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrowseDaos } from "@/components/dao/BrowseDaos";
import { CreateDao } from "@/components/dao/CreateDao";
import { MyDaos } from "@/components/dao/MyDaos";
import { Users, Plus, User } from "lucide-react";
import cheeseLogo from "@/assets/cheese-logo.png";

export default function Dao() {
  return (
    <Layout>
      
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="container relative z-10">
          <div className="flex flex-col items-center text-center">
            <div className="h-32 w-32 animate-float cheese-glow rounded-full flex items-center justify-center">
              <img src={cheeseLogo} alt="CHEESE" className="w-24 h-24 object-contain" />
            </div>

            <h1 className="text-3xl md:text-4xl font-bold">
              <span className="text-cheese">CHEESE</span>
              <span className="text-foreground">Dao</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
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

        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>
            Powered by the{" "}
            <a 
              href="https://wax.bloks.io/account/dao.waxdao?loadContract=true&tab=Tables&account=dao.waxdao&scope=dao.waxdao&limit=100" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-cheese hover:underline"
            >
              DAO.WAXDAO
            </a>{" "}
            smart contract.
          </p>
        </div>
      </section>
    </Layout>
  );
}
