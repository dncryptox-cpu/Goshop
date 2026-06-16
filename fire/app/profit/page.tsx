"use client";

import { useFinanceStore } from "@/store/useFinanceStore";
import { formatCurrency } from "@/lib/utils";
import { BarChart3 } from "lucide-react";

export default function ProfitPage() {
  const { monthlyProfits } = useFinanceStore();

  return (
    <div className="p-8 pb-20 max-w-6xl mx-auto animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Monthly Profit</h1>
        <div className="bg-orange-500/10 text-orange-400 p-2 rounded-lg">
          <BarChart3 className="w-5 h-5" />
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/40 border-b border-white/10">
            <tr>
              <th className="px-6 py-4 font-medium text-slate-400">Month</th>
              <th className="px-6 py-4 font-medium text-slate-400 text-right">Trading</th>
              <th className="px-6 py-4 font-medium text-slate-400 text-right">Funding</th>
              <th className="px-6 py-4 font-medium text-slate-400 text-right">Airdrop</th>
              <th className="px-6 py-4 font-medium text-slate-400 text-right">Shop</th>
              <th className="px-6 py-4 font-medium text-slate-400 text-right">Other</th>
              <th className="px-6 py-4 font-medium text-orange-400 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {monthlyProfits.map((record, index) => {
              const total = record.tradingProfit + record.fundingProfit + record.airdropProfit + record.shopProfit + record.otherProfit;
              return (
                <tr key={index} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-white">{record.month}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-slate-300">{formatCurrency(record.tradingProfit)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-slate-300">{formatCurrency(record.fundingProfit)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-slate-300">{formatCurrency(record.airdropProfit)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-slate-300">{formatCurrency(record.shopProfit)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-slate-300">{formatCurrency(record.otherProfit)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-orange-400">{formatCurrency(total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
