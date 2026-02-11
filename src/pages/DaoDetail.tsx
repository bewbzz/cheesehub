import { useParams, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { DaoDetail as DaoDetailComponent } from "@/components/dao/DaoDetail";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DaoDetailPage() {
  const { daoName } = useParams<{ daoName: string }>();

  return (
    <Layout>
      <div className="min-h-screen">
        <div className="container py-8">
          <Button variant="ghost" asChild className="mb-4 text-muted-foreground hover:text-foreground">
            <Link to="/dao">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to DAOs
            </Link>
          </Button>
          <DaoDetailComponent pageMode daoName={daoName} />
        </div>
      </div>
    </Layout>
  );
}
