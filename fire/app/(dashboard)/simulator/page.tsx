import { Calculator, Play, TrendingUp } from "lucide-react";

export default function SimulatorPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">FIRE Simulator</h1>
        <p className="text-slate-400">Run Monte Carlo simulations or custom market scenarios.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Input Parameters Area */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-5">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Calculator className="w-5 h-5 text-indigo-400" /> Parameters
            </h3>
            
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Current Net Worth (VND)</label>
              <input type="text" defaultValue="2,450,000,000" className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none" />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Monthly Savings (VND)</label>
              <input type="text" defaultValue="50,000,000" className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none" />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-slate-400">Expected Annual Return (%)</label>
              <input type="number" defaultValue={12} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none" />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-slate-400">Inflation Rate (%)</label>
              <input type="number" defaultValue={4} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none" />
            </div>

            <button className="w-full bg-indigo-500 hover:bg-indigo-600 text-white py-3 rounded-xl font-medium transition-colors flex justify-center items-center gap-2 mt-4">
              <Play className="w-4 h-4" /> Run Simulation
            </button>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-white/10">
            <h3 className="font-semibold mb-4 text-slate-300">Quick Scenarios</h3>
            <div className="space-y-2">
              <button className="w-full text-left px-4 py-3 rounded-lg border border-white/5 hover:bg-white/5 transition-colors text-sm text-slate-300">
                🚀 Crypto Supercycle (BTC +200%)
              </button>
              <button className="w-full text-left px-4 py-3 rounded-lg border border-white/5 hover:bg-white/5 transition-colors text-sm text-slate-300">
                📉 Bear Market (-20% All Assets)
              </button>
              <button className="w-full text-left px-4 py-3 rounded-lg border border-white/5 hover:bg-white/5 transition-colors text-sm text-slate-300">
                🏠 Real Estate Boom
              </button>
            </div>
          </div>
        </div>

        {/* Results Area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-8 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 relative overflow-hidden">
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px]" />
            <h2 className="text-2xl font-semibold mb-2">Projected FIRE Date</h2>
            <div className="flex items-baseline gap-3 mb-6">
              <span className="text-5xl font-bold text-white">September 2028</span>
              <span className="text-lg text-emerald-400 font-medium">In 2.5 Years</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                <p className="text-sm text-slate-400 mb-1">Projected Portfolio Value</p>
                <p className="text-xl font-semibold">3.85B VND</p>
              </div>
              <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                <p className="text-sm text-slate-400 mb-1">Safe Monthly Withdrawal</p>
                <p className="text-xl font-semibold text-emerald-400">12.8M VND</p>
              </div>
            </div>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-white/10 h-[400px] flex flex-col">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              Growth Projection Chart
            </h3>
            <div className="flex-1 flex items-center justify-center border border-dashed border-white/10 rounded-xl bg-white/[0.02]">
              <p className="text-slate-500 text-sm">Recharts AreaChart Simulation Placeholder</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
