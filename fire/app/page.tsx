import Link from "next/link";
import { ArrowRight, BarChart3, LineChart, Shield, Target, Zap } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen overflow-hidden">
      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/20 backdrop-blur-md">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight">FIRE OS</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <Link href="#features" className="hover:text-white transition-colors">Features</Link>
            <Link href="#how-it-works" className="hover:text-white transition-colors">How it works</Link>
            <Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
              Sign In
            </Link>
            <Link href="/register" className="text-sm font-medium bg-white text-black px-4 py-2 rounded-full hover:bg-slate-200 transition-colors">
              Start Free
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-32 pb-16">
        {/* Hero Section */}
        <section className="container mx-auto px-6 pt-12 pb-24 text-center relative">
          {/* Background effects */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/20 rounded-full blur-[120px] -z-10 pointer-events-none" />
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass border-white/10 text-sm font-medium text-indigo-300 mb-8">
            <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
            Version 1.0 is now live
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 max-w-4xl mx-auto leading-tight">
            Build Wealth. Track The Mission. <br className="hidden md:block" />
            <span className="text-gradient-primary">Reach Financial Freedom.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            The ultimate Personal Wealth Operating System for modern investors. Track net worth, manage portfolios, and simulate your path to early retirement.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register" className="w-full sm:w-auto px-8 py-4 bg-white text-black rounded-full font-medium text-lg hover:bg-slate-200 transition-all flex items-center justify-center gap-2 shadow-[0_0_40px_rgba(255,255,255,0.3)]">
              Start Free <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="#demo" className="w-full sm:w-auto px-8 py-4 glass border-white/10 text-white rounded-full font-medium text-lg hover:bg-white/5 transition-all flex items-center justify-center gap-2">
              View Demo
            </Link>
          </div>

          {/* Hero Dashboard Preview Image/Mockup placeholder */}
          <div className="mt-20 relative mx-auto max-w-5xl">
            <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-transparent z-10"></div>
            <div className="glass-card rounded-2xl border border-white/10 p-2 overflow-hidden shadow-2xl">
              <div className="bg-[#0a0f1c] rounded-xl overflow-hidden flex flex-col h-[400px] md:h-[600px] border border-white/5">
                {/* Mock UI Header */}
                <div className="h-12 border-b border-white/5 flex items-center px-4 gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                </div>
                {/* Mock UI Body */}
                <div className="flex-1 p-8 flex flex-col gap-6 opacity-80">
                  <div className="flex justify-between items-end">
                    <div>
                      <div className="text-slate-400 text-sm mb-1">Total Net Worth</div>
                      <div className="text-4xl font-bold">2.45B VND</div>
                    </div>
                    <div className="text-right">
                      <div className="text-slate-400 text-sm mb-1">Target FIRE Number</div>
                      <div className="text-xl font-semibold text-indigo-400">3.00B VND</div>
                    </div>
                  </div>
                  {/* Progress bar mock */}
                  <div className="w-full bg-white/5 rounded-full h-4 mt-2 overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full w-[81.7%] rounded-full relative">
                      <div className="absolute inset-0 bg-white/20 w-full animate-pulse"></div>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-green-400">+12% this year</span>
                    <span className="text-slate-400">81.7% to goal • ETA: 2 yrs 3 mos</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="container mx-auto px-6 py-24 border-t border-white/5">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need to reach FIRE</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">Designed specifically for crypto investors and wealth builders who need professional-grade tools.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard 
              icon={<LineChart className="w-6 h-6 text-indigo-400" />}
              title="Portfolio Tracker"
              description="Track Crypto, Stocks, Cash, and Real Estate in one unified dashboard with real-time PnL."
            />
            <FeatureCard 
              icon={<Target className="w-6 h-6 text-purple-400" />}
              title="Wealth Map Module"
              description="Visualize your roadmap to financial freedom. Set milestones and watch them turn green."
            />
            <FeatureCard 
              icon={<Zap className="w-6 h-6 text-yellow-400" />}
              title="Scenario Simulator"
              description="Run Monte Carlo simulations or custom scenarios like Crypto supercycles to predict future net worth."
            />
            <FeatureCard 
              icon={<Shield className="w-6 h-6 text-emerald-400" />}
              title="Asset Allocation Designer"
              description="Interactive planner to balance risk across BTC, ETH, Altcoins, and Cash."
            />
            <FeatureCard 
              icon={<BarChart3 className="w-6 h-6 text-blue-400" />}
              title="FIRE Calculator"
              description="Factor in inflation, expected returns, and withdrawal rates to pinpoint your exact FIRE date."
            />
            <FeatureCard 
              icon={<div className="font-bold text-lg text-pink-400">AI</div>}
              title="AI Wealth Advisor"
              description="Receive personalized insights and action plans based on your portfolio's risk level and asset concentration."
            />
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 bg-black/40 py-12">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-500" />
            <span className="font-semibold text-slate-300">Antigravity FIRE OS</span>
          </div>
          <p className="text-sm text-slate-500">© 2026 Antigravity. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="glass-card p-8 rounded-2xl hover:bg-white/[0.02] transition-colors group">
      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      <p className="text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
}
