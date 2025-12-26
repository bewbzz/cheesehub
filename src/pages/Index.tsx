import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Lock, ArrowRight, Shield, Zap, ShoppingBag } from "lucide-react";
import cheeseArmy from "@/assets/cheesearmy.png";
import { BackgroundDecorations } from "@/components/drops/BackgroundDecorations";
import { TokenStatsBanner } from "@/components/home/TokenStatsBanner";

const Index = () => {
  return (
    <div className="min-h-screen bg-background relative">
      <BackgroundDecorations />
      <Header />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cheese/5 via-transparent to-cheese-dark/5" />
        <div className="container relative py-20 md:py-32">
          <div className="max-w-3xl mx-auto text-center relative">
            <img 
              src={cheeseArmy} 
              alt="" 
              className="absolute left-1/2 top-[15%] -translate-x-1/2 -translate-y-1/2 w-72 md:w-96 opacity-25 pointer-events-none"
            />
            <h1 className="relative text-4xl md:text-6xl font-bold mb-6">
              <span className="text-cheese">CHEESE</span>
              <span className="text-foreground">Hub</span>
            </h1>
            <p className="relative text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Facilitating Front-End access to a range of tools on the WAX Blockchain
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-cheese hover:bg-cheese-dark text-primary-foreground font-semibold">
                <a href="https://cheeseonwax.github.io/" target="_blank" rel="noopener noreferrer">
                  Website
                  <ArrowRight className="ml-2 h-5 w-5" />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-cheese/50 hover:bg-cheese/10 text-foreground font-semibold">
                <a href="https://cheeseonwax.github.io/cheesepaper.pdf" target="_blank" rel="noopener noreferrer">
                  White paper
                  <ArrowRight className="ml-2 h-5 w-5" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Token Stats Banner */}
      <TokenStatsBanner />

      {/* CHEESETools Section */}
      <section className="container py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-4"><span className="text-cheese">CHEESE</span><span className="text-foreground">Tools</span></h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* CHEESEFaucet CTA */}
          <Card className="bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border-cheese/20">
            <CardContent className="py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-cheese/20 flex items-center justify-center mx-auto mb-6">
                <Zap className="h-8 w-8 text-cheese" />
              </div>
              <h2 className="text-2xl font-bold mb-4">CHEESEFaucet</h2>
              <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                Stake and claim CHEESE tokens daily. A simple way to grow your holdings in the CHEESE ecosystem.
              </p>
              <Button asChild size="lg" className="bg-cheese hover:bg-cheese-dark text-primary-foreground font-semibold">
                <a href="https://cheeseonwax.github.io/tools/cheesefaucet.html" target="_blank" rel="noopener noreferrer">
                  Go to CHEESEFaucet
                  <ArrowRight className="ml-2 h-5 w-5" />
                </a>
              </Button>
            </CardContent>
          </Card>

          {/* CHEESE DAO CTA */}
          <Card className="bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border-cheese/20">
            <CardContent className="py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-cheese/20 flex items-center justify-center mx-auto mb-6">
                <Shield className="h-8 w-8 text-cheese" />
              </div>
              <h2 className="text-2xl font-bold mb-4">CHEESEDao</h2>
              <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                Participate in governance and help shape the future of your token community.
              </p>
              <Button asChild size="lg" className="bg-cheese hover:bg-cheese-dark text-primary-foreground font-semibold">
                <Link to="/dao">
                  Go to CHEESE DAO
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Products Section */}
      <section className="container py-16">
        <div className="grid md:grid-cols-2 gap-6">
          {/* CHEESELock CTA */}
          <Card className="bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border-cheese/20">
            <CardContent className="py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-cheese/20 flex items-center justify-center mx-auto mb-6">
                <Lock className="h-8 w-8 text-cheese" />
              </div>
              <h2 className="text-2xl font-bold mb-4">CHEESELock</h2>
              <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                Secure your tokens with time-locked smart contracts. Perfect for vesting and investor protection.
              </p>
              <Button asChild size="lg" className="bg-cheese hover:bg-cheese-dark text-primary-foreground font-semibold">
                <Link to="/locker">
                  Go to CHEESELock
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* CHEESEDrops CTA */}
          <Card className="bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border-cheese/20">
            <CardContent className="py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-cheese/20 flex items-center justify-center mx-auto mb-6">
                <ShoppingBag className="h-8 w-8 text-cheese" />
              </div>
              <h2 className="text-2xl font-bold mb-4">CHEESEDrops</h2>
              <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                Exchange your CHEESE tokens for exclusive NFTs and physical items from our collection.
              </p>
              <Button asChild size="lg" className="bg-cheese hover:bg-cheese-dark text-primary-foreground font-semibold">
                <Link to="/drops">
                  Go to CHEESEDrops
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="container text-center text-sm text-muted-foreground">
          <p><span className="text-cheese">CHEESE</span><span className="text-foreground">Hub</span> • Built on WAX • Powered by $CHEESE, WaxDAO and NFTHive Smart Contracts</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
