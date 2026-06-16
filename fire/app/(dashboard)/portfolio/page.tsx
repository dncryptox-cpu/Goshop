import { PieChart, LineChart, Wallet, ArrowUpRight, ArrowDownRight, Plus } from "lucide-react";

export default function PortfolioPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold mb-2">Portfolio Tracker</h1>
          <p className="text-slate-400">Manage your assets across Crypto, Stocks, and Real Estate.</p>
        </div>
        <button className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Asset
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Allocations */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card p-6 rounded-2xl border border-white/10">
            <h3 className="font-semibold mb-4 text-slate-300">Allocations</h3>
            <div className="space-y-4">
              <AllocationRow label="Crypto" percentage={45} color="bg-indigo-500" value="1.1B VND" />
              <AllocationRow label="Stocks" percentage={30} color="bg-emerald-500" value="735M VND" />
              <AllocationRow label="Real Estate" percentage={15} color="bg-purple-500" value="367M VND" />
              <AllocationRow label="Cash" percentage={10} color="bg-blue-500" value="245M VND" />
            </div>
          </div>
          
          <div className="glass-card p-6 rounded-2xl border border-white/10">
            <h3 className="font-semibold mb-4 text-slate-300">Top Performers</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="font-medium">BTC</span>
                <span className="text-emerald-400 text-sm flex items-center"><ArrowUpRight className="w-3 h-3 mr-1"/>+14.2%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">NVDA</span>
                <span className="text-emerald-400 text-sm flex items-center"><ArrowUpRight className="w-3 h-3 mr-1"/>+8.4%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Holding Table Area */}
        <div className="lg:col-span-3 space-y-6">
          <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
              <h3 className="font-semibold text-lg">Your Holdings</h3>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 rounded-lg bg-white/5 text-sm font-medium hover:bg-white/10 transition-colors">Crypto</button>
                <button className="px-3 py-1.5 rounded-lg bg-white/5 text-sm font-medium hover:bg-white/10 transition-colors">Stocks</button>
                <button className="px-3 py-1.5 rounded-lg bg-white/5 text-sm font-medium hover:bg-white/10 transition-colors">All</button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-slate-400 text-sm">
                    <th className="p-4 font-medium">Asset</th>
                    <th className="p-4 font-medium">Price</th>
                    <th className="p-4 font-medium">Holdings</th>
                    <th className="p-4 font-medium">Total Value</th>
                    <th className="p-4 font-medium">PnL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <HoldingRow name="Bitcoin" symbol="BTC" price="1.6B VND" holdings="0.45 BTC" value="720M VND" pnl="+24.5%" positive />
                  <HoldingRow name="Ethereum" symbol="ETH" price="85M VND" holdings="4.2 ETH" value="357M VND" pnl="+12.1%" positive />
                  <HoldingRow name="Apple Inc." symbol="AAPL" price="4.2M VND" holdings="50 Shares" value="210M VND" pnl="-1.2%" positive={false} />
                  <HoldingRow name="Vanguard S&P 500" symbol="VOO" price="11.5M VND" holdings="45 Shares" value="517.5M VND" pnl="+8.4%" positive />
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AllocationRow({ label, percentage, color, value }: { label: string, percentage: number, color: string, value: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-300 font-medium">{label}</span>
        <span className="text-white">{value}</span>
      </div>
      <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden flex items-center">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function HoldingRow({ name, symbol, price, holdings, value, pnl, positive }: { name: string, symbol: string, price: string, holdings: string, value: string, pnl: string, positive: boolean }) {
  return (
    <tr className="hover:bg-white/[0.02] transition-colors">
      <td className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-xs">
            {symbol[0]}
          </div>
          <div>
            <p className="font-medium text-white">{name}</p>
            <p className="text-xs text-slate-400">{symbol}</p>
          </div>
        </div>
      </td>
      <td className="p-4 text-sm">{price}</td>
      <td className="p-4 text-sm">{holdings}</td>
      <td className="p-4 font-medium">{value}</td>
      <td className="p-4">
        <span className={`text-sm font-medium px-2 py-1 rounded-md flex items-center w-max ${positive ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}`}>
          {positive ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
          {pnl}
        </span>
      </td>
    </tr>
  );
}
