import { Header } from "@/components/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateLock } from "@/components/locker/CreateLock";
import { MyLocks } from "@/components/locker/MyLocks";
import { Lock, List } from "lucide-react";

export default function Locker() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-3">
            <span className="text-cheese">CHEESE</span>
            <span className="text-foreground">Lock</span>
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Lock your tokens securely on the WAX blockchain using WaxDAO smart contracts
          </p>
        </div>

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
      </main>
    </div>
  );
}
