import { useEffect, useState } from "react";
import { DaoCard } from "./DaoCard";
import { DaoInfo, fetchAllDaos } from "@/lib/dao";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";

export function BrowseDaos() {
  const [daos, setDaos] = useState<DaoInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadDaos();
  }, []);

  async function loadDaos() {
    setLoading(true);
    try {
      const data = await fetchAllDaos();
      setDaos(data);
    } catch (error) {
      console.error("Failed to load DAOs:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredDaos = daos.filter((dao) =>
    dao.dao_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    dao.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative max-w-md mx-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search DAOs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-cheese" />
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredDaos.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {searchQuery
              ? "No DAOs match your search."
              : "No DAOs found. Be the first to create one!"}
          </p>
        </div>
      )}

      {/* DAO Grid */}
      {!loading && filteredDaos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDaos.map((dao) => (
            <DaoCard key={dao.dao_name} dao={dao} />
          ))}
        </div>
      )}
    </div>
  );
}
