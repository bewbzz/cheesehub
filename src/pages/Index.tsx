import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Lock, ArrowRight, Shield, Clock, Zap, ShoppingBag } from "lucide-react";
import cheeseLogo from "@/assets/cheese-logo.png";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cheese/5 via-transparent to-cheese-dark/5" />
        <div className="container relative py-20 md:py-32">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cheese/10 border border-cheese/20 mb-6">
              <img src={cheeseLogo} alt="Cheese" className="h-6 w-6" />
              <span className="text-sm font-medium">
                <span className="text-cheese">CHEESE</span>
                <span className="text-foreground">Hub</span>
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              <span className="text-cheese-gradient">WAX Blockchain</span>
              <br />
              <span className="text-foreground">DeFi Tools</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Alternative front-end for WaxDAO smart contracts. Lock tokens, buy NFT drops, and manage your WAX assets with a beautiful cheese-themed interface.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-cheese hover:bg-cheese-dark text-primary-foreground font-semibold">
                <Link to="/locker">
                  <Lock className="mr-2 h-5 w-5" />
                  CHEESELock
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-cheese/50 hover:bg-cheese/10 text-foreground font-semibold">
                <Link to="/drops">
                  <ShoppingBag className="mr-2 h-5 w-5" />
                  CHEESEDrops
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Why Use <span className="text-cheese">CHEESE</span><span className="text-foreground">Hub</span>?</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            A cleaner, more intuitive interface for interacting with WaxDAO's battle-tested smart contracts
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="border-border/50 hover:border-cheese/30 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-cheese/10 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-cheese" />
              </div>
              <CardTitle>Secure</CardTitle>
              <CardDescription>
                Uses WaxDAO's audited smart contracts. Your tokens never leave the blockchain.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border/50 hover:border-cheese/30 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-cheese/10 flex items-center justify-center mb-4">
                <Clock className="h-6 w-6 text-cheese" />
              </div>
              <CardTitle>Time-Locked</CardTitle>
              <CardDescription>
                Lock tokens until a specific date. Perfect for vesting, trust, or commitment.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border/50 hover:border-cheese/30 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-cheese/10 flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-cheese" />
              </div>
              <CardTitle>Easy to Use</CardTitle>
              <CardDescription>
                Connect your WAX wallet and start locking in seconds. No complicated setup required.
              </CardDescription>
            </CardHeader>
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
          <p><span className="text-cheese">CHEESE</span><span className="text-foreground">Hub</span> • Built on WAX • Powered by WaxDAO Smart Contracts</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
