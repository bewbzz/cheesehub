import { Header } from "@/components/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateLock } from "@/components/locker/CreateLock";
import { MyLocks } from "@/components/locker/MyLocks";
import { Lock, List } from "lucide-react";

export default function Locker() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-cheese-gradient mb-2">Token Locker</h1>
          <p className="text-muted-foreground">
            Lock your tokens securely on the WAX blockchain using WaxDAO smart contracts
          </p>
        </div>

        <Tabs defaultValue="create" className="space-y-6">
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

          <TabsContent value="create" className="max-w-2xl">
            <CreateLock />
          </TabsContent>

          <TabsContent value="my-locks">
            <MyLocks />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
