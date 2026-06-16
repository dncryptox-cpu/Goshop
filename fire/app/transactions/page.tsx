"use client";

import { useState } from "react";
import { useFinanceStore, Transaction } from "@/store/useFinanceStore";
import { formatCurrency } from "@/lib/utils";
import { Plus } from "lucide-react";

export default function TransactionsPage() {
  const { transactions, addTransaction } = useFinanceStore();
  const [isAdding, setIsAdding] = useState(false);

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [type, setType] = useState<"Income" | "Expense">("Expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Living");
  const [note, setNote] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;

    const newTx: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      date,
      type,
      amount: parseFloat(amount),
      category,
      note,
    };
    
    addTransaction(newTx);
    setAmount("");
    setNote("");
    setIsAdding(false);
  };

  return (
    <div className="p-8 pb-20 max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Transactions</h1>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-white text-black px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-slate-200 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Record
        </button>
      </div>

      {isAdding && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
            <div className="lg:col-span-1">
              <label className="block text-xs text-slate-400 mb-1">Date</label>
              <input 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="lg:col-span-1">
              <label className="block text-xs text-slate-400 mb-1">Type</label>
              <select 
                value={type} 
                onChange={e => setType(e.target.value as "Income" | "Expense")}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
              >
                <option value="Income">Income</option>
                <option value="Expense">Expense</option>
              </select>
            </div>
            <div className="lg:col-span-1">
              <label className="block text-xs text-slate-400 mb-1">Amount (VND)</label>
              <input 
                type="number" 
                value={amount} 
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="lg:col-span-1">
              <label className="block text-xs text-slate-400 mb-1">Category</label>
              <input 
                type="text" 
                value={category} 
                onChange={e => setCategory(e.target.value)}
                placeholder="e.g. Trading"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="lg:col-span-1">
              <label className="block text-xs text-slate-400 mb-1">Note</label>
              <input 
                type="text" 
                value={note} 
                onChange={e => setNote(e.target.value)}
                placeholder="Details"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="lg:col-span-1">
              <button type="submit" className="w-full bg-orange-600 hover:bg-orange-500 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors">
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/40 border-b border-white/10">
            <tr>
              <th className="px-6 py-4 font-medium text-slate-400">Date</th>
              <th className="px-6 py-4 font-medium text-slate-400">Type</th>
              <th className="px-6 py-4 font-medium text-slate-400">Category</th>
              <th className="px-6 py-4 font-medium text-slate-400">Note</th>
              <th className="px-6 py-4 font-medium text-slate-400 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-slate-300">{tx.date}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                    tx.type === "Income" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                  }`}>
                    {tx.type}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-slate-300">{tx.category}</td>
                <td className="px-6 py-4 text-slate-400">{tx.note}</td>
                <td className={`px-6 py-4 whitespace-nowrap text-right font-medium ${
                  tx.type === "Income" ? "text-green-400" : "text-white"
                }`}>
                  {tx.type === "Income" ? "+" : "-"}{formatCurrency(tx.amount)}
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                  No transactions found. Add one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
