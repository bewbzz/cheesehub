import { Header } from "@/components/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateLock } from "@/components/locker/CreateLock";
import { MyLocks } from "@/components/locker/MyLocks";
import { Lock, List } from "lucide-react";
import { BackgroundDecorations } from "@/components/drops/BackgroundDecorations";
import cheeseLogo from "@/assets/cheese-logo.png";

export default function Locker() {
  return (
    <div className="min-h-screen bg-background relative">
      <BackgroundDecorations />
      <Header />
      
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
              <span className="text-foreground">Lock</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Lock your tokens securely on the WAX blockchain using WaxDAO smart contracts
            </p>
          </div>
        </div>
      </section>

      <main className="container pb-12">

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
            <div className="w-full max-w-2xl">
              <CreateLock />
            </div>
          </TabsContent>

          <TabsContent value="my-locks">
            <MyLocks />
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
    </div>
  );
}
