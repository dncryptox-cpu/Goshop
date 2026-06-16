import { BrainCircuit, Lightbulb, TrendingDown, TrendingUp, AlertTriangle, ArrowRight } from "lucide-react";

export default function AdvisorPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-2">
          <BrainCircuit className="w-8 h-8 text-pink-400" /> AI Wealth Advisor
        </h1>
        <p className="text-slate-400">Personalized insights based on your portfolio and goals.</p>
      </div>

      {/* Main AI Insight Card */}
      <div className="glass-card p-8 rounded-3xl border border-pink-500/20 bg-gradient-to-br from-pink-500/5 to-purple-500/5 relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-pink-500/20 rounded-full blur-[80px]" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-6">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-pink-500"></span>
            </span>
            <span className="text-sm font-medium text-pink-400 tracking-wider uppercase">Live Analysis</span>
          </div>

          <p className="text-2xl md:text-3xl font-medium leading-relaxed text-white mb-8">
            "You are <span className="text-emerald-400 font-bold">81.7%</span> toward your FIRE goal. However, your portfolio is heavily concentrated in Crypto. Consider increasing cash reserves to reduce drawdown risk before hitting Coast FIRE."
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-black/40 p-5 rounded-2xl border border-white/5 backdrop-blur-md">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <h4 className="font-semibold text-slate-200">Strengths</h4>
              </div>
              <ul className="text-sm text-slate-400 space-y-2">
                <li>• Excellent savings rate (42%)</li>
                <li>• Crypto portfolio up 12% YTD</li>
                <li>• Emergency fund fully funded</li>
              </ul>
            </div>
            
            <div className="bg-black/40 p-5 rounded-2xl border border-white/5 backdrop-blur-md">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="w-5 h-5 text-red-400" />
                <h4 className="font-semibold text-slate-200">Weaknesses</h4>
              </div>
              <ul className="text-sm text-slate-400 space-y-2">
                <li>• 60% concentration in ETH</li>
                <li>• Stock portfolio underperforming S&P</li>
                <li>• High risk score (82/100)</li>
              </ul>
            </div>

            <div className="bg-black/40 p-5 rounded-2xl border border-white/5 backdrop-blur-md">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                <h4 className="font-semibold text-slate-200">Action Plan</h4>
              </div>
              <ul className="text-sm text-slate-400 space-y-2">
                <li>• Rebalance 10% ETH to Cash</li>
                <li>• Review underperforming stocks</li>
                <li>• Set up automated DCA for S&P 500</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Suggested Actions */}
      <div>
        <h3 className="text-xl font-semibold mb-4">Recommended Actions</h3>
        <div className="space-y-3">
          <ActionCard 
            icon={<Lightbulb className="w-5 h-5 text-yellow-400" />}
            title="Optimize Cash Yield"
            description="Your cash reserves are currently earning 0%. Moving them to a high-yield savings account could generate an extra 20M VND annually."
            impact="High Impact"
          />
          <ActionCard 
            icon={<BrainCircuit className="w-5 h-5 text-indigo-400" />}
            title="Tax Loss Harvesting"
            description="You have 3 losing positions in your stock portfolio. Harvesting these losses could offset your recent crypto gains."
            impact="Medium Impact"
          />
        </div>
      </div>
    </div>
  );
}

function ActionCard({ icon, title, description, impact }: { icon: React.ReactNode, title: string, description: string, impact: string }) {
  return (
    <div className="glass-card p-5 rounded-2xl border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 hover:bg-white/[0.02] transition-colors cursor-pointer group">
      <div className="flex items-start gap-4 flex-1">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-white">{title}</h4>
            <span className="text-xs px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-full font-medium">{impact}</span>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
        </div>
      </div>
      <button className="flex items-center gap-2 text-sm font-medium text-white bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg transition-colors whitespace-nowrap">
        Take Action <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </button>
    </div>
  );
}
