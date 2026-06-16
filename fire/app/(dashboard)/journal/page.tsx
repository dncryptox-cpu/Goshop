import { BookOpen, Plus, Search, Tag, Calendar, MoreHorizontal } from "lucide-react";

export default function JournalPage() {
  const entries = [
    {
      id: 1,
      date: "Oct 15, 2026",
      asset: "ETH",
      type: "Buy",
      price: "$2,850",
      reason: "Technicals showing strong support, expecting ETF inflows.",
      outcome: "Pending",
      tags: ["Crypto", "Swing Trade"]
    },
    {
      id: 2,
      date: "Sep 22, 2026",
      asset: "MWG",
      type: "Sell",
      price: "68,000 VND",
      reason: "Hit profit target of 20%, rebalancing to cash.",
      outcome: "Success",
      tags: ["Stocks", "Take Profit"]
    },
    {
      id: 3,
      date: "Aug 10, 2026",
      asset: "BTC",
      type: "Buy",
      price: "$62,000",
      reason: "DCA schedule, ignoring short term volatility.",
      outcome: "Pending",
      tags: ["Crypto", "DCA"]
    }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-2">
            <BookOpen className="w-8 h-8 text-indigo-400" /> Investment Journal
          </h1>
          <p className="text-slate-400">Log your decisions, strategies, and lessons learned.</p>
        </div>
        <button className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium transition-colors flex items-center gap-2">
          <Plus className="w-5 h-5" /> New Entry
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search journal entries..." 
            className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-indigo-500/50 outline-none placeholder:text-slate-500"
          />
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-slate-300 hover:bg-white/5 transition-colors flex items-center gap-2">
            <Tag className="w-4 h-4" /> Filter Tags
          </button>
          <button className="px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-slate-300 hover:bg-white/5 transition-colors flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Date Range
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {entries.map(entry => (
          <div key={entry.id} className="glass-card p-6 rounded-2xl border border-white/10 hover:bg-white/[0.02] transition-colors group">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${entry.type === 'Buy' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-pink-500/10 text-pink-400 border border-pink-500/20'}`}>
                  {entry.asset}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{entry.type} {entry.asset} @ {entry.price}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${entry.outcome === 'Success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                      {entry.outcome}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {entry.date}
                  </p>
                </div>
              </div>
              <button className="text-slate-500 hover:text-white p-2">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>
            
            <div className="pl-15">
              <p className="text-slate-300 leading-relaxed mb-4">{entry.reason}</p>
              <div className="flex gap-2">
                {entry.tags.map(tag => (
                  <span key={tag} className="px-2 py-1 bg-white/5 border border-white/10 rounded-md text-xs text-slate-400 flex items-center gap-1">
                    <Tag className="w-3 h-3" /> {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
