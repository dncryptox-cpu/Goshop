import { Map, Target, Flag, CheckCircle2, CircleDashed } from "lucide-react";

export default function RoadmapPage() {
  const milestones = [
    { id: 1, title: "Initial Emergency Fund", target: "100M VND", progress: 100, completed: true, date: "Jan 2024" },
    { id: 2, title: "Investment Seed", target: "500M VND", progress: 100, completed: true, date: "Dec 2024" },
    { id: 3, title: "1 Billion Milestone", target: "1B VND", progress: 100, completed: true, date: "Aug 2025" },
    { id: 4, title: "Current Target", target: "2.45B VND", progress: 100, completed: true, date: "Today" },
    { id: 5, title: "Coast FIRE", target: "3B VND", progress: 81.7, completed: false, date: "Sep 2028" },
    { id: 6, title: "Lean FIRE", target: "5B VND", progress: 49, completed: false, date: "Dec 2030" },
    { id: 7, title: "Financial Freedom", target: "10B VND", progress: 24.5, completed: false, date: "Mar 2035" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Wealth Map</h1>
          <p className="text-slate-400">Visualize your roadmap to financial freedom.</p>
        </div>
        <button className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
          <Map className="w-4 h-4" /> Edit Map
        </button>
      </div>

      <div className="relative pt-8">
        {/* Vertical Line */}
        <div className="absolute left-[39px] top-8 bottom-0 w-0.5 bg-gradient-to-b from-emerald-500 via-indigo-500 to-white/10" />

        <div className="space-y-12 relative">
          {milestones.map((node, index) => (
            <div key={node.id} className={`flex items-start gap-8 group ${node.completed ? 'opacity-80' : ''}`}>
              <div className="relative z-10 flex-shrink-0 bg-background py-2">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center border-4 ${
                  node.completed 
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' 
                    : node.progress > 50
                      ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400'
                      : 'bg-white/5 border-white/10 text-slate-500'
                } group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(0,0,0,0.5)]`}>
                  {node.completed ? <CheckCircle2 className="w-8 h-8" /> : node.id === milestones.length ? <Flag className="w-8 h-8" /> : <Target className="w-8 h-8" />}
                </div>
              </div>

              <div className={`flex-1 glass-card p-6 rounded-2xl border ${node.completed ? 'border-emerald-500/20' : node.progress > 50 ? 'border-indigo-500/30' : 'border-white/5'}`}>
                <div className="flex justify-between items-start mb-2">
                  <h3 className={`text-xl font-bold ${node.completed ? 'text-emerald-400' : 'text-white'}`}>{node.title}</h3>
                  <span className="text-sm font-medium text-slate-400 bg-white/5 px-3 py-1 rounded-full">{node.date}</span>
                </div>
                
                <div className="flex justify-between items-end mt-4 mb-2">
                  <p className="text-2xl font-bold text-slate-300">{node.target}</p>
                  <p className="text-sm text-slate-400">{node.progress}% complete</p>
                </div>
                
                <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                  <div className={`h-full rounded-full ${node.completed ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${node.progress}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
