import { Layout } from "@/components/Layout";
import { SlotCalendar } from "@/components/bannerads/SlotCalendar";

const BannerAds = () => {
  return (
    <Layout>
      <section className="container py-8 md:py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            <span className="text-cheese">CHEESE</span>
            <span className="text-foreground">Ads</span>
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Rent banner ad slots on the CHEESEHub homepage. Each day has two positions — pay with WAX or CHEESE.
          </p>
        </div>
        <SlotCalendar />
      </section>
    </Layout>
  );
};

export default BannerAds;
