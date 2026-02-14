import { Layout } from "@/components/Layout";
import { SlotCalendar } from "@/components/bannerads/SlotCalendar";
import { Megaphone } from "lucide-react";
import cheeseLogo from "@/assets/cheese-logo.png";

const BannerAds = () => {
  return (
    <Layout>
      <section className="container py-12 md:py-20">
        <div className="flex flex-col items-center gap-8">
          {/* Floating Cheese Orb */}
          <div className="h-40 w-40 md:h-48 md:w-48 animate-float cheese-glow rounded-full flex items-center justify-center">
            <img src={cheeseLogo} alt="CHEESE Logo" className="w-32 md:w-40 object-contain" />
          </div>

          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Megaphone className="h-8 w-8 text-cheese" />
              <h1 className="text-3xl md:text-4xl font-bold">
                <span className="text-cheese">CHEESE</span>
                <span className="text-foreground">Ads</span>
              </h1>
              <Megaphone className="h-8 w-8 text-cheese" />
            </div>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Rent banner ad slots on the CHEESEHub homepage. Each day has two positions — pay with WAX.
            </p>
          </div>
          <SlotCalendar />
        </div>
      </section>
    </Layout>
  );
};

export default BannerAds;
