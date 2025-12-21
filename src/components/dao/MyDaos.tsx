import { useEffect, useState } from "react";
import { useWax } from "@/context/WaxContext";
import { DaoCard } from "./DaoCard";
import { DaoInfo, fetchUserDaos } from "@/lib/dao";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Wallet, Users } from "lucide-react";

export function MyDaos() {
  const { session, isConnected, login, accountName } = useWax();
  const [daos, setDaos] = useState<DaoInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (accountName) {
      loadUserDaos();
    }
  }, [accountName]);

  async function loadUserDaos() {
    if (!accountName) return;
    
    setLoading(true);
    try {
      const data = await fetchUserDaos(accountName);
      setDaos(data);
    } catch (error) {
      console.error("Failed to load user DAOs:", error);
    } finally {
      setLoading(false);
    }
  }

  if (!isConnected) {
    return (
      <Card className="max-w-2xl mx-auto bg-card/50 border-border/50">
        <CardContent className="py-12 text-center">
          <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
          <p className="text-muted-foreground mb-6">
            Connect your WAX wallet to see DAOs you're a member of.
          </p>
          <Button onClick={login} className="bg-cheese hover:bg-cheese/90 text-cheese-foreground">
            Connect Wallet
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-cheese" />
      </div>
    );
  }

  if (daos.length === 0) {
    return (
      <Card className="max-w-2xl mx-auto bg-card/50 border-border/50">
        <CardContent className="py-12 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No DAOs Found</h3>
          <p className="text-muted-foreground mb-2">
            You're not a member of any DAOs yet.
          </p>
          <p className="text-sm text-muted-foreground">
            Browse existing DAOs to join, or create your own!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-muted-foreground">
          Showing DAOs for <span className="text-cheese font-medium">{accountName}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {daos.map((dao) => (
          <DaoCard key={dao.dao_name} dao={dao} />
        ))}
      </div>
    </div>
  );
}
