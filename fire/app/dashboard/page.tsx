"use client";

import { useFinanceStore } from "@/store/useFinanceStore";
import { formatCurrency } from "@/lib/utils";
import { Target, TrendingUp, Wallet, Clock, ArrowUpRight, ArrowDownRight } from "lucide-react";

export default function DashboardPage() {
  const store = useFinanceStore();
  
  const currentNetWorth = store.baseNetWorth + store.transactions.reduce((acc, tx) => {
    return tx.type === "Income" ? acc + tx.amount : acc - tx.amount;
  }, 0);
  
  const progressPercent = Math.min((currentNetWorth / store.settings.fireTarget) * 100, 100);
  
  const latestMonthProfit = store.monthlyProfits[store.monthlyProfits.length - 1];
  const monthlyTotal = latestMonthProfit 
    ? latestMonthProfit.tradingProfit + latestMonthProfit.fundingProfit + latestMonthProfit.airdropProfit + latestMonthProfit.shopProfit + latestMonthProfit.otherProfit 
    : 0;

  const yearlyTotal = store.monthlyProfits.reduce((acc, month) => {
    return acc + month.tradingProfit + month.fundingProfit + month.airdropProfit + month.shopProfit + month.otherProfit;
  }, 0);

  // Simple ETA calculation without compound interest for MVP
  const remaining = Math.max(store.settings.fireTarget - currentNetWorth, 0);
  let etaText = "Goal Reached!";
  if (remaining > 0) {
    if (yearlyTotal > 0) {
      const averageMonthly = yearlyTotal / store.monthlyProfits.length;
      const monthsLeft = remaining / averageMonthly;
      const years = Math.floor(monthsLeft / 12);
      const months = Math.floor(monthsLeft % 12);
      etaText = `${years} yrs ${months} mos`;
    } else {
      etaText = "N/A";
    }
  }

  return (
    <div className="p-8 pb-20 max-w-6xl mx-auto animate-in fade-in zoom-in-95 duration-500">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Net Worth */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Wallet className="w-24 h-24 text-orange-500" />
          </div>
          <div className="relative z-10">
            <p className="text-sm text-slate-400 font-medium mb-1">Current Net Worth</p>
            <h2 className="text-4xl font-bold text-white mb-2">{formatCurrency(currentNetWorth)}</h2>
            <div className="inline-flex items-center text-xs font-medium px-2 py-1 bg-green-500/20 text-green-400 rounded-full">
              <ArrowUpRight className="w-3 h-3 mr-1" />
              On Track
            </div>
          </div>
        </div>

        {/* FIRE Target */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Target className="w-24 h-24 text-purple-500" />
          </div>
          <div className="relative z-10">
            <p className="text-sm text-slate-400 font-medium mb-1">FIRE Target</p>
            <h2 className="text-3xl font-bold text-white mb-2">{formatCurrency(store.settings.fireTarget)}</h2>
            
            <div className="w-full bg-black/50 rounded-full h-2.5 mt-4 mb-1">
              <div 
                className="bg-gradient-to-r from-orange-500 to-red-500 h-2.5 rounded-full" 
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
            <p className="text-xs text-slate-400 text-right">{progressPercent.toFixed(1)}% Completed</p>
          </div>
        </div>

        {/* ETA */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Clock className="w-24 h-24 text-blue-500" />
          </div>
          <div className="relative z-10">
            <p className="text-sm text-slate-400 font-medium mb-1">Est. Time To Goal</p>
            <h2 className="text-3xl font-bold text-white mb-2">{etaText}</h2>
            <p className="text-sm text-slate-400">Based on recent averages</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Profit */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-400 font-medium">Monthly Profit (This Month)</p>
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-1">{formatCurrency(monthlyTotal)}</h2>
          </div>
        </div>

        {/* Yearly Profit */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-400 font-medium">Yearly Profit (YTD)</p>
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-1">{formatCurrency(yearlyTotal)}</h2>
          </div>
        </div>
      </div>
    </div>
  );
}
