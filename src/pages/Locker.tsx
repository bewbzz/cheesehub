import { Layout } from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateLock } from "@/components/locker/CreateLock";
import { MyLocks } from "@/components/locker/MyLocks";
import { CreateLiquidityLock } from "@/components/locker/CreateLiquidityLock";
import { MyLiquidityLocks } from "@/components/locker/MyLiquidityLocks";
import { Lock, List, Coins, Droplets } from "lucide-react";
import cheeseLogo from "@/assets/cheese-logo.png";
import cheeseLockOrb from "@/assets/cheeselock.png";

export default function Locker() {
  return (
    <Layout>
      
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="container relative z-10">
           <div className="flex flex-col items-center gap-8">
            <div className="h-32 w-32 animate-float cheese-glow rounded-full flex items-center justify-center">
              <img src={cheeseLockOrb} alt="CHEESE" className="w-24 h-24 object-contain" />
            </div>

            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl">🔐</span>
                <h1 className="text-3xl md:text-4xl font-bold">
                  <span className="text-cheese">CHEESE</span>
                  <span className="text-foreground">Lock</span>
                </h1>
                <span className="text-2xl">🔐</span>
              </div>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Time Lock Tokens and LP Tokens Utilizing WAXDAOs Battle Tested Smart Contract.
              </p>
            </div>
          </div>
        </div>
      </section>

      <main className="container pb-12">
        {/* Outer Tabs: Token Lock vs Liquidity Lock */}
        <Tabs defaultValue="token" className="space-y-8">
          <div className="flex justify-center">
            <TabsList className="grid w-full max-w-lg grid-cols-2 h-14">
              <TabsTrigger value="token" className="gap-2 text-base font-semibold h-12">
                <Coins className="h-5 w-5" />
                Token Lock
              </TabsTrigger>
              <TabsTrigger value="liquidity" className="gap-2 text-base font-semibold h-12">
                <Droplets className="h-5 w-5" />
                Liquidity Lock
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Token Lock Content */}
          <TabsContent value="token" className="space-y-8">
            <Tabs defaultValue="create" className="space-y-8">
              <div className="flex justify-center">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                  <TabsTrigger value="create" className="gap-2">
                    <Lock className="h-4 w-4" />
                    Create Lock
                  </TabsTrigger>
                  <TabsTrigger value="my-locks" className="gap-2">
                    <List className="h-4 w-4" />
                    My Locks
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="create" className="flex justify-center">
                <div className="w-full max-w-lg">
                  <CreateLock />
                </div>
              </TabsContent>

              <TabsContent value="my-locks">
                <MyLocks />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Liquidity Lock Content */}
          <TabsContent value="liquidity" className="space-y-8">
            <Tabs defaultValue="create" className="space-y-8">
              <div className="flex justify-center">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                  <TabsTrigger value="create" className="gap-2">
                    <Lock className="h-4 w-4" />
                    Create Lock
                  </TabsTrigger>
                  <TabsTrigger value="my-locks" className="gap-2">
                    <List className="h-4 w-4" />
                    My Locks
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="create" className="flex justify-center">
                <div className="w-full max-w-lg">
                  <CreateLiquidityLock />
                </div>
              </TabsContent>

              <TabsContent value="my-locks">
                <MyLiquidityLocks />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>

        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>
            Powered by the{" "}
            <a 
              href="https://wax.bloks.io/account/waxdaolocker?loadContract=true&tab=Tables&account=waxdaolocker&scope=waxdaolocker&limit=100" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-cheese hover:underline"
            >
              WAXDAOLOCKER
            </a>{" "}
            smart contract.
          </p>
        </div>
      </main>
    </Layout>
  );
}
