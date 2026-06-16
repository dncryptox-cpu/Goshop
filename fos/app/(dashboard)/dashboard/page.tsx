import { ArrowUpRight, TrendingUp, Wallet, Target, Activity } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Top Net Worth Card */}
      <div className="glass-card rounded-3xl p-8 border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-slate-400 font-medium">Total Net Worth</span>
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full">
                <ArrowUpRight className="w-3 h-3" /> +12.4%
              </span>
            </div>
            <h1 className="text-5xl font-bold tracking-tight text-white mb-2">2.45B <span className="text-2xl text-slate-500 font-normal">VND</span></h1>
            <p className="text-slate-400 text-sm">Updated 2 hours ago</p>
          </div>

          <div className="w-full md:w-1/3 bg-black/40 p-5 rounded-2xl border border-white/5 backdrop-blur-md">
            <div className="flex justify-between items-end mb-3">
              <div>
                <p className="text-xs text-slate-400 mb-1">Target FIRE Number</p>
                <p className="text-xl font-semibold text-indigo-400">3.00B VND</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400 mb-1">Progress</p>
                <p className="text-xl font-bold text-white">81.7%</p>
              </div>
            </div>
            <div className="w-full bg-white/5 rounded-full h-3 mb-2 overflow-hidden border border-white/5">
              <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full w-[81.7%] rounded-full relative">
                <div className="absolute inset-0 bg-white/20 w-full animate-pulse"></div>
              </div>
            </div>
            <p className="text-xs text-slate-400 text-right">Projected FIRE Date: <span className="text-white font-medium">Sep 2028</span></p>
          </div>
        </div>
      </div>

      {/* Widgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <WidgetCard 
          title="Crypto Portfolio"
          value="1.20B VND"
          trend="+5.2%"
          icon={<Wallet className="w-5 h-5 text-indigo-400" />}
          positive
        />
        <WidgetCard 
          title="Stock Portfolio"
          value="850M VND"
          trend="+1.8%"
          icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
          positive
        />
        <WidgetCard 
          title="Cash Reserves"
          value="400M VND"
          trend="-2.1%"
          icon={<Activity className="w-5 h-5 text-blue-400" />}
          positive={false}
        />
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card p-6 rounded-2xl border border-white/10 h-[400px] flex flex-col">
          <h3 className="text-lg font-semibold mb-4">Net Worth Growth</h3>
          <div className="flex-1 flex items-center justify-center border border-dashed border-white/10 rounded-xl bg-white/[0.02]">
            <p className="text-slate-500 text-sm">Recharts AreaChart Placeholder</p>
          </div>
        </div>
        
        <div className="glass-card p-6 rounded-2xl border border-white/10 h-[400px] flex flex-col">
          <h3 className="text-lg font-semibold mb-4">Asset Allocation</h3>
          <div className="flex-1 flex items-center justify-center border border-dashed border-white/10 rounded-xl bg-white/[0.02]">
            <p className="text-slate-500 text-sm">Recharts PieChart Placeholder</p>
          </div>
        </div>
      </div>
      
      {/* Recent Goals/Missions */}
      <div className="glass-card p-6 rounded-2xl border border-white/10">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Active Missions</h3>
          <button className="text-sm text-indigo-400 hover:text-indigo-300">View All</button>
        </div>
        <div className="space-y-4">
          <MissionRow title="Reach 2.5B Net Worth" progress={90} reward="500 pts" />
          <MissionRow title="Save 6 months Emergency Fund" progress={100} reward="200 pts" completed />
          <MissionRow title="Max out 2026 Crypto Allocation" progress={45} reward="300 pts" />
        </div>
      </div>
    </div>
  );
}

function WidgetCard({ title, value, trend, icon, positive }: { title: string, value: string, trend: string, icon: React.ReactNode, positive: boolean }) {
  return (
    <div className="glass-card p-6 rounded-2xl border border-white/10 hover:bg-white/[0.02] transition-colors">
      <div className="flex justify-between items-start mb-4">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
          {icon}
        </div>
        <span className={`text-sm font-medium px-2 py-1 rounded-full ${positive ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}`}>
          {trend}
        </span>
      </div>
      <p className="text-slate-400 text-sm mb-1">{title}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function MissionRow({ title, progress, reward, completed = false }: { title: string, progress: number, reward: string, completed?: boolean }) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-black/20 border border-white/5">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${completed ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-500' : 'bg-white/5 border-white/10 text-slate-400'}`}>
        <Target className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <div className="flex justify-between mb-1">
          <p className={`font-medium ${completed ? 'text-slate-300 line-through' : 'text-white'}`}>{title}</p>
          <span className="text-xs font-semibold text-indigo-400">{reward}</span>
        </div>
        <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
          <div 
            className={`h-full rounded-full ${completed ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
