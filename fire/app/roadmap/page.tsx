"use client";

import { useFinanceStore } from "@/store/useFinanceStore";
import { formatCurrency } from "@/lib/utils";
import { CheckCircle2, Circle, Map as MapIcon } from "lucide-react";

const MILESTONES = [
  500000000,
  1000000000,
  1500000000,
  2000000000,
  2500000000,
  3000000000,
];

export default function RoadmapPage() {
  const store = useFinanceStore();
  
  const currentNetWorth = store.baseNetWorth + store.transactions.reduce((acc, tx) => {
    return tx.type === "Income" ? acc + tx.amount : acc - tx.amount;
  }, 0);

  return (
    <div className="p-8 pb-20 max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-12">
        <h1 className="text-3xl font-bold">Wealth Roadmap</h1>
        <div className="bg-orange-500/10 text-orange-400 p-2 rounded-lg">
          <MapIcon className="w-5 h-5" />
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 relative">
        <div className="absolute left-[39px] top-8 bottom-8 w-0.5 bg-white/10"></div>
        
        <div className="space-y-12">
          {MILESTONES.map((milestone, index) => {
            const isCompleted = currentNetWorth >= milestone;
            const isCurrent = !isCompleted && (index === 0 || currentNetWorth >= MILESTONES[index - 1]);
            
            let progress = 0;
            if (isCompleted) {
              progress = 100;
            } else if (isCurrent) {
              const previousMilestone = index === 0 ? 0 : MILESTONES[index - 1];
              const range = milestone - previousMilestone;
              const currentProgress = currentNetWorth - previousMilestone;
              progress = Math.min(Math.max((currentProgress / range) * 100, 0), 100);
            }

            return (
              <div key={index} className="relative flex items-center gap-8 z-10">
                <div className="flex-shrink-0 bg-[#030712] py-2">
                  {isCompleted ? (
                    <CheckCircle2 className="w-8 h-8 text-green-500 bg-black rounded-full" />
                  ) : isCurrent ? (
                    <div className="w-8 h-8 rounded-full border-2 border-orange-500 flex items-center justify-center bg-black">
                      <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
                    </div>
                  ) : (
                    <Circle className="w-8 h-8 text-white/20 bg-black rounded-full" />
                  )}
                </div>
                
                <div className={`flex-1 p-6 rounded-2xl border transition-all ${
                  isCompleted 
                    ? "bg-green-500/5 border-green-500/20" 
                    : isCurrent 
                      ? "bg-orange-500/10 border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.1)]" 
                      : "bg-white/5 border-white/5 opacity-50"
                }`}>
                  <h3 className={`text-xl font-bold mb-2 ${isCompleted ? "text-green-400" : isCurrent ? "text-orange-400" : "text-white"}`}>
                    {formatCurrency(milestone)}
                  </h3>
                  
                  {isCurrent && (
                    <div className="mt-4">
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Progress to next milestone</span>
                        <span>{progress.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-black/50 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-orange-500 h-1.5 rounded-full" 
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  {isCompleted && (
                    <p className="text-sm text-green-500/70">Milestone achieved</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
