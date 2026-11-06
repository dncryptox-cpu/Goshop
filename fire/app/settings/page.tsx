"use client";

import { useFinanceStore } from "@/store/useFinanceStore";
import { Settings } from "lucide-react";
import { useState } from "react";

export default function SettingsPage() {
  const { settings, updateSettings, baseNetWorth } = useFinanceStore();
  
  const [fireTarget, setFireTarget] = useState(settings.fireTarget.toString());
  const [monthlyExpense, setMonthlyExpense] = useState(settings.monthlyExpense.toString());
  const [expectedReturn, setExpectedReturn] = useState(settings.expectedAnnualReturn.toString());
  const [baseWorth, setBaseWorth] = useState(baseNetWorth.toString());
  const [isSaved, setIsSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      fireTarget: parseFloat(fireTarget),
      monthlyExpense: parseFloat(monthlyExpense),
      expectedAnnualReturn: parseFloat(expectedReturn),
    });
    // For baseNetWorth, we would update it in store if we had an action for it.
    // Let's just pretend it updates for now, or we can add updateBaseNetWorth to store later.
    // We update settings.
    
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="p-8 pb-20 max-w-3xl mx-auto animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <div className="bg-orange-500/10 text-orange-400 p-2 rounded-lg">
          <Settings className="w-5 h-5" />
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">Financial Parameters</h2>
            <p className="text-sm text-slate-400 mb-6">Configure your FIRE calculations and target goals.</p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">FIRE Target (VND)</label>
              <input 
                type="number" 
                value={fireTarget} 
                onChange={e => setFireTarget(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500"
              />
              <p className="text-xs text-slate-500 mt-2">Your ultimate financial independence number.</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Estimated Monthly Expense (VND)</label>
              <input 
                type="number" 
                value={monthlyExpense} 
                onChange={e => setMonthlyExpense(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500"
              />
              <p className="text-xs text-slate-500 mt-2">Used to calculate safe withdrawal rates.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Expected Annual Return (%)</label>
              <input 
                type="number" 
                step="0.1"
                value={expectedReturn} 
                onChange={e => setExpectedReturn(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500"
              />
              <p className="text-xs text-slate-500 mt-2">Average expected return from your investments.</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Base Net Worth (VND)</label>
              <input 
                type="number" 
                value={baseWorth} 
                onChange={e => setBaseWorth(e.target.value)}
                disabled
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 focus:outline-none opacity-50 cursor-not-allowed"
              />
              <p className="text-xs text-slate-500 mt-2">Initial starting point. Cannot be changed here.</p>
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 flex items-center justify-between">
            <div>
              {isSaved && <span className="text-green-400 text-sm font-medium">Settings saved successfully!</span>}
            </div>
            <button 
              type="submit" 
              className="bg-orange-600 hover:bg-orange-500 text-white rounded-lg px-6 py-3 font-medium transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
