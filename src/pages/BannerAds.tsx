import { Layout } from "@/components/Layout";
import { SlotCalendar } from "@/components/bannerads/SlotCalendar";

import cheeseLogo from "@/assets/cheese-logo.png";

const BannerAds = () => {
  return (
    <Layout>
      <section className="container py-12 md:py-20">
        <div className="flex flex-col items-center gap-8">
          {/* Floating Cheese Orb */}
          <div className="h-32 w-32 animate-float cheese-glow rounded-full flex items-center justify-center">
            <img src={cheeseLogo} alt="CHEESE Logo" className="w-24 h-24 object-contain" />
          </div>

          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl">📰</span>
              <h1 className="text-3xl md:text-4xl font-bold">
                <span className="text-cheese">CHEESE</span>
                <span className="text-foreground">Ads</span>
              </h1>
              <span className="text-3xl">📰</span>
            </div>
            <p className="text-muted-foreground max-w-lg mx-auto">
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
